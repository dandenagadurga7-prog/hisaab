# HISAAB — Implementation Plan

| Field | Value |
|---|---|
| Version | 1.0 |
| Start | 2026-11-20 |
| Cadence | 13 phases, each ending in a verifiable gate |
| Related | `PRD.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `QA_TEST_PLAN.md` |

Phases are sequential where a later phase depends on an earlier contract. Each phase has a **gate** — it is not "done" because code exists, but because the gate check passes.

---

## Phase 0 — Discovery (complete)

| Task | Output |
|---|---|
| Inspect workspace | Only two sample JSON files present; greenfield |
| Read `sample-data_JSON.json` | 8 customers, 38 entries, keys `shop`/`customers`/`entries` |
| Read `sample-expected (1).json` | Total 11,820; Ravi 670; 8 customers with balance |
| Independently reconcile | Credit 18,280 − payments 6,460 = 11,820 ✔ |

**Gate:** schema documented from the real files, not from assumptions. ✅

---

## Phase 1 — Project setup and architecture

| # | Task |
|---|---|
| 1.1 | `package.json` with React 18, Vite 5, TypeScript 5, Tailwind 3, Zustand, Lucide, Vitest, RTL |
| 1.2 | `tsconfig.json` strict + `noUncheckedIndexedAccess`, path alias `@/` |
| 1.3 | Vite config with test environment `jsdom`, setup file, coverage |
| 1.4 | Tailwind config with design tokens, dark mode `class`, custom shadows/radii |
| 1.5 | Folder skeleton per `ARCHITECTURE.md` §4 |
| 1.6 | `index.html` with theme boot script (no flash of wrong theme), 2026 meta |

**Gate:** `npm run dev` serves a blank themed shell; `npm run typecheck` exits 0.

---

## Phase 2 — Database and storage services

| # | Task |
|---|---|
| 2.1 | `types.ts` — Customer, Transaction, Settings, enums, Result types |
| 2.2 | `lib/money.ts` — `toPaise`, `formatINR`, `formatCompact`, strict parse |
| 2.3 | `lib/dates.ts` — `todayISO`, `addDays`, `diffDays`, `isValidISODate`, `formatDateLong` |
| 2.4 | `lib/id.ts` — collision-safe prefixed ids |
| 2.5 | `services/storage.ts` — envelope read/write, corruption quarantine, `storage` event |
| 2.6 | `services/screenshots.ts` — IDB open/upgrade, put/get/delete, downscale to 1600 px, object URL cache |
| 2.7 | `lib/validate.ts` — name, phone normalise+validate, amount, note, date, UPIC |
| 2.8 | `store/useStore.ts` — hydration, actions, persistence, toasts |

**Gate:** unit tests prove round-trip persistence, corruption quarantine, phone normalisation, and money parsing (`250.5 → 25050`).

---

## Phase 3 — Customer management

| # | Task |
|---|---|
| 3.1 | Add-customer dialog with inline validation, 10-digit mask, duplicate detection |
| 3.2 | Edit customer (name/phone) with uniqueness excluding self |
| 3.3 | Delete customer with confirmation naming customer + transaction count |
| 3.4 | Empty state with single primary CTA |
| 3.5 | Customer list rows: avatar initials, name, masked phone, balance pill, chevron |
| 3.6 | `[data-customer]` and `[data-balance]` hooks wired to real data |

**Gate:** add → appears in list with ₹0; duplicate phone blocked; delete cascades; selectors resolve.

---

## Phase 4 — Credit and payment ledger

| # | Task |
|---|---|
| 4.1 | Inline "Add entry" card on customer page: type segmented control, amount, date, note, screenshot |
| 4.2 | Preselect type from dashboard quick actions (`credit` / `payment`) |
| 4.3 | Validation: amount > 0, ≤ 2 decimals, date not future |
| 4.4 | Transaction list newest-first with type badge, amount signed, note, date, actions |
| 4.5 | Edit transaction dialog (same form, prefilled, "Save changes") |
| 4.6 | Delete transaction with confirmation |
| 4.7 | Toasts on every mutation; optimistic UI updates via store |

**Gate:** credit and payment move the balance immediately; edit and delete recalculate; order is newest-first.

---

## Phase 5 — Balance calculation engine

| # | Task |
|---|---|
| 5.1 | `buildTotalsIndex` pure function, integer paise |
| 5.2 | `shopTotals` aggregate (outstanding, credit, payments, dues count) |
| 5.3 | Dashboard stat cards bound to `#total-outstanding` |
| 5.4 | Negative/zero balance styling ("Advance with shop" / "Settled") |
| 5.5 | Recompute on every mutation and import — no cached balances |

**Gate:** sample import reproduces 11,820 and 670 exactly; a ₹100 credit changes total by exactly ₹100.

---

## Phase 6 — WhatsApp reminders

| # | Task |
|---|---|
| 6.1 | `buildWhatsAppLink(phone, message)` → `https://wa.me/91<phone>?text=<encoded>` |
| 6.2 | Localised reminder templates (en/hi/te) with name, amount, shop |
| 6.3 | `a[data-remind="<phone>"]` on dashboard rows and customer page |
| 6.4 | Disable with a tooltip when balance ≤ 0 |
| 6.5 | `target="_blank" rel="noopener noreferrer"` |

**Gate:** link prefix and decoded body verified by test for ₹670 Ravi Kumar.

---

## Phase 7 — Payment screenshot upload

| # | Task |
|---|---|
| 7.1 | `#shot-input` file input, `accept="image/jpeg,image/png,image/jpg,image/webp"` |
| 7.2 | Client-side type + 5 MB size validation |
| 7.3 | Canvas downscale (max edge 1600) → JPEG/PNG blob |
| 7.4 | Save blob to IndexedDB, store `screenshotId` on the transaction |
| 7.5 | `img[data-shot]` render from cached object URLs; click to view full size |
| 7.6 | Remove screenshot; cascade delete on customer/transaction delete |
| 7.7 | Graceful degradation when IDB is unavailable |

**Gate:** upload → save → reload → exactly one `img[data-shot]` with a live blob URL.

---

## Phase 8 — JSON import and CSV export

| # | Task |
|---|---|
| 8.1 | `parseImport(text)` → `{ plan, errors, warnings }`, no side effects |
| 8.2 | Preview panel: customers, entries, duplicates, new total |
| 8.3 | Atomic commit in store; balance recomputation |
| 8.4 | `#import-box` + `#import-go` wired; inline error list with JSON paths |
| 8.5 | Idempotent re-import via `importHash` |
| 8.6 | CSV export: full ledger + per-customer, formula-injection guarded, ISO dates |
| 8.7 | JSON backup export and validated restore |

**Gate:** sample import yields 8 / 38 / ₹11,820; second import is a no-op; bad JSON writes nothing; CSV opens correctly.

---

## Phase 9 — Search and overdue management

| # | Task |
|---|---|
| 9.1 | Search across name (partial, case-insensitive) and phone (3+ digits) |
| 9.2 | Empty search state that distinguishes "no matches" from "no customers" |
| 9.3 | Overdue screen: balance > 0 and no payment in `settings.overdueDays` |
| 9.4 | Sort: days since last payment desc, then balance desc |
| 9.5 | Show days-since chip, reminder action, quick payment action |

**Gate:** filtering is correct for both fields; overdue ordering verified against fixture data.

---

## Phase 10 — UPI and language support

| # | Task |
|---|---|
| 10.1 | Settings: shop name, UPI ID (validated), overdue threshold, phone masking |
| 10.2 | `upi://pay` link on customer page with amount prefilled, disabled without UPI ID |
| 10.3 | i18n dictionary en/hi/te, `t()` with interpolation and English fallback |
| 10.4 | Language switcher in header and Settings; persists; `<html lang>` updated |
| 10.5 | Theme switcher light/dark/system; persisted; no flash on load |
| 10.6 | Full UI audit for untranslated hard-coded strings |

**Gate:** switching to हिन्दी/తెలుగు changes nav + dashboard labels; UPI link contains `pa`, `am`, `cu=INR`.

---

## Phase 11 — Automated testing

| # | Task |
|---|---|
| 11.1 | Domain unit tests: money, dates, validation, balance, links, CSV, import |
| 11.2 | Service tests with `fake-indexeddb`: storage round-trip, quarantine, screenshots |
| 11.3 | Store tests: CRUD, cascade, atomic import, idempotency |
| 11.4 | UI tests: selectors contract, add payment flow, screenshot persistence, import flow, i18n, date override, empty states |
| 11.5 | Fixture copies of the sample JSON in `src/test/fixtures` |

**Gate:** `npm test` green; domain coverage ≥ 85%; every selector asserted.

---

## Phase 12 — Improvements and optimization

| # | Task |
|---|---|
| 12.1 | Professional review → `docs/IMPROVEMENTS.md` with P0/P1/P2 |
| 12.2 | Fix every P0 and important P1 |
| 12.3 | Bundle check (single chunk < 300 KB gzip), lazy blob URLs, memoisation |
| 12.4 | Accessibility pass: focus rings, labels, contrast, keyboard dialogs |
| 12.5 | Mobile pass at 320/360/768/1024/1440 |
| 12.6 | Empty states, loading skeletons, error boundary |

**Gate:** no open P0/P1; Lighthouse mobile ≥ 90 perf / ≥ 95 a11y (documented).

---

## Phase 13 — Production deployment

| # | Task |
|---|---|
| 13.1 | `npm run typecheck && npm test && npm run build` all green |
| 13.2 | `vercel.json` SPA rewrite, `netlify.toml`, `.gitignore` |
| 13.3 | `docs/DEPLOYMENT.md` with two provider paths + post-deploy checklist |
| 13.4 | Deploy if credentials exist; otherwise document the exact 3-command path |

**Gate:** `dist/` builds with zero errors and serves correctly with deep links.

---

## Critical Path

```
P0 → P1 → P2 ─┬─▶ P3 ─▶ P4 ─▶ P5 ─┬─▶ P6
              │                    ├─▶ P7
              │                    ├─▶ P8
              │                    ├─▶ P9
              │                    └─▶ P10
              └──────────────────────▶ P11 ─▶ P12 ─▶ P13
```

P5 (balances) blocks everything financial: P6–P10 all read derived totals. P11 is continuous — tests are written alongside each phase, then consolidated.

---

## Definition of Done (per phase)

1. Code compiles under `strict` with no `any` escapes.
2. Unit/integration tests for the phase's behaviour pass.
3. UI verified at 360 px and 1440 px.
4. No new console errors or React warnings.
5. Relevant doc updated (this file, or `IMPROVEMENTS.md`).
