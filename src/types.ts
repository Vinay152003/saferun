// Core domain types for saferun-core.

/** What the user wants scanned. v1 supports Python source; npm/JS comes at M2. */
export interface ScanInput {
  readonly code: string;
  readonly language: "python";
}

/** Category of a captured runtime behavior. */
export type EventCategory = "file" | "network" | "process" | "env";

/** A single sensitive action the code took while running. */
export interface BehaviorEvent {
  /** The raw Python audit event name, e.g. "socket.connect". */
  readonly event: string;
  readonly category: EventCategory;
  /** A short, truncated summary of the arguments (e.g. the path or host). */
  readonly detail: string;
}

/** The full result of running code in the sandbox under instrumentation. */
export interface BehaviorTrace {
  /** Sensitive actions captured (file/network/process/env), in order. */
  readonly events: BehaviorEvent[];
  /** The target code's own stdout (captured separately from the trace). */
  readonly stdout: string;
  /** The target code's own stderr. */
  readonly stderr: string;
  /** A Python traceback if the code raised, else null. */
  readonly error: string | null;
  /** Exit code of the harness process (0 = harness ran to completion). */
  readonly exitCode: number;
}
