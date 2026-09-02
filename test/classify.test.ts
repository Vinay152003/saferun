import { describe, it, expect } from "vitest";
import { analyzeTrace, classifyEvent } from "../src/classify.js";
import { parseEventLog } from "../src/instrument.js";
import type { BehaviorTrace } from "../src/types.js";

describe("classifyEvent", () => {
  it("flags SSH key reads as danger", () => {
    const r = classifyEvent({ category: "file", event: "open", detail: "'/root/.ssh/id_rsa', 'r'" });
    expect(r.risk).toBe("danger");
    expect(r.reason).toMatch(/SSH/i);
  });

  it("treats a declared install script as info (verdict driven by what it does)", () => {
    const r = classifyEvent({ category: "process", event: "package.postinstall", detail: "node x.js" });
    expect(r.risk).toBe("info");
    expect(r.reason).toMatch(/install time/i);
  });

  it("treats network as a warning", () => {
    const r = classifyEvent({ category: "network", event: "net.connect", detail: "1.2.3.4:4444" });
    expect(r.risk).toBe("warn");
  });

  it("treats an ordinary file as info", () => {
    const r = classifyEvent({ category: "file", event: "open", detail: "'/tmp/data.txt', 'r'" });
    expect(r.risk).toBe("info");
  });
});

describe("analyzeTrace", () => {
  const base: BehaviorTrace = { events: [], stdout: "", stderr: "", error: null, exitCode: 0 };

  it("verdict is dangerous when a danger event exists, sorted danger-first", () => {
    const report = analyzeTrace({
      ...base,
      events: [
        { category: "file", event: "open", detail: "'/tmp/x', 'r'" },
        { category: "file", event: "open", detail: "'/root/.ssh/id_rsa', 'r'" },
      ],
    });
    expect(report.verdict).toBe("dangerous");
    expect(report.events[0]?.risk).toBe("danger");
    expect(report.counts.danger).toBe(1);
  });

  it("verdict is clean with no events", () => {
    expect(analyzeTrace(base).verdict).toBe("clean");
  });
});

describe("parseEventLog", () => {
  it("parses JSON lines and skips malformed ones", () => {
    const log = [
      JSON.stringify({ category: "network", event: "net.connect", detail: "1.2.3.4:80" }),
      "garbage",
      JSON.stringify({ category: "file", event: "fs.readFileSync", detail: "/root/.ssh/id_rsa" }),
    ].join("\n");
    const events = parseEventLog(log);
    expect(events).toHaveLength(2);
    expect(events[1]?.category).toBe("file");
  });
});
