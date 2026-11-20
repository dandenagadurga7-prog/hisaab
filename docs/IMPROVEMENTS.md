# HISAAB — Improvement Review

| Field | Value |
|---|---|
| Version | 1.1 |
| Method | Heuristic review against data integrity, first-time usability, mobile ergonomics, failure states, accessibility, performance and commercial readiness |
| Outcome | **0 open P0, 0 open P1**; improvements applied and re-verified |
| Evidence | `docs/QA_TEST_PLAN.md` §9 |

Definitions: **P0** = wrong data, data loss, or a broken money path. **P1** = a shop owner would hesitate, make a mistake, or lose trust. **P2** = polish and product expansion.

---

## 1. P0 — Critical (all fixed)

### P0-1 · Fractional paise could enter the ledger
- **Problem:** the store rounded `amountPaise` before validating. A caller passing `1.5` produced a 2-paise credit; a future refactor could pass `250.999` and silently change a balance.
- **Why it matters:** the product's core promise is that the arithmetic is exact. Silent rounding is the one bug a shop owner can never forgive.
- **Fix:** the store now requires `Number.isInteger(amountPaise)` and a positive value ≤ ₹1 crore. The UI already parses strings strictly (`1.234` is rejected, not rounded).
- **Test:** `store.test.ts` → "rejects zero, negative and non-integer amounts".

### P0-2 · Screenshot blobs were stored as `Blob` objects in IndexedDB
- **Problem:** storing a `Blob` relies on the browser's structured-clone implementation of Blob, which is inconsistent across engines and test environments; in one environment the record returned as `{}`.
- **Why it matters:** a payment receipt that silently disappears is a dispute the shop loses.
- **Fix:** persist `ArrayBuffer` + `mime` + dimensions, and rebuild the `Blob` on read. This is portable across Chrome, Edge, Firefox, Safari and jsdom/`fake-indexeddb`.
- **Test:** `services.test.ts` → "stores, resolves and deletes a blob"; browser reload keeps `img[data-shot]` = 1.

---

## 2. P1 — Important (all fixed)

| ID | Finding | Change | Outcome |
|---|---|---|---|
| P1-1 | Two controls shared the accessible name **"Amount"** (the credit/payment switch and the amount field) | Renamed the switch to **Entry type** in all three languages | Screen-reader and automation ambiguity removed |
| P1-2 | The **Total payments** stat card said "Settled" when nothing was settled — it described the advance count | Shows the number of payment entries | The card now describes itself |
| P1-3 | Customer rows were ~107 px tall; only six fitted on a 1000 px laptop, and the ledger felt like a contact list, not a ledger | 64 px rows: phone + last activity on one line, balance + entry count, inline reminder | 8 rows visible with room to spare; faster scanning at the counter |
| P1-4 | Transaction rows were ~108 px because the action row always occupied a second line | Single 56 px row: icon, note, date, thumbnail, amount, actions | 7 entries visible instead of 4 |
| P1-5 | Import screen repeated the full instructions in the side panel and offered two different "load sample" behaviours (fill vs import immediately) | Side panel now summarises the sample shop and fills the textarea; immediate import is only in Settings | One mental model for the screen |
| P1-6 | `₹670.50` rendered as `₹670.5` | Formatting adds two decimals only when paise ≠ 0 | Correct-looking money |
| P1-7 | Clearing the overdue-threshold field silently reverted to 30 days on save | Inline validation; the value is never changed behind the owner's back | No invisible settings changes |
| P1-8 | An import that failed after a screenshot upload left an orphan blob in IndexedDB | The blob is deleted when the transaction write fails | Storage does not leak on errors |

---

## 2b. Delivered after the first review (v1.1)

| Item | What shipped | Why it mattered |
|---|---|---|
| **Receipt scanner** | Camera or gallery capture, animated scan, on-device OCR, amount suggestion, explicit confirmation | The owner's proof is a UPI screenshot; tying the amount to the photo removes the biggest source of mis-keyed payments |
| **Success screens** | Illustrated confirmation with the amount, the new balance and one clear next action for entries, customers and imports | A ledger must feel trustworthy at the moment of saving, not just correct afterwards |
| **Installable PWA + offline shell** | Manifest, maskable icons, install prompt, network-first shell with cache-first hashed assets | Makes Hisaab behave like the phone apps shopkeepers already understand |
| **Opening balance** | Optional carry-forward on customer creation, written as a single credit entry | Migrating from a paper book no longer requires a fake transaction or an import file |

All four were verified in Chrome at 1440×1000 and 390×844. The scanner read a real UPI receipt (₹700) in 1.5 s and the captured image persisted with the entry.

## 3. P1 — Open

**None.** Every issue that could produce wrong money, silent data change, or a dead-end flow has been closed and re-verified.

---

## 4. P2 — Backlog (deliberately not built)

Ordered by value to a real shop.

| # | Improvement | Why it matters | Effort | Notes |
|---|---|---|---|---|
| 1 | **Undo delete (5-second toast)** | A mis-tap on "Delete customer" currently needs a backup restore | S | Keep the deleted record in memory until the toast expires |
| 2 | **Printable / shareable customer statement** | Owners settle disputes by showing a page; CSV is not friendly on WhatsApp | M | Generate a clean HTML statement and use the browser print dialog |
| 3 | **Screenshot backup bundle (zip)** | Backups currently exclude receipts, which is the owner's proof | M | Adds a zip dependency; must stay client-side |
| 4 | **Camera edge detection + crop** | The scanner attaches the whole photo; cropping to the receipt improves readability and storage | M | Pure canvas; no new dependency |
| 5 | **Ageing buckets (0–30 / 31–60 / 61–90 / 90+)** | Owners think in ageing buckets when provisioning credit | S | The data is already there; add a report screen |
| 6 | **Hindi / Telugu OCR models** | Local-language receipts are common; the pipeline already supports extra language data | S | Adds ~15 MB per language, loaded on demand |
| 7 | **PIN / pattern lock** | Counters are visible to customers and staff | M | Hash a 4–6 digit PIN in localStorage (not a security boundary, a shoulder-surfing deterrent) |
| 8 | **Multiple shops on one device** | One owner with two counters currently needs two browser profiles | L | Namespaced stores; breaks the "one profile = one shop" assumption |
| 9 | **Recurring monthly credit** | Milk, newspapers and tiffin are predictable | M | Template entries the owner confirms |
| 10 | **Bulk edit / merge duplicate customers** | Phone-number corrections happen | S | Merge keeps the ledger and deletes the duplicate |
| 11 | **WhatsApp Business API reminders** | Removes the manual tap for large books | L | Requires a backend and paid messaging — out of scope by design |
| 12 | **Cloud sync** | Two devices, one ledger | XL | Would require accounts, a server and a privacy story; conflicts with the current cost/privacy model |

---

## 5. Deliberately rejected

| Idea | Why not |
|---|---|
| React Router | Five routes; a 60-line hash router keeps `?today=` intact with no dependency |
| Redux / React Query | Zustand plus derived selectors is smaller and sufficient |
| Storing balances | Guarantees eventual inconsistency |
| IndexedDB for everything | Async first paint with no benefit for < 5 MB of text |
| A charting library | Stat cards and the overdue list answer the owner's real questions; charts would be decoration |
| Global toast library | 40 lines covers the need |
| Cloud analytics | Conflicts with the privacy promise and adds no value to the owner |

---

## 6. Review conclusion

v1.1 closes the "feels like a real app" gap: scanning, celebratory confirmation and home-screen installation are now part of the product, not the roadmap.

The product is commercially demonstrable. The money path is exact and independently tested against the supplied dataset; destructive actions are guarded; the failure modes that matter (corrupt storage, full quota, missing IndexedDB, orphan transactions) all degrade visibly rather than silently.

The next highest-value work is not a feature: it is a **field pilot** with 5–10 shopkeepers to validate the 12-second credit-entry target and the reminder wording in real use. Feature work should follow that evidence.
