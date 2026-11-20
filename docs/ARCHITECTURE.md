# HISAAB — Technical Architecture

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | 2026-11-20 |
| Related | `PRD.md`, `DATABASE_DESIGN.md`, `IMPLEMENTATION_PLAN.md` |

---

## 1. Architectural Drivers

| Driver | Consequence |
|---|---|
| Zero backend, zero cost, zero API keys | Static SPA; all logic client-side |
| Must survive refresh | localStorage for structured data, IndexedDB for blobs |
| Non-technical, mobile-first users | One-thumb navigation, large touch targets, inline forms |
| Money must never be wrong | Integer paise, pure functions, no persisted balances |
| Must be demonstrable offline | No runtime network dependency at all |
| Automated tester needs stable hooks | Documented selector contract frozen in `docs/QA_TEST_PLAN.md` |
| Must be sellable | Premium visual system, light/dark, three languages |

---

## 2. Stack Decision Record

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| UI runtime | React | 18.3 | Required; concurrent rendering, hooks |
| Build | Vite | 5 | Required; instant HMR, tiny config, static output |
| Language | TypeScript | 5.6 (strict) | Required; money/date correctness needs types |
| Styling | Tailwind CSS | 3.4 | Required; design-token-first, no runtime CSS-in-JS |
| Icons | lucide-react | 0.4xx | Required; consistent stroke icons |
| State | Zustand | 5 | Allowed alternative to Context; external store is trivially testable and avoids provider nesting |
| Structured storage | localStorage | native | Required; synchronous, simple, 5 MB is ample for text ledgers |
| Binary storage | IndexedDB | native | Required; screenshots exceed localStorage limits |
| Tests | Vitest + RTL | 2.1 / 16 | Required; Vite-native, jsdom |
| Routing | Custom hash router (~60 LOC) | — | Avoids a dependency for 5 routes; preserves `?today=` in the real query string |

**Rejected:** Supabase/Firebase/Postgres/Mongo (forbidden), React Router (not needed), Redux (overkill), Tesseract.js by default (heavy; see §9), any analytics SDK (privacy).

---

## 3. System Context

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (owner's phone)               │
│                                                              │
│  ┌────────────┐   ┌──────────────┐   ┌───────────────────┐  │
│  │  React UI  │──▶│  Zustand     │──▶│  Domain layer     │  │
│  │  (pages,   │◀──│  store       │   │  balance, validate│  │
│  │  components)│   │  (state +    │   │  import, csv,     │  │
│  └────────────┘   │   actions)   │   │  whatsapp, upi    │  │
│         │         └──────┬───────┘   └───────────────────┘  │
│         │                │                                   │
│         ▼                ▼                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ IndexedDB    │  │ localStorage   │  │ Blob URLs       │  │
│  │ hisaab-shots │  │ hisaab:v1:*    │  │ (runtime only)  │  │
│  └──────────────┘  └────────────────┘  └─────────────────┘  │
│                                                              │
│  Outbound (user-initiated links only):                       │
│    wa.me/91…  ·  upi://pay?…                                 │
└──────────────────────────────────────────────────────────────┘
```

No HTTP calls are made by the application at runtime. Deployment serves static files only.

---

## 4. Layered Design

```
src/
├── types.ts                 # Shared domain types (Customer, Transaction, Settings)
├── lib/                     # Pure, framework-free domain logic (100% unit-testable)
│   ├── money.ts             # rupees ⇄ paise, INR formatting, parsing
│   ├── dates.ts             # local-date arithmetic, YYYY-MM-DD, day diffs
│   ├── validate.ts          # name/phone/amount/note/date/upi validators
│   ├── balance.ts           # balance projection, shop totals, overdue ranking
│   ├── whatsapp.ts          # wa.me link builder + localised message
│   ├── upi.ts               # upi:// intent builder
│   ├── csv.ts               # CSV serialisation + formula-injection guard
│   ├── jsonImport.ts        # schema validation, normalisation, dedupe planning
│   └── backup.ts            # full JSON snapshot / restore validation
├── services/                # Side-effecting adapters (the only place I/O lives)
│   ├── storage.ts           # localStorage repo, corruption quarantine, versioning
│   ├── screenshots.ts       # IndexedDB blobs, downscale, object URLs
│   └── download.ts          # Blob download helper
├── store/
│   └── useStore.ts          # Zustand store: state + actions + persistence effects
├── i18n/
│   ├── index.ts             # t(), language detection, interpolation
│   └── locales/{en,hi,te}.ts
├── context/
│   └── TodayContext.tsx     # "today" from ?today= or device clock
├── components/              # Presentational + local interaction components
├── pages/                   # Route-level screens
├── router.tsx               # Hash router + route parsing
├── App.tsx                  # Shell: sidebar/bottom-nav, toasts, banners
└── main.tsx                 # Bootstrap
```

### Dependency rule (enforced by review)
`pages → components → store → services → lib → types`.
`lib/` never imports React, the store, or services. This is what makes the money math provable in unit tests.

---

## 5. State Model

```ts
interface AppState {
  customers: Customer[];        // persisted
  transactions: Transaction[];  // persisted
  settings: Settings;           // persisted
  storageWarning: string | null; // runtime
  toasts: Toast[];              // runtime
  hydrated: boolean;            // runtime
}
```

Derived data is **never stored**:

```ts
const balances = useMemo(
  () => buildBalanceIndex(transactions), // Map<customerId, Totals>
  [transactions],
);
```

Consequences:
- Adding/editing/deleting a transaction automatically updates every surface.
- Import cannot introduce a wrong balance, because no balance is imported.
- Tests can recompute expected values independently.

### Store actions (all return a `Result<T>`)

| Action | Effect |
|---|---|
| `addCustomer` | validate → uniqueness → insert → persist → toast |
| `updateCustomer` | validate → uniqueness excluding self → update → persist |
| `deleteCustomer` | cascade transactions + screenshots → persist |
| `addTransaction` | validate → verify customer exists → insert → persist |
| `updateTransaction` | validate → update → persist |
| `deleteTransaction` | delete + delete screenshot if unreferenced → persist |
| `importParsed` | atomic apply of a validated plan → persist |
| `updateSettings` | merge + persist + apply theme/lang |
| `restoreBackup` | validate snapshot → replace after confirmation |
| `resetAll` | explicit destructive action, double-confirmed |

---

## 6. Persistence Design

### Key space

| Key | Store | Payload |
|---|---|---|
| `hisaab:v1:customers` | localStorage | `{ version: 1, data: Customer[] }` |
| `hisaab:v1:transactions` | localStorage | `{ version: 1, data: Transaction[] }` |
| `hisaab:v1:settings` | localStorage | `{ version: 1, data: Settings }` |
| `hisaab:v1:quarantine:<ts>` | localStorage | raw corrupt string |
| DB `hisaab-shots`, store `screenshots` | IndexedDB | `{ id, blob, mime, size, createdAt }` |

### Write policy
Every mutation writes the whole affected collection inside a `try/catch`. On `QuotaExceededError` the store **keeps the in-memory change**, surfaces a persistent error toast, and never truncates data silently.

### Read policy (boot)
1. Read each key. Missing → defaults.
2. Parse. If `JSON.parse` fails **or** the envelope shape is wrong → copy the raw string to `hisaab:v1:quarantine:<ts>`, leave the original key untouched, start from defaults, set `storageWarning`.
3. Validate each record; drop records that fail with a warning listing the count (never silently: the quarantine copy plus banner makes it visible).
4. On success, clear `storageWarning`.

### Migration
`version` in every envelope. `migrate(envelope)` is a no-op for v1 but is the single place to add v2 transforms.

### Multi-tab
`window.addEventListener('storage')` → re-hydrate from storage and show a toast ("Updated from another tab"). Last write wins; documented.

---

## 7. Routing Contract

Custom hash router. Routes:

| Hash | Screen |
|---|---|
| `#/` | Dashboard |
| `#/customer/:id` | Customer detail |
| `#/overdue` | Overdue list |
| `#/import` | Import / export |
| `#/settings` | Settings |

`?today=YYYY-MM-DD` is read from `window.location.search` at boot and stored in `TodayContext`. Hash navigation never mutates the query string, so the override survives all in-app navigation.

---

## 8. Money and Date Correctness

### Money
- Input strings are parsed with a strict regex (`^\d{1,3}(,\d{2,3})*(\.\d{1,2})?$` after trimming `₹` and spaces).
- Converted with `Math.round(rupees * 100)` **once**, then all arithmetic is integer.
- No `toFixed` in the math path; only in formatting.
- Formatting uses `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' })` on `paise / 100`, plus a compact form (₹11.8K) for stat cards.

### Dates
- Transaction dates are **date-only strings**, never `Date` objects in storage — this eliminates timezone shifts.
- Helpers use `new Date(y, m-1, d)` (local) for arithmetic on parsed Y/M/D, and never `toISOString()`.
- `todayISO()` builds `YYYY-MM-DD` from local getters.
- `?today=` is validated with a calendar check (rejects `2026-02-30`).

---

## 9. Optional OCR Design

`services/ocr.ts` exposes:

```ts
suggestAmountFromImage(file: File): Promise<OcrSuggestion | null>
```

- Primary path: dynamic `import(/* @vite-ignore */ 'tesseract.js')` if the owner/developer adds the optional package. It is **not** bundled by default, so the product stays dependency-light and offline-safe.
- Fallback: a deterministic heuristic that scans the filename for a rupee amount and returns a *suggestion*.
- The UI shows "Suggested amount ₹X — confirm" and only fills the amount field after the user accepts. There is no code path from OCR to a saved transaction.

---

## 10. UI Architecture

- **Shell:** fixed left sidebar ≥ 1024 px; sticky top bar + 4-item bottom tab bar below 1024 px.
- **Design tokens** in CSS variables (`--bg`, `--surface`, `--accent`, `--muted`, `--border`, `--danger`, `--shadow`) consumed by Tailwind `theme.extend.colors`; `.dark` class toggled on `<html>`.
- **Accent:** deep emerald (`#0E7C5A` light / `#2FD49A` dark) with a warm sand neutral ramp — deliberately Indian fintech, not generic SaaS blue.
- **Components:** `StatCard`, `CustomerRow`, `BalancePill`, `EmptyState`, `Modal`, `Toast`, `ConfirmDialog`, `AmountInput`, `SegmentedControl`, `Switch`, `SearchField`, `Sparkline` (CSS-only).
- **Accessibility:** every dialog traps focus and restores it; toasts are `role="status"`; destructive actions live behind `ConfirmDialog` with the entity named.

---

## 11. Selector Contract (frozen)

These are public API for automated testing and must never be renamed:

| Selector | Element | Data source |
|---|---|---|
| `#total-outstanding` | element whose text is the shop total | Σ customer balances |
| `[data-customer="<phone>"]` | clickable customer row/link | customer list |
| `[data-balance]` | balance value element | computed balance |
| `a[data-remind="<phone>"]` | WhatsApp anchor | `buildWhatsAppLink` |
| `#import-box` | import textarea | user input |
| `#import-go` | import submit button | triggers import |
| `#shot-input` | file input for screenshots | form |
| `img[data-shot]` | stored screenshot image | IndexedDB blob URL |

---

## 12. Error Handling Strategy

| Layer | Strategy |
|---|---|
| Domain | Return `Result<{ok:false, errors}>`; never throw for validation |
| Services | Throw typed errors (`StorageQuotaError`, `CorruptDataError`); caught at store boundary |
| Store | Convert errors to user-readable toasts; preserve in-memory state |
| UI | Form-level inline errors; boundary-level `ErrorBoundary` with "Export your data" fallback |
| Import | All-or-nothing; errors carry a JSON path |

---

## 13. Performance Strategy

- Derived balances memoised on `transactions` identity.
- Customer search debounced 120 ms; matching is a linear scan (fast enough for 5k customers).
- Screenshot object URLs cached in a `Map` and revoked on unmount to avoid leaks.
- Route-level components are not lazy-loaded (5 small screens; one bundle is faster offline).
- Import runs in one synchronous pass with a pre-built `Map`, O(n).

---

## 14. Testing Strategy

| Layer | Tool | Focus |
|---|---|---|
| Domain | Vitest | balance engine, parsing, validation, CSV, links, dates — exact sample reconciliation |
| Services | Vitest + fake-indexeddb | persistence round-trip, corruption quarantine, screenshot CRUD |
| Store | Vitest | action contracts, atomic import, cascade delete |
| UI | RTL + user-event | selectors, add payment flow, screenshot persistence, language switch, import flow |
| Manual | `QA_TEST_PLAN.md` | mobile layout, real Chrome device, WhatsApp deep link |

---

## 15. Deployment Architecture

Static assets only. `vite build` → `dist/` (`index.html`, hashed JS/CSS, icons).

- **Vercel:** framework preset Vite, build `npm run build`, output `dist`, SPA rewrite to `/index.html`.
- **Netlify:** `netlify.toml` with `publish = "dist"` and a `/* → /index.html 200` redirect.
- No environment variables. No server. No secrets.

---

## 16. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| User clears browser data | Medium | High | Backup/restore + explicit warnings in Settings and onboarding |
| localStorage quota exhausted | Low | High | Text-only in localStorage, images in IDB, quota error handling |
| IndexedDB blocked in private mode | Medium | Medium | Graceful degradation; ledger unaffected |
| Float rounding bugs | Medium | High | Integer paise + property tests |
| Import corrupts data | Low | High | Validate-then-commit, atomic apply, idempotent dedupe |
| Timezone date drift | Medium | Medium | Date-only strings, local constructors only |
| Selector rename breaks graders | Low | High | Frozen contract + tests asserting each selector |
| Over-scoping UI | Medium | Medium | Ship the 5 screens in the plan; polish over features |
