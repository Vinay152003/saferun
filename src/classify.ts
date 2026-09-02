// Turn a raw BehaviorTrace into a risk-classified report: each action tagged
// danger / warn / info with a human reason, plus an overall rule-based verdict.
// (M3 adds a Claude-written plain-English verdict on top of this.)

import type { BehaviorEvent, BehaviorTrace } from "./types.js";

export type RiskLevel = "danger" | "warn" | "info";
export type Verdict = "dangerous" | "caution" | "clean";

export interface AnalyzedEvent extends BehaviorEvent {
  readonly risk: RiskLevel;
  readonly reason: string;
}

export interface ScanReport {
  readonly events: AnalyzedEvent[];
  readonly counts: Record<RiskLevel, number>;
  readonly verdict: Verdict;
  readonly stdout: string;
  readonly stderr: string;
  readonly error: string | null;
}

/** Sensitive file/path patterns that indicate credential or secret access. */
const SENSITIVE: Array<{ re: RegExp; what: string }> = [
  { re: /\.ssh|id_rsa|id_ed25519/i, what: "SSH private keys" },
  { re: /(^|[/\\])\.env(\.|$|['"])/i, what: "a .env secrets file" },
  { re: /\.aws|[/\\]credentials/i, what: "cloud credentials" },
  { re: /\.npmrc/i, what: "npm auth tokens" },
  { re: /\.git-credentials|\.netrc/i, what: "stored login credentials" },
  { re: /\/etc\/(passwd|shadow)/i, what: "system account files" },
  { re: /\.docker[/\\]config/i, what: "Docker registry auth" },
  { re: /keychain|cookies/i, what: "a secrets or cookie store" },
];

export function classifyEvent(e: BehaviorEvent): { risk: RiskLevel; reason: string } {
  // A declared install/postinstall/setup script runs code automatically. That's
  // normal for source installs, so it's informational — the verdict is driven by
  // what the script actually DOES (network / secrets / subprocesses below).
  if (e.event.startsWith("package.")) {
    return { risk: "info", reason: `runs code at install time (normal for source installs — review what it did)` };
  }
  if (e.category === "file") {
    const hit = SENSITIVE.find((s) => s.re.test(e.detail));
    if (hit) return { risk: "danger", reason: `accesses ${hit.what}` };
    return { risk: "info", reason: "reads or writes a file" };
  }
  if (e.category === "network") {
    return { risk: "warn", reason: "makes a network connection (possible data exfiltration)" };
  }
  if (e.category === "process") {
    return { risk: "warn", reason: "launches another program / shell command" };
  }
  // env — low signal on its own (build tools set these); real risk co-occurs with
  // network/file activity, which is flagged separately.
  return { risk: "info", reason: "sets an environment variable" };
}

const RANK: Record<RiskLevel, number> = { danger: 3, warn: 2, info: 1 };

/** Analyze a trace into a risk-classified report with an overall verdict. */
export function analyzeTrace(trace: BehaviorTrace): ScanReport {
  const events: AnalyzedEvent[] = trace.events
    .map((e) => ({ ...e, ...classifyEvent(e) }))
    .sort((a, b) => RANK[b.risk] - RANK[a.risk]);

  const counts: Record<RiskLevel, number> = { danger: 0, warn: 0, info: 0 };
  for (const e of events) counts[e.risk]++;

  const verdict: Verdict = counts.danger > 0 ? "dangerous" : counts.warn > 0 ? "caution" : "clean";

  return {
    events,
    counts,
    verdict,
    stdout: trace.stdout,
    stderr: trace.stderr,
    error: trace.error,
  };
}
