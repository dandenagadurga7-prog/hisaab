import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useRoute } from '@/router';
import { cn } from '@/lib/cn';
import { AppShell } from '@/components/AppShell';
import { Toasts } from '@/components/Toasts';
import { AddCustomerDialog } from '@/components/CustomerDialogs';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomerPage } from '@/pages/CustomerPage';
import { OverduePage } from '@/pages/OverduePage';
import { ImportPage } from '@/pages/ImportPage';
import { SettingsPage } from '@/pages/SettingsPage';

function useAppliedTheme(theme: 'light' | 'dark' | 'system'): void {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && Boolean(media?.matches));
      document.documentElement.classList.toggle('dark', dark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0B120F' : '#0E7C5A');
    };

    apply();
    if (theme === 'system' && media) {
      media.addEventListener?.('change', apply);
      return () => media.removeEventListener?.('change', apply);
    }
    return undefined;
  }, [theme]);
}

function StorageBanner() {
  const notice = useStore((state) => state.storageNotice);
  const dismiss = useStore((state) => state.dismissNotice);
  const t = useT();

  if (!notice) return null;

  const message =
    notice.code === 'corrupt'
      ? notice.message ?? t('error.backup_invalid')
      : notice.code === 'orphans'
        ? t('storage.orphans', { count: notice.count ?? 0 })
        : notice.code === 'quota'
          ? t('storage.quota')
          : t('storage.unavailable');

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
        {t('storage.banner', { message })}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.dismiss')}
        className="shrink-0 rounded-md p-1 text-muted hover:bg-surface2 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-accent text-accent-ink">
        <span className="text-xl font-black">H</span>
      </div>
      <p className="text-sm font-medium text-muted">Hisaab</p>
    </div>
  );
}

interface BoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // A crash must never take the ledger with it: nothing is written here.
    console.error('Hisaab crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app p-6">
        <div className="card w-full max-w-md p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-base font-semibold text-ink">Something went wrong</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Your data is still saved in this browser. Reload to continue — export a backup from
            Settings as soon as the app opens.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary btn-md mt-4"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Hisaab
          </button>
        </div>
      </div>
    );
  }
}

function Routes({ onAddCustomer }: { onAddCustomer: () => void }) {
  const route = useRoute();

  let page: ReactNode;
  switch (route.name) {
    case 'customer':
      page = <CustomerPage />;
      break;
    case 'overdue':
      page = <OverduePage />;
      break;
    case 'import':
      page = <ImportPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'dashboard':
    case 'notFound':
    default:
      page = <DashboardPage onAddCustomer={onAddCustomer} />;
      break;
  }

  return (
    <AppShell onAddCustomer={onAddCustomer}>
      <StorageBanner />
      {page}
    </AppShell>
  );
}

export default function App() {
  const init = useStore((state) => state.init);
  const hydrated = useStore((state) => state.hydrated);
  const theme = useStore((state) => state.settings.theme);
  const language = useStore((state) => state.settings.language);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useAppliedTheme(theme);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.scrollTo) {
      try {
        window.scrollTo({ top: 0, behavior: 'auto' });
      } catch {
        /* ignore */
      }
    }
  }, [language, theme]);

  if (!hydrated) return <BootScreen />;

  return (
    <ErrorBoundary>
      <div className={cn('min-h-dvh bg-app')}>
        <Routes onAddCustomer={() => setAddOpen(true)} />
        <AddCustomerDialog open={addOpen} onClose={() => setAddOpen(false)} />
        <Toasts />
      </div>
    </ErrorBoundary>
  );
}
