import sampleData from './fixtures/sample-data.json';
import expected from './fixtures/sample-expected.json';
import { planImport } from '@/lib/jsonImport';
import { __resetHisaabState, useStore } from '@/store/useStore';

export const SAMPLE_TEXT = JSON.stringify(sampleData);
export const EXPECTED = expected as {
  today: string;
  total_outstanding: number;
  balances: Record<string, number>;
  top_defaulter_phone: string;
  customers_with_balance: number;
};

export interface SeededSample {
  customerIdByPhone: Map<string, string>;
  customerCount: number;
  entryCount: number;
}

/** Loads the supplied sample file through the real import pipeline. */
export function seedSample(): SeededSample {
  const state = useStore.getState();
  const parsed = planImport(SAMPLE_TEXT, {
    existingCustomers: state.customers,
    existingTransactions: state.transactions,
    today: state.today,
  });
  if (!parsed.ok) {
    throw new Error(parsed.errors.map((error) => `${error.path}: ${error.message}`).join('\n'));
  }
  const applied = state.applyImport(parsed.plan);
  if (!applied.ok) throw new Error('Sample import could not be applied.');

  return {
    customerIdByPhone: new Map(
      parsed.plan.newCustomers.map((customer) => [customer.phone, customer.id]),
    ),
    customerCount: parsed.plan.newCustomers.length,
    entryCount: parsed.plan.newTransactions.length,
  };
}

/** Sets the URL (for ?today=) and re-hydrates the store from storage. */
export function setUrl(url: string): void {
  window.history.replaceState(null, '', url);
  __resetHisaabState();
}

export function seedCustomer(name = 'Test Customer', phone = '9876500001') {
  const result = useStore.getState().addCustomer({ name, phone });
  if (!result.ok) throw new Error(`Could not seed customer: ${result.errors[0]?.code}`);
  return result.value;
}

export function addCredit(customerId: string, rupees: number, date: string, note = 'groceries') {
  const result = useStore.getState().addTransaction({
    customerId,
    type: 'credit',
    amountPaise: Math.round(rupees * 100),
    date,
    note,
  });
  if (!result.ok) throw new Error(`Could not add credit: ${result.errors[0]?.code}`);
  return result.value;
}

export function addPayment(customerId: string, rupees: number, date: string, note = 'paid on UPI') {
  const result = useStore.getState().addTransaction({
    customerId,
    type: 'payment',
    amountPaise: Math.round(rupees * 100),
    date,
    note,
  });
  if (!result.ok) throw new Error(`Could not add payment: ${result.errors[0]?.code}`);
  return result.value;
}
