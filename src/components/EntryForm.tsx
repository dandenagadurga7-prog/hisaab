import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ImagePlus,
  ScanLine,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { ErrorCode, TransactionType } from '@/types';
import { useStore } from '@/store/useStore';
import { useToday } from '@/hooks/useToday';
import { useT } from '@/hooks/useT';
import { useFilePreview, useScreenshotUrl } from '@/hooks/useScreenshot';
import { buildTotalsIndex, totalsFor } from '@/lib/balance';
import { formatDateLong } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { cn } from '@/lib/cn';
import {
  MAX_SHOT_BYTES,
  SHOT_ACCEPT,
  deleteScreenshot,
  prepareScreenshot,
  saveScreenshot,
  validateScreenshotFile,
} from '@/services/screenshots';
import { Button, Field, Input, Segmented } from './ui';
import { ScannerDialog } from './ScannerDialog';
import { SuccessDialog } from './SuccessDialog';

export interface EntryInitial {
  id: string;
  type: TransactionType;
  amountPaise: number;
  date: string;
  note: string;
  screenshotId: string | null;
}

export interface EntryFormProps {
  customerId: string;
  initial?: EntryInitial | null;
  onSaved?: () => void;
  onCancel?: () => void;
  screenshotInputId?: string;
  compact?: boolean;
}

function paiseToInput(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

interface SavedMoment {
  type: TransactionType;
  amountPaise: number;
  balancePaise: number;
  date: string;
}

export function EntryForm({
  customerId,
  initial = null,
  onSaved,
  onCancel,
  screenshotInputId = 'shot-input',
  compact,
}: EntryFormProps) {
  const addTransaction = useStore((state) => state.addTransaction);
  const updateTransaction = useStore((state) => state.updateTransaction);
  const pushToast = useStore((state) => state.pushToast);
  const language = useStore((state) => state.settings.language);
  const today = useToday();
  const t = useT();
  const uid = useId();

  const editing = Boolean(initial);

  const [type, setType] = useState<TransactionType>(initial?.type ?? 'credit');
  const [amountText, setAmountText] = useState(initial ? paiseToInput(initial.amountPaise) : '');
  const [date, setDate] = useState(initial?.date ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [shotId, setShotId] = useState<string | null>(initial?.screenshotId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [success, setSuccess] = useState<SavedMoment | null>(null);

  const previewUrl = useFilePreview(file);
  const savedShot = useScreenshotUrl(shotId);
  const imageUrl = previewUrl ?? savedShot.url;
  const initialShotId = initial?.screenshotId ?? null;
  const initialId = initial?.id;

  useEffect(() => {
    if (!initialId) setDate(today);
  }, [today, initialId]);

  const setError = (field: string, code: ErrorCode) => {
    setErrors((prev) => ({ ...prev, [field]: t(`error.${code}`) }));
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const onPickFile = (picked: File | null) => {
    clearError('screenshot');
    if (!picked) {
      setFile(null);
      return;
    }
    const validation = validateScreenshotFile(picked);
    if (!validation.ok) {
      setError('screenshot', validation.code);
      setFile(null);
      return;
    }
    setFile(picked);
    setShotId(null);
  };

  const removeImage = () => {
    setFile(null);
    setShotId(null);
    clearError('screenshot');
  };

  const onScanUse = (picked: File, rupees: number | null) => {
    setFile(picked);
    setShotId(null);
    clearError('screenshot');
    if (rupees) {
      setAmountText(String(rupees));
      clearError('amount');
      pushToast('toast.amountDetected', 'success', { amount: rupees });
    }
  };

  const reset = () => {
    setAmountText('');
    setNote('');
    setFile(null);
    setShotId(null);
    setErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrors({});

    const parsed = parseAmount(amountText);
    if (!parsed.ok) {
      setError('amount', parsed.reason === 'too_large' ? 'amount_too_large' : 'amount_invalid');
      return;
    }

    setBusy(true);
    let nextShotId = shotId;

    if (file) {
      const prepared = await prepareScreenshot(file);
      if (!prepared.ok) {
        setBusy(false);
        setError('screenshot', prepared.code);
        return;
      }
      try {
        nextShotId = await saveScreenshot(prepared.blob, prepared.mime, {
          width: prepared.width,
          height: prepared.height,
        });
      } catch {
        setBusy(false);
        setError('screenshot', 'storage_unavailable');
        return;
      }
    }

    const payload = {
      customerId,
      type,
      amountPaise: parsed.paise,
      date,
      note,
      screenshotId: nextShotId,
    };

    const result =
      editing && initial
        ? updateTransaction(initial.id, {
            type: payload.type,
            amountPaise: payload.amountPaise,
            date: payload.date,
            note: payload.note,
            screenshotId: payload.screenshotId,
          })
        : addTransaction(payload);

    if (!result.ok) {
      setBusy(false);
      if (nextShotId && nextShotId !== initialShotId) void deleteScreenshot(nextShotId);
      for (const error of result.errors) {
        setError(
          error.field === 'amountPaise'
            ? 'amount'
            : error.field === 'customerId'
              ? 'form'
              : error.field,
          error.code,
        );
      }
      if (result.errors.some((error) => error.field === 'customerId')) {
        setError('form', 'customer_not_found');
      }
      return;
    }

    if (initialShotId && nextShotId !== initialShotId) {
      void deleteScreenshot(initialShotId);
    }

    setBusy(false);

    if (editing) {
      pushToast('toast.entryUpdated');
      onSaved?.();
      return;
    }

    const state = useStore.getState();
    const balancePaise = totalsFor(buildTotalsIndex(state.transactions), customerId).balancePaise;
    setSuccess({
      type: payload.type,
      amountPaise: payload.amountPaise,
      balancePaise,
      date: payload.date,
    });
    reset();
    onSaved?.();
  };

  const formError = errors.form;

  return (
    <>
      <form
        onSubmit={submit}
        className={cn('space-y-4', compact && 'space-y-3.5')}
        noValidate
        data-entry-form={editing ? 'edit' : 'new'}
      >
        <div>
          <span className="label">{t('customer.entryType')}</span>
          <Segmented
            fullWidth
            ariaLabel={t('customer.entryType')}
            value={type}
            onChange={(value) => setType(value)}
            options={[
              {
                value: 'credit',
                label: t('customer.credit'),
                icon: <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />,
              },
              {
                value: 'payment',
                label: t('customer.payment'),
                icon: <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />,
              },
            ]}
          />
        </div>

        <Field label={t('common.amount')} htmlFor={`${uid}-amount`} error={errors.amount}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">
              ₹
            </span>
            <Input
              id={`${uid}-amount`}
              name="amount"
              value={amountText}
              onChange={(event) => {
                setAmountText(event.target.value.replace(/[^\d.,]/g, ''));
                clearError('amount');
              }}
              placeholder={t('customer.amountPlaceholder')}
              inputMode="decimal"
              autoComplete="off"
              className="h-12 pl-9 text-lg font-semibold tabular"
              aria-invalid={Boolean(errors.amount)}
            />
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('common.date')} htmlFor={`${uid}-date`} error={errors.date}>
            <Input
              id={`${uid}-date`}
              name="date"
              type="date"
              value={date}
              max={today}
              onChange={(event) => {
                setDate(event.target.value);
                clearError('date');
              }}
              aria-invalid={Boolean(errors.date)}
            />
          </Field>
          <Field
            label={t('common.note')}
            htmlFor={`${uid}-note`}
            error={errors.note}
            optional={t('common.optional')}
          >
            <Input
              id={`${uid}-note`}
              name="note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value.slice(0, 200));
                clearError('note');
              }}
              placeholder={t('customer.notePlaceholder')}
              maxLength={200}
              autoComplete="off"
            />
          </Field>
        </div>

        <div>
          <span className="label">{t('customer.screenshot')}</span>
          <div className="rounded-xl border border-dashed border-line bg-surface2/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={screenshotInputId}
                type="file"
                accept={SHOT_ACCEPT}
                className="sr-only"
                onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
                data-testid="shot-input"
              />
              <Button
                size="sm"
                variant="primary"
                icon={<ScanLine className="h-4 w-4" />}
                onClick={() => setScanOpen(true)}
              >
                {t('scan.title')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<ImagePlus className="h-4 w-4" />}
                onClick={() => document.getElementById(screenshotInputId)?.click()}
              >
                {imageUrl ? t('customer.changeImage') : t('customer.chooseImage')}
              </Button>

              {imageUrl ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={removeImage}
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                >
                  {t('customer.removeImage')}
                </Button>
              ) : null}
            </div>

            {imageUrl ? (
              <div className="mt-3 flex items-start gap-3">
                <img
                  src={imageUrl}
                  alt={t('customer.screenshot')}
                  className="h-16 w-16 rounded-lg border border-line object-cover"
                />
                <p className="min-w-0 flex-1 text-xs text-muted">{t('scan.privacy')}</p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted">
                JPG, PNG, WEBP · max {Math.round(MAX_SHOT_BYTES / (1024 * 1024))} MB
              </p>
            )}
            {errors.screenshot ? (
              <p className="error-text" role="alert">
                {errors.screenshot}
              </p>
            ) : null}
          </div>
        </div>

        {formError ? (
          <p className="error-text" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={busy}
            icon={<Wallet className="h-4 w-4" />}
          >
            {editing ? t('customer.saveChanges') : t('customer.addEntry')}
          </Button>
          {onCancel ? (
            <Button variant="secondary" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </div>
      </form>

      <ScannerDialog open={scanOpen} onClose={() => setScanOpen(false)} onUse={onScanUse} />

      <SuccessDialog
        open={Boolean(success)}
        kind="entry"
        title={success?.type === 'payment' ? t('success.paymentTitle') : t('success.creditTitle')}
        subtitle={
          success ? t('success.recordedOn', { date: formatDateLong(success.date, language) }) : ''
        }
        amountPaise={success?.amountPaise}
        balancePaise={success?.balancePaise}
        balanceLabel={t('success.newBalance')}
        primaryLabel={t('success.done')}
        onPrimary={() => setSuccess(null)}
        secondaryLabel={t('success.addAnother')}
        onSecondary={() => setSuccess(null)}
        onClose={() => setSuccess(null)}
      />
    </>
  );
}
