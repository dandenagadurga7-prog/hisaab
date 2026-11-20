/**
 * Screenshot storage. Binary receipts live in IndexedDB — never in
 * localStorage, which is synchronous and far too small for images.
 */

const DB_NAME = 'hisaab-shots';
const STORE = 'screenshots';
const DB_VERSION = 1;

export const SHOT_ACCEPT = 'image/jpeg,image/png,image/jpg,image/webp';
export const MAX_SHOT_BYTES = 5 * 1024 * 1024;
export const MAX_EDGE_PX = 1600;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ScreenshotRecord {
  id: string;
  /** Stored as bytes rather than a Blob for maximum IndexedDB compatibility. */
  data: ArrayBuffer;
  mime: string;
  size: number;
  createdAt: number;
  width?: number;
  height?: number;
}

export type PrepareResult =
  | { ok: true; blob: Blob; mime: string; width?: number; height?: number }
  | { ok: false; code: 'screenshot_type' | 'screenshot_size' };

export type ScreenshotValidation =
  | { ok: true }
  | { ok: false; code: 'screenshot_type' | 'screenshot_size' };

/** Cheap synchronous validation used the moment a file is picked. */
export function validateScreenshotFile(file: File): ScreenshotValidation {
  if (!ALLOWED_MIME.has(extensionToMime(file))) return { ok: false, code: 'screenshot_type' };
  if (file.size > MAX_SHOT_BYTES) return { ok: false, code: 'screenshot_size' };
  return { ok: true };
}

export function extensionToMime(file: File): string {
  const name = (file.name || '').toLowerCase();
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return file.type;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('IndexedDB could not be opened.'));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab.'));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export async function isScreenshotStorageAvailable(): Promise<boolean> {
  try {
    const db = await openDatabase();
    db.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and, when possible, downscales an image before it is stored.
 * Falls back to the original blob when canvas/bitmap APIs are unavailable.
 */
export async function prepareScreenshot(file: File): Promise<PrepareResult> {
  const mime = extensionToMime(file);
  if (!ALLOWED_MIME.has(mime)) return { ok: false, code: 'screenshot_type' };
  if (file.size > MAX_SHOT_BYTES) return { ok: false, code: 'screenshot_size' };

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return { ok: true, blob: file, mime };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_EDGE_PX ? MAX_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (scale === 1 && file.size <= 1_500_000) {
      bitmap.close();
      return { ok: true, blob: file, mime, width, height };
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.toBlob !== 'function') {
      bitmap.close();
      return { ok: true, blob: file, mime };
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.85);
      } catch {
        resolve(null);
      }
    });
    if (!blob) return { ok: true, blob: file, mime, width, height };
    return { ok: true, blob, mime: 'image/jpeg', width, height };
  } catch {
    return { ok: true, blob: file, mime };
  }
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('The image could not be read.'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function saveScreenshot(
  blob: Blob,
  mime: string,
  dimensions?: { width?: number; height?: number },
): Promise<string> {
  const db = await openDatabase();
  const id = `shot_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const data = await blobToArrayBuffer(blob);
  const record: ScreenshotRecord = {
    id,
    data,
    mime,
    size: blob.size,
    createdAt: Date.now(),
    width: dimensions?.width,
    height: dimensions?.height,
  };
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await runRequest(tx.objectStore(STORE).put(record));
  } finally {
    db.close();
  }
  return id;
}

export async function getScreenshot(id: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    try {
      const tx = db.transaction(STORE, 'readonly');
      const record = await runRequest<ScreenshotRecord | undefined>(
        tx.objectStore(STORE).get(id) as IDBRequest<ScreenshotRecord | undefined>,
      );
      if (!record?.data) return null;
      return new Blob([record.data], { type: record.mime });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function deleteScreenshot(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await runRequest(tx.objectStore(STORE).delete(id));
    } finally {
      db.close();
    }
  } catch {
    /* deleting a receipt image must never break the ledger */
  }
  forgetScreenshotUrl(id);
}

export async function deleteScreenshots(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteScreenshot(id)));
}

export async function clearScreenshots(): Promise<void> {
  try {
    const db = await openDatabase();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await runRequest(tx.objectStore(STORE).clear());
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
  clearScreenshotUrlCache();
}

export async function countScreenshots(): Promise<number> {
  try {
    const db = await openDatabase();
    try {
      const tx = db.transaction(STORE, 'readonly');
      return await runRequest(tx.objectStore(STORE).count());
    } finally {
      db.close();
    }
  } catch {
    return 0;
  }
}

const urlCache = new Map<string, string>();

/** Object URL cache keeps re-renders from leaking blob URLs. */
export async function getScreenshotUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getScreenshot(id);
  if (!blob) return null;
  try {
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export function forgetScreenshotUrl(id: string): void {
  const url = urlCache.get(id);
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
  urlCache.delete(id);
}

export function clearScreenshotUrlCache(): void {
  for (const id of [...urlCache.keys()]) forgetScreenshotUrl(id);
}

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
}

export async function estimateStorage(): Promise<StorageEstimateInfo | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
