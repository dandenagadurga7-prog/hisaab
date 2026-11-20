import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Download,
  Eye,
  EyeOff,
  MessageCircle,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { Transaction } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useToday } from '@/hooks/useToday';
import { navigate, useRoute } from '@/router';
import { buildTotalsIndex, sortTransactionsNewestFirst, totalsFor } from '@/lib/balance';
import { diffDays, formatDateLong, formatDateShort, todayISO } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { buildReminderMessage, buildWhatsAppLink } from '@/lib/whatsapp';
import { buildUpiLink } from '@/lib/upi';
import { ledgerCsv } from '@/lib/csv';
import { maskPhone } from '@/lib/validate';
import { cn } from '@/lib/cn';
import { downloadFile, timestampSlug } from '@/services/download';
import { Avatar, Button, Chip, EmptyState } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { EntryForm } from '@/components/EntryForm';
import { TransactionRow } from '@/components/TransactionRow';
import { EditCustomerDialog } from '@/components/CustomerDialogs';

export function CustomerPage() {
  const route = useRoute();
  const customers = useStore((state) => state.customers);
  const transactions = useStore((state) => state.transactions);
  const settings = useStore((state) => state.settings);
  const deleteCustomer = useStore((state) => state.deleteCustomer);
  const pushToast = useStore((state) => state.pushToast);
  const t = useT();
  const today = useToday();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [revealed, setRevealed] = useState(false);

  const customerId = route.name === 'customer' ? route.id : '';
  const customer = customers.find((item) => item.id === customerId) ?? null;

  const customerTransactions = useMemo(
    () => sortTransactionsNewestFirst(transactions.filter((tx) => tx.customerId === customerId)),
    [transactions, customerId],
  );

  const totals = useMemo(() => {
    const index = buildTotalsIndex(transactions);
    return totalsFor(index, customerId);
  }, [transactions, customerId]);

  if (!customer) {
    return (
      <div className="card">
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={t('error.customer_not_found')}
          body={t('dash.emptyBody')}
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              {t('customer.back')}
            </Button>
          }
        />
      </div>
    );
  }

  const balance = totals.balancePaise;
  const canRemind = balance > 0;
  const reminder = buildReminderMessage({
    customerName: customer.name,
    shopName: settings.shopName,
    amountPaise: Math.max(balance, 0),
    language: settings.language,
  });
  const waLink = buildWhatsAppLink(customer.phone, reminder);
  const upiLink = buildUpiLink({
    upiId: settings.upiId,
    payeeName: settings.shopName,
    amountPaise: Math.max(balance, 0),
    note: `${settings.shopName} — ${customer.name}`,
  });

  const anchorDate = totals.lastPaymentDate ?? totals.firstCreditDate;
  const daysSince = anchorDate ? Math.max(0, diffDays(anchorDate, today)) : 0;
  const isOverdue = canRemind && daysSince >= settings.overdueDays;

  const exportCsv = () => {
    const csv = ledgerCsv({
      customers,
      transactions: customerTransactions,
      customerId: customer.id,
    });
    downloadFile(`hisaab-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${timestampSlug()}.csv`, 'text/csv', csv);
    pushToast('toast.csvDownloaded');
  };

  const removeCustomer = () => {
    const result = deleteCustomer(customer.id);
    setConfirmDelete(false);
    if (result.ok) {
      pushToast('toast.customerDeleted');
      navigate('/');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <div>
            <a
              href="#/"
              className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t('customer.back')}
            </a>

            <div className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={customer.name} size="lg" />

                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
                    {customer.name}
                  </h1>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[13px] text-muted tabular">
                      {settings.maskPhones && !revealed
                        ? maskPhone(customer.phone)
                        : customer.phone}
                    </span>
                    {settings.maskPhones ? (
                      <button
                        type="button"
                        onClick={() => setRevealed((value) => !value)}
                        aria-label={
                          revealed ? t('customer.phoneHide') : t('customer.phoneReveal')
                        }
                        className="rounded-md p-1 text-muted transition hover:bg-surface2 hover:text-ink"
                      >
                        {revealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tone="neutral">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      {t('customer.since', {
                        date: formatDateLong(todayISO(new Date(customer.createdAt)), settings.language),
                      })}
                    </Chip>
                    {isOverdue ? (
                      <Chip tone="warn">
                        {t('customer.overdueChip', { days: daysSince })}
                      </Chip>
                    ) : null}
                    {balance < 0 ? <Chip tone="accent">{t('customer.advance')}</Chip> : null}
                  </div>
                </div>

                <div className="w-full text-left sm:w-auto sm:text-right">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {t('customer.balance')}
                  </div>
                  <div
                    data-balance
                    data-amount={balance / 100}
                    className={cn(
                      'mt-0.5 text-[30px] font-bold leading-none tracking-tight tabular sm:text-[34px]',
                      balance > 0 ? 'text-ink' : balance < 0 ? 'text-info' : 'text-muted',
                    )}
                  >
                    {formatINR(balance)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{t('customer.balanceNote')}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat
                  label={t('customer.totalCredit')}
                  value={formatINR(totals.creditPaise)}
                  icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                  tone="warn"
                />
                <MiniStat
                  label={t('customer.totalPayments')}
                  value={formatINR(totals.paymentPaise)}
                  icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
                  tone="accent"
                />
                <MiniStat
                  label={t('customer.lastPayment')}
                  value={
                    totals.lastPaymentDate
                      ? formatDateShort(totals.lastPaymentDate, settings.language)
                      : t('customer.noPaymentYet')
                  }
                  icon={<ReceiptText className="h-3.5 w-3.5" />}
                />
                <MiniStat
                  label={t('common.entries')}
                  value={String(totals.txCount)}
                  icon={<BookOpen className="h-3.5 w-3.5" />}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                {canRemind ? (
                  <a
                    data-remind={customer.phone}
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft btn-sm"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {t('customer.whatsapp')}
                  </a>
                ) : (
                  <a
                    data-remind={customer.phone}
                    aria-disabled="true"
                    role="link"
                    title={t('customer.reminderDisabled')}
                    className="btn btn-soft btn-sm cursor-not-allowed opacity-50"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {t('customer.whatsapp')}
                  </a>
                )}

                {upiLink ? (
                  <a href={upiLink} className="btn btn-secondary btn-sm">
                    <Wallet className="h-4 w-4" aria-hidden />
                    {t('customer.upiPay')}
                  </a>
                ) : null}

                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => setEditing(true)}
                >
                  {t('common.edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={exportCsv}
                >
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setConfirmDelete(true)}
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                >
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">{t('customer.addEntry')}</h2>
              <span className="chip chip-neutral">{formatDateShort(today, settings.language)}</span>
            </div>
            <EntryForm customerId={customer.id} />
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              {t('settings.dataHint')}
            </p>
          </div>
        </aside>

        <div className="lg:col-start-1 lg:row-start-2">
          <section className="card overflow-hidden" aria-labelledby="history-title">
            <div className="card-head">
              <div className="flex items-center gap-2">
                <h2 id="history-title" className="text-[15px] font-semibold text-ink">
                  {t('customer.history')}
                </h2>
                <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted tabular">
                  {customerTransactions.length}
                </span>
              </div>
            </div>

            {customerTransactions.length === 0 ? (
              <EmptyState
                compact
                icon={<BookOpen className="h-5 w-5" />}
                title={t('customer.noTransactionsTitle')}
                body={t('customer.noTransactionsBody')}
              />
            ) : (
              <div>
                {customerTransactions.map((tx, index) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    customer={customer}
                    onEdit={setEditingTx}
                    last={index === customerTransactions.length - 1}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <EditCustomerDialog customer={customer} open={editing} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={removeCustomer}
        title={t('customer.deleteTitle', { name: customer.name })}
        body={t('customer.deleteBody', { count: customerTransactions.length })}
        confirmLabel={t('customer.deleteConfirm')}
        cancelLabel={t('common.cancel')}
      />

      <Modal
        open={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        title={t('customer.editTransaction')}
        size="md"
        icon={<Pencil className="h-5 w-5" />}
      >
        {editingTx ? (
          <EntryForm
            customerId={editingTx.customerId}
            screenshotInputId="shot-input-edit"
            initial={{
              id: editingTx.id,
              type: editingTx.type,
              amountPaise: editingTx.amountPaise,
              date: editingTx.date,
              note: editingTx.note,
              screenshotId: editingTx.screenshotId,
            }}
            onSaved={() => setEditingTx(null)}
            onCancel={() => setEditingTx(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'accent' | 'warn';
}) {
  return (
    <div className="rounded-xl bg-surface2/70 px-3 py-2">
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-muted">
        <span
          className={cn(
            tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-warn' : 'text-muted',
          )}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-[13.5px] font-semibold text-ink tabular">{value}</div>
    </div>
  );
}

