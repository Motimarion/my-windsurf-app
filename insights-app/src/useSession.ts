import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageRecord, Session } from './types';
import { getImages, getSession, saveSession } from './storage/db';

/** טוען תהליך ותמונותיו, ושומר כל שינוי מיד ל־IndexedDB (שמירת התקדמות). */
export function useSession(id: string) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Session | null>(null);

  const reloadImages = useCallback(() => getImages(id).then(setImages), [id]);

  useEffect(() => {
    let alive = true;
    Promise.all([getSession(id), getImages(id)])
      .then(([s, imgs]) => {
        if (!alive) return;
        latest.current = s ?? null;
        setSession(s ?? null);
        setImages(imgs);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  const update = useCallback((fn: (s: Session) => Session) => {
    if (!latest.current) return;
    const next = { ...fn(latest.current), updatedAt: Date.now() };
    latest.current = next;
    setSession(next);
    saveSession(next).catch((e) => setError(`שמירה נכשלה: ${e}`));
  }, []);

  return { session, images, update, reloadImages, error };
}
