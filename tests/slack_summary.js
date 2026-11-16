// 296: CS쉐어링 묶음 인계(아침 N차 인계사항) — 새 요청으로 만들지 않고 같은 병원·장비 기존 요청에 「인계 요약」 표시, 맞는 요청이 없는 건만 요청
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const {g,db,hist,props}=t;const CH='C0AHFJGKMTL',now=Date.now()/1000,N=Date.now();
const blk=(h,eq,req)=>`[CS쉐어링 접수] [인계 : L2]\n1) 기 관 명(지역) : ${h} (경기)\n2) 장 비 명 : ${eq}\n3) 요청사항 : ${req}\n4) 확인/조치사항 : 담당자 전달 및 회신 예정 안내 완료\n5) 회신여부 [Y]\n6) 접수처 : 테스트 / 010-0000-0000`;
const head='안녕하세요~\n11/15(일) 08시~ 11/16(월) 07시 CS쉐어링 전화접수 1차 인계사항 전달드립니다\n\n[CS쉐어링 전화접수 인계사항]\n\n1. L1\n-접수 내용 없음\n\n2. L2\n\n';
db.talk.slack.req={night_dEXIST:{kind:'night',ch:CH,ts:(now-5*3600).toFixed(6),st:'new',at:N-5*3600e3,t:'x',f:{hosp:'테스트기관B (경기)',eq:'XR-1000'}}};
for(const k of Object.keys(props)) if(/^SLK_TS_|^SLK_SUM_296/.test(k)) delete props[k];
props.SLK_SUM_296='1';
const ts1=(now-120).toFixed(6);
hist[CH]=[{ts:ts1,user:'U3',text:head+blk('테스트기관A','XR-9000','수치 표시 안 됨')+'\n\n'+blk('테스트기관B','XR-1000 (16032)','알럿 지속')+'\n\n3. CS\n-접수 내용 없음'}];
hist.C0AT8RP3QDN=[];hist.C0C6U7RQ44D=[];
g.slackPull(true);
const R=db.talk.slack.req, ids=Object.keys(R);
assert(R.night_dEXIST.sum&&R.night_dEXIST.sum.ts===ts1,'기존 요청에 인계 요약 표시 '+JSON.stringify(R.night_dEXIST));
assert(R.night_dEXIST.st==='new','기존 요청 상태는 그대로');
const fromSum=ids.filter(k=>R[k].ts===ts1);
assert.strictEqual(fromSum.length,1,'요약 글에서는 맞는 요청이 없는 건(A)만 요청 '+JSON.stringify(fromSum));
assert(R[fromSum[0]].f.hosp.indexOf('테스트기관A')===0&&R[fromSum[0]].multi,'A = 묶음 요청으로 남김');
// 머리말만 있고 접수 1건 + 기존 요청 있음 → 새 요청 없음
const ts2=(now-60).toFixed(6);R.night_dEXIST2={kind:'night',ch:CH,ts:'9.9',st:'new',at:N-3600e3,t:'x',f:{hosp:'테스트기관C',eq:'CN-6000'}};
hist[CH].push({ts:ts2,user:'U3',text:head+blk('테스트기관C','CN-6000','응고 에러')});
g.slackPull(true);
assert(!Object.keys(R).some(k=>R[k].ts===ts2),'머리말 있는 1건 요약도 기존 요청이 있으면 새 요청 없음');
assert(R.night_dEXIST2.sum&&R.night_dEXIST2.sum.ts===ts2,'그 요청에 요약 표시');
// 머리말 없는 한 건짜리 CS쉐어링 접수는 그대로 요청
const ts3=(now-30).toFixed(6);hist[CH].push({ts:ts3,user:'U3',text:blk('테스트기관D','UF-5000','요청')});
g.slackPull(true);
assert(Object.keys(R).some(k=>R[k].ts===ts3&&!R[k].multi),'개별 접수 글은 요청으로');
// 한 번 정리: 이미 생긴 열린 묶음 요청 중 개별 요청이 있는 것 → 인계 요약으로 완료
R.night_nOLD={kind:'night',ch:CH,ts:'8.8',st:'new',multi:true,at:N-600e3,t:'x',f:{hosp:'테스트기관E',eq:'XN-550'}};
R.night_dE={kind:'night',ch:CH,ts:'7.7',st:'new',at:N-7200e3,t:'x',f:{hosp:'테스트기관E (서울)',eq:'XN 550'}};
R.night_nLONE={kind:'night',ch:CH,ts:'8.8',st:'new',multi:true,at:N-600e3,t:'x',f:{hosp:'테스트기관F',eq:'XN-550'}};
const n=g.slkSum296_();
assert.strictEqual(n,1,'정리 1건');
assert(R.night_nOLD.st==='done'&&R.night_nOLD.doneBy==='인계 요약'&&R.night_nOLD.sumOf==='night_dE','묶음 요청 정리');
assert(R.night_dE.sum&&R.night_dE.st==='new','개별 요청은 그대로 + 요약 표시');
assert(R.night_nLONE.st==='new','맞는 개별 요청이 없는 묶음 요청은 남김');
console.log('slack_summary ok');
