import { useEffect, useState } from 'react';

/**
 * יוצר כתובות blob: לתמונות ומשחרר אותן בניקוי.
 * היצירה בתוך useEffect (ולא useMemo) כדי שגם תחת StrictMode — שמריץ ניקוי והרצה כפולה —
 * לא נשתמש בכתובת שכבר שוחררה.
 */
export function useObjectUrls<K extends string>(items: { key: K; blob: Blob }[]): Partial<Record<K, string>> {
  const [urls, setUrls] = useState<Partial<Record<K, string>>>({});
  useEffect(() => {
    const made = Object.fromEntries(items.map((i) => [i.key, URL.createObjectURL(i.blob)])) as Partial<Record<K, string>>;
    setUrls(made);
    return () => Object.values(made).forEach((u) => URL.revokeObjectURL(u as string));
  }, [items]);
  return urls;
}
