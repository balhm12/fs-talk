// 266: ✅ 확인 = 「확인 완료」(방문 중이 아니면), 확인 완료 뒤 담당의 「이동」 글 → 다시 방문 중, 「마칩니다」 → 방문 완료, 한 번 정리
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,N=Date.now();
db.talk.users={u1:{name:'테스트2',team:'FS WEST',status:'approved'}};db.talk.admins={u1:true};
const F=h=>({team:'FS WEST',hosp:h,eq:'XN-1000',req:'에러 확인'});
db.talk.slack.req={
 cso_dAAAAAAAAAA1:{ch:'C0AT8RP3QDN',ts:'1.1',kind:'cso',st:'doing',at:N-5e6,t:'x',f:F('테스트가병원'),who:'테스트2',ack:{n:'테스트2',at:N-4e6}},            // 확인만 → 정리 대상
 cso_dAAAAAAAAAA2:{ch:'C0AT8RP3QDN',ts:'1.2',kind:'cso',st:'doing',at:N-5e6,t:'x',f:F('테스트나병원'),who:'테스트2',ack:{n:'테스트2',at:N-4e6},mv:{n:'테스트2',t:'이동',at:N-3e6}}, // 방문 중 → 그대로
 cso_dAAAAAAAAAA3:{ch:'C0AT8RP3QDN',ts:'1.3',kind:'cso',st:'doing',at:N-5e6,t:'x',f:F('테스트다병원'),who:'테스트2',ack:{n:'테스트2',at:N-4e6},rrAt:N-1e6}, // 확인 뒤 재요청 → 그대로
 cso_dAAAAAAAAAA4:{ch:'C0AT8RP3QDN',ts:'1.4',kind:'cso',st:'new',at:N-2e6,t:'x',f:F('테스트라병원')}                                                     // 포털 확인 시험용
};
const n=t.g.slkAckDone266_();const R=db.talk.slack.req;
assert(n===1&&R.cso_dAAAAAAAAAA1.st==='done'&&R.cso_dAAAAAAAAAA1.ackDone===true&&R.cso_dAAAAAAAAAA1.doneBy==='테스트2','처리 중 + 확인만 → 확인 완료');
assert(R.cso_dAAAAAAAAAA2.st==='doing'&&!R.cso_dAAAAAAAAAA2.ackDone,'방문 중은 그대로');
assert(R.cso_dAAAAAAAAAA3.st==='doing','확인 뒤 재요청은 그대로');
// 포털 「✅ 확인」 → 바로 확인 완료
const r=JSON.parse(t.g.doPost({postData:{contents:JSON.stringify({type:'slack',idToken:'tok-u1',id:'cso_dAAAAAAAAAA4',op:'ack'})}}).t);
assert(r.ok,'확인 요청 성공 '+JSON.stringify(r));
assert(R.cso_dAAAAAAAAAA4.st==='done'&&R.cso_dAAAAAAAAAA4.ackDone===true&&R.cso_dAAAAAAAAAA4.ack.n==='테스트2','포털 확인 → 확인 완료');
// 확인 완료 뒤 담당이 이동 글 → 다시 방문 중
t.g.slkFieldHint_('테스트가병원 이동합니다','테스트2',N);
assert(R.cso_dAAAAAAAAAA1.st==='doing'&&R.cso_dAAAAAAAAAA1.mv&&!R.cso_dAAAAAAAAAA1.ackDone&&!R.cso_dAAAAAAAAAA1.doneAt,'확인 완료 → 이동 글 → 방문 중');
// 다른 사람 이동 글은 무시
t.g.slkFieldHint_('테스트라병원 이동합니다','테스트9',N);
assert(R.cso_dAAAAAAAAAA4.st==='done'&&R.cso_dAAAAAAAAAA4.ackDone,'담당·확인자가 아니면 그대로');
// 마칩니다 → 방문 완료
t.g.slkFieldHint_('테스트가병원 마칩니다','테스트2',N+1);
assert(R.cso_dAAAAAAAAAA1.st==='done'&&R.cso_dAAAAAAAAAA1.autoFin&&!R.cso_dAAAAAAAAAA1.ackDone,'마칩니다 → 방문 완료');
t.g.slkFieldHint_('테스트라병원 마칩니다','테스트2',N+2);
assert(R.cso_dAAAAAAAAAA4.st==='done'&&R.cso_dAAAAAAAAAA4.autoFin&&!R.cso_dAAAAAAAAAA4.ackDone,'확인 완료 건에 마칩니다 → 방문 완료');
console.log('slack_ackdone 266: 통과');
