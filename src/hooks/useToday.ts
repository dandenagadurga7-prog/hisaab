import { useStore } from '@/store/useStore';
import { isValidISODate } from '@/lib/dates';

/** The app's effective "today" (honours ?today=YYYY-MM-DD). */
export function useToday(): string {
  return useStore((state) => state.today);
}

/** True when the date is being overridden for a demo or a test. */
export function isDateOverridden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const override = new URLSearchParams(window.location.search).get('today');
    return Boolean(override && isValidISODate(override));
  } catch {
    return false;
  }
}
