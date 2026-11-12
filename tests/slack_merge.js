// 287: 같은 CSO 요청 글이 handover·#group-sysmex-talk 두 채널에 올라와 양식 읽은 결과가 달라도(요청사항 줄 차이) 요청은 하나
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const {g,db,props,hist}=t;
const form=(q)=>'&lt;기술요청&gt;&lt;인계 : FS EAST &gt;\n1) 기 관 명 : 테스트군립병원\n2) 장 비 명 : XN-550\n3) 요청사항 : '+q;
const reqs=()=>Object.entries(db.talk.slack.req||{}).filter(([k,v])=>v.f&&v.f.hosp==='테스트군립병원'&&v.kind==='cso');
// A: handover 먼저, talk 나중(요청사항 줄이 다름) → 1건
db.talk.slack.req={};const t0=Date.now()/1000-300;
for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
hist.C0AT8RP3QDN=[{ts:t0.toFixed(6),user:'U1',text:form('프린터 문의')}];
hist.C0C6U7RQ44D=[{ts:(t0+20).toFixed(6),user:'U1',text:form('프린터 문의 *오후 1시 이후*')}];
g.slackPull(true);
let R=reqs();assert.strictEqual(R.length,1,'A: 1건 '+JSON.stringify(R.map(r=>r[0])));assert.strictEqual(R[0][1].ch,'C0AT8RP3QDN','A: handover 글');
// B: talk 먼저, handover 나중 → 1건, handover 로 옮김
db.talk.slack.req={};const t1=Date.now()/1000-200;
for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t1-1);
hist.C0C6U7RQ44D=[{ts:t1.toFixed(6),user:'U1',text:form('네트워크 프린터 가능 여부')}];
hist.C0AT8RP3QDN=[];g.slackPull(true);
hist.C0AT8RP3QDN=[{ts:(t1+40).toFixed(6),user:'U1',text:form('네트워크 프린터 가능 여부 회신')}];
for(const k in props) if(k==='SLK_TS_C0AT8RP3QDN') props[k]=String(t1-1);
g.slackPull(true);
R=reqs();assert.strictEqual(R.length,1,'B: 1건 '+JSON.stringify(R.map(r=>[r[0],r[1].ch])));assert.strictEqual(R[0][1].ch,'C0AT8RP3QDN','B: handover 로 옮김');
// C: 다른 장비는 따로
db.talk.slack.req={};const t2=Date.now()/1000-100;
for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t2-1);
hist.C0AT8RP3QDN=[{ts:t2.toFixed(6),user:'U1',text:form('프린터 문의')}];
hist.C0C6U7RQ44D=[{ts:(t2+20).toFixed(6),user:'U1',text:form('프린터 문의 2').replace('XN-550','CN-6000')}];
g.slackPull(true);
assert.strictEqual(Object.keys(db.talk.slack.req).length,2,'C: 다른 장비는 2건');
console.log('slack_merge ok');
// D: 이미 둘로 생긴 것 한 번 정리 — talk 쪽(따라 확인됨) 지우고 handover 쪽 남김, 현장 이동이 붙은 것은 그대로
{const N=Date.now();db.talk.slack.req={
  cso_dH1:{kind:'cso',ch:'C0AT8RP3QDN',ts:'1.1',st:'done',ack:{n:'테스트2',at:N},doneBy:'테스트2',ackDone:true,at:N-60e3,f:{hosp:'테스트군립병원',eq:'XN-550'}},
  cso_dT1:{kind:'cso',ch:'C0C6U7RQ44D',ts:'1.2',st:'done',ack:{n:'테스트2',at:N,via:'cso_dH1'},doneBy:'테스트2',ackDone:true,at:N-120e3,f:{hosp:'테스트군립병원',eq:'XN 550'}},
  cso_dH2:{kind:'cso',ch:'C0AT8RP3QDN',ts:'2.1',st:'new',at:N-60e3,f:{hosp:'테스트도립병원',eq:'XN-550'}},
  cso_dT2:{kind:'cso',ch:'C0C6U7RQ44D',ts:'2.2',st:'doing',mv:{n:'테스트3',at:N},at:N-60e3,f:{hosp:'테스트도립병원',eq:'XN-550'}}};
 const n=g.slkMerge287_();const S=db.talk.slack.req;
 assert(!S.cso_dT1&&S.cso_dH1,'D: talk 쪽 지움');assert(S.cso_dT2,'D: 현장 이동 붙은 건 그대로');assert.strictEqual(n,1);
 console.log('slack_merge 287-D ok');}
