import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { cn } from '@/lib/cn';

const TONES = {
  success: 'border-accent/25 bg-surface text-ink',
  error: 'border-danger/30 bg-surface text-ink',
  info: 'border-info/25 bg-surface text-ink',
} as const;

const ICONS = {
  success: <CheckCircle2 className="h-4.5 w-4.5 text-accent" />,
  error: <AlertCircle className="h-4.5 w-4.5 text-danger" />,
  info: <Info className="h-4.5 w-4.5 text-info" />,
} as const;

export function Toasts() {
  const toasts = useStore((state) => state.toasts);
  const dismiss = useStore((state) => state.dismissToast);
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-pop',
            TONES[toast.kind],
          )}
        >
          <span className="mt-0.5 shrink-0">{ICONS[toast.kind]}</span>
          <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
            {t(toast.key, toast.vars)}
          </p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label={t('common.dismiss')}
            className="shrink-0 rounded-md p-0.5 text-muted hover:bg-surface2 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
