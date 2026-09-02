import type { ScanResult } from "./types";

// Encode a scan result into a URL-fragment string (no server/DB needed). The
// fragment (#...) is never sent to the server and has no length limit.

export function encodeShare(result: ScanResult): string {
  const json = JSON.stringify(result);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeShare(fragment: string): ScanResult | null {
  try {
    const json = decodeURIComponent(escape(atob(fragment)));
    return JSON.parse(json) as ScanResult;
  } catch {
    return null;
  }
}
