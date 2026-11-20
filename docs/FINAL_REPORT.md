# HISAAB — Final Report

| Field | Value |
|---|---|
| Product | Hisaab — Digital Khata for Indian shops |
| Version | 1.1.0 |
| Delivery date | 2026-11-20 |
| Release | v1.1 — scanner, success screens, installable app |
| Source | 49 files · ~7,950 lines of application code |
| Tests | 6 files · 1,530 lines · **98 / 98 passing** |
| Build | `dist/` — 106 kB gzipped JS (incl. lazy OCR), 8 kB gzipped CSS |
| Deployment | **Live:** https://dandenagadurga7-prog.github.io/hisaab/ |

---

## 1. Product summary

Hisaab replaces the paper khata with a ledger a shopkeeper can run with one thumb. It records credit and payments, computes every balance from the ledger itself, and turns "please pay" into a single WhatsApp tap — in English, हिन्दी or తెలుగు.

The product is deliberately **not** an accounting suite. It does one job: tell the owner exactly who owes what, for how long, and help them collect it.

Everything runs in the browser. There is no account, no server, no API key, no subscription and no telemetry. The data never leaves the device.

**v1.1 makes it feel like a phone app:** a receipt scanner that reads the amount on-device, illustrated success screens after every save, carry-forward opening balances when migrating from paper, and home-screen installation with an offline shell.

**Verified against the supplied dataset:** 8 customers, 38 entries, **₹11,820** outstanding, **Ravi Kumar ₹670**, top debtor Sunita Devi ₹3,470 — an exact match to `sample-expected.json`.

---

## 2. Features completed

### Customer management
- Add, edit, delete with confirmation naming the customer and the number of entries that will also be removed.
- **Opening balance** carry-forward, written as one credit entry so the books start correct.
- Name validation (1–80 chars, whitespace collapsed), phone normalisation (`+91`, leading `0`, spaces, dashes) and exactly-10-digit enforcement.
- Duplicate phone detection across manual entry, import and restore.
- Customers with zero transactions are first-class: visible, searchable, ₹0.

### Ledger
- Credit and payment entries with amount, date, note, screenshot.
- Strict money parsing (`₹1,250.75` accepted, `1.234` / `1e5` / `-5` rejected), stored as integer paise.
- Newest-first ordering, edit and delete with immediate recalculation.
- Future dates blocked; 10-year backdating limit.

### Balance engine
- `balance = Σ credit − Σ payment`, computed in memory, never persisted, never imported.
- Zero and negative balances supported (`Advance with shop`).
- Shop total, total credit, total payments, customers with dues.
- The sample dataset reconciles exactly to ₹11,820.

### WhatsApp reminders
- Exact required structure: `https://wa.me/91<phone>?text=<encoded>`.
- Localised polite message containing the customer name, the actual outstanding amount and the shop name.
- Disabled (with an explanation) when there is nothing to collect.

### Receipt scanner and screenshots
- **Scan receipt**: camera or gallery capture, animated scan overlay, live OCR progress, amount suggestion, explicit "Use ₹700" confirmation.
- OCR runs fully on the device (Tesseract.js loaded lazily); the image is never uploaded.
- If recognition is unavailable (offline first run, unsupported browser) the photo is still attached and the owner types the amount.
- `#shot-input`, accepts JPEG / PNG / JPG / WEBP, 5 MB cap.
- Downscaled to a 1600 px max edge, stored in IndexedDB as bytes, rendered through `img[data-shot]`.
- Survives reload, reboots and app restarts; removed with its transaction or customer.
- Optional amount suggestion (OCR adapter) that can only *fill the field* after the owner clicks "Use amount".

### Import and export
- Documented interchange format (`shop`, `customers[]`, `entries[]`) with live validation.
- Atomic — a single invalid record imports nothing — and idempotent via a stable entry fingerprint.
- Handles customers without entries, string amounts, `+91` phones, duplicate rows and unknown customers.
- Reviewed and committed through `#import-box` + `#import-go`.
- Export: ledger CSV, balance-summary CSV, JSON backup with validated restore.

### Collections and search
- Overdue list: balance > 0 and no payment for N days (default 30, configurable), sorted worst-first.
- Search by name substring or any phone digits.
- Filters for "with dues" and "in advance", sorting by recent / balance / name.

### Success moments
- Illustrated confirmation after recording an entry: the amount, the customer's **new balance** and a single "Done".
- Illustrated confirmation after adding a customer, with the opening balance and "Add first entry".
- Import completion card with counts and a link to the ledger.

### Installable app
- Web app manifest, 192/512/maskable icons, standalone display, theme colour.
- Service worker: network-first shell, cache-first hashed assets, versioned cache.
- Install prompt in Settings; app opens offline after the first visit.

### Product surface
- Dashboard, customer ledger, overdue, import, settings.
- Light / dark / system themes, persisted with no flash on load.
- English, Hindi, Telugu with a persisted switcher.
- UPI deep link with the amount prefilled.
- Mobile-first: bottom navigation with a raised add button, 44 px targets, zero horizontal overflow at 390 px.
- Corrupt-storage banner, quota handling, multi-tab sync, error boundary, empty states, toasts.

---

## 3. Architecture

```
UI (pages + components)
  ↓
Zustand store (actions, persistence, result-based errors)
  ↓
services (localStorage, IndexedDB, downloads, OCR adapter)
  ↓
lib (money, dates, validation, balances, import, CSV, backup) — pure, no React
```

Key decisions and their reasons:

| Decision | Reason |
|---|---|
| Integer paise everywhere | A ledger cannot afford floating-point drift |
| Date-only strings (`YYYY-MM-DD`) | A credit on the 27th must not become the 26th in another timezone |
| No stored balances | Balances can never disagree with the ledger |
| Atomic, hashed imports | Re-importing a file must be a no-op, and half an import must be impossible |
| Blobs as ArrayBuffer in IDB | Portable across engines; survives Safari's Blob quirks |
| Hash router | Five routes, no dependency, and `?today=` survives every navigation |
| Frozen selector contract | Automated verification is part of the product |

---

## 4. Technology stack

React 18 · Vite 5 · TypeScript 5 (strict, `noUncheckedIndexedAccess`) · Tailwind CSS 3 · Lucide React · Zustand 5 · Tesseract.js 7 (lazy) · localStorage · IndexedDB · Cache Storage · Vitest 2 · React Testing Library 16 · jsdom · fake-indexeddb.

No backend, no cloud database, no AI API, no analytics, no API key.

---

## 5. Data model

```
Customer   1 ──────< Transaction N        (cascade delete)
Transaction 0..1 ─── Screenshot           (IndexedDB, removed with the entry)
```

- `Customer { id, name, phone, createdAt, updatedAt }` — phone unique, used as the import key.
- `Transaction { id, customerId, type, amountPaise, date, note, screenshotId, createdAt, updatedAt, importHash? }`.
- `Settings { shopName, upiId, language, theme, overdueDays, maskPhones }`.
- An opening balance is stored as an ordinary `credit` transaction dated the creation day — no new schema, and it can be edited or reversed like any entry.
- Derived: `CustomerTotals`, `ShopTotals`, overdue rows — rebuilt on every ledger change.

`docs/DATABASE_DESIGN.md` records the schema observed in the supplied files (not assumed), the physical key layout, the backup format and the integrity rules.

---

## 6. Testing results

| Gate | Result |
|---|---|
| TypeScript strict | 0 errors |
| Automated tests | **98 / 98 passing** (6 files) |
| Domain coverage | 92.4% statements, 88.7% functions |
| Store coverage | 90.1% statements |
| Overall coverage | 80.5% statements (browser-only OCR and IDB failure paths excluded) |
| Production build | Success, 5.5 s |
| Browser smoke (Chrome, 1440×1000 + 390×844) | Passed — 0 console errors, 0 horizontal overflow |
| Receipt scanner (real OCR) | Read a UPI receipt (₹700) in **1.5 s**, filled the amount, attached the image |
| Offline + install | Manifest/service worker active; offline reload rendered the ledger |
| Sample reconciliation | Exact — ₹11,820 total, ₹670 Ravi, all eight balances |
| Screenshot persistence | Verified through a real page reload |
| Cross-tab synchronisation | Verified with two live tabs |
| Corrupt storage | Banner shown, quarantine copy written, original intact, no crash |

Full matrix, evidence and residual risks: `docs/QA_TEST_PLAN.md`.

---

## 7. Bugs fixed during QA

| Severity | Bug | Fix |
|---|---|---|
| P0 | Fractional paise were rounded and accepted | `Number.isInteger` enforced at the store boundary |
| P0 | Screenshot Blobs failed structured clone in some engines | Store `ArrayBuffer` + MIME, rebuild the Blob |
| P1 | Duplicate "Amount" accessible name | Renamed the credit/payment switch to "Entry type" |
| P1 | Payments stat said "Settled" incorrectly | Shows the payment count |
| P1 | Rows too tall for counter use | 64 px customer rows, 56 px entry rows |
| P1 | Import screen duplicated instructions and sample actions | One sample action, one short summary |
| P1 | `₹670.50` rendered as `₹670.5` | Two decimals whenever paise ≠ 0 |
| P1 | Empty overdue field silently reset to 30 | Inline validation, no silent change |
| P2 | Quick-entry picker showed today instead of last activity | Shows real last activity |
| P2 | Orphan screenshot when a save failed | Blob cleaned up |
| **P0** | OCR engine imported through a variable specifier, so Vite left it unbundled and scans would fail at runtime | Static dynamic import → lazy 15 kB chunk |
| P1 | Stale success state could survive a failed customer save | Success state resets on close |

The review and backlog are in `docs/IMPROVEMENTS.md`. **No open P0 or P1 issues.**

---

## 8. Deployment status

**Live at https://dandenagadurga7-prog.github.io/hisaab/** (GitHub Pages), verified on 2026-11-20.

| Check | Live result |
|---|---|
| HTTP | 200, correct title, CSS applied |
| Sample data | ₹11,820 total, 8 customers, Ravi ₹670 |
| WhatsApp link | `https://wa.me/919000000101?text=…` |
| Scanner (real OCR) | ₹700 detected in 2.4 s on the deployed site |
| Success screen | "Payment recorded", new balance −₹30, screenshot stored |
| PWA | Manifest 200, 3 icons, standalone, SW scope `/hisaab/` |
| Offline reload | App renders |
| Console / failed requests | 0 / 0 |

Demo link: [https://dandenagadurga7-prog.github.io/hisaab/?today=2026-11-15](https://dandenagadurga7-prog.github.io/hisaab/?today=2026-11-15)

**Repository layout:** source on `v1.1`, published build on `gh-pages`, the older app untouched on `main`. Pages serves `gh-pages` with HTTPS enforced. `vercel.json` and `netlify.toml` remain for a future move to a custom domain. Full guide: `docs/DEPLOYMENT.md`.

---

## 9. Known limitations

1. **No cloud sync.** Two phones are two ledgers. There is no account and no server, by design.
2. **Browser storage is fragile.** Clearing site data, private mode or a browser reset deletes everything. JSON backups are the owner's responsibility; the UI states this in Settings, in the export dialogs and in the delete confirmations.
3. **Screenshots are not in the JSON backup.** Images stay in IndexedDB and are excluded to keep the backup small; the dialog says so.
4. **No authentication.** Anyone with the unlocked phone can read the ledger. Phone numbers are masked in lists by default as a partial mitigation.
5. **OCR needs one download.** The English model (~10 MB) is fetched from a CDN on the first scan; after that it is cached. Offline first use still captures the image, and the owner types the amount. Hindi/Telugu OCR models are not bundled.
6. **Install prompt is browser-dependent.** Chrome/Edge offer the install button; iOS requires "Add to Home Screen" manually.
7. **No GST, invoices, inventory or interest.** Deliberately out of scope.
8. **Overdue is a single configurable threshold**, not ageing buckets.
9. **Storage ceiling.** Roughly 2,000–5,000 downscaled receipts, depending on disk quota.

---

## 10. Future roadmap

**Next (evidence-led):** field pilot with 5–10 shopkeepers; measure the 12-second entry target and reminder conversion before adding features.

| Horizon | Items |
|---|---|
| Near | Undo delete, printable statement, ageing buckets, receipt crop/rotate |
| Mid | Zip backup with screenshots, Hindi/Telugu OCR models, PIN lock, merge duplicate customers |
| Long | Multi-shop profiles, recurring credit templates, WhatsApp Business API, optional cloud sync (a new product decision, not an increment) |

Full rationale and effort estimates: `docs/IMPROVEMENTS.md` §4.

---

## 11. Local installation

Prerequisites: Node 18+ (tested on 24), npm 9+.

```bash
cd HISSAB
npm install
npm run dev            # http://localhost:5173
```

Production:

```bash
npm run typecheck
npm test
npm run build
npm run preview        # http://localhost:4173
```

Demo in five seconds:

1. Open the app.
2. Click **Load sample JSON** (or Settings → Load demo data).
3. Add `?today=2026-11-15` to the URL to reproduce the supplied reference date exactly.

Scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Serve `dist/` |
| `npm run typecheck` | Strict TypeScript, no emit |
| `npm test` / `test:watch` | Vitest suite |
| `npm run test:coverage` | Coverage report |

---

## 12. Deliverables

### Application

`index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `vercel.json`, `netlify.toml`, `README.md`, `.gitignore`, 49 source files under `src/`, plus `public/manifest.webmanifest`, `public/sw.js` and four generated icons.

Source layout: `src/lib` (domain), `src/services` (I/O + OCR + PWA), `src/store` (state), `src/components` (incl. scanner and success screens), `src/pages`, `src/i18n/locales`, `src/test` (setup, fixtures, helpers).

### Documentation

| File | Contents |
|---|---|
| `docs/PRD.md` | Vision, problem, personas, journeys, requirements, business rules, acceptance criteria, edge cases, security, limitations, metrics |
| `docs/ARCHITECTURE.md` | Layering, state, persistence, selectors, error strategy, performance, testing, deployment |
| `docs/DATABASE_DESIGN.md` | Inspected sample schema, entities, keys, integrity, backup format, capacity |
| `docs/IMPLEMENTATION_PLAN.md` | 13 phases with gates |
| `docs/REQUIREMENTS_QA.md` | 6 client questions + 38 documented decisions |
| `docs/QA_TEST_PLAN.md` | Test matrix, evidence, coverage, residual risk |
| `docs/IMPROVEMENTS.md` | P0/P1/P2 review and backlog |
| `docs/DEPLOYMENT.md` | Vercel/Netlify paths, post-deploy checklist, rollback |
| `docs/FINAL_REPORT.md` | This report |

### Supplied assets

`sample-data_JSON.json` and `sample-expected (1).json` are unchanged. Copies used by the app and tests live in `src/data/sampleData.json` and `src/test/fixtures/`.

---

## 13. Commercial readiness assessment

| Dimension | Assessment |
|---|---|
| Accuracy | Strong — exact against the reference dataset, integer money, independent tests |
| First-run simplicity | Strong — no signup, one primary action, demo data in one click |
| Mobile usability | Strong — thumb navigation, compact rows, large targets, no overflow |
| Visual quality | Commercial — custom token system, light/dark, real fintech density |
| Trust and safety | Strong — confirmations, backups, corruption quarantine, visible limitations |
| Reliability | Strong for the storage model; the single residual risk is the browser's own data lifecycle |
| Support burden | Low — no accounts, no sync, no server; the main support topic is "keep a backup" |

**Verdict:** v1.1 is ready to demonstrate and pilot with real shopkeepers — it now scans a receipt, celebrates the save and installs to the home screen like the apps owners already use. Public sale should follow a pilot that validates daily entry speed and reminder conversion, and a decision about how the owner is protected when browser data is cleared.
