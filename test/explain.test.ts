import { describe, it, expect } from "vitest";
import { buildVerdictPrompt, buildExplainPrompt } from "../src/explain.js";
import { analyzeTrace } from "../src/classify.js";
import type { BehaviorTrace } from "../src/types.js";

const dangerTrace: BehaviorTrace = {
  events: [
    { category: "file", event: "open", detail: "'/root/.ssh/id_rsa', 'r'" },
    { category: "network", event: "socket.connect", detail: "('1.2.3.4', 4444)" },
  ],
  stdout: "hello\n",
  stderr: "",
  error: null,
  exitCode: 0,
};

describe("buildVerdictPrompt", () => {
  it("includes the target, verdict, and each flagged action", () => {
    const prompt = buildVerdictPrompt(analyzeTrace(dangerTrace), "evil.py");
    expect(prompt).toContain("evil.py");
    expect(prompt).toContain("dangerous");
    expect(prompt).toContain(".ssh/id_rsa");
    expect(prompt).toContain("1.2.3.4");
    expect(prompt).toContain("hello");
  });

  it("says none when there are no events", () => {
    const clean = analyzeTrace({ ...dangerTrace, events: [] });
    expect(buildVerdictPrompt(clean, "safe.py")).toMatch(/none/i);
  });
});

describe("buildExplainPrompt", () => {
  it("includes the finding detail and asks for a plain explanation", () => {
    const report = analyzeTrace(dangerTrace);
    const prompt = buildExplainPrompt(report.events[0]!, "evil.py");
    expect(prompt).toContain(".ssh/id_rsa");
    expect(prompt).toMatch(/non-expert/i);
  });
});
