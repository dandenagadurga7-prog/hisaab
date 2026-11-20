# HISAAB — QA Test Plan and Results

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | **Executed — 98/98 automated tests passing, desktop + mobile browser smoke passed** |
| Last run | 2026-11-20 (v1.1 — scanner, success screens, PWA) |
| Related | `PRD.md` §9–§10, `IMPLEMENTATION_PLAN.md` Phase 11 |

---

## 1. Scope

Every functional requirement in the PRD, the ten mandatory tester selectors, the supplied sample dataset, persistence, import/export, localisation, responsiveness and the failure paths for corrupted storage.

**Out of scope for this run:** real device hardware (Android/iOS), screen-reader software, actual WhatsApp delivery, actual UPI app handoff, Safari private mode, browser-quota exhaustion. Each is listed in §9 as a residual risk rather than claimed as tested.

---

## 2. Environments

| Layer | Environment |
|---|---|
| Automated | Node 24.21.0, npm 11.19.0, Vitest 2.1, jsdom 25, fake-indexeddb 6, Testing Library 16 |
| Browser smoke | Google Chrome (headless) via Playwright, 1440×1000 desktop and 390×844 mobile (DPR 2, touch) |
| OS | Windows 11 |
| Date under test | `?today=2026-11-15` (the reference date in `sample-expected.json`) |
| Locale | `en-IN`, plus a full interface switch to `hi` and `te` |

---

## 3. Strategy

```
        ┌─────────────────────────────┐
        │ 13 UI integration tests     │  selectors, real user flows
        ├─────────────────────────────┤
        │ 33 store/service tests      │  CRUD, cascade, persistence, IDB
        ├─────────────────────────────┤
        │ 45 pure domain tests        │  money, dates, balances, import, CSV
        └─────────────────────────────┘
```

Domain logic is tested without React so the money math is proven independently of the UI.

**Commands**

```bash
npm run typecheck      # tsc --noEmit, strict
npm test               # vitest run
npm run test:coverage  # v8 coverage
npm run build          # typecheck + production bundle
```

---

## 4. Automated suites

| Suite | Tests | What it proves |
|---|---:|---|
| `src/lib/domain.test.ts` | 29 | Rupee→paise parsing (incl. rejection of `1.234`, `1e5`, negatives), Indian formatting, date-only arithmetic, phone/name/note/UPI validation, balance projection, **sample total 11,820 and Ravi 670**, overdue ordering, sorting, WhatsApp link structure, UPI intent, CSV quoting/injection guard, backup round-trip |
| `src/lib/import.test.ts` | 16 | Real sample parse (8/38), idempotent re-import, incremental import, stable hashes, atomic failure, per-record paths, duplicate phones, customers without entries, numeric-string amounts, future-date guard, ignores supplied totals |
| `src/services/services.test.ts` | 11 | Versioned localStorage envelopes, corruption quarantine (original preserved), malformed-record filtering, settings normalisation, IndexedDB put/get/delete, 5 MB and MIME validation, canvas fallback |
| `src/store/store.test.ts` | 24 | Customer add/edit/delete, duplicate phone, cascade delete, **opening balance carry-forward**, credit/payment balances, zero and negative balances, integer-only amounts, future-date rejection, edit/delete recalculation, sample import exact total, settings validation, reload persistence, restore, reset, corruption and orphan handling |
| `src/App.test.tsx` | 13 | **All eight mandatory selectors**, import through `#import-box` + `#import-go`, payment flow updates balance and shop total, screenshot survives remount/reload, `?today=` default date, add-customer validation, duplicate rejection, delete confirmation, demo load, search by name and phone, overdue list, Hindi/Telugu switch, UPI link |
| `src/experience.test.tsx` | 5 | Success screen after a payment with the new balance, customer-added success with opening balance, **scanner capture → amount fill → attach → save**, receipt-text amount parsing, import celebration |

**Result: 6 files passed, 98 tests passed, 0 failed, 0 skipped.**

---

## 5. Requirement traceability

| # | Requirement | Evidence | Result |
|---|---|---|---|
| 1 | Customer creation | `App` "validates the phone number and then creates the customer"; `store` "normalises name and phone" | PASS |
| 2 | Phone validation (exactly 10 digits) | `domain` "requires exactly ten digits"; `App` inline error test | PASS |
| 3 | Duplicate phone rejection | `store` "rejects a duplicate phone number"; `App` duplicate dialog test | PASS |
| 4 | Credit entry | `store` "computes balance as credit minus payment"; `App` payment flow | PASS |
| 5 | Payment entry | same, plus `App` "records a payment and updates every surface" | PASS |
| 6 | Balance calculations | `domain` "reproduces every expected balance"; edit/delete recalculation tests | PASS |
| 7 | Sample JSON import | `import` sample suite; `App` `#import-go` flow | PASS |
| 8 | 8 sample customers | `import` "parses the real sample file"; `App` selector count = 8 | PASS |
| 9 | ₹11,820 total outstanding | `domain` + `store` + browser DOM `#total-outstanding` = `₹11,820` | PASS |
| 10 | ₹670 Ravi balance | `domain` loop over `sample-expected.json`; browser `[data-balance]` | PASS |
| 11 | Customers with no transactions | `import` "supports customers with no entries"; `store` shop totals include them | PASS |
| 12 | Empty customers list state | `App` empty-state heading; browser screenshot `01-empty.png` | PASS |
| 13 | Transaction sorting newest-first | `domain` "sorts transactions newest first" | PASS |
| 14 | Screenshot persistence | `App` "keeps a payment screenshot after a reload"; browser reload check | PASS |
| 15 | WhatsApp message | `domain` link structure; browser `a[data-remind]` href decoded | PASS |
| 16 | Edit and delete transaction | `store` edit/delete recalculation tests | PASS |
| 17 | Reload persistence | `store` "survives a reload"; browser full reload keeps 1 screenshot + balance | PASS |
| 18 | Date override | `domain` `resolveToday`; `App` "defaults the entry date to ?today=" | PASS |
| 19 | Mobile responsiveness | Browser 390×844: **0 px** horizontal overflow; bottom nav + FAB rendered | PASS |
| 20 | CSV export | `domain` ledger (39 lines) + summary + injection guard | PASS |
| 21 | Search by name and phone | `App` "filters customers by name and by phone" | PASS |
| 22 | Telugu and Hindi labels | `App` "switches the interface to Hindi and Telugu"; browser `08-hindi-dark.png`, `10-mobile-customer.png` | PASS |
| 23 | Delete customer with confirmation | `App` "deletes a customer only after confirmation"; `store` cascade | PASS |
| 24 | Corrupt storage safety | `services` quarantine test; browser corrupt-storage run (banner + key + intact original) | PASS |
| 25 | Receipt scanner | `experience` scanner test; browser OCR run (₹700 detected in 1.5 s and attached) | PASS |
| 26 | Success confirmation | `experience` success tests; browser screenshots `23-success-payment.png`, `24-success-customer.png`, `29-mobile-success.png` | PASS |
| 27 | Opening balance | `store` opening-balance tests; browser customer success shows ₹1,200 | PASS |
| 28 | Installable + offline | Manifest 200 with 3 icons, SW active, offline reload renders the ledger | PASS |

---

## 6. Sample dataset reconciliation

Computed independently from the 38 entries and compared with `sample-expected (1).json`:

| Phone | Customer | Credit | Payments | Balance | Expected | Match |
|---|---|---:|---:|---:|---:|:--:|
| 9000000101 | Ravi Kumar | 2,350 | 1,680 | 670 | 670 | ✔ |
| 9000000102 | Sunita Devi | 4,540 | 1,070 | 3,470 | 3,470 | ✔ |
| 9000000103 | Mohd Irfan | 3,350 | 540 | 2,810 | 2,810 | ✔ |
| 9000000104 | Anjali Reddy | 2,040 | 780 | 1,260 | 1,260 | ✔ |
| 9000000105 | Prakash Rao | 460 | 230 | 230 | 230 | ✔ |
| 9000000106 | Fatima Begum | 3,260 | 430 | 2,830 | 2,830 | ✔ |
| 9000000107 | Venkat Naidu | 1,200 | 950 | 250 | 250 | ✔ |
| 9000000108 | Kavitha S | 1,080 | 780 | 300 | 300 | ✔ |
| **Total** | | **18,280** | **6,460** | **11,820** | **11,820** | ✔ |

Top debtor: `9000000102` at ₹3,470 — matches `top_defaulter_phone`.
Customers with a balance: 8 — matches `customers_with_balance`.

---

## 7. Browser smoke test (production build)

Served with `npm run preview` on port 4173, exercised through Chrome.

| Check | Observed |
|---|---|
| Console errors / page errors | **0 / 0** |
| `#total-outstanding` | text `₹11,820`, `data-amount="11820"` |
| `[data-customer]` rows | 8 |
| Balances in DOM | 670, 250, 2810, 2830, 300, 1260, 3470, 230 |
| `a[data-remind="9000000101"]` | `https://wa.me/919000000101?text=Namaste%20Ravi…` |
| Payment of ₹700 against ₹670 | balance becomes **−₹30** with "Advance with shop"; total drops to ₹11,120 |
| Screenshot | `img[data-shot]` = 1 after save, still 1 after a full page reload |
| Overdue page | 4 rows at 61 / 44 / 43 / 42 days; overdue amount ₹5,260 |
| Mobile 390×844 | horizontal overflow **0 px**; bottom nav and FAB visible; scanner bottom sheet fits and the success sheet is reachable |
| Dark mode computed colours | body `rgb(9,14,12)`, card `rgb(17,26,22)`, ink `rgb(235,242,238)` |
| Cross-tab sync | a customer added in tab A appeared in tab B without reload |
| Corrupt `hisaab:v1:customers` | app opens, banner shown, quarantine key created, original raw value intact, no crash |
| Bundle | JS 347 kB total (**106 kB gzip**): main 332 kB + lazy OCR chunk 15 kB; CSS 42 kB (8 kB gzip) |
| Receipt scanner | Real UPI receipt → OCR detected **₹700** in **1.5 s**, filled the amount, attached the image |
| Success screen | "Payment recorded", ₹700, "New balance −₹30", confetti illustration, Done/Add another |
| Customer success | "Customer added", opening balance ₹1,200, "Add first entry" opened the new ledger |
| PWA | `manifest.webmanifest` 200 (3 icons, display standalone), service worker active |
| Offline | After a controlled reload, going offline and reloading still renders the app with ₹13,720 |

Screenshots captured: empty state, dashboard, customer ledger, after payment, overdue, import, settings (dark), Hindi dashboard (dark), mobile dashboard, mobile customer, corrupt-storage banner.

---

## 8. Manual review checklist

| Check | Method | Result |
|---|---|---|
| Keyboard: every dialog closes on `Escape`, focus moves into the dialog | Code review + modal implementation | PASS (not AT-tested) |
| Touch targets ≥ 44 px | Rendered measurements at 390 px | PASS |
| Text contrast | Token review: ink `#111C16` on `#FFFFFF`, muted `#5F6F66` on `#FFFFFF` (≈ 5.3:1), accent `#0E7C5A` on white (≈ 5.2:1) | PASS |
| No horizontal scroll at 320 px | Layout review; all grids collapse to one column | PASS (verified at 390 px in browser) |
| Empty states for list, search, overdue, transactions | Browser + component review | PASS |
| Destructive action always confirmed | Delete customer, delete entry, reset all, restore | PASS |
| Storage warning visible when data is unreadable | Browser corrupt-storage run | PASS |

---

## 9. Defects found and fixed

| ID | Severity | Defect | Fix | Verified by |
|---|---|---|---|---|
| D1 | **P0** | `addTransaction` rounded `1.5` paise to `2`, silently accepting fractional paise | Require `Number.isInteger` on amount at the store boundary | store test "rejects zero, negative and non-integer amounts" |
| D2 | **P0** | Screenshot blobs stored directly in IndexedDB failed structured clone in some environments | Store `ArrayBuffer` + MIME, rebuild the `Blob` on read | services screenshot round-trip; browser reload |
| D3 | P1 | Segmented control and amount input shared the accessible name "Amount" | Renamed the control to "Entry type" | UI test resolves a unique field |
| D4 | P1 | "Total payments" card said "Settled" when no customer was in advance | Shows the payment entry count | Dashboard review |
| D5 | P1 | Customer rows were ~107 px tall, only 6–7 visible on a laptop | Compact 64 px rows, inline reminder action | Dashboard screenshots |
| D6 | P1 | Import page repeated the instructions and offered two different "load sample" behaviours | One sample action that fills the textarea + a sample summary card | Import screenshot |
| D7 | P1 | Paise amounts rendered as `₹670.5` instead of `₹670.50` | Explicit 2-decimal formatting when paise ≠ 0 | money formatting test |
| D8 | P1 | Clearing the overdue-threshold field silently fell back to 30 days | Inline validation, no silent change | Code review |
| D9 | P2 | Quick-entry picker showed today's date instead of the customer's last activity | Shows real last activity | Code review |
| D10 | P2 | Screenshot orphaned in IndexedDB if the transaction save failed | Blob deleted when the write fails | Code path review |
| D11 | **P0** (feature) | The OCR engine was imported through a variable specifier, so Vite left it unbundled and every scan would have failed at runtime | Static dynamic import creates a lazy 15 kB chunk; the scanner now works | Browser OCR run: ₹700 detected |
| D12 | P1 | A failed customer save left the success sheet with stale state | Success state resets when the dialog closes | `experience` success test |

No P0 or P1 defects remain open.

---

## 10. Coverage

`npm run test:coverage`:

| Area | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| All files | 80.46% | 71.72% | 78.62% | 80.46% |
| `src/lib` (domain) | **92.43%** | 72.23% | 88.70% | **92.43%** |
| `src/store` | 90.05% | 75.75% | 73.91% | 90.05% |
| `src/services` | 60.82% | 67.51% | 70.00% | 60.82% |

The uncovered service code is almost entirely IndexedDB failure branches (blocked upgrade, quota errors, `createImageBitmap` absence) and the Tesseract worker lifecycle, which only exists in a real browser. The OCR UI is tested with a mocked engine and the real engine is verified in the browser smoke run; failure paths fall back to capture-only.

---

## 11. Residual risks

| Risk | Why untested | Mitigation |
|---|---|---|
| Browser quota exhaustion | Cannot force reliably in headless Chrome | Every write is wrapped; a persistent banner tells the owner to export; state is never truncated |
| Safari private mode / old IDB | No Safari runtime available | Screenshot layer degrades to "image unavailable"; the ledger is unaffected |
| Real WhatsApp / UPI handoff | No phone | Links verified structurally against the required format |
| OCR first-scan download | The English model is fetched from a CDN on first use (~10 MB) | Clear in-UI note; failure falls back to attach-only; the ledger never depends on it |
| PWA install prompt | Headless Chrome does not fire `beforeinstallprompt` | Manifest, icons, SW and offline reload verified; the install button appears in real Chrome/Edge |
| OCR accuracy on poor photos | Cannot test every camera/lighting combination | The amount is always confirmed by the owner |
| Screen reader output | No AT available | Semantic roles, labels, `aria-live` toasts, focusable dialogs |
| Very large ledgers (10k+ entries) | Not generated | Algorithms are O(n) Maps; import of 5,000 rows is a single pass |

---

## 12. How to reproduce

```bash
npm install
npm run typecheck
npm test
npm run build
npm run preview
# open http://localhost:4173/?today=2026-11-15
```

1. Click **Load sample JSON**.
2. Confirm `#total-outstanding` shows `₹11,820` and Ravi Kumar shows `₹670`.
3. Open Ravi → add a ₹700 payment with a screenshot → balance becomes `−₹30`.
4. Reload → the screenshot and balance are still there.
5. Open Overdue → four customers, worst-first.
