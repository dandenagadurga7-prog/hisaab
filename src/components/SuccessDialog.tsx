import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './ui';
import { SuccessArt, type ArtKind } from './SuccessArt';
import { formatINR } from '@/lib/money';
import { cn } from '@/lib/cn';

export interface SuccessDialogProps {
  open: boolean;
  kind: ArtKind;
  title: string;
  subtitle?: string;
  amountPaise?: number;
  balancePaise?: number;
  balanceLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose: () => void;
  children?: ReactNode;
}

const CONFETTI = [
  { left: '12%', top: '18%', color: 'bg-accent/70', delay: '0ms', rotate: '18deg' },
  { left: '82%', top: '12%', color: 'bg-warn/70', delay: '140ms', rotate: '-24deg' },
  { left: '90%', top: '46%', color: 'bg-info/60', delay: '80ms', rotate: '40deg' },
  { left: '6%', top: '52%', color: 'bg-warn/60', delay: '220ms', rotate: '-12deg' },
  { left: '70%', top: '4%', color: 'bg-accent/50', delay: '300ms', rotate: '8deg' },
];

/**
 * The "job done" moment. Deliberately celebratory but calm: an illustration,
 * the amount, the new balance and only two choices.
 */
export function SuccessDialog({
  open,
  kind,
  title,
  subtitle,
  amountPaise,
  balancePaise,
  balanceLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
  children,
}: SuccessDialogProps) {
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => primaryRef.current?.focus(), 60);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[3px]" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
        className="relative z-10 w-full max-w-sm animate-slide-up rounded-t-3xl border border-line bg-surface px-6 pb-6 pt-8 shadow-pop sm:animate-scale-in sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted transition hover:bg-surface2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              aria-hidden
              className={cn('absolute h-1.5 w-2.5 animate-confetti rounded-[2px]', piece.color)}
              style={{
                left: piece.left,
                top: piece.top,
                animationDelay: piece.delay,
                transform: `rotate(${piece.rotate})`,
              }}
            />
          ))}
          <SuccessArt kind={kind} />
        </div>

        <div className="text-center">
          <h2 id="success-title" className="text-[18px] font-bold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className="mx-auto mt-1 max-w-[19rem] text-[12.5px] leading-relaxed text-muted">
              {subtitle}
            </p>
          ) : null}

          {amountPaise !== undefined ? (
            <div className="mt-3 text-[32px] font-bold leading-none tracking-tight tabular text-accent">
              {formatINR(amountPaise)}
            </div>
          ) : null}

          {balancePaise !== undefined ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface2 px-3 py-1.5 text-[12px] font-medium text-muted">
              <span>{balanceLabel}</span>
              <span className="font-bold tabular text-ink">{formatINR(balancePaise)}</span>
            </div>
          ) : null}

          {children}
        </div>

        <div className="mt-6 space-y-2">
          <Button ref={primaryRef} variant="primary" fullWidth size="lg" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          {secondaryLabel && onSecondary ? (
            <Button variant="ghost" fullWidth size="md" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
