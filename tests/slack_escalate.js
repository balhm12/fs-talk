// 277: 미확인 요청 알림 — 새 요청·✅ 없음·담당 없음·30분 지남 → 그 팀 팀장에게 한 번, 팀 모르면 관리자, 07~21시만, 재요청이면 다시
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,g=t.g,N=Date.UTC(2026,10,12,1,0,0);   // 한국 10:00
let H=10;const _fd=t.ctx.Utilities.formatDate;t.ctx.Utilities.formatDate=(d,z,f)=>f==='H'?String(H):_fd(d,z,f);
const out={get length(){return t.fcm.length},set length(v){t.fcm.length=v},filter(fn){return t.fcm.map(m=>({tok:m.token,title:m.webpush.notification.title,body:m.webpush.notification.body,link:m.webpush.fcm_options.link,data:m.data})).filter(fn)}};
db.talk.roster={"FS WEST":{"테스트1":{o:"",lead:true},"테스트2":""},"FS SOUTH":{"테스트3":{o:"부산",lead:true}},"FSS Team":{"테스트5":{o:"",lead:true}}};
db.talk.users={u1:{name:'테스트1',team:'FS WEST',status:'approved'},u2:{name:'테스트2',team:'FS WEST',status:'approved'},u3:{name:'테스트3',team:'FS SOUTH',status:'approved'},u5:{name:'테스트5',team:'FSS Team',status:'approved'}};
db.talk.admins={u5:true};db.talk.mute={};
db.talk.tokens={u1:{a:{token:'T1'}},u2:{a:{token:'T2'}},u3:{a:{token:'T3'}},u5:{a:{token:'T5'}}};
const F=(team,h)=>Object.assign(team?{team}:{},{hosp:h,eq:'XN-1000',req:'에러 확인'});
db.talk.slack.req={
 cso_eAAAAAAAAAA1:{kind:'cso',st:'new',at:N-40*6e4,t:'x',f:F('FS WEST','테스트가병원')},              // 40분 미확인 → 테스트1(WEST 팀장)
 cso_eAAAAAAAAAA2:{kind:'cso',st:'new',at:N-10*6e4,t:'x',f:F('FS WEST','테스트나병원')},              // 10분 → 아직
 cso_eAAAAAAAAAA3:{kind:'cso',st:'new',at:N-60*6e4,t:'x',f:F('FS WEST','테스트다병원'),ack:{n:'테스트2',at:N-50*6e4}}, // 확인됨 → 안 보냄
 night_eAAAAAAAA4:{kind:'night',st:'new',at:N-90*6e4,t:'x',f:{hosp:'테스트라병원 (부산)',eq:'CN-6000',req:'정전'}},       // 지역 부산 → 테스트3
 cso_eAAAAAAAAAA5:{kind:'cso',st:'new',at:N-45*6e4,t:'x',f:{hosp:'테스트마병원',eq:'UF-5000'}},        // 팀 모름 → 관리자(테스트5)
 cso_eAAAAAAAAAA6:{kind:'cso',st:'new',at:N-30*3600e3,t:'x',f:F('FS WEST','테스트바병원')},            // 24시간 넘음 → 안 보냄
};
// 밤(22시)에는 안 보냄
H=23;assert.strictEqual(g.slkEscalate_(N),null,'밤에는 보내지 않음');assert.strictEqual(out.length,0);
H=10;const r=g.slkEscalate_(N);const R=db.talk.slack.req;
assert(r&&r.reqs===3,'대상 3건 '+JSON.stringify(r));
const to=k=>out.filter(x=>x.tok===k);
assert(to('T1').length===1&&/40분째/.test(to('T1')[0].title)&&/테스트가병원/.test(to('T1')[0].body),'WEST 팀장에게 '+JSON.stringify(to('T1')));
assert(to('T2').length===0,'팀원에게는 안 보냄');
assert(to('T3').length===1&&/테스트라병원/.test(to('T3')[0].body),'야간 부산 → SOUTH 팀장');
assert(to('T5').length===1&&/테스트마병원/.test(to('T5')[0].body),'팀 모름 → 관리자');
assert(/#req$/.test(to('T1')[0].link)&&to('T1')[0].data.room==='_req','누르면 요청함');
assert(R.cso_eAAAAAAAAAA1.esc===N-40*6e4&&!R.cso_eAAAAAAAAAA2.esc&&!R.cso_eAAAAAAAAAA3.esc,'보낸 것만 표시');
// 다시 돌려도 같은 요청은 한 번만
out.length=0;assert.strictEqual(g.slkEscalate_(N+6e4),null,'두 번 보내지 않음');assert.strictEqual(out.length,0);
// 재요청이면 다시(재요청 시각부터 30분)
R.cso_eAAAAAAAAAA1.rrAt=N-31*6e4;out.length=0;const r2=g.slkEscalate_(N+6e4);
assert(r2&&r2.reqs===1&&to('T1').length===1,'재요청 30분 → 다시 알림');
// 전체 알림을 끈 기기는 제외
R.cso_eAAAAAAAAAA2.at=N-35*6e4;db.talk.mute={u1:{_all:true}};out.length=0;g.slkEscalate_(N+2*6e4);
assert(to('T1').length===0&&R.cso_eAAAAAAAAAA2.esc,'전체 알림 끈 기기는 안 보냄(표시는 남김)');
console.log('slack_escalate 277: 통과');
