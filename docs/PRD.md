# HISAAB — Product Requirements Document

| Field | Value |
|---|---|
| Product | Hisaab — Digital Khata for Indian shops |
| Version | 1.0 |
| Status | Approved for build |
| Owner | Product Management |
| Last updated | 2026-11-20 |

---

## 1. Product Vision

Hisaab replaces the paper *khata* (credit notebook) with a fast, trustworthy digital ledger that a shop owner can operate with one thumb, in their own language, on the phone they already own.

The product exists to answer one question instantly, for any customer, at any moment:

> "How much does this person owe me, and how long has it been?"

Hisaab is not an accounting package. It is a **collection tool**: it records credit, records payments, and makes it effortless to ask for money politely.

### Vision statement

> Every kirana shop in India should be able to recover its outstanding credit without opening a notebook, without a computer, and without paying for a subscription.

---

## 2. Business Problem

Small retailers extend informal credit daily. The paper ledger that tracks it has five expensive failure modes:

| Problem | Business impact |
|---|---|
| Balances are calculated by hand | Arithmetic errors, disputes with customers, lost trust |
| The notebook is at the shop | Owner cannot answer "what do I owe?" while travelling |
| Statements are illegible or lost | Unrecoverable bad debt; no proof of transactions |
| Asking for money is awkward | Owner delays reminders, credit ages and defaults |
| One notebook per shop, no backup | Fire, water, or loss destroys years of receivables |

An estimated 80%+ of Indian kirana credit is still tracked on paper. The cost is not just bad debt — it is the owner's time, the family's cash flow, and the working capital locked inside other people's houses.

### Why existing solutions fail for this segment

- Paid SaaS ledgers require onboarding, subscriptions, and trust the owner does not yet have.
- Full accounting suites (Tally-class) are unreadable to a shopkeeper with a 10th-grade education.
- Excel templates require a laptop, and are never used at the counter.

### The Hisaab wedge

Zero setup, zero cost, zero login. Open the page, add a customer, start recording. Data lives on the device the owner already trusts — their phone browser.

---

## 3. Target Customers

### Primary segment

| Attribute | Detail |
|---|---|
| Business | Kirana / general store, provision store, dairy, bakery, hardware, medical shop |
| Size | 1–3 people, single counter, ₹2–20 lakh annual turnover |
| Geography | Tier 1–3 India; Telugu- and Hindi-speaking states first |
| Device | Android phone, 4–6 inch screen, intermittent 4G, Chrome |
| Digital comfort | Uses WhatsApp and UPI daily; does not use spreadsheets |
| Credit book | 20–150 active customers, 5–40 transactions per day |
| Current tool | Paper notebook, sometimes a second notebook for "old" dues |

### Secondary segment

- Wholesale distributors tracking retailer dues.
- Home-based sellers (tiffin, tailoring) with a small repeat customer base.
- Shop owners who want a clean statement to show a customer during a dispute.

### Explicit non-customers (v1)

- Businesses needing GST invoices, inventory, or double-entry accounting.
- Multi-branch operations needing shared, synced data.
- Anyone requiring multi-device or multi-user access.

---

## 4. User Personas

### Persona A — Lakshmi, 44, provision store owner, Vijayawada

- Runs a 300 sq ft store with her husband. Two children.
- Keeps credit in a ruled notebook with a page per customer.
- Speaks Telugu at home; reads Telugu and basic English.
- Pain: a customer claims he paid ₹500 last month; she cannot find the entry under the scribbles. She waives it to avoid a scene.
- Goal: proof, in seconds, that survives an argument.
- Success looks like: she taps the customer's name, sees the dated list, and shows the phone.

### Persona B — Ramesh, 31, medical shop owner, Jaipur

- Runs the shop alone in the evenings. Very comfortable with WhatsApp and UPI.
- Pain: he forgets who is overdue until his cash is short at the end of the month.
- Goal: a list of people to chase, with a ready-made polite WhatsApp message.
- Success looks like: every Sunday he opens Hisaab, sees five overdue customers, and sends reminders in one minute.

### Persona C — Sana, 26, home baker, Hyderabad

- Sells cakes on order to ~40 regulars. Records dues in WhatsApp chats.
- Pain: dues are scattered across chats; she cannot total them.
- Goal: one screen with her total outstanding and her worst payer.
- Success looks like: she knows exactly how much is owed to her before she buys supplies.

### Persona D — Imran, 38, shop assistant

- Operates the counter when the owner is away.
- Pain: he is not allowed to touch the notebook because his handwriting is "not reliable".
- Goal: a simple form he cannot get wrong, with no chance of deleting the owner's data by accident.
- Success looks like: he records a ₹120 credit and a ₹500 payment without asking a single question.

---

## 5. User Journeys

### J1 — First run (cold start, under 60 seconds)

1. Owner opens the deployed URL on Chrome (no install, no login).
2. Onboarding card asks for shop name and (optionally) UPI ID.
3. Owner lands on an empty dashboard with a single primary action: **Add your first customer**.
4. Owner adds "Ravi Kumar / 9000000101". The row appears with ₹0 balance.
5. Owner taps the row and records the first credit of ₹250.
6. Dashboard now shows Total outstanding ₹250.

**Acceptance:** no signup, no network call, no error state; works on a 360 px screen.

### J2 — Daily credit entry (target: under 12 seconds)

1. Customer at counter takes goods worth ₹180 on credit.
2. Owner opens dashboard → search box → types "rav" or "0101".
3. Taps the customer row → inline **Add entry** card is already visible.
4. Amount `180`, type **Credit** preselected, note "groceries", date defaults to today.
5. Taps **Save**. Toast confirms; balance becomes ₹430; dashboard total updates without reload.

### J3 — Payment collection with proof

1. Customer pays ₹500 by UPI and shows a screenshot.
2. Owner selects type **Payment**, amount `500`, attaches the screenshot in the same form.
3. Saves. The receipt image is stored in the browser (IndexedDB) and appears on the transaction row.
4. Owner reopens the app after a phone restart: the image is still there.

### J4 — Polite reminder

1. Owner opens the customer page for Sunita (₹3,470 outstanding).
2. Taps **WhatsApp reminder**.
3. WhatsApp opens with the shop name, customer name, exact amount and a polite Telugu/Hindi/English message.
4. If the amount is zero or negative, the reminder action is disabled with an explanation.

### J5 — Migrating from paper / another shop's export

1. Owner exports or receives a JSON file in the Hisaab interchange format.
2. Opens **Import**, pastes the JSON into the textarea, taps **Validate & import**.
3. Sees a preview: 8 customers, 38 entries, 0 duplicates, ₹11,820 outstanding.
4. Confirms. All balances are recalculated from the entries — never from a supplied total.
5. Importing the same file again is a no-op: every entry is recognised as already present.

### J6 — Sunday collections

1. Owner opens **Overdue**, sorted by days since last payment, worst first.
2. Sees "Sunita Devi — 47 days — ₹3,470".
3. Sends reminders one by one, then records the payments as they arrive.

### J7 — Statement export

1. Owner opens a customer page and taps **Export CSV** for that customer, or exports the full ledger from Settings.
2. The CSV opens in Excel/Google Sheets with readable dates and rupee amounts.
3. The owner shares it on WhatsApp for a dispute.

### J8 — Device loss / recovery (documented limitation)

1. Settings → **Backup** downloads a JSON snapshot.
2. On a new phone, the owner restores the file.
3. Screenshots are **not** included in the JSON backup; the UI states this explicitly.

---

## 6. Functional Requirements

Priority: **M** = must ship, **S** = should ship, **C** = could ship.

### 6.1 Customer management

| ID | Requirement | Priority |
|---|---|---|
| FR-C1 | Add a customer with name and exactly 10 numeric phone digits | M |
| FR-C2 | Reject empty names, whitespace-only names, and names > 80 characters | M |
| FR-C3 | Reject phone numbers that are not exactly 10 digits, including on paste with spaces/`+91` | M |
| FR-C4 | Reject a phone number that already exists (unique per shop) | M |
| FR-C5 | Edit name and phone; phone remains unique | M |
| FR-C6 | Delete a customer only after an explicit confirmation that names the customer and the number of transactions that will be removed | M |
| FR-C7 | Support customers with zero transactions; they appear in the list with ₹0 | M |
| FR-C8 | Search customers by name (case/diacritic-insensitive partial) and by phone (any 3+ digit substring) | S |
| FR-C9 | Assign every customer a CIDv4-like unique id; ids never collide across imports | M |

### 6.2 Ledger

| ID | Requirement | Priority |
|---|---|---|
| FR-L1 | Record a **credit** (goods given) with amount > 0 | M |
| FR-L2 | Record a **payment** (money received) with amount > 0 | M |
| FR-L3 | Attach a free-text note up to 200 characters | M |
| FR-L4 | Set a transaction date `YYYY-MM-DD`; default is the app's "today" | M |
| FR-L5 | Reject future dates beyond the app's "today"+1 day tolerance? **No** — accept up to today only; block dates more than 10 years in the past | M |
| FR-L6 | Edit amount, type, date and note of an existing transaction; recalculate immediately | M |
| FR-L7 | Delete a transaction after confirmation; recalculate immediately | M |
| FR-L8 | Sort transactions newest-first by date, then by creation time | M |
| FR-L9 | Show running totals (credit, payments, balance) per customer | M |
| FR-L10 | Amounts accept `250`, `250.5`, `1,250.75`, `₹250`; rejected if ≤ 0 or > ₹1,00,00,000 | M |

### 6.3 Balance engine

| ID | Requirement | Priority |
|---|---|---|
| FR-B1 | Customer balance = Σ credit − Σ payment, computed from transactions only | M |
| FR-B2 | Shop total outstanding = Σ customer balances | M |
| FR-B3 | Balances are never persisted as source-of-truth values | M |
| FR-B4 | Support zero balances and negative balances (advance paid) | M |
| FR-B5 | All money arithmetic happens in integer paise | M |
| FR-B6 | Display in Indian numbering (`₹1,18,200`) | S |

### 6.4 WhatsApp reminders

| ID | Requirement | Priority |
|---|---|---|
| FR-W1 | Generate `https://wa.me/91<phone>?text=<encoded>` exactly | M |
| FR-W2 | Message includes customer name, actual outstanding, shop name, and a polite request | M |
| FR-W3 | Message language follows the app language (English / Hindi / Telugu) | S |
| FR-W4 | Reminder is unavailable (disabled, not hidden) when balance ≤ 0, with a reason | M |
| FR-W5 | Link opens in a new tab with `rel="noopener noreferrer"` | M |

### 6.5 Payment screenshots

| ID | Requirement | Priority |
|---|---|---|
| FR-S1 | Accept JPEG, PNG, JPG, WEBP only | M |
| FR-S2 | Reject files > 5 MB with a clear error | M |
| FR-S3 | Store the binary in IndexedDB, not localStorage | M |
| FR-S4 | Downscale images to a max edge of 1600 px before storage to protect quota | S |
| FR-S5 | Show the stored image on the transaction row through `img[data-shot]` | M |
| FR-S6 | Images survive reload and app restart | M |
| FR-S7 | Allow removing a screenshot from a transaction | S |
| FR-S8 | OCR may *suggest* an amount for confirmation; it must never create a payment | C |

### 6.6 Import / export

| ID | Requirement | Priority |
|---|---|---|
| FR-I1 | Import the documented interchange JSON (`shop`, `customers[]`, `entries[]`) | M |
| FR-I2 | Validate the entire payload before writing anything; a failed import changes nothing | M |
| FR-I3 | Report errors per record with a path (`entries[12].amount`) | M |
| FR-I4 | Never trust supplied balances or totals; recompute | M |
| FR-I5 | Skip records that already exist (idempotent re-import) | M |
| FR-I6 | Support customers with no entries | M |
| FR-I7 | Export the full ledger, or one customer's ledger, as CSV | S |
| FR-I8 | Export a complete JSON backup and restore from it | S |
| FR-I9 | Import must handle 5,000 entries without freezing the UI > 1 s | S |

### 6.7 Overdue management

| ID | Requirement | Priority |
|---|---|---|
| FR-O1 | Overdue = balance > 0 and no payment in the last 30 days (or no payment ever) | M |
| FR-O2 | Show days since last payment; customers never paid sort by days since first credit | M |
| FR-O3 | Sort worst-first by days, then by amount | M |

### 6.8 Settings, i18n, UPI

| ID | Requirement | Priority |
|---|---|---|
| FR-T1 | Shop name, UPI ID, language and theme persist | M |
| FR-T2 | Language: English, हिन्दी, తెలుగు | S |
| FR-T3 | Theme: light, dark, follow system | S |
| FR-T4 | Validate UPI ID shape (`handle@bank`) and warn if invalid | M |
| FR-T5 | Generate `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…` payment links when UPI ID is set | S |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | First meaningful paint < 1.5 s on a mid-range Android over 4G; dashboard interaction < 100 ms for 1,000 customers; 5,000 entries imported in < 1 s |
| Offline | 100% functional after first load with no network; no external calls at runtime |
| Compatibility | Latest 2 versions of Chrome, Edge, Safari, Firefox; Android 8+; iOS 15+ |
| Accessibility | WCAG 2.1 AA contrast on body text; all controls keyboard reachable; visible focus rings; 44×44 px minimum touch targets; form labels bound to inputs; `aria-live` for toasts |
| Responsiveness | 320 px–1920 px; no horizontal scroll at 320 px; tables become stacked cards below 768 px |
| Reliability | No data loss on refresh; corrupt localStorage is quarantined, never silently destroyed |
| Security | No secrets, no network transmission of ledger data, no third-party analytics |
| Maintainability | Strict TypeScript, pure domain functions, ≥ 80% coverage on domain layer |
| Localisation | All chrome strings translatable; numbers and dates localised for `en-IN` |
| Privacy | Customer data never leaves the device; reminders are user-initiated links only |

---

## 8. Business Rules

1. **Single source of truth.** Balances exist only as the result of transactions. There is no editable balance field anywhere in the product.
2. **One phone, one customer.** Phone is the business key and is unique. Two people sharing a phone must be modelled as one customer or use a different number.
3. **Phone is exactly 10 digits.** `+91`, leading `0`, spaces and dashes are stripped on paste; anything that does not reduce to 10 digits is rejected.
4. **Credit increases what the customer owes. Payment decreases it.** A payment larger than the balance produces a negative balance, shown as "Advance with shop".
5. **Amounts are positive.** The type determines the sign. Zero-amount transactions are rejected.
6. **Money is integer paise.** `0.1 + 0.2` bugs are forbidden.
7. **Deleting a customer deletes their transactions**, never leaves orphans. Screenshots are deleted with them.
8. **Imports are additive and idempotent.** An imported entry identical to an existing one (same customer, type, amount, date, normalised note) is skipped, not duplicated.
9. **Import is atomic.** Either every valid record lands or nothing does.
10. **"Today" is injectable.** `?today=YYYY-MM-DD` overrides the current date for all defaults and date-dependent calculations. Absent, the local device date is used.
11. **Overdue threshold is 30 days**, measured from the most recent payment, or from the first credit if never paid.
12. **No cross-device sync.** Storage is per-browser-profile. Clearing site data deletes the ledger; backups are the owner's responsibility and the UI says so.

---

## 9. Acceptance Criteria

Every criterion below is verified by an automated test or a documented manual step in `docs/QA_TEST_PLAN.md`.

### AC-1 Sample dataset fidelity
- Importing `sample-data_JSON.json` yields exactly **8 customers**, **38 entries**.
- `#total-outstanding` reads **₹11,820**.
- Ravi Kumar (`9000000101`) shows **₹670**.
- Customer balances match `sample-expected.json` exactly: 250 / 1260 / 2810 / 2830 / 230 / 3470 / 670 / 300.
- Top defaulter (largest balance) is `9000000102` at ₹3,470.

### AC-2 Balances recalculate
- Adding a ₹100 credit to a ₹670 customer shows ₹770 on the row, the customer page and `#total-outstanding` within one render, with no reload.
- Deleting that transaction restores ₹670 exactly.

### AC-3 Validation
- Phone `12345` is rejected inline; `9000000101` twice is rejected with "already exists"; name `   ` is rejected.
- Amount `-5`, `0`, `abc`, `1e9` are rejected.

### AC-4 Persistence
- All customers, transactions, settings and screenshots survive `location.reload()`.
- Corrupt JSON in localStorage does not crash the app; the original string is preserved under a quarantine key and a banner is shown.

### AC-5 WhatsApp
- For a balance of ₹670, `a[data-remind="9000000101"]` has an href starting `https://wa.me/919000000101?text=` and the decoded text contains `Ravi Kumar` and `670`.

### AC-6 Screenshots
- Choosing a PNG via `#shot-input`, saving the entry, and reloading produces exactly one `img[data-shot]` whose `src` is a blob URL with natural width > 0.

### AC-7 Import safety
- Invalid JSON shows an error and writes nothing.
- Importing the same file twice does not change any balance or entry count.
- A customer with no entries still appears with ₹0.

### AC-8 Date override
- With `?today=2026-11-15`, a new entry defaults to `2026-11-15`, and relative "days since" values use that date.

### AC-9 Responsive & localised
- At 360×740 the dashboard has no horizontal overflow; navigation is reachable.
- Switching to हिन्दी or తెలుగు replaces navigation and dashboard labels without reload.

### AC-10 Export
- CSV export downloads a file containing a header row and one row per transaction with ISO dates and paise-correct rupee values.

---

## 10. Edge Cases

| # | Case | Expected behaviour |
|---|---|---|
| 1 | Customer with no transactions | Listed with ₹0; balance counted as 0 in totals; never hidden |
| 2 | Payment exceeds credit | Negative balance; dashboard shows "advance" styling; reminder disabled |
| 3 | Two customers with the same name, different phones | Allowed; distinguished by phone |
| 4 | Same phone entered with `+91 90000 00101` | Normalised to `9000000101` |
| 5 | Import contains an entry for an unknown phone | Rejected with a path error; nothing imported |
| 6 | Import contains duplicate customer phones | First wins, later duplicates reported as skipped warnings |
| 7 | Import has `customers: []` but entries | Rejected: no valid customers |
| 8 | Import has 0 entries | Allowed: customers imported with ₹0 |
| 9 | Re-import after the owner edited a note | Treated as a different record (note differs) → duplicate prevention is best-effort; documented |
| 10 | Transaction dated in the future | Rejected (`Date cannot be in the future`) |
| 11 | `?today=not-a-date` | Ignored, falls back to device date; no crash |
| 12 | localStorage quota exceeded on save | Error toast, in-memory state kept, user prompted to export and remove screenshots |
| 13 | IndexedDB unavailable (private mode / old browser) | Screenshot feature degrades: clear message, ledger still works |
| 14 | Screenshot record deleted but transaction references it | Row shows "image unavailable" placeholder, no crash |
| 15 | Two tabs open | Last write wins; a "storage" listener reloads the other tab and warns |
| 16 | User deletes the last customer | Empty state returns; totals show ₹0 |
| 17 | Amount `0.005` | Rejected (rounds to 1 paise? No — reject amounts with > 2 decimals) |
| 18 | Very long name (5000 chars) | Rejected at 80 characters |
| 19 | Emoji / Devanagari / Telugu names | Fully supported (UTF-8, no length-byte assumptions) |
| 20 | Clock set backwards | Entries dated later than "today" show as "future", no data loss |

---

## 11. Security and Privacy

### Data location
All ledger data lives in the browser profile on the user's own device. There is no server, no account, no telemetry, no analytics, no third-party font/script call that receives ledger content.

### Threats considered

| Threat | Mitigation |
|---|---|
| XSS through customer names or notes | React escapes all interpolated values; no `dangerouslySetInnerHTML` anywhere |
| XSS through imported JSON | Imported strings pass the same validation and are rendered as text only |
| Open redirect / tab hijack via WhatsApp link | `target="_blank"` + `rel="noopener noreferrer"`; the base host is a fixed constant |
| CSV formula injection (`=cmd|...`) | Cells beginning with `= + - @` are prefixed with `'` |
| Accidental destruction | Delete flows require a typed or two-step confirmation; corrupt storage is quarantined, not deleted |
| Shoulder-surfing on shared devices | No PIN in v1; documented limitation; phone numbers are masked in the UI by default with a reveal control |
| Data exfiltration by another site | Data is same-origin only; no postMessage API, no cross-origin iframes |
| Malicious file upload | Only image MIME types accepted, size-capped, stored as opaque blobs, never executed |

### Privacy commitments
- Customer phone numbers are shown in full only where needed for reminders; the dashboard masks the middle digits by default.
- No data is used for analytics or AI training.
- Export/backup is always the owner's explicit action.

---

## 12. Product Limitations

1. **No cloud sync.** Two phones mean two separate ledgers. Stated in onboarding and Settings.
2. **Browser data is fragile.** Clearing site data, "Clear cache", private mode, or reinstalling the browser deletes everything. Backups are manual.
3. **No screenshots in the JSON backup.** Images are binary and stay in IndexedDB; documented.
4. **No authentication.** Anyone holding the unlocked phone can read the ledger.
5. **No invoices, GST, inventory, or reports beyond receivables.**
6. **Approximate OCR.** The optional scan is a convenience; the owner always confirms the amount.
7. **No multi-currency.** INR only.
8. **Browser support limits.** Safari private mode may disable IndexedDB; screenshots degrade.
9. **Storage ceiling.** Typical browser quota is 50–60% of free disk; roughly 2,000–5,000 compressed screenshots.

---

## 13. Success Metrics

### Product metrics (measured locally; no telemetry)

| Metric | Target |
|---|---|
| Time to first recorded transaction (cold start) | < 60 s |
| Time to record a daily credit | < 12 s |
| Weekly active retention (owner returns within 7 days) | > 50% |
| Reminder-to-payment conversion within 7 days | > 25% (self-reported in pilot) |
| Data-loss incidents in pilot | 0 |

### Quality gates for release

| Gate | Threshold |
|---|---|
| Automated tests | 100% passing |
| Domain-layer coverage | ≥ 85% |
| TypeScript errors | 0 (strict) |
| Critical (P0) defects open | 0 |
| Sample-dataset reconciliation | Exact match to `sample-expected.json` |
| Lighthouse mobile performance | ≥ 90 |
| Lighthouse accessibility | ≥ 95 |

### Commercial readiness metrics

- A shop owner can complete J1–J4 with zero training, observed in a 5-minute usability test.
- The product can be demonstrated end-to-end with no network.
- A one-page pitch can be made from the dashboard alone (total outstanding, top debtor, reminder button).

---

## 14. Out of Scope for v1

- Payment gateway integration (UPI links open the user's own app; Hisaab never touches money).
- Automated WhatsApp Business API reminders.
- Customer-facing portal or self-service statement.
- Staff accounts, roles, audit logs.
- Recurring invoices, interest calculation, credit scoring.

---

## 15. Release Definition

v1.0 is release-ready when:

1. All MR and SR requirements are implemented or explicitly deferred in `docs/IMPROVEMENTS.md`.
2. Every acceptance criterion in §9 has a passing automated test or a recorded manual verification.
3. The production build is error-free and deployable to a static host.
4. All mandatory tester selectors resolve against real data.
5. Documentation (PRD, architecture, database, implementation plan, QA, deployment, final report) is complete.


---

## 16. Post-v1.0 Additions (v1.1)

Approved after the initial release; they extend the product without changing any business rule in §8.

| Addition | Requirement | Guardrail |
|---|---|---|
| **Receipt scanner** | Capture a receipt by camera or gallery, read the amount on-device, offer it for confirmation | OCR only *suggests* an amount; the owner confirms and saves. The image can be attached even when no amount is read. |
| **Success confirmation** | After saving an entry, adding a customer or importing, show an illustrated confirmation with the amount and new balance | Purely presentational; it never writes data. |
| **Opening balance** | Optionally carry forward what a customer already owes when creating them | Stored as one ordinary credit entry, fully editable and reversible. |
| **Installable app** | Install to the home screen and open offline after the first visit | The service worker caches the shell and hashed assets only; the ledger remains in localStorage/IndexedDB. |

Acceptance for these additions is recorded in `docs/QA_TEST_PLAN.md` §5 (rows 25–28).
