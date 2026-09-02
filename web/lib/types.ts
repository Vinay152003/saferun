export type Risk = "danger" | "warn" | "info";
export type Verdict = "dangerous" | "caution" | "clean";

export interface AnalyzedEvent {
  risk: Risk;
  reason: string;
  event: string;
  detail: string;
}

export interface ReportData {
  verdict: Verdict;
  counts: Record<Risk, number>;
  events: AnalyzedEvent[];
  stdout: string;
  stderr: string;
  error: string | null;
}

export interface ScanResult {
  target: string;
  verdict: string | null;
  report: ReportData;
}
