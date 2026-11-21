// בדיקות קבלה: node tests/acceptance.js  (דורש playwright)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = process.env.OUT_DIR || path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };

// ממלא את השאלה המוצגת: mode = 'right' | 'wrong' | {open:'טקסט'} ; wrongParts = אינדקסים של סעיפים שימולאו שגוי
async function fill(page, mode = 'right', wrongParts = null, openText = null) {
  await page.evaluate(([mode, wrongParts, openText]) => {
    const T = window.__sciTutor; const prog = T.db.progress;
    const sid = document.querySelector('.who b').textContent;
    const pk = Object.keys(prog).filter(k => k.startsWith(sid + '|'))[0]; const P = prog[pk];
    const list = T.QUESTIONS.filter(q => q.grade === P.grade); const q = list[P.idx]; const st = P.q[q.id] || { stage: 'main' };
    const item = st.stage === 'transfer' ? q.transfer : q;
    item.parts.forEach((p, i) => {
      const el = document.querySelector('.part[data-i="' + i + '"]'); const right = mode === 'right' && !(wrongParts && wrongParts.includes(i));
      const setSel = (s, v) => { s.value = v; };
      switch (p.type) {
        case 'mc': { const v = right ? p.answer : (p.answer + 1) % p.options.length; el.querySelector('input[value="' + v + '"]').checked = true; break; }
        case 'multi': { el.querySelectorAll('input').forEach(c => c.checked = right ? p.answers.includes(Number(c.value)) : !p.answers.includes(Number(c.value))); break; }
        case 'tf': p.items.forEach((it, k) => { const v = right ? it.a : !it.a; el.querySelector('input[name="p' + i + '_' + k + '"][value="' + (v ? 1 : 0) + '"]').checked = true; }); break;
        case 'match': el.querySelectorAll('select').forEach(s => { const it = p.items[Number(s.dataset.k)]; const opts = [...s.options].map(o => o.value).filter(Boolean); setSel(s, right ? it.a : opts.find(o => o !== it.a)); }); break;
        case 'order': el.querySelectorAll('select').forEach(s => { const k = Number(s.dataset.k); setSel(s, String(right ? k + 1 : ((k + 1) % p.items.length) + 1)); }); break;
        case 'chain': el.querySelectorAll('select').forEach(s => { const k = Number(s.dataset.k); setSel(s, right ? p.answer[k] : p.answer[(k + 1) % p.answer.length]); }); break;
        case 'grid': el.querySelectorAll('select').forEach(s => { const r = Number(s.dataset.r), c = Number(s.dataset.c); const a = p.rows[r].a[c]; setSel(s, right ? a : p.cols[c].options.find(o => o !== a)); }); break;
        case 'num': el.querySelector('input').value = right ? String(p.answer) : String(p.answer + 7); break;
        case 'fill': el.querySelector('input').value = right ? p.accept[0] : 'לא יודע'; break;
        case 'open': el.querySelector('textarea').value = openText != null ? openText : (right ? p.model : 'לא יודע'); break;
      }
    });
  }, [mode, wrongParts, openText]);
}
const click = (page, act) => page.click('[data-act="' + act + '"]');
async function login(page, id, grade) {
  await page.fill('#sid', id); await page.click('[data-grade="' + grade + '"]'); await page.fill('#sid', id); await click(page, 'start');
}
const rowsOf = (page, id) => page.evaluate(id => window.__sciTutor.db.attempts.filter(r => r.student_id === id), id);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);

  console.log('1. תלמיד שמצליח — כיתה ו׳, כל התשובות נכונות בניסיון הראשון');
  await login(page, 'ו1-01', 6);
  for (let i = 0; i < 12; i++) { await fill(page, 'right'); await click(page, 'check'); await click(page, 'next'); }
  let rows = await rowsOf(page, 'ו1-01');
  ok(await page.isVisible('text=סיימתם את כל 12 השאלות'), 'מסך סיום מוצג');
  ok(rows.length === 12, '12 ניסיונות נשמרו (' + rows.length + ')');
  ok(rows.every(r => r.mastery_level === 'independent' && r.hints_used === '0'), 'כל השאלות: שולט עצמאית, בלי רמזים');
  ok(rows.filter(r => r.teacher_review === 'yes').every(r => /open/.test(r.question_type)), 'רק שאלות פתוחות מסומנות לבדיקת מורה');
  await page.screenshot({ path: OUT + '/1-strong-done.png', fullPage: true });
  await click(page, 'logout');

  console.log('2. תלמיד מתקשה — כיתה ד׳, טועה בכל ניסיון, אבל מצליח בשאלת ההעברה בחצי מהשאלות');
  await login(page, 'ד2-07', 4);
  for (let i = 0; i < 16; i++) {
    for (let t = 0; t < 3; t++) { await fill(page, 'wrong'); await click(page, 'check'); }
    if (i === 0) await page.screenshot({ path: OUT + '/2-teach.png', fullPage: true });
    await click(page, 'toTransfer');
    if (i % 2 === 0) { await fill(page, 'right'); await click(page, 'check'); }
    else { await fill(page, 'wrong'); await click(page, 'check'); await fill(page, 'wrong'); await click(page, 'check'); }
    await click(page, 'next');
  }
  rows = await rowsOf(page, 'ד2-07');
  const finals = rows.filter(r => r.mastery_level);
  ok(finals.length === 16, '16 שאלות הסתיימו עם רמת שליטה');
  ok(finals.filter(r => r.mastery_level === 'after_teaching').length === 8, '8 — הבין לאחר הוראה');
  ok(finals.filter(r => r.mastery_level === 'needs_teacher').length === 8, '8 — זקוק לעזרת מורה');
  ok(rows.filter(r => r.is_transfer === 'yes').every(r => r.solution_revealed === 'yes'), 'בשאלות ההעברה מתועד שהפתרון המקורי הוצג');
  ok(rows.length === 16 * 3 + 8 * 1 + 8 * 2, 'נשמרה שורה לכל ניסיון (' + rows.length + ')');
  await click(page, 'logout');

  console.log('3. ששת המקרים (כיתה ד׳, תלמיד ד3-11)');
  await login(page, 'ד3-11', 4);
  // מקרה 1: נכונה מיד (d01)
  await fill(page, 'right'); await click(page, 'check');
  rows = await rowsOf(page, 'ד3-11'); ok(rows[0].correctness === 'correct' && rows[0].mastery_level === 'independent', 'מקרה 1 — נכונה מיד → שולט עצמאית');
  await click(page, 'next');
  // מקרה 3: שגויה עם רמז ואז נכונה (d02)
  await fill(page, 'wrong'); await click(page, 'check');
  ok(await page.isVisible('text=רמז 1'), 'מקרה 3 — אחרי טעות מוצג רמז, בלי פתרון');
  ok(!(await page.isVisible('text=התשובה הנכונה')), 'מקרה 3 — הפתרון לא נחשף אחרי טעות ראשונה');
  await fill(page, 'right'); await click(page, 'check');
  rows = await rowsOf(page, 'ד3-11'); ok(rows.at(-1).mastery_level === 'after_hint' && rows.at(-1).hints_used === '1', 'מקרה 3 — שולט לאחר רמז');
  await click(page, 'next');
  // d03: מקרה 2 (חלקית) ואז מקרה 4 (ניסוח חלופי נכון)
  await fill(page, 'right', null, 'הוא דוקרני'); await click(page, 'check');
  rows = await rowsOf(page, 'ד3-11'); ok(rows.at(-1).correctness === 'partial' && /effect/.test(rows.at(-1).criteria_missing), 'מקרה 2 — תשובה חלקית: מזוהה רכיב חסר (' + rows.at(-1).criteria_missing + ')');
  ok(await page.isVisible('text=כתבו גם מה קורה לשועל'), 'מקרה 2 — רמז ממוקד ברכיב החסר');
  await page.screenshot({ path: OUT + '/3-partial.png', fullPage: true });
  await fill(page, 'right', null, 'הקוצים שלו דוקרים את השועל ולכן השועל מתרחק ממנו'); await click(page, 'check');
  rows = await rowsOf(page, 'ד3-11'); ok(rows.at(-1).correctness === 'correct', 'מקרה 4 — ניסוח חלופי נכון מתקבל');
  await click(page, 'next');
  // d04: נכון; d05: מקרה 5 — תשובה פתוחה דו־משמעית
  await fill(page, 'right'); await click(page, 'check'); await click(page, 'next');
  await fill(page, 'right', null, 'אני חושב שהחיה הזאת מעניינת מאוד ויפה'); await click(page, 'check');
  rows = await rowsOf(page, 'ד3-11'); const amb = rows.at(-1);
  ok(amb.correctness === 'uncertain' && amb.teacher_review === 'yes' && amb.confidence === 'נמוכה', 'מקרה 5 — תשובה דו־משמעית → לא ודאי, ודאות נמוכה, לבדיקת מורה');
  ok(amb.answer_text.includes('אני חושב שהחיה הזאת מעניינת מאוד ויפה'), 'מקרה 5 — הטקסט המקורי של התלמיד נשמר כפי שנכתב');
  // מקרה 6: אחרי חשיפת פתרון
  for (let t = 0; t < 2; t++) { await fill(page, 'wrong'); await click(page, 'check'); }
  await click(page, 'toTransfer'); await fill(page, 'right'); await click(page, 'check');
  rows = await rowsOf(page, 'ד3-11'); ok(rows.at(-1).is_transfer === 'yes' && rows.at(-1).solution_revealed === 'yes' && rows.at(-1).mastery_level === 'after_teaching', 'מקרה 6 — תשובה אחרי חשיפת פתרון → שאלת העברה, הבין לאחר הוראה');
  // המשך אחרי טעינה מחדש
  await page.reload();
  ok(await page.isVisible('text=שאלה 6 מתוך 16') || await page.isVisible('text=שאלה 5 מתוך 16'), 'אחרי רענון הדף התלמיד ממשיך מהמקום שבו עצר');
  await click(page, 'logout');

  console.log('4. מסך מורה, ייצוא, מחיקה, ייבוא ותיקון ידני');
  await click(page, 'teacher'); await page.fill('#pin', '2468'); await click(page, 'pinGo');
  ok(await page.isVisible('text=סדר עדיפויות לעזרה'), 'סקירת כיתה מוצגת');
  await page.screenshot({ path: OUT + '/4-teacher-class.png', fullPage: true });
  await page.click('[data-tab="data"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), click(page, 'exportAll')]);
  const csvPath = OUT + '/export.csv'; await dl.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf8');
  ok(csv.charCodeAt(0) === 0xFEFF, 'CSV בקידוד UTF-8 עם BOM');
  const before = await page.evaluate(() => window.__sciTutor.db.attempts.length);
  ok(csv.split('\r\n').length - 1 === before, 'כל ' + before + ' הניסיונות יוצאו');
  page.on('dialog', d => d.accept());
  await page.click('[data-act="wipe"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__sciTutor.db.attempts.length) === 0, 'הנתונים נמחקו');
  await page.setInputFiles('#importFile', [csvPath, csvPath]);
  await page.waitForSelector('text=יובאו');
  ok(await page.evaluate(() => window.__sciTutor.db.attempts.length) === before, 'ייבוא מחדש החזיר את כל הניסיונות, בלי כפילויות (ייבוא כפול של אותו קובץ)');
  await page.click('[data-tab="open"]');
  const n = await page.locator('.review').count(); ok(n > 0, n + ' תשובות פתוחות ממתינות לבדיקה');
  const box = page.locator('.review').first();
  await box.locator('.ovC').selectOption('correct'); await box.locator('.ovM').selectOption('after_hint'); await box.locator('.ovN').fill('ניסוח סביר');
  await box.locator('[data-act="saveOv"]').click();
  ok(await page.locator('.review').count() === n - 1, 'אחרי החלטת מורה התשובה יורדת מהתור');
  await page.screenshot({ path: OUT + '/5-teacher-open.png', fullPage: true });
  await page.click('[data-tab="data"]');
  const [dl2] = await Promise.all([page.waitForEvent('download'), click(page, 'exportAll')]);
  await dl2.saveAs(OUT + '/export2.csv');
  ok(fs.readFileSync(OUT + '/export2.csv', 'utf8').includes('ניסוח סביר'), 'החלטת המורה וההערה נשמרות בקובץ המיוצא');
  await page.click('[data-tab="student"]'); await page.selectOption('#tStudent', 'ד2-07|4');
  ok(await page.isVisible('text=מיומנויות שטרם נרכשו'), 'דוח תלמיד מוצג');
  ok(await page.isVisible('text=המלצות הוראה') && await page.locator('text=/הוראה מחודשת/').count() > 0, 'דוח התלמיד כולל המלצות הוראה');
  await page.selectOption('#tGrade', '4'); await page.selectOption('#tTopic', 'מיון בעלי חיים');
  await page.click('[data-tab="map"]');
  const mapRows = await page.locator('table.data tbody tr').count();
  ok(mapRows === 6, 'סינון לפי נושא: 6 שאלות ב״מיון בעלי חיים״ (' + mapRows + ')');
  await page.click('[data-tab="class"]');
  ok(await page.locator('table.data td', { hasText: 'מאפייני חיים וצרכי קיום' }).count() === 0 && await page.locator('table.data td', { hasText: 'מיון בעלי חיים' }).count() > 0, 'סקירת הכיתה מציגה רק את הנושא המסונן');
  await page.selectOption('#tTopic', 'all'); await page.click('[data-tab="student"]'); await page.selectOption('#tStudent', 'ד2-07|4');
  await page.screenshot({ path: OUT + '/6-teacher-student.png', fullPage: true });

  console.log('5. מסך טלפון/Chromebook צר');
  const m = await browser.newPage({ viewport: { width: 375, height: 740 } }); await m.goto(URL);
  await m.fill('#sid', 'ה1-02'); await m.click('[data-grade="5"]'); await m.fill('#sid', 'ה1-02'); await m.click('[data-act="start"]');
  for (let i = 0; i < 8; i++) { await fill(m, 'right'); await m.click('[data-act="check"]'); await m.click('[data-act="next"]'); }
  const sw = await m.evaluate(() => document.documentElement.scrollWidth); ok(sw <= 375, 'אין גלילה אופקית ברוחב 375px (' + sw + ')');
  await m.screenshot({ path: OUT + '/7-mobile-chart.png', fullPage: true });

  console.log('6. מחוון: כל תשובה לדוגמה מתקבלת');
  const bank = await m.evaluate(() => { const T = window.__sciTutor; const bad = [];
    const right = p => ({mc:p.answer, multi:p.answers, tf:p.items&&p.items.map(i=>i.a), match:p.items&&p.items.map(i=>i.a), order:p.items&&p.items.map((x,k)=>String(k+1)), chain:p.answer, grid:p.rows&&p.rows.map(r=>r.a), num:String(p.answer), fill:p.model, open:p.model})[p.type];
    T.QUESTIONS.forEach(q => [q, q.transfer].forEach(it => { const g = T.gradeQuestion(it.parts, it.parts.map(right)); if (g.status !== 'correct') bad.push(it.id + ':' + g.status); }));
    const d05 = T.QUESTIONS.find(q => q.id === 'd05'); const same = 'כמה עלים אוכל חילזון ביום?';
    const dup = T.gradeQuestion(d05.parts, [d05.parts[0].model, 0, same, same, 'האם חילזון זוחל מהר אחרי גשם?']);
    return { bad, dup: dup.status, n: T.QUESTIONS.length * 2 }; });
  ok(bank.bad.length === 0, 'כל ' + bank.n + ' השאלות מקבלות את התשובה לדוגמה שלהן' + (bank.bad.length ? ': ' + bank.bad : ''));
  ok(bank.dup === 'partial', 'שאלה שנכתבה פעמיים אינה נספרת כשתי שאלות');

  console.log('7. מחוון: תשובות שגויות טיפוסיות לא מתקבלות, וניסוחים נכונים כן');
  const probes = [
    ['d03',1,'כדי לאכול את השועל','wrong'], ['d03',1,'הוא מתגונן בעזרת הקוצים','ok'], ['d03',1,'השועל לא יכול לתפוס אותו כי הוא דוקר','ok'],
    ['d11',2,'שניהם עפים','wrong'], ['d11',2,'שניהם מניקים את הגורים','ok'],
    ['d14',1,'יש להם ריאות','wrong'], ['d14',1,'מטילים ביצים','wrong'], ['d14',1,'יש להם פרווה','ok'],
    ['d15',1,'הדבורה יכולה להיות בשתי הקבוצות','ok'], ['d16',2,'לבנות עוד בתים','wrong'],
    ['h09',3,'קרקע חולית כי המים עוברים מהר','wrong'], ['h09',3,'חרסיתית כי המים נשארים בה','ok'],
    ['h10',3,'כן כי היא עשתה ניסוי','wrong'], ['h10',3,'לא, כי ניסוי אחד לא מספיק','ok'], ['h10',3,'צריך לחזור על הניסוי כמה פעמים','ok'],
    ['h11',1,'כי המים עוברים מהר בחרסית','wrong'], ['h11',1,'בחולית המים עוברים מהר ובחרסית לאט','ok'], ['h11',1,'הגרגרים קטנים וצפופים','ok'],
    ['v05',1,'לא נגמרים','partial'], ['v05',1,'לא נגמרים ולא מזהמים','ok'],
    ['v06',3,'כי זה כיף','wrong'], ['v06',3,'כדי לוודא שזה לא קרה במקרה','ok'],
    ['v12',4,'להתקין לוחות סולאריים על הגגות','ok'], ['v12',5,'בעיר א יש יותר מבעיר ב','ok'], ['v12',5,'התרשים יפה','wrong'] ];
  const pr = await m.evaluate(ps => ps.map(([id,i,t,exp]) => { const q = window.__sciTutor.QUESTIONS.find(x => x.id === id); const g = window.__sciTutor.gradePart(q.parts[i], t); return [id+'['+i+'] «'+t+'»', g.status, exp]; }), probes);
  const badP = pr.filter(x => x[1] !== x[2]);
  ok(badP.length === 0, pr.length + ' תשובות לדוגמה (נכונות ושגויות) סווגו כמצופה' + (badP.length ? ': ' + badP.map(x => x[0]+' → '+x[1]+' (ציפינו '+x[2]+')').join('; ') : ''));
  const misRec = await m.evaluate(() => { const q = window.__sciTutor.QUESTIONS.find(x => x.id === 'h11'); return window.__sciTutor.gradePart(q.parts[1], 'כי המים עוברים מהר בחרסית').mis[0] || ''; });
  ok(misRec.length > 0, 'טעות מושגית מתועדת לדוח המורה: ' + misRec);

  ok(errors.length === 0, 'אין שגיאות JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  // שמירה על חומרי המקור: מחרוזות ייחודיות מהמבחן המקורי אינן בקוד
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const leaks = ['אלמוגים', 'פרפרי הלילה', 'מפלי הניאגרה', 'פסל המפורסם', 'עפרת אבץ', 'בואש'].filter(s => html.includes(s));
  ok(leaks.length === 0, 'לא נמצאו בקוד ביטויים ייחודיים ממבחני המקור' + (leaks.length ? ': ' + leaks : ''));
  await browser.close();
  console.log(failures ? '\n' + failures + ' בדיקות נכשלו' : '\nכל הבדיקות עברו');
  process.exit(failures ? 1 : 0);
})();
