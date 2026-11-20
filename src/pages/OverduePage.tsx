import { useMemo } from 'react';
import { AlarmClock, ArrowRight, CheckCircle2, MessageCircle, Settings2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useToday } from '@/hooks/useToday';
import { navigate } from '@/router';
import { buildTotalsIndex, overdueCustomers } from '@/lib/balance';
import { formatINR } from '@/lib/money';
import { buildReminderMessage, buildWhatsAppLink } from '@/lib/whatsapp';
import { maskPhone } from '@/lib/validate';
import { diffDays, formatDateShort } from '@/lib/dates';
import { Avatar, Button, Chip, EmptyState } from '@/components/ui';

export function OverduePage() {
  const customers = useStore((state) => state.customers);
  const transactions = useStore((state) => state.transactions);
  const settings = useStore((state) => state.settings);
  const t = useT();
  const today = useToday();

  const index = useMemo(() => buildTotalsIndex(transactions), [transactions]);
  const rows = useMemo(
    () => overdueCustomers(customers, index, today, settings.overdueDays),
    [customers, index, today, settings.overdueDays],
  );

  const total = rows.reduce((sum, row) => sum + row.totals.balancePaise, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">
            {t('overdue.title')}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {t('overdue.subtitle', { days: settings.overdueDays })}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Settings2 className="h-3.5 w-3.5" />}
          onClick={() => navigate('/settings')}
        >
          {t('overdue.threshold')}: {settings.overdueDays} {t('overdue.daysUnit')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={t('overdue.emptyTitle')}
            body={t('overdue.emptyBody')}
            action={
              <Button variant="secondary" onClick={() => navigate('/')}>
                {t('nav.dashboard')}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card border-warn/25 bg-warn-soft/50 p-4">
              <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
                <AlarmClock className="h-4 w-4 text-warn" aria-hidden />
                {t('overdue.totalOverdue')}
              </div>
              <div className="mt-1 text-[26px] font-bold tracking-tight tabular text-ink">
                {formatINR(total)}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[12px] font-medium text-muted">{t('common.customers')}</div>
              <div className="mt-1 text-[26px] font-bold tracking-tight tabular text-ink">
                {t('overdue.count', { count: rows.length })}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            {rows.map((row, index_) => {
              const { customer, totals, daysSince, neverPaid } = row;
              const message = buildReminderMessage({
                customerName: customer.name,
                shopName: settings.shopName,
                amountPaise: totals.balancePaise,
                language: settings.language,
              });
              const link = buildWhatsAppLink(customer.phone, message);
              const anchorDate = totals.lastPaymentDate ?? totals.firstCreditDate;
              const days = anchorDate ? Math.max(0, diffDays(anchorDate, today)) : daysSince;

              return (
                <div
                  key={customer.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5 ${
                    index_ !== rows.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <Avatar name={customer.name} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={`#/customer/${customer.id}`}
                        className="truncate text-[14.5px] font-semibold text-ink hover:underline"
                      >
                        {customer.name}
                      </a>
                      <Chip tone="warn">{t('overdue.days', { days })}</Chip>
                      {neverPaid ? <Chip tone="neutral">{t('overdue.neverPaid')}</Chip> : null}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-muted tabular">
                      {settings.maskPhones ? maskPhone(customer.phone) : customer.phone}
                      {anchorDate ? (
                        <>
                          <span className="px-1.5">·</span>
                          {neverPaid ? t('overdue.sinceFirstCredit') : t('customer.lastPayment')}:{' '}
                          {formatDateShort(anchorDate, settings.language)}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-[15px] font-bold tabular text-ink">
                      {formatINR(totals.balancePaise)}
                    </div>
                    <div className="text-[11px] text-muted">
                      {t('customer.entriesCount', { count: totals.txCount })}
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                    <a
                      data-remind={customer.phone}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-soft btn-sm"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      {t('overdue.remind')}
                    </a>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ArrowRight className="h-3.5 w-3.5" />}
                      onClick={() => navigate(`/customer/${customer.id}`)}
                    >
                      {t('overdue.recordPayment')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
