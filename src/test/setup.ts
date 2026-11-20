import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { clearStoredData } from '@/services/storage';
import { clearScreenshots, clearScreenshotUrlCache } from '@/services/screenshots';
import { __resetHisaabState } from '@/store/useStore';

// jsdom has no matchMedia; the app uses it for the "system" theme.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// jsdom does not implement object URLs, which screenshots rely on.
let objectUrlSequence = 0;
if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: () => {
      objectUrlSequence += 1;
      return `blob:hisaab-test-${objectUrlSequence}`;
    },
  });
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    configurable: true,
    value: () => undefined,
  });
}

if (typeof window !== 'undefined') {
  window.scrollTo = () => undefined;
}

beforeEach(async () => {
  window.history.replaceState(null, '', '/');
  clearStoredData();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
  await clearScreenshots();
  clearScreenshotUrlCache();
  __resetHisaabState();
});

afterEach(() => {
  cleanup();
});
