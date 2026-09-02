# SafeRun

**See what untrusted or AI-generated code actually does — in a disposable cloud sandbox, before it ever touches your machine.**

Paste code (or upload a file), or name an npm/PyPI package. SafeRun runs it in a fresh, hardware-isolated [Solari](https://getsolari.com) micro-VM, captures its real behavior (files it reads, servers it connects to, processes it spawns), and [Claude](https://www.anthropic.com/claude) turns that into a plain-English verdict — *safe*, *be careful*, or *do not run this*. Then the VM is destroyed.

In the AI era everyone runs code they didn't write. SafeRun is the taste-tester.

> ⚠️ Best-effort behavioral check, not a security guarantee.

---

## Features

- **Scan pasted Python code** — or **upload a `.py` file**.
- **Scan an npm package by name** — runs its install scripts and captures what they do.
- **Scan a PyPI package by name** — runs its `setup.py` and captures what it does.
- **Plain-English verdict** written by Claude, plus **"Explain this"** for each finding.
- **Risk classification** — every action tagged 🔴 danger / 🟠 warn / ⚪ info, with an overall verdict.
- **Shareable report link** + an **embeddable safety badge** for your README.
- **Bring-your-own-key** — the web app uses *each visitor's* own Solari + Anthropic keys, stored only in their browser. The server holds no secrets.

## Why it needs Solari

Running untrusted code locally is unsafe, and a plain HTTP request can't run code at all. Each scan runs in a fresh, hardware-isolated Solari micro-VM that's destroyed afterward — that isolation *is* the product. The scanned code never executes on your machine or the server.

## How it works

```
                    ┌─────────────── web/ (Next.js frontend + API) ───────────────┐
 paste / upload  →  │  UI (bring-your-own-key)  →  /api/scan route (server)        │
 npm / PyPI name    └───────────────────────────────────┬──────────────────────────┘
                                                         │  calls the library
                          ┌──────────────────────────────▼───────────────────────────┐
                          │  saferun-core (src/)                                       │
                          │   • create a disposable Solari sandbox                      │
                          │   • run the code under an audit shim (files/net/processes)  │
                          │   • classify behavior → risk + verdict                      │
                          │   • Claude writes the plain-English verdict                 │
                          │   • destroy the sandbox                                     │
                          └────────────────────────────────────────────────────────────┘
```

The capture uses Python's built-in [audit hooks](https://docs.python.org/3/library/audit_events.html) (`sys.addaudithook`) for code/PyPI, and a Node `--require` shim for npm — so file, network, and subprocess activity is recorded with **no extra tools to install** in the sandbox. See [`src/instrument.ts`](src/instrument.ts).

---

## Getting started

Requires **Node 20+**. You'll need a [Solari API key](https://getsolari.com) and an [Anthropic API key](https://console.anthropic.com).

### Option A — the CLI (backend/library only)

```bash
npm install
cp .env.example .env      # add SOLARI_API_KEY, ANTHROPIC_API_KEY (SAFERUN_MODEL optional)
npm test                  # run the unit tests

npm run scan                       # scans the built-in demo (examples/sample-sketchy.py)
npm run scan path/to/your_file.py  # scan your own Python file
npm run scan -- --pkg left-pad     # scan an npm package by name
npm run scan -- --pypi requests    # scan a PyPI package by name
npm run scan -- --explain          # also print Claude's "explain this" per finding
```

Example output:

```
🔴 DANGEROUS — did things a credential stealer / malware does.
   (1 danger · 1 warn · 0 info)

What it did:
  🔴 accesses SSH private keys
      ↳ open  '/root/.ssh/id_rsa', 'r'
  🟠 makes a network connection (possible data exfiltration)
      ↳ socket.connect  ('203.0.113.10', 4444)
```

### Option B — the web app (frontend + backend together)

```bash
npm install          # install the library's deps (once)
npm run build        # build the library the web app imports
npm run dev          # starts the Next.js app on http://localhost:3000
```

Then open http://localhost:3000, enter your keys in the **Bring your own keys** panel, and scan. The web app's API route (`web/app/api/scan/route.ts`) calls the same `saferun-core` library.

> For local web dev the keys can also come from the repo-root `.env`; in the deployed app every visitor supplies their own.

### Deploy

The web app deploys to **Vercel** with **no environment variables** (bring-your-own-key). See **[DEPLOY.md](DEPLOY.md)** for the step-by-step (set Root Directory to `web`).

---

## Limitations & caveats

- **It runs your code**, so very heavy or long-running code may hit a ~60-second serverless timeout.
- **Max input size** is ~200 KB (a few thousand lines). The real limit is run time, not line count.
- **Python wheels run no install-time code**, so they correctly show as clean; the install-time risk is in source (`sdist`/`setup.py`) packages.
- **Shell-only install scripts** (e.g. `curl | sh`) aren't traced at the syscall level (the base sandbox has no `strace`); Node- and Python-level behavior *is* captured.
- Import-time behavior of packages isn't run yet — install-time behavior is the focus.
- **Best-effort behavioral check, not a security guarantee.**

## Project structure

```
src/                 saferun-core library
  instrument.ts      audit-hook harness (Python) + Node shim + trace parsing
  scan.ts            run pasted Python in a Solari sandbox
  scan-npm.ts        install + run an npm package's scripts
  scan-pypi.ts       download + run a PyPI package's setup.py
  classify.ts        risk classification + verdict
  explain.ts         Claude verdict + "explain this"
scripts/scan.ts      CLI
examples/            demo sample
test/                unit tests (vitest)
web/                 Next.js frontend + API (bring-your-own-key)
```

## Tech stack

TypeScript · [Solari SDK](https://getsolari.com) (sandbox) · [Anthropic SDK](https://www.anthropic.com/claude) (Claude) · Next.js + React · Vitest.

## Security

- Bring-your-own-key: the server stores no keys; `.env` is gitignored and never committed.
- Untrusted code runs only inside the isolated Solari VM — never on the server.
- Package names are validated and passed as argv (no shell injection); all rendered content is escaped (no XSS).
- Errors are logged server-side, never returned raw to clients; security headers are set in [`web/next.config.mjs`](web/next.config.mjs).

## License

[MIT](LICENSE) · Developed by [Vinay Hipparge — AI Engineer](https://www.linkedin.com/in/vinay-hipparge/)
