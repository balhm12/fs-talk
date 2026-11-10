// 260-B: 채널 방 + 팀 방 복사본을 멀티패스 PATCH 한 번으로 쓰고, PATCH 가 실패하면 경로별 PUT 으로 다시 쓰는지
// slack_pull.js 의 가짜 Slack·DB 를 텍스트로 가져와 「PATCH 실패 스위치」만 끼워 쓴다.
const fs=require('fs'),path=require('path'),assert=require('assert');
let t=fs.readFileSync(path.join(__dirname,'slack_pull.js'),'utf8');
t=t.replace("if(o.method==='put')","if(o.method==='patch'&&global.__failPatch)throw new Error('PATCH 실패(시험)');if(o.method==='put')");
t=t.replace("calls.push(u);","calls.push((o.method||'get')+' '+u);");
t=t.replace(/module\.exports=\{[^}]*\};/,'module.exports={g,db,props,calls,cache,sent};').replace('if(require.main===module){','if(false){');
const m={exports:{}};new Function('module','require','__dirname','process',t)(m,require,__dirname,process);
const {g,db,calls,cache}=m.exports;
cache.at='tok';
db.talk.users={u2:{name:'테스트2',team:'FS WEST',status:'approved'}};
const writes=()=>calls.filter(c=>/^(patch|put) .*talk\/msgs/.test(c));
// A: 정상 — 채널 방 + 팀 방 복사본이 PATCH 한 번으로
calls.length=0;
let r=g.slackSend_({idToken:'tok-u2',room:'sk_talk',text:'멀티패스 시험 A'});
assert(r.ok,'보내기 '+JSON.stringify(r));
const key='s'+r.ts.replace('.','_');
assert(db.talk.msgs.sk_talk[key] && db.talk.msgs.west[key+'t'],'두 방 모두 저장');
let w=writes(); assert(w.length===1 && /^patch /.test(w[0]),'쓰기 호출 1번(PATCH): '+JSON.stringify(w));
// B: PATCH 실패 → 경로별 PUT 으로 둘 다 저장
delete cache['slks:u2']; calls.length=0; global.__failPatch=true;
r=g.slackSend_({idToken:'tok-u2',room:'sk_talk',text:'멀티패스 시험 B'});
global.__failPatch=false;
assert(r.ok,'PATCH 실패해도 성공 '+JSON.stringify(r));
const k2='s'+r.ts.replace('.','_');
assert(db.talk.msgs.sk_talk[k2] && db.talk.msgs.west[k2+'t'],'다시 쓰기로 두 방 저장');
w=writes(); assert(w.length===3 && /^patch /.test(w[0]) && w.slice(1).every(x=>/^put /.test(x)),'PATCH 1 + PUT 2: '+JSON.stringify(w));
// C: 방이 하나뿐이면 PUT 한 번(채널 방만)
delete cache['slks:u2']; db.talk.users.u2.name='명단밖이름'; db.talk.users.u2.team='명단밖'; calls.length=0;
r=g.slackSend_({idToken:'tok-u2',room:'sk_talk',text:'멀티패스 시험 C'});
w=writes(); assert(r.ok && w.length===1 && /^put /.test(w[0]),'방 하나면 PUT: '+JSON.stringify(w));
console.log('slack_multipath: 통과');
