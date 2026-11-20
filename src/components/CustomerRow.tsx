import type { KeyboardEvent, MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Customer, Totals } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useToday } from '@/hooks/useToday';
import { customerHref, navigate } from '@/router';
import { diffDays, formatDateShort } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { buildReminderMessage, buildWhatsAppLink } from '@/lib/whatsapp';
import { maskPhone } from '@/lib/validate';
import { cn } from '@/lib/cn';
import { Avatar } from './ui';
import { ReminderLink } from './TransactionRow';

export interface CustomerRowProps {
  customer: Customer;
  totals: Totals;
}

export function CustomerRow({ customer, totals }: CustomerRowProps) {
  const settings = useStore((state) => state.settings);
  const t = useT();
  const today = useToday();

  const href = customerHref(customer.id);
  const balance = totals.balancePaise;
  const canRemind = balance > 0;

  const message = buildReminderMessage({
    customerName: customer.name,
    shopName: settings.shopName,
    amountPaise: Math.max(balance, 0),
    language: settings.language,
  });
  const waLink = buildWhatsAppLink(customer.phone, message);

  const anchorDate = totals.lastPaymentDate ?? totals.firstCreditDate;
  const days = anchorDate ? Math.max(0, diffDays(anchorDate, today)) : 0;
  const isOverdue = canRemind && days >= settings.overdueDays;

  const open = () => navigate(`/customer/${customer.id}`);

  const onRowClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('a,button')) return;
    open();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  return (
    <div
      data-customer={customer.phone}
      data-customer-id={customer.id}
      data-href={href}
      role="link"
      tabIndex={0}
      aria-label={`${customer.name} — ${formatINR(balance)}`}
      onClick={onRowClick}
      onKeyDown={onKeyDown}
      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 row-hover focus-visible:bg-surface2 sm:px-5"
    >
      <Avatar name={customer.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <a
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="truncate text-[14px] font-semibold text-ink outline-none hover:underline"
          >
            {customer.name}
          </a>
          {isOverdue ? (
            <span className="chip chip-warn shrink-0 !px-1.5 !py-0.5 !text-[10px]">
              {t('customer.daysShort', { days })}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">
          <span className="tabular">
            {settings.maskPhones ? maskPhone(customer.phone) : customer.phone}
          </span>
          {totals.lastActivityDate ? (
            <>
              <span className="px-1 text-muted/50">·</span>
              {formatDateShort(totals.lastActivityDate, settings.language)}
            </>
          ) : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <div
          data-balance
          data-amount={balance / 100}
          className={cn(
            'text-[14.5px] font-bold tabular',
            balance > 0 ? 'text-ink' : balance < 0 ? 'text-info' : 'text-muted',
          )}
        >
          {formatINR(balance)}
        </div>
        <div className="mt-0.5 text-[10.5px] text-muted">
          {balance < 0
            ? t('dash.advance')
            : balance === 0
              ? t('dash.settled')
              : t('customer.entriesCount', { count: totals.txCount })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <ReminderLink phone={customer.phone} href={waLink} enabled={canRemind} compact />
        <ChevronRight className="h-4 w-4 text-muted/40" aria-hidden />
      </div>
    </div>
  );
}
