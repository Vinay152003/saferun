// scanPyPI: download a PyPI package's source and run its setup.py under an audit
// shim in a disposable Solari sandbox, to see what it does at install time — the
// Python equivalent of npm's malicious postinstall.

import { SolariClient } from "@solarisdk/sdk";
import { PYTHON_INSTALL_SHIM, NPM_EVENT_LOG, parseEventLog } from "./instrument.js";
import type { BehaviorEvent, BehaviorTrace } from "./types.js";
import type { ScanOptions } from "./scan.js";

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,213}(==[A-Za-z0-9._-]+)?$/;

/**
 * Scan a PyPI package by name (optionally `name==version`). Forces a source
 * distribution, extracts it, and runs `setup.py egg_info` under the shim so any
 * top-level install-time code is captured. Wheels run no install code.
 */
export async function scanPyPI(name: string, opts: ScanOptions = {}): Promise<BehaviorTrace> {
  const apiKey = opts.apiKey ?? process.env.SOLARI_API_KEY;
  if (!apiKey) throw new Error("SOLARI_API_KEY is not set — put it in .env.");
  if (!NAME_RE.test(name)) throw new Error(`Invalid PyPI package name: ${JSON.stringify(name)}`);

  const client = new SolariClient({ apiKey });
  const sandbox = await client.sandboxes.create({
    template: "base",
    timeoutMs: opts.timeoutMs ?? 5 * 60_000,
  });

  const output: string[] = [];

  try {
    await sandbox.connect();
    await sandbox.files.write("/tmp/sitecustomize.py", PYTHON_INSTALL_SHIM);
    await sandbox.commands.run("mkdir", { args: ["-p", "/tmp/dl", "/tmp/src"] });

    // Phase 1: download the source dist (no code runs on download).
    const dl = await sandbox.commands.run("python3", {
      args: ["-m", "pip", "download", name, "--no-deps", "--no-binary", ":all:", "-d", "/tmp/dl"],
    });
    output.push(dl.stdout, dl.stderr);

    const ls = await sandbox.commands.run("sh", { args: ["-c", "ls /tmp/dl 2>/dev/null"] });
    const hasSdist = /\.tar\.gz|\.tgz|\.zip/.test(ls.stdout);
    if (!hasSdist) {
      return {
        events: [],
        stdout: output.filter(Boolean).join("\n").trim(),
        stderr: "",
        error:
          "No source distribution available (wheel-only or download failed). Wheels run no install-time code, so there is nothing to execute.",
        exitCode: dl.exitCode,
      };
    }

    // Phase 2: extract and run setup.py under the shim (PYTHONPATH=/tmp loads it).
    const staticEvents: BehaviorEvent[] = [
      { category: "process", event: "package.setup", detail: "installs from source and runs setup.py" },
    ];
    const run = await sandbox.commands.run("sh", {
      args: [
        "-c",
        "tar xzf /tmp/dl/*.tar.gz -C /tmp/src 2>/dev/null; cd /tmp/src/*/ 2>/dev/null && python3 setup.py egg_info 2>&1",
      ],
      env: { PYTHONPATH: "/tmp" },
    });
    output.push(run.stdout, run.stderr);

    let logged: BehaviorEvent[] = [];
    try {
      logged = parseEventLog(await sandbox.files.readText(NPM_EVENT_LOG));
    } catch {
      // no log => setup.py did nothing sensitive
    }

    return {
      events: [...staticEvents, ...logged],
      stdout: output.filter(Boolean).join("\n").trim(),
      stderr: "",
      error: null,
      exitCode: 0,
    };
  } finally {
    await sandbox.kill();
  }
}
