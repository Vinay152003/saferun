# Deploying SafeRun

SafeRun is **bring-your-own-key**: every visitor enters their own Solari and
Anthropic keys (stored in their browser). **The deployment needs no secrets and
no environment variables** — your keys are never used or shipped.

## Prerequisites
- A **public GitHub repository** (the challenge requires this).
- A free **Vercel** account.

## 1. Push to GitHub
Create an empty **public** repo on GitHub (e.g. `saferun`), then:

```bash
git remote add origin https://github.com/<your-username>/saferun.git
git branch -M main
git push -u origin main
```
*(An initial commit already exists — see below.)*

## 2. Import into Vercel
1. Vercel → **Add New… → Project** → import your `saferun` repo.
2. **Set "Root Directory" to `web`.** ← important (the Next.js app lives there).
3. Leave everything else as detected. `web/vercel.json` already sets the
   install/build commands so the library builds before the web app:
   - Install: `cd .. && npm install && cd web && npm install`
   - Build: `cd .. && npm run build && cd web && next build`
4. **Environment variables: none.** Do NOT add your keys — this app is BYOK.
5. Click **Deploy**.

You'll get a public URL like `https://saferun-xxxx.vercel.app`.

## 3. Test it
- Open the URL, expand **"What is this?"**, then enter *your own* Solari +
  Anthropic keys and scan the sample. You should get a 🔴 Dangerous verdict.
- Try the **npm** and **PyPI** tabs (e.g. `left-pad`, `requests`).

## Notes & limits
- **Function timeout:** Vercel Hobby caps serverless functions at ~60s (already
  set via `maxDuration`). A scan is usually 5–15s; a very heavy install could get
  close. If you hit timeouts often, optimize or upgrade the Vercel plan.
- **No secrets in the repo:** `.env` is gitignored; `.env.example` holds only
  placeholders. Never commit real keys.

## 4. Share (the challenge)
Post the live link on X / LinkedIn, tag **@harrychow_** and **@getsolari**, and
get a few people to try it. Building in public + real usage is what the challenge
rewards.
