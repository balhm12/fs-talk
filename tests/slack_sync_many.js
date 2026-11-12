// 281: 7일 안 요청이 80건을 넘으면 slkSync_ 가 키 순서(해시라 시각과 무관)로 뒤쪽 80건만 봐서 앞쪽 요청의 ✅ 확인이 반영되지 않던 것
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,g=t.g,now=Date.now()/1000,N=Date.now();
const CH='C0AT8RP3QDN';t.hist[CH]=[];db.talk.slack.req={};
for(let i=0;i<120;i++){const ts=(now-3600-i*60).toFixed(6),id='cso_d'+(i===0?'A':'Z')+String(i).padStart(9,'0');
  db.talk.slack.req[id]={kind:'cso',ch:CH,ts,st:i<100?'done':'new',doneBy:i<100?'테스트9':null,at:N-3600e3-i*6e4,t:'x',f:{hosp:'테스트병원'+i,eq:'XN-550'}};
  t.hist[CH].push({ts,user:'U1',text:'x',reactions:i===0?[{name:'white_check_mark',users:['U2']}]:[]});}
// 최근(i=0) 요청을 새 요청으로, 나머지 일부만 열림
db.talk.slack.req.cso_dA000000000.st='new';db.talk.slack.req.cso_dA000000000.doneBy=null;
db.talk.slack.req.cso_dA000000000.f={hosp:'테스트군립병원',eq:'XN-550'};
// 282: 같은 건이 CS쉐어링 채널로도 들어온 요청 — 함께 확인. 다른 장비·24시간 넘은 것·묶음은 그대로
db.talk.slack.req.night_dS00000001={kind:'night',ch:'C0AHFJGKMTL',ts:'1.1',st:'new',at:N-3600e3-60e3,t:'x',f:{hosp:'테스트군립병원 (강원)',eq:'XN 550'}};
db.talk.slack.req.night_dS00000002={kind:'night',ch:'C0AHFJGKMTL',ts:'1.2',st:'new',at:N-3600e3-60e3,t:'x',f:{hosp:'테스트군립병원',eq:'CN-6000'}};
db.talk.slack.req.night_dS00000003={kind:'night',ch:'C0AHFJGKMTL',ts:'1.3',st:'new',at:N-3*864e5,t:'x',f:{hosp:'테스트군립병원',eq:'XN-550'}};
db.talk.slack.req.night_dS00000004={kind:'night',ch:'C0AHFJGKMTL',ts:'1.4',st:'new',multi:true,at:N-3600e3,t:'x',f:{hosp:'테스트군립병원',eq:'XN-550'}};
g.slkSync_({});
const r=db.talk.slack.req.cso_dA000000000;
assert(r.ack&&r.ack.n,'키 순서와 무관하게 열린 최근 요청의 ✅ 확인 반영 '+JSON.stringify(r));
assert(r.st==='done'&&r.ackDone,'✅ 확인 = 확인 완료');
const S=db.talk.slack.req;
assert(S.night_dS00000001.ack&&S.night_dS00000001.ack.via==='cso_dA000000000'&&S.night_dS00000001.st==='done','같은 병원·장비 다른 채널 요청도 확인 완료 '+JSON.stringify(S.night_dS00000001));
assert(!S.night_dS00000002.ack,'다른 장비는 그대로');assert(!S.night_dS00000003.ack,'24시간 넘은 것은 그대로');assert(!S.night_dS00000004.ack,'묶음 인계는 그대로');
console.log('slack_sync_many ok');
