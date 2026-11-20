import type { Language } from '@/types';
import { formatINR } from './money';

export interface ReminderInput {
  customerName: string;
  shopName: string;
  amountPaise: number;
  language?: Language;
}

/**
 * Builds the exact link structure required by the product brief:
 *   https://wa.me/91<phone>?text=<encoded-message>
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}

export function buildReminderMessage({
  customerName,
  shopName,
  amountPaise,
  language = 'en',
}: ReminderInput): string {
  const amount = formatINR(Math.abs(amountPaise));
  const shop = shopName.trim() || 'Hisaab';

  switch (language) {
    case 'hi':
      return [
        `नमस्ते ${customerName},`,
        '',
        `${shop} की ओर से विनम्र सूचना — आपका बकाया ${amount} है।`,
        '',
        'कृपया सुविधा अनुसार भुगतान कर दें। धन्यवाद।',
      ].join('\n');
    case 'te':
      return [
        `నమస్కారం ${customerName},`,
        '',
        `${shop} నుండి చిన్న గుర్తు చేయిక — మీ బాకీ ${amount}.`,
        '',
        'దయచేసి అనుకూలమైన సమయంలో చెల్లించండి. ధన్యవాదాలు.',
      ].join('\n');
    case 'en':
    default:
      return [
        `Namaste ${customerName},`,
        '',
        `This is a gentle reminder from ${shop}. Your outstanding balance is ${amount}.`,
        '',
        'Kindly settle it at your earliest convenience. Thank you.',
      ].join('\n');
  }
}

/** A reminder only makes sense when the customer actually owes money. */
export function canRemind(balancePaise: number): boolean {
  return balancePaise > 0;
}
