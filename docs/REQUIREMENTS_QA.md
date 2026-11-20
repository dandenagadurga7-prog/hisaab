# HISAAB — Requirements Q&A and Assumptions

| Field | Value |
|---|---|
| Version | 1.0 |
| Purpose | Record every ambiguity found in the brief, the decision taken, and why |
| Rule | Ask only when a decision is irreversible, costly, or commercially material. Otherwise decide, document, proceed. |

---

## 1. Questions That Would Need the Client

These are the only questions worth interrupting a build for. None blocked progress: each has a safe default that is cheap to change later.

| # | Question | Why it matters | Default applied |
|---|---|---|---|
| Q1 | Is multi-device sync ever required? | Would invalidate the "no backend" constraint | **No.** localStorage/IndexedDB only. Documented as a limitation. |
| Q2 | Should deleting a customer be recoverable? | Destructive data loss | **Soft-confirm only in v1**, but a JSON backup prompt is offered before deletion and the snapshot is downloadable. Undo-trash is a P2 roadmap item. |
| Q3 | Is a customer phone number always an Indian mobile? | Validation strictness for legacy data | **New records:** `/^[6-9]\d{9}$/`. **Imported records:** any 10 digits, so a shop's real history is never rejected. |
| Q4 | Should imported shop name overwrite the current shop name? | Silent identity change | **Only when** the current name is still the default "My Shop". Otherwise reported as a suggestion. |
| Q5 | What counts as "overdue"? | Drives the collections screen | **30 days** since last payment, configurable 1–365 in Settings. |
| Q6 | Is the OCR requirement mandatory for launch? | Adds a 5–10 MB WASM dependency | **Optional.** A pluggable adapter ships; no heavy dependency is bundled. See §4. |

---

## 2. Decisions Taken Without Asking

### Data and money

| # | Ambiguity | Decision | Rationale |
|---|---|---|---|
| A1 | Rupees vs paise storage | **Integer paise** internally, rupees at the edges (import/export/UI) | Removes floating-point drift; the brief says "wherever practical" and it is practical everywhere |
| A2 | Are entry amounts signed? | **No.** Type carries the sign | Matches the sample format exactly (`type` + positive `amount`) |
| A3 | Rounding of `0.005` | **Rejected** (more than 2 decimals) | Silent rounding of money is a trust violation |
| A4 | Negative balance meaning | **Advance paid by customer**, labelled "Advance with shop" | Real shop behaviour (customers prepay); must not be clamped to zero |
| A5 | Should totals include zero-balance customers? | **Customer count: yes. Outstanding: no effect (₹0).** | Matches `customers_with_balance: 8` semantics while keeping the list complete |
| A6 | `top_defaulter_phone` meaning | Largest positive balance (not most overdue) | Matches the sample: 9000000102 has the largest balance, ₹3,470 |

### Identity and validation

| # | Ambiguity | Decision | Rationale |
|---|---|---|---|
| A7 | Can two customers share a phone? | **No.** Phone is unique | The brief requires rejecting duplicate phones; also the import format keys on phone |
| A8 | Phone normalisation on paste | Strip spaces, `-`, `(`, `)`, leading `+91`/`91`/`0` | Owners paste from WhatsApp contacts; rejecting `+91 90000 00101` would feel broken |
| A9 | ID format | `cus_`/`txn_`/`shot_` + UUID v4 | Human-scannable in exports, collision-free |
| A10 | Name length | 1–80 chars after trim | Long enough for "Mohammed Abdul Rahman Siddiqui", short enough to render |
| A11 | Duplicate customer names | **Allowed**, distinguished by phone | Families reuse names; blocking would be wrong |
| A12 | Note length | 200 chars | One line on a phone; prevents accidental essays |
| A13 | Case sensitivity in search | Insensitive; also matches phone substrings of 3+ digits | Fast, forgiving, expected |

### Dates

| # | Ambiguity | Decision | Rationale |
|---|---|---|---|
| A14 | Store dates as `Date` or string? | **Date-only string `YYYY-MM-DD`** | A credit on the 27th is on the 27th regardless of timezone; no UTC drift |
| A15 | Future-dated entries | **Rejected** beyond today | Prevents typos (2027 instead of 2026) corrupting overdue maths |
| A16 | `?today=` invalid value | Ignore, fall back to device date, no crash | A demo URL must never break the app |
| A17 | Date arithmetic basis | Local constructors only, never `toISOString()` | `new Date('2026-11-15').toISOString()` shifts a day in IST-negative offsets |
| A18 | Max backdating | 10 years | Enough for migration; blocks `1900` typos |

### Import

| # | Ambiguity | Decision | Rationale |
|---|---|---|---|
| A19 | Is import merge or replace? | **Merge (additive), never replace** | "Never silently delete existing data" |
| A20 | Duplicate detection key | `phone|type|paise|date|normalised note` | Deterministic, survives re-import, and cannot destroy legitimate repeated purchases (which differ in date) |
| A21 | Invalid records: skip or abort? | **Abort the whole import** | Partial imports produce ledgers that cannot be reconciled; atomicity is safer |
| A22 | Duplicate phones inside one payload | First wins, later ones skipped with a warning | Non-fatal: the data is still usable |
| A23 | Entry for an unknown phone | **Error** (abort) | Would create an orphan |
| A24 | Payload with 0 entries | **Allowed** | Supports customers with no transactions, which is explicitly required |
| A25 | Payload with no `customers` key | Treated as `[]`; entries then fail FK validation | Predictable, matches the "customers without entries" mirror case |

### UI and product

| # | Ambiguity | Decision | Rationale |
|---|---|---|---|
| A26 | Router | Custom hash router | 5 routes; avoids a dependency and keeps `?today=` untouched |
| A27 | Language scope | Full chrome translated; customer names/notes untouched | Owner's data is never machine-translated |
| A28 | Default theme | Follow system | No surprise flash; respects device preference |
| A29 | Phone display | Masked by default (`90000••101`), reveal on tap, toggle in Settings | Shop counters are semi-public |
| A30 | Currency format | `en-IN` grouping (`₹1,18,200`) | Indian users read lakh grouping; Western grouping looks foreign and unprofessional |
| A31 | Delete confirmation style | Modal naming the entity + impact ("3 transactions will be deleted") | Prevents the classic "deleted the wrong Ravi" |
| A32 | Empty dashboard | Hero empty state, one CTA, plus "Load demo data" | Sellable in a demo, not a blank screen |
| A33 | Demo data | Bundled sample dataset, loadable from Settings | A salesperson can demo in 2 seconds with no file |
| A34 | Screenshots in backup | **Excluded**, stated in the export dialog | JSON with megabytes of base64 is unusable |
| A35 | Screenshot limit | 5 MB pre-downscale, 1600 px max edge after | Phone screenshots are 1080–1440 px wide; no quality loss, big quota saving |
| A36 | WhatsApp country code | Hard-coded `91` per the brief | Matches `https://wa.me/91<phone>` |
| A37 | Reminder when balance ≤ 0 | Disabled with explanation, not hidden | Hiding it makes the UI feel broken; explaining it teaches the rule |
| A38 | Settings: UPI | Optional; link disabled when empty | Many shops have no UPI ID; the product must not demand one |

---

## 3. Assumptions About the Environment

1. The owner uses a modern evergreen browser with localStorage and IndexedDB enabled.
2. One browser profile = one shop. Two shops on one device require two profiles (documented).
3. The device clock is roughly correct. `?today=` exists for demos and tests.
4. There is no requirement to print receipts in v1.
5. WhatsApp is installed on the device; if not, the `wa.me` link opens the web fallback.
6. Network may be absent after first load; nothing at runtime requires it.
7. The deployment target is a static host with SPA rewrites (Vercel/Netlify).
8. Screenshots are for the owner's own records, not legal proof.

---

## 4. Optional Feature Decisions

### OCR (bonus)
- **Decision:** ship an adapter, not a heavyweight engine.
- `services/ocr.ts` attempts `tesseract.js` via a non-bundled dynamic import; if absent it falls back to a filename-based heuristic.
- The result is always a *suggestion* in a confirm strip. No code path writes a transaction from OCR output.
- **Upgrade path:** `npm i tesseract.js`, then the adapter activates with no UI change. Documented in `IMPROVEMENTS.md` (P2).

### Telugu / Hindi
- Dictionaries cover navigation, dashboard, forms, validation messages, and reminder templates.
- Technical tokens (₹, dates, "CSV", "JSON") stay as-is.
- Missing keys fall back to English rather than showing a raw key.

### CSV export
- Two scopes: full ledger and single customer.
- Columns: `Date, Customer, Phone, Type, Amount (INR), Note, Created At`.
- Amounts exported as plain decimals (`670.00`) so spreadsheets sum them correctly, with an ISO date column to avoid locale parsing.
- Cells starting with `=`, `+`, `-`, `@` are prefixed with `'` to prevent CSV formula injection.

---

## 5. Open Items Carried to the Roadmap

| Item | Class | Note |
|---|---|---|
| Undo-delete / trash | P1 | Mitigated by backup-on-delete prompt |
| Screenshot backup bundle (zip) | P2 | Requires a zip library |
| Real OCR bundling | P2 | Adapter ready |
| Multi-device sync | P3 | Violates v1 constraints by design |
| Customer statement PDF | P2 | CSV covers the need for now |
| Interest / ageing buckets (30/60/90) | P2 | Overdue list is the v1 answer |
| PIN lock | P2 | Privacy on shared counters |
