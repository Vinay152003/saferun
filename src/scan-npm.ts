// scanPackage: install an npm package in a disposable Solari sandbox and capture
// what it does — with a focus on install/postinstall scripts, the #1 npm
// supply-chain attack vector.
//
// Two phases keep it clean:
//   1. `npm install --ignore-scripts` (no shim) — download only, no capture, so
//      npm's own registry traffic and config reads are NOT counted as findings.
//   2. Run the package's declared install scripts under the Node shim — so the
//      behavior we capture is the *package's*, not npm's.

import { SolariClient } from "@solarisdk/sdk";
import { NODE_SHIM, NPM_EVENT_LOG, parseEventLog } from "./instrument.js";
import type { BehaviorEvent, BehaviorTrace } from "./types.js";
import type { ScanOptions } from "./scan.js";

const NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(?:@[a-z0-9-._~^*|>=< .x]+)?$/i;

/** node_modules directory for a package spec (strips any @version). */
function pkgDir(name: string): string {
  if (name.startsWith("@")) {
    const [scope, rest = ""] = name.slice(1).split("/");
    return `@${scope}/${rest.split("@")[0]}`;
  }
  return name.split("@")[0]!;
}

const INSTALL_PHASES = ["preinstall", "install", "postinstall"] as const;

/**
 * Scan an npm package by name (optionally `name@version`). Returns a
 * BehaviorTrace of what its install scripts did.
 */
export async function scanPackage(name: string, opts: ScanOptions = {}): Promise<BehaviorTrace> {
  const apiKey = opts.apiKey ?? process.env.SOLARI_API_KEY;
  if (!apiKey) throw new Error("SOLARI_API_KEY is not set — put it in .env.");
  if (!NAME_RE.test(name)) throw new Error(`Invalid npm package name: ${JSON.stringify(name)}`);

  const client = new SolariClient({ apiKey });
  const sandbox = await client.sandboxes.create({
    template: "base",
    timeoutMs: opts.timeoutMs ?? 5 * 60_000,
  });

  const output: string[] = [];
  const staticEvents: BehaviorEvent[] = [];
  let error: string | null = null;

  try {
    await sandbox.connect();
    await sandbox.files.write("/tmp/shim.cjs", NODE_SHIM);
    await sandbox.commands.run("mkdir", { args: ["-p", "/tmp/proj"] });
    await sandbox.commands.run("npm", { args: ["init", "-y"], cwd: "/tmp/proj" });

    // Phase 1: download only, no scripts, no shim.
    const install = await sandbox.commands.run("npm", {
      args: ["install", name, "--ignore-scripts", "--no-audit", "--no-fund"],
      cwd: "/tmp/proj",
    });
    output.push(install.stdout, install.stderr);

    const dir = `/tmp/proj/node_modules/${pkgDir(name)}`;
    let scripts: Record<string, string> = {};
    try {
      const pj = JSON.parse(await sandbox.files.readText(`${dir}/package.json`)) as {
        scripts?: Record<string, string>;
      };
      scripts = pj.scripts ?? {};
    } catch {
      error = `Could not install or read ${name}. npm output:\n${install.stderr || install.stdout}`;
      return { events: [], stdout: output.join("\n"), stderr: "", error, exitCode: install.exitCode };
    }

    // Phase 2: for each declared install script, record it statically (a big red
    // flag on its own) AND run it under the shim to see what it does.
    for (const phase of INSTALL_PHASES) {
      const cmd = scripts[phase];
      if (!cmd) continue;
      staticEvents.push({ category: "process", event: `package.${phase}`, detail: cmd });
      const run = await sandbox.commands.run("sh", {
        args: ["-c", cmd],
        cwd: dir,
        env: { NODE_OPTIONS: "--require /tmp/shim.cjs" },
      });
      output.push(run.stdout, run.stderr);
    }

    let logged: BehaviorEvent[] = [];
    try {
      logged = parseEventLog(await sandbox.files.readText(NPM_EVENT_LOG));
    } catch {
      // no log file => the scripts did nothing sensitive
    }

    return {
      events: [...staticEvents, ...logged],
      stdout: output.filter(Boolean).join("\n").trim(),
      stderr: "",
      error,
      exitCode: 0,
    };
  } finally {
    await sandbox.kill();
  }
}
