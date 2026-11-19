import type { ChannelId, ImageRecord, Observation, Session } from '../types';
import { analyzeBlob, computedObservations } from './imageAnalysis';
import { putImage, uid } from '../storage/db';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function validateFile(f: Blob): string | null {
  if (f.type && !ACCEPTED.includes(f.type)) return 'סוג קובץ לא נתמך. יש להעלות JPG, PNG או WEBP.';
  if (f.size > MAX_UPLOAD_BYTES) return 'הקובץ גדול מ־15MB. נסו תמונה קטנה יותר.';
  if (f.size === 0) return 'הקובץ ריק.';
  return null;
}

/** ניתוח מקומי + שמירה. מחזיר את הרשומה ואת התצפיות המחושבות לעדכון התהליך. */
export async function ingestImage(sessionId: string, channel: ChannelId, blob: Blob) {
  const { quality, computed } = await analyzeBlob(blob, channel);
  const rec: ImageRecord = {
    id: uid(),
    sessionId,
    channel,
    blob,
    mime: blob.type || 'image/jpeg',
    quality,
    computed,
    createdAt: Date.now(),
  };
  await putImage(rec);
  return { rec, obs: computed ? computedObservations(channel, computed) : [] };
}

/** מחליף את התצפיות המחושבות של ערוץ, ושומר את הידניות. */
export function mergeComputed(s: Session, channel: ChannelId, computed: Observation[]): Session {
  const kept = (s.observations[channel] ?? []).filter((o) => o.source !== 'computed');
  return { ...s, observations: { ...s.observations, [channel]: [...computed, ...kept] } };
}
