import type { Customer, ShopTotals, Totals, Transaction } from '@/types';
import { diffDays } from './dates';

export const EMPTY_TOTALS: Totals = Object.freeze({
  creditPaise: 0,
  paymentPaise: 0,
  balancePaise: 0,
  txCount: 0,
  lastPaymentDate: null,
  firstCreditDate: null,
  lastActivityDate: null,
});

/**
 * Projects every customer's totals from the ledger.
 * Balances are never stored, so they can never drift.
 */
export function buildTotalsIndex(transactions: Transaction[]): Map<string, Totals> {
  const index = new Map<string, Totals>();

  for (const tx of transactions) {
    if (!tx || typeof tx.customerId !== 'string') continue;
    const amount = Number.isFinite(tx.amountPaise) ? Math.trunc(tx.amountPaise) : 0;
    if (amount <= 0) continue;

    const existing = index.get(tx.customerId);
    const current: Totals =
      existing ?? {
        creditPaise: 0,
        paymentPaise: 0,
        balancePaise: 0,
        txCount: 0,
        lastPaymentDate: null,
        firstCreditDate: null,
        lastActivityDate: null,
      };

    if (tx.type === 'credit') {
      current.creditPaise += amount;
      if (current.firstCreditDate === null || tx.date < current.firstCreditDate) {
        current.firstCreditDate = tx.date;
      }
    } else {
      current.paymentPaise += amount;
      if (current.lastPaymentDate === null || tx.date > current.lastPaymentDate) {
        current.lastPaymentDate = tx.date;
      }
    }

    if (current.lastActivityDate === null || tx.date > current.lastActivityDate) {
      current.lastActivityDate = tx.date;
    }
    current.txCount += 1;
    current.balancePaise = current.creditPaise - current.paymentPaise;
    index.set(tx.customerId, current);
  }

  return index;
}

export function totalsFor(index: Map<string, Totals>, customerId: string): Totals {
  return index.get(customerId) ?? EMPTY_TOTALS;
}

/** Shop-wide aggregates. Every customer counts, including those with no entries. */
export function shopTotals(customers: Customer[], index: Map<string, Totals>): ShopTotals {
  let outstanding = 0;
  let credit = 0;
  let payment = 0;
  let withDues = 0;
  let advances = 0;

  for (const customer of customers) {
    const totals = totalsFor(index, customer.id);
    outstanding += totals.balancePaise;
    credit += totals.creditPaise;
    payment += totals.paymentPaise;
    if (totals.balancePaise > 0) withDues += 1;
    if (totals.balancePaise < 0) advances += 1;
  }

  return {
    outstandingPaise: outstanding,
    creditPaise: credit,
    paymentPaise: payment,
    customersWithDues: withDues,
    advanceCustomers: advances,
  };
}

export interface OverdueRow {
  customer: Customer;
  totals: Totals;
  daysSince: number;
  /** True when no payment has ever been recorded. */
  neverPaid: boolean;
}

/**
 * Customers with a positive balance whose last payment is older than
 * `thresholdDays` (or who never paid). Sorted worst-first.
 */
export function overdueCustomers(
  customers: Customer[],
  index: Map<string, Totals>,
  today: string,
  thresholdDays = 30,
): OverdueRow[] {
  const rows: OverdueRow[] = [];

  for (const customer of customers) {
    const totals = totalsFor(index, customer.id);
    if (totals.balancePaise <= 0) continue;

    const anchor = totals.lastPaymentDate ?? totals.firstCreditDate;
    if (!anchor) continue;

    const daysSince = Math.max(0, diffDays(anchor, today));
    if (daysSince < thresholdDays) continue;

    rows.push({
      customer,
      totals,
      daysSince,
      neverPaid: totals.lastPaymentDate === null,
    });
  }

  rows.sort((a, b) => {
    if (b.daysSince !== a.daysSince) return b.daysSince - a.daysSince;
    return b.totals.balancePaise - a.totals.balancePaise;
  });

  return rows;
}

/** Newest first by business date, then by write time. */
export function sortTransactionsNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return a.id < b.id ? 1 : -1;
  });
}

/** Largest positive balance, used for the "top due" badge. */
export function topDebtor(
  customers: Customer[],
  index: Map<string, Totals>,
): { customer: Customer; totals: Totals } | null {
  let best: { customer: Customer; totals: Totals } | null = null;
  for (const customer of customers) {
    const totals = totalsFor(index, customer.id);
    if (totals.balancePaise <= 0) continue;
    if (!best || totals.balancePaise > best.totals.balancePaise) {
      best = { customer, totals };
    }
  }
  return best;
}
