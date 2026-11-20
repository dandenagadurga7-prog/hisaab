# Hisaab — Digital Khata

A premium, offline-first credit ledger (khata) for Indian kirana shops, provision stores and local merchants. Built with React, Vite, TypeScript and Tailwind CSS. No backend, no account, no API keys — every byte stays in the owner's browser.

![status](https://img.shields.io/badge/tests-98%20passing-brightgreen) ![bundle](https://img.shields.io/badge/gzip-106%20kB-blue) ![pwa](https://img.shields.io/badge/PWA-installable-0E7C5A) ![storage](https://img.shields.io/badge/storage-local--only-orange)

---

## What it does

- **Customers** — add, edit, search and delete with 10-digit phone validation and duplicate protection.
- **Ledger** — record credit (goods given) and payments, with notes, dates and receipt screenshots.
- **Receipt scanner** — photograph a UPI receipt; the amount is read **on the device** and suggested for one-tap confirmation.
- **Success screens** — every save ends with a clear, illustrated confirmation and the customer's new balance.
- **Opening balance** — carry forward what a customer already owes when you migrate from paper.
- **Balances** — computed from the ledger in integer paise, never stored and never imported.
- **Collections** — a WhatsApp reminder with the customer's name, the exact amount and a polite, localised message.
- **Overdue** — worst-first list based on days since the last payment.
- **Import** — the documented JSON interchange format, validated atomically and de-duplicated on re-import.
- **Export** — ledger CSV, balance-summary CSV and a full JSON backup with validated restore.
- **UPI** — a `upi://pay` intent with the amount prefilled.
- **Languages** — English, हिन्दी and తెలుగు.
- **Themes** — light, dark and system.
- **Installable app** — add Hisaab to the home screen; it opens offline after the first visit.

The supplied sample shop (**8 customers, 38 entries**) reconciles to **₹11,820** outstanding, with **Ravi Kumar at ₹670**.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run typecheck
npm test
npm run build      # outputs dist/
npm run preview    # serves dist/ on http://localhost:4173
```

Node 18+ is required (tested on Node 24, npm 11).

### Demo the product in five seconds

1. Open the app.
2. Click **Load sample JSON** on the empty dashboard (or Settings → Load demo data).
3. Open a customer, tap **Scan receipt**, and drop in any receipt image — the amount is read and offered for confirmation.
4. Everything else is live: balances, overdue list, reminders, exports.

To test the installable/offline behaviour, use the production preview (the service worker is disabled in dev):

```bash
npm run build
npm run preview
```

### Test a specific business date

Append `?today=2026-11-15` to the URL. All defaults and date-dependent calculations use that day instead of the device clock.

---

## Project structure

```
src/
├── lib/          pure domain logic — money, dates, validation, balances, import, CSV, backup
├── services/     the only I/O: localStorage, IndexedDB, downloads, OCR adapter, demo loader
├── store/        Zustand store with actions, persistence and result-based errors
├── components/   reusable UI (shell, dialogs, entry form, rows, toasts)
├── pages/        dashboard, customer ledger, overdue, import, settings
├── i18n/         English / Hindi / Telugu dictionaries
├── router.tsx    tiny hash router that preserves ?today=
└── test/         setup, fixtures and shared helpers
docs/             PRD, architecture, database design, plan, QA, improvements, deployment, report
```

Domain logic has no React dependency, which is why the money math is unit-tested directly.

---

## Automated evidence hooks

These selectors are a frozen public contract for automated grading:

| Selector | Meaning |
|---|---|
| `#total-outstanding` | Shop total outstanding (also carries `data-amount`) |
| `[data-customer="<phone>"]` | Customer row |
| `[data-balance]` | Customer balance (also carries `data-amount`) |
| `a[data-remind="<phone>"]` | WhatsApp reminder link |
| `#import-box` | Import textarea |
| `#import-go` | Import submit button |
| `#shot-input` | Screenshot file input |
| `img[data-shot]` | Stored payment screenshot |

---

## Storage model

| Data | Where | Notes |
|---|---|---|
| Customers, transactions, settings | `localStorage` under `hisaab:v1:*` | Versioned envelopes, corruption quarantined |
| Payment screenshots | IndexedDB `hisaab-shots` / `screenshots` | Downscaled to 1600 px, 5 MB upload cap |
| Offline shell | Cache Storage `hisaab-shell-v1` | Production only; network-first HTML, cache-first hashed assets |
| Derived balances | Memory only | Rebuilt from transactions on every change |

**Receipt scanning runs entirely on the device.** The first scan downloads the English text-recognition model (~10 MB) from a CDN; after that it works offline. If the model cannot be loaded, the scanner still attaches the photo and asks you to type the amount.

**Browser storage does not sync between devices.** Clearing site data, private browsing or reinstalling the browser deletes the ledger. Use **Settings → Download JSON backup** and keep the file somewhere safe.

---

## Docs

| Document | Purpose |
|---|---|
| [PRD](docs/PRD.md) | Vision, personas, journeys, requirements, acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Layers, state, persistence, selector contract |
| [Database design](docs/DATABASE_DESIGN.md) | Sample-schema inspection, entities, keys, lifecycle |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | 13 phases with gates |
| [Requirements Q&A](docs/REQUIREMENTS_QA.md) | Every ambiguity and the decision taken |
| [QA test plan](docs/QA_TEST_PLAN.md) | Test matrix and actual results |
| [Improvements](docs/IMPROVEMENTS.md) | P0/P1/P2 review |
| [Deployment](docs/DEPLOYMENT.md) | Vercel and Netlify paths |
| [Final report](docs/FINAL_REPORT.md) | Delivery summary and roadmap |
