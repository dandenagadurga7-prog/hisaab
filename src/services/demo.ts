import { useStore } from '@/store/useStore';
import { planImport } from '@/lib/jsonImport';
import sampleData from '@/data/sampleData.json';

export interface DemoResult {
  ok: boolean;
  customers: number;
  entries: number;
  errors: string[];
}

/**
 * Loads the bundled fictional shop (8 customers, 38 entries) through the same
 * validated import pipeline used for real files — no special-case data path.
 */
export function loadDemoData(): DemoResult {
  const state = useStore.getState();
  const parsed = planImport(JSON.stringify(sampleData), {
    existingCustomers: state.customers,
    existingTransactions: state.transactions,
    today: state.today,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      customers: 0,
      entries: 0,
      errors: parsed.errors.map((error) => `${error.path}: ${error.message}`),
    };
  }

  const applied = state.applyImport(parsed.plan);
  if (!applied.ok) {
    return { ok: false, customers: 0, entries: 0, errors: ['Import could not be applied.'] };
  }
  return {
    ok: true,
    customers: applied.value.customers,
    entries: applied.value.entries,
    errors: [],
  };
}
