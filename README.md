# Hisaab — simple shop ledger

A notebook for a local shop: who owes what, a WhatsApp reminder in one tap. Plain HTML, CSS and JavaScript. No build step, no database, no AI. Data lives in the browser (`localStorage`).

## Live

https://dandenagadurga7-prog.github.io/hisaab/

## Run

Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Use

1. Press **Import**, paste the JSON from `sample-data.json`, press **Load JSON**.
2. The customer list shows each balance and the shop total at the top.
3. Press **WhatsApp** on a customer to open a reminder with the name and balance.
4. Press a customer to see entries newest first; add a credit/payment, attach a payment screenshot, edit or delete an entry.

The import box is always visible on the home screen so it can be filled without another click.

## Files

- `index.html` — markup and the required ids/selectors.
- `styles.css` — phone-first layout (works at 375 px).
- `app.js` — rendering, forms, routing, storage.
- `logic.js` — pure data helpers (import normalizer, balances, overdue, reminder link, CSV).
- `sample-data.json` — a made-up shop (5 customers, 8 entries, total Rs 11,820).
- `sample-expected.json` — the numbers to expect after loading the sample (`?today=2026-11-15`).
- `checks/` — logic check and a real-browser check (Chrome via `puppeteer-core`).

## Accepted import format

```
{
  "shop": "Shop name",
  "upi": "shop@upi",
  "customers": [{ "name": "Ravi", "phone": "9876543210" }],
  "entries": [
    { "phone": "9876543210", "type": "credit", "amount": 500, "date": "2026-11-01", "note": "Rice" },
    { "phone": "9876543210", "type": "payment", "amount": 200, "date": "2026-11-05", "note": "Cash" }
  ]
}
```

Also accepted: entries nested under each customer, a bare array of customers, a bare array of entries, and common field aliases (`mobile`, `kind`, `remarks`, `value`, dates as `DD/MM/YYYY` or `5 Nov 2026`). A type is `credit` (goods given) or `payment` (money received).

## Checks

```
npm install
npm run check        # logic + real browser (uses the installed Chrome)
```

`?today=YYYY-MM-DD` sets the date used for the entry form default and the overdue list.

## Limits

- Data is per browser and per device. Clearing site data removes it.
- Payment screenshots are compressed and stored with the entry; large numbers of photos can fill browser storage.
- "Read the amount from the screenshot" is not implemented — it needs OCR, and this app deliberately has no AI.
