import { useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { translate, type TranslateVars } from '@/i18n';

/** Translation hook bound to the current language setting. */
export function useT() {
  const language = useStore((state) => state.settings.language);
  return useCallback(
    (key: string, vars?: TranslateVars) => translate(language, key, vars),
    [language],
  );
}

export function useLanguage() {
  return useStore((state) => state.settings.language);
}

export type { TranslateVars };
