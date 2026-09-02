"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Report } from "../Report";
import { Footer } from "../Footer";
import { decodeShare } from "../../lib/share";
import type { ScanResult } from "../../lib/types";

export default function SharedReport() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frag = window.location.hash.replace(/^#/, "");
    setResult(frag ? decodeShare(frag) : null);
    setReady(true);
  }, []);

  return (
    <main className="wrap">
      <div className="brand">
        <span className="dot" /> SafeRun
      </div>
      <p className="tag">A shared scan report.</p>

      {ready && result && (
        <>
          <div className="hint" style={{ marginBottom: 12 }}>
            ⚠ This is a shared result supplied by whoever created the link. Re-scan it yourself to
            verify.
          </div>
          <Report result={result} />
        </>
      )}
      {ready && !result && <div className="err">⚠ This share link is empty or invalid.</div>}

      <div style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "var(--accent)" }}>
          Scan your own code →
        </Link>
      </div>

      <Footer />
    </main>
  );
}
