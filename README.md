# SafeRun

**Paste untrusted or AI-generated code → run it in a disposable [Solari](https://getsolari.com) micro-VM → see exactly what it did (files, network, processes) → the VM is destroyed.**

A "taste-tester" for code. In the AI era everyone runs code they didn't write — SafeRun runs it somewhere safe and tells you, in plain English, whether it's dangerous *before* it touches your machine.

## Why it needs Solari

Running untrusted code locally is unsafe, and a plain HTTP request can't run code at all. SafeRun runs each scan in a fresh, hardware-isolated Solari sandbox that is destroyed afterward — that isolation *is* the product.

## Quick start

```bash
npm install
cp .env.example .env      # then add your SOLARI_API_KEY (and ANTHROPIC_API_KEY for verdicts)
npm run scan              # scans examples/sample-sketchy.py
npm run scan path/to/your_file.py
npm run scan -- --pkg left-pad   # scan an npm package by name
npm run scan -- --pypi requests  # scan a PyPI package by name
```

Example output:

```
Behavior — 2 sensitive action(s) captured:
  📄 [file] open  '/root/.ssh/id_rsa', 'r'
  🌐 [network] socket.connect  ('203.0.113.10', 4444)
```

## Web app

A Next.js UI lives in [`web/`](web/) — paste code or an npm package name, get a
verdict, share the report, and copy an embeddable safety badge.

```bash
npm run build   # build the library the web app imports
npm run dev     # starts the web app on http://localhost:3000
```

## How it works

The target runs under a Python [audit hook](https://docs.python.org/3/library/audit_events.html)
(`sys.addaudithook`, built into Python 3.8+) inside the sandbox, so every file
open, network connection, and subprocess launch is captured — no tools to
install. See [`src/instrument.ts`](src/instrument.ts).

## Status

- ✅ **M1** — run code in the sandbox, capture behavior (files/network/process)
- ✅ **M2** — scan **npm and PyPI** packages by name; flag sensitive access + risk verdict
- ✅ **M3** — Claude turns the trace into a plain-English verdict + "Explain this"
- ✅ **M4 (local)** — web app: paste code/npm → verdict → shareable link + safety badge (in `web/`)
- ⏳ **M4 (ship)** — deploy to Vercel + get real users
- ⏳ **M5** — cookbook PR

See [PLAN.md](PLAN.md) for the full plan.

> ⚠️ Best-effort behavioral check, not a security guarantee.

MIT licensed.
