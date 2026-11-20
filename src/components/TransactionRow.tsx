import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ImageOff, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type { Customer, Transaction } from '@/types';
import { useScreenshotUrl } from '@/hooks/useScreenshot';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/useStore';
import { formatDateShort } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { cn } from '@/lib/cn';
import { IconButton } from './ui';
import { ConfirmDialog } from './Modal';

export function ScreenshotThumb({ id }: { id: string }) {
  const { url, loading } = useScreenshotUrl(id);
  const t = useT();

  if (loading) return <div className="skeleton h-9 w-9 rounded-lg" aria-hidden />;

  if (!url) {
    return (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface2 text-muted"
        title={t('customer.imageUnavailable')}
      >
        <ImageOff className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t('customer.viewScreenshot')}
      className="block shrink-0 overflow-hidden rounded-lg border border-line transition hover:opacity-90"
    >
      <img
        data-shot={id}
        src={url}
        alt={t('customer.viewScreenshot')}
        loading="lazy"
        className="h-9 w-9 object-cover"
      />
    </a>
  );
}

export interface TransactionRowProps {
  transaction: Transaction;
  customer: Customer;
  onEdit: (transaction: Transaction) => void;
  last?: boolean;
}

export function TransactionRow({ transaction, customer, onEdit, last }: TransactionRowProps) {
  const t = useT();
  const language = useStore((state) => state.settings.language);
  const deleteTransaction = useStore((state) => state.deleteTransaction);
  const pushToast = useStore((state) => state.pushToast);
  const [confirming, setConfirming] = useState(false);

  const isCredit = transaction.type === 'credit';

  const remove = () => {
    const result = deleteTransaction(transaction.id);
    setConfirming(false);
    if (result.ok) pushToast('toast.entryDeleted');
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-5',
          !last && 'border-b border-line',
        )}
        data-transaction={transaction.id}
        data-type={transaction.type}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            isCredit ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent',
          )}
          aria-hidden
        >
          {isCredit ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink">
            {transaction.note || (isCredit ? t('customer.txCredit') : t('customer.txPayment'))}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {formatDateShort(transaction.date, language)}
            <span className="px-1.5">·</span>
            {isCredit ? t('customer.txCredit') : t('customer.txPayment')}
          </p>
        </div>

        {transaction.screenshotId ? <ScreenshotThumb id={transaction.screenshotId} /> : null}

        <span
          className={cn(
            'shrink-0 text-[14px] font-bold tabular',
            isCredit ? 'text-ink' : 'text-accent',
          )}
        >
          {isCredit ? '+' : '\u2212'}
          {formatINR(transaction.amountPaise)}
        </span>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label={t('customer.editTransaction')}
            size="sm"
            onClick={() => onEdit(transaction)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label={t('customer.deleteTransaction')}
            size="sm"
            tone="danger"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        title={t('customer.deleteTransaction')}
        body={`${customer.name} · ${formatINR(transaction.amountPaise)} · ${formatDateShort(
          transaction.date,
          language,
        )}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}

export function ReminderLink({
  phone,
  href,
  enabled,
  compact,
  className,
}: {
  phone: string;
  href: string;
  enabled: boolean;
  compact?: boolean;
  className?: string;
}) {
  const t = useT();

  if (!enabled) {
    return (
      <a
        data-remind={phone}
        aria-disabled="true"
        role="link"
        title={t('customer.reminderDisabled')}
        aria-label={t('customer.reminderDisabled')}
        className={cn(
          'inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-muted/50',
          className,
        )}
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        {!compact ? t('dash.remind') : null}
      </a>
    );
  }

  return (
    <a
      data-remind={phone}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t('customer.whatsapp')}
      aria-label={t('customer.whatsapp')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-accent transition hover:bg-accent-soft',
        className,
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      {!compact ? t('dash.remind') : null}
    </a>
  );
}
