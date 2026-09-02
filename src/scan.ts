// scanCode: run untrusted code in a disposable Solari sandbox and return a
// BehaviorTrace of what it did. The sandbox is always destroyed afterwards.

import { SolariClient } from "@solarisdk/sdk";
import { PYTHON_HARNESS, parseTrace } from "./instrument.js";
import type { BehaviorTrace, ScanInput } from "./types.js";

export interface ScanOptions {
  /** Solari API key. Defaults to process.env.SOLARI_API_KEY. */
  apiKey?: string;
  /** Idle timeout for the sandbox in ms. */
  timeoutMs?: number;
}

/**
 * Run `input.code` inside a fresh, isolated Solari micro-VM under the SafeRun
 * audit harness, and return what it did. The VM is killed in `finally`, so it
 * never lingers and never touches your machine.
 */
export async function scanCode(input: ScanInput, opts: ScanOptions = {}): Promise<BehaviorTrace> {
  const apiKey = opts.apiKey ?? process.env.SOLARI_API_KEY;
  if (!apiKey) throw new Error("SOLARI_API_KEY is not set — put it in .env.");
  if (input.language !== "python") {
    throw new Error(`Unsupported language "${input.language}" (v1 supports python).`);
  }

  const client = new SolariClient({ apiKey });
  const sandbox = await client.sandboxes.create({
    template: "base",
    timeoutMs: opts.timeoutMs ?? 5 * 60_000,
  });

  try {
    await sandbox.connect();
    // Write the untrusted code and the harness, then run the harness (never the
    // target directly — the harness installs the audit hook first).
    await sandbox.files.write("/tmp/target.py", input.code);
    await sandbox.files.write("/tmp/harness.py", PYTHON_HARNESS);
    const out = await sandbox.commands.run("python3", { args: ["/tmp/harness.py"] });
    return parseTrace(out.stdout, out.exitCode);
  } finally {
    // Destroy the VM. Without this it lingers until the idle timeout.
    await sandbox.kill();
  }
}
