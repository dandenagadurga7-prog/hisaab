import type { Customer, Settings, Transaction } from '@/types';
import { isValidISODate } from './dates';
import { normalizeSettings } from './defaults';
import { createId } from './id';

export const BACKUP_FORMAT = 'hisaab.backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'hisaab';
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  customers: Customer[];
  transactions: Transaction[];
  note: string;
}

export interface BackupContents {
  settings: Settings;
  customers: Customer[];
  transactions: Transaction[];
}

export function buildBackup(
  settings: Settings,
  customers: Customer[],
  transactions: Transaction[],
): BackupFile {
  return {
    app: 'hisaab',
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    customers,
    transactions,
    note: 'Payment screenshots are stored separately in this browser and are not included in this backup.',
  };
}

export type BackupParseResult =
  | { ok: true; value: BackupContents }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a backup before it can replace anything. Restore is destructive, so
 * every relationship and amount is checked up front.
 */
export function parseBackup(rawText: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    return {
      ok: false,
      errors: [
        `Not valid JSON: ${error instanceof Error ? error.message : 'unable to parse the file'}`,
      ],
    };
  }
  if (!isRecord(parsed)) return { ok: false, errors: ['Backup root must be a JSON object.'] };
  if (parsed.app !== 'hisaab' || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['This file is not a Hisaab backup.'] };
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    return {
      ok: false,
      errors: ['This backup was made by a newer version of Hisaab and cannot be restored here.'],
    };
  }

  const errors: string[] = [];
  const rawCustomers = parsed.customers;
  const rawTransactions = parsed.transactions;
  if (!Array.isArray(rawCustomers)) errors.push('`customers` is missing or not an array.');
  if (!Array.isArray(rawTransactions)) errors.push('`transactions` is missing or not an array.');
  if (errors.length > 0) return { ok: false, errors };

  const customers: Customer[] = [];
  const ids = new Set<string>();
  const phones = new Set<string>();

  (rawCustomers as unknown[]).forEach((raw, index) => {
    const path = `customers[${index}]`;
    if (!isRecord(raw)) {
      errors.push(`${path} is not an object.`);
      return;
    }
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
    if (!name) errors.push(`${path}.name is empty.`);
    if (!/^\d{10}$/.test(phone)) errors.push(`${path}.phone is not 10 digits.`);
    if (phones.has(phone)) errors.push(`${path}.phone duplicates ${phone}.`);
    const id = typeof raw.id === 'string' && raw.id ? raw.id : createId('cus');
    if (ids.has(id)) errors.push(`${path}.id is duplicated.`);
    if (name && /^\d{10}$/.test(phone)) {
      ids.add(id);
      phones.add(phone);
      customers.push({
        id,
        name,
        phone,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      });
    }
  });

  const transactions: Transaction[] = [];
  const txIds = new Set<string>();
  (rawTransactions as unknown[]).forEach((raw, index) => {
    const path = `transactions[${index}]`;
    if (!isRecord(raw)) {
      errors.push(`${path} is not an object.`);
      return;
    }
    const id = typeof raw.id === 'string' && raw.id ? raw.id : createId('txn');
    if (txIds.has(id)) errors.push(`${path}.id is duplicated.`);
    const customerId = typeof raw.customerId === 'string' ? raw.customerId : '';
    if (!ids.has(customerId)) errors.push(`${path}.customerId does not match any customer.`);
    const type = raw.type;
    if (type !== 'credit' && type !== 'payment') errors.push(`${path}.type is invalid.`);
    const amountPaise = raw.amountPaise;
    if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise <= 0) {
      errors.push(`${path}.amountPaise must be a positive integer.`);
    }
    const date = typeof raw.date === 'string' ? raw.date : '';
    if (!isValidISODate(date)) errors.push(`${path}.date is not a valid date.`);
    const screenshotId =
      typeof raw.screenshotId === 'string' && raw.screenshotId ? raw.screenshotId : null;

    if ((type === 'credit' || type === 'payment') && typeof amountPaise === 'number') {
      txIds.add(id);
      transactions.push({
        id,
        customerId,
        type,
        amountPaise,
        date,
        note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '',
        screenshotId,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
        importHash: typeof raw.importHash === 'string' ? raw.importHash : undefined,
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 40) };

  return {
    ok: true,
    value: {
      settings: normalizeSettings(parsed.settings),
      customers,
      transactions,
    },
  };
}
