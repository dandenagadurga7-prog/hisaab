/**
 * HISAAB — shared domain types.
 *
 * Money is always stored in integer paise. Dates are date-only strings
 * ("YYYY-MM-DD") so that no timezone can ever shift a transaction by a day.
 */

export type TransactionType = 'credit' | 'payment';
export type Language = 'en' | 'hi' | 'te';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Customer {
  id: string;
  name: string;
  /** Exactly 10 digits, unique across the shop. */
  phone: string;
  createdAt: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  type: TransactionType;
  /** Integer paise, always > 0. */
  amountPaise: number;
  /** Local date the transaction happened, "YYYY-MM-DD". */
  date: string;
  note: string;
  /** IndexedDB key of the payment screenshot, or null. */
  screenshotId: string | null;
  createdAt: number;
  updatedAt: number;
  /** Deterministic fingerprint used to make JSON imports idempotent. */
  importHash?: string;
}

export interface Settings {
  shopName: string;
  upiId: string;
  language: Language;
  theme: ThemeMode;
  /** Days without a payment before a customer is considered overdue. */
  overdueDays: number;
  /** Mask phone numbers in list views (privacy on shared counters). */
  maskPhones: boolean;
}

export interface Totals {
  creditPaise: number;
  paymentPaise: number;
  balancePaise: number;
  txCount: number;
  lastPaymentDate: string | null;
  firstCreditDate: string | null;
  lastActivityDate: string | null;
}

export interface ShopTotals {
  outstandingPaise: number;
  creditPaise: number;
  paymentPaise: number;
  customersWithDues: number;
  advanceCustomers: number;
}

export type ErrorCode =
  | 'name_required'
  | 'name_too_long'
  | 'phone_invalid'
  | 'phone_duplicate'
  | 'amount_invalid'
  | 'amount_too_large'
  | 'date_invalid'
  | 'date_future'
  | 'date_too_old'
  | 'note_too_long'
  | 'type_invalid'
  | 'customer_not_found'
  | 'transaction_not_found'
  | 'shop_required'
  | 'upi_invalid'
  | 'screenshot_type'
  | 'screenshot_size'
  | 'backup_invalid'
  | 'storage_quota'
  | 'storage_unavailable'
  | 'ocr_unavailable';

export interface FieldError {
  field: string;
  code: ErrorCode;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  /** Translation key, resolved at render time. */
  key: string;
  vars?: Record<string, string | number>;
}

/** Raw shape accepted by the JSON importer (mirrors the supplied sample files). */
export interface ImportEntryRaw {
  phone?: unknown;
  type?: unknown;
  amount?: unknown;
  date?: unknown;
  note?: unknown;
}

export interface ImportPayloadRaw {
  shop?: unknown;
  customers?: unknown;
  entries?: unknown;
}

export interface CustomerInput {
  name: string;
  phone: string;
}

export interface TransactionInput {
  customerId: string;
  type: TransactionType;
  amountPaise: number;
  date: string;
  note: string;
  screenshotId?: string | null;
}
