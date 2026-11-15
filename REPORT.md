# REPORT — Hisaab

## Status per part
- Core (customers with 10-digit phone, credit/payment entries, per-customer balance, shop total, customer page newest first, WhatsApp reminder, screenshot on a payment, persistence, import box, 375 px): DONE
  evidence: `npm run check:logic` → `Hisaab logic: ok / customers=5 entries=8 total=Rs 11820`; `node checks/ui-check.js` → `Hisaab UI: ok` with every check `ok`.
- Bonus — overdue list sorted by days since last payment: DONE
  evidence: ui-check → `overdue first is the customer with no payment` (Anil Reddy); customers who never paid sort first.
- Bonus — edit and delete an entry with recalculation: DONE
  evidence: ui-check → `edit recalculates balance to 2850`, `delete recalculates balance back to 3000`.
- Bonus — CSV export: DONE
  evidence: logic-check builds the CSV and asserts `entries + 1` rows; the Export button downloads `hisaab.csv`.
- Bonus — search by name or phone: DONE
  evidence: ui-check → `search filters to one customer`.
- Bonus — UPI pay link in the reminder: DONE
  evidence: `logic.js upiLink()` appends `upi://pay?pa=…&am=…&cu=INR` to the reminder text; the customer page shows a Pay by UPI button when a UPI ID is set.
- Bonus — Hindi or Telugu labels: DONE
  evidence: ui-check → `Telugu labels apply`; the language select switches EN / हिंदी / తెలుగు.
- Bonus — reading the amount from the payment screenshot: NOT DONE (needs OCR; the brief says no AI).
- Requirement selectors: DONE
  evidence: ui-check → `#total-outstanding shows 11820`, `one row per customer (5)`, `WhatsApp reminder href`, `#import-box is visible`, `#shot-input is a file input`, `payment entry shows img[data-shot]`, `no sideways scroll at 375px`.

## What broke and how I fixed it
- The Import button did nothing: `.overlay { display:flex }` overrode the `hidden` attribute, so an invisible modal backdrop covered the page. Added `[hidden] { display:none !important }`.
- The shop name was cut to 42vw. Let it wrap; the full name now shows at 375 px.
- The language select took a full row. Moved it into the grid next to Settings.
- A missing favicon caused a 404 in the browser check. Added an inline SVG favicon (₹ mark).
- UTF-8 characters (₹, em dash, Hindi/Telugu) were corrupted by a PowerShell rewrite; the file was rewritten with the write tool.

## Claims ledger
- Sample total is 11,820 — `node checks/logic-check.js` prints `total=Rs 11820`.
- Each sample balance matches `sample-expected.json` — logic-check compares all five.
- Reminder href starts `https://wa.me/91<phone>?text=` — logic-check + ui-check assert it.
- Screenshot appears as `img[data-shot]` after saving a payment — ui-check waits for it and passes.
- 375 px and 1440 px have no sideways scroll — ui-check asserts `scrollWidth`.
- No console/page errors — ui-check asserts.
- Reading the amount from a screenshot — NOT IMPLEMENTED (stated in README).

## What I would tell the next person
- The import normalizer is deliberately forgiving; if the tester's sample uses a shape not covered, add an alias in `logic.js normalize()` and a case to `checks/logic-check.js`.
- The app is static; deploy the folder as-is (GitHub Pages / Vercel). No env vars, no secrets.
- Data is per browser. There is no server and no sync; that is intentional for this task.
- The browser check uses the locally installed Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`; change `CHROME` in `checks/ui-check.js` on another machine.
