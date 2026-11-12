// 281: 7일 안 요청이 80건을 넘으면 slkSync_ 가 키 순서(해시라 시각과 무관)로 뒤쪽 80건만 봐서 앞쪽 요청의 ✅ 확인이 반영되지 않던 것
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,g=t.g,now=Date.now()/1000,N=Date.now();
const CH='C0AT8RP3QDN';t.hist[CH]=[];db.talk.slack.req={};
for(let i=0;i<120;i++){const ts=(now-3600-i*60).toFixed(6),id='cso_d'+(i===0?'A':'Z')+String(i).padStart(9,'0');
  db.talk.slack.req[id]={kind:'cso',ch:CH,ts,st:i<100?'done':'new',doneBy:i<100?'테스트9':null,at:N-3600e3-i*6e4,t:'x',f:{hosp:'테스트병원'+i,eq:'XN-550'}};
  t.hist[CH].push({ts,user:'U1',text:'x',reactions:i===0?[{name:'white_check_mark',users:['U2']}]:[]});}
// 최근(i=0) 요청을 새 요청으로, 나머지 일부만 열림
db.talk.slack.req.cso_dA000000000.st='new';db.talk.slack.req.cso_dA000000000.doneBy=null;
g.slkSync_({});
const r=db.talk.slack.req.cso_dA000000000;
assert(r.ack&&r.ack.n,'키 순서와 무관하게 열린 최근 요청의 ✅ 확인 반영 '+JSON.stringify(r));
assert(r.st==='done'&&r.ackDone,'✅ 확인 = 확인 완료');
console.log('slack_sync_many ok');
