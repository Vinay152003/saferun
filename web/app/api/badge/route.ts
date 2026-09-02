export const runtime = "nodejs";

const STYLES: Record<string, { label: string; color: string }> = {
  clean: { label: "safe", color: "#35c98a" },
  caution: { label: "caution", color: "#ffb020" },
  dangerous: { label: "danger", color: "#ff5c5c" },
  unknown: { label: "unknown", color: "#9f9f9f" },
};

export async function GET(request: Request): Promise<Response> {
  const verdict = new URL(request.url).searchParams.get("verdict") ?? "unknown";
  const s = STYLES[verdict] ?? STYLES.unknown!;

  const leftW = 58;
  const rightW = Math.round(s.label.length * 7 + 16);
  const W = leftW + rightW;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" role="img" aria-label="SafeRun: ${s.label}">
  <linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect rx="3" width="${W}" height="20" fill="#2b333c"/>
  <rect rx="3" x="${leftW}" width="${rightW}" height="20" fill="${s.color}"/>
  <rect rx="3" width="${W}" height="20" fill="url(#g)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftW / 2}" y="14">SafeRun</text>
    <text x="${leftW + rightW / 2}" y="14">${s.label}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-cache, max-age=0",
    },
  });
}
