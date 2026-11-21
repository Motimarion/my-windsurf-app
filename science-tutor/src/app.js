/* מורה אישי במדעים — מנוע התרגול, השמירה ומסך המורה.
 * הכול רץ בדפדפן, בלי שרת ובלי חיבור לרשת. הנתונים נשמרים ב־localStorage של המכשיר,
 * ומועברים בין מכשירים רק בייצוא/ייבוא של קובץ CSV.
 */
(function(){
'use strict';

const APP_VERSION = '1.0';
const RUBRIC_VERSION = 'prep-1.0';
const ASSESSMENT_TYPE = 'prep_practice';
const KEY = {attempts:'sciTutor.attempts.v1', progress:'sciTutor.progress.v1', overrides:'sciTutor.overrides.v1', pin:'sciTutor.pin.v1', session:'sciTutor.session.v1'};
const GRADE_NAMES = {4:'ד׳',5:'ה׳',6:'ו׳'};
const LEVELS = {independent:'שולט עצמאית', after_hint:'שולט לאחר רמז', after_teaching:'הבין לאחר הוראה', needs_teacher:'זקוק לעזרת מורה'};
const LEVEL_ORDER = ['independent','after_hint','after_teaching','needs_teacher'];
const LEVEL_COLORS = {independent:'#2e9e62', after_hint:'#9bbf3a', after_teaching:'#e3a72f', needs_teacher:'#d0524e'};
const CORRECTNESS = {correct:'נכון', partial:'חלקי', incorrect:'שגוי', uncertain:'לא ודאי'};
const LETTERS = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י'];
const COLUMNS = ['student_id','grade','question_id','base_question_id','attempt_id','timestamp','assessment_type','skill','topic','question_type','is_transfer','attempt_order','answer_text','selected_option','hints_used','hint_types','explain_requested','solution_revealed','rubric_id','rubric_version','criteria_met','criteria_missing','misconception','correctness','awarded_points','max_points','confidence','teacher_review','teacher_override','teacher_mastery','teacher_note','mastery_level','updated_at','app_version'];

const QBYID = {}; QUESTIONS.forEach(q=>{QBYID[q.id]=q;});
const byGrade = g => QUESTIONS.filter(q=>q.grade===g);

/* ---------- שמירה ---------- */
let storageOK = true; const mem = {};
try{ localStorage.setItem('__sciTutorTest','1'); localStorage.removeItem('__sciTutorTest'); }catch(e){ storageOK=false; }
function sget(k,def){ if(k in mem) return mem[k]; try{ const v=localStorage.getItem(k); mem[k] = v==null?def:JSON.parse(v); }catch(e){ storageOK=false; mem[k]=def; } return mem[k]; }
function sset(k,v){ mem[k]=v; try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ storageOK=false; } }
const db = {
  get attempts(){ return sget(KEY.attempts,[]); },
  get overrides(){ return sget(KEY.overrides,{}); },
  get progress(){ return sget(KEY.progress,{}); },
  saveAttempts(a){ sset(KEY.attempts,a); }, saveOverrides(o){ sset(KEY.overrides,o); }, saveProgress(p){ sset(KEY.progress,p); }
};

/* ---------- כלים ---------- */
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function strip(html){ const d=document.createElement('div'); d.innerHTML=html||''; return d.textContent.replace(/\s+/g,' ').trim(); }
function uid(){ return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function nowISO(){ return new Date().toISOString(); }
const FINALS = {'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'};
function normCore(s){ return String(s||'').replace(/[֑-ׇ]/g,'').replace(/[ךםןףץ]/g,c=>FINALS[c]).replace(/[״׳"'`]/g,'').replace(/[־\-–—]/g,' ').replace(/[^א-תa-zA-Z0-9?\s]/g,' ').toLowerCase(); }
function norm(s){ return normCore(s).replace(/\s+/g,' ').trim(); }
function kwMatch(text, kw){ const t=' '+norm(text)+' '; const k=normCore(kw).replace(/\s+/g,' ').replace(/^ /,''); return k.trim()!=='' && t.includes(k); }
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function rng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function shuffled(arr, seedStr){ const r=rng(hashStr(seedStr)); const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function download(name, text, type){ const blob=new Blob([text],{type:type||'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500); }
function today(){ return new Date().toISOString().slice(0,10); }

/* ---------- CSV ---------- */
function csvCell(v){ v = v==null?'':String(v); return '"'+v.replace(/"/g,'""')+'"'; }
function toCSV(rows){ const lines=[COLUMNS.join(',')]; rows.forEach(r=>lines.push(COLUMNS.map(c=>csvCell(r[c])).join(','))); return '﻿'+lines.join('\r\n'); }
function parseCSV(text){
  text = text.replace(/^﻿/,''); const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<text.length;i++){ const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; } else cell+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=''; }
    else cell+=c; }
  if(cell!==''||row.length){ row.push(cell); rows.push(row); }
  const head = (rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r=>r.length>1||r[0]).map(r=>{ const o={}; head.forEach((h,i)=>o[h]=r[i]==null?'':r[i]); return o; });
}
function exportRows(rows){ const ov=db.overrides; return rows.map(r=>{ const o=ov[r.attempt_id]; return o?Object.assign({},r,{teacher_override:o.teacher_override||'',teacher_mastery:o.teacher_mastery||'',teacher_note:o.teacher_note||'',updated_at:o.updated_at||r.updated_at}):r; }); }
function importRows(list){
  const all=db.attempts; const idx={}; all.forEach((r,i)=>idx[r.attempt_id]=i); const ov=db.overrides; let added=0, updated=0, skipped=0;
  list.forEach(r=>{
    if(!r.attempt_id||!r.student_id||!r.base_question_id){ skipped++; return; }
    const clean={}; COLUMNS.forEach(c=>clean[c]=r[c]==null?'':String(r[c]));
    if(clean.teacher_override||clean.teacher_mastery){ const cur=ov[clean.attempt_id]; if(!cur||String(cur.updated_at)<String(clean.updated_at)) ov[clean.attempt_id]={teacher_override:clean.teacher_override,teacher_mastery:clean.teacher_mastery,teacher_note:clean.teacher_note,updated_at:clean.updated_at}; }
    if(clean.attempt_id in idx){ const cur=all[idx[clean.attempt_id]]; if(String(cur.updated_at)<String(clean.updated_at)){ all[idx[clean.attempt_id]]=clean; updated++; } }
    else { idx[clean.attempt_id]=all.length; all.push(clean); added++; }
  });
  db.saveAttempts(all); db.saveOverrides(ov); return {added,updated,skipped};
}

/* ---------- בדיקת תשובות ---------- */
function partLabel(i,n){ return n>1 ? LETTERS[i] : ''; }
function gradePart(p, ans){
  const r={status:'wrong', met:[], missing:[], mis:[], hint:''};
  const empty = ans==null || ans==='' || (Array.isArray(ans)&&(ans.length===0||ans.some(x=>x==null||x===''||(Array.isArray(x)&&x.some(y=>!y)))));
  if(p.type!=='multi' && empty){ r.status='empty'; return r; }
  switch(p.type){
    case 'mc': if(ans===p.answer) r.status='ok'; else if(p.mis&&p.mis[ans]) r.mis.push(p.mis[ans]); break;
    case 'multi': { const a=(ans||[]).slice().sort().join(','), b=p.answers.slice().sort().join(','); if(!ans||!ans.length){ r.status='empty'; return r; } if(a===b) r.status='ok'; else if(p.mis) r.mis.push(p.mis); break; }
    case 'tf': { let all=true; p.items.forEach((it,i)=>{ if(ans[i]!==it.a){ all=false; if(it.mis) r.mis.push(it.mis);} }); if(all) r.status='ok'; break; }
    case 'match': { let all=true; p.items.forEach((it,i)=>{ if(ans[i]!==it.a) all=false; }); if(all) r.status='ok'; else if(p.mis) r.mis.push(p.mis); break; }
    case 'order': { let all=true; p.items.forEach((it,i)=>{ if(Number(ans[i])!==i+1) all=false; }); if(all) r.status='ok'; else if(p.mis) r.mis.push(p.mis); break; }
    case 'chain': { const all=p.answer.every((a,i)=>ans[i]===a); if(all) r.status='ok'; else if(p.mis) r.mis.push(p.mis); break; }
    case 'grid': { let all=true; p.rows.forEach((row,i)=>{ const bad=row.a.some((a,j)=>!ans[i]||ans[i][j]!==a); if(bad){ all=false; if(row.mis) r.mis.push(row.mis);} }); if(all) r.status='ok'; else if(!r.mis.length&&p.mis) r.mis.push(p.mis); break; }
    case 'num': { const v=parseFloat(String(ans).replace(',','.').replace(/[^\d.\-]/g,'')); if(!isNaN(v)&&Math.abs(v-p.answer)<1e-9) r.status='ok'; break; }
    case 'fill': { if(p.accept.some(k=>kwMatch(ans,k))) r.status='ok'; else if(p.open && norm(ans).length>=2) r.status='uncertain'; break; }
    case 'open': {
      p.criteria.forEach(c=>{ (c.any.some(k=>kwMatch(ans,k))?r.met:r.missing).push(c); });
      const need=p.need||p.criteria.length; const len=norm(ans).length;
      if(r.met.length>=need) r.status='ok';
      else if(r.met.length>0) r.status='partial';
      else if(len>=20) r.status='uncertain';
      // טעות מושגית מוכרת: כשאף רכיב לא הוכח והתשובה מכילה את הטעות — שגוי, עם תיעוד הטעות
      if(r.met.length===0 && p.contra){ const c=p.contra.find(c=>c.any.some(k=>kwMatch(ans,k))); if(c){ r.status='wrong'; r.mis.push(c.mis); r.hint=c.hint; } }
      if(r.status!=='ok' && !r.hint && r.missing[0]) r.hint=r.missing[0].hint||'';
      break; }
  }
  return r;
}
function gradeQuestion(parts, answers){
  const res = parts.map((p,i)=>gradePart(p,answers[i]));
  // שאלות פתוחות מרובות (״כתבו שלוש שאלות״): תשובה שחוזרת על תשובה קודמת אינה נחשבת תשובה נוספת
  const seen=[];
  parts.forEach((p,i)=>{ if(p.type!=='open') return; const t=norm(answers[i]); if(t && seen.includes(t) && res[i].status==='ok'){ res[i].status='partial'; res[i].hint='כתבתם את אותה תשובה פעמיים. נסו לכתוב תשובה אחרת.'; res[i].missing.push({id:'distinct', desc:'שונה מתשובה קודמת'}); } seen.push(t); });
  if(res.some(r=>r.status==='empty')) return {status:'empty', parts:res};
  const ok=res.filter(r=>r.status==='ok').length;
  let status;
  if(ok===res.length) status='correct';
  else if(res.every(r=>r.status==='ok'||r.status==='uncertain')) status='uncertain';
  else if(ok>0 || res.some(r=>r.status==='partial'||r.status==='uncertain')) status='partial';
  else status='incorrect';
  return {status, parts:res, okCount:ok};
}
function answerText(parts, answers){
  return parts.map((p,i)=>{ const a=answers[i]; const L=parts.length>1?LETTERS[i]+': ':''; let t='';
    switch(p.type){
      case 'mc': t = a==null?'':p.options[a]; break;
      case 'multi': t=(a||[]).map(k=>p.options[k]).join(', '); break;
      case 'tf': t=p.items.map((it,k)=>(k+1)+'. '+((a[k]===true)?(p.labels?p.labels[0]:'נכון'):(a[k]===false)?(p.labels?p.labels[1]:'לא נכון'):'—')).join('; '); break;
      case 'match': t=p.items.map((it,k)=>it.t+' → '+(a[k]||'—')).join('; '); break;
      case 'order': t=p.items.map((it,k)=>it+' = '+(a[k]||'—')).join('; '); break;
      case 'chain': t=(a||[]).map(x=>x||'—').join(' → '); break;
      case 'grid': t=p.rows.map((row,k)=>strip(row.t)+': '+((a[k]||[]).map(x=>x||'—').join(' / '))).join('; '); break;
      default: t = a==null?'':String(a);
    }
    return L+t; }).join(' | ');
}
function solutionHTML(parts){
  return parts.map((p,i)=>{ const L=parts.length>1?'<b>'+LETTERS[i]+'.</b> ':''; let t='';
    switch(p.type){
      case 'mc': t=p.options[p.answer]; break;
      case 'multi': t=p.answers.map(k=>p.options[k]).join(', '); break;
      case 'tf': t=p.items.map(it=>esc(it.t)+' — <b>'+(it.a?(p.labels?p.labels[0]:'נכון'):(p.labels?p.labels[1]:'לא נכון'))+'</b>').join('<br>'); break;
      case 'match': t=p.items.map(it=>esc(it.t)+' ← <b>'+esc(it.a)+'</b>').join('<br>'); break;
      case 'order': t=p.items.map((it,k)=>(k+1)+'. '+esc(it)).join('<br>'); break;
      case 'chain': t=p.answer.map(esc).join(' ← '); break;
      case 'grid': t=p.rows.map(row=>row.t+': <b>'+row.a.map(esc).join(' / ')+'</b>').join('<br>'); break;
      case 'num': t=p.answer+(p.unit?' '+p.unit:''); break;
      case 'fill': case 'open': t='לדוגמה: '+esc(p.model||''); break;
    }
    return '<div>'+L+t+'</div>'; }).join('');
}

/* ---------- מצב ---------- */
const S = { view:'login', student:null, grade:null, teacher:false, tTab:'class', tGrade:'all', tStudent:'', showAllOpen:false, feedback:null, rephraseShown:false, pendingExplain:0, hintsVisible:[] };
function pkey(){ return S.student+'|'+S.grade; }
function getProg(){ const p=db.progress; if(!p[pkey()]) p[pkey()]={student:S.student, grade:S.grade, idx:0, q:{}, started:nowISO()}; return p; }
function qstate(prog, qid){ const P=prog[pkey()]; if(!P.q[qid]) P.q[qid]={stage:'main', tries:0, hints:0, hintTypes:[], explainReq:0, revealed:false, tTries:0, tHints:0, done:false, mastery:'', review:false, hadUncertain:false}; return P.q[qid]; }
function currentQ(){ const P=db.progress[pkey()]; const list=byGrade(S.grade); return list[P.idx]||null; }

/* ---------- ציור גרף ---------- */
function chartSVG(c){
  const W=560,H=300, padL=50, padR=16, padT=36, padB=48; const n=c.values.length; const iw=W-padL-padR, ih=H-padT-padB;
  const bw=Math.min(70, iw/n*0.55); let s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(c.title)+'" xmlns="http://www.w3.org/2000/svg" direction="ltr">';
  s+='<text x="'+(W/2)+'" y="20" text-anchor="middle" font-size="17" font-weight="700" fill="#1d2a3a">'+esc(c.title)+'</text>';
  for(let v=0; v<=c.max; v+=c.step){ const y=padT+ih-(v/c.max)*ih; s+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y+'" y2="'+y+'" stroke="'+(v===0?'#5b6b7d':'#d6dee8')+'" stroke-width="'+(v===0?1.5:1)+'"/><text x="'+(padL-8)+'" y="'+(y+5)+'" text-anchor="end" font-size="13" fill="#5b6b7d">'+v+'</text>'; }
  s+='<text x="14" y="'+(padT+ih/2)+'" font-size="13" fill="#5b6b7d" transform="rotate(-90 14 '+(padT+ih/2)+')" text-anchor="middle">'+esc(c.unit)+'</text>';
  c.values.forEach((v,i)=>{ const cx=padL+iw*(i+0.5)/n; const h=(v/c.max)*ih; s+='<rect x="'+(cx-bw/2)+'" y="'+(padT+ih-h)+'" width="'+bw+'" height="'+h+'" fill="#1f6f8b" rx="3"/><text x="'+cx+'" y="'+(H-padB+20)+'" text-anchor="middle" font-size="14" fill="#1d2a3a">'+esc(c.labels[i])+'</text>'; });
  return s+'</svg>';
}
function tableHTML(t){ return '<div class="scroll"><table class="data"><thead><tr>'+t.head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'; }

/* ---------- ציור חלקי שאלה ---------- */
function renderPart(p, i, n, seed, prev){
  const name='p'+i; let h='<div class="part" data-i="'+i+'">'; if(p.q) h+='<div class="pq">'+p.q+'</div>';
  const pv = prev ? prev[i] : undefined;
  switch(p.type){
    case 'mc': { const order=shuffled(p.options.map((o,k)=>k), seed+name); order.forEach(k=>{ h+='<label class="opt'+(pv===k?' on':'')+'"><input type="radio" name="'+name+'" value="'+k+'"'+(pv===k?' checked':'')+'><span>'+p.options[k]+'</span></label>'; }); break; }
    case 'multi': { const order=shuffled(p.options.map((o,k)=>k), seed+name); h+='<div class="note">אפשר לסמן כמה תשובות.</div>'; order.forEach(k=>{ const on=pv&&pv.includes(k); h+='<label class="opt'+(on?' on':'')+'"><input type="checkbox" name="'+name+'" value="'+k+'"'+(on?' checked':'')+'><span>'+p.options[k]+'</span></label>'; }); break; }
    case 'tf': { const L=p.labels||['נכון','לא נכון']; p.items.forEach((it,k)=>{ const v=pv?pv[k]:undefined; h+='<div class="tfrow"><span>'+(k+1)+'. '+it.t+'</span><span class="seg">'+
        '<label class="'+(v===true?'on':'')+'"><input type="radio" name="'+name+'_'+k+'" value="1"'+(v===true?' checked':'')+'>'+L[0]+'</label>'+
        '<label class="'+(v===false?'on':'')+'"><input type="radio" name="'+name+'_'+k+'" value="0"'+(v===false?' checked':'')+'>'+L[1]+'</label></span></div>'; }); break; }
    case 'match': { const opts=shuffled(p.items.map(it=>it.a).concat(p.pool||[]).filter((v,k,a)=>a.indexOf(v)===k), seed+name); p.items.forEach((it,k)=>{ const v=pv?pv[k]:''; h+='<div class="tfrow"><span>'+it.t+'</span><select data-k="'+k+'" aria-label="בחירה"><option value="">— בחרו —</option>'+opts.map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select></div>'; }); break; }
    case 'order': { const disp=shuffled(p.items.map((it,k)=>k), seed+name); disp.forEach(k=>{ const v=pv?pv[k]:''; h+='<div class="tfrow"><span>'+esc(p.items[k])+'</span><select data-k="'+k+'" aria-label="מספר שלב"><option value="">—</option>'+p.items.map((x,m)=>'<option'+(String(m+1)===String(v)?' selected':'')+'>'+(m+1)+'</option>').join('')+'</select></div>'; }); break; }
    case 'chain': { const opts=shuffled(p.options, seed+name); h+='<div class="chain">'; p.answer.forEach((a,k)=>{ const v=pv?pv[k]:''; if(k) h+='<span class="arrow" aria-hidden="true">←</span>'; h+='<select data-k="'+k+'" aria-label="שלב '+(k+1)+'"><option value="">— שלב '+(k+1)+' —</option>'+opts.map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>'; }); h+='</div>'; break; }
    case 'grid': { h+='<div class="scroll"><table class="data"><thead><tr><th></th>'+p.cols.map(c=>'<th>'+esc(c.title)+'</th>').join('')+'</tr></thead><tbody>'; p.rows.forEach((row,r)=>{ h+='<tr><td>'+row.t+'</td>'+p.cols.map((c,ci)=>{ const v=pv&&pv[r]?pv[r][ci]:''; return '<td><select data-r="'+r+'" data-c="'+ci+'" aria-label="'+esc(c.title)+'"><option value="">—</option>'+c.options.map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select></td>'; }).join('')+'</tr>'; }); h+='</tbody></table></div>'; break; }
    case 'num': h+='<input type="text" inputmode="decimal" class="num" style="max-width:160px" value="'+esc(pv||'')+'" aria-label="מספר"> '+(p.unit?'<span>'+esc(p.unit)+'</span>':''); break;
    case 'fill': h+='<input type="text" class="txt" value="'+esc(pv||'')+'" aria-label="תשובה">'; break;
    case 'open': h+='<textarea class="txt" aria-label="תשובה פתוחה" placeholder="כתבו כאן במילים שלכם">'+esc(pv||'')+'</textarea>'; break;
  }
  return h+'<div class="mark" aria-live="polite"></div></div>';
}
function collect(parts, root){
  return parts.map((p,i)=>{ const el=$('.part[data-i="'+i+'"]',root); const name='p'+i;
    switch(p.type){
      case 'mc': { const c=$('input[name="'+name+'"]:checked',el); return c?Number(c.value):null; }
      case 'multi': return $$('input[name="'+name+'"]:checked',el).map(c=>Number(c.value));
      case 'tf': return p.items.map((it,k)=>{ const c=$('input[name="'+name+'_'+k+'"]:checked',el); return c?c.value==='1':null; });
      case 'match': case 'order': case 'chain': { const out=[]; $$('select',el).forEach(s=>out[Number(s.dataset.k)]=s.value); return out; }
      case 'grid': { const out=p.rows.map(()=>[]); $$('select',el).forEach(s=>out[Number(s.dataset.r)][Number(s.dataset.c)]=s.value); return out; }
      default: { const t=$('.txt,.num',el); return t?t.value:''; }
    }});
}

/* ---------- מסכים ---------- */
const app = ()=>$('#app');
function topbar(){
  let right='';
  if(S.view==='question'||S.view==='done') right='<span class="who">קוד: <b>'+esc(S.student)+'</b> · כיתה '+GRADE_NAMES[S.grade]+'</span> <button class="btn small ghost" data-act="saveMine">💾 שמירת קובץ התקדמות</button> <button class="btn small ghost" data-act="logout">יציאה</button>';
  else if(S.view==='teacher') right='<button class="btn small ghost" data-act="logout">יציאה ממסך המורה</button>';
  return '<header class="top"><h1>🔬 מורה אישי במדעים</h1><div class="row">'+right+'</div></header>'+
    (!storageOK?'<div class="wrap"><div class="banner warn">⚠️ השמירה במכשיר אינה פעילה (למשל בחלון גלישה בסתר). ההתקדמות לא תישמר אחרי סגירת הדף — לחצו ״שמירת קובץ התקדמות״ לפני היציאה.</div></div>':'');
}
function render(){
  if(S.view==='login') return renderLogin();
  if(S.view==='question') return renderQuestion();
  if(S.view==='done') return renderDone();
  if(S.view==='pin') return renderPin();
  if(S.view==='teacher') return renderTeacher();
}
function renderLogin(){
  app().innerHTML = topbar()+'<div class="wrap"><div class="card">'+
    '<h2 style="margin-top:0">שלום! 👋</h2><p>כאן מתרגלים מדעים, שאלה אחת בכל פעם. טעיתם? תקבלו רמז ותוכלו לנסות שוב.</p>'+
    '<label class="field" for="sid">הקוד האישי שלי</label><input type="text" id="sid" maxlength="20" autocomplete="off" placeholder="למשל: ו2-14" value="'+esc(S.student||'')+'">'+
    '<div class="note">כתבו את הקוד שקיבלתם מהמורה — <b>לא</b> את השם המלא.</div>'+
    '<label class="field">הכיתה שלי</label><div class="grades">'+[4,5,6].map(g=>'<button type="button" data-grade="'+g+'" class="'+(S.grade===g?'sel':'')+'">כיתה '+GRADE_NAMES[g]+'</button>').join('')+'</div>'+
    '<div id="loginErr" class="banner warn" style="display:none"></div>'+
    '<div class="actions"><button class="btn" data-act="start">מתחילים ←</button></div></div>'+
    '<p class="note" style="text-align:center"><button class="btn small ghost" data-act="teacher">מסך מורה</button></p></div>';
}
function startStudent(){
  const id=($('#sid').value||'').trim(); const err=$('#loginErr');
  const fail=m=>{ err.textContent=m; err.style.display='block'; };
  if(id.length<2) return fail('נא להקליד את הקוד האישי (לפחות 2 תווים).');
  if(/[א-תa-zA-Z]{2,}\s+[א-תa-zA-Z]{2,}/.test(id)) return fail('נראה שהקלדתם שם מלא. כדי לשמור על פרטיות, כתבו רק את הקוד שקיבלתם מהמורה.');
  if(!S.grade) return fail('בחרו כיתה.');
  S.student=id; const p=getProg(); db.saveProgress(p);
  try{ sessionStorage.setItem(KEY.session, JSON.stringify({student:S.student, grade:S.grade})); }catch(e){}
  goCurrent();
}
function goCurrent(){
  const P=db.progress[pkey()]; const list=byGrade(S.grade);
  while(P.idx<list.length && P.q[list[P.idx].id] && P.q[list[P.idx].id].done) P.idx++;
  S.feedback=null; S.rephraseShown=false; S.pendingExplain=0;
  S.view = P.idx>=list.length ? 'done' : 'question'; render(); window.scrollTo(0,0);
}
function renderQuestion(){
  const prog=db.progress; const P=prog[pkey()]; const list=byGrade(S.grade); const q=list[P.idx]; const st=qstate(prog,q.id);
  const isT = st.stage==='transfer'; const item = isT ? q.transfer : q; const parts=item.parts;
  const doneCount=list.filter(x=>P.q[x.id]&&P.q[x.id].done).length;
  const seed=S.student+'|'+item.id;
  let h=topbar()+'<div class="wrap"><div class="qmeta"><span>שאלה '+(P.idx+1)+' מתוך '+list.length+'</span><span class="chip">'+esc(q.topic)+'</span></div>'+
    '<div class="progress" aria-hidden="true"><div style="width:'+Math.round(doneCount/list.length*100)+'%"></div></div>';
  h+='<div class="card" id="qcard">';
  if(isT) h+='<div class="banner" style="background:var(--brand-soft);color:var(--brand)">🎯 שאלת תרגול חדשה — נסו ליישם את מה שלמדנו עכשיו.</div>';
  h+='<div class="prompt">'+item.prompt+'</div>';
  if(item.passage) h+='<div class="passage">'+item.passage+'</div>';
  if(item.table) h+=tableHTML(item.table);
  if(item.chart) h+=chartSVG(item.chart);
  h+='<form id="qform" onsubmit="return false">'+parts.map((p,i)=>renderPart(p,i,parts.length,seed,S.lastAnswers&&S.lastAnswers.id===item.id?S.lastAnswers.a:null)).join('')+'</form>';
  h+='<div id="fb">'+(S.feedback||'')+'</div>';
  if(S.rephraseShown) h+='<div class="feedback hint"><h3>💬 הסבר אחר לשאלה</h3>'+(isT?'קראו שוב לאט, וסמנו לעצמכם את המילים החשובות בשאלה. מה בדיוק שואלים?':q.rephrase)+'</div>';
  const finished = st.done; const awaiting = !isT && st.revealed && !st.done;
  if(awaiting && !S.feedback) S.feedback = teachBox(q);
  h+='<div class="actions">';
  if(!finished && !awaiting){
    h+='<button class="btn" data-act="check">בדיקה ✓</button>';
    const canHint = isT ? st.tHints<1 : st.hints<2;
    if(canHint) h+='<button class="btn ghost" data-act="hint">💡 רמז</button>';
    if(!S.rephraseShown) h+='<button class="btn ghost" data-act="rephrase">🔄 תסביר אחרת</button>';
  }
  if(awaiting) h+='<button class="btn" data-act="toTransfer">לשאלת התרגול החדשה ←</button>';
  if(finished) h+='<button class="btn" data-act="next">'+(P.idx+1<list.length?'לשאלה הבאה ←':'לסיכום ←')+'</button>';
  h+='</div></div></div>';
  app().innerHTML=h;
  if(S.partMarks) S.partMarks.forEach((m,i)=>{ const el=$('.part[data-i="'+i+'"]'); if(!el||!m) return; el.classList.add(m.cls); $('.mark',el).textContent=m.text; });
  $$('#qform .opt input, #qform .seg input').forEach(inp=>inp.addEventListener('change',()=>{ const nm=inp.name; $$('input[name="'+nm+'"]').forEach(o=>o.closest('label').classList.toggle('on',o.checked)); }));
  if(finished||awaiting) $$('#qform input, #qform select, #qform textarea').forEach(e=>e.disabled=true);
}
function teachBox(q){ return feedbackBox('teach','📘 בואו נלמד את זה יחד', '<p>'+q.explain+'</p><div class="note">התשובה הנכונה:</div>'+solutionHTML(q.parts)+'<p style="margin-top:8px">עכשיו ננסה שאלה חדשה ודומה, כדי לראות שהבנתם.</p>'); }
function feedbackBox(cls,title,body){ return '<div class="feedback '+cls+'" role="status"><h3>'+title+'</h3>'+body+'</div>'; }

function recordAttempt(q, item, isT, st, answers, g, finalMastery){
  const parts=item.parts; const all=db.attempts;
  const mis=[...new Set(g.parts.flatMap(r=>r.mis))].join('; ');
  const met=g.parts.flatMap(r=>r.met.map(c=>c.id+': '+c.desc)).join('; ');
  const missing=g.parts.flatMap(r=>r.missing.map(c=>c.id+': '+c.desc)).join('; ');
  const hasOpen=parts.some(p=>p.type==='open'||(p.type==='fill'&&p.open));
  const reviewAlways=parts.some(p=>p.review);
  let confidence='גבוהה';
  if(hasOpen) confidence = g.status==='correct' ? 'בינונית' : 'נמוכה';
  if(g.status==='uncertain') confidence='נמוכה';
  const review = (hasOpen && (reviewAlways || g.status!=='correct')) || g.status==='uncertain';
  if(review) st.review=true;
  const mc1 = parts.length===1 && parts[0].type==='mc' && answers[0]!=null ? parts[0].options[answers[0]] : '';
  const row={
    student_id:S.student, grade:String(S.grade), question_id:item.id, base_question_id:q.id, attempt_id:uid(), timestamp:nowISO(),
    assessment_type:ASSESSMENT_TYPE, skill:q.skill, topic:q.topic, question_type:parts.map(p=>p.type).join('+'), is_transfer:isT?'yes':'no',
    attempt_order:String(isT?st.tTries:st.tries), answer_text:answerText(parts,answers), selected_option:mc1,
    hints_used:String(isT?st.tHints:st.hints), hint_types:st.hintTypes.join('; '), explain_requested:String(S.pendingExplain||0),
    solution_revealed:st.revealed?'yes':'no', rubric_id:'R-'+item.id, rubric_version:RUBRIC_VERSION,
    criteria_met:met, criteria_missing:missing, misconception:mis, correctness:g.status,
    awarded_points: isT?'':String(Math.round(q.points*(g.okCount||0)/parts.length*10)/10), max_points: isT?'':String(q.points),
    confidence, teacher_review:review?'yes':'no', teacher_override:'', teacher_mastery:'', teacher_note:'', mastery_level:finalMastery||'', updated_at:nowISO(), app_version:APP_VERSION };
  all.push(row); db.saveAttempts(all); S.pendingExplain=0; return row;
}
function check(){
  const prog=db.progress; const P=prog[pkey()]; const q=currentQ(); const st=qstate(prog,q.id);
  const isT=st.stage==='transfer'; const item=isT?q.transfer:q; const answers=collect(item.parts, $('#qcard'));
  S.lastAnswers={id:item.id, a:answers};
  const g=gradeQuestion(item.parts, answers);
  if(g.status==='empty'){ S.partMarks=g.parts.map(r=>r.status==='empty'?{cls:'bad',text:'✎ חסרה תשובה בסעיף הזה'}:null); S.feedback=feedbackBox('hint','כמעט…','נא לענות על כל הסעיפים לפני הבדיקה.'); render(); return; }
  S.partMarks = item.parts.length>1 ? g.parts.map(r=>r.status==='ok'?{cls:'ok',text:'✓ נכון'}:{cls:'bad',text:r.status==='partial'||r.status==='uncertain'?'🟡 חלקי — אפשר להשלים':'✗ כדאי לבדוק שוב'}) : null;
  const firstMissHint = (g.parts.find(r=>r.hint)||{}).hint;
  if(!isT){
    st.tries++;
    if(g.status==='correct'){
      st.done=true; st.mastery=(st.tries===1&&st.hints===0)?'independent':'after_hint';
      recordAttempt(q,item,false,st,answers,g,st.mastery);
      S.feedback=feedbackBox('ok', st.mastery==='independent'?'🌟 מצוין! נכון כבר בפעם הראשונה.':'👏 כל הכבוד! הצלחתם.', q.explain + (st.review?'<div class="note" style="margin-top:6px">התשובה שלכם נשמרה, והמורה תעבור עליה.</div>':''));
    } else if(st.tries<3){
      const hi=Math.max(st.hints, st.tries); const newHint = q.hints[Math.min(hi,2)-1];
      if(st.hints<st.tries){ st.hints=st.tries; st.hintTypes.push('auto_'+st.tries); }
      recordAttempt(q,item,false,st,answers,g,'');
      const title = g.status==='partial'||g.status==='uncertain' ? '🟡 חלק מהתשובה בכיוון הנכון' : '💡 עוד לא — אבל אפשר להצליח!';
      S.feedback=feedbackBox('hint', title, (firstMissHint?'<p>'+firstMissHint+'</p>':'')+'<p><b>רמז '+st.tries+':</b> '+newHint+'</p>נסו שוב.');
    } else {
      st.revealed=true; recordAttempt(q,item,false,st,answers,g,'');
      S.partMarks=null; S.feedback=teachBox(q);
    }
  } else {
    st.tTries++;
    if(g.status==='correct'){
      st.done=true; st.mastery='after_teaching'; recordAttempt(q,item,true,st,answers,g,st.mastery);
      S.feedback=feedbackBox('ok','🎉 יפה מאוד! יישמתם את מה שלמדנו.', item.explain);
    } else if(st.tTries<2){
      if(st.tHints<1){ st.tHints=1; st.hintTypes.push('transfer_auto'); }
      recordAttempt(q,item,true,st,answers,g,'');
      S.feedback=feedbackBox('hint','💡 עוד ניסיון אחד', (firstMissHint?'<p>'+firstMissHint+'</p>':'')+'<p><b>רמז:</b> '+item.hint+'</p>');
    } else {
      st.done=true; st.mastery='needs_teacher'; st.review=true; recordAttempt(q,item,true,st,answers,g,st.mastery);
      S.partMarks=null;
      S.feedback=feedbackBox('teach','📘 זה נושא שנעבור עליו יחד עם המורה', '<p>'+item.explain+'</p><div class="note">התשובה הנכונה:</div>'+solutionHTML(item.parts)+'<p style="margin-top:8px">זה בסדר גמור — לפעמים צריך עוד הסבר. המורה תראה שכדאי לעבור על זה איתכם.</p>');
    }
  }
  db.saveProgress(prog); render();
  const fb=$('#fb'); if(fb && fb.scrollIntoView) fb.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function hint(){
  const prog=db.progress; const q=currentQ(); const st=qstate(prog,q.id); const isT=st.stage==='transfer';
  let text;
  if(isT){ if(st.tHints>=1) return; st.tHints=1; st.hintTypes.push('transfer_requested'); text=q.transfer.hint; }
  else { if(st.hints>=2) return; st.hints++; st.hintTypes.push('requested_'+st.hints); text=q.hints[st.hints-1]; }
  db.saveProgress(prog);
  S.lastAnswers={id:(isT?q.transfer:q).id, a:collect((isT?q.transfer:q).parts,$('#qcard'))};
  S.feedback=feedbackBox('hint','💡 רמז'+(isT?'':' '+st.hints), text); render();
}
function rephrase(){ const q=currentQ(); const isT=qstate(db.progress,q.id).stage==='transfer'; S.lastAnswers={id:(isT?q.transfer:q).id,a:collect((isT?q.transfer:q).parts,$('#qcard'))}; S.rephraseShown=true; S.pendingExplain=(S.pendingExplain||0)+1; render(); }
function toTransfer(){ const prog=db.progress; const q=currentQ(); const st=qstate(prog,q.id); st.stage='transfer'; db.saveProgress(prog); S.feedback=null; S.partMarks=null; S.rephraseShown=false; S.lastAnswers=null; render(); window.scrollTo(0,0); }
function next(){ const prog=db.progress; prog[pkey()].idx++; db.saveProgress(prog); S.partMarks=null; S.lastAnswers=null; goCurrent(); }

function renderDone(){
  const P=db.progress[pkey()]; const list=byGrade(S.grade); const cnt={independent:0,after_hint:0,after_teaching:0,needs_teacher:0};
  list.forEach(q=>{ const st=P.q[q.id]; if(st&&st.mastery) cnt[st.mastery]++; });
  app().innerHTML=topbar()+'<div class="wrap"><div class="card" style="text-align:center"><div class="done-emoji">🏆</div><h2>סיימתם את כל '+list.length+' השאלות!</h2>'+
    '<div class="stat" style="text-align:right">'+
    '<div class="box"><div class="num">'+cnt.independent+'</div>פתרתם לבד בפעם הראשונה</div>'+
    '<div class="box"><div class="num">'+cnt.after_hint+'</div>הצלחתם אחרי רמז</div>'+
    '<div class="box"><div class="num">'+cnt.after_teaching+'</div>הבנתם אחרי הסבר</div>'+
    '<div class="box"><div class="num">'+cnt.needs_teacher+'</div>נעבור עליהן יחד עם המורה</div></div>'+
    '<p>כל הניסיונות שלכם נשמרו במכשיר. אם המורה ביקשה — שמרו גם קובץ התקדמות ושלחו לה.</p>'+
    '<div class="actions" style="justify-content:center"><button class="btn" data-act="saveMine">💾 שמירת קובץ התקדמות</button><button class="btn ghost" data-act="logout">סיום</button></div></div></div>';
}
function saveMine(){ const rows=exportRows(db.attempts.filter(r=>r.student_id===S.student && r.grade===String(S.grade))); download('progress_'+S.student.replace(/[^\wא-ת-]/g,'_')+'_grade'+S.grade+'_'+today()+'.csv', toCSV(rows)); }

/* ---------- מסך מורה ---------- */
function renderPin(){
  const has=!!sget(KEY.pin,null);
  app().innerHTML=topbar()+'<div class="wrap"><div class="card"><h2 style="margin-top:0">כניסה למסך המורה</h2>'+
    (has?'<label class="field" for="pin">קוד מורה</label>':'<p>זו הכניסה הראשונה במכשיר הזה. בחרו קוד מורה (לפחות 4 תווים).</p><label class="field" for="pin">קוד מורה חדש</label>')+
    '<input type="password" id="pin" autocomplete="off" style="max-width:240px">'+
    '<div class="note">הקוד מונע כניסה מקרית של תלמידים. זו אינה אבטחה מלאה: הנתונים שמורים בדפדפן של המכשיר.</div>'+
    '<div id="pinErr" class="banner warn" style="display:none"></div>'+
    '<div class="actions"><button class="btn" data-act="pinGo">כניסה</button><button class="btn ghost" data-act="logout">חזרה</button></div></div></div>';
  setTimeout(()=>{ const p=$('#pin'); if(p){ p.focus(); p.addEventListener('keydown',e=>{ if(e.key==='Enter') pinGo(); }); } },0);
}
function pinGo(){
  const v=$('#pin').value; const cur=sget(KEY.pin,null); const err=$('#pinErr');
  if(!cur){ if(v.length<4){ err.textContent='הקוד צריך להיות באורך 4 תווים לפחות.'; err.style.display='block'; return; } sset(KEY.pin, String(hashStr('sci|'+v))); }
  else if(String(hashStr('sci|'+v))!==cur){ err.textContent='קוד שגוי.'; err.style.display='block'; return; }
  S.teacher=true; S.view='teacher'; render();
}
function effective(rows){
  // לכל תלמיד+שאלה: רמת השליטה הסופית (כולל החלטת מורה), ניסיונות, רמזים
  const ov=db.overrides; const map={};
  rows.slice().sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))).forEach(r=>{
    const k=r.student_id+'|'+r.grade+'|'+r.base_question_id; const m=map[k]||(map[k]={student:r.student_id, grade:r.grade, qid:r.base_question_id, rows:[], level:'', auto:'', review:false, override:null, revealed:false, mis:new Set()});
    m.rows.push(r); if(r.mastery_level){ m.level=r.mastery_level; m.auto=r.mastery_level; }
    if(r.teacher_review==='yes') m.review=true;
    if(r.solution_revealed==='yes') m.revealed=true;
    (r.misconception||'').split(';').map(s=>s.trim()).filter(Boolean).forEach(s=>m.mis.add(s));
    const o=ov[r.attempt_id]; if(o&&(o.teacher_mastery||o.teacher_override)&&(!m.override||String(o.updated_at)>String(m.override.updated_at))) m.override=Object.assign({attempt_id:r.attempt_id},o);
  });
  Object.values(map).forEach(m=>{ if(m.override&&m.override.teacher_mastery) m.level=m.override.teacher_mastery; m.pending = m.review && !m.override; });
  return map;
}
function teacherRows(){ const g=S.tGrade; return db.attempts.filter(r=>g==='all'||r.grade===String(g)); }
function lvlBadge(l){ return l?'<span class="lvl '+l+'">'+LEVELS[l]+'</span>':'<span class="lvl none">טרם הושלם</span>'; }
function stackBar(c,total){ if(!total) return '<span class="muted small">אין נתונים</span>'; return '<div class="stack" title="'+LEVEL_ORDER.map(l=>LEVELS[l]+': '+c[l]).join(' · ')+'">'+LEVEL_ORDER.map(l=>'<span style="width:'+(c[l]/total*100)+'%;background:'+LEVEL_COLORS[l]+'"></span>').join('')+'</div>'; }
function legend(){ return '<div class="legend">'+LEVEL_ORDER.map(l=>'<span><i style="background:'+LEVEL_COLORS[l]+'"></i>'+LEVELS[l]+'</span>').join('')+'</div>'; }
function pct(a,b){ return b?Math.round(a/b*100)+'%':'—'; }

function renderTeacher(){
  const tabs=[['class','סקירת כיתה'],['student','דוח תלמיד'],['open','תשובות פתוחות לבדיקה'],['map','טבלת קישור ומיומנויות'],['data','ייבוא, ייצוא והגדרות']];
  let h=topbar()+'<div class="wrap"><div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">מסך מורה</h2>'+
    '<label>שכבה: <select id="tGrade"><option value="all">כל השכבות</option>'+[4,5,6].map(g=>'<option value="'+g+'"'+(String(S.tGrade)===String(g)?' selected':'')+'>כיתה '+GRADE_NAMES[g]+'</option>').join('')+'</select></label></div>'+
    '<div class="tabs">'+tabs.map(t=>'<button data-tab="'+t[0]+'" class="'+(S.tTab===t[0]?'on':'')+'">'+t[1]+'</button>').join('')+'</div>'+
    '<div class="note">הסיווג כאן הוא סיווג להוראה בתרגול ההכנה — לא ציון מיפוי ולא ציון רשמי. ניקוד ההכנה אינו זהה לניקוד המחוזי.</div></div>';
  const rows=teacherRows();
  if(S.tTab==='class') h+=teacherClass(rows);
  if(S.tTab==='student') h+=teacherStudent(rows);
  if(S.tTab==='open') h+=teacherOpen(rows);
  if(S.tTab==='map') h+=teacherMap();
  if(S.tTab==='data') h+=teacherData();
  app().innerHTML=h+'</div>';
}
function teacherClass(rows){
  if(!rows.length) return '<div class="card">עדיין אין נתונים. תלמידים שעובדים על המכשיר הזה יופיעו כאן אוטומטית. מנתונים ממכשירים אחרים — ייבאו קובצי CSV בלשונית ״ייבוא, ייצוא והגדרות״.</div>';
  const eff=Object.values(effective(rows)); const students=[...new Set(rows.map(r=>r.student_id+'|'+r.grade))];
  const done=eff.filter(m=>m.level); const pending=eff.filter(m=>m.pending).length;
  const totalQs = students.reduce((s,k)=>s+byGrade(Number(k.split('|')[1])).length,0);
  let h='<div class="card"><div class="stat">'+
    '<div class="box"><div class="num">'+students.length+'</div>תלמידים</div>'+
    '<div class="box"><div class="num">'+pct(done.length,totalQs)+'</div>שיעור השלמה</div>'+
    '<div class="box"><div class="num">'+pct(done.filter(m=>m.level==='independent'||m.level==='after_hint').length,done.length)+'</div>הצלחה לפני הסבר</div>'+
    '<div class="box"><div class="num">'+pct(done.filter(m=>m.level==='after_teaching').length,done.length)+'</div>הצליחו רק אחרי הסבר</div>'+
    '<div class="box"><div class="num">'+pending+'</div>ממתינות לבדיקת מורה</div></div></div>';
  // סדר עדיפויות לפי נושא
  const topics={}; done.forEach(m=>{ const q=QBYID[m.qid]; if(!q) return; const t=topics[q.grade+'|'+q.topic]||(topics[q.grade+'|'+q.topic]={grade:q.grade,topic:q.topic,c:{independent:0,after_hint:0,after_teaching:0,needs_teacher:0},n:0,need:new Set(),teach:new Set()}); t.c[m.level]++; t.n++; if(m.level==='needs_teacher') t.need.add(m.student); if(m.level==='after_teaching') t.teach.add(m.student); });
  const tl=Object.values(topics).map(t=>Object.assign(t,{score:(t.c.needs_teacher*2+t.c.after_teaching)/t.n})).sort((a,b)=>b.score-a.score);
  h+='<div class="card"><h3 style="margin-top:0">🎯 סדר עדיפויות לעזרה — לפי נושא</h3>'+legend()+'<div class="scroll"><table class="data"><thead><tr><th>שכבה</th><th>נושא</th><th>התפלגות</th><th>לבד</th><th>אחרי רמז</th><th>אחרי הסבר</th><th>זקוקים לעזרה</th><th>קבוצה קטנה להתערבות</th></tr></thead><tbody>'+
    tl.map(t=>'<tr><td>'+GRADE_NAMES[t.grade]+'</td><td>'+esc(t.topic)+'</td><td>'+stackBar(t.c,t.n)+'</td><td>'+pct(t.c.independent,t.n)+'</td><td>'+pct(t.c.after_hint,t.n)+'</td><td>'+pct(t.c.after_teaching,t.n)+'</td><td>'+pct(t.c.needs_teacher,t.n)+'</td><td class="small">'+([...t.need].map(esc).join(', ')||'—')+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="note">הדירוג מחושב כך: (זקוקים לעזרה × 2 + הצליחו רק אחרי הסבר) ÷ מספר התוצאות בנושא.</p></div>';
  // לפי שאלה
  const qs={}; done.forEach(m=>{ const s=qs[m.qid]||(qs[m.qid]={c:{independent:0,after_hint:0,after_teaching:0,needs_teacher:0},n:0,mis:{}}); s.c[m.level]++; s.n++; m.mis.forEach(x=>{ s.mis[x]=(s.mis[x]||new Set()).add(m.student); }); });
  h+='<div class="card"><h3 style="margin-top:0">הצלחה לפי מיומנות ושאלה</h3><div class="scroll"><table class="data"><thead><tr><th>שאלה</th><th>מיומנות</th><th>התפלגות</th><th>לבד</th><th>זקוקים לעזרה</th><th>טעות נפוצה</th></tr></thead><tbody>'+
    QUESTIONS.filter(q=>qs[q.id]).map(q=>{ const s=qs[q.id]; const top=Object.entries(s.mis).sort((a,b)=>b[1].size-a[1].size)[0]; return '<tr><td>'+q.id+'</td><td class="small">'+esc(q.skill)+'</td><td>'+stackBar(s.c,s.n)+'</td><td>'+pct(s.c.independent,s.n)+'</td><td>'+pct(s.c.needs_teacher,s.n)+'</td><td class="small">'+(top?esc(top[0])+' ('+top[1].size+')':'—')+'</td></tr>'; }).join('')+'</tbody></table></div></div>';
  // טעויות חוזרות
  const misAll={}; eff.forEach(m=>m.mis.forEach(x=>{ (misAll[x]=misAll[x]||new Set()).add(m.student); }));
  const rec=Object.entries(misAll).filter(e=>e[1].size>=2).sort((a,b)=>b[1].size-a[1].size);
  h+='<div class="card"><h3 style="margin-top:0">🔁 טעויות מושגיות שחוזרות אצל כמה תלמידים</h3>'+(rec.length?'<ul>'+rec.map(e=>'<li><b>'+esc(e[0])+'</b> — '+e[1].size+' תלמידים: <span class="small">'+[...e[1]].map(esc).join(', ')+'</span></li>').join('')+'</ul>':'<p class="muted">עדיין אין טעות שחוזרת אצל שני תלמידים או יותר.</p>')+'</div>';
  return h;
}
function teacherStudent(rows){
  const students=[...new Set(rows.map(r=>r.student_id+'|'+r.grade))].sort();
  if(!students.length) return '<div class="card">אין עדיין נתוני תלמידים.</div>';
  if(!students.includes(S.tStudent)) S.tStudent=students[0];
  const [sid,gr]=S.tStudent.split('|'); const eff=effective(rows.filter(r=>r.student_id===sid&&r.grade===gr)); const list=byGrade(Number(gr));
  const done=list.filter(q=>eff[sid+'|'+gr+'|'+q.id]&&eff[sid+'|'+gr+'|'+q.id].level);
  const by=l=>list.filter(q=>{ const m=eff[sid+'|'+gr+'|'+q.id]; return m&&m.level===l; });
  let h='<div class="card"><label>תלמיד: <select id="tStudent">'+students.map(s=>{ const [a,b]=s.split('|'); return '<option value="'+esc(s)+'"'+(s===S.tStudent?' selected':'')+'>'+esc(a)+' (כיתה '+GRADE_NAMES[b]+')</option>'; }).join('')+'</select></label> '+
    '<button class="btn small ghost" data-act="printStudent">🖨️ הדפסה</button>';
  h+='<p>הושלמו <b>'+done.length+'</b> מתוך '+list.length+' שאלות ('+pct(done.length,list.length)+').</p>';
  if(done.length<Math.max(4,Math.ceil(list.length/4))) h+='<div class="banner warn">אין מספיק מידע כדי להסיק על שליטה כללית — התלמיד השלים מעט שאלות.</div>';
  const sec=(title,l)=>{ const qs=by(l); return '<h4 style="margin-bottom:4px">'+lvlBadge(l)+' '+title+' ('+qs.length+')</h4>'+(qs.length?'<ul class="small">'+qs.map(q=>'<li>'+esc(q.skill)+'</li>').join('')+'</ul>':'<p class="muted small">—</p>'); };
  h+=sec('פתר לבד','independent')+sec('הצריך רמז','after_hint')+sec('הצליח ביישום אחרי הסבר','after_teaching')+sec('מיומנויות שטרם נרכשו','needs_teacher');
  h+='</div><div class="card"><h3 style="margin-top:0">פירוט לפי שאלה</h3><div class="scroll"><table class="data"><thead><tr><th>שאלה</th><th>מיומנות</th><th>רמה</th><th>ניסיונות</th><th>רמזים</th><th>הוצג פתרון</th><th>בדיקת מורה</th><th>תשובה אחרונה</th></tr></thead><tbody>'+
    list.map(q=>{ const m=eff[sid+'|'+gr+'|'+q.id]; if(!m) return '<tr><td>'+q.id+'</td><td class="small">'+esc(q.skill)+'</td><td>'+lvlBadge('')+'</td><td colspan="5" class="muted small">לא נוסתה</td></tr>';
      const last=m.rows[m.rows.length-1]; const maxH=Math.max(...m.rows.filter(r=>r.is_transfer!=='yes').map(r=>Number(r.hints_used||0)),0);
      return '<tr><td>'+q.id+'</td><td class="small">'+esc(q.skill)+'</td><td>'+lvlBadge(m.level)+(m.override?' <span class="small">(מורה)</span>':'')+'</td><td>'+m.rows.length+'</td><td>'+maxH+'</td><td>'+(m.revealed?'כן':'לא')+'</td><td>'+(m.pending?'⏳ ממתין':m.review?'✓ נבדק':'—')+'</td><td class="small">'+esc(last.answer_text).slice(0,160)+'</td></tr>'; }).join('')+
    '</tbody></table></div></div>';
  return h;
}
function teacherOpen(rows){
  const ov=db.overrides; const list=rows.filter(r=>r.teacher_review==='yes' || (S.showAllOpen && /open|fill/.test(r.question_type)));
  const show=list.filter(r=>S.showAllOpen || !ov[r.attempt_id]).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
  let h='<div class="card"><label><input type="checkbox" id="showAllOpen"'+(S.showAllOpen?' checked':'')+'> הצג גם תשובות שכבר נבדקו וגם תשובות פתוחות שהמערכת סימנה כנכונות</label>'+
    '<p class="note">הבדיקה האוטומטית מחפשת רכיבי תשובה לפי מילים וביטויים (חוקים שקופים, בלי AI). היא לא מוכיחה הבנה — לכן תשובות מורכבות, חלקיות או לא ודאיות מגיעות לכאן. אפשר לשנות כל החלטה.</p><p><b>'+show.length+'</b> תשובות מוצגות.</p></div>';
  show.slice(0,200).forEach(r=>{
    const item=QBYID[r.question_id]||(QBYID[r.base_question_id]&&QBYID[r.base_question_id].transfer); const base=QBYID[r.base_question_id];
    const parts=item?item.parts:[]; const models=parts.filter(p=>p.model).map(p=>esc(p.model)).join('<br>');
    const hintSug = base && parts.flatMap(p=>p.criteria||[]).filter(c=>(r.criteria_missing||'').includes(c.id+':')).map(c=>c.hint)[0];
    const o=ov[r.attempt_id]||{};
    h+='<div class="review" data-aid="'+esc(r.attempt_id)+'"><div class="row" style="justify-content:space-between"><b>'+esc(r.student_id)+' · כיתה '+(GRADE_NAMES[r.grade]||esc(r.grade))+' · '+esc(r.question_id)+(r.is_transfer==='yes'?' (שאלת העברה)':'')+'</b><span class="small muted">'+esc(String(r.timestamp).replace('T',' ').slice(0,16))+' · ניסיון '+esc(r.attempt_order)+'</span></div>'+
      '<div class="small" style="margin:6px 0">'+(item?strip(item.prompt).slice(0,220):'')+'</div>'+
      '<div class="small muted">תשובת התלמיד (כפי שנכתבה):</div><div class="ans">'+esc(r.answer_text)+'</div>'+
      '<div class="small" style="margin-top:6px"><b>רכיבים שהוכחו:</b> '+(esc(r.criteria_met)||'—')+'<br><b>רכיבים חסרים:</b> '+(esc(r.criteria_missing)||'—')+'<br><b>הערכה אוטומטית:</b> '+(CORRECTNESS[r.correctness]||esc(r.correctness))+' · <b>ודאות:</b> '+esc(r.confidence)+(r.misconception?'<br><b>טעות אפשרית:</b> '+esc(r.misconception):'')+(hintSug?'<br><b>הצעה לרמז:</b> '+esc(hintSug):'')+(models?'<br><b>תשובה לדוגמה (מחוון ההכנה):</b> '+models:'')+'</div>'+
      '<div class="row" style="margin-top:8px"><label>החלטת מורה: <select class="ovC"><option value="">—</option>'+Object.keys(CORRECTNESS).filter(k=>k!=='uncertain').map(k=>'<option value="'+k+'"'+(o.teacher_override===k?' selected':'')+'>'+CORRECTNESS[k]+'</option>').join('')+'</select></label>'+
      '<label>רמת שליטה: <select class="ovM"><option value="">ללא שינוי</option>'+LEVEL_ORDER.map(l=>'<option value="'+l+'"'+(o.teacher_mastery===l?' selected':'')+'>'+LEVELS[l]+'</option>').join('')+'</select></label>'+
      '<input type="text" class="ovN" placeholder="הערה (לא חובה)" style="max-width:260px" value="'+esc(o.teacher_note||'')+'"><button class="btn small" data-act="saveOv">שמירה</button>'+(o.updated_at?'<span class="small muted">נשמר '+esc(String(o.updated_at).slice(0,16).replace('T',' '))+'</span>':'')+'</div></div>';
  });
  return h;
}
function teacherMap(){
  return '<div class="card"><h3 style="margin-top:0">טבלת קישור: שכבה → שאלה במבחן המקור → מיומנות → שאלה חדשה → מחוון</h3><p class="note">טקסט מבחני המקור והמחוון הרשמי אינם כלולים באפליקציה. מספר השאלה במקור מופיע לצורך התמצאות המורה בלבד. המחוון לכל שאלה חדשה הוא מחוון הכנה (לא רשמי).</p>'+
    '<div class="scroll"><table class="data"><thead><tr><th>שכבה</th><th>שאלה במקור</th><th>מיומנות</th><th>שאלה חדשה</th><th>שאלת העברה</th><th>סוג</th><th>מחוון</th></tr></thead><tbody>'+
    QUESTIONS.filter(q=>S.tGrade==='all'||String(q.grade)===String(S.tGrade)).map(q=>'<tr><td>'+GRADE_NAMES[q.grade]+'</td><td>'+q.src+'</td><td class="small">'+esc(q.skill)+'</td><td>'+q.id+'</td><td>'+q.transfer.id+'</td><td class="small">'+q.parts.map(p=>p.type).join('+')+'</td><td class="small">R-'+q.id+' ('+RUBRIC_VERSION+')</td></tr>').join('')+'</tbody></table></div></div>';
}
function teacherData(){
  const n=db.attempts.length;
  return '<div class="card"><h3 style="margin-top:0">ייצוא</h3><p>במכשיר הזה שמורים <b>'+n+'</b> ניסיונות תשובה. הקובץ נשמר בקידוד UTF-8 עם BOM, ונפתח כראוי ב־Excel וב־Google Sheets.</p>'+
    '<div class="actions"><button class="btn" data-act="exportAll">⬇️ ייצוא כל הנתונים (CSV)</button><button class="btn ghost" data-act="exportGrade">⬇️ ייצוא השכבה המסוננת בלבד</button></div></div>'+
    '<div class="card"><h3 style="margin-top:0">ייבוא</h3><p>כדי לרכז נתונים מכמה מכשירים: בכל Chromebook לוחצים ״שמירת קובץ התקדמות״ (או ייצוא ממסך המורה), ואז מייבאים את הקבצים כאן. ניסיונות שכבר קיימים לא ייכפלו. אין סנכרון אוטומטי בין מכשירים.</p>'+
    '<input type="file" id="importFile" accept=".csv,text/csv" multiple><div id="importMsg" class="note" style="margin-top:8px"></div></div>'+
    '<div class="card"><h3 style="margin-top:0">שימוש ב־Google Sheets</h3><ol class="small"><li>ייצאו קובץ CSV מכאן.</li><li>ב־Google Sheets: קובץ ← ייבוא ← העלאה ← בחרו את הקובץ ← ״החלפת הגיליון הנוכחי״ או ״הוספה לגיליון הנוכחי״.</li><li>השאירו את הגיליון פרטי (שיתוף רק עם צוות ההוראה). אין לשתף קישור ציבורי.</li><li>אחרי עדכונים בגיליון אפשר להוריד אותו שוב כ־CSV ולייבא כאן — החלטות מורה בעמודות teacher_override ו־teacher_mastery יישמרו.</li></ol></div>'+
    '<div class="card"><h3 style="margin-top:0">הגדרות</h3><div class="actions"><button class="btn ghost" data-act="changePin">שינוי קוד מורה</button><button class="btn danger" data-act="wipe">מחיקת כל הנתונים במכשיר</button></div><p class="note">גרסת אפליקציה '+APP_VERSION+' · גרסת מחוון '+RUBRIC_VERSION+'</p></div>';
}
function saveOverride(btn){
  const box=btn.closest('.review'); const aid=box.dataset.aid; const ov=db.overrides;
  const c=$('.ovC',box).value, m=$('.ovM',box).value, n=$('.ovN',box).value.trim();
  if(!c&&!m&&!n){ delete ov[aid]; } else ov[aid]={teacher_override:c, teacher_mastery:m, teacher_note:n, updated_at:nowISO()};
  db.saveOverrides(ov); render();
}
function readFiles(files){
  const msg=$('#importMsg'); let tot={added:0,updated:0,skipped:0}, left=files.length;
  Array.from(files).forEach(f=>{ const rd=new FileReader(); rd.onload=()=>{ try{ const r=importRows(parseCSV(String(rd.result))); tot.added+=r.added; tot.updated+=r.updated; tot.skipped+=r.skipped; }catch(e){ tot.skipped++; }
    if(--left===0){ render(); const m=$('#importMsg'); if(m) m.textContent='יובאו '+tot.added+' ניסיונות חדשים, עודכנו '+tot.updated+', דולגו '+tot.skipped+' שורות לא תקינות.'; } }; rd.readAsText(f,'utf-8'); });
}

/* ---------- אירועים ---------- */
document.addEventListener('click', e=>{
  const g=e.target.closest('[data-grade]'); if(g&&S.view==='login'){ S.student=($('#sid')||{}).value||S.student; S.grade=Number(g.dataset.grade); render(); return; }
  const tab=e.target.closest('[data-tab]'); if(tab){ S.tTab=tab.dataset.tab; render(); return; }
  const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act;
  if(a==='start') startStudent();
  else if(a==='check') check();
  else if(a==='hint') hint();
  else if(a==='rephrase') rephrase();
  else if(a==='toTransfer') toTransfer();
  else if(a==='next') next();
  else if(a==='saveMine') saveMine();
  else if(a==='logout'){ S.view='login'; S.teacher=false; S.feedback=null; S.partMarks=null; S.lastAnswers=null; S.rephraseShown=false; try{sessionStorage.removeItem(KEY.session);}catch(_){} render(); }
  else if(a==='teacher'){ S.view='pin'; render(); }
  else if(a==='pinGo') pinGo();
  else if(a==='saveOv') saveOverride(b);
  else if(a==='exportAll') download('science_tutor_all_'+today()+'.csv', toCSV(exportRows(db.attempts)));
  else if(a==='exportGrade') download('science_tutor_'+(S.tGrade==='all'?'all':'grade'+S.tGrade)+'_'+today()+'.csv', toCSV(exportRows(teacherRows())));
  else if(a==='printStudent') window.print();
  else if(a==='changePin'){ try{localStorage.removeItem(KEY.pin);}catch(_){} delete mem[KEY.pin]; S.view='pin'; render(); }
  else if(a==='wipe'){ if(confirm('למחוק את כל ניסיונות התלמידים, ההתקדמות והחלטות המורה במכשיר הזה? מומלץ לייצא קובץ לפני כן.') && confirm('האם אתם בטוחים? אי אפשר לבטל את המחיקה.')){ db.saveAttempts([]); db.saveOverrides({}); db.saveProgress({}); render(); } }
});
document.addEventListener('change', e=>{
  if(e.target.id==='tGrade'){ S.tGrade=e.target.value==='all'?'all':Number(e.target.value); render(); }
  else if(e.target.id==='tStudent'){ S.tStudent=e.target.value; render(); }
  else if(e.target.id==='showAllOpen'){ S.showAllOpen=e.target.checked; render(); }
  else if(e.target.id==='importFile'){ readFiles(e.target.files); }
});
document.addEventListener('keydown', e=>{ if(e.key==='Enter' && S.view==='login' && e.target.id==='sid') startStudent(); });

/* ---------- הפעלה ---------- */
try{ const s=JSON.parse(sessionStorage.getItem(KEY.session)||'null'); if(s&&s.student&&s.grade&&db.progress[s.student+'|'+s.grade]){ S.student=s.student; S.grade=Number(s.grade); goCurrent(); } else render(); }catch(e){ render(); }
window.__sciTutor = {QUESTIONS, gradeQuestion, gradePart, parseCSV, toCSV, importRows, db, norm, kwMatch};
})();
