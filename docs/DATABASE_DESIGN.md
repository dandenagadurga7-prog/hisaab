# HISAAB — Database Design

| Field | Value |
|---|---|
| Version | 1.0 |
| Storage engines | localStorage (structured) + IndexedDB (blobs) |
| Last updated | 2026-11-20 |
| Related | `DATABASE_DESIGN.md` traces to `PRD.md` §6–§8 and `ARCHITECTURE.md` §6 |

This document is derived from the **actual** contents of `sample-data_JSON.json` and `sample-expected (1).json`, read from the workspace. No schema was assumed.

---

## 1. Source Data Inspection

### 1.1 `sample-data_JSON.json` — observed shape

```jsonc
{
  "shop": "Lakshmi Provision Store (fictional)",   // string, optional display name
  "customers": [                                    // array, may be empty
    { "name": "Ravi Kumar", "phone": "9000000101" } // both strings; phone is 10 digits
  ],
  "entries": [                                      // array, may be empty
    {
      "phone": "9000000101",   // FK by phone (not by id)
      "type": "credit",        // enum: "credit" | "payment"
      "amount": 250,           // JSON number, rupees (NOT paise), always > 0
      "date": "2026-09-27",    // ISO date-only string YYYY-MM-DD
      "note": "groceries"      // free text, optional in practice
    }
  ]
}
```

Observed facts (counted, not guessed):

| Fact | Value |
|---|---|
| Top-level keys | `shop`, `customers`, `entries` |
| Customers | 8 |
| Entries | 38 |
| Distinct entry types | `credit`, `payment` |
| Amount representation | rupees as JSON numbers (`250`, `1500`, `950`, `120`, `180`, `230`, `250`, `340`, `420`, `560`, `780`) |
| Amount decimals | none in the sample; the importer still supports up to 2 |
| Dates | `YYYY-MM-DD`, no time, no timezone |
| Notes | present on every sample entry; values `groceries`, `paid on UPI` |
| Foreign key | `entries[].phone` → `customers[].phone` |
| Orphan entries | none in the sample |
| Customers without entries | none in the sample; **explicitly required to be supported** |
| Unique phone per customer | yes in the sample; enforced by the product |

### 1.2 `sample-expected (1).json` — observed shape

```jsonc
{
  "today": "2026-11-15",                    // reference date for date-dependent maths
  "total_outstanding": 11820,               // rupees, integer
  "balances": { "9000000107": 250, ... },   // phone → rupees
  "top_defaulter_phone": "9000000102",      // largest positive balance
  "customers_with_balance": 8
}
```

### 1.3 Independent reconciliation

Computed from the 38 entries (credit − payment), in rupees:

| Phone | Name | Credit | Payment | Balance |
|---|---|---:|---:|---:|
| 9000000101 | Ravi Kumar | 2,350 | 1,680 | **670** |
| 9000000102 | Sunita Devi | 4,540 | 1,070 | **3,470** |
| 9000000103 | Mohd Irfan | 3,350 | 540 | **2,810** |
| 9000000104 | Anjali Reddy | 2,040 | 780 | **1,260** |
| 9000000105 | Prakash Rao | 460 | 230 | **230** |
| 9000000106 | Fatima Begum | 3,260 | 430 | **2,830** |
| 9000000107 | Venkat Naidu | 1,200 | 950 | **250** |
| 9000000108 | Kavitha S | 1,080 | 780 | **300** |
| **Total** | | **18,280** | **6,460** | **11,820** |

This matches `sample-expected (1).json` exactly (₹11,820 total, ₹670 for Ravi, 8 customers with balance). The QA suite asserts these numbers, not derived constants pasted into the app.

---

## 2. Interchange Format (Import / Export Contract)

The product accepts the sample format **as-is** and also exports it, so datasets can move between shops.

```ts
// Any customer with no entries is legal.
interface ImportPayload {
  shop?: string;
  customers: Array<{ name: string; phone: string }>;
  entries: Array<{
    phone: string;
    type: 'credit' | 'payment';
    amount: number;      // rupees
    date: string;        // YYYY-MM-DD
    note?: string;
  }>;
}
```

### Validation pipeline

```
raw text
  └─▶ JSON.parse ................. syntax error → "Not valid JSON at line/col"
        └─▶ shape check .......... customers/entries must be arrays if present
              └─▶ per-record normalise
                    ├─ phone: strip non-digits, strip leading 91/0, require 10
                    ├─ name: trim, 1..80 chars
                    ├─ type: must be credit|payment (case-insensitive)
                    ├─ amount: number 0.01..1,00,00,000, ≤2 decimals → paise
                    ├─ date: calendar-valid YYYY-MM-DD, ≤ today
                    └─ note: trim, ≤ 200
                          └─ FK check: every entry.phone ∈ imported ∪ existing customers
                                └─ dedupe plan (hash of phone|type|paise|date|note)
                                      └─ atomic commit (customers + entries in one store update)
```

**Nothing is written until the whole payload validates.** Errors carry a path such as `entries[12].amount`.

---

## 3. Internal Entity Model

Money is stored as **integer paise**. Dates are **date-only strings**. Timestamps are epoch milliseconds.

### 3.1 Customer

```ts
interface Customer {
  id: string;        // "cus_" + uuid v4 (no dashes) — stable, unique, never derived from phone
  name: string;      // 1..80 chars, trimmed, UTF-8 (Devanagari/Telugu/emoji safe)
  phone: string;     // exactly 10 ASCII digits, unique across customers
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}
```

| Rule | Enforcement |
|---|---|
| `id` unique | generated with `crypto.randomUUID()`; fallback counter+timestamp for old browsers; a `Set` guard on insert |
| `phone` unique | checked on add, edit (excluding self), import (first wins, duplicates reported), restore (snapshot rejected if duplicated) |
| `phone` format | exactly 10 ASCII digits (`/^\d{10}$/`). Landline-style and legacy numbers are not silently rejected because a shop's real history must import cleanly |
| No orphans | deleting a customer cascades its transactions |

> Design note: the phone is the *business* key used by the import format, while `id` is the *storage* key. This decoupling lets the owner correct a phone number without rewriting ledger history, and lets imports match on phone exactly as the source file dictates.

### 3.2 Transaction

```ts
interface Transaction {
  id: string;             // "txn_" + uuid v4
  customerId: string;     // FK → Customer.id (validated on write and on load)
  type: 'credit' | 'payment';
  amountPaise: number;    // integer > 0, ≤ 10^10 paise (₹10 crore)
  date: string;           // "YYYY-MM-DD", local shop date, never a Date object
  note: string;           // "" allowed, ≤ 200 chars
  screenshotId: string | null; // FK → IndexedDB screenshots.id
  createdAt: number;      // epoch ms — tiebreaker for same-date ordering
  updatedAt: number;      // epoch ms
  importHash?: string;    // deterministic dedupe fingerprint (imported records only)
}
```

`importHash = fnv1a(phone + '|' + type + '|' + amountPaise + '|' + date + '|' + normalise(note))`

**Opening balance.** When an owner migrates from a paper book, the optional opening balance is written as a normal `credit` transaction (note "Opening balance", date = creation day) in the same atomic write as the customer. No schema variant exists, and the entry can be edited or deleted like any other.

Storing the hash on the record makes re-import idempotent and O(1) per row, with no rescanning of notes.

### 3.3 Screenshot (IndexedDB)

```ts
interface ScreenshotRecord {
  id: string;      // "shot_" + uuid  (keyPath)
  blob: Blob;      // image/jpeg | image/png | image/webp, ≤ 5 MB after downscale
  mime: string;
  size: number;    // bytes
  createdAt: number;
  width?: number;
  height?: number;
}
```

Database `hisaab-shots`, version 1, object store `screenshots`, keyPath `id`, no indexes required (lookup is by primary key).

### 3.4 Settings

```ts
interface Settings {
  shopName: string;                 // default "My Shop", ≤ 60 chars
  upiId: string;                    // "" or /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/
  language: 'en' | 'hi' | 'te';     // default "en"
  theme: 'light' | 'dark' | 'system'; // default "system"
  overdueDays: number;              // default 30, range 1..365
  maskPhones: boolean;              // default true — privacy on shared counters
}
```

---

## 4. Physical Schema — localStorage

Every key is an envelope so migrations and corruption detection are possible.

```jsonc
// hisaab:v1:customers
{ "version": 1, "savedAt": 1763635200000, "data": [ /* Customer[] */ ] }

// hisaab:v1:transactions
{ "version": 1, "savedAt": 1763635200000, "data": [ /* Transaction[] */ ] }

// hisaab:v1:settings
{ "version": 1, "savedAt": 1763635200000, "data": { /* Settings */ } }

// hisaab:v1:quarantine:1763635200000
"<raw corrupt string, exactly as found>"
```

| Property | Decision |
|---|---|
| Approx. size | ~180 bytes/customer, ~220 bytes/transaction → 5,000 txns ≈ 1.1 MB, well inside the 5 MB budget |
| Write unit | whole collection (simple, atomic per key); acceptable at this scale |
| Corruption | raw string copied to quarantine, original preserved, defaults used, banner shown |
| Versioning | `version` field; `migrate()` hook for v2 |
| Cross-tab | `storage` event → re-hydrate |

**Why screenshots are not in localStorage:** base64 inflates bytes by ~33%, a single phone screenshot can be 2–4 MB, and localStorage is synchronous — the UI would jank. IndexedDB stores `Blob`s natively and asynchronously.

---

## 5. Relationships and Integrity

```
Customer (1) ──────< Transaction (N)        ON DELETE CASCADE
Transaction (0..1) ── Screenshot            ON DELETE SET NULL → blob removed
```

Integrity checks performed:

| Check | When | Failure behaviour |
|---|---|---|
| `transaction.customerId` exists | add / edit / load / import / restore | reject write; on load, orphan is quarantined and reported |
| `customer.phone` unique | add / edit / import / restore | reject |
| `amountPaise` integer > 0 | every write | reject |
| `date` is a real calendar date | every write | reject |
| `screenshotId` resolves | render | placeholder "image unavailable", no crash |
| Sum invariants | derived | recomputed, never read from storage |

---

## 6. Derived Data (not persisted)

```ts
interface CustomerTotals {
  creditPaise: number;
  paymentPaise: number;
  balancePaise: number;   // credit - payment  (may be 0 or negative)
  lastPaymentDate: string | null;
  lastActivityAt: number | null;
  firstCreditDate: string | null;
  txCount: number;
}
```

Built once per `transactions` change via `buildTotalsIndex(transactions)` → `Map<customerId, CustomerTotals>`.

Shop aggregates: `totalOutstanding`, `totalCredit`, `totalPayments`, `customersWithDues`, `overdueCount`.

---

## 7. Backup Format

```jsonc
{
  "app": "hisaab",
  "format": "hisaab.backup",
  "version": 1,
  "exportedAt": "2026-11-20T10:00:00.000Z",
  "settings": { /* Settings */ },
  "customers": [ /* Customer[] with ids */ ],
  "transactions": [ /* Transaction[] with ids */ ],
  "note": "Screenshots are stored separately in this browser and are not included."
}
```

Restore validates: `app === "hisaab"`, version supported, arrays present, ids unique, phones unique, every `customerId` resolves, every amount integer > 0. It then replaces state **only after** the user confirms the destructive step.

---

## 8. Data Lifecycle

| Event | localStorage | IndexedDB |
|---|---|---|
| Add customer | write customers | — |
| Add transaction (+shot) | write transactions | put blob, then reference |
| Edit transaction | rewrite affected record | add/remove blob if changed |
| Delete transaction | remove record | delete blob if it was the only reference |
| Delete customer | remove customer + all its transactions | delete all their blobs |
| Import | one atomic rewrite of customers + transactions | — |
| Restore backup | replace both collections | blobs untouched (documented) |
| Reset all | remove all `hisaab:v1:*` keys | `clear()` the screenshots store |

---

## 9. Capacity Planning

| Item | Per record | 1,000 | 10,000 |
|---|---|---|---|
| Customer JSON | ~180 B | 180 KB | 1.8 MB |
| Transaction JSON | ~220 B | 220 KB | 2.2 MB |
| Screenshot (downscaled JPEG) | ~120 KB | 120 MB | 1.2 GB |

localStorage is adequate to ~10k transactions. IndexedDB is the real limit for images; the UI warns at 80% of the estimated quota via `navigator.storage.estimate()` and recommends a backup + pruning.

---

## 10. Selection Rationale

| Alternative | Rejected because |
|---|---|
| Single JSON blob in localStorage | One corrupt byte loses everything; no partial recovery |
| SQLite via WASM | 1 MB+ payload, worker complexity, no benefit at this scale |
| IndexedDB for everything | Async reads complicate first paint; localStorage is fine for < 5 MB text |
| Base64 screenshots in localStorage | 33% bloat, synchronous, quota blowout |
| Storing balances | Guarantees eventual inconsistency with the ledger |
