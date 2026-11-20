import { useEffect, useState, type ReactNode } from 'react';
import {
  AlarmClock,
  Globe,
  LayoutDashboard,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  Sun,
  Upload,
  Wallet,
} from 'lucide-react';
import type { Language } from '@/types';
import { cn } from '@/lib/cn';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useRoute, customerHref } from '@/router';
import { LANGUAGE_OPTIONS } from '@/i18n';

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return dark;
}

export function LanguageSelect({ className }: { className?: string }) {
  const language = useStore((state) => state.settings.language);
  const updateSettings = useStore((state) => state.updateSettings);
  const t = useT();

  return (
    <div className={cn('relative', className)}>
      <Globe
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <select
        aria-label={t('settings.language')}
        value={language}
        onChange={(event) => {
          updateSettings({ language: event.target.value as Language });
        }}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-surface pl-8 pr-7 text-xs font-semibold text-ink outline-none transition hover:bg-surface2 focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useStore((state) => state.settings.theme);
  const updateSettings = useStore((state) => state.updateSettings);
  const prefersDark = usePrefersDark();
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-surface2 hover:text-ink',
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

const NAV = [
  { path: '/', name: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/overdue', name: 'overdue', labelKey: 'nav.overdue', icon: AlarmClock },
  { path: '/import', name: 'import', labelKey: 'nav.import', icon: Upload },
  { path: '/settings', name: 'settings', labelKey: 'nav.settings', icon: Settings2 },
] as const;

function Brand({ compact }: { compact?: boolean }) {
  return (
    <a href="#/" className="flex items-center gap-2.5 outline-none" aria-label="Hisaab home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
        <Wallet className="h-5 w-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className={cn('block font-bold tracking-tight text-ink', compact ? 'text-[15px]' : 'text-base')}>
          Hisaab
        </span>
        <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">
          Digital Khata
        </span>
      </span>
    </a>
  );
}

export interface AppShellProps {
  children: ReactNode;
  onAddCustomer: () => void;
}

export function AppShell({ children, onAddCustomer }: AppShellProps) {
  const route = useRoute();
  const t = useT();
  const shopName = useStore((state) => state.settings.shopName);

  return (
    <div className="min-h-dvh lg:pl-[268px]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
      >
        {t('a11y.skip')}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="px-1">
          <Brand />
        </div>

        <nav className="mt-7 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((item) => {
            const active = route.name === item.name || (item.name === 'dashboard' && route.name === 'customer');
            const Icon = item.icon;
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                aria-current={active ? 'page' : undefined}
                className={cn('nav-item', active && 'nav-item-active')}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span>{t(item.labelKey)}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-line bg-surface2/60 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="text-[11px] leading-relaxed text-muted">{t('settings.offline')}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 px-0.5">
          <LanguageSelect />
          <ThemeToggle />
        </div>
        <p className="mt-3 truncate px-1 text-[11px] text-muted/70" title={shopName}>
          {shopName}
        </p>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-app/85 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Brand compact />
          <div className="flex items-center gap-1.5">
            <LanguageSelect />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:pb-12 lg:pt-7">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          <MobileTab item={NAV[0]} active={route.name === 'dashboard' || route.name === 'customer'} />
          <MobileTab item={NAV[1]} active={route.name === 'overdue'} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onAddCustomer}
              aria-label={t('nav.addCustomer')}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-pop transition hover:brightness-110 active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <MobileTab item={NAV[2]} active={route.name === 'import'} />
          <MobileTab item={NAV[3]} active={route.name === 'settings'} />
        </div>
        <div className="h-1" />
      </nav>
    </div>
  );
}

function MobileTab({
  item,
  active,
}: {
  item: (typeof NAV)[number];
  active: boolean;
}) {
  const t = useT();
  const Icon = item.icon;
  return (
    <a
      href={`#${item.path}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10.5px] font-semibold transition-colors',
        active ? 'text-accent' : 'text-muted hover:text-ink',
      )}
    >
      <Icon className="h-[19px] w-[19px]" aria-hidden />
      <span className="leading-none">{t(item.labelKey)}</span>
    </a>
  );
}

export { customerHref };
