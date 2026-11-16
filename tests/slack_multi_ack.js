// 295: 묶음 야간 인계(CS쉐어링 글 하나에 접수 여러 건) — 스레드 답글에 병원 이름이 있으면 그 건만 확인
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const {g,db,hist,replies,calls}=t;const M=g.slkMultiMatch_;
// ── 순수 함수 ──
const IT=[{id:'a',hosp:'의료법인테스트십자의료재단',eq:'XR-9000'},{id:'b',hosp:'테스트화병원',eq:'XR-1000 (16032)'}];
const eq=(txt,exp,why)=>assert.deepStrictEqual(M(IT,txt).sort(),exp,why+' : '+txt);
eq('테스트화병원 확인했습니다. 3시 이후 통화하겠습니다',['b'],'병원 이름 그대로');
eq('테스트십자 오전 방문 예정입니다',['a'],'법인·재단 뺀 이름 일부(3자 이상)');
eq('테스트십자의료재단에 연락드렸습니다',['a'],'조사 붙은 이름');
eq('두 건 모두 확인했습니다',[],'병원 이름 없음 → 확인 안 함');
eq('병원 방문 예정입니다',[],'일반 낱말만');
eq('테스트화병원은 제 담당 아님',[],'담당 아님');
eq('테스트십자 미확인 상태입니다',[],'미확인');
eq('테스트십자, 테스트화병원 둘 다 확인',['a','b'],'두 병원 다 적으면 둘 다');
eq('',[],'빈 글');
const IT2=[{id:'x',hosp:'테스트병원',eq:'XR-1000'},{id:'y',hosp:'테스트병원',eq:'XN-550'}];
assert.deepStrictEqual(M(IT2,'테스트병원 XR-1000 확인').sort(),['x'],'같은 병원 두 건 → 장비로 좁힘');
assert.deepStrictEqual(M(IT2,'테스트병원 xr1000 확인').sort(),['x'],'장비 표기 달라도(소문자·하이픈 없음)');
assert.deepStrictEqual(M(IT2,'테스트병원 확인').sort(),['x','y'],'장비 안 적으면 둘 다');
const IT3=[{id:'s',hosp:'테스트광의료재단',eq:'XN-1000'},{id:'t',hosp:'서울테스트병원',eq:'XN-550'}];
assert.deepStrictEqual(M(IT3,'테스트 확인했어요'),[],'이름 일부가 여러 병원에 걸리면 확인 안 함');
assert.deepStrictEqual(M([{id:'p',hosp:'부산테스트병원',eq:'XN'},{id:'q',hosp:'부산다른병원',eq:'XN'}],'부산 갑니다'),[],'두 글자가 여러 병원 앞부분에 맞으면 확인 안 함');
assert.deepStrictEqual(M([{id:'s',hosp:'삼광의료재단',eq:'XN'}],'삼광 확인'),['s'],'두 글자 줄임말이 한 건만 맞으면 확인');
assert.deepStrictEqual(M([{id:'s',hosp:'서울의과학연구소',eq:'XN'}],'서울 이동 중'),[],'지역 이름 두 글자는 줄임말로 안 봄');
// ── slkSync_ 전체 흐름 ──
const CH='C0AHFJGKMTL',now=Date.now()/1000,N=Date.now(),ts=(now-3600).toFixed(6);
db.talk.slack.req={};db.talk.slack.cso={U3:{n:'[CSIS] 상담사 테스트칠',at:N}};
const S=db.talk.slack.req;
S.night_nA={kind:'night',ch:CH,ts,st:'new',multi:true,at:N-3600e3,t:'x',f:{hosp:'의료법인테스트십자의료재단',eq:'XR-9000',lvl:'L2'}};
S.night_nB={kind:'night',ch:CH,ts,st:'new',multi:true,at:N-3600e3,t:'x',f:{hosp:'테스트화병원',eq:'XR-1000 (16032)',lvl:'L2'}};
const parent={ts,user:'U3',text:'[CS쉐어링 접수] …',reactions:[{name:'white_check_mark',users:['U2']}],reply_count:2,latest_reply:(now-600).toFixed(6)};
hist[CH]=[parent];hist.C0AT8RP3QDN=[];
replies[CH+'|'+ts]=[{ts:(now-1200).toFixed(6),user:'U3',text:'테스트십자 고객 재통화 요청 있음'},{ts:(now-600).toFixed(6),user:'U2',text:'테스트화병원 확인했습니다 3시 이후 통화'}];
g.slkSync_({});
assert(S.night_nB.ack&&S.night_nB.ack.n==='테스트2'&&S.night_nB.ack.th===1,'답글에 병원 이름 → 그 건 확인 '+JSON.stringify(S.night_nB));
assert(S.night_nB.st==='done'&&S.night_nB.ackDone,'확인 = 확인 완료(267 규칙과 같음)');
assert(!S.night_nA.ack&&S.night_nA.st==='new','CS쉐어링 상담사 답글·묶음 ✅ 반응으로는 확인 안 함 '+JSON.stringify(S.night_nA));
assert(S.night_nA.lr===parent.latest_reply,'읽은 답글 표시(lr) 저장');
// 답글이 그대로면 스레드를 다시 읽지 않음
let n0=calls.filter(u=>u.includes('conversations.replies')).length;g.slkSync_({});
assert.strictEqual(calls.filter(u=>u.includes('conversations.replies')).length,n0,'답글 그대로면 다시 안 읽음');
// 새 답글 → 남은 건 확인
parent.reply_count=3;parent.latest_reply=(now-60).toFixed(6);
replies[CH+'|'+ts].push({ts:(now-60).toFixed(6),user:'U2',text:'테스트십자의료재단 오전 방문합니다'});
g.slkSync_({});
assert(S.night_nA.ack&&S.night_nA.st==='done','새 답글로 남은 건도 확인');
// 봇 답글은 무시
S.night_nC={kind:'night',ch:CH,ts:'2.0',st:'new',multi:true,at:N-600e3,t:'x',f:{hosp:'테스트삼병원',eq:'CN-6000'}};
hist[CH].push({ts:'2.0',user:'U3',text:'x',reply_count:1,latest_reply:'2.1'});
replies[CH+'|2.0']=[{ts:'2.1',bot_id:'B9',user:'U2',text:'테스트삼병원 확인'}];
g.slkSync_({});assert(!S.night_nC.ack,'봇 답글은 확인으로 안 봄');
// 명단에 없는 사람(아직 상담사로 표시되지 않은 CS쉐어링 직원 등) 답글은 확인으로 안 봄
S.night_nD={kind:'night',ch:CH,ts:'3.0',st:'new',multi:true,at:N-600e3,t:'x',f:{hosp:'테스트오병원',eq:'CN-6000'}};
hist[CH].push({ts:'3.0',user:'U3',text:'x',reply_count:1,latest_reply:'3.1'});
replies[CH+'|3.0']=[{ts:'3.1',user:'U3',text:'테스트오병원 확인'}];
delete db.talk.slack.cso.U3;g.slkSync_({});assert(!S.night_nD.ack,'명단 밖 사람 답글은 확인 안 함');
// 묶음이 아닌 요청은 기존 규칙 그대로(이 기능이 건드리지 않음)
console.log('slack_multi_ack ok');
