"use client";

import { useEffect, useRef, useState } from "react";
import { Report } from "./Report";
import { Footer } from "./Footer";
import { encodeShare } from "../lib/share";
import type { ScanResult } from "../lib/types";

const SAMPLE = `import os, socket
# Harmless demo that looks sketchy: it reads a private key path
# and tries to "phone home". SafeRun catches both.
try:
    open(os.path.expanduser("~/.ssh/id_rsa")).read()
except OSError:
    pass
try:
    socket.create_connection(("203.0.113.10", 4444), 0.5)
except OSError:
    pass`;

const LS_SOLARI = "saferun_solari_key";
const LS_ANTHROPIC = "saferun_anthropic_key";

// Max pasted/uploaded code size. It's about execution time, not line count, but
// this keeps requests sane once public. ~200 KB ≈ a few thousand lines.
const MAX_CHARS = 200_000;

export default function Home() {
  const [mode, setMode] = useState<"code" | "pkg" | "pypi">("code");
  const [code, setCode] = useState(SAMPLE);
  const [pkg, setPkg] = useState("");
  const [pypi, setPypi] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Bring-your-own-key state (stored in THIS browser only).
  const [solariKey, setSolariKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [editingKeys, setEditingKeys] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    if (f.size > MAX_CHARS) {
      setError(`That file is too big (${Math.round(f.size / 1024)} KB). Max is ${MAX_CHARS / 1000} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setCode(String(reader.result ?? ""));
    };
    reader.readAsText(f);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const s = localStorage.getItem(LS_SOLARI) ?? "";
      const a = localStorage.getItem(LS_ANTHROPIC) ?? "";
      setSolariKey(s);
      setAnthropicKey(a);
      setEditingKeys(!(s && a));
    } catch {
      /* storage blocked */
    }
  }, []);

  const hasKeys = solariKey.trim().length > 0 && anthropicKey.trim().length > 0;

  function saveKeys() {
    if (!hasKeys) return;
    try {
      localStorage.setItem(LS_SOLARI, solariKey.trim());
      localStorage.setItem(LS_ANTHROPIC, anthropicKey.trim());
    } catch {
      /* storage blocked — keys still held in memory for this session */
    }
    setEditingKeys(false);
  }

  function clearKeys() {
    try {
      localStorage.removeItem(LS_SOLARI);
      localStorage.removeItem(LS_ANTHROPIC);
    } catch {
      /* ignore */
    }
    setSolariKey("");
    setAnthropicKey("");
    setEditingKeys(true);
  }

  async function scan() {
    if (!hasKeys) {
      setEditingKeys(true);
      setError("Enter your Solari and Anthropic keys first.");
      return;
    }
    if (mode === "code" && code.length > MAX_CHARS) {
      setError(`Code is too large (${Math.round(code.length / 1024)} KB). Max is ${MAX_CHARS / 1000} KB.`);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: mode,
          value: mode === "pkg" ? pkg : mode === "pypi" ? pypi : code,
          solariKey: solariKey.trim(),
          anthropicKey: anthropicKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResult(data as ScanResult);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const shareUrl = result && origin ? `${origin}/r#${encodeShare(result)}` : "";
  const badgeMd =
    result && origin
      ? `[![SafeRun](${origin}/api/badge?verdict=${result.report.verdict})](${shareUrl})`
      : "";

  return (
    <main className="wrap">
      <div className="brand"><span className="dot" /> SafeRun</div>
      <p className="tag">
        Paste untrusted or AI-generated code and see what it <em>actually does</em> in a
        disposable sandbox — before it touches your machine.
      </p>

      <details className="about card">
        <summary>ℹ️ What is this? How it works &amp; limits</summary>

        <p>
          <strong>SafeRun</strong> runs untrusted or AI-generated code in a throwaway cloud
          sandbox and tells you, in plain English, what it actually did — before it ever touches
          your machine. You can scan pasted Python, an npm package, or a PyPI package.
        </p>

        <p>
          <strong>What is Solari?</strong>{" "}
          <a href="https://getsolari.com" target="_blank" rel="noopener noreferrer">Solari</a>{" "}
          provides the disposable, hardware-isolated cloud VM each scan runs in. Your code executes
          <em> there</em>, never on your computer, and the VM is destroyed right after.
        </p>

        <p>
          <strong>Which AI writes the verdict?</strong> Claude, via the Anthropic API. You bring
          your own Anthropic key; scans use <code>claude-haiku-4-5</code> by default (cheap and
          fast). Any Anthropic model works — the key and model are yours, so you control the cost.
        </p>

        <p><strong>Limits &amp; caveats:</strong></p>
        <ul>
          <li>It <em>runs</em> your code, so very heavy or long-running code may hit a ~60-second timeout.</li>
          <li>Max input size is {MAX_CHARS / 1000} KB (a few thousand lines). It's about run time, not line count.</li>
          <li>Python <em>wheels</em> run no install-time code, so they correctly show as clean.</li>
          <li>Shell-only install scripts (e.g. <code>curl</code>) aren't traced at the syscall level; Node- and Python-level behavior is.</li>
          <li>Your Solari and Anthropic keys stay in your browser and are used only to run your scan — never stored or logged.</li>
          <li><strong>Best-effort behavioral check, not a security guarantee.</strong></li>
        </ul>
      </details>

      {/* Bring-your-own-key panel */}
      {editingKeys || !hasKeys ? (
        <div className="keys card">
          <strong>🔑 Bring your own keys to start</strong>
          <p className="keys-note">
            SafeRun runs every scan with <em>your</em> Solari and Anthropic keys. They are stored
            only in this browser and sent to the server just to run your scan — never saved or logged.
          </p>
          <label>
            Solari API key <span className="muted">(slr_live_…)</span>
            <a href="https://getsolari.com" target="_blank" rel="noopener noreferrer">get one ↗</a>
          </label>
          <input
            type="password"
            className="pkg"
            placeholder="slr_live_..."
            value={solariKey}
            onChange={(e) => setSolariKey(e.target.value)}
          />
          <label>
            Anthropic API key <span className="muted">(sk-ant-…)</span>
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">get one ↗</a>
          </label>
          <input
            type="password"
            className="pkg"
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
          />
          <div className="row">
            <button className="scan" onClick={saveKeys} disabled={!hasKeys}>
              Save keys
            </button>
            <span className="hint">Kept in your browser (localStorage).</span>
          </div>
        </div>
      ) : (
        <div className="keys-bar card">
          <span>🔑 Your keys are set (stored in this browser).</span>
          <span>
            <button className="linkbtn" onClick={() => setEditingKeys(true)}>Edit</button>
            <button className="linkbtn" onClick={clearKeys}>Clear</button>
          </span>
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <button className={`tab ${mode === "code" ? "active" : ""}`} onClick={() => setMode("code")}>
            Paste code
          </button>
          <button className={`tab ${mode === "pkg" ? "active" : ""}`} onClick={() => setMode("pkg")}>
            npm package
          </button>
          <button className={`tab ${mode === "pypi" ? "active" : ""}`} onClick={() => setMode("pypi")}>
            PyPI package
          </button>
        </div>

        {mode === "code" ? (
          <>
            <div className="upload-row">
              <button className="uploadbtn" onClick={() => fileRef.current?.click()}>
                📁 Upload .py file
              </button>
              <span className="hint">…or paste below</span>
              <input ref={fileRef} type="file" accept=".py,.txt,text/plain" onChange={onFile} hidden />
            </div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
          </>
        ) : mode === "pkg" ? (
          <input className="pkg" placeholder="e.g. left-pad" value={pkg} onChange={(e) => setPkg(e.target.value)} />
        ) : (
          <input className="pkg" placeholder="e.g. requests" value={pypi} onChange={(e) => setPypi(e.target.value)} />
        )}

        <div className="row">
          <button className="scan" onClick={scan} disabled={loading || !hasKeys}>
            {loading ? "Scanning in a sandbox…" : hasKeys ? "Scan it" : "Enter keys to scan"}
          </button>
          <span className="hint">
            {mode === "code"
              ? "Python. Runs in a throwaway Solari VM."
              : mode === "pkg"
                ? "Runs the package's install scripts safely."
                : "Runs the package's setup.py safely."}
          </span>
        </div>
      </div>

      {error && <div className="err">⚠ {error}</div>}

      {result && (
        <>
          <Report result={result} />

          <div className="share card">
            <strong>Share this result</strong>
            <div className="share-row">
              <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="copybtn" onClick={() => copy("link", shareUrl)}>
                {copied === "link" ? "Copied!" : "Copy link"}
              </button>
            </div>
            <div className="badge-row">
              <img src={`/api/badge?verdict=${result.report.verdict}`} alt="SafeRun badge" />
              <button className="copybtn" onClick={() => copy("badge", badgeMd)}>
                {copied === "badge" ? "Copied!" : "Copy README badge"}
              </button>
            </div>
          </div>
        </>
      )}

      <Footer />
    </main>
  );
}
