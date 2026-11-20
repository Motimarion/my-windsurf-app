// בדיקות קצה־לקצה: npm run build && npm run e2e
// מריץ vite preview, ומבצע תרחיש הדגמה, תרחיש משתמש אמיתי (עם העלאת קובץ), ובדיקות נייד.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const OUT = process.env.E2E_OUT || 'e2e/out';
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already stopped */ } };
await new Promise((res, rej) => {
  const t = setTimeout(() => (stopServer(), rej(new Error('preview timeout'))), 20000);
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && (clearTimeout(t), res()));
});

const browser = await chromium.launch();
try {
  // ---------- 1. תרחיש הדגמה (מחשב) ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', ''].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) external.push(u.hostname); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(BASE);
  check('html dir=rtl lang=he', (await page.getAttribute('html', 'dir')) === 'rtl' && (await page.getAttribute('html', 'lang')) === 'he');
  await page.screenshot({ path: `${OUT}/desktop-home.png` });

  await page.getByRole('button', { name: 'הדגמה עם נתונים סינתטיים' }).click();
  await page.waitForURL(/#\/s\/[a-z0-9]+$/);
  check('demo session created → hub', true, page.url());
  await page.getByText('נתוני הדגמה סינתטיים').waitFor();
  check('demo flagged as synthetic', true);
  await page.screenshot({ path: `${OUT}/desktop-hub.png`, fullPage: true });

  await page.getByRole('button', { name: 'יד ימין' }).first().click();
  await page.getByText('בדיקת איכות').waitFor();
  await page.locator('.analysis-list').first().waitFor();
  const qn = await page.locator('.analysis-list li').count();
  check('channel screen shows 4 quality checks', qn === 4, `found ${qn}`);
  await page.screenshot({ path: `${OUT}/desktop-channel-palm.png`, fullPage: true });

  await page.getByRole('button', { name: 'עץ', exact: true }).click();
  await page.getByText('גודל הציור ביחס לדף (מחושב)').waitFor();
  const treeSize = await page.locator('text=משטח הדף').first().textContent();
  check('tree drawing size computed', /% משטח הדף/.test(treeSize || ''), treeSize?.trim());

  await page.getByRole('button', { name: 'ניתוח', exact: true }).click();
  await page.getByRole('button', { name: 'לצפייה בדוח ←' }).waitFor({ timeout: 10000 });
  const qaText = await page.locator('.notice').first().textContent();
  check('analysis: zero QA failures', /0 כשלים/.test(qaText || ''), qaText?.trim());
  await page.screenshot({ path: `${OUT}/desktop-analyze.png`, fullPage: true });

  await page.getByRole('button', { name: 'לצפייה בדוח ←' }).click();
  await page.getByText('קוד Holland').waitFor();
  const code = (await page.locator('text=קוד Holland').locator('xpath=following-sibling::div[1]').textContent())?.trim();
  check('Holland code shown', /^[RIASEC]{3}$/.test(code || ''), code);
  check('traditions box labelled as not a finding', (await page.getByText('מה נטען במסורת — לא ממצא על האדם').count()) >= 4);
  check('evidence level badges present', (await page.locator('.badge.lvC, .badge.lvD').count()) > 3);
  check('no failed quality/QA badges in demo report', (await page.locator('.badge.fail').count()) === 0, String(await page.locator('.badge.fail').allTextContents()));
  // שלב השילוב: כל המקורות לפי נושאים
  check('integration stage shown in report', await page.getByText('התמונה המשולבת — כל המקורות לפי נושאים').isVisible());
  const synthSummary = (await page.locator('.card', { hasText: 'סיכום השילוב' }).textContent()) || '';
  check('integration summary compares traditions to questionnaire with chance baseline', /הושוו לשאלון/.test(synthSummary) && /בניחוש/.test(synthSummary), synthSummary.slice(0, 120));
  check('integration combines palm, handwriting and drawing claims', (await page.locator('.synth-entry').count()) >= 3);
  await page.locator('.section-title', { hasText: 'התמונה המשולבת' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/desktop-synthesis.png`, fullPage: false });
  await page.screenshot({ path: `${OUT}/desktop-report.png`, fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: 'הורדת PDF' }).click(),
  ]);
  const pdfPath = `${OUT}/report.pdf`;
  await download.saveAs(pdfPath);
  const { readFileSync } = await import('node:fs');
  const pdfBuf = readFileSync(pdfPath);
  const pages = (pdfBuf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('PDF downloaded', pdfBuf.slice(0, 5).toString() === '%PDF-' && pdfBuf.length > 50000, `${(pdfBuf.length / 1024).toFixed(0)}KB, ${pages} pages`);

  // ---------- 2. תרחיש משתמש אמיתי ----------
  await page.goto(BASE);
  await page.getByRole('button', { name: 'התחלת תהליך חדש' }).click();
  const startBtn = page.getByRole('button', { name: 'אני מסכים/ה — התחלה' });
  check('consent required before start', await startBtn.isDisabled());
  for (const cb of await page.locator('input[type=checkbox]').all()) await cb.check();
  await page.getByPlaceholder('למשל: משתתף 07').fill('משתתף בדיקה');
  await startBtn.click();
  await page.waitForURL(/#\/s\/[a-z0-9]+$/);
  const sid = page.url().split('/s/')[1];

  // יצירת "צילום כתב יד": צילום מסך של טקסט עברי על רקע לבן
  const imgPage = await ctx.newPage();
  await imgPage.setViewportSize({ width: 900, height: 1100 });
  await imgPage.setContent(`<body style="margin:0;background:#fff;direction:rtl;font:40px serif;padding:120px 80px;color:#123">
    ${['שלום לכולם וברוכים הבאים', 'זוהי דוגמת כתב לבדיקה', 'השורה השלישית כאן', 'ועוד שורה רביעית', 'וזו החמישית'].map((t) => `<p style="margin:0 0 70px">${t}</p>`).join('')}</body>`);
  const pngBuf = await imgPage.screenshot();
  await imgPage.close();

  await page.goto(`${BASE}#/s/${sid}/c/handwriting`);
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'hw.png', mimeType: 'image/png', buffer: pngBuf });
  await page.getByText('בדיקת איכות').waitFor();
  const lines = await page.locator('text=זוהו').textContent();
  check('handwriting upload → lines detected', /זוהו 5 שורות/.test(lines || ''), lines?.trim());
  await page.getByRole('radio', { name: 'גדול' }).click();
  check('manual observation selectable', (await page.getByRole('radio', { name: 'גדול' }).getAttribute('aria-checked')) === 'true');

  // החלפת תמונה מאפסת סימונים ידניים
  await page.locator('input[type=file]').first().setInputFiles({ name: 'hw2.png', mimeType: 'image/png', buffer: pngBuf });
  await page.getByText(/הסימונים הידניים.*אופסו/).waitFor();
  check('replacing image resets manual observations', (await page.getByRole('radio', { name: 'גדול' }).getAttribute('aria-checked')) === 'false');
  await page.getByRole('radio', { name: 'גדול' }).click();
  // ניווט מקלדת ברדיו: חץ שמאלה (ב־RTL = הבא)
  await page.getByRole('radio', { name: 'גדול' }).focus();
  await page.keyboard.press('ArrowRight');
  check('arrow keys move selection in radiogroup', (await page.getByRole('radio', { name: 'בינוני' }).first().getAttribute('aria-checked')) === 'true');
  await page.getByRole('radio', { name: 'גדול' }).click();

  // תחנת המנוע דרך גשר ידני: בקשה ← תשובה מודבקת ← שער רשימה סגורה ← השוואה לאדם ← אימוץ
  check('AI bridge: request hidden until separate consent', (await page.getByRole('button', { name: 'העתקת הבקשה' }).count()) === 0);
  await page.locator('input[type=checkbox]').check();
  const req = await page.getByLabel('הבקשה למודל: הנחיה סמויה ורשימת הערכים המותרים').inputValue();
  check('AI bridge: request = hidden prompt + closed list, no computed features', req.includes('תפקידך לתאר בלבד') && req.includes('hw.slant') && !req.includes('hw.lines'));
  await page.getByRole('radio', { name: 'ChatGPT' }).click();
  await page.getByLabel('התשובה של המודל').fill(
    'זה התיאור:\n```json\n{"observations":[{"featureId":"hw.size","value":"גדול"},{"featureId":"hw.slant","value":"זקופה"},{"featureId":"hw.spacing","value":"רחב מאוד"},{"featureId":"hw.lines","value":"4–8"}],"imageUsable":true}\n```\nהכתב מעיד על ביטחון עצמי.',
  );
  await page.getByRole('button', { name: 'בדיקה בשער הרשימה הסגורה' }).click();
  await page.getByText('התקבלו 2').waitFor();
  check('AI bridge: gate rejects out-of-list and computed values', await page.getByText('נדחו 2').isVisible());
  check('AI bridge: text outside JSON ignored', await page.getByText('השער התעלם ממנו').isVisible());
  check('AI bridge: agreement with human marking shown', await page.getByText('הסכמה עם הסימון שלכם: 1 מתוך 1').isVisible());
  await page.screenshot({ path: `${OUT}/desktop-ai-bridge.png`, fullPage: true });
  await page.getByRole('button', { name: 'אימוץ ערכי המודל לתצפיות' }).click();
  check('AI bridge: adopted values badged with model', await page.getByText('מודל AI · ChatGPT').first().isVisible());

  const stored = await page.evaluate(
    (id) =>
      new Promise((res) => {
        const r = indexedDB.open('insights-report-db');
        r.onsuccess = () => {
          const q = r.result.transaction('images').objectStore('images').index('sessionId').getAll(id);
          q.onsuccess = async () => {
            const rec = q.result[0];
            const head = new Uint8Array(await rec.blob.slice(0, 4096).arrayBuffer());
            const hasExif = Array.from(head).some((v, i) => v === 0x45 && head[i + 1] === 0x78 && head[i + 2] === 0x69 && head[i + 3] === 0x66);
            res({ count: q.result.length, mime: rec.blob.type, hasExif });
          };
        };
      }),
    sid,
  );
  check('stored image is re-encoded JPEG without EXIF, one per channel', stored.count === 1 && stored.mime === 'image/jpeg' && !stored.hasExif, JSON.stringify(stored));

  // קובץ לא חוקי
  await page.locator('input[type=file]').first().setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1') });
  check('invalid file type rejected', await page.getByRole('alert').isVisible());

  // שאלון: עונים על חצי, טוענים מחדש, ההתקדמות נשמרה
  await page.goto(`${BASE}#/s/${sid}/q/ipip`);
  for (const g of (await page.locator('.likert').all()).slice(0, 10)) await g.locator('button').nth(3).click();
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByText(/מתוך 20 נענו/).waitFor();
  const prog = await page.getByText(/מתוך 20 נענו/).textContent();
  check('questionnaire progress persisted across reload', /^10 מתוך 20/.test(prog.trim()), prog.trim());
  await page.screenshot({ path: `${OUT}/desktop-quest.png`, fullPage: true });
  for (const g of await page.locator('.likert').all()) await g.locator('button').nth(1).click();
  check('ipip page 2 completed', await page.getByText('20 מתוך 20 נענו').isVisible());

  await page.goto(`${BASE}#/s/${sid}/q/riasec`);
  for (let p = 0; p < 3; p++) {
    for (const [k, g] of (await page.locator('.likert').all()).entries()) await g.locator('button').nth((k + p) % 5).click();
    const nextBtn = page.getByRole('button', { name: 'הבא ←' });
    if (await nextBtn.count()) await nextBtn.click();
  }
  check('riasec completed', await page.getByText('30 מתוך 30 נענו').isVisible());
  await page.getByRole('button', { name: 'לניתוח ←' }).click();
  await page.getByRole('button', { name: 'לצפייה בדוח ←' }).waitFor({ timeout: 10000 });
  const qa2 = await page.locator('.notice').first().textContent();
  check('real flow with adopted AI values: zero QA failures', /0 כשלים/.test(qa2 || ''), qa2?.trim());
  await page.getByRole('button', { name: 'לצפייה בדוח ←' }).click();
  await page.getByText('משתתף בדיקה').first().waitFor();
  check('report marks AI values and the engine run', (await page.getByText('מודל AI (ChatGPT) · עבר בשער').count()) >= 1 && (await page.getByText(/תחנת המנוע: ChatGPT תיאר/).count()) === 1);
  check('real report has traditions for handwriting (channel + integration)', (await page.getByText('בגרפולוגיה נטען שכתב גדול').count()) === 2);
  check('real report not flagged as demo', (await page.getByText('נתונים סינתטיים').count()) === 0);

  // מחיקה
  await page.getByRole('button', { name: 'מחיקת התהליך' }).click();
  await page.getByRole('button', { name: 'מחיקה לצמיתות' }).click();
  await page.waitForURL(BASE + '#/');
  await page.getByText('תהליכים שמורים').waitFor();
  check('deleted session removed from list', (await page.getByText('משתתף בדיקה').count()) === 0);
  const leftovers = await page.evaluate(
    (id) =>
      new Promise((res) => {
        const r = indexedDB.open('insights-report-db');
        r.onsuccess = () => {
          const q = r.result.transaction('images').objectStore('images').index('sessionId').count(id);
          q.onsuccess = () => res(q.result);
        };
      }),
    sid,
  );
  check('images of deleted session removed from IndexedDB', leftovers === 0, `remaining=${leftovers}`);
  check('no JS errors (desktop)', errors.length === 0, errors.join(' | '));
  check('no requests to external hosts', external.length === 0, [...new Set(external)].join(', '));
  await ctx.close();

  // ---------- 3. נייד ----------
  for (const dev of ['iPhone 13', 'Pixel 7']) {
    const m = await browser.newContext({ ...devices[dev], locale: 'he-IL' });
    const mp = await m.newPage();
    const merr = [];
    mp.on('pageerror', (e) => merr.push(e.message));
    await mp.goto(BASE);
    const slug = dev.replace(/\s/g, '').toLowerCase();
    await mp.screenshot({ path: `${OUT}/${slug}-home.png`, fullPage: true });
    await mp.getByRole('button', { name: 'הדגמה עם נתונים סינתטיים' }).click();
    await mp.waitForURL(/#\/s\//);
    const id = mp.url().split('/s/')[1];
    const noHScroll = async () => mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const views = [['hub', ''], ['quest', '/q/ipip'], ['channel', '/c/handwriting'], ['analyze', '/analyze'], ['report', '/report']];
    for (const [name, path] of views) {
      await mp.goto(`${BASE}#/s/${id}${path}`);
      await mp.waitForTimeout(name === 'analyze' ? 2000 : 400);
      check(`${dev}: no horizontal scroll on ${name}`, await noHScroll());
      await mp.screenshot({ path: `${OUT}/${slug}-${name}.png`, fullPage: name !== 'report' });
    }
    const btn = await mp.locator('.likert button').first().boundingBox().catch(() => null);
    await mp.goto(`${BASE}#/s/${id}/q/ipip`);
    const b2 = await mp.locator('.likert button').first().boundingBox();
    check(`${dev}: likert tap target ≥ 44px tall`, b2 && b2.height >= 44, b2 ? `${b2.height}px` : String(btn));
    check(`${dev}: no JS errors`, merr.length === 0, merr.join(' | '));
    await m.close();
  }
} catch (e) {
  check('e2e run completed without exception', false, String(e?.stack || e));
} finally {
  await browser.close();
  stopServer();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
