// Instrumentation: how SafeRun captures what code *actually did*.
//
// Python: a sys.addaudithook harness (built into 3.8+) reports file/network/
//   process events with no tools to install.
// Node/npm: a `--require` shim monkeypatches fs/net/http/dns/child_process and
//   appends JSON lines to a shared log, so behavior from install scripts and
//   subprocesses is captured too (the base sandbox has no strace).

import type { BehaviorEvent, BehaviorTrace, EventCategory } from "./types.js";

export const TRACE_MARKER = "<<<SAFERUN_TRACE>>>";
export const NPM_EVENT_LOG = "/tmp/saferun-events.log";

/** Python harness — runs /tmp/target.py under an audit hook, prints a JSON trace. */
export const PYTHON_HARNESS = String.raw`
import sys, json, io, runpy, traceback

MARKER = "${TRACE_MARKER}"
TARGET = "/tmp/target.py"
EVENTS = []

_STD = tuple(p for p in (
    getattr(sys, "prefix", ""),
    getattr(sys, "base_prefix", ""),
    getattr(sys, "exec_prefix", ""),
) if p)

def _is_noise_path(p):
    if not isinstance(p, str):
        return False
    if p == TARGET or p == "/tmp/harness.py":
        return True
    low = p.replace("\\", "/")
    if "site-packages" in low or "dist-packages" in low or "__pycache__" in low:
        return True
    if "/lib/python" in low or low.endswith(".pyc"):
        return True
    for s in _STD:
        if s and p.startswith(s):
            return True
    return False

def _categorize(event):
    if event == "open":
        return "file"
    if event == "socket.__new__":
        return None
    if event.startswith(("socket.", "urllib.", "http.")):
        return "network"
    if event.startswith(("subprocess.", "os.exec", "os.spawn", "os.fork")) or event == "os.system":
        return "process"
    if event in ("os.putenv", "os.unsetenv"):
        return "env"
    if event in ("os.remove", "os.rename", "shutil.copyfile", "shutil.move"):
        return "file"
    return None

def _summ(args):
    parts = []
    for a in args:
        try:
            s = repr(a)
        except Exception:
            s = "<?>"
        if len(s) > 160:
            s = s[:160] + "..."
        parts.append(s)
    return ", ".join(parts)

def _hook(event, args):
    cat = _categorize(event)
    if cat is None:
        return
    if event == "open":
        path = args[0] if args else None
        if _is_noise_path(path):
            return
    EVENTS.append({"event": event, "category": cat, "detail": _summ(args)})

sys.addaudithook(_hook)

_out, _err = io.StringIO(), io.StringIO()
_real_out, _real_err = sys.stdout, sys.stderr
sys.stdout, sys.stderr = _out, _err
_error = None
try:
    runpy.run_path(TARGET, run_name="__main__")
except SystemExit:
    pass
except BaseException:
    _error = traceback.format_exc()
finally:
    sys.stdout, sys.stderr = _real_out, _real_err

print(MARKER)
print(json.dumps({
    "events": EVENTS,
    "stdout": _out.getvalue(),
    "stderr": _err.getvalue(),
    "error": _error,
}))
`;

/**
 * Node shim — loaded via NODE_OPTIONS="--require /tmp/shim.cjs" so it runs in
 * every Node process (npm, install scripts, our runner). It appends one JSON
 * line per sensitive action to NPM_EVENT_LOG. File events are limited to
 * sensitive paths to avoid npm's noisy internal reads.
 */
export const NODE_SHIM = String.raw`
const fs = require('fs');
const origAppend = fs.appendFileSync.bind(fs);
const LOG = "${NPM_EVENT_LOG}";
let inLog = false;
function log(category, event, detail){
  if (inLog) return;
  inLog = true;
  try { origAppend(LOG, JSON.stringify({ category, event, detail: String(detail).slice(0, 200) }) + "\n"); } catch (e) {}
  inLog = false;
}
const SENSITIVE = [/\.ssh/i, /id_rsa|id_ed25519/i, /(^|\/|\\)\.env(\.|$)/i, /\.aws/i, /\.npmrc/i, /\.git-credentials|\.netrc/i, /\/etc\/(passwd|shadow)/i, /\.docker[\/\\]config/i, /credentials/i, /keychain|cookies/i];
function isSensitive(p){ try { p = String(p); } catch (e) { return false; } return SENSITIVE.some(function(r){ return r.test(p); }); }

for (const fn of ['readFile','readFileSync','open','openSync','createReadStream']){
  const orig = fs[fn];
  if (typeof orig === 'function') { fs[fn] = function(p){ try { if (isSensitive(p)) log('file', 'fs.'+fn, p); } catch (e) {} return orig.apply(this, arguments); }; }
}
try {
  const net = require('net');
  const oc = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function(){ try { const o = arguments[0]; let d; if (o && typeof o === 'object') d = (o.host||o.path||'') + ':' + (o.port||''); else d = Array.prototype.slice.call(arguments,0,2).join(':'); log('network','net.connect', d); } catch (e) {} return oc.apply(this, arguments); };
} catch (e) {}
try {
  for (const mod of ['http','https']){
    const m = require(mod);
    const orq = m.request;
    m.request = function(o){ try { let d = typeof o === 'string' ? o : ((o.hostname||o.host||'') + (o.path||'')); log('network', mod+'.request', d); } catch (e) {} return orq.apply(this, arguments); };
  }
} catch (e) {}
try {
  const cp = require('child_process');
  for (const fn of ['exec','execSync','spawn','spawnSync','execFile','execFileSync','fork']){
    const o = cp[fn];
    if (typeof o === 'function') { cp[fn] = function(c){ try { log('process', 'cp.'+fn, Array.isArray(c) ? c.join(' ') : c); } catch (e) {} return o.apply(this, arguments); }; }
  }
} catch (e) {}
`;

/**
 * Python install shim — written to /tmp/sitecustomize.py and loaded via
 * PYTHONPAT=/tmp so it runs in every Python process during a package install.
 * Logs network + process always, and file access only for sensitive paths
 * (to avoid setuptools' noisy reads). Same log + format as the Node shim.
 */
export const PYTHON_INSTALL_SHIM = String.raw`
import sys, json

LOG = "${NPM_EVENT_LOG}"
SENSITIVE = ("/.ssh", "id_rsa", "id_ed25519", "/.aws", ".npmrc", ".git-credentials",
             ".netrc", "/etc/passwd", "/etc/shadow", ".docker/config", "credentials",
             "keychain", "cookies", ".env")
_busy = [False]

def _summ(args):
    out = []
    for a in args:
        try:
            s = repr(a)
        except Exception:
            s = "<?>"
        if len(s) > 160:
            s = s[:160] + "..."
        out.append(s)
    return ", ".join(out)

def _sensitive(p):
    if not isinstance(p, str):
        return False
    low = p.replace("\\", "/").lower()
    return any(tok in low for tok in SENSITIVE)

def _log(cat, event, detail):
    if _busy[0]:
        return
    _busy[0] = True
    try:
        with open(LOG, "a") as f:
            f.write(json.dumps({"category": cat, "event": event, "detail": str(detail)[:200]}) + "\n")
    except Exception:
        pass
    _busy[0] = False

def _hook(event, args):
    try:
        if event == "open":
            p = args[0] if args else None
            if _sensitive(p):
                _log("file", "open", repr(p))
        elif event == "socket.__new__":
            return
        elif event.startswith(("socket.", "urllib.", "http.")):
            _log("network", event, _summ(args))
        elif event.startswith(("subprocess.", "os.exec", "os.spawn", "os.fork")) or event == "os.system":
            _log("process", event, _summ(args))
        elif event in ("os.putenv", "os.unsetenv"):
            _log("env", event, _summ(args))
    except Exception:
        pass

try:
    sys.addaudithook(_hook)
except Exception:
    pass
`;

/** Parse the Python harness stdout into a BehaviorTrace. Pure. */
export function parseTrace(harnessStdout: string, exitCode: number): BehaviorTrace {
  const idx = harnessStdout.lastIndexOf(TRACE_MARKER);
  if (idx === -1) {
    return {
      events: [],
      stdout: harnessStdout,
      stderr: "",
      error: "SafeRun harness produced no trace (no marker found).",
      exitCode,
    };
  }
  const jsonPart = harnessStdout.slice(idx + TRACE_MARKER.length).trim();
  try {
    const parsed = JSON.parse(jsonPart) as {
      events?: Array<{ event: string; category: string; detail: string }>;
      stdout?: string;
      stderr?: string;
      error?: string | null;
    };
    return {
      events: (parsed.events ?? []).map((e) => ({
        event: e.event,
        category: e.category as EventCategory,
        detail: e.detail,
      })),
      stdout: parsed.stdout ?? "",
      stderr: parsed.stderr ?? "",
      error: parsed.error ?? null,
      exitCode,
    };
  } catch (err) {
    return {
      events: [],
      stdout: harnessStdout,
      stderr: "",
      error: `SafeRun could not parse the trace JSON: ${String(err)}`,
      exitCode,
    };
  }
}

/** Parse the Node shim's JSON-lines log into BehaviorEvents. Pure. */
export function parseEventLog(logText: string): BehaviorEvent[] {
  const events: BehaviorEvent[] = [];
  for (const line of logText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const e = JSON.parse(trimmed) as { category: string; event: string; detail: string };
      events.push({ category: e.category as EventCategory, event: e.event, detail: e.detail });
    } catch {
      // skip malformed lines
    }
  }
  return events;
}
