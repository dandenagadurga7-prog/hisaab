import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/validate';
import { formatINR } from '@/lib/money';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'outline-danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  soft: 'btn-soft',
  danger: 'btn-danger',
  'outline-danger': 'btn-outline-danger',
};

const SIZES: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, fullWidth, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={cn('btn', VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
      disabled={rest.disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger' | 'accent';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        tone === 'danger'
          ? 'text-muted hover:bg-danger-soft hover:text-danger'
          : tone === 'accent'
            ? 'text-muted hover:bg-accent-soft hover:text-accent'
            : 'text-muted hover:bg-surface2 hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ml-1 font-normal text-muted/70">({optional})</span> : null}
      </label>
      {children}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('input', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn('textarea', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn('input cursor-pointer pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth,
  size = 'md',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex rounded-xl bg-surface2 p-1', fullWidth && 'flex w-full')}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition-all',
              size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3 text-[13px]',
              active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const AVATAR_TONES = [
  'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  'bg-amber-500/20 text-amber-800 dark:text-amber-300',
  'bg-violet-500/15 text-violet-800 dark:text-violet-300',
  'bg-rose-500/15 text-rose-800 dark:text-rose-300',
  'bg-teal-500/15 text-teal-800 dark:text-teal-300',
];

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]!;
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'h-9 w-9 text-[11px]',
    md: 'h-11 w-11 text-[13px]',
    lg: 'h-16 w-16 text-lg',
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide',
        sizes[size],
        toneFor(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

export function BalanceText({
  paise,
  className,
  muted,
}: {
  paise: number;
  className?: string;
  muted?: boolean;
}) {
  const tone =
    paise > 0
      ? 'text-ink'
      : paise < 0
        ? 'text-info'
        : muted
          ? 'text-muted'
          : 'text-muted';
  return <span className={cn('tabular', tone, className)}>{formatINR(paise)}</span>;
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warn' | 'danger';
  className?: string;
}) {
  const map = {
    neutral: 'chip-neutral',
    accent: 'chip-accent',
    warn: 'chip-warn',
    danger: 'chip-danger',
  } as const;
  return <span className={cn('chip', map[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  footnote,
  compact,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  secondary?: ReactNode;
  footnote?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-10' : 'px-6 py-14',
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action || secondary ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      ) : null}
      {footnote ? <p className="mt-4 text-xs text-muted/80">{footnote}</p> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  id,
  dataAmount,
  emphasis,
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  id?: string;
  dataAmount?: number;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        'card relative overflow-hidden p-4 sm:p-5',
        emphasis && 'border-accent/25 bg-accent-soft/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            emphasis ? 'bg-accent text-accent-ink' : 'bg-surface2 text-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <div
        id={id}
        data-amount={dataAmount}
        className={cn(
          'mt-2 text-2xl font-bold tracking-tight tabular sm:text-[26px]',
          emphasis ? 'text-accent' : 'text-ink',
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
      {hint ? <div className="mt-0.5 text-[11px] text-muted/70">{hint}</div> : null}
    </div>
  );
}
