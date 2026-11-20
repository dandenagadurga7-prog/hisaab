/**
 * Registers the offline shell. Only in production builds — a service worker in
 * development would serve stale bundles to the developer.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(url).catch(() => {
      /* offline caching is an enhancement; never block the app */
    });
  });
}
