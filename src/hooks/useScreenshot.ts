import { useEffect, useState } from 'react';
import { getScreenshotUrl } from '@/services/screenshots';

export interface ScreenshotUrlState {
  url: string | null;
  loading: boolean;
}

/** Resolves an IndexedDB screenshot id to a cached object URL. */
export function useScreenshotUrl(id: string | null | undefined): ScreenshotUrlState {
  const [state, setState] = useState<ScreenshotUrlState>({ url: null, loading: Boolean(id) });

  useEffect(() => {
    if (!id) {
      setState({ url: null, loading: false });
      return undefined;
    }
    let active = true;
    setState({ url: null, loading: true });
    void getScreenshotUrl(id).then((value) => {
      if (active) setState({ url: value, loading: false });
    });
    return () => {
      active = false;
    };
  }, [id]);

  return state;
}

/** Object URL for a local File (form previews), revoked on change. */
export function useFilePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    } catch {
      setUrl(null);
    }
    return () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
      }
    };
  }, [file]);

  return url;
}
