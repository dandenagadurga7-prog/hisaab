import type { Language, Settings, ThemeMode } from '@/types';

export const DEFAULT_SHOP_NAME = 'My Shop';

export const DEFAULT_SETTINGS: Settings = {
  shopName: DEFAULT_SHOP_NAME,
  upiId: '',
  language: 'en',
  theme: 'system',
  overdueDays: 30,
  maskPhones: true,
};

const LANGUAGES: Language[] = ['en', 'hi', 'te'];
const THEMES: ThemeMode[] = ['light', 'dark', 'system'];

/** Defensive settings normaliser used on hydrate, restore and import. */
export function normalizeSettings(raw: unknown): Settings {
  const value = (raw ?? {}) as Record<string, unknown>;
  const language = LANGUAGES.includes(value.language as Language)
    ? (value.language as Language)
    : DEFAULT_SETTINGS.language;
  const theme = THEMES.includes(value.theme as ThemeMode)
    ? (value.theme as ThemeMode)
    : DEFAULT_SETTINGS.theme;
  const overdueDays =
    typeof value.overdueDays === 'number' &&
    Number.isInteger(value.overdueDays) &&
    value.overdueDays >= 1 &&
    value.overdueDays <= 365
      ? value.overdueDays
      : DEFAULT_SETTINGS.overdueDays;

  return {
    shopName:
      typeof value.shopName === 'string' && value.shopName.trim()
        ? value.shopName.trim().slice(0, 60)
        : DEFAULT_SETTINGS.shopName,
    upiId: typeof value.upiId === 'string' ? value.upiId.trim().slice(0, 120) : '',
    language,
    theme,
    overdueDays,
    maskPhones: typeof value.maskPhones === 'boolean' ? value.maskPhones : true,
  };
}
