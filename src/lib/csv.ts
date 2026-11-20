import type { Customer, Transaction } from '@/types';
import { paiseToDecimalString } from './money';
import { sortTransactionsNewestFirst } from './balance';

/**
 * Escapes a cell for RFC-4180 CSV and neutralises spreadsheet formula
 * injection (`=`, `+`, `-`, `@` at the start of a cell).
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export const LEDGER_HEADER = [
  'Date',
  'Customer',
  'Phone',
  'Type',
  'Amount (INR)',
  'Note',
  'Screenshot',
  'Created At',
];

export interface LedgerCsvOptions {
  customers: Customer[];
  transactions: Transaction[];
  /** Restrict to a single customer's ledger. */
  customerId?: string;
}

/** Full ledger export, or one customer's statement. Newest first. */
export function ledgerCsv({ customers, transactions, customerId }: LedgerCsvOptions): string {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  const scoped = customerId
    ? transactions.filter((tx) => tx.customerId === customerId)
    : transactions;

  const rows: Array<Array<string | number | null | undefined>> = [LEDGER_HEADER];

  for (const tx of sortTransactionsNewestFirst(scoped)) {
    const customer = byId.get(tx.customerId);
    rows.push([
      tx.date,
      customer?.name ?? 'Unknown',
      customer?.phone ?? '',
      tx.type,
      paiseToDecimalString(tx.amountPaise),
      tx.note,
      tx.screenshotId ? 'yes' : '',
      new Date(tx.createdAt).toISOString(),
    ]);
  }

  return toCsv(rows);
}

export interface SummaryCsvInput {
  rows: Array<{
    name: string;
    phone: string;
    creditPaise: number;
    paymentPaise: number;
    balancePaise: number;
  }>;
}

/** Customer-wise balance summary for accountants. */
export function summaryCsv({ rows }: SummaryCsvInput): string {
  const table: Array<Array<string | number | null | undefined>> = [
    ['Customer', 'Phone', 'Total Credit (INR)', 'Total Payments (INR)', 'Balance (INR)'],
  ];
  for (const row of rows) {
    table.push([
      row.name,
      row.phone,
      paiseToDecimalString(row.creditPaise),
      paiseToDecimalString(row.paymentPaise),
      paiseToDecimalString(row.balancePaise),
    ]);
  }
  return toCsv(table);
}
