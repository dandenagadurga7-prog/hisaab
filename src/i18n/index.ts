import type { Language } from '@/types';
import { en, type Dict } from './locales/en';
import { hi } from './locales/hi';
import { te } from './locales/te';

export const DICTIONARIES: Record<Language, Dict> = { en, hi, te };

export const LANGUAGE_OPTIONS: Array<{ value: Language; labelKey: string }> = [
  { value: 'en', labelKey: 'lang.en' },
  { value: 'hi', labelKey: 'lang.hi' },
  { value: 'te', labelKey: 'lang.te' },
];

export type TranslateVars = Record<string, string | number>;

/**
 * Looks up a key in the selected language, falls back to English, then to the
 * key itself so a missing translation is visible but never crashes the UI.
 * `{placeholders}` are replaced with the supplied variables.
 */
export function translate(language: Language, key: string, vars?: TranslateVars): string {
  const dict = DICTIONARIES[language] ?? en;
  const template = dict[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/** Regional locale for numbers and dates. */
export function numberLocale(language: Language): string {
  if (language === 'hi') return 'hi-IN';
  if (language === 'te') return 'te-IN';
  return 'en-IN';
}
