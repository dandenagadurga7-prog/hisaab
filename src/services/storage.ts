import type { Customer, Settings, Transaction } from '@/types';
import { DEFAULT_SETTINGS, normalizeSettings } from '@/lib/defaults';
import { isValidISODate } from '@/lib/dates';

export const STORAGE_VERSION = 1;
export const STORAGE_NAMESPACE = 'hisaab:v1';

export const STORAGE_KEYS = {
  customers: `${STORAGE_NAMESPACE}:customers`,
  transactions: `${STORAGE_NAMESPACE}:transactions`,
  settings: `${STORAGE_NAMESPACE}:settings`,
} as const;

export interface Envelope<T> {
  version: number;
  savedAt: number;
  data: T;
}

export interface LoadResult<T> {
  data: T[];
  corrupted: boolean;
  dropped: number;
  message: string | null;
}

export type SaveResult = { ok: true } | { ok: false; code: 'quota' | 'unavailable' | 'unknown' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStorageAvailable(): boolean {
  try {
    const probe = `${STORAGE_NAMESPACE}:probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Copies a corrupt raw value to a quarantine key so nothing is ever destroyed. */
export function quarantine(key: string, raw: string): void {
  try {
    const label = key.split(':').pop() ?? 'data';
    window.localStorage.setItem(`${STORAGE_NAMESPACE}:quarantine:${label}:${Date.now()}`, raw);
  } catch {
    /* quarantine is best effort; the original key is still untouched */
  }
}

function readEnvelope(key: string): {
  state: 'missing' | 'corrupt' | 'ok';
  data?: unknown;
  raw?: string;
  message?: string;
} {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: 'corrupt', message: 'Browser storage is unavailable.' };
  }
  if (raw === null) return { state: 'missing' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(key, raw);
    return {
      state: 'corrupt',
      raw,
      message: 'Saved data could not be read. A copy was preserved for recovery.',
    };
  }

  if (!isRecord(parsed) || !('data' in parsed)) {
    quarantine(key, raw);
    return {
      state: 'corrupt',
      raw,
      message: 'Saved data had an unexpected shape. A copy was preserved for recovery.',
    };
  }
  const version = typeof parsed.version === 'number' ? parsed.version : STORAGE_VERSION;
  if (version > STORAGE_VERSION) {
    return {
      state: 'corrupt',
      message: 'This data was saved by a newer version of Hisaab.',
    };
  }
  return { state: 'ok', data: parsed.data };
}

function isCustomer(value: unknown): value is Customer {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.phone === 'string' &&
    /^\d{10}$/.test(value.phone)
  );
}

function normalizeCustomer(value: Record<string, unknown>): Customer {
  const now = Date.now();
  return {
    id: String(value.id),
    name: String(value.name).trim().slice(0, 80),
    phone: String(value.phone),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  };
}

function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.customerId === 'string' &&
    value.customerId.length > 0 &&
    (value.type === 'credit' || value.type === 'payment') &&
    typeof value.amountPaise === 'number' &&
    Number.isInteger(value.amountPaise) &&
    value.amountPaise > 0 &&
    typeof value.date === 'string' &&
    isValidISODate(value.date)
  );
}

function normalizeTransaction(value: Record<string, unknown>): Transaction {
  const now = Date.now();
  return {
    id: String(value.id),
    customerId: String(value.customerId),
    type: value.type === 'payment' ? 'payment' : 'credit',
    amountPaise: Math.trunc(Number(value.amountPaise)),
    date: String(value.date),
    note: typeof value.note === 'string' ? value.note.slice(0, 200) : '',
    screenshotId: typeof value.screenshotId === 'string' ? value.screenshotId : null,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
    importHash: typeof value.importHash === 'string' ? value.importHash : undefined,
  };
}

export function loadCustomers(): LoadResult<Customer> {
  const read = readEnvelope(STORAGE_KEYS.customers);
  if (read.state === 'missing') return { data: [], corrupted: false, dropped: 0, message: null };
  if (read.state === 'corrupt') {
    return { data: [], corrupted: true, dropped: 0, message: read.message ?? 'Data problem.' };
  }
  if (!Array.isArray(read.data)) {
    return {
      data: [],
      corrupted: true,
      dropped: 0,
      message: 'Customer data had an unexpected shape.',
    };
  }

  const seenPhones = new Set<string>();
  const seenIds = new Set<string>();
  const customers: Customer[] = [];
  let dropped = 0;

  for (const item of read.data) {
    if (!isCustomer(item) || seenIds.has(item.id) || seenPhones.has(item.phone)) {
      dropped += 1;
      continue;
    }
    const customer = normalizeCustomer(item as unknown as Record<string, unknown>);
    seenIds.add(customer.id);
    seenPhones.add(customer.phone);
    customers.push(customer);
  }

  return {
    data: customers,
    corrupted: dropped > 0,
    dropped,
    message:
      dropped > 0
        ? `${dropped} customer record${dropped === 1 ? '' : 's'} could not be read and were skipped.`
        : null,
  };
}

export function loadTransactions(): LoadResult<Transaction> {
  const read = readEnvelope(STORAGE_KEYS.transactions);
  if (read.state === 'missing') return { data: [], corrupted: false, dropped: 0, message: null };
  if (read.state === 'corrupt') {
    return { data: [], corrupted: true, dropped: 0, message: read.message ?? 'Data problem.' };
  }
  if (!Array.isArray(read.data)) {
    return {
      data: [],
      corrupted: true,
      dropped: 0,
      message: 'Transaction data had an unexpected shape.',
    };
  }

  const seenIds = new Set<string>();
  const transactions: Transaction[] = [];
  let dropped = 0;

  for (const item of read.data) {
    if (!isTransaction(item) || seenIds.has(item.id)) {
      dropped += 1;
      continue;
    }
    const tx = normalizeTransaction(item as unknown as Record<string, unknown>);
    seenIds.add(tx.id);
    transactions.push(tx);
  }

  return {
    data: transactions,
    corrupted: dropped > 0,
    dropped,
    message:
      dropped > 0
        ? `${dropped} ledger entr${dropped === 1 ? 'y' : 'ies'} could not be read and were skipped.`
        : null,
  };
}

export function loadSettings(): { data: Settings; corrupted: boolean; message: string | null } {
  const read = readEnvelope(STORAGE_KEYS.settings);
  if (read.state === 'missing') return { data: { ...DEFAULT_SETTINGS }, corrupted: false, message: null };
  if (read.state === 'corrupt') {
    return {
      data: { ...DEFAULT_SETTINGS },
      corrupted: true,
      message: read.message ?? 'Settings could not be read; defaults were restored.',
    };
  }
  return { data: normalizeSettings(read.data), corrupted: false, message: null };
}

function classifyError(error: unknown): SaveResult {
  if (error instanceof DOMException) {
    if (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    ) {
      return { ok: false, code: 'quota' };
    }
  }
  if (error instanceof Error && /quota/i.test(error.message)) {
    return { ok: false, code: 'quota' };
  }
  return { ok: false, code: 'unknown' };
}

function writeEnvelope(key: string, data: unknown): SaveResult {
  try {
    const envelope: Envelope<unknown> = {
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      data,
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && /SecurityError|denied|not available/i.test(error.message)) {
      return { ok: false, code: 'unavailable' };
    }
    return classifyError(error);
  }
}

export function saveCustomers(customers: Customer[]): SaveResult {
  return writeEnvelope(STORAGE_KEYS.customers, customers);
}

export function saveTransactions(transactions: Transaction[]): SaveResult {
  return writeEnvelope(STORAGE_KEYS.transactions, transactions);
}

export function saveSettings(settings: Settings): SaveResult {
  return writeEnvelope(STORAGE_KEYS.settings, settings);
}

/** Approximate bytes used by Hisaab keys, for the Settings storage panel. */
export function storageFootprint(): { customers: number; transactions: number; total: number } {
  const sizeOf = (key: string): number => {
    try {
      return (window.localStorage.getItem(key) ?? '').length;
    } catch {
      return 0;
    }
  };
  const customers = sizeOf(STORAGE_KEYS.customers);
  const transactions = sizeOf(STORAGE_KEYS.transactions);
  return { customers, transactions, total: customers + transactions };
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Explicit user action only — never called automatically. */
export function clearStoredData(): void {
  removeKey(STORAGE_KEYS.customers);
  removeKey(STORAGE_KEYS.transactions);
  removeKey(STORAGE_KEYS.settings);
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_NAMESPACE)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Subscribes to changes made by another tab. Returns an unsubscribe function. */
export function onExternalStorageChange(callback: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(STORAGE_NAMESPACE)) callback();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
