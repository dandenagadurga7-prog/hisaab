/**
 * Receipt scanning and amount suggestion.
 *
 * Tesseract.js is loaded lazily the first time an owner scans a receipt, so the
 * initial app load stays tiny. Everything runs on the device: the image is
 * never uploaded anywhere. The result is always a *suggestion* — the entry form
 * only fills the amount field, and the owner presses Save.
 *
 * If OCR is unavailable (offline first run, blocked CDN, unsupported browser)
 * the scan still returns the image and a filename-based hint, so the scanner
 * degrades into a plain receipt capture instead of failing.
 */

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface AmountSuggestion {
  rupees: number;
  source: 'ocr' | 'filename';
}

export interface ScanResult {
  rupees: number | null;
  rawText: string;
  source: 'ocr' | 'filename' | 'none';
  durationMs: number;
  ocrError: string | null;
}

const MAX_SUGGESTION = 1_000_000;
const SCAN_TIMEOUT_MS = 60_000;

function plausible(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_SUGGESTION) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Picks the most likely paid amount out of OCR text.
 * Currency-marked and "total/paid/amount" lines win; long reference numbers,
 * dates and phone numbers lose.
 */
export function parseAmountFromText(text: string): AmountSuggestion | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const candidates: Array<{ value: number; score: number }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const keyword = /(total|paid|amount|balance|due|राशि|మొత్తం|చెల్లింపు|बकाया)/i.test(trimmed);
    const currency = /(₹|rs\.?|inr)/i.test(trimmed);
    const negative = /(change|discount|tax|cgst|sgst|refund|due date|invoice no)/i.test(trimmed);

    const matches = trimmed.match(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g);
    if (!matches) continue;

    for (const raw of matches) {
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.length >= 7 && !raw.includes('.')) continue; // refs, UPI ids, phone numbers
      const value = plausible(Number(raw.replace(/,/g, '')));
      if (value === null) continue;

      let score = 0;
      if (currency) score += 3;
      if (keyword) score += 2;
      if (raw.includes('.')) score += 1;
      if (negative) score -= 1;
      // A total is usually the largest number on the receipt.
      score += Math.min(2, value / 1000);
      candidates.push({ value, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.value - a.value);
  const best = candidates[0];
  if (!best) return null;
  return { rupees: best.value, source: 'ocr' };
}

/** Fallback: some shops save receipts as "paid-700.jpg". */
export function parseAmountFromFilename(filename: string): AmountSuggestion | null {
  const withoutExtension = filename.replace(/\.[a-z0-9]+$/i, '');
  const matches = withoutExtension.match(/\d+(?:[.,]\d{1,2})?/g);
  if (!matches) return null;
  const values = matches
    .map((raw) => plausible(Number(raw.replace(',', '.'))))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return { rupees: Math.max(...values), source: 'filename' };
}

type TesseractWorker = {
  recognize: (image: File) => Promise<{ data?: { text?: string } }>;
  terminate: () => Promise<unknown>;
};

let worker: TesseractWorker | null = null;
let workerPromise: Promise<TesseractWorker> | null = null;
let progressSink: ((progress: OcrProgress) => void) | null = null;

async function ensureWorker(): Promise<TesseractWorker> {
  if (worker) return worker;
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const loaded: unknown = await import('tesseract.js');
    const api = loaded as {
      createWorker?: (
        lang: string,
        oem?: number,
        options?: { logger?: (message: { status?: string; progress?: number }) => void },
      ) => Promise<TesseractWorker>;
    };
    if (typeof api.createWorker !== 'function') {
      throw new Error('OCR engine unavailable');
    }
    const created = await api.createWorker('eng', 1, {
      logger: (message) => {
        if (!progressSink || !message?.status) return;
        progressSink({
          status: message.status,
          progress: typeof message.progress === 'number' ? message.progress : 0,
        });
      },
    });
    worker = created;
    return created;
  })();

  try {
    return await workerPromise;
  } finally {
    workerPromise = null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('OCR timed out')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Scans an image and returns the best amount guess plus the raw text.
 * Never throws: failures are reported in the result so the UI can continue.
 */
export async function scanReceipt(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<ScanResult> {
  const started = Date.now();
  progressSink = onProgress ?? null;

  try {
    onProgress?.({ status: 'preparing', progress: 0 });
    const result = await withTimeout(
      (async () => {
        const active = await ensureWorker();
        return active.recognize(file);
      })(),
      SCAN_TIMEOUT_MS,
    );
    const text = result?.data?.text ?? '';
    const parsed = parseAmountFromText(text);

    if (parsed) {
      return {
        rupees: parsed.rupees,
        rawText: text,
        source: 'ocr',
        durationMs: Date.now() - started,
        ocrError: null,
      };
    }

    const fromName = parseAmountFromFilename(file.name);
    return {
      rupees: fromName?.rupees ?? null,
      rawText: text,
      source: fromName ? 'filename' : 'none',
      durationMs: Date.now() - started,
      ocrError: null,
    };
  } catch (error) {
    // Reset the worker so a later scan can retry cleanly.
    const broken = worker;
    worker = null;
    if (broken) void broken.terminate().catch(() => undefined);

    const fromName = parseAmountFromFilename(file.name);
    return {
      rupees: fromName?.rupees ?? null,
      rawText: '',
      source: fromName ? 'filename' : 'none',
      durationMs: Date.now() - started,
      ocrError: error instanceof Error ? error.message : 'OCR failed',
    };
  } finally {
    progressSink = null;
  }
}

/** Frees the OCR worker (used by tests and when the owner leaves the scanner). */
export async function disposeOcr(): Promise<void> {
  const active = worker;
  worker = null;
  if (active) await active.terminate().catch(() => undefined);
}
