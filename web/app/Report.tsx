import type { Risk, ScanResult } from "../lib/types";

const RISK_ICON: Record<Risk, string> = { danger: "🔴", warn: "🟠", info: "⚪" };

export function Report({ result }: { result: ScanResult }) {
  const r = result.report;
  return (
    <>
      <div className={`verdict ${r.verdict}`}>
        <h2>
          {r.verdict === "dangerous"
            ? "🔴 Dangerous"
            : r.verdict === "caution"
              ? "🟠 Be careful"
              : "🟢 Looks clean"}
        </h2>
        <p>{result.verdict ?? "(Add ANTHROPIC_API_KEY for a plain-English verdict.)"}</p>
        <div className="counts">
          {r.counts.danger} danger · {r.counts.warn} warn · {r.counts.info} info
        </div>
      </div>

      {r.events.length > 0 && (
        <div className="findings card">
          <strong>What it did</strong>
          {r.events.map((e, i) => (
            <div className="finding" key={i}>
              <span className="icon">{RISK_ICON[e.risk]}</span>
              <div>
                <div className="reason">{e.reason}</div>
                <div className="detail">
                  {e.event} {e.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(r.stdout.trim() || r.error) && (
        <div className="output">
          <strong>Program output</strong>
          <pre>{r.error ? r.error : r.stdout}</pre>
        </div>
      )}
    </>
  );
}
