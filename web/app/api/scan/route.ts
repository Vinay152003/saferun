import { NextResponse } from "next/server";
import { scanCode, scanPackage, scanPyPI, analyzeTrace, writeVerdict } from "saferun-core";

export const runtime = "nodejs";
export const maxDuration = 60;

// Bring-your-own-key: every scan uses the caller's own Solari + Anthropic keys,
// passed in the request body. They are used for this request only and never
// stored or logged server-side.
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      kind?: string;
      value?: string;
      solariKey?: string;
      anthropicKey?: string;
      model?: string;
    };

    const value = (body.value ?? "").trim();
    const solariKey = (body.solariKey ?? "").trim();
    const anthropicKey = (body.anthropicKey ?? "").trim();
    const kind = body.kind === "pkg" ? "pkg" : body.kind === "pypi" ? "pypi" : "code";

    if (!solariKey) return NextResponse.json({ error: "Enter your Solari API key first." }, { status: 400 });
    if (!value) return NextResponse.json({ error: "Nothing to scan." }, { status: 400 });

    // Server-side input limits (never trust the client's cap).
    if (kind === "code" && value.length > 200_000) {
      return NextResponse.json({ error: "Code is too large (max 200 KB)." }, { status: 400 });
    }
    if ((kind === "pkg" || kind === "pypi") && value.length > 214) {
      return NextResponse.json({ error: "Package name is too long." }, { status: 400 });
    }
    if (solariKey.length > 4096 || anthropicKey.length > 4096) {
      return NextResponse.json({ error: "Key looks malformed." }, { status: 400 });
    }

    const target =
      kind === "pkg" ? `npm package "${value}"` : kind === "pypi" ? `PyPI package "${value}"` : "pasted code";
    const trace =
      kind === "pkg"
        ? await scanPackage(value, { apiKey: solariKey })
        : kind === "pypi"
          ? await scanPyPI(value, { apiKey: solariKey })
          : await scanCode({ code: value, language: "python" }, { apiKey: solariKey });

    const report = analyzeTrace(trace);

    let verdict: string | null = null;
    if (anthropicKey) {
      try {
        verdict = await writeVerdict(report, target, {
          apiKey: anthropicKey,
          model: body.model ?? "claude-haiku-4-5",
        });
      } catch {
        verdict = null;
      }
    }

    return NextResponse.json({ target, report, verdict });
  } catch (err) {
    // Log server-side for debugging; never return raw errors/stack traces to the
    // client (they can leak internal paths, and could echo credential errors).
    console.error("[saferun] scan error:", err);
    return NextResponse.json(
      { error: "Scan failed. Check your input and keys, then try again." },
      { status: 500 },
    );
  }
}
