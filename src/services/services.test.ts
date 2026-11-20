import { describe, expect, it } from 'vitest';
import type { Customer } from '@/types';
import {
  STORAGE_KEYS,
  loadCustomers,
  loadSettings,
  loadTransactions,
  saveCustomers,
  saveSettings,
  saveTransactions,
  storageFootprint,
} from '@/services/storage';
import {
  deleteScreenshot,
  getScreenshot,
  getScreenshotUrl,
  prepareScreenshot,
  saveScreenshot,
  validateScreenshotFile,
} from '@/services/screenshots';

function customer(id: string, name: string, phone: string): Customer {
  return { id, name, phone, createdAt: 1, updatedAt: 1 };
}

describe('localStorage repository', () => {
  it('round-trips customers, transactions and settings', () => {
    const list = [customer('cus_1', 'Ravi', '9000000001')];
    expect(saveCustomers(list).ok).toBe(true);
    expect(loadCustomers().data).toEqual(list);

    expect(
      saveTransactions([
        {
          id: 'txn_1',
          customerId: 'cus_1',
          type: 'credit',
          amountPaise: 25_000,
          date: '2026-11-01',
          note: 'rice',
          screenshotId: null,
          createdAt: 2,
          updatedAt: 2,
        },
      ]).ok,
    ).toBe(true);
    expect(loadTransactions().data).toHaveLength(1);

    expect(
      saveSettings({
        shopName: 'Lakshmi Store',
        upiId: '',
        language: 'te',
        theme: 'dark',
        overdueDays: 45,
        maskPhones: false,
      }).ok,
    ).toBe(true);
    expect(loadSettings().data).toMatchObject({
      shopName: 'Lakshmi Store',
      language: 'te',
      theme: 'dark',
      overdueDays: 45,
      maskPhones: false,
    });
  });

  it('wraps data in a versioned envelope', () => {
    saveCustomers([customer('cus_1', 'Ravi', '9000000001')]);
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.customers) ?? '{}');
    expect(raw.version).toBe(1);
    expect(raw.savedAt).toEqual(expect.any(Number));
    expect(Array.isArray(raw.data)).toBe(true);
  });

  it('quarantines corrupt JSON instead of destroying it', () => {
    const corrupt = '{"version":1,"data":[';
    window.localStorage.setItem(STORAGE_KEYS.customers, corrupt);

    const loaded = loadCustomers();
    expect(loaded.corrupted).toBe(true);
    expect(loaded.data).toEqual([]);
    expect(loaded.message).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEYS.customers)).toBe(corrupt);

    const quarantineKeys = Object.keys(window.localStorage).filter((key) =>
      key.includes('quarantine'),
    );
    expect(quarantineKeys.length).toBe(1);
    expect(window.localStorage.getItem(quarantineKeys[0] ?? '')).toBe(corrupt);
  });

  it('drops malformed records and duplicate phones', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.customers,
      JSON.stringify({
        version: 1,
        savedAt: 0,
        data: [
          customer('cus_1', 'Ravi', '9000000001'),
          customer('cus_2', 'Imposter', '9000000001'),
          { id: 'cus_3', name: '', phone: '9000000003' },
          { nope: true },
        ],
      }),
    );
    const loaded = loadCustomers();
    expect(loaded.data).toHaveLength(1);
    expect(loaded.dropped).toBe(3);
    expect(loaded.corrupted).toBe(true);
  });

  it('drops transactions with impossible money or dates', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.transactions,
      JSON.stringify({
        version: 1,
        savedAt: 0,
        data: [
          {
            id: 'txn_ok',
            customerId: 'cus_1',
            type: 'credit',
            amountPaise: 100,
            date: '2026-01-01',
            note: '',
            screenshotId: null,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'txn_float',
            customerId: 'cus_1',
            type: 'credit',
            amountPaise: 99.5,
            date: '2026-01-01',
            note: '',
            screenshotId: null,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'txn_bad_date',
            customerId: 'cus_1',
            type: 'payment',
            amountPaise: 100,
            date: '2026-02-30',
            note: '',
            screenshotId: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );
    const loaded = loadTransactions();
    expect(loaded.data.map((tx) => tx.id)).toEqual(['txn_ok']);
    expect(loaded.dropped).toBe(2);
  });

  it('normalises unknown settings to safe defaults', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        version: 1,
        savedAt: 0,
        data: { shopName: '  ', language: 'fr', theme: 'neon', overdueDays: 9000 },
      }),
    );
    const loaded = loadSettings();
    expect(loaded.data.shopName).toBe('My Shop');
    expect(loaded.data.language).toBe('en');
    expect(loaded.data.theme).toBe('system');
    expect(loaded.data.overdueDays).toBe(30);
    expect(loaded.data.maskPhones).toBe(true);
  });

  it('reports its footprint', () => {
    saveCustomers([customer('cus_1', 'Ravi', '9000000001')]);
    const footprint = storageFootprint();
    expect(footprint.customers).toBeGreaterThan(0);
    expect(footprint.total).toBe(footprint.customers + footprint.transactions);
  });
});

describe('IndexedDB screenshots', () => {
  it('stores, resolves and deletes a blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const id = await saveScreenshot(blob, 'image/png', { width: 10, height: 10 });
    expect(id.startsWith('shot_')).toBe(true);

    const stored = await getScreenshot(id);
    expect(stored).toBeInstanceOf(Blob);
    expect(stored?.size).toBe(4);

    const url = await getScreenshotUrl(id);
    expect(url).toBeTruthy();

    await deleteScreenshot(id);
    expect(await getScreenshot(id)).toBeNull();
  });

  it('returns null for unknown or missing ids', async () => {
    expect(await getScreenshot('shot_missing')).toBeNull();
    expect(await getScreenshotUrl('shot_missing')).toBeNull();
  });

  it('validates file type and size before upload', () => {
    expect(
      validateScreenshotFile(new File(['x'], 'receipt.png', { type: 'image/png' })),
    ).toEqual({ ok: true });
    expect(
      validateScreenshotFile(new File(['x'], 'receipt.webp', { type: 'image/webp' })),
    ).toEqual({ ok: true });
    expect(
      validateScreenshotFile(new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })),
    ).toEqual({ ok: true });
    expect(validateScreenshotFile(new File(['x'], 'note.gif', { type: 'image/gif' }))).toEqual({
      ok: false,
      code: 'screenshot_type',
    });
    expect(validateScreenshotFile(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))).toEqual(
      { ok: false, code: 'screenshot_type' },
    );

    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    expect(validateScreenshotFile(big)).toEqual({ ok: false, code: 'screenshot_size' });
  });

  it('falls back gracefully when canvas APIs are unavailable', async () => {
    const file = new File([new Uint8Array([9, 9])], 'receipt.png', { type: 'image/png' });
    const prepared = await prepareScreenshot(file);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.blob.size).toBe(2);
      expect(prepared.mime).toBe('image/png');
    }
  });
});
