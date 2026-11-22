// בדיקת השרת (apps-script/Code.gs) בלי Google: מדמים את שירותי Apps Script ואת ה־API של Anthropic
const fs = require('fs'), path = require('path'), vm = require('vm');
let failures = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures++; };
function load(props, apiReply) {
  const sent = []; const sheetRows = []; let head = [];
  const store = Object.assign({}, props); const cache = {};
  const sheet = {
    getLastRow: () => (head.length ? 1 : 0) + sheetRows.length, getLastColumn: () => head.length,
    getRange: (r, c, nr, nc) => ({ getValues: () => [head.slice()], setValues: v => { if (r === 1) { head = head.slice(0, c - 1).concat(v[0]); } else v.forEach(x => sheetRows.push(x)); } }),
    setFrozenRows() {}, setRightToLeft() {}
  };
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => store[k] == null ? null : store[k], setProperty: (k, v) => { store[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => '2026-11-22' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getName: () => 'מדעים ד׳', getSheetByName: () => (head.length ? sheet : null), insertSheet: () => sheet }) },
    UrlFetchApp: { fetch: (url, o) => { sent.push({ url, o, body: JSON.parse(o.payload) }); return { getResponseCode: () => apiReply.code || 200, getContentText: () => JSON.stringify(apiReply.body) }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => ({ text: t }) }) },
  };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../apps-script/Code.gs'), 'utf8'), ctx);
  const post = b => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(b) } }).text);
  return { post, sent, sheetRows, head: () => head };
}
const okReply = { body: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ parts: [{ index: 1, status: 'ok', met: ['spikes', 'effect'], misconception: '', hint: '', reason: 'מסביר נכון', confidence: 'high' }] }) }] } };
const gradeReq = { action: 'grade', key: 'k-123', student: 'ד1-01', grade: 4, topic: 'צורכי קיום', skill: 'קישור', context: 'קיפוד', parts: [{ index: 1, question: 'איך?', criteria: [{ id: 'spikes', desc: 'קוצים' }], need: 1, model: 'דוגמה', misconceptions: [], answer: 'הקוצים דוקרים את השועל' }] };

console.log('שרת Apps Script');
let s = load({ ANTHROPIC_API_KEY: 'sk-test', CLASS_KEY: 'k-123' }, okReply);
ok(s.post(Object.assign({}, gradeReq, { key: 'wrong' })).error === 'bad_key', 'קוד כיתה שגוי נדחה, ולא נשלחת בקשה ל־Claude');
ok(s.sent.length === 0, 'אין קריאה ל־API בלי קוד כיתה תקין');
let r = s.post(gradeReq);
ok(r.ok && r.parts[0].status === 'ok', 'בדיקה מחזירה את החלטת Claude');
const req = s.sent[0];
ok(req.url === 'https://api.anthropic.com/v1/messages' && req.o.headers['x-api-key'] === 'sk-test' && req.o.headers['anthropic-version'] === '2026-10-21', 'הבקשה ל־Anthropic: כתובת, מפתח וגרסת API נכונים');
ok(req.body.model === 'claude-haiku-5-5' && req.body.output_config.format.type === 'json_schema' && req.body.output_config.effort === 'low', 'מודל Claude Haiku 5.5, פלט JSON מובנה, effort נמוך');
ok(req.body.messages[0].content.includes('<<<\nהקוצים דוקרים את השועל\n>>>'), 'תשובת התלמיד נשלחת בתוך סימון מופרד');
ok(!JSON.stringify(req.body).includes('ד1-01'), 'קוד התלמיד אינו נשלח ל־Claude');
s = load({ ANTHROPIC_API_KEY: 'sk-test', CLASS_KEY: 'k-123' }, { body: { stop_reason: 'refusal', content: [] } });
ok(s.post(gradeReq).error === 'refusal', 'סירוב של Claude מוחזר כשגיאה (והאפליקציה חוזרת לבדיקה לפי מילים)');
s = load({ ANTHROPIC_API_KEY: 'sk-test', CLASS_KEY: 'k-123' }, { code: 529, body: {} });
ok(s.post(gradeReq).error === 'api_529', 'תקלה ב־API מוחזרת כשגיאה');
s = load({ CLASS_KEY: 'k-123' }, okReply);
ok(s.post(gradeReq).error === 'no_api_key' && s.post({ action: 'ping', key: 'k-123' }).hasApiKey === false, 'בלי מפתח API: הבדיקה לא רצה, ובדיקת החיבור מדווחת על כך');
s = load({ ANTHROPIC_API_KEY: 'sk-test', CLASS_KEY: 'k-123', DAILY_LIMIT: '3' }, okReply);
const res = [1, 2, 3, 4].map(() => s.post(gradeReq).error || 'ok');
ok(res.join(',') === 'ok,ok,ok,daily_limit', 'מגבלה יומית נאכפת (' + res.join(',') + ')');
s = load({ ANTHROPIC_API_KEY: 'sk-test', CLASS_KEY: 'k-123' }, okReply);
const many = Array.from({ length: 22 }, () => s.post(gradeReq).error || 'ok');
ok(many.filter(x => x === 'rate_limited').length === 2, 'מגבלה לתלמיד: 20 בדיקות בדקה');
s = load({ ANTHROPIC_API_KEY: 'sk-test', CLASS_KEY: 'k-123' }, okReply);
let lg = s.post({ action: 'log', key: 'k-123', columns: ['student_id', 'answer_text'], rows: [{ student_id: 'ד1-01', answer_text: 'תשובה א' }, { student_id: 'ד1-02', answer_text: 'תשובה ב' }] });
ok(lg.ok && lg.saved === 2 && s.head().join() === 'student_id,answer_text' && s.sheetRows[1][1] === 'תשובה ב', 'שמירה בגיליון: כותרות ושורות');
lg = s.post({ action: 'log', key: 'k-123', columns: ['student_id', 'answer_text', 'grader'], rows: [{ student_id: 'ד1-03', answer_text: 'ג', grader: 'ai-server' }] });
ok(s.head().join() === 'student_id,answer_text,grader' && s.sheetRows[2][2] === 'ai-server', 'עמודה חדשה נוספת לגיליון בלי לשבור את הקיימות');
console.log(failures ? failures + ' בדיקות נכשלו' : 'כל בדיקות השרת עברו'); process.exit(failures ? 1 : 0);
