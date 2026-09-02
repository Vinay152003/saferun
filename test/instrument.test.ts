import { describe, it, expect } from "vitest";
import { parseTrace, TRACE_MARKER } from "../src/instrument.js";

describe("parseTrace", () => {
  it("parses events and captured output after the marker", () => {
    const payload = {
      events: [
        { event: "open", category: "file", detail: "'/home/u/.ssh/id_rsa', 'r'" },
        { event: "socket.connect", category: "network", detail: "('203.0.113.10', 4444)" },
      ],
      stdout: "hello\n",
      stderr: "",
      error: null,
    };
    const raw = `some noise\n${TRACE_MARKER}\n${JSON.stringify(payload)}`;
    const trace = parseTrace(raw, 0);

    expect(trace.events).toHaveLength(2);
    expect(trace.events[0]?.category).toBe("file");
    expect(trace.events[1]?.event).toBe("socket.connect");
    expect(trace.stdout).toBe("hello\n");
    expect(trace.error).toBeNull();
    expect(trace.exitCode).toBe(0);
  });

  it("returns an error when the marker is missing", () => {
    const trace = parseTrace("just some output, no marker", 0);
    expect(trace.events).toHaveLength(0);
    expect(trace.error).toMatch(/no trace/i);
  });

  it("returns an error when the JSON after the marker is malformed", () => {
    const trace = parseTrace(`${TRACE_MARKER}\n{not valid json`, 1);
    expect(trace.events).toHaveLength(0);
    expect(trace.error).toMatch(/could not parse/i);
  });
});
