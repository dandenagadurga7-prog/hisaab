import { describe, expect, it } from 'vitest';
import { __resetHisaabState, useStore } from '@/store/useStore';
import { buildBackup, parseBackup } from '@/lib/backup';
import { buildTotalsIndex, shopTotals, totalsFor } from '@/lib/balance';
import { STORAGE_KEYS } from '@/services/storage';
import { addCredit, addPayment, seedCustomer, seedSample, setUrl } from '@/test/helpers';

function balanceOf(customerId: string): number {
  const state = useStore.getState();
  return totalsFor(buildTotalsIndex(state.transactions), customerId).balancePaise;
}

function store() {
  return useStore.getState();
}

describe('customer actions', () => {
  it('normalises name and phone, then persists', () => {
    const result = store().addCustomer({ name: '  Ravi   Kumar ', phone: '+91 90000 00101' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Ravi Kumar');
    expect(result.value.phone).toBe('9000000101');
    expect(result.value.id.startsWith('cus_')).toBe(true);
    expect(store().customers).toHaveLength(1);
    expect(window.localStorage.getItem(STORAGE_KEYS.customers)).toContain('Ravi Kumar');
  });

  it('rejects a duplicate phone number', () => {
    seedCustomer('Ravi Kumar', '9000000101');
    const duplicate = store().addCustomer({ name: 'Another Ravi', phone: '9000000101' });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors[0]?.code).toBe('phone_duplicate');
    expect(store().customers).toHaveLength(1);
  });

  it('rejects invalid phones and empty names', () => {
    expect(store().addCustomer({ name: 'Ravi', phone: '12345' }).ok).toBe(false);
    expect(store().addCustomer({ name: '   ', phone: '9000000002' }).ok).toBe(false);
    expect(store().customers).toHaveLength(0);
  });

  it('keeps two customers with the same name on different phones', () => {
    expect(store().addCustomer({ name: 'Ravi Kumar', phone: '9000000001' }).ok).toBe(true);
    expect(store().addCustomer({ name: 'Ravi Kumar', phone: '9000000002' }).ok).toBe(true);
    expect(store().customers).toHaveLength(2);
  });

  it('edits a customer and keeps the phone unique', () => {
    const first = seedCustomer('Ravi', '9000000001');
    const second = seedCustomer('Sunita', '9000000002');

    const clash = store().updateCustomer(second.id, { name: 'Sunita', phone: first.phone });
    expect(clash.ok).toBe(false);

    const renamed = store().updateCustomer(first.id, {
      name: 'Ravi Kumar',
      phone: '+91 90000 00009',
    });
    expect(renamed.ok).toBe(true);
    if (renamed.ok) expect(renamed.value.phone).toBe('9000000009');
  });

  it('carries forward an opening balance as a credit entry', () => {
    const result = store().addCustomer(
      { name: 'Migrated Customer', phone: '9000000010' },
      { openingBalancePaise: 50_000, openingNote: 'Opening balance' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(store().customers).toHaveLength(1);
    expect(store().transactions).toHaveLength(1);
    expect(store().transactions[0]?.type).toBe('credit');
    expect(store().transactions[0]?.amountPaise).toBe(50_000);
    expect(store().transactions[0]?.note).toBe('Opening balance');
    expect(balanceOf(result.value.id)).toBe(50_000);
  });

  it('rejects an invalid opening balance without creating a customer', () => {
    const result = store().addCustomer(
      { name: 'Bad Opening', phone: '9000000011' },
      { openingBalancePaise: 12.5 },
    );
    expect(result.ok).toBe(false);
    expect(store().customers).toHaveLength(0);
    expect(store().transactions).toHaveLength(0);
  });

  it('deletes a customer together with every transaction', () => {
    const customer = seedCustomer();
    addCredit(customer.id, 500, store().today);
    addPayment(customer.id, 200, store().today);
    expect(store().transactions).toHaveLength(2);

    const result = store().deleteCustomer(customer.id);
    expect(result.ok).toBe(true);
    expect(store().customers).toHaveLength(0);
    expect(store().transactions).toHaveLength(0);
  });
});

describe('ledger actions', () => {
  it('computes balance as credit minus payment', () => {
    const customer = seedCustomer();
    addCredit(customer.id, 250, store().today);
    expect(balanceOf(customer.id)).toBe(25_000);
    addCredit(customer.id, 1500, store().today);
    addPayment(customer.id, 180, store().today);
    expect(balanceOf(customer.id)).toBe(157_000);
    addPayment(customer.id, 1800, store().today);
    expect(balanceOf(customer.id)).toBe(-23_000);
  });

  it('supports zero balances', () => {
    const customer = seedCustomer();
    addCredit(customer.id, 500, store().today);
    addPayment(customer.id, 500, store().today);
    expect(balanceOf(customer.id)).toBe(0);
  });

  it('rejects zero, negative and non-integer amounts', () => {
    const customer = seedCustomer();
    for (const amountPaise of [0, -100, 1.5]) {
      const result = store().addTransaction({
        customerId: customer.id,
        type: 'credit',
        amountPaise,
        date: store().today,
        note: '',
      });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects a future date but accepts today', () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer();
    const future = store().addTransaction({
      customerId: customer.id,
      type: 'credit',
      amountPaise: 1000,
      date: '2026-11-16',
      note: '',
    });
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.errors[0]?.code).toBe('date_future');

    const today = store().addTransaction({
      customerId: customer.id,
      type: 'credit',
      amountPaise: 1000,
      date: '2026-11-15',
      note: '',
    });
    expect(today.ok).toBe(true);
  });

  it('rejects a transaction for a missing customer', () => {
    const result = store().addTransaction({
      customerId: 'cus_missing',
      type: 'credit',
      amountPaise: 1000,
      date: store().today,
      note: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('customer_not_found');
  });

  it('edits a transaction and recalculates immediately', () => {
    const customer = seedCustomer();
    const tx = addCredit(customer.id, 500, store().today);
    expect(balanceOf(customer.id)).toBe(50_000);

    const updated = store().updateTransaction(tx.id, { amountPaise: 70_000 });
    expect(updated.ok).toBe(true);
    expect(balanceOf(customer.id)).toBe(70_000);

    const flipped = store().updateTransaction(tx.id, { type: 'payment' });
    expect(flipped.ok).toBe(true);
    expect(balanceOf(customer.id)).toBe(-70_000);
  });

  it('deletes a transaction and restores the previous balance', () => {
    const customer = seedCustomer();
    addCredit(customer.id, 500, store().today);
    const tx = addCredit(customer.id, 300, store().today);
    expect(balanceOf(customer.id)).toBe(80_000);

    expect(store().deleteTransaction(tx.id).ok).toBe(true);
    expect(balanceOf(customer.id)).toBe(50_000);
  });
});

describe('sample import through the store', () => {
  it('imports the supplied file and computes the exact total', () => {
    const seeded = seedSample();
    expect(seeded.customerCount).toBe(8);
    expect(seeded.entryCount).toBe(38);

    const state = store();
    expect(state.customers).toHaveLength(8);
    expect(state.transactions).toHaveLength(38);

    const totals = shopTotals(state.customers, buildTotalsIndex(state.transactions));
    expect(totals.outstandingPaise).toBe(1_182_000);

    const ravi = state.customers.find((customer) => customer.phone === '9000000101');
    expect(ravi).toBeTruthy();
    expect(balanceOf(ravi?.id ?? '')).toBe(67_000);
  });

  it('is idempotent across repeated imports', () => {
    seedSample();
    seedSample();
    const state = store();
    expect(state.customers).toHaveLength(8);
    expect(state.transactions).toHaveLength(38);
    expect(
      shopTotals(state.customers, buildTotalsIndex(state.transactions)).outstandingPaise,
    ).toBe(1_182_000);
  });

  it('adopts the imported shop name only while the shop is unnamed', () => {
    seedSample();
    expect(store().settings.shopName).toBe('Lakshmi Provision Store (fictional)');

    const renamed = store().updateSettings({ shopName: 'My Real Shop' });
    expect(renamed.ok).toBe(true);
    expect(store().settings.shopName).toBe('My Real Shop');
  });
});

describe('settings, backup and persistence', () => {
  it('validates and persists settings', () => {
    const bad = store().updateSettings({ upiId: 'not-a-vpa' });
    expect(bad.ok).toBe(false);

    const good = store().updateSettings({
      shopName: 'Lakshmi Store',
      upiId: 'lakshmi@okhdfcbank',
      overdueDays: 45,
      maskPhones: false,
    });
    expect(good.ok).toBe(true);
    __resetHisaabState();
    expect(store().settings).toMatchObject({
      shopName: 'Lakshmi Store',
      upiId: 'lakshmi@okhdfcbank',
      overdueDays: 45,
      maskPhones: false,
    });
  });

  it('survives a reload (re-hydration from storage)', () => {
    const customer = seedCustomer('Ravi Kumar', '9000000101');
    addCredit(customer.id, 250, store().today);

    __resetHisaabState();

    const state = store();
    expect(state.customers).toHaveLength(1);
    expect(state.transactions).toHaveLength(1);
    expect(balanceOf(customer.id)).toBe(25_000);
  });

  it('restores a validated backup', () => {
    const customer = seedCustomer('Ravi', '9000000101');
    addCredit(customer.id, 250, store().today);
    const state = store();
    const file = buildBackup(state.settings, state.customers, state.transactions);

    store().resetAll();
    expect(store().customers).toHaveLength(0);

    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(store().restoreBackup(parsed.value).ok).toBe(true);
    expect(store().customers).toHaveLength(1);
    expect(store().transactions).toHaveLength(1);
    expect(balanceOf(customer.id)).toBe(25_000);
  });

  it('clears everything on reset', () => {
    seedSample();
    store().resetAll();
    expect(store().customers).toHaveLength(0);
    expect(store().transactions).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEYS.customers)).toBeNull();
  });

  it('surfaces corrupted storage without crashing', () => {
    window.localStorage.setItem(STORAGE_KEYS.customers, '{"version":1,"data":[');
    __resetHisaabState();
    const notice = store().storageNotice;
    expect(notice?.code).toBe('corrupt');
    expect(store().customers).toHaveLength(0);
  });

  it('hides orphan transactions and reports them', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.transactions,
      JSON.stringify({
        version: 1,
        savedAt: 0,
        data: [
          {
            id: 'txn_orphan',
            customerId: 'cus_missing',
            type: 'credit',
            amountPaise: 5000,
            date: '2026-01-01',
            note: '',
            screenshotId: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );
    __resetHisaabState();
    expect(store().transactions).toHaveLength(0);
    expect(store().storageNotice?.code).toBe('orphans');
    expect(store().storageNotice?.count).toBe(1);
  });
});
