# HISAAB — Deployment Guide

| Field | Value |
|---|---|
| Version | 1.0 |
| Target | Vercel or Netlify (static SPA) |
| Status | **Build verified and deployment-ready. Not published — no authorized account session was available in this environment.** |
| Artifact | `dist/` from `npm run build` (app + manifest + service worker + icons) |

Hisaab is a static single-page application. There is no server, no database, no environment variable and no secret. Deployment is copying `dist/` to a static host.

---

## 1. Pre-deployment verification (executed)

| Gate | Command | Result |
|---|---|---|
| TypeScript (strict) | `npm run typecheck` | PASS — 0 errors |
| Automated tests | `npm test` | PASS — 91/91 |
| Production build | `npm run build` | PASS — built in 5.5 s |
| Bundle | `dist/assets/*` | JS 306 kB (**92 kB gzip**), CSS 37.5 kB (7.1 kB gzip) |
| Mandatory selectors | RTL + headless Chrome | PASS — all 8 resolve against real data |
| Mobile layout | Chrome 390×844 | PASS — 0 px horizontal overflow |
| Persistence | Full browser reload | PASS — customers, entries, screenshots, settings |
| Import / export | Browser + unit tests | PASS — 8 customers, 38 entries, ₹11,820 |
| WhatsApp link | DOM inspection | PASS — `https://wa.me/919000000101?text=…` |
| Console errors | Headless Chrome | 0 |

Reproduce the full gate locally:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run preview   # http://localhost:4173
```

---

## 2. Current deployment status

`vercel whoami` reports **"Logged out"**, there is no `.vercel` project link and no `VERCEL_TOKEN` / `NETLIFY_AUTH_TOKEN` in the environment. Per the delivery rules, the app is **not deployed** and no URL is claimed.

The repository is one authenticated command away from production. Run either path below from the project root.

---

## 3. Option A — Vercel (recommended)

### A1. Dashboard (no CLI)

1. Push the project to a Git repository (GitHub/GitLab/Bitbucket). This folder is not a Git repository yet, so `git init` first if you want the dashboard path.
2. In Vercel: **Add New → Project → Import** the repository.
3. Vercel detects Vite. Confirm:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Deploy**. `vercel.json` already supplies the SPA rewrite and cache/security headers.

### A2. CLI

```bash
npm i -g vercel        # already present here: v66.2.0
vercel login           # interactive — requires account access
vercel                 # preview deployment
vercel --prod          # production deployment
```

The CLI prompts for scope and project name on the first run; accept the detected Vite defaults.

### A3. Fully automated (CI)

```bash
VERCEL_TOKEN=… VERCEL_ORG_ID=… VERCEL_PROJECT_ID=… vercel deploy --prod --token "$VERCEL_TOKEN"
```

No application environment variables are required.

---

## 4. Option B — Netlify

### B1. Drag and drop

```bash
npm ci
npm run build
```

Open <https://app.netlify.com/drop> and drop the **`dist`** folder. This produces a live URL immediately.

### B2. CLI

```bash
npm i -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

`netlify.toml` sets `publish = "dist"`, the SPA redirect and the asset cache headers.

### B3. Git integration

Connect the repository; Netlify reads `netlify.toml` automatically. Node 20 is pinned in that file.

---

## 5. Hosting requirements

| Requirement | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | 18+ (20 recommended) |
| Environment variables | **none** |
| Rewrites | `/* → /index.html` (hash routing means deep links work even without it) |
| HTTPS | Required — `localStorage`, IndexedDB and `wa.me` behave correctly only on secure origins |
| Cache | Hashed assets immutable for 1 year; `index.html` must not be cached long-term |

There is intentionally **no** server-side component. If a host requires a database or an API key, it is the wrong host for this product.

---

## 6. Post-deploy checklist

Open the deployed URL and verify, in order:

1. **`?today=2026-11-15` is preserved** after navigating between screens.
2. Click **Load sample JSON** → `#total-outstanding` reads **₹11,820**.
3. `[data-customer="9000000101"]` contains `[data-balance]` reading **₹670**.
4. `a[data-remind="9000000101"]` points at `https://wa.me/919000000101?text=…` and the decoded text contains `Ravi Kumar` and `₹670`.
5. Add a ₹700 payment on that customer → balance becomes **−₹30** ("Advance with shop").
6. Attach a PNG in `#shot-input`, save, reload → exactly one `img[data-shot]` still renders.
7. **Overdue** shows four customers, worst-first (61 / 44 / 43 / 42 days).
8. Settings → **Download JSON backup** downloads a file; **Restore** accepts it after confirmation.
9. Switch to **हिन्दी** and **తెలుగు** → navigation and dashboard labels change and survive a reload.
10. Rotate a phone to 390 px → no horizontal scroll, bottom navigation and the add button are reachable.
11. Paste the sample JSON into `#import-box`, click `#import-go` twice → the second attempt reports duplicates and changes no balance.
12. Open a customer → **Scan receipt** → choose a receipt photo → the amount is detected (first scan downloads the OCR model — needs internet) → "Use ₹…" → Save → the success screen shows the new balance.
13. In Chrome or Edge, install the app from the address bar or **Settings → Install app** → it opens standalone with no browser chrome.
14. Load the site once, reload once (so the service worker controls the page), then go offline and reload → the ledger still opens.

### Service worker notes

- The shell is network-first, so a new deployment is picked up on the next online navigation. Hashed assets are cache-first and immutable.
- The cache is versioned (`hisaab-shell-v1`); bump the constant in `public/sw.js` when the shell strategy changes.
- **Do not tell users to "clear site data" to fix a stale app** — that deletes their ledger. Closing all tabs and reopening forces a network-first fetch.
- Receipt scanning is the only feature that needs network on first use (the OCR model comes from a public CDN). If a strict CSP is added, allow the Tesseract worker/WASM origins.

A quick console assertion on the deployed site:

```js
const total = document.querySelector('#total-outstanding');
console.log(total?.textContent, total?.dataset.amount); // "₹11,820" "11820"
console.log(document.querySelectorAll('[data-customer]').length); // 8
console.log(document.querySelectorAll('a[data-remind]').length); // 8
```

---

## 7. Rollback

| Host | Action |
|---|---|
| Vercel | Deployments → select the last healthy deployment → **Promote to Production** |
| Netlify | Deploys → select a previous deploy → **Publish deploy** |

Because all state is local to the browser, a rollback never affects customer data.

---

## 8. Custom domain and HTTPS

Both hosts issue a managed TLS certificate automatically. Add the domain in the host dashboard and point the DNS record as instructed; no application change is needed. Do not serve Hisaab over plain HTTP — browsers restrict storage and the WhatsApp link on insecure origins.

---

## 9. Operational notes

- **No telemetry.** There is nothing to monitor server-side. Uptime monitoring of the static URL is sufficient.
- **No secrets.** Nothing in the bundle is sensitive; the only credentials are the owner's own browser data.
- **Cache busting.** Every asset is content-hashed by Vite; a new deploy invalidates correctly.
- **`?today=`** is a demo aid. It changes what the app treats as "today"; it never changes stored dates.
- **Data durability is the owner's responsibility.** The product states this in Settings and in the export dialogs. A deployment does not create a backup.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page on a deep link | Host not rewriting to `index.html` | Confirm `vercel.json` / `netlify.toml` is at the repo root and the build output is `dist` |
| Screenshots do not persist | Third-party cookies/IDB blocked, or private mode | Use a normal window; the ledger still works |
| "Browser storage is unavailable" banner | Storage disabled by policy | Enable site data; export/import still works in-session |
| Build fails on Node 16 | Vite 5 requires Node 18+ | Pin Node 20 (already set in `netlify.toml`) |
| Old version after deploy | Cached `index.html` | Hard refresh; verify `Cache-Control` on `/index.html` is not long-lived |
