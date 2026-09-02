// SafeRun CLI — scan a Python file OR an npm package in a disposable Solari
// sandbox, then print a risk report with an optional Claude verdict.
//
//   npm run scan                       # scans examples/sample-sketchy.py
//   npm run scan path/to/file.py       # scans your own Python file
//   npm run scan -- --pkg left-pad     # scans an npm package by name
//   npm run scan -- --explain          # also print Claude's "Explain this" per finding

import { readFileSync } from "node:fs";
import { scanCode, scanPackage, scanPyPI, analyzeTrace, writeVerdict, explainFinding } from "../src/index.js";
import type { AnalyzedEvent, BehaviorTrace, Verdict } from "../src/index.js";

try {
  process.loadEnvFile();
} catch {
  // no .env — rely on ambient env
}

const args = process.argv.slice(2);
const explain = args.includes("--explain");
const pkgFlag = args.indexOf("--pkg");
const pypiFlag = args.indexOf("--pypi");

let trace: BehaviorTrace;
let target: string;

if (pypiFlag !== -1) {
  const name = args[pypiFlag + 1];
  if (!name) throw new Error("Usage: npm run scan -- --pypi <package-name>");
  target = `PyPI package "${name}"`;
  console.log(`\nScanning ${target} in a disposable Solari sandbox...\n`);
  trace = await scanPyPI(name);
} else if (pkgFlag !== -1) {
  const name = args[pkgFlag + 1];
  if (!name) throw new Error("Usage: npm run scan -- --pkg <package-name>");
  target = `npm package "${name}"`;
  console.log(`\nScanning ${target} in a disposable Solari sandbox...\n`);
  trace = await scanPackage(name);
} else {
  const path = args.find((a) => !a.startsWith("--")) ?? "examples/sample-sketchy.py";
  target = path;
  console.log(`\nScanning ${target} in a disposable Solari sandbox...\n`);
  trace = await scanCode({ code: readFileSync(path, "utf8"), language: "python" });
}

const report = analyzeTrace(trace);

// Claude's plain-English verdict (falls back to the rule-based one if unavailable).
if (process.env.ANTHROPIC_API_KEY) {
  try {
    console.log("🤖 SafeRun verdict:\n" + indent(await writeVerdict(report, target)) + "\n");
  } catch (err) {
    console.log("(Claude verdict unavailable: " + String(err) + ")\n");
  }
}

const verdictLine: Record<Verdict, string> = {
  dangerous: "🔴 DANGEROUS — did things a credential stealer / malware does.",
  caution: "🟠 CAUTION — did things worth reviewing before you trust it.",
  clean: "🟢 CLEAN — no risky file, network, or process activity captured.",
};
const riskIcon: Record<AnalyzedEvent["risk"], string> = { danger: "🔴", warn: "🟠", info: "⚪" };

console.log(verdictLine[report.verdict]);
console.log(
  `   (${report.counts.danger} danger · ${report.counts.warn} warn · ${report.counts.info} info)\n`,
);

if (report.events.length > 0) {
  console.log("What it did:");
  for (const e of report.events) {
    console.log(`  ${riskIcon[e.risk]} ${e.reason}`);
    console.log(`      ↳ ${e.event}  ${e.detail}`);
    if (explain && e.risk !== "info" && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log(indent("💡 " + (await explainFinding(e, target)), 6));
      } catch {
        // skip explanation on error
      }
    }
  }
}

if (report.error) console.log("\n[note] " + report.error.trimEnd());

console.log("\n— program output —");
if (report.stdout.trim()) console.log(report.stdout.trimEnd());
if (report.stderr.trim()) console.log("[stderr]", report.stderr.trimEnd());

function indent(text: string, spaces = 3): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}
