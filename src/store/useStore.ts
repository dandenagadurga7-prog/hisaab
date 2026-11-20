import { create } from 'zustand';
import type {
  Customer,
  CustomerInput,
  Result,
  Settings,
  Toast,
  ToastKind,
  Transaction,
  TransactionInput,
} from '@/types';
import { DEFAULT_SHOP_NAME, DEFAULT_SETTINGS, normalizeSettings } from '@/lib/defaults';
import { resolveToday } from '@/lib/dates';
import { createId } from '@/lib/id';
import { MAX_AMOUNT_PAISE } from '@/lib/money';
import {
  normalizePhone,
  normalizeWhitespace,
  validateDate,
  validateName,
  validateNote,
  validatePhone,
  validateShopName,
  validateUpi,
} from '@/lib/validate';
import type { ImportPlan } from '@/lib/jsonImport';
import type { BackupContents } from '@/lib/backup';
import {
  clearStoredData,
  loadCustomers,
  loadSettings,
  loadTransactions,
  onExternalStorageChange,
  saveCustomers,
  saveSettings,
  saveTransactions,
  type SaveResult,
} from '@/services/storage';
import { clearScreenshots, deleteScreenshots } from '@/services/screenshots';

export interface StorageNotice {
  code: 'corrupt' | 'quota' | 'unavailable' | 'orphans';
  message?: string;
  count?: number;
}

type PersistScope = 'customers' | 'transactions' | 'settings' | 'all';

interface AppState {
  customers: Customer[];
  transactions: Transaction[];
  settings: Settings;
  hydrated: boolean;
  today: string;
  storageNotice: StorageNotice | null;
  orphanCount: number;
  dismissNotice: () => void;
  toasts: Toast[];

  init: () => void;
  pushToast: (key: string, kind?: ToastKind, vars?: Toast['vars']) => void;
  dismissToast: (id: string) => void;

  addCustomer: (
    input: CustomerInput,
    options?: { openingBalancePaise?: number; openingDate?: string; openingNote?: string },
  ) => Result<Customer>;
  updateCustomer: (id: string, input: CustomerInput) => Result<Customer>;
  deleteCustomer: (id: string) => Result<Customer>;

  addTransaction: (input: TransactionInput) => Result<Transaction>;
  updateTransaction: (
    id: string,
    patch: Partial<Omit<TransactionInput, 'customerId'>>,
  ) => Result<Transaction>;
  deleteTransaction: (id: string) => Result<Transaction>;

  applyImport: (plan: ImportPlan) => Result<{ customers: number; entries: number }>;
  updateSettings: (patch: Partial<Settings>) => Result<Settings>;
  restoreBackup: (contents: BackupContents) => Result<true>;
  resetAll: () => void;
}

let toastSeq = 0;

function noticeFromSave(result: SaveResult): StorageNotice | null {
  if (result.ok) return null;
  if (result.code === 'quota') return { code: 'quota' };
  return { code: 'unavailable' };
}

function findDuplicate(
  customers: Customer[],
  phone: string,
  excludeId?: string,
): Customer | undefined {
  return customers.find((customer) => customer.phone === phone && customer.id !== excludeId);
}

function validateCustomerInput(
  input: CustomerInput,
  customers: Customer[],
  excludeId?: string,
): Result<{ name: string; phone: string }> {
  const name = validateName(input?.name ?? '');
  const phone = validatePhone(input?.phone ?? '');

  if (!name.ok || !phone.ok) {
    return { ok: false, errors: [...(!name.ok ? name.errors : []), ...(!phone.ok ? phone.errors : [])] };
  }
  if (findDuplicate(customers, phone.value, excludeId)) {
    return { ok: false, errors: [{ field: 'phone', code: 'phone_duplicate' }] };
  }
  return { ok: true, value: { name: name.value, phone: phone.value } };
}

export const useStore = create<AppState>()((set, get) => {
  const commit = (
    patch: Partial<Pick<AppState, 'customers' | 'transactions' | 'settings'>>,
    scope: PersistScope,
  ): StorageNotice | null => {
    const next = { ...get(), ...patch };
    set({ ...patch });

    let result: SaveResult = { ok: true };
    if (scope === 'customers' || scope === 'all') result = saveCustomers(next.customers);
    if (result.ok && (scope === 'transactions' || scope === 'all')) {
      result = saveTransactions(next.transactions);
    }
    if (result.ok && (scope === 'settings' || scope === 'all')) {
      result = saveSettings(next.settings);
    }

    const notice = noticeFromSave(result);
    if (notice) {
      set({ storageNotice: notice });
    } else {
      const currentNotice = get().storageNotice;
      if (currentNotice?.code === 'quota' || currentNotice?.code === 'unavailable') {
        set({ storageNotice: null });
      }
    }
    return notice;
  };

  return {
    customers: [],
    transactions: [],
    settings: { ...DEFAULT_SETTINGS },
    hydrated: false,
    today: resolveToday(typeof window === 'undefined' ? '' : window.location.search),
    storageNotice: null,
    orphanCount: 0,
    toasts: [],

    init: () => {
      if (get().hydrated) return;
      if (typeof window === 'undefined') {
        set({ hydrated: true });
        return;
      }

      const customersLoad = loadCustomers();
      const transactionsLoad = loadTransactions();
      const settingsLoad = loadSettings();

      const customerIds = new Set(customersLoad.data.map((customer) => customer.id));
      const orphans = transactionsLoad.data.filter((tx) => !customerIds.has(tx.customerId));
      const transactions = transactionsLoad.data.filter((tx) => customerIds.has(tx.customerId));

      let notice: StorageNotice | null = null;
      if (customersLoad.corrupted || transactionsLoad.corrupted || settingsLoad.corrupted) {
        notice = {
          code: 'corrupt',
          message:
            customersLoad.message ?? transactionsLoad.message ?? settingsLoad.message ?? undefined,
        };
      }
      if (orphans.length > 0) {
        notice = { code: 'orphans', count: orphans.length };
      }

      set({
        customers: customersLoad.data,
        transactions,
        settings: settingsLoad.data,
        orphanCount: orphans.length,
        storageNotice: notice,
        hydrated: true,
        today: resolveToday(window.location.search),
      });

      onExternalStorageChange(() => {
        const refreshedCustomers = loadCustomers();
        const refreshedTransactions = loadTransactions();
        const ids = new Set(refreshedCustomers.data.map((customer) => customer.id));
        set({
          customers: refreshedCustomers.data,
          transactions: refreshedTransactions.data.filter((tx) => ids.has(tx.customerId)),
          settings: loadSettings().data,
        });
        get().pushToast('toast.otherTab', 'info');
      });
    },

    pushToast: (key, kind = 'success', vars) => {
      toastSeq += 1;
      const toast: Toast = { id: `toast_${toastSeq}`, key, kind, vars };
      set({ toasts: [...get().toasts.slice(-3), toast] });
      window.setTimeout(() => {
        set({ toasts: get().toasts.filter((item) => item.id !== toast.id) });
      }, 4200);
    },

    dismissToast: (id) => {
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
    },

    dismissNotice: () => set({ storageNotice: null }),

    addCustomer: (input, options) => {
      get().init();
      const validated = validateCustomerInput(input, get().customers);
      if (!validated.ok) return validated;

      const opening = options?.openingBalancePaise ?? 0;
      if (!Number.isInteger(opening) || opening < 0 || opening > MAX_AMOUNT_PAISE) {
        return { ok: false, errors: [{ field: 'openingBalance', code: 'amount_invalid' }] };
      }

      let openingTransaction: Transaction | null = null;
      if (opening > 0) {
        const date = validateDate(options?.openingDate ?? get().today, get().today);
        if (!date.ok) return { ok: false, errors: date.errors };

        const now = Date.now();
        openingTransaction = {
          id: createId('txn'),
          customerId: '',
          type: 'credit',
          amountPaise: opening,
          date: date.value,
          note: (options?.openingNote ?? 'Opening balance').slice(0, 200),
          screenshotId: null,
          createdAt: now,
          updatedAt: now,
        };
      }

      const now = Date.now();
      const customer: Customer = {
        id: createId('cus'),
        name: validated.value.name,
        phone: validated.value.phone,
        createdAt: now,
        updatedAt: now,
      };

      if (openingTransaction) openingTransaction.customerId = customer.id;

      commit(
        {
          customers: [...get().customers, customer],
          transactions: openingTransaction
            ? [...get().transactions, openingTransaction]
            : get().transactions,
        },
        'all',
      );
      return { ok: true, value: customer };
    },

    updateCustomer: (id, input) => {
      get().init();
      const existing = get().customers.find((customer) => customer.id === id);
      if (!existing) return { ok: false, errors: [{ field: 'id', code: 'customer_not_found' }] };

      const validated = validateCustomerInput(input, get().customers, id);
      if (!validated.ok) return validated;

      const updated: Customer = {
        ...existing,
        name: validated.value.name,
        phone: validated.value.phone,
        updatedAt: Date.now(),
      };
      commit(
        { customers: get().customers.map((customer) => (customer.id === id ? updated : customer)) },
        'customers',
      );
      return { ok: true, value: updated };
    },

    deleteCustomer: (id) => {
      get().init();
      const existing = get().customers.find((customer) => customer.id === id);
      if (!existing) return { ok: false, errors: [{ field: 'id', code: 'customer_not_found' }] };

      const removed = get().transactions.filter((tx) => tx.customerId === id);
      const remaining = get().transactions.filter((tx) => tx.customerId !== id);
      const screenshotIds = removed
        .map((tx) => tx.screenshotId)
        .filter((shot): shot is string => typeof shot === 'string' && shot.length > 0);

      const notice = commit(
        {
          customers: get().customers.filter((customer) => customer.id !== id),
          transactions: remaining,
        },
        'all',
      );
      if (screenshotIds.length > 0) void deleteScreenshots(screenshotIds);
      if (notice) get().pushToast('toast.storageFailed', 'error');
      return { ok: true, value: existing };
    },

    addTransaction: (input) => {
      get().init();
      const customer = get().customers.find((item) => item.id === input.customerId);
      if (!customer) return { ok: false, errors: [{ field: 'customerId', code: 'customer_not_found' }] };
      if (input.type !== 'credit' && input.type !== 'payment') {
        return { ok: false, errors: [{ field: 'type', code: 'type_invalid' }] };
      }

      const amount = Number(input.amountPaise);
      if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_PAISE) {
        return { ok: false, errors: [{ field: 'amount', code: 'amount_invalid' }] };
      }

      const date = validateDate(input.date, get().today);
      if (!date.ok) return { ok: false, errors: date.errors };

      const note = validateNote(input.note ?? '');
      if (!note.ok) return { ok: false, errors: note.errors };

      const now = Date.now();
      const transaction: Transaction = {
        id: createId('txn'),
        customerId: input.customerId,
        type: input.type,
        amountPaise: amount,
        date: date.value,
        note: note.value,
        screenshotId: input.screenshotId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      commit({ transactions: [...get().transactions, transaction] }, 'transactions');
      return { ok: true, value: transaction };
    },

    updateTransaction: (id, patch) => {
      get().init();
      const existing = get().transactions.find((tx) => tx.id === id);
      if (!existing) {
        return { ok: false, errors: [{ field: 'id', code: 'transaction_not_found' }] };
      }

      const type = patch.type ?? existing.type;
      if (type !== 'credit' && type !== 'payment') {
        return { ok: false, errors: [{ field: 'type', code: 'type_invalid' }] };
      }

      const amount = Number(patch.amountPaise ?? existing.amountPaise);
      if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_PAISE) {
        return { ok: false, errors: [{ field: 'amount', code: 'amount_invalid' }] };
      }

      const date = validateDate(patch.date ?? existing.date, get().today);
      if (!date.ok) return { ok: false, errors: date.errors };

      const note = validateNote(patch.note ?? existing.note);
      if (!note.ok) return { ok: false, errors: note.errors };

      const updated: Transaction = {
        ...existing,
        type,
        amountPaise: amount,
        date: date.value,
        note: note.value,
        screenshotId:
          patch.screenshotId === undefined ? existing.screenshotId : patch.screenshotId,
        updatedAt: Date.now(),
      };
      commit(
        {
          transactions: get().transactions.map((tx) => (tx.id === id ? updated : tx)),
        },
        'transactions',
      );
      return { ok: true, value: updated };
    },

    deleteTransaction: (id) => {
      get().init();
      const existing = get().transactions.find((tx) => tx.id === id);
      if (!existing) {
        return { ok: false, errors: [{ field: 'id', code: 'transaction_not_found' }] };
      }
      commit(
        { transactions: get().transactions.filter((tx) => tx.id !== id) },
        'transactions',
      );
      if (existing.screenshotId) void deleteScreenshots([existing.screenshotId]);
      return { ok: true, value: existing };
    },

    applyImport: (plan) => {
      get().init();
      const current = get();
      const settings = { ...current.settings };
      if (plan.shopNameSuggestion && settings.shopName === DEFAULT_SHOP_NAME) {
        settings.shopName = plan.shopNameSuggestion;
      }

      const customers = [...current.customers, ...plan.newCustomers];
      const transactions = [...current.transactions, ...plan.newTransactions];
      commit({ customers, transactions, settings }, 'all');

      return {
        ok: true,
        value: { customers: plan.newCustomers.length, entries: plan.newTransactions.length },
      };
    },

    updateSettings: (patch) => {
      get().init();
      const merged = normalizeSettings({ ...get().settings, ...patch });

      if (typeof patch.shopName === 'string') {
        const shop = validateShopName(patch.shopName);
        if (!shop.ok) return { ok: false, errors: shop.errors };
        merged.shopName = shop.value;
      }
      if (typeof patch.upiId === 'string') {
        const upi = validateUpi(patch.upiId);
        if (!upi.ok) return { ok: false, errors: upi.errors };
        merged.upiId = upi.value;
      }

      commit({ settings: merged }, 'settings');
      return { ok: true, value: merged };
    },

    restoreBackup: (contents) => {
      get().init();
      const settings = normalizeSettings(contents.settings);
      commit(
        {
          customers: contents.customers,
          transactions: contents.transactions,
          settings,
        },
        'all',
      );
      set({ storageNotice: null });
      return { ok: true, value: true };
    },

    resetAll: () => {
      clearStoredData();
      void clearScreenshots();
      set({
        customers: [],
        transactions: [],
        settings: { ...DEFAULT_SETTINGS },
        storageNotice: null,
        orphanCount: 0,
      });
    },
  };
});

/** Test helper: clear in-memory state and reload from storage. */
export function __resetHisaabState(): void {
  useStore.setState({
    customers: [],
    transactions: [],
    settings: { ...DEFAULT_SETTINGS },
    hydrated: false,
    storageNotice: null,
    orphanCount: 0,
    toasts: [],
  });
  useStore.getState().init();
}

/** Convenience selectors (kept outside components for reuse). */
export const selectCustomerByPhone = (phone: string) => (state: AppState) =>
  state.customers.find((customer) => customer.phone === phone);

export const selectCustomerById = (id: string) => (state: AppState) =>
  state.customers.find((customer) => customer.id === id);

export type { AppState };

export function normalizePhoneInput(value: string): string {
  return normalizePhone(value);
}

export function normalizeNameInput(value: string): string {
  return normalizeWhitespace(value);
}
