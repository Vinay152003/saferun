# SafeRun — Plan

> **Paste any code, npm package, or gist → it runs in a disposable Solari
> micro-VM → you get a plain-English safety verdict (what it did, what's sketchy,
> and why) → the VM is destroyed.**
>
> A "taste-tester" for code: run untrusted / AI-generated code somewhere safe and
> find out if it's dangerous *before* it touches your machine.

## The problem

Everyone runs AI-generated code and random snippets now, but running code you
didn't write can steal credentials, wipe files, or exfiltrate data. Most people
just run it and hope. SafeRun runs it in an isolated, disposable cloud VM,
watches what it does, and explains the risk in plain English.

## Why this needs Solari (the "why Solari?" test passes)

- A plain HTTP script can't *run* code. Running untrusted code locally is unsafe.
- **Solari's disposable, hardware-isolated micro-VM is the whole product** — a
  fresh sealed machine per scan, destroyed after. That's the safety guarantee.
- **Claude** turns the raw behavior trace into a human-readable verdict. This is
  the Solari + AI combo the challenge explicitly encourages.

## Positioning (how we stand out — we don't win on novelty)

Behavioral sandboxes exist (ANY.RUN, Joe Sandbox), npm scanners exist (Socket —
mostly *static*), and sandbox infra exists (e2b, Modal). But they're all either
heavyweight SOC tools, static-only, or raw infrastructure. **Nobody serves the
everyday dev / "vibe-coder" who pastes AI code and just wants "is this safe?" in
plain English.** That is our lane:

1. **AI-era, zero-setup, zero-jargon.** One paste, one verdict. No MITRE matrix.
2. **Claude-explained verdict + risk score** — friendly, not analyst-grade dumps.
3. **Shareable report link** per scan → built-in distribution → real users.
4. **Solari is unmistakably the hero** — disposable microVM, destroyed after.

## What we capture in v1 (feasible on the free sandbox)

- Outbound **network attempts** (where did it try to connect?).
- **Files read/written**, flagging sensitive paths (`~/.ssh`, `.env`, credentials).
- **Environment-variable** access.
- **Install-script** behavior (for npm packages).
- **stdout / stderr** and exit code.

Deep syscall-level tracing is v2. v1 = this solid, demoable subset + Claude verdict.

## Free-plan constraints (design around these)

- $3/month credit, 1-hour max session, 1 sandbox at a time.
- Each scan is a short sandbox session (create → run → capture → destroy).
- No login, no stealth needed — none of this hits a bot-wall.

## Architecture

```
Paste code / npm name / gist URL
        │
   Server (TypeScript)
        │  create disposable sandbox (Solari)
        ▼
  Solari micro-VM ── run the code under light instrumentation
        │           (network attempts, file access, env reads,
        │            install scripts, stdout/stderr)
        ▼
   Behavior trace ──▶ Claude ──▶ plain-English verdict + risk score
        │
   Destroy VM · save a shareable report
```

## Milestones — v1 (free plan)

| M | Milestone | Gate |
|---|---|---|
| M1 | Sandbox runs pasted code; capture stdout + files created + network attempts | Prints a raw behavior trace for a test script |
| M2 | 📦 Also accept an **npm package name** → fetch & run it; flag sensitive access (`~/.ssh`, `.env`, env vars, outbound hosts) | Scans `left-pad` by name + flags a script that reads a fake key + phones home |
| M3 | Claude turns the trace into a plain-English verdict + risk score, plus a 🔍 per-finding **"Explain this"** detail on demand | Readable "safe / caution / dangerous" report + deeper explanation per finding |
| M4 | Web UI (paste code **or** package name → verdict → shareable link + 🏅 **embeddable safety badge**) + deploy + 3–5 real users | Public link, working badge, real users |
| M5 | Cookbook PR using the library | PR opened on solari-cookbook |

Library (`saferun-core`) = M1–M3. Website = M4. Cookbook PR = M5.

## Committed standout features (part of v1)

- **🏅 Safety badge.** Every scan produces a small badge/score (e.g., `SafeRun: ✅ Passed`)
  the user can paste into a GitHub README or share. People love badges — and every
  badge embedded elsewhere is free advertising that drives new users back to us.
- **🔍 "Explain this" button.** Next to any risky finding, a button where Claude
  explains *why* it's dangerous in more depth. Turns SafeRun from a checker into a
  learning tool.
- **📦 Paste just a package name.** Instead of code, type e.g. `left-pad` and SafeRun
  fetches that npm package and scans it — serving the huge "is this package safe to
  install?" crowd.

## Ethics / scope

- Defensive tool: it helps people *avoid* running malware. Untrusted code runs
  only inside Solari's isolated VM, never on the user's machine.
- README states clearly: "best-effort behavioral check, not a security guarantee."
- v1 = capture subset + Claude verdict + share link. No accounts, no deep tracing.

## Scope guards

- One clear flow (paste → run → verdict). No feature sprawl.
- Short sandbox sessions; destroy every VM in a `finally`.
- Use Claude for the *explanation*, not for the capture (capture is deterministic).
- Reuse the existing library scaffold; drop the booking-specific files at M1.

## What else we can do (roadmap beyond v1)

Done beyond the original v1: **PyPI package scanning** (runs setup.py under an
audit shim), and **bring-your-own-key** (each visitor uses their own Solari +
Anthropic keys, stored only in their browser).

More adds once the above is solid:
- **Diff mode:** compare two versions of a package to see what *changed* in behavior
  (how real supply-chain attacks slip in).
- **Public gallery** of recent scans (each with its shareable verdict) — social proof.
- **Import-time scanning** for Python/npm packages (not just install-time).

Bigger / later (v2+, may need a paid plan or more time):
- Deeper **syscall-level tracing** (strace / seccomp) for stronger detection.
- **Browser-based** scanning of scripts that fetch remote payloads at runtime.
- **CI check** ("fail the build if a dependency's behavior changed").
- **Team mode:** shared history, org policies.
