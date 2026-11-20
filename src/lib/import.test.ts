import { describe, expect, it } from 'vitest';
import { entryHash, planImport, type ImportContext } from '@/lib/jsonImport';
import { EXPECTED, SAMPLE_TEXT } from '@/test/helpers';

const TODAY = EXPECTED.today;

function emptyCtx(): ImportContext {
  return { existingCustomers: [], existingTransactions: [], today: TODAY };
}

function parse(text: string, ctx = emptyCtx()) {
  return planImport(text, ctx);
}

describe('JSON import — supplied sample', () => {
  it('parses the real sample file without a single error', () => {
    const result = parse(SAMPLE_TEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.newCustomerCount).toBe(8);
    expect(result.plan.newTransactions).toHaveLength(38);
    expect(result.plan.entryCount).toBe(38);
    expect(result.plan.duplicateEntries).toBe(0);
    expect(result.plan.shopNameSuggestion).toBe('Lakshmi Provision Store (fictional)');
    expect(result.warnings).toHaveLength(0);
  });

  it('is idempotent: importing the same file twice adds nothing', () => {
    const first = parse(SAMPLE_TEXT);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = parse(SAMPLE_TEXT, {
      existingCustomers: first.plan.newCustomers,
      existingTransactions: first.plan.newTransactions,
      today: TODAY,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.plan.newCustomers).toHaveLength(0);
    expect(second.plan.newTransactions).toHaveLength(0);
    expect(second.plan.duplicateEntries).toBe(38);
    expect(second.plan.matchedCustomerCount).toBe(8);
  });

  it('adds only new entries when an existing customer gains activity', () => {
    const first = parse(SAMPLE_TEXT);
    if (!first.ok) throw new Error('sample must parse');

    const followUp = JSON.stringify({
      customers: [{ name: 'Ravi Kumar', phone: '9000000101' }],
      entries: [
        {
          phone: '9000000101',
          type: 'credit',
          amount: 100,
          date: '2026-11-01',
          note: 'new purchase',
        },
      ],
    });

    const second = parse(followUp, {
      existingCustomers: first.plan.newCustomers,
      existingTransactions: first.plan.newTransactions,
      today: TODAY,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.plan.newCustomers).toHaveLength(0);
    expect(second.plan.newTransactions).toHaveLength(1);
    const existingRavi = first.plan.newCustomers.find((c) => c.phone === '9000000101');
    expect(second.plan.newTransactions[0]?.customerId).toBe(existingRavi?.id);
  });

  it('produces a stable hash per logical entry', () => {
    const a = entryHash('9000000101', 'credit', 25_000, '2026-09-27', 'groceries');
    const b = entryHash('9000000101', 'credit', 25_000, '2026-09-27', '  Groceries ');
    expect(a).toBe(b);
    expect(entryHash('9000000101', 'payment', 25_000, '2026-09-27', 'groceries')).not.toBe(a);
  });
});

describe('JSON import — validation', () => {
  it('rejects malformed JSON with a clear path', () => {
    const result = parse('{ nope ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('$');
      expect(result.errors[0]?.message).toMatch(/not valid json/i);
    }
  });

  it('rejects a non-object root', () => {
    expect(parse('[]').ok).toBe(false);
  });

  it('rejects non-array collections', () => {
    const result = parse(JSON.stringify({ customers: {}, entries: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.path).toBe('customers');
  });

  it('rejects an empty file', () => {
    const result = parse(JSON.stringify({ customers: [], entries: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects entries whose phone has no customer', () => {
    const result = parse(
      JSON.stringify({
        customers: [{ name: 'A', phone: '9000000001' }],
        entries: [{ phone: '9000000009', type: 'credit', amount: 10, date: '2026-01-01' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('entries[0].phone');
      expect(result.errors[0]?.message).toContain('9000000009');
    }
  });

  it('rejects invalid names, phones, amounts, types and dates', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ name: '   ', phone: '9000000001' }, 'customers[0].name'],
      [{ name: 'A', phone: '123' }, 'customers[0].phone'],
      [{ name: 'x'.repeat(81), phone: '9000000001' }, 'customers[0].name'],
    ];
    for (const [customer, path] of cases) {
      const result = parse(JSON.stringify({ customers: [customer], entries: [] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.some((error) => error.path === path)).toBe(true);
    }

    const entryCases: Array<[Record<string, unknown>, string]> = [
      [{ type: 'loan', amount: 10, date: '2026-01-01' }, 'entries[0].type'],
      [{ type: 'credit', amount: 0, date: '2026-01-01' }, 'entries[0].amount'],
      [{ type: 'credit', amount: -5, date: '2026-01-01' }, 'entries[0].amount'],
      [{ type: 'credit', amount: 10.005, date: '2026-01-01' }, 'entries[0].amount'],
      [{ type: 'credit', amount: 10, date: '2026-02-30' }, 'entries[0].date'],
      [{ type: 'credit', amount: 10, date: '2026-01-01', note: 'x'.repeat(201) }, 'entries[0].note'],
    ];
    for (const [entry, path] of entryCases) {
      const result = parse(
        JSON.stringify({
          customers: [{ name: 'A', phone: '9000000001' }],
          entries: [{ phone: '9000000001', ...entry }],
        }),
      );
      expect(result.ok, JSON.stringify(entry)).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((error) => error.path === path), path).toBe(true);
      }
    }
  });

  it('lets an invalid record abort the whole import (atomicity)', () => {
    const result = parse(
      JSON.stringify({
        customers: [
          { name: 'Valid One', phone: '9000000001' },
          { name: '', phone: '9000000002' },
        ],
        entries: [{ phone: '9000000001', type: 'credit', amount: 100, date: '2026-01-01' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(1);
  });
});

describe('JSON import — permissive but safe', () => {
  it('supports customers with no entries', () => {
    const result = parse(
      JSON.stringify({
        customers: [
          { name: 'No Entries', phone: '9000000001' },
          { name: 'Has Entry', phone: '9000000002' },
        ],
        entries: [{ phone: '9000000002', type: 'payment', amount: 50, date: '2026-01-01' }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.newCustomers).toHaveLength(2);
    expect(result.plan.newTransactions).toHaveLength(1);
  });

  it('accepts numeric strings and normalised phone formats', () => {
    const result = parse(
      JSON.stringify({
        customers: [{ name: 'A', phone: '+91 90000 00001' }],
        entries: [
          { phone: '090000 00001', type: 'CREDIT', amount: '250.50', date: '2026-01-01' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.newCustomers[0]?.phone).toBe('9000000001');
    expect(result.plan.newTransactions[0]?.type).toBe('credit');
    expect(result.plan.newTransactions[0]?.amountPaise).toBe(25050);
  });

  it('skips duplicate phones inside the payload with a warning', () => {
    const result = parse(
      JSON.stringify({
        customers: [
          { name: 'First', phone: '9000000001' },
          { name: 'Second', phone: '9000000001' },
        ],
        entries: [{ phone: '9000000001', type: 'credit', amount: 10, date: '2026-01-01' }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.newCustomers).toHaveLength(1);
    expect(result.plan.newCustomers[0]?.name).toBe('First');
    expect(result.plan.duplicateCustomers).toBe(1);
    expect(result.warnings.some((warning) => warning.message.includes('Duplicate'))).toBe(true);
  });

  it('skips exact duplicate entries inside the payload', () => {
    const result = parse(
      JSON.stringify({
        customers: [{ name: 'A', phone: '9000000001' }],
        entries: [
          { phone: '9000000001', type: 'credit', amount: 100, date: '2026-01-01', note: 'rice' },
          { phone: '9000000001', type: 'credit', amount: 100, date: '2026-01-01', note: ' rice ' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.newTransactions).toHaveLength(1);
    expect(result.plan.duplicateEntries).toBe(1);
  });

  it('rejects dates absurdly far in the future', () => {
    const result = parse(
      JSON.stringify({
        customers: [{ name: 'A', phone: '9000000001' }],
        entries: [{ phone: '9000000001', type: 'credit', amount: 10, date: '2099-01-01' }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('does not trust any balance or total supplied by the file', () => {
    const result = parse(
      JSON.stringify({
        total_outstanding: 999999,
        balances: { '9000000001': 12345 },
        customers: [{ name: 'A', phone: '9000000001', balance: 5000 }],
        entries: [{ phone: '9000000001', type: 'credit', amount: 10, date: '2026-01-01' }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.newTransactions[0]?.amountPaise).toBe(1000);
    expect(
      result.plan.newTransactions.reduce(
        (sum, tx) => sum + (tx.type === 'credit' ? tx.amountPaise : -tx.amountPaise),
        0,
      ),
    ).toBe(1000);
  });
});
