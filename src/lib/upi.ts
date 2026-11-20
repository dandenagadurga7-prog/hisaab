import { paiseToDecimalString } from './money';

export interface UpiLinkInput {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  note?: string;
}

/**
 * Builds a standard UPI deep link. The customer's own UPI app opens with the
 * amount prefilled — Hisaab never handles money and never sees a payment.
 */
export function buildUpiLink({ upiId, payeeName, amountPaise, note }: UpiLinkInput): string | null {
  const pa = upiId.trim();
  if (!pa) return null;
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return null;

  const params = new URLSearchParams({
    pa,
    pn: payeeName.trim() || 'Shop',
    am: paiseToDecimalString(amountPaise),
    cu: 'INR',
  });
  if (note && note.trim()) params.set('tn', note.trim().slice(0, 50));

  return `upi://pay?${params.toString()}`;
}
