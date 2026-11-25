import { useMemo, useState } from 'react';
import { useObjectUrls } from '../useObjectUrls';
import type { BlockReason, ChannelId, ImageRecord, Observation, Session } from '../types';
import { BLOCK_REASONS, RETIRED_FEATURES, UNDETERMINED, activeObservations, channelById } from '../data/channels';
import BackgroundQuestions from '../components/BackgroundQuestions';
import { demoSampleDataUrl } from '../demo/synthetic';
import StepNav, { stepList } from '../components/StepNav';
import { StatusBadge, radioKeys, rovingIndex } from '../components/ui';
import { ingestImage, mergeComputed, validateFile } from '../engine/ingest';
import { clearAi, refreshAgreement } from '../engine/bridge';
import { useAutoSettings } from '../engine/autoAi';
import { deleteImage } from '../storage/db';
import { go } from '../router';
import AiBridge from '../components/AiBridge';

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
  const [auto] = useAutoSettings();
  const autoOn = auto.enabled && !!auto.key.trim() && auto.consentAuto;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const urlItems = useMemo(() => (img ? [{ key: 'img' as const, blob: img.blob }] : []), [img]);
  const url = useObjectUrls(urlItems).img;

  // תצפיות פעילות בלבד: מאפיין שהוסר (לחץ כתיבה) לא מוצג, ו"לא ניתן לזהות" הישן מוצג כ"לא ניתן לקבוע".
  const obs = activeObservations(session.observations[channel]);
  const valueOf = (fid: string) => obs.find((o) => o.featureId === fid);
  const retired = (session.observations[channel] ?? []).filter((o) => o.featureId in RETIRED_FEATURES);
  const [sample, setSample] = useState<string | null>(null);

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
      // קודם התמונה החדשה ורק אחר כך איפוס התוצאות, כדי שתחנת ה־AI לא תשלח שוב את התמונה הקודמת ברגע שבין שני העדכונים.
      await reloadImages();
      update((s) => clearAi(mergeComputed(s, channel, computed), channel));
      if (replacing) toast('התמונה הוחלפה — הסימונים הידניים וערכי ה־AI אופסו, כי תיארו את התמונה הקודמת');
    } catch (e) {
      setErr(`לא ניתן לקרוא את התמונה (${(e as Error).message}). נסו קובץ JPG או PNG.`);
    } finally {
      setBusy(false);
    }
  }

  async function removeImage() {
    await deleteImage(session.id, channel);
    await reloadImages();
    update((s) => {
      const { [channel]: _removed, ...rest } = s.observations;
      void _removed;
      return clearAi({ ...s, observations: rest }, channel);
    });
    toast('התמונה והתצפיות של ערוץ זה נמחקו');
  }

  function setManual(featureId: string, value: string) {
    update((s) => {
      const list = (s.observations[channel] ?? []).filter((o) => o.featureId !== featureId);
      const cur = valueOf(featureId);
      const next: Observation[] = cur?.value === value ? list : [...list, { featureId, value, source: 'manual' }];
      return refreshAgreement({ ...s, observations: { ...s.observations, [channel]: next } }, channel);
    });
  }

  /** סיבת החסימה למאפיין שסומן "לא ניתן לקבוע". הסימון עצמו נשאר ידני. */
  function setBlocked(featureId: string, reason: BlockReason) {
    update((s) => {
      const list = (s.observations[channel] ?? []).map((o) =>
        o.featureId === featureId ? { ...o, value: UNDETERMINED, source: 'manual' as const, model: undefined, confidence: undefined, blockedBy: reason } : o,
      );
      return refreshAgreement({ ...s, observations: { ...s.observations, [channel]: list } }, channel);
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
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setSample(sample ? null : demoSampleDataUrl(channel))} aria-expanded={!!sample}>
            {sample ? 'הסתרת הדוגמה' : `דוגמה סינתטית: ${def.short}`}
          </button>
          {sample && (
            <figure style={{ margin: '8px 0 0' }}>
              <img src={sample} alt={`דוגמה סינתטית שנוצרה בקוד לערוץ ${def.title}`} style={{ maxWidth: 180, borderRadius: 8, border: '1px solid var(--line)' }} />
              <figcaption className="tiny muted">ציור שנוצר בקוד, לא צילום של אדם. מראה מה מצלמים, לא איך "צריך" להיראות.</figcaption>
            </figure>
          )}
          {autoOn ? (
            <div className="notice warn small" style={{ marginTop: 12 }}>
              <strong>שליחה אוטומטית ל־Gemini פעילה.</strong> אחרי ההעלאה האפליקציה בודקת את איכות התמונה, ואם היא עברה, שולחת
              אוטומטית את העותק הנקי ל־Google Gemini API.
              {def.kind === 'palm' && !auto.paidTier && ' צילום כף יד לא יישלח בלי מפתח בפרויקט עם חיוב פעיל.'}
            </div>
          ) : (
            <div className="notice small" style={{ marginTop: 12 }}>
              האפליקציה שומרת ומנתחת את התמונה במכשיר בלבד, ולא שולחת אותה לשום שירות. בתחנת ה־AI (רשות, למטה) אתם מחליטים
              בעצמכם אם להעביר אותה למודל, ידנית או אוטומטית.
            </div>
          )}
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
          {!img && ' (יש להעלות תמונה כדי לסמן תצפיות.)'} אם מאפיין לא נראה, בחרו "{UNDETERMINED}" וסמנו מה חסם אותו.
        </p>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          שלושה דברים שונים: <strong>איכות התמונה</strong> נמדדת בקוד לכל התמונה (למעלה). <strong>סיבת החסימה</strong> היא דיווח
          למאפיין בודד, לא מדידה. <strong>ביטחון המודל</strong> הוא מה שהמודל דיווח על עצמו, והוא לא מכויל. אף אחד מהם אינו חוזק
          הראיות למסורת.
        </p>
        {retired.length > 0 && (
          <div className="notice small" style={{ marginBottom: 8 }}>
            בתהליך הזה שמורה תצפית ישנה על מאפיין שהוסר. היא נשארת במכשיר, אבל לא מוצגת ולא נכנסת לדוח.{' '}
            {RETIRED_FEATURES[retired[0].featureId]}
          </div>
        )}
        {def.features.map((f) => {
          const cur = valueOf(f.id);
          return (
            <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row spread small">
                <strong>{f.label}</strong>
                {f.computed && <span className="badge accent">חישוב אוטומטי</span>}
                {cur?.source === 'demo' && <span className="badge warn">ערך הדגמה</span>}
                {cur?.source === 'ai' && <span className="badge accent">מודל AI{cur.model ? ` · ${cur.model}` : ''}</span>}
                {cur?.source === 'ai' && cur.confidence && (
                  <span className="badge" title="דיווח עצמי של המודל, לא מכויל">ביטחון המודל: {cur.confidence}</span>
                )}
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
                <>
                  <div className="chips" style={{ marginTop: 6 }} role="radiogroup" aria-label={f.label} onKeyDown={radioKeys}>
                    {[...f.options, UNDETERMINED].map((o, i, all) => (
                      <button
                        key={o}
                        className={`chip ${cur?.value === o ? 'on' : ''} ${o === UNDETERMINED ? 'chip-undetermined' : ''}`}
                        role="radio"
                        aria-checked={cur?.value === o}
                        tabIndex={rovingIndex(i, all.indexOf(cur?.value ?? ''))}
                        disabled={!img}
                        onClick={() => setManual(f.id, o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  {cur?.value === UNDETERMINED && (
                    <div className="row small" style={{ marginTop: 6, gap: 6 }}>
                      <span className="muted" id={`why-${f.id}`}>
                        מה חסם?
                      </span>
                      <div className="chips" role="radiogroup" aria-labelledby={`why-${f.id}`} onKeyDown={radioKeys}>
                        {BLOCK_REASONS.map((r, i) => (
                          <button
                            key={r}
                            className={`chip ${cur.blockedBy === r ? 'on' : ''}`}
                            role="radio"
                            aria-checked={cur.blockedBy === r}
                            tabIndex={rovingIndex(i, BLOCK_REASONS.indexOf(cur.blockedBy ?? ('' as BlockReason)))}
                            onClick={() => setBlocked(f.id, r)}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <BackgroundQuestions
        channel={channel}
        background={session.background ?? {}}
        onChange={(key, value) =>
          update((s) => {
            const bg = { ...(s.background ?? {}) };
            if (value === undefined) delete bg[key];
            else (bg as Record<string, string>)[key] = value;
            return { ...s, background: bg };
          })
        }
      />

      <AiBridge key={img?.id ?? 'none'} session={session} channel={channel} img={img} update={update} toast={toast} />

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
