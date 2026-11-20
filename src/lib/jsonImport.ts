import type { Customer, Transaction, TransactionType } from '@/types';
import { createId, fnv1a } from './id';
import { isValidISODate } from './dates';
import { rupeesToPaise } from './money';
import { isTransactionType, normalizePhone, normalizeWhitespace } from './validate';
import { NOTE_MAX } from './validate';

export interface ImportIssue {
  path: string;
  message: string;
}

export interface ImportWarning {
  path: string;
  message: string;
}

export interface ImportPlan {
  shopNameSuggestion: string | null;
  newCustomers: Customer[];
  newTransactions: Transaction[];
  /** Customers found in the payload that are new to this shop. */
  newCustomerCount: number;
  /** Customers in the payload who already exist here. */
  matchedCustomerCount: number;
  /** Valid entries in the payload. */
  entryCount: number;
  /** Entries skipped because an identical entry already exists. */
  duplicateEntries: number;
  /** Customers in the payload whose phone collided with an earlier row. */
  duplicateCustomers: number;
  /** Total distinct customers after the import. */
  resultingCustomerCount: number;
  /** Total entries after the import. */
  resultingEntryCount: number;
}

export type ImportParseResult =
  | { ok: true; plan: ImportPlan; warnings: ImportWarning[] }
  | { ok: false; errors: ImportIssue[] };

export interface ImportContext {
  existingCustomers: Customer[];
  existingTransactions: Transaction[];
  today: string;
  now?: number;
}

function normalizeNoteForHash(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The fingerprint that makes re-importing the same file a no-op. */
export function entryHash(
  phone: string,
  type: TransactionType,
  amountPaise: number,
  date: string,
  note: string,
): string {
  return fnv1a(`${phone}|${type}|${amountPaise}|${date}|${normalizeNoteForHash(note)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRupees(raw: unknown): number | null {
  if (typeof raw === 'number') {
    const parsed = rupeesToPaise(raw);
    return parsed.ok ? parsed.paise : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const numeric = Number(raw.replace(/[\s,₹]/g, ''));
    if (!Number.isFinite(numeric)) return null;
    const parsed = rupeesToPaise(numeric);
    return parsed.ok ? parsed.paise : null;
  }
  return null;
}

/**
 * Validates a whole import document without touching application state.
 * A single invalid record aborts the import: partial ledgers cannot be
 * reconciled, so we never commit half a file.
 */
export function planImport(rawText: string, ctx: ImportContext): ImportParseResult {
  const errors: ImportIssue[] = [];
  const warnings: ImportWarning[] = [];
  const now = ctx.now ?? Date.now();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown parse error';
    return { ok: false, errors: [{ path: '$', message: `Not valid JSON: ${detail}` }] };
  }

  if (!isRecord(parsed)) {
    return { ok: false, errors: [{ path: '$', message: 'Expected a JSON object at the root.' }] };
  }

  const rawCustomers = parsed.customers ?? [];
  const rawEntries = parsed.entries ?? [];

  if (!Array.isArray(rawCustomers)) {
    return {
      ok: false,
      errors: [{ path: 'customers', message: '`customers` must be an array.' }],
    };
  }
  if (!Array.isArray(rawEntries)) {
    return { ok: false, errors: [{ path: 'entries', message: '`entries` must be an array.' }] };
  }
  if (rawCustomers.length === 0 && rawEntries.length === 0) {
    return { ok: false, errors: [{ path: '$', message: 'Nothing to import: the file is empty.' }] };
  }

  const existingByPhone = new Map(ctx.existingCustomers.map((c) => [c.phone, c]));
  const phoneToCustomerId = new Map<string, string>();
  for (const customer of ctx.existingCustomers) phoneToCustomerId.set(customer.phone, customer.id);

  const newCustomers: Customer[] = [];
  let duplicateCustomers = 0;
  let matchedCustomerCount = 0;

  rawCustomers.forEach((raw, index) => {
    const path = `customers[${index}]`;
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Customer must be an object.' });
      return;
    }
    const name = normalizeWhitespace(typeof raw.name === 'string' ? raw.name : '');
    if (name.length === 0) {
      errors.push({ path: `${path}.name`, message: 'Customer name is required.' });
      return;
    }
    if (name.length > 80) {
      errors.push({ path: `${path}.name`, message: 'Customer name is longer than 80 characters.' });
      return;
    }
    const phone = normalizePhone(typeof raw.phone === 'string' ? raw.phone : String(raw.phone ?? ''));
    if (!/^\d{10}$/.test(phone)) {
      errors.push({ path: `${path}.phone`, message: 'Phone must be exactly 10 digits.' });
      return;
    }

    if (phoneToCustomerId.has(phone)) {
      const existing = existingByPhone.get(phone);
      if (existing) {
        matchedCustomerCount += 1;
      } else {
        duplicateCustomers += 1;
        warnings.push({
          path,
          message: `Duplicate phone ${phone} inside the file — this row was skipped.`,
        });
      }
      return;
    }

    const customer: Customer = {
      id: createId('cus'),
      name,
      phone,
      createdAt: now,
      updatedAt: now,
    };
    newCustomers.push(customer);
    phoneToCustomerId.set(phone, customer.id);
  });

  const existingHashes = new Set<string>();
  const customerById = new Map(ctx.existingCustomers.map((c) => [c.id, c]));
  for (const tx of ctx.existingTransactions) {
    const owner = customerById.get(tx.customerId);
    if (!owner) continue;
    existingHashes.add(entryHash(owner.phone, tx.type, tx.amountPaise, tx.date, tx.note));
  }
  // Entries created earlier in this same file also block duplicates.
  const seenHashes = new Set<string>();
  const newTransactions: Transaction[] = [];
  let duplicateEntries = 0;
  let entryCount = 0;

  const futureLimitYear = Number(ctx.today.slice(0, 4)) + 5;

  rawEntries.forEach((raw, index) => {
    const path = `entries[${index}]`;
    if (!isRecord(raw)) {
      errors.push({ path, message: 'Entry must be an object.' });
      return;
    }

    const phone = normalizePhone(
      typeof raw.phone === 'string' ? raw.phone : String(raw.phone ?? ''),
    );
    if (!/^\d{10}$/.test(phone)) {
      errors.push({ path: `${path}.phone`, message: 'Entry phone must be exactly 10 digits.' });
      return;
    }
    const customerId = phoneToCustomerId.get(phone);
    if (!customerId) {
      errors.push({
        path: `${path}.phone`,
        message: `No customer with phone ${phone}. Add the customer to the file first.`,
      });
      return;
    }

    const typeRaw = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : raw.type;
    if (!isTransactionType(typeRaw)) {
      errors.push({ path: `${path}.type`, message: 'Type must be "credit" or "payment".' });
      return;
    }

    const amountPaise = parseRupees(raw.amount);
    if (amountPaise === null) {
      errors.push({
        path: `${path}.amount`,
        message: 'Amount must be a positive number with at most 2 decimals.',
      });
      return;
    }

    const date = typeof raw.date === 'string' ? raw.date.trim() : '';
    if (!isValidISODate(date)) {
      errors.push({ path: `${path}.date`, message: 'Date must be a real date in YYYY-MM-DD.' });
      return;
    }
    if (Number(date.slice(0, 4)) > futureLimitYear) {
      errors.push({ path: `${path}.date`, message: 'Date is far in the future — check the file.' });
      return;
    }

    let note = '';
    if (raw.note !== undefined && raw.note !== null) {
      if (typeof raw.note !== 'string') {
        errors.push({ path: `${path}.note`, message: 'Note must be text.' });
        return;
      }
      note = raw.note.trim();
      if (note.length > NOTE_MAX) {
        errors.push({
          path: `${path}.note`,
          message: `Note is longer than ${NOTE_MAX} characters.`,
        });
        return;
      }
    }

    entryCount += 1;
    const hash = entryHash(phone, typeRaw, amountPaise, date, note);
    if (existingHashes.has(hash) || seenHashes.has(hash)) {
      duplicateEntries += 1;
      return;
    }
    seenHashes.add(hash);

    newTransactions.push({
      id: createId('txn'),
      customerId,
      type: typeRaw,
      amountPaise,
      date,
      note,
      screenshotId: null,
      createdAt: now - (rawEntries.length - index),
      updatedAt: now - (rawEntries.length - index),
      importHash: hash,
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const shopNameSuggestion =
    typeof parsed.shop === 'string' && parsed.shop.trim() ? parsed.shop.trim().slice(0, 60) : null;

  const plan: ImportPlan = {
    shopNameSuggestion,
    newCustomers,
    newTransactions,
    newCustomerCount: newCustomers.length,
    matchedCustomerCount,
    entryCount,
    duplicateEntries,
    duplicateCustomers,
    resultingCustomerCount: ctx.existingCustomers.length + newCustomers.length,
    resultingEntryCount: ctx.existingTransactions.length + newTransactions.length,
  };

  return { ok: true, plan, warnings };
}
