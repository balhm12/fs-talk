// 284: 요청이 가리키는 Slack 글이 지워졌거나(CSO 가 지우고 다시 올림) 다른 글이라 ✅ 확인이 반영되지 않던 것 — 같은 요청의 handover 글로 옮겨 ✅ 반영
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,g=t.g,now=Date.now()/1000,N=Date.now();
const CH='C0AT8RP3QDN',TALK='C0C6U7RQ44D';
const form=(h,e,q)=>'<기술요청><인계 : FS EAST>\n1) 기 관 명 : '+h+'\n2) 장 비 명 : '+e+'\n3) 요청사항 : '+q+'\n6) 회 신 처 : 테스트9';
const ts0=(now-7200).toFixed(6),ts1=(now-7140).toFixed(6);
t.hist[CH]=[
  {ts:ts1,user:'U1',text:form('테스트군립병원','XN-550','프린터 문의'),reactions:[{name:'white_check_mark',users:['U2']}]},   // 다시 올린 글(✅ 있음) — 처음 글(ts0)은 지워져 기록에 없음
  {ts:(now-3000).toFixed(6),user:'U1',text:form('테스트다른병원','XN-550','다른 문의'),reactions:[{name:'white_check_mark',users:['U2']}]}];
t.hist[TALK]=[{ts:(now-5000).toFixed(6),user:'U1',text:form('테스트도립병원','CN-6000','응고 문의(머리말 다름)')}];
t.hist[CH].push({ts:(now-4990).toFixed(6),user:'U1',text:form('테스트도립병원','CN-6000','응고 문의'),reactions:[{name:'heavy_check_mark',users:['U2']}]});
db.talk.slack.req={
  cso_dDEL000001:{kind:'cso',ch:CH,ts:ts0,st:'new',at:Math.round(+ts0*1000),t:'x',f:{hosp:'테스트군립병원',eq:'XN-550',req:'프린터 문의'}},
  cso_dTALK00001:{kind:'cso',ch:TALK,ts:t.hist[TALK][0].ts,st:'new',at:N-5000e3,t:'x',f:{hosp:'테스트도립병원',eq:'CN-6000',req:'응고 문의(머리말 다름)'}},
  cso_dKEEP00001:{kind:'cso',ch:CH,ts:'1.9',st:'new',at:N-3600e3,t:'x',f:{hosp:'테스트시립병원',eq:'XN-550',req:'다른 건'}}};
t.hist[CH].push({ts:'1.9',user:'U1',text:form('테스트시립병원','XN-550','다른 건'),reactions:[]});
g.slkSync_({});
const S=db.talk.slack.req;
assert(S.cso_dDEL000001.ts===ts1&&S.cso_dDEL000001.ack&&S.cso_dDEL000001.st==='done','지운 글 → 다시 올린 글로 옮기고 ✅ 확인 '+JSON.stringify(S.cso_dDEL000001));
assert(S.cso_dTALK00001.ch===CH&&S.cso_dTALK00001.ack,'다른 채널 글(id 다름) → 같은 병원·장비 handover 글로 옮기고 ✅ '+JSON.stringify(S.cso_dTALK00001));
assert(S.cso_dKEEP00001.ts==='1.9'&&!S.cso_dKEEP00001.ack,'다른 병원 글의 ✅ 는 가져오지 않음');
console.log('slack_relink ok');
// 286: 이미 ✅ 확인된 handover 요청(다른 id)과 같은 병원·장비인 열린 요청은 따라 확인, 확인 뒤에 온 요청은 그대로
{const t2=require('./slack_pull.js');t2.cache.at='tok';const D=t2.db,N2=Date.now(),T=N2-2*36e5;
 t2.hist['C0AT8RP3QDN']=[];t2.hist['C0AHFJGKMTL']=[];
 D.talk.slack.req={
  cso_dHAND0001:{kind:'cso',ch:'C0AT8RP3QDN',ts:'9.1',st:'done',doneBy:'테스트2',ackDone:true,ack:{n:'테스트2',at:T},at:T-5*6e4,t:'x',f:{hosp:'테스트군립병원',eq:'XN-550'}},
  cso_dTALK0002:{kind:'cso',ch:'C0C6U7RQ44D',ts:'9.2',st:'new',at:T-6*6e4,t:'x',f:{hosp:'테스트군립병원',eq:'XN-550'}},
  night_dRR0003:{kind:'night',ch:'C0AHFJGKMTL',ts:'9.3',st:'new',at:T-3*36e5,rrAt:T-7*6e4,t:'x',f:{hosp:'테스트군립병원(강원)',eq:'XN 550'}},
  cso_dLATE0004:{kind:'cso',ch:'C0AT8RP3QDN',ts:'9.4',st:'new',at:T+36e5,t:'x',f:{hosp:'테스트군립병원',eq:'XN-550'}}};
 t2.g.slkSync_({});const S2=D.talk.slack.req;
 assert(S2.cso_dTALK0002.ack&&S2.cso_dTALK0002.ack.via==='cso_dHAND0001'&&S2.cso_dTALK0002.st==='done','다른 채널 요청 따라 확인 '+JSON.stringify(S2.cso_dTALK0002));
 assert(S2.night_dRR0003.ack&&S2.night_dRR0003.st==='done','CS쉐어링 재요청도 따라 확인');
 assert(!S2.cso_dLATE0004.ack,'확인 뒤에 온 요청은 그대로');
 console.log('slack_relink 286 ok');}
