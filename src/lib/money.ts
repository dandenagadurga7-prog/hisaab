/** Money helpers. Every amount in the app is an integer number of paise. */

export const PAISE_PER_RUPEE = 100;
/** ₹1,00,00,000 — one crore. Anything above this is a typo. */
export const MAX_AMOUNT_PAISE = 10_000_000 * PAISE_PER_RUPEE;

const INR_PLAIN_WHOLE = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const INR_PLAIN_PAISE = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function groupedRupees(paise: number): string {
  const absolute = Math.abs(Math.round(paise));
  const formatter = absolute % 100 === 0 ? INR_PLAIN_WHOLE : INR_PLAIN_PAISE;
  return formatter.format(absolute / PAISE_PER_RUPEE);
}

export type ParsedAmount =
  | { ok: true; paise: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'zero' | 'too_large' };

/**
 * Parses human input ("₹1,250.50", "250", " 250.5 ") into integer paise.
 * Rejects negatives, zero, more than two decimals and absurd values.
 */
export function parseAmount(input: string): ParsedAmount {
  if (typeof input !== 'string') return { ok: false, reason: 'invalid' };
  let text = input
    .trim()
    .replace(/[\u20B9\uFFE6]/g, '')
    .replace(/[\s,]/g, '');

  if (text === '') return { ok: false, reason: 'empty' };
  if (text.startsWith('-')) return { ok: false, reason: 'invalid' };

  // Up to 12 integer digits, optional 1-2 decimal digits.
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, reason: 'invalid' };

  const whole = Number(match[1]);
  const fracRaw = match[2] ?? '';
  const frac = fracRaw === '' ? 0 : Number(fracRaw.padEnd(2, '0'));
  const paise = whole * PAISE_PER_RUPEE + frac;

  if (!Number.isSafeInteger(paise)) return { ok: false, reason: 'too_large' };
  if (paise === 0) return { ok: false, reason: 'zero' };
  if (paise > MAX_AMOUNT_PAISE) return { ok: false, reason: 'too_large' };
  return { ok: true, paise };
}

/**
 * Converts a JSON rupee number (as found in import files) to paise.
 * Values with more than 2 decimal places are rejected rather than rounded.
 */
export function rupeesToPaise(value: number): ParsedAmount {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, reason: 'invalid' };
  }
  if (value < 0) return { ok: false, reason: 'invalid' };
  if (value === 0) return { ok: false, reason: 'zero' };
  const scaled = value * PAISE_PER_RUPEE;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) return { ok: false, reason: 'invalid' };
  if (rounded > MAX_AMOUNT_PAISE) return { ok: false, reason: 'too_large' };
  return { ok: true, paise: rounded };
}

/** Full rupee value as a JS number (for display/interop only). */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / PAISE_PER_RUPEE;
}

/** "₹1,18,200" / "₹670.50" / "-₹1,260". */
export function formatINR(paise: number): string {
  const safe = Number.isFinite(paise) ? Math.round(paise) : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}₹${groupedRupees(safe)}`;
}

/** Plain grouped number without the currency symbol: "1,18,200.50". */
export function formatPlain(paise: number): string {
  const safe = Number.isFinite(paise) ? Math.round(paise) : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}${groupedRupees(safe)}`;
}

/** Compact display for stat cards: ₹11.8K, ₹1.2L, ₹2.4Cr. */
export function formatCompactINR(paise: number): string {
  const safe = Math.round(paise);
  const sign = safe < 0 ? '-' : '';
  const rupees = Math.abs(safe) / PAISE_PER_RUPEE;
  if (rupees >= 1_00_00_000) return `${sign}₹${trim(rupees / 1_00_00_000)}Cr`;
  if (rupees >= 1_00_000) return `${sign}₹${trim(rupees / 1_00_000)}L`;
  if (rupees >= 1_000) return `${sign}₹${trim(rupees / 1_000)}K`;
  return `${sign}₹${trim(rupees)}`;
}

function trim(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A decimal rupee string suitable for CSV and UPI intents: "670.00". */
export function paiseToDecimalString(paise: number): string {
  return (Math.round(paise) / PAISE_PER_RUPEE).toFixed(2);
}
