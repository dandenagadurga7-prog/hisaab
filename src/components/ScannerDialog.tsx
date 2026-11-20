import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Camera,
  Check,
  Image as ImageIcon,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useFilePreview } from '@/hooks/useScreenshot';
import { scanReceipt, type ScanResult } from '@/services/ocr';
import { SHOT_ACCEPT, validateScreenshotFile } from '@/services/screenshots';
import { Button } from './ui';
import { cn } from '@/lib/cn';

type Step = 'capture' | 'scanning' | 'review';

export interface ScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onUse: (file: File, rupees: number | null) => void;
}

function progressWidth(progress: number): string {
  return `${Math.max(8, Math.min(100, Math.round(progress * 100)))}%`;
}

/**
 * Full receipt-scanning flow: capture → scan → confirm.
 * The amount is only a suggestion; the owner chooses what to attach.
 */
export function ScannerDialog({ open, onClose, onUse }: ScannerDialogProps) {
  const t = useT();
  const [step, setStep] = useState<Step>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const runId = useRef(0);
  const preview = useFilePreview(file);

  useEffect(() => {
    if (!open) {
      runId.current += 1;
      setStep('capture');
      setFile(null);
      setResult(null);
      setProgress(0);
      setStatus('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const pick = async (picked: File | null) => {
    if (!picked) return;
    const validation = validateScreenshotFile(picked);
    if (!validation.ok) {
      setError(t(`error.${validation.code}`));
      return;
    }

    setError(null);
    setFile(picked);
    setResult(null);
    setProgress(0);
    setStatus(t('scan.preparing'));
    setStep('scanning');

    runId.current += 1;
    const id = runId.current;
    const started = Date.now();

    const scan = await scanReceipt(picked, (update) => {
      if (runId.current !== id) return;
      setProgress(update.progress);
      setStatus(update.status);
    });

    const elapsed = Date.now() - started;
    if (elapsed < 1400) {
      await new Promise((resolve) => setTimeout(resolve, 1400 - elapsed));
    }
    if (runId.current !== id) return;

    setResult(scan);
    setStep('review');
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = '';
    void pick(picked);
  };

  const restart = () => {
    runId.current += 1;
    setStep('capture');
    setFile(null);
    setResult(null);
    setProgress(0);
    setStatus('');
    setError(null);
  };

  const confirm = (rupees: number | null) => {
    if (!file) return;
    onUse(file, rupees);
    onClose();
  };

  const friendlyStatus =
    status.includes('recognizing') || status.includes('recognizing text')
      ? t('scan.reading')
      : status.includes('language') || status.includes('core') || status.includes('initializ')
        ? t('scan.stepDownload')
        : t('scan.preparing');

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center overflow-y-auto sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 animate-fade-in bg-ink/55 backdrop-blur-[3px]" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        className="relative z-10 w-full max-w-md animate-slide-up rounded-t-3xl border border-line bg-surface shadow-pop sm:animate-scale-in sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <ScanLine className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="scan-title" className="text-[15px] font-semibold text-ink">
              {t('scan.title')}
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t('scan.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <input
            ref={cameraRef}
            type="file"
            accept={SHOT_ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={onInputChange}
            data-testid="scan-camera-input"
          />
          <input
            ref={galleryRef}
            type="file"
            accept={SHOT_ACCEPT}
            className="sr-only"
            onChange={onInputChange}
            data-testid="scan-gallery-input"
          />

          <div className="relative overflow-hidden rounded-2xl border border-line bg-ink/90">
            <div className="relative aspect-[4/3] w-full">
              {preview && step !== 'capture' ? (
                <img
                  src={preview}
                  alt={t('scan.title')}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : null}

              {step === 'capture' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                  <Camera className="h-9 w-9" aria-hidden />
                  <p className="text-[11.5px] font-medium">{t('scan.frameHint')}</p>
                </div>
              ) : null}

              {step === 'scanning' ? (
                <>
                  <div className="absolute inset-0 bg-ink/25" aria-hidden />
                  <div
                    className="pointer-events-none absolute inset-x-5 h-[2px] animate-scan-line rounded-full bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_14px_2px] shadow-accent/50"
                    aria-hidden
                  />
                </>
              ) : null}

              {step === 'review' && result?.rupees ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-ink shadow-pop">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    ₹{result.rupees}
                  </span>
                </div>
              ) : null}

              <Corner className="left-3 top-3 rounded-tl-lg border-l-2 border-t-2" />
              <Corner className="right-3 top-3 rounded-tr-lg border-r-2 border-t-2" />
              <Corner className="bottom-3 left-3 rounded-bl-lg border-b-2 border-l-2" />
              <Corner className="bottom-3 right-3 rounded-br-lg border-b-2 border-r-2" />
            </div>
          </div>

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          {step === 'capture' ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  icon={<Camera className="h-4 w-4" />}
                  onClick={() => cameraRef.current?.click()}
                >
                  {t('scan.openCamera')}
                </Button>
                <Button
                  variant="secondary"
                  icon={<ImageIcon className="h-4 w-4" />}
                  onClick={() => galleryRef.current?.click()}
                >
                  {t('scan.chooseImage')}
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                {t('scan.modelNote')}
              </p>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                {t('scan.privacy')}
              </p>
            </div>
          ) : null}

          {step === 'scanning' ? (
            <div className="mt-4 space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-[11.5px] font-medium text-muted">
                <span>{friendlyStatus}</span>
                <span className="tabular">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: progressWidth(progress) }}
                />
              </div>
            </div>
          ) : null}

          {step === 'review' && result ? (
            <div className="mt-4 space-y-3">
              {result.rupees ? (
                <div className="rounded-xl border border-accent/25 bg-accent-soft px-3 py-2.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-accent">
                    {t('scan.detected')}
                  </div>
                  <div className="mt-0.5 text-[24px] font-bold leading-none tabular text-accent">
                    ₹{result.rupees}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-warn">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {t('scan.notDetected')}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">{t('scan.notDetectedHint')}</p>
                </div>
              )}

              {result.ocrError ? (
                <p className="text-[10.5px] text-muted">{t('scan.failed')}</p>
              ) : null}

              <div className="space-y-2">
                {result.rupees ? (
                  <Button
                    variant="primary"
                    fullWidth
                    icon={<Check className="h-4 w-4" />}
                    onClick={() => confirm(result.rupees)}
                  >
                    {t('scan.useAmount', { amount: result.rupees })}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    icon={<ImageIcon className="h-4 w-4" />}
                    onClick={() => confirm(null)}
                  >
                    {t('scan.attachOnly')}
                  </Button>
                )}

                {result.rupees ? (
                  <Button variant="secondary" fullWidth size="sm" onClick={() => confirm(null)}>
                    {t('scan.attachOnly')}
                  </Button>
                ) : null}

                <Button
                  variant="ghost"
                  fullWidth
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={restart}
                >
                  {t('scan.retake')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute h-7 w-7 border-accent/80', className)}
    />
  );
}
