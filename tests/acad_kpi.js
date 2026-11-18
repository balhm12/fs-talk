// 299-2 학술 응대 → KPI 대시보드: 날짜·시간별 건수 만들기(가명 기록만)
const fs=require('fs'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','apps-script','notify.gs'),'utf8');
const pick=n=>{ const a=src.indexOf(n); assert(a>=0,n); return a; };
const a=pick('const ACAD_CUT_MS'), b=pick('function schBotToken_(');
const api=new Function(src.slice(a,b)+';return {acadKpiDays_,ACAD_CUT_MS};')();
assert.strictEqual(new Date(api.ACAD_CUT_MS+9*3600e3).toISOString().slice(0,16),'2026-11-04T00:00','전환 시각 = 2026-11-04 00:00 한국 시간');
const T=(s)=>Date.parse(s+'+09:00');
const v={
  x1:{k:'a',t:T('2026-11-03T23:59:00')},   // 전환 전 — 빼기(Talk 기간)
  x2:{k:'a',t:T('2026-11-04T00:10:00')},   // 0시
  x3:{k:'a',t:T('2026-11-04T09:30:00')},
  x4:{k:'t',t:T('2026-11-04T10:00:00')},   // 기술요청 — 빼기
  x5:{k:'a',t:T('2026-11-05T18:05:00')},
  x6:{k:'a'}                                 // 시각 없음 — 빼기
};
const r=api.acadKpiDays_(v);
assert.strictEqual(r.n,3,'학술·전환 뒤만 3건');
assert.deepStrictEqual([r.from,r.to],['2026-11-04','2026-11-05']);
assert.strictEqual(r.days['2026-11-04'][0],1); assert.strictEqual(r.days['2026-11-04'][9],1); assert.strictEqual(r.days['2026-11-05'][18],1);
assert.strictEqual(Object.values(r.days).reduce((s,h)=>s+h.reduce((a,b)=>a+b,0),0),3,'합계 = 건수');
assert(!/name|text|q:|h:|acct/.test(src.slice(pick('function acadKpiPush_('),pick('function acadKpiReq_('))),'보내는 값에 이름·본문 없음');
assert(/KPI_BOT_EMAIL/.test(src)&&!/KPI_BOT_PW\s*=\s*['"]/.test(src),'계정은 스크립트 속성에만');
assert(/SLK_ACAD_KPI_V !== NOTIFY_VER/.test(src),'서버 버전이 바뀌면 한 번 다시 올림');
console.log('acad_kpi ok');
