// saferun-core public API.

export { scanCode } from "./scan.js";
export type { ScanOptions } from "./scan.js";

export { scanPackage } from "./scan-npm.js";
export { scanPyPI } from "./scan-pypi.js";

export { analyzeTrace, classifyEvent } from "./classify.js";
export type { RiskLevel, Verdict, AnalyzedEvent, ScanReport } from "./classify.js";

export { writeVerdict, explainFinding, buildVerdictPrompt, buildExplainPrompt } from "./explain.js";
export type { ExplainOptions } from "./explain.js";

export { parseTrace, parseEventLog, PYTHON_HARNESS, NODE_SHIM, TRACE_MARKER } from "./instrument.js";

export type {
  ScanInput,
  BehaviorTrace,
  BehaviorEvent,
  EventCategory,
} from "./types.js";
