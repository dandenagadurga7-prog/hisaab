import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useToday } from '@/hooks/useToday';
import { navigate } from '@/router';
import { buildTotalsIndex, shopTotals } from '@/lib/balance';
import { formatINR } from '@/lib/money';
import { planImport, type ImportIssue, type ImportWarning } from '@/lib/jsonImport';
import { buildBackup } from '@/lib/backup';
import { ledgerCsv, summaryCsv } from '@/lib/csv';
import { downloadFile, readFileAsText, timestampSlug } from '@/services/download';
import sampleData from '@/data/sampleData.json';
import { Button, Textarea } from '@/components/ui';
import { SuccessArt } from '@/components/SuccessArt';

export function ImportPage() {
  const customers = useStore((state) => state.customers);
  const transactions = useStore((state) => state.transactions);
  const settings = useStore((state) => state.settings);
  const applyImport = useStore((state) => state.applyImport);
  const pushToast = useStore((state) => state.pushToast);
  const t = useT();
  const today = useToday();

  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ImportIssue[]>([]);
  const [warnings, setWarnings] = useState<ImportWarning[]>([]);
  const [result, setResult] = useState<{ customers: number; entries: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    return planImport(text, {
      existingCustomers: customers,
      existingTransactions: transactions,
      today,
    });
  }, [text, customers, transactions, today]);

  const previewTotals = useMemo(() => {
    if (!preview?.ok) return null;
    const futureCustomers = [...customers, ...preview.plan.newCustomers];
    const futureTransactions = [...transactions, ...preview.plan.newTransactions];
    return shopTotals(futureCustomers, buildTotalsIndex(futureTransactions));
  }, [preview, customers, transactions]);

  const chooseFile = async (file: File | null) => {
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setText(content);
      setErrors([]);
      setWarnings([]);
      setResult(null);
    } catch {
      setErrors([{ path: '$', message: t('import.invalidJson') }]);
    }
  };

  const run = () => {
    setResult(null);
    setWarnings([]);

    if (!text.trim()) {
      setErrors([{ path: '$', message: t('import.emptyBox') }]);
      return;
    }

    setBusy(true);
    const parsed = planImport(text, {
      existingCustomers: customers,
      existingTransactions: transactions,
      today,
    });

    if (!parsed.ok) {
      setErrors(parsed.errors);
      setBusy(false);
      return;
    }

    setErrors([]);
    setWarnings(parsed.warnings);
    const applied = applyImport(parsed.plan);
    setBusy(false);

    if (!applied.ok) {
      setErrors([{ path: '$', message: t('error.storage_unavailable') }]);
      return;
    }

    setResult(applied.value);
    if (applied.value.customers === 0 && applied.value.entries === 0) {
      pushToast('import.nothingNew', 'info');
    } else {
      pushToast('import.success', 'success', {
        customers: applied.value.customers,
        entries: applied.value.entries,
      });
    }
  };

  const loadSample = () => {
    setText(JSON.stringify(sampleData, null, 2));
    setErrors([]);
    setWarnings([]);
    setResult(null);
  };

  const backup = () => {
    downloadFile(
      `hisaab-backup-${timestampSlug()}.json`,
      'application/json',
      JSON.stringify(buildBackup(settings, customers, transactions), null, 2),
    );
    pushToast('toast.backupDownloaded');
  };

  const exportLedger = () => {
    downloadFile(
      `hisaab-ledger-${timestampSlug()}.csv`,
      'text/csv',
      ledgerCsv({ customers, transactions }),
    );
    pushToast('toast.csvDownloaded');
  };

  const exportSummary = () => {
    const index = buildTotalsIndex(transactions);
    const rows = customers.map((customer) => {
      const totals = index.get(customer.id);
      return {
        name: customer.name,
        phone: customer.phone,
        creditPaise: totals?.creditPaise ?? 0,
        paymentPaise: totals?.paymentPaise ?? 0,
        balancePaise: totals?.balancePaise ?? 0,
      };
    });
    downloadFile(`hisaab-summary-${timestampSlug()}.csv`, 'text/csv', summaryCsv({ rows }));
    pushToast('toast.csvDownloaded');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">
          {t('import.title')}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          {t('import.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="card card-pad space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-accent" aria-hidden />
              <h2 className="text-[15px] font-semibold text-ink">{t('import.inputTitle')}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => fileRef.current?.click()}
              >
                {t('import.fileButton')}
              </Button>
              <Button size="sm" variant="ghost" onClick={loadSample}>
                {t('import.loadSample')}
              </Button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted">{t('import.instructions')}</p>

          <label className="sr-only" htmlFor="import-box">
            {t('import.placeholder')}
          </label>
          <Textarea
            id="import-box"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setErrors([]);
              setResult(null);
            }}
            placeholder={t('import.placeholder')}
            rows={14}
            spellCheck={false}
            className="min-h-[240px] resize-y font-mono text-[12px] leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              {text.length > 0 ? `${(text.length / 1024).toFixed(1)} KB` : '\u00A0'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setText('');
                  setErrors([]);
                  setWarnings([]);
                  setResult(null);
                }}
              >
                {t('common.clear')}
              </Button>
              <Button
                id="import-go"
                variant="primary"
                size="md"
                loading={busy}
                icon={<UploadCloud className="h-4 w-4" />}
                onClick={run}
              >
                {t('import.validateAndImport')}
              </Button>
            </div>
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-surface2/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('import.atomicNote')}
          </p>
        </section>

        <aside className="space-y-4">
          {result ? (
            <section className="card border-accent/30 bg-accent-soft/40 p-4 text-center">
              <SuccessArt kind="import" className="h-24" />
              <h2 className="text-[15px] font-bold text-ink">{t('success.importTitle')}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {t('success.importBody', {
                  customers: result.customers,
                  entries: result.entries,
                })}
              </p>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                className="mt-3"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => navigate('/')}
              >
                {t('success.viewLedger')}
              </Button>
            </section>
          ) : null}

          {preview?.ok ? (
            <section className="card card-pad">
              <h2 className="text-[13px] font-semibold text-ink">{t('import.preview')}</h2>
              <dl className="mt-3 space-y-2 text-[13px]">
                <SummaryRow label={t('import.newCustomers')} value={preview.plan.newCustomerCount} />
                <SummaryRow label={t('import.matchedCustomers')} value={preview.plan.matchedCustomerCount} />
                <SummaryRow label={t('import.newEntries')} value={preview.plan.newTransactions.length} />
                <SummaryRow label={t('import.duplicates')} value={preview.plan.duplicateEntries} />
                {previewTotals ? (
                  <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
                    <dt className="text-muted">{t('import.resultingTotal')}</dt>
                    <dd className="font-bold tabular text-accent">
                      {formatINR(previewTotals.outstandingPaise)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {errors.length > 0 ? (
            <section className="card border-danger/30 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-danger" aria-hidden />
                <h2 className="text-[13px] font-semibold text-danger">{t('import.errorsTitle')}</h2>
              </div>
              <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-[11.5px]">
                {errors.slice(0, 30).map((error, index) => (
                  <li key={`${error.path}-${index}`} className="rounded-md bg-danger-soft px-2 py-1.5">
                    <code className="font-mono text-[10.5px] text-danger">{error.path}</code>
                    <span className="ml-1.5 text-muted">{error.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {warnings.length > 0 ? (
            <section className="card p-4">
              <h2 className="text-[13px] font-semibold text-ink">{t('import.warningsTitle')}</h2>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11.5px] text-muted">
                {warnings.slice(0, 20).map((warning, index) => (
                  <li key={`${warning.path}-${index}`}>
                    <code className="font-mono text-[10.5px]">{warning.path}</code>
                    {' — '}
                    {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!result && errors.length === 0 && !preview ? (
            <section className="card card-pad">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <UploadCloud className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-3 text-[14px] font-semibold text-ink">
                {t('import.sampleTitle')}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {t('import.sampleBody')}
              </p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={loadSample}>
                {t('import.loadSample')}
              </Button>
            </section>
          ) : null}

          <section className="card card-pad">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Download className="h-4 w-4 text-accent" aria-hidden />
              {t('import.exportTitle')}
            </h2>
            <p className="mt-1 text-[11.5px] text-muted">{t('import.exportSubtitle')}</p>
            <div className="mt-3 space-y-2">
              <Button
                fullWidth
                size="sm"
                variant="secondary"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={exportLedger}
              >
                {t('import.exportCsv')}
              </Button>
              <Button
                fullWidth
                size="sm"
                variant="ghost"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={exportSummary}
              >
                {t('import.exportSummary')}
              </Button>
              <Button
                fullWidth
                size="sm"
                variant="ghost"
                icon={<FileJson className="h-4 w-4" />}
                onClick={backup}
              >
                {t('settings.exportBackup')}
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular text-ink">{value}</dd>
    </div>
  );
}
