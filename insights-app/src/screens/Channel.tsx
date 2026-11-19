import { useMemo, useState } from 'react';
import { useObjectUrls } from '../useObjectUrls';
import type { ChannelId, ImageRecord, Observation, Session } from '../types';
import { channelById } from '../data/channels';
import StepNav, { stepList } from '../components/StepNav';
import { StatusBadge, radioKeys, rovingIndex } from '../components/ui';
import { ingestImage, mergeComputed, validateFile } from '../engine/ingest';
import { deleteImage } from '../storage/db';
import { go } from '../router';

interface Props {
  session: Session;
  images: ImageRecord[];
  channel: ChannelId;
  update: (fn: (s: Session) => Session) => void;
  reloadImages: () => Promise<unknown>;
  toast: (m: string) => void;
}

export default function Channel({ session, images, channel, update, reloadImages, toast }: Props) {
  const def = channelById(channel);
  const img = images.find((i) => i.channel === channel);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const urlItems = useMemo(() => (img ? [{ key: 'img' as const, blob: img.blob }] : []), [img]);
  const url = useObjectUrls(urlItems).img;

  const obs = session.observations[channel] ?? [];
  const valueOf = (fid: string) => obs.find((o) => o.featureId === fid);

  async function onFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    input.value = ''; // כדי שבחירה חוזרת של אותו קובץ תפעיל שוב את האירוע
    setErr(null);
    if (!f || busy) return;
    const replacing = !!img;
    const v = validateFile(f);
    if (v) return setErr(v);
    setBusy(true);
    try {
      const { obs: computed } = await ingestImage(session.id, channel, f);
      update((s) => mergeComputed(s, channel, computed));
      await reloadImages();
      if (replacing) toast('התמונה הוחלפה — הסימונים הידניים אופסו, כי תיארו את התמונה הקודמת');
    } catch (e) {
      setErr(`לא ניתן לקרוא את התמונה (${(e as Error).message}). נסו קובץ JPG או PNG.`);
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    await deleteImage(session.id, channel);
    update((s) => {
      const { [channel]: _removed, ...rest } = s.observations;
      void _removed;
      return { ...s, observations: rest };
    });
    await reloadImages();
    toast('התמונה והתצפיות של ערוץ זה נמחקו');
  }

  function setManual(featureId: string, value: string) {
    update((s) => {
      const list = (s.observations[channel] ?? []).filter((o) => o.featureId !== featureId);
      const cur = valueOf(featureId);
      const next: Observation[] = cur?.value === value ? list : [...list, { featureId, value, source: 'manual' }];
      return { ...s, observations: { ...s.observations, [channel]: next } };
    });
  }

  const steps = stepList(session, images);
  const idx = steps.findIndex((s) => s.key === channel);
  const next = steps[idx + 1];

  return (
    <>
      <StepNav session={session} images={images} active={channel} />
      <h1>
        <span aria-hidden>{def.icon}</span> {def.title}
      </h1>

      <div className="grid grid-2">
        <div className="card">
          <h3>הוראות צילום</h3>
          <ol className="small" style={{ paddingInlineStart: 18, margin: 0 }}>
            {def.instructions.map((t) => (
              <li key={t} style={{ marginBottom: 6 }}>
                {t}
              </li>
            ))}
          </ol>
          <div className="notice small" style={{ marginTop: 12 }}>
            התמונה נשמרת ומנותחת במכשיר בלבד. היא לא נשלחת לשום שירות.
          </div>
        </div>

        <div className="card">
          {img && url ? (
            <>
              <img className="preview" src={url} alt={`תמונה שהועלתה: ${def.title}`} />
              <div className="row spread" style={{ marginTop: 10 }}>
                <strong>בדיקת איכות</strong>
                <StatusBadge status={img.quality.overall} label={img.quality.overall === 'ok' ? 'איכות טובה' : img.quality.overall === 'warn' ? 'איכות סבירה' : 'מומלץ לצלם מחדש'} />
              </div>
              <ul className="analysis-list small">
                {img.quality.checks.map((c) => (
                  <li key={c.id}>
                    <StatusBadge status={c.status} label={c.label} />
                    <span className="muted">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="row" style={{ marginTop: 8 }}>
                <label className="btn sm file-btn">
                  {busy ? 'מנתח…' : 'החלפת תמונה'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => onFile(e.currentTarget)} />
                </label>
                <button className="btn sm danger" onClick={removeImage}>
                  מחיקת התמונה
                </button>
              </div>
            </>
          ) : (
            <div className="dropzone">
              <p style={{ fontSize: 34, margin: 0 }} aria-hidden>
                {def.icon}
              </p>
              <p className="small muted">טרם הועלתה תמונה</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <label className="btn primary file-btn">
                  {busy ? 'מנתח…' : 'צילום במצלמה'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={busy} onChange={(e) => onFile(e.currentTarget)} />
                </label>
                <label className="btn file-btn">
                  העלאת קובץ
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => onFile(e.currentTarget)} />
                </label>
              </div>
            </div>
          )}
          {err && (
            <div className="notice warn small" role="alert" style={{ marginTop: 10 }}>
              {err}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>תצפיות — מה רואים בתמונה</h3>
        <p className="small muted">
          סמנו רק מה שנראה בבירור. זהו תיאור בלבד — הפרשנויות המסורתיות מוצגות בדוח בנפרד, יחד עם דירוג הראיות.
          {!img && ' (יש להעלות תמונה כדי לסמן תצפיות.)'}
        </p>
        {def.features.map((f) => {
          const cur = valueOf(f.id);
          return (
            <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row spread small">
                <strong>{f.label}</strong>
                {f.computed && <span className="badge accent">חישוב אוטומטי</span>}
                {cur?.source === 'demo' && <span className="badge warn">ערך הדגמה</span>}
              </div>
              {f.computed ? (
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {cur ? cur.value : <span className="muted">יחושב לאחר העלאת תמונה</span>}
                  {img?.computed && f.id === 'drawing.size' && (
                    <span className="muted"> · {(img.computed.bboxAreaRatio * 100).toFixed(0)}% משטח הדף</span>
                  )}
                  {img?.computed?.textLines !== undefined && f.id === 'hw.lines' && (
                    <span className="muted"> · זוהו {img.computed.textLines} שורות</span>
                  )}
                </p>
              ) : (
                <div className="chips" style={{ marginTop: 6 }} role="radiogroup" aria-label={f.label} onKeyDown={radioKeys}>
                  {f.options.map((o) => (
                    <button
                      key={o}
                      className={`chip ${cur?.value === o ? 'on' : ''}`}
                      role="radio"
                      aria-checked={cur?.value === o}
                      tabIndex={rovingIndex(f.options.indexOf(o), f.options.indexOf(cur?.value ?? ''))}
                      disabled={!img}
                      onClick={() => setManual(f.id, o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="row spread no-print">
        <button className="btn ghost" onClick={() => go({ name: 'hub', id: session.id })}>
          חזרה לסקירה
        </button>
        {next && (
          <button className="btn primary" onClick={() => go(next.route)}>
            המשך: {next.label} ←
          </button>
        )}
      </div>
    </>
  );
}
