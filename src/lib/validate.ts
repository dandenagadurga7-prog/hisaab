import type { FieldError, Result } from '@/types';
import { isValidISODate, diffDays } from './dates';

export const NAME_MAX = 80;
export const NOTE_MAX = 200;
export const SHOP_NAME_MAX = 60;

function fail<T>(field: string, code: FieldError['code']): Result<T> {
  return { ok: false, errors: [{ field, code }] };
}

/** Collapses runs of whitespace and trims. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Strips formatting and the Indian country code / trunk prefix so that
 * "+91 90000 00101", "090000 00101" and "9000000101" all normalise the same.
 */
export function normalizePhone(raw: string): string {
  if (typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function validatePhone(raw: string): Result<string> {
  const phone = normalizePhone(raw);
  if (!/^\d{10}$/.test(phone)) return fail('phone', 'phone_invalid');
  return { ok: true, value: phone };
}

export function validateName(raw: string): Result<string> {
  const name = normalizeWhitespace(typeof raw === 'string' ? raw : '');
  if (name.length === 0) return fail('name', 'name_required');
  if (name.length > NAME_MAX) return fail('name', 'name_too_long');
  return { ok: true, value: name };
}

export function validateNote(raw: string): Result<string> {
  const note = typeof raw === 'string' ? raw.trim() : '';
  if (note.length > NOTE_MAX) return fail('note', 'note_too_long');
  return { ok: true, value: note };
}

export function validateDate(iso: string, today: string): Result<string> {
  if (!isValidISODate(iso)) return fail('date', 'date_invalid');
  if (iso > today) return fail('date', 'date_future');
  if (diffDays(iso, today) > 365 * 10) return fail('date', 'date_too_old');
  return { ok: true, value: iso };
}

export function validateShopName(raw: string): Result<string> {
  const name = normalizeWhitespace(typeof raw === 'string' ? raw : '');
  if (name.length === 0) return fail('shopName', 'shop_required');
  if (name.length > SHOP_NAME_MAX) return fail('shopName', 'name_too_long');
  return { ok: true, value: name };
}

const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpi(raw: string): boolean {
  return UPI_PATTERN.test(raw.trim());
}

/** Empty is allowed (UPI links are optional); non-empty must look like a VPA. */
export function validateUpi(raw: string): Result<string> {
  const upi = typeof raw === 'string' ? raw.trim() : '';
  if (upi === '') return { ok: true, value: '' };
  if (!UPI_PATTERN.test(upi)) return fail('upiId', 'upi_invalid');
  return { ok: true, value: upi };
}

export function validateOverdueDays(value: number): Result<number> {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    return fail('overdueDays', 'amount_invalid');
  }
  return { ok: true, value };
}

export function isTransactionType(value: unknown): value is 'credit' | 'payment' {
  return value === 'credit' || value === 'payment';
}

/** Masks the middle of a phone number for list views: 90000••101. */
export function maskPhone(phone: string): string {
  if (phone.length !== 10) return phone;
  return `${phone.slice(0, 5)}\u2022\u2022${phone.slice(7)}`;
}

/** Two-letter avatar initials that work for Devanagari and Telugu names too. */
export function initialsOf(name: string): string {
  const words = normalizeWhitespace(name).split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const first = words[0] ?? '';
    return Array.from(first).slice(0, 2).join('').toUpperCase();
  }
  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  return `${Array.from(first)[0] ?? ''}${Array.from(last)[0] ?? ''}`.toUpperCase();
}
