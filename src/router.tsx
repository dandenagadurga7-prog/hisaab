import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'customer'; id: string }
  | { name: 'overdue' }
  | { name: 'import' }
  | { name: 'settings' }
  | { name: 'notFound' };

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', emit);
  window.addEventListener('popstate', emit);
}

export function parseRoute(hash: string): Route {
  const cleaned = hash.replace(/^#/, '').replace(/^\/+/, '');
  if (cleaned === '') return { name: 'dashboard' };
  const [path] = [cleaned.split('?')[0] ?? ''];
  const segments = path.split('/').filter(Boolean);

  const [head, id] = segments;
  if (!head) return { name: 'dashboard' };
  if (head === 'customer' && id) return { name: 'customer', id: decodeURIComponent(id) };
  if (head === 'overdue') return { name: 'overdue' };
  if (head === 'import') return { name: 'import' };
  if (head === 'settings') return { name: 'settings' };
  return { name: 'notFound' };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '');
  return parseRoute(hash);
}

/**
 * Hash navigation keeps the real query string (`?today=`) intact, so a demo
 * link stays on the demo date no matter where the owner navigates.
 */
export function navigate(path: string): void {
  if (typeof window === 'undefined') return;
  const nextHash = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash !== nextHash) {
    try {
      window.history.pushState(null, '', nextHash);
    } catch {
      window.location.hash = nextHash;
    }
  }
  emit();
}

export function customerHref(id: string): string {
  return `#/customer/${encodeURIComponent(id)}`;
}

export const ROUTE_PATHS = {
  dashboard: '/',
  overdue: '/overdue',
  import: '/import',
  settings: '/settings',
} as const;
