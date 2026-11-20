import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  IndianRupee,
  Search,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { Customer, Totals } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useToday, isDateOverridden } from '@/hooks/useToday';
import { navigate } from '@/router';
import {
  buildTotalsIndex,
  overdueCustomers,
  shopTotals,
  topDebtor,
  totalsFor,
} from '@/lib/balance';
import { formatDateShort, formatWeekday } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { cn } from '@/lib/cn';
import { loadDemoData } from '@/services/demo';
import { Avatar, Button, Chip, EmptyState, Input, Segmented, StatCard } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { CustomerRow } from '@/components/CustomerRow';

type Filter = 'all' | 'due' | 'advance';
type SortKey = 'recent' | 'balance' | 'name';

interface Row {
  customer: Customer;
  totals: Totals;
}

export function DashboardPage({ onAddCustomer }: { onAddCustomer: () => void }) {
  const customers = useStore((state) => state.customers);
  const transactions = useStore((state) => state.transactions);
  const settings = useStore((state) => state.settings);
  const pushToast = useStore((state) => state.pushToast);
  const t = useT();
  const today = useToday();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const totalsIndex = useMemo(() => buildTotalsIndex(transactions), [transactions]);
  const shop = useMemo(() => shopTotals(customers, totalsIndex), [customers, totalsIndex]);
  const overdue = useMemo(
    () => overdueCustomers(customers, totalsIndex, today, settings.overdueDays),
    [customers, totalsIndex, today, settings.overdueDays],
  );
  const top = useMemo(() => topDebtor(customers, totalsIndex), [customers, totalsIndex]);
  const creditCount = useMemo(
    () => transactions.filter((tx) => tx.type === 'credit').length,
    [transactions],
  );
  const paymentCount = useMemo(
    () => transactions.filter((tx) => tx.type === 'payment').length,
    [transactions],
  );

  const rows = useMemo<Row[]>(() => {
    const term = query.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');

    let list: Row[] = customers.map((customer) => ({
      customer,
      totals: totalsFor(totalsIndex, customer.id),
    }));

    if (filter === 'due') list = list.filter((row) => row.totals.balancePaise > 0);
    if (filter === 'advance') list = list.filter((row) => row.totals.balancePaise < 0);

    if (term) {
      list = list.filter(({ customer }) => {
        const nameMatch = customer.name.toLowerCase().includes(term);
        const phoneMatch = digits.length > 0 && customer.phone.includes(digits);
        return nameMatch || phoneMatch;
      });
    }

    list.sort((a, b) => {
      if (sort === 'balance') return b.totals.balancePaise - a.totals.balancePaise;
      if (sort === 'name') return a.customer.name.localeCompare(b.customer.name);
      const aDate = a.totals.lastActivityDate ?? '';
      const bDate = b.totals.lastActivityDate ?? '';
      if (aDate !== bDate) return aDate < bDate ? 1 : -1;
      return b.customer.createdAt - a.customer.createdAt;
    });

    return list;
  }, [customers, totalsIndex, query, filter, sort]);

  const pickerRows = useMemo(() => {
    const term = pickerQuery.trim().toLowerCase();
    return customers
      .filter((customer) => {
        if (!term) return true;
        return (
          customer.name.toLowerCase().includes(term) ||
          customer.phone.includes(term.replace(/\D/g, ''))
        );
      })
      .slice(0, 40);
  }, [customers, pickerQuery]);

  const demo = () => {
    const result = loadDemoData();
    if (result.ok) {
      pushToast('settings.demoLoaded');
    } else {
      pushToast('toast.storageFailed', 'error');
    }
  };

  const override = isDateOverridden();

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">
            {t('dash.greeting')}, {settings.shopName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {formatWeekday(today, settings.language)}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{t('dash.subtitle')}</span>
            {override ? (
              <Chip tone="accent" className="!text-[10px]">
                {t('common.demo')}
              </Chip>
            ) : null}
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="primary"
            icon={<UserPlus className="h-4 w-4" />}
            onClick={onAddCustomer}
            className="flex-1 sm:flex-none"
          >
            {t('nav.addCustomer')}
          </Button>
          <Button
            variant="secondary"
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={() => setPickerOpen(true)}
            disabled={customers.length === 0}
            className="flex-1 sm:flex-none"
          >
            {t('dash.quickAdd')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('dash.totalOutstanding')}
          value={formatINR(shop.outstandingPaise)}
          sub={t('dash.customersWithDues', { count: shop.customersWithDues })}
          icon={<Wallet className="h-4 w-4" />}
          id="total-outstanding"
          dataAmount={shop.outstandingPaise / 100}
          emphasis
        />
        <StatCard
          label={t('dash.totalCredit')}
          value={formatINR(shop.creditPaise)}
          sub={`${creditCount} ${t('common.entries')}`}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label={t('dash.totalPayments')}
          value={formatINR(shop.paymentPaise)}
          sub={`${paymentCount} ${t('common.entries')}`}
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
        <StatCard
          label={t('dash.customers')}
          value={String(customers.length)}
          sub={
            top
              ? `${t('dash.topDue')}: ${formatINR(top.totals.balancePaise)}`
              : t('dash.customersWithDues', { count: 0 })
          }
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {overdue.length > 0 ? (
        <button
          type="button"
          onClick={() => navigate('/overdue')}
          className="flex w-full items-center gap-3 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3 text-left transition hover:brightness-[0.99]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-ink">
              {overdue.length === 1
                ? t('dash.overdueBannerOne')
                : t('dash.overdueBanner', { count: overdue.length })}
            </span>
            <span className="block truncate text-[11.5px] text-muted">
              {overdue
                .slice(0, 3)
                .map((row) => `${row.customer.name} (${row.daysSince}d)`)
                .join(' · ')}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-warn">
            {t('dash.overdueAction')}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : null}

      <section className="card overflow-hidden" aria-labelledby="ledger-title">
        <div className="border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 id="ledger-title" className="text-[15px] font-semibold text-ink">
                {t('dash.customerList')}
              </h2>
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted tabular">
                {customers.length}
              </span>
            </div>
            <Segmented
              size="sm"
              ariaLabel={t('dash.customerList')}
              value={sort}
              onChange={(value) => setSort(value)}
              options={[
                { value: 'recent', label: t('dash.sortRecent') },
                { value: 'balance', label: t('dash.sortBalance') },
                { value: 'name', label: t('dash.sortName') },
              ]}
            />
          </div>

          {customers.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('dash.searchPlaceholder')}
                  aria-label={t('dash.searchPlaceholder')}
                  className="h-10 pl-9 pr-9"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('dash.clearSearch')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-surface2 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    ['all', t('filter.all')],
                    ['due', t('filter.due')],
                    ['advance', t('filter.advance')],
                  ] as Array<[Filter, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
                      filter === value
                        ? 'border-accent/30 bg-accent-soft text-accent'
                        : 'border-line bg-surface text-muted hover:text-ink',
                    )}
                    aria-pressed={filter === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {customers.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title={t('dash.emptyTitle')}
            body={t('dash.emptyBody')}
            action={
              <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={onAddCustomer}>
                {t('dash.addFirstCustomer')}
              </Button>
            }
            secondary={
              <Button variant="ghost" size="sm" onClick={demo}>
                {t('import.loadSample')}
              </Button>
            }
            footnote={t('empty.tip')}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={<Search className="h-5 w-5" />}
            title={t('dash.noResultsTitle')}
            body={t('dash.noResultsBody')}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                {t('dash.clearSearch')}
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((row) => (
              <CustomerRow key={row.customer.id} customer={row.customer} totals={row.totals} />
            ))}
          </div>
        )}
      </section>

      {rows.length > 0 && rows.length !== customers.length ? (
        <p className="px-1 text-[11px] text-muted">
          {t('dash.showingCount', { shown: rows.length, total: customers.length })}
        </p>
      ) : null}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('dash.quickAdd')}
        description={t('dash.searchPlaceholder')}
        icon={<IndianRupee className="h-5 w-5" />}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              autoFocus
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder={t('dash.searchPlaceholder')}
              className="pl-9"
              aria-label={t('dash.searchPlaceholder')}
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {pickerRows.map((customer) => {
              const totals = totalsFor(totalsIndex, customer.id);
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerQuery('');
                    navigate(`/customer/${customer.id}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface2"
                >
                  <Avatar name={customer.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {customer.name}
                    </span>
                    <span className="block text-[11px] text-muted tabular">
                      {totals.lastActivityDate
                        ? formatDateShort(totals.lastActivityDate, settings.language)
                        : t('customer.noTransactionsTitle')}{' '}
                      · {totals.txCount} {t('common.entries')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular text-ink">
                    {formatINR(totals.balancePaise)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                </button>
              );
            })}
            {pickerRows.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">{t('dash.noResultsTitle')}</p>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
