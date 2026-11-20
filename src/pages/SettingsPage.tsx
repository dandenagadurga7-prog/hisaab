import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Database,
  DownloadCloud,
  HardDrive,
  Languages,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  UploadCloud,
  Wallet,
} from 'lucide-react';
import type { BackupContents } from '@/lib/backup';
import { buildBackup, parseBackup } from '@/lib/backup';
import type { Language, ThemeMode } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { navigate } from '@/router';
import { formatINR } from '@/lib/money';
import { storageFootprint } from '@/services/storage';
import {
  countScreenshots,
  estimateStorage,
  type StorageEstimateInfo,
} from '@/services/screenshots';
import { downloadFile, readFileAsText, timestampSlug } from '@/services/download';
import { loadDemoData } from '@/services/demo';
import { Button, Field, Input, Segmented } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';

const APP_VERSION = '1.1.0';

export function SettingsPage() {
  const settings = useStore((state) => state.settings);
  const customers = useStore((state) => state.customers);
  const transactions = useStore((state) => state.transactions);
  const updateSettings = useStore((state) => state.updateSettings);
  const restoreBackup = useStore((state) => state.restoreBackup);
  const resetAll = useStore((state) => state.resetAll);
  const pushToast = useStore((state) => state.pushToast);
  const t = useT();
  const { canInstall, installed, install } = useInstallPrompt();

  const [shopName, setShopName] = useState(settings.shopName);
  const [upiId, setUpiId] = useState(settings.upiId);
  const [overdueDays, setOverdueDays] = useState(String(settings.overdueDays));
  const [maskPhones, setMaskPhones] = useState(settings.maskPhones);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [pendingRestore, setPendingRestore] = useState<BackupContents | null>(null);
  const [restoreErrors, setRestoreErrors] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [shots, setShots] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimateInfo | null>(null);
  const restoreRef = useRef<HTMLInputElement | null>(null);

  const footprint = useMemo(
    () => storageFootprint(),
    [customers, transactions, settings],
  );

  useEffect(() => {
    let active = true;
    void countScreenshots().then((count) => {
      if (active) setShots(count);
    });
    void estimateStorage().then((value) => {
      if (active) setEstimate(value);
    });
    return () => {
      active = false;
    };
  }, [customers, transactions]);

  const savePreferences = () => {
    setSaving(true);
    setErrors({});

    const trimmedDays = String(overdueDays).trim();
    const days = Number(trimmedDays);
    if (trimmedDays === '' || !Number.isInteger(days) || days < 1 || days > 365) {
      setSaving(false);
      setErrors({ overdueDays: t('error.amount_invalid') });
      return;
    }

    const result = updateSettings({
      shopName,
      upiId,
      overdueDays: days,
      maskPhones,
    });
    setSaving(false);

    if (!result.ok) {
      const map: Record<string, string> = {};
      for (const error of result.errors) map[error.field] = t(`error.${error.code}`);
      setErrors(map);
      return;
    }
    pushToast('settings.saved');
  };

  const applyLanguage = (language: Language) => {
    updateSettings({ language });
  };

  const applyTheme = (theme: ThemeMode) => {
    updateSettings({ theme });
  };

  const backup = () => {
    downloadFile(
      `hisaab-backup-${timestampSlug()}.json`,
      'application/json',
      JSON.stringify(buildBackup(settings, customers, transactions), null, 2),
    );
    pushToast('toast.backupDownloaded');
  };

  const onRestoreFile = async (file: File | null) => {
    if (!file) return;
    setRestoreErrors([]);
    try {
      const text = await readFileAsText(file);
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        setRestoreErrors(parsed.errors);
        return;
      }
      setPendingRestore(parsed.value);
    } catch {
      setRestoreErrors([t('error.backup_invalid')]);
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    const result = restoreBackup(pendingRestore);
    setPendingRestore(null);
    if (result.ok) {
      pushToast('settings.backupRestored');
      setShopName(pendingRestore.settings.shopName);
      setUpiId(pendingRestore.settings.upiId);
      setOverdueDays(String(pendingRestore.settings.overdueDays));
      setMaskPhones(pendingRestore.settings.maskPhones);
    } else {
      pushToast('toast.storageFailed', 'error');
    }
  };

  const doReset = () => {
    resetAll();
    setConfirmReset(false);
    setShopName('My Shop');
    setUpiId('');
    setOverdueDays('30');
    pushToast('settings.resetDone');
    navigate('/');
  };

  const demo = () => {
    const loaded = loadDemoData();
    if (loaded.ok) pushToast('settings.demoLoaded');
    else pushToast('toast.storageFailed', 'error');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">
          {t('settings.title')}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="card card-pad space-y-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Store className="h-4 w-4 text-accent" aria-hidden />
            {t('settings.shopTitle')}
          </h2>

          <Field
            label={t('settings.shopName')}
            htmlFor="settings-shop-name"
            hint={t('settings.shopNameHint')}
            error={errors.shopName}
          >
            <Input
              id="settings-shop-name"
              value={shopName}
              onChange={(event) => setShopName(event.target.value)}
              maxLength={60}
              autoComplete="organization"
            />
          </Field>

          <Field
            label={t('settings.upiId')}
            htmlFor="settings-upi"
            hint={t('settings.upiHint')}
            error={errors.upiId}
            optional={t('common.optional')}
          >
            <Input
              id="settings-upi"
              value={upiId}
              onChange={(event) => setUpiId(event.target.value)}
              placeholder="shop@okhdfcbank"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <div>
            <span className="label">{t('settings.overdueDays')}</span>
            <div className="flex items-center gap-2">
              <Input
                id="settings-overdue"
                type="number"
                min={1}
                max={365}
                value={overdueDays}
                onChange={(event) => setOverdueDays(event.target.value)}
                className="w-24 tabular"
              />
              <span className="text-[13px] text-muted">{t('overdue.daysUnit')}</span>
            </div>
            {errors.overdueDays ? (
              <p className="error-text" role="alert">
                {errors.overdueDays}
              </p>
            ) : (
              <p className="hint">{t('settings.overdueHint')}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface2/60 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{t('settings.maskPhones')}</p>
              <p className="text-[11px] text-muted">{t('settings.maskPhonesHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={maskPhones}
              aria-label={t('settings.maskPhones')}
              onClick={() => setMaskPhones((value) => !value)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                maskPhones ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  maskPhones ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <Button
            variant="primary"
            icon={<Save className="h-4 w-4" />}
            onClick={savePreferences}
            loading={saving}
          >
            {t('common.save')}
          </Button>
        </section>

        <section className="card card-pad space-y-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Palette className="h-4 w-4 text-accent" aria-hidden />
            {t('settings.preferences')}
          </h2>

          <div>
            <span className="label flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" aria-hidden />
              {t('settings.language')}
            </span>
            <Segmented
              fullWidth
              ariaLabel={t('settings.language')}
              value={settings.language}
              onChange={applyLanguage}
              options={[
                { value: 'en', label: t('lang.en') },
                { value: 'hi', label: t('lang.hi') },
                { value: 'te', label: t('lang.te') },
              ]}
            />
            <p className="hint">{t('settings.languageHint')}</p>
          </div>

          <div>
            <span className="label flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5" aria-hidden />
              {t('settings.theme')}
            </span>
            <Segmented
              fullWidth
              ariaLabel={t('settings.theme')}
              value={settings.theme}
              onChange={applyTheme}
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'system', label: t('settings.themeSystem') },
              ]}
            />
          </div>

          <div className="rounded-xl border border-line bg-surface2/50 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">{t('settings.offline')}</p>
            </div>
          </div>

          <div className="rounded-xl border border-accent/25 bg-accent-soft/40 p-3">
            <p className="text-[12.5px] font-semibold text-ink">
              {installed ? t('pwa.installed') : t('pwa.installHint')}
            </p>
            {canInstall ? (
              <Button
                size="sm"
                variant="primary"
                className="mt-2"
                icon={<DownloadCloud className="h-3.5 w-3.5" />}
                onClick={() => void install()}
              >
                {t('pwa.install')}
              </Button>
            ) : null}
          </div>
        </section>

        <section className="card card-pad space-y-3 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Database className="h-4 w-4 text-accent" aria-hidden />
            {t('settings.data')}
          </h2>
          <p className="max-w-3xl text-[12px] leading-relaxed text-muted">{t('settings.dataHint')}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface2/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                <HardDrive className="h-3.5 w-3.5" aria-hidden />
                {t('settings.storageUsed')}
              </div>
              <div className="mt-1 text-[16px] font-semibold tabular text-ink">
                {(footprint.total / 1024).toFixed(1)} KB
              </div>
            </div>
            <div className="rounded-xl bg-surface2/60 p-3">
              <div className="text-[11px] font-medium text-muted">Screenshots</div>
              <div className="mt-1 text-[16px] font-semibold tabular text-ink">
                {shots === null ? '—' : shots}
              </div>
            </div>
            <div className="rounded-xl bg-surface2/60 p-3">
              <div className="text-[11px] font-medium text-muted">Outstanding</div>
              <div className="mt-1 text-[16px] font-semibold tabular text-ink">
                {formatINR(
                  transactions.reduce(
                    (sum, tx) => sum + (tx.type === 'credit' ? tx.amountPaise : -tx.amountPaise),
                    0,
                  ),
                )}
              </div>
            </div>
          </div>

          {estimate && estimate.quota > 0 ? (
            <p className="text-[11px] text-muted">
              Browser estimate: {(estimate.usage / 1024 / 1024).toFixed(1)} MB of{' '}
              {(estimate.quota / 1024 / 1024).toFixed(0)} MB used.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<DownloadCloud className="h-4 w-4" />}
              onClick={backup}
            >
              {t('settings.exportBackup')}
            </Button>
            <input
              ref={restoreRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void onRestoreFile(event.target.files?.[0] ?? null)}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<UploadCloud className="h-4 w-4" />}
              onClick={() => restoreRef.current?.click()}
            >
              {t('settings.restoreBackup')}
            </Button>
            <Button variant="ghost" size="sm" icon={<Wallet className="h-4 w-4" />} onClick={demo}>
              {t('settings.loadDemo')}
            </Button>
          </div>
          <p className="text-[11px] text-muted">{t('settings.restoreHint')}</p>

          {restoreErrors.length > 0 ? (
            <ul className="space-y-1 rounded-lg bg-danger-soft px-3 py-2 text-[11.5px] text-danger">
              {restoreErrors.slice(0, 8).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="card border-danger/30 p-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {t('settings.danger')}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{t('settings.resetBody')}</p>
          <Button
            variant="outline-danger"
            size="sm"
            className="mt-3"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => setConfirmReset(true)}
          >
            {t('settings.resetAll')}
          </Button>
        </section>
      </div>

      <p className="pb-2 text-center text-[11px] text-muted/80">
        Hisaab v{APP_VERSION} · {t('settings.offline')}
      </p>

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        onConfirm={confirmRestore}
        title={t('settings.restoreBackup')}
        body={`${t('settings.restoreConfirm')} ${
          pendingRestore ? `(${pendingRestore.customers.length} / ${pendingRestore.transactions.length})` : ''
        }`}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        tone="default"
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        title={t('settings.resetTitle')}
        body={t('settings.resetBody')}
        confirmLabel={t('settings.resetConfirm')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
