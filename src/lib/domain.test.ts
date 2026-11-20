import { describe, expect, it } from 'vitest';
import {
  formatCompactINR,
  formatINR,
  formatPlain,
  paiseToDecimalString,
  parseAmount,
  rupeesToPaise,
} from '@/lib/money';
import {
  addDays,
  diffDays,
  formatDateLong,
  isValidISODate,
  resolveToday,
  todayISO,
} from '@/lib/dates';
import {
  initialsOf,
  maskPhone,
  normalizePhone,
  validateDate,
  validateName,
  validateNote,
  validatePhone,
  validateUpi,
} from '@/lib/validate';
import {
  buildTotalsIndex,
  overdueCustomers,
  shopTotals,
  sortTransactionsNewestFirst,
  topDebtor,
  totalsFor,
} from '@/lib/balance';
import type { Transaction } from '@/types';
import { buildReminderMessage, buildWhatsAppLink } from '@/lib/whatsapp';
import { buildUpiLink } from '@/lib/upi';
import { csvCell, ledgerCsv, summaryCsv } from '@/lib/csv';
import { buildBackup, parseBackup } from '@/lib/backup';
import { planImport } from '@/lib/jsonImport';
import { SAMPLE_TEXT, EXPECTED } from '@/test/helpers';

function samplePlan() {
  const parsed = planImport(SAMPLE_TEXT, {
    existingCustomers: [],
    existingTransactions: [],
    today: EXPECTED.today,
  });
  if (!parsed.ok) throw new Error('sample must parse');
  return parsed.plan;
}

describe('money', () => {
  it('parses rupees into integer paise', () => {
    expect(parseAmount('250')).toEqual({ ok: true, paise: 25000 });
    expect(parseAmount('₹1,250.75')).toEqual({ ok: true, paise: 125075 });
    expect(parseAmount(' 0.5 ')).toEqual({ ok: true, paise: 50 });
    expect(parseAmount('18,280')).toEqual({ ok: true, paise: 1_828_000 });
  });

  it('rejects zero, negative, malformed and over-precise amounts', () => {
    expect(parseAmount('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseAmount('0')).toEqual({ ok: false, reason: 'zero' });
    expect(parseAmount('-5')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmount('1.234')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmount('abc')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseAmount('999999999999')).toEqual({ ok: false, reason: 'too_large' });
    expect(parseAmount('1e5')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('converts JSON rupee numbers safely', () => {
    expect(rupeesToPaise(250)).toEqual({ ok: true, paise: 25000 });
    expect(rupeesToPaise(250.5)).toEqual({ ok: true, paise: 25050 });
    expect(rupeesToPaise(250.005)).toEqual({ ok: false, reason: 'invalid' });
    expect(rupeesToPaise(-1)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('formats with Indian digit grouping', () => {
    expect(formatINR(1_182_000)).toBe('₹11,820');
    expect(formatINR(67_000)).toBe('₹670');
    expect(formatINR(-126_000)).toBe('-₹1,260');
    expect(formatINR(67_050)).toBe('₹670.50');
    expect(formatPlain(1_182_000)).toBe('11,820');
    expect(formatCompactINR(1_182_000)).toBe('₹11.8K');
    expect(paiseToDecimalString(67_000)).toBe('670.00');
    expect(paiseToDecimalString(50)).toBe('0.50');
  });
});

describe('dates', () => {
  it('builds local date-only strings without timezone drift', () => {
    expect(todayISO(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15');
    expect(todayISO(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('validates real calendar dates', () => {
    expect(isValidISODate('2026-11-15')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('15-11-2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });

  it('adds and diffs whole days', () => {
    expect(addDays('2026-11-15', 10)).toBe('2026-11-25');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-09-15', '2026-11-15')).toBe(61);
    expect(diffDays('2026-11-15', '2026-11-15')).toBe(0);
    expect(diffDays('2026-11-15', '2026-11-14')).toBe(-1);
  });

  it('honours ?today= overrides and ignores invalid ones', () => {
    const now = new Date(2026, 0, 5);
    expect(resolveToday('?today=2026-11-15', now)).toBe('2026-11-15');
    expect(resolveToday('?today=2026-02-31', now)).toBe('2026-01-05');
    expect(resolveToday('', now)).toBe('2026-01-05');
    expect(resolveToday('?today=', now)).toBe('2026-01-05');
  });

  it('formats dates for display', () => {
    expect(formatDateLong('2026-11-15')).toContain('2026');
    expect(formatDateLong('2026-11-15')).toContain('15');
  });
});

describe('validation', () => {
  it('normalises Indian phone formats', () => {
    expect(normalizePhone('+91 90000 00101')).toBe('9000000101');
    expect(normalizePhone('090000 00101')).toBe('9000000101');
    expect(normalizePhone('9000000101')).toBe('9000000101');
    expect(normalizePhone('90000-00101')).toBe('9000000101');
  });

  it('requires exactly ten digits', () => {
    expect(validatePhone('9000000101')).toEqual({ ok: true, value: '9000000101' });
    expect(validatePhone('12345')).toEqual({
      ok: false,
      errors: [{ field: 'phone', code: 'phone_invalid' }],
    });
    expect(validatePhone('90000001011')).toEqual({
      ok: false,
      errors: [{ field: 'phone', code: 'phone_invalid' }],
    });
    expect(validatePhone('abcdefghij')).toEqual({
      ok: false,
      errors: [{ field: 'phone', code: 'phone_invalid' }],
    });
  });

  it('validates names and notes', () => {
    expect(validateName('  Ravi   Kumar  ')).toEqual({ ok: true, value: 'Ravi Kumar' });
    expect(validateName('   ')).toEqual({
      ok: false,
      errors: [{ field: 'name', code: 'name_required' }],
    });
    expect(validateName('x'.repeat(81))).toEqual({
      ok: false,
      errors: [{ field: 'name', code: 'name_too_long' }],
    });
    expect(validateName('రవి కుమార్').ok).toBe(true);
    expect(validateNote('x'.repeat(201))).toEqual({
      ok: false,
      errors: [{ field: 'note', code: 'note_too_long' }],
    });
  });

  it('rejects future and impossible dates', () => {
    expect(validateDate('2026-11-15', '2026-11-15').ok).toBe(true);
    expect(validateDate('2026-11-16', '2026-11-15')).toEqual({
      ok: false,
      errors: [{ field: 'date', code: 'date_future' }],
    });
    expect(validateDate('2026-02-30', '2026-11-15')).toEqual({
      ok: false,
      errors: [{ field: 'date', code: 'date_invalid' }],
    });
    expect(validateDate('2000-01-01', '2026-11-15')).toEqual({
      ok: false,
      errors: [{ field: 'date', code: 'date_too_old' }],
    });
  });

  it('validates UPI ids', () => {
    expect(validateUpi('')).toEqual({ ok: true, value: '' });
    expect(validateUpi('lakshmi@okhdfcbank')).toEqual({
      ok: true,
      value: 'lakshmi@okhdfcbank',
    });
    expect(validateUpi('not-a-vpa')).toEqual({
      ok: false,
      errors: [{ field: 'upiId', code: 'upi_invalid' }],
    });
  });

  it('masks phones and builds initials', () => {
    expect(maskPhone('9000000101')).toBe('90000\u2022\u2022101');
    expect(initialsOf('Ravi Kumar')).toBe('RK');
    expect(initialsOf('Sunita')).toBe('SU');
    expect(initialsOf('రవి కుమార్').length).toBeGreaterThan(0);
  });
});

describe('balance engine with the supplied sample', () => {
  it('reproduces every expected balance and the shop total', () => {
    const plan = samplePlan();
    const index = buildTotalsIndex(plan.newTransactions);

    expect(plan.newCustomers).toHaveLength(8);
    expect(plan.newTransactions).toHaveLength(38);

    const byPhone = new Map(
      plan.newCustomers.map((customer) => [customer.phone, customer.id] as const),
    );

    for (const [phone, expectedBalance] of Object.entries(EXPECTED.balances)) {
      const id = byPhone.get(phone);
      expect(id, `customer ${phone} should exist`).toBeTruthy();
      expect(totalsFor(index, id as string).balancePaise).toBe(expectedBalance * 100);
    }

    const shop = shopTotals(plan.newCustomers, index);
    expect(shop.outstandingPaise).toBe(EXPECTED.total_outstanding * 100);
    expect(shop.outstandingPaise).toBe(1_182_000);
    expect(shop.creditPaise).toBe(1_828_000);
    expect(shop.paymentPaise).toBe(646_000);
    expect(shop.customersWithDues).toBe(EXPECTED.customers_with_balance);

    const top = topDebtor(plan.newCustomers, index);
    expect(top?.customer.phone).toBe(EXPECTED.top_defaulter_phone);
    expect(top?.totals.balancePaise).toBe(347_000);
  });

  it('computes zero and negative balances', () => {
    const transactions: Transaction[] = [
      tx('c1', 'credit', 50_000, '2026-11-01'),
      tx('c1', 'payment', 50_000, '2026-11-02'),
      tx('c2', 'payment', 20_000, '2026-11-03'),
    ];
    const index = buildTotalsIndex(transactions);
    expect(totalsFor(index, 'c1').balancePaise).toBe(0);
    expect(totalsFor(index, 'c2').balancePaise).toBe(-20_000);
    expect(totalsFor(index, 'missing').balancePaise).toBe(0);
  });

  it('includes customers with no transactions in the customer total', () => {
    const customers = [
      { id: 'c1', name: 'A', phone: '9000000001', createdAt: 0, updatedAt: 0 },
      { id: 'c2', name: 'B', phone: '9000000002', createdAt: 0, updatedAt: 0 },
    ];
    const shop = shopTotals(customers, buildTotalsIndex([]));
    expect(shop.outstandingPaise).toBe(0);
    expect(shop.customersWithDues).toBe(0);
  });

  it('identifies overdue customers worst-first', () => {
    const plan = samplePlan();
    const index = buildTotalsIndex(plan.newTransactions);
    const rows = overdueCustomers(plan.newCustomers, index, EXPECTED.today, 30);
    expect(rows.map((row) => row.customer.phone)).toEqual([
      '9000000105',
      '9000000104',
      '9000000108',
      '9000000102',
    ]);
    expect(rows[0]?.daysSince).toBe(61);
    expect(rows[0]?.totals.balancePaise).toBe(23_000);
  });

  it('sorts transactions newest first, breaking ties by creation time', () => {
    const a = tx('c1', 'credit', 100, '2026-11-10');
    a.createdAt = 1;
    const b = tx('c1', 'credit', 200, '2026-11-12');
    b.createdAt = 2;
    const c = tx('c1', 'credit', 300, '2026-11-12');
    c.createdAt = 3;
    expect(sortTransactionsNewestFirst([a, b, c]).map((item) => item.amountPaise)).toEqual([
      300, 200, 100,
    ]);
  });
});

describe('reminders and UPI', () => {
  it('builds the exact wa.me link structure', () => {
    const message = buildReminderMessage({
      customerName: 'Ravi Kumar',
      shopName: 'Lakshmi Provision Store',
      amountPaise: 67_000,
    });
    const link = buildWhatsAppLink('9000000101', message);
    expect(link.startsWith('https://wa.me/919000000101?text=')).toBe(true);
    const decoded = decodeURIComponent(link.split('?text=')[1] ?? '');
    expect(decoded).toContain('Ravi Kumar');
    expect(decoded).toContain('₹670');
    expect(decoded).toContain('Lakshmi Provision Store');
    expect(decoded.toLowerCase()).toContain('thank you');
  });

  it('localises the reminder', () => {
    const hindi = buildReminderMessage({
      customerName: 'Ravi',
      shopName: 'Dukaan',
      amountPaise: 67000,
      language: 'hi',
    });
    expect(hindi).toContain('नमस्ते');
    expect(hindi).toContain('₹670');

    const telugu = buildReminderMessage({
      customerName: 'Ravi',
      shopName: 'Dukaan',
      amountPaise: 67000,
      language: 'te',
    });
    expect(telugu).toContain('నమస్కారం');
    expect(telugu).toContain('₹670');
  });

  it('builds a UPI intent with amount and currency', () => {
    const link = buildUpiLink({
      upiId: 'shop@okhdfcbank',
      payeeName: 'Lakshmi Store',
      amountPaise: 67_000,
      note: 'Dues',
    });
    expect(link).toBeTruthy();
    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=shop%40okhdfcbank');
    expect(link).toContain('am=670.00');
    expect(link).toContain('cu=INR');
    expect(buildUpiLink({ upiId: '', payeeName: 'x', amountPaise: 100 })).toBeNull();
    expect(buildUpiLink({ upiId: 'a@b', payeeName: 'x', amountPaise: 0 })).toBeNull();
  });
});

describe('CSV export', () => {
  it('exports every sample entry with a header', () => {
    const plan = samplePlan();
    const csv = ledgerCsv({
      customers: plan.newCustomers,
      transactions: plan.newTransactions,
    });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'Date,Customer,Phone,Type,Amount (INR),Note,Screenshot,Created At',
    );
    expect(lines).toHaveLength(39);
    expect(csv).toContain('Ravi Kumar');
    expect(csv).toContain('1500.00');
    expect(csv).toContain('250.00');
    expect(csv).toContain('paid on UPI');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(csvCell('+91')).toBe("'+91");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('has, comma')).toBe('"has, comma"');
    expect(csvCell('quote " inside')).toBe('"quote "" inside"');
  });

  it('exports a balance summary', () => {
    const csv = summaryCsv({
      rows: [
        {
          name: 'Ravi',
          phone: '9000000101',
          creditPaise: 235_000,
          paymentPaise: 168_000,
          balancePaise: 67_000,
        },
      ],
    });
    expect(csv).toContain('Customer,Phone,Total Credit (INR)');
    expect(csv).toContain('Ravi,9000000101,2350.00,1680.00,670.00');
  });
});

describe('backup', () => {
  it('round-trips a backup', () => {
    const plan = samplePlan();
    const file = buildBackup(
      {
        shopName: 'Test Shop',
        upiId: '',
        language: 'en',
        theme: 'system',
        overdueDays: 30,
        maskPhones: true,
      },
      plan.newCustomers,
      plan.newTransactions,
    );
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.customers).toHaveLength(8);
      expect(parsed.value.transactions).toHaveLength(38);
      expect(parsed.value.settings.shopName).toBe('Test Shop');
    }
  });

  it('rejects foreign files and broken references', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other' })).ok).toBe(false);

    const broken = buildBackup(
      {
        shopName: 'Test',
        upiId: '',
        language: 'en',
        theme: 'system',
        overdueDays: 30,
        maskPhones: true,
      },
      [],
      [tx('missing-customer', 'credit', 1000, '2026-01-01')],
    );
    const parsed = parseBackup(JSON.stringify(broken));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('customerId');
  });
});

function tx(
  customerId: string,
  type: 'credit' | 'payment',
  amountPaise: number,
  date: string,
): Transaction {
  return {
    id: `txn_${customerId}_${date}_${amountPaise}_${type}`,
    customerId,
    type,
    amountPaise,
    date,
    note: '',
    screenshotId: null,
    createdAt: 1,
    updatedAt: 1,
  };
}
