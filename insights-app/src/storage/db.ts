// אחסון מקומי בדפדפן (IndexedDB). אין שרת ואין שליחה החוצה.
// התמונות נשמרות כ־Blob במכשיר בלבד, ונמחקות יחד עם התהליך.
import type { ChannelId, ImageRecord, Session } from '../types';

const DB_NAME = 'insights-report-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('images')) {
        const s = db.createObjectStore('images', { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        const r = fn(t);
        let result: T;
        if (r) r.onsuccess = () => (result = r.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 16);

export const listSessions = () =>
  tx<Session[]>(['sessions'], 'readonly', (t) => t.objectStore('sessions').getAll()).then((s) =>
    s.sort((a, b) => b.updatedAt - a.updatedAt),
  );

export const getSession = (id: string) =>
  tx<Session | undefined>(['sessions'], 'readonly', (t) => t.objectStore('sessions').get(id));

export const saveSession = (s: Session) =>
  tx(['sessions'], 'readwrite', (t) => {
    t.objectStore('sessions').put({ ...s, updatedAt: Date.now() });
  });

export const getImages = (sessionId: string) =>
  tx<ImageRecord[]>(['images'], 'readonly', (t) => t.objectStore('images').index('sessionId').getAll(sessionId));

/** שומר תמונה לערוץ ומחליף תמונה קודמת באותו ערוץ (מזעור מידע). */
export async function putImage(rec: ImageRecord) {
  const existing = await getImages(rec.sessionId);
  await tx(['images'], 'readwrite', (t) => {
    const s = t.objectStore('images');
    existing.filter((e) => e.channel === rec.channel).forEach((e) => s.delete(e.id));
    s.put(rec);
  });
}

export async function deleteImage(sessionId: string, channel: ChannelId) {
  const existing = await getImages(sessionId);
  await tx(['images'], 'readwrite', (t) => {
    const s = t.objectStore('images');
    existing.filter((e) => e.channel === channel).forEach((e) => s.delete(e.id));
  });
}

/** מחיקת תהליך וכל הנתונים הקשורים אליו (תמונות, תשובות, תצפיות) בטרנזקציה אחת. */
export async function deleteSession(id: string) {
  const imgs = await getImages(id);
  await tx(['sessions', 'images'], 'readwrite', (t) => {
    t.objectStore('sessions').delete(id);
    const s = t.objectStore('images');
    imgs.forEach((i) => s.delete(i.id));
  });
}

export const deleteAll = () =>
  tx(['sessions', 'images'], 'readwrite', (t) => {
    t.objectStore('sessions').clear();
    t.objectStore('images').clear();
  });
