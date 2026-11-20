/**
 * Date helpers built exclusively on date-only strings (YYYY-MM-DD) and local
 * constructors. `Date#toISOString()` is never used for business dates because
 * it converts to UTC and can shift a date by one day in IST.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MAX_BACKDATE_YEARS = 10;

/** True only for a real calendar date such as 2026-11-15 (rejects 2026-02-30). */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function parts(iso: string): [number, number, number] {
  const match = ISO_DATE.exec(iso);
  if (!match) return [1970, 1, 1];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Local calendar date of `now` as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD string. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = parts(iso);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(
    base.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Whole days from `fromISO` to `toISO`. Negative when `toISO` is earlier. */
export function diffDays(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = parts(fromISO);
  const [ty, tm, td] = parts(toISO);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export type DateLocale = 'en' | 'hi' | 'te';

const LOCALES: Record<DateLocale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

export function formatDateLong(iso: string, locale: DateLocale = 'en'): string {
  if (!isValidISODate(iso)) return '—';
  const [year, month, day] = parts(iso);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(LOCALES[locale] ?? 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateShort(iso: string, locale: DateLocale = 'en'): string {
  if (!isValidISODate(iso)) return '—';
  const [year, month, day] = parts(iso);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(LOCALES[locale] ?? 'en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function formatWeekday(iso: string, locale: DateLocale = 'en'): string {
  if (!isValidISODate(iso)) return '';
  const [year, month, day] = parts(iso);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(LOCALES[locale] ?? 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatTimestamp(ms: number, locale: DateLocale = 'en'): string {
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat(LOCALES[locale] ?? 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

/**
 * Resolves the effective "today" from the app's query string.
 * `?today=2026-11-15` overrides the device clock; anything invalid is ignored.
 */
export function resolveToday(search: string, now: Date = new Date()): string {
  try {
    const params = new URLSearchParams(search);
    const override = params.get('today');
    if (override && isValidISODate(override)) return override;
  } catch {
    /* ignore malformed query strings */
  }
  return todayISO(now);
}

/** True when the date is within a sane window relative to `today`. */
export function isSaneDate(iso: string, today: string): boolean {
  if (!isValidISODate(iso)) return false;
  if (iso > today) return false;
  const [year] = parts(iso);
  const [todayYear] = parts(today);
  return year >= todayYear - MAX_BACKDATE_YEARS;
}
