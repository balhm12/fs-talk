const fs=require('fs');const src=fs.readFileSync(process.env.GS||require('path').join(__dirname,'../apps-script/notify.gs'),'utf8');
const db={talk:{roster:{'FSS Team':{'테스트1':'',},'FS WEST':{'테스트2':''}},slack:{req:{}}}};
const props={SLACK_BOT_TOKEN:'x',DB_URL:'https://db.example.invalid'};const cache={};let calls=[];const sent=[];const fcm=[];
function get(p){let o=db;for(const k of p.split('/').filter(Boolean)){o=o&&o[decodeURIComponent(k)];}return o;}
function set(p,v,patch){const ks=p.split('/').filter(Boolean).map(decodeURIComponent);let o=db;for(const k of ks.slice(0,-1)){o[k]=o[k]||{};o=o[k];}const L=ks[ks.length-1];if(patch){o[L]=o[L]||{};for(const k in v){if(k.includes('/')){set(ks.concat(k.split('/')).join('/'),v[k]===null?undefined:v[k]);continue;}if(v[k]===null)delete o[L][k];else o[L][k]=v[k];}}else o[L]=v;}
const now=Date.now()/1000;
const hist={C0AT8RP3QDN:[{ts:(now-60).toFixed(6),user:'U1',text:'<기술 요청>\n<인계 : FS WEST>\n기관명 : 테스트병원\n장비 : XN-1000\n요청사항 : 에러 확인',reactions:[{name:'white_check_mark',users:['U2']}],reply_count:1,latest_reply:(now-30).toFixed(6)}],C0AHFJGKMTL:[],C0C6U7RQ44D:[{ts:(now-50).toFixed(6),user:'U1',text:'테스트병원 이동합니다'}]};
const ctx={
 UrlFetchApp:{fetchAll(rs){return rs.map(r=>{fcm.push(JSON.parse(r.payload).message);return {getResponseCode:()=>200,getContentText:()=>'{}'};});},fetch(u,o={}){calls.push(u);if(/[" ]/.test(u))throw new Error('잘못된 인수: '+u);
  if(u.startsWith('https://slack.com/api/')){const m=u.split('/api/')[1].split('?')[0];const q=new URLSearchParams(u.split('?')[1]||'');
    let r={ok:true};if(m==='conversations.history')r={ok:true,messages:hist[q.get('channel')]||[]};
    if(m==='conversations.replies'){const p=hist[q.get('channel')].find(x=>x.ts===q.get('ts'));r={ok:true,messages:[p,{ts:p.latest_reply,user:'U2',text:'제가 봅니다'}]};}
    if(m==='users.info')r={ok:true,user:{real_name:q.get('user')==='U1'?'테스트1':q.get('user')==='U3'?'[CSIS] 상담사 테스트칠':'테스트2'}};
    if(m==='auth.test')r={ok:true,user_id:'B1',team_id:'T'};
    if(m==='chat.postMessage'){const pl=JSON.parse(o.payload||'{}');sent.push(pl);r={ok:true,ts:(Date.now()/1000+sent.length/1e4).toFixed(6)};}
    return {getContentText:()=>JSON.stringify(r),getResponseCode:()=>200};}
  const path=u.replace(props.DB_URL+'/','').split('.json')[0];
  if(o.method==='put')set(path,JSON.parse(o.payload));else if(o.method==='patch')set(path,JSON.parse(o.payload),1);else if(o.method==='delete')set(path,undefined);
  let v=get(path);if(u.includes('orderBy'))v=v||{};
  return {getContentText:()=>JSON.stringify(v===undefined?null:v),getResponseCode:()=>200};}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,getProperties:()=>Object.assign({},props),setProperty:(k,v)=>props[k]=v})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock(){},releaseLock(){}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 Utilities:{formatDate:(d)=>d.toISOString().slice(0,10).replace(/-/g,''),computeDigest:(a,s)=>[...require('crypto').createHash('md5').update(String(s)).digest()],DigestAlgorithm:{MD5:1,SHA_1:1,SHA_256:1},Charset:{UTF_8:1},base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),base64Encode:s=>Buffer.from(String(s)).toString('base64')},
 ContentService:{createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1}},
 ScriptApp:{getProjectTriggers:()=>[]},Logger:{log(){}},console};
ctx.accessToken_=null;
const f=new Function(...Object.keys(ctx),src+';verifyUser_=function(t){return String(t||"").indexOf("tok-")===0?String(t).slice(4):null;};return {slackPull,doPost,slackSend_,slkFieldHint_,slkAckDone266_,slkEscalate_,slkSync_,slkDiag_,slkMerge287_,slackStats_,slkStatBand_,slkStatFld_,accessToken_:typeof accessToken_!=="undefined"?accessToken_:null};');
const g=f(...Object.values(ctx));
module.exports={g,db,props,calls,cache,hist,sent,ctx,fcm};
// 213: Slack 가져오기 회귀 시험 — 한 글 오류가 전체를 멈추지 않는지, 따옴표 쿼리, 확인(✅) 동기화, 이벤트 처리
if(require.main===module){
  const assert=require('assert');cache.at='tok';
  g.slackPull(true);
  const m=db.talk.slack.meta, R=Object.values(db.talk.slack.req);
  assert(m.ok && !m.err, 'meta 오류 없음: '+m.err);
  assert(R.length===1 && R[0].st==='done' && R[0].ackDone===true && R[0].ack.n==='테스트2' && !R[0].mv, '요청·✅ 확인 → 확인 완료(266), 담당·확인자가 아닌 사람(테스트1)의 「이동」은 방문 중으로 안 바뀜(258)');
  assert(Object.keys(props).filter(k=>k.startsWith('SLK_TS_')).length===3, '세 채널 모두 읽은 시각 저장');
  assert(!calls.some(u=>/[" ]/.test(u)), '따옴표·공백 없는 주소');
  const n=calls.filter(u=>u.includes('conversations.replies')).length; g.slackPull(true);
  assert(calls.filter(u=>u.includes('conversations.replies')).length===n, '답글이 그대로면 스레드 다시 안 읽음');
  assert.strictEqual(g.doPost({postData:{contents:JSON.stringify({type:'url_verification',challenge:'abc'})}}).t,'abc');
  g.doPost({postData:{contents:JSON.stringify({type:'event_callback',event:{type:'reaction_added',item:{channel:'C0AT8RP3QDN'}}})}});
  assert(db.talk.slack.meta.ev, '이벤트 시각 기록');
  assert(/skip/.test(g.doPost({postData:{contents:JSON.stringify({type:'event_callback',event:{type:'message',channel:'CXXXX'}})}}).t), '다른 채널 무시');
  props.SLACK_VERIFY_TOKEN='vt'; assert(/false/.test(g.doPost({postData:{contents:JSON.stringify({type:'event_callback',token:'no',event:{type:'message',channel:'C0AT8RP3QDN'}})}}).t), '토큰 다르면 거절');
  console.log('slack_pull: 통과');
}
// 214: 같은 요청이 #group-sysmex-talk 에 먼저 → handover 로 옮기고, handover 글의 ✔ 를 확인으로 읽음
if(require.main===module){
  const assert=require('assert');
  const form='&lt;기술요청&gt;&lt;인계 : FS WEST &gt;\n1) 기 관 명 : 테스트이병원\n2) 장 비 명 : XN-550\n3) 요청사항 : 방문 서비스 요청';
  const t0=(Date.now()/1000-40);
  hist.C0C6U7RQ44D.unshift({ts:t0.toFixed(6),user:'U1',text:form});
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  hist.C0AT8RP3QDN=[];   // handover 글은 아직 안 옴
  g.slackPull(true);
  let R=Object.entries(db.talk.slack.req).find(([k,v])=>v.f&&v.f.hosp==='테스트이병원');
  assert(R && R[1].ch==='C0C6U7RQ44D','먼저 온 talk 글로 요청 생성');
  // 시나리오 A: handover 글이 이미 읽힌 뒤(옛 자료) — sync 가 옮김
  hist.C0AT8RP3QDN=[{ts:(t0+5).toFixed(6),user:'U1',text:form,reactions:[{name:'heavy_check_mark',users:['U2']}]}];
  g.slackPull(true);
  R=db.talk.slack.req[R[0]];
  assert.strictEqual(R.ch,'C0AT8RP3QDN','handover 로 옮김');
  assert(R.ack && R.ack.n==='테스트2' && R.st==='done' && R.ackDone===true,'handover 의 ✔ 를 확인으로');
  console.log('slack_pull 214: 통과');
}
// 214-A: handover 글을 이미 지나 읽은 뒤(배포 전 자료) — 확인 맞추기가 handover 짝을 찾아 옮김
if(require.main===module){
  const assert=require('assert');
  const form='&lt;기술요청&gt;&lt;인계 : FS EAST &gt;\n1) 기 관 명 : 테스트삼병원\n2) 장 비 명 : XR-1000\n3) 요청사항 : 에러 문의';
  const t0=(Date.now()/1000-30);
  hist.C0C6U7RQ44D=[{ts:t0.toFixed(6),user:'U1',text:form}]; hist.C0AT8RP3QDN=[];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const id=Object.keys(db.talk.slack.req).find(k=>db.talk.slack.req[k].f.hosp==='테스트삼병원');
  hist.C0AT8RP3QDN=[{ts:(t0+3).toFixed(6),user:'U1',text:form,reactions:[{name:'white_check_mark',users:['U2']}]}];
  props.SLK_TS_C0AT8RP3QDN=String(t0+10);   // 이미 지나 읽음
  g.slackPull(true);
  const r=db.talk.slack.req[id];
  assert(r.ch==='C0AT8RP3QDN' && r.ack && r.ack.n==='테스트2','확인 맞추기에서 handover 로 옮기고 ✅ 읽음');
  console.log('slack_pull 214-A: 통과');
}
// 215: 「A 마치고 B 이동합니다」 → A 완료·B 방문 중, 다른 병원은 그대로 (258: B 는 글쓴이가 그 요청의 담당일 때만 방문 중)
if(require.main===module){
  const assert=require('assert');
  const mk=(h)=>'&lt;기술요청&gt;&lt;인계 : FS WEST &gt;\n1) 기 관 명 : '+h+'\n2) 장 비 명 : XN-550\n3) 요청사항 : 방문 요청';
  const t0=(Date.now()/1000-20);
  hist.C0AT8RP3QDN=[{ts:t0.toFixed(6),user:'U1',text:mk('테스트오병원')},{ts:(t0+1).toFixed(6),user:'U1',text:mk('테스트육병원')},{ts:(t0+2).toFixed(6),user:'U1',text:mk('테스트칠병원')}];
  hist.C0C6U7RQ44D=[];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const by=h=>Object.values(db.talk.slack.req).find(v=>v.f.hosp===h);
  by('테스트육병원').who='테스트2'; by('테스트육병원').st='doing';   // 258: 테스트2 가 이 요청의 담당
  hist.C0C6U7RQ44D=[{ts:(t0+5).toFixed(6),user:'U2',text:'테스트오병원 소음 마치고, 식사 후 테스트육병원 확인 이동 합니다'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const a=by('테스트오병원'),b=by('테스트육병원'),c=by('테스트칠병원');
  assert(a.st==='done' && a.autoFin && a.doneBy==='테스트2','A 완료');
  assert(b.st==='doing' && b.mv && b.mv.n==='테스트2' && b.who==='테스트2','B 방문 중(담당자 본인 글)');
  assert(c.st==='new' && !c.mv && !c.fin,'C 그대로');
  console.log('slack_pull 215: 통과');
}
// 258: 현장 「이동」 글 판별 — 담당·확인자만, 용건(이전설치·서비스 대기) 제외, 경로변경 시 앞선 방문 중 해제 (사용자 지적 2026-11-11 박재우·김재모)
if(require.main===module){
  const assert=require('assert');
  const mk=(h,extra)=>'&lt;기술요청&gt;&lt;인계 : FS WEST &gt;\n1) 기 관 명 : '+h+'\n2) 장 비 명 : XN-550\n3) 요청사항 : '+(extra||'방문 요청');
  const t0=(Date.now()/1000-20);
  hist.C0AT8RP3QDN=['테스트전주병원','테스트국군병원','테스트세종병원','테스트고대병원'].map((h,i)=>({ts:(t0+i).toFixed(6),user:'U1',text:mk(h)}));
  hist.C0C6U7RQ44D=[];
  const reset=()=>{for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);};
  reset();g.slackPull(true);
  const by=h=>Object.values(db.talk.slack.req).find(v=>v.f.hosp===h);
  // 테스트2 가 전주·국군·세종 요청의 담당, 고대 요청은 담당 없음
  ['테스트전주병원','테스트국군병원','테스트세종병원'].forEach(h=>{by(h).who='테스트2';by(h).st='doing';});
  const at=(i,text,user)=>({ts:(t0+10+i).toFixed(6),user:user||'U2',text});
  // 1) 용건이 있는 이동 — 이전설치(요청에 없음)·서비스 대기 → 요청 상태 그대로
  hist.C0C6U7RQ44D=[at(0,'테스트전주병원 un, hiscl 이전설치 이동합니다'),at(1,'서비스 대기(테스트세종병원) 이동합니다.')];
  reset();g.slackPull(true);
  assert(!by('테스트전주병원').mv,'이전설치 이동은 전주 요청을 방문 중으로 안 바꿈');
  assert(!by('테스트세종병원').mv,'서비스 대기 이동은 세종 요청을 방문 중으로 안 바꿈');
  // 2) 담당·확인자가 아닌 사람의 이동(새 요청 포함) — 방문 중·담당 자동 지정 없음
  hist.C0C6U7RQ44D=[at(2,'테스트고대병원 이동합니다','U3')];
  reset();g.slackPull(true);
  assert(by('테스트고대병원').st==='new' && !by('테스트고대병원').mv && !by('테스트고대병원').who,'담당 없는 새 요청은 이동 글로 처리 중·담당이 되지 않음');
  hist.C0C6U7RQ44D=[at(3,'테스트국군병원 이동합니다','U3')];
  reset();g.slackPull(true);
  assert(!by('테스트국군병원').mv,'담당(테스트2)이 아닌 사람(테스트칠)의 이동은 반영 안 됨');
  // 3) 담당자 본인의 이동은 방문 중
  hist.C0C6U7RQ44D=[at(4,'테스트전주병원 이동합니다')];
  reset();g.slackPull(true);
  assert(by('테스트전주병원').mv && by('테스트전주병원').mv.n==='테스트2','담당 본인의 이동은 방문 중으로 표시');
  // 4) 경로변경 — 앞선 방문 중(전주)은 지우고 새 병원(국군)은 방문 중
  hist.C0C6U7RQ44D=[at(5,'경로변경하여 테스트국군병원 이동합니다')];
  reset();g.slackPull(true);
  assert(!by('테스트전주병원').mv,'경로변경하면 앞서 이동한 전주 요청의 방문 중 표시를 지움');
  assert(by('테스트국군병원').mv && by('테스트국군병원').mv.n==='테스트2','새 병원은 방문 중');
  // 5) 요청 글에 용건이 있으면(설치 요청) 같은 용건의 이동은 반영
  hist.C0AT8RP3QDN=[{ts:(t0+20).toFixed(6),user:'U1',text:mk('테스트설치병원','XN 신규 설치 문의')}];
  hist.C0C6U7RQ44D=[];reset();g.slackPull(true);
  by('테스트설치병원').who='테스트2';by('테스트설치병원').st='doing';
  hist.C0C6U7RQ44D=[at(6,'테스트설치병원 설치 이동합니다')];
  reset();g.slackPull(true);
  assert(by('테스트설치병원').mv,'요청 글에 같은 용건(설치)이 있으면 이동 반영');
  console.log('slack_pull 258: 통과');
}
// 224: Slack 채널 방 — 세 채널 글은 채널 방(sk_*)에, 해당 팀·사무소방에는 복사본(키 +t). 222 의 CS 방·전체방 Slack 글은 채널 방으로 옮김
if(require.main===module){
  const assert=require('assert');
  const M=r=>(db.talk.msgs||{})[r]||{};
  assert(props.SLK_MIG_224 && props.SLK_CHAN_BF_C0AT8RP3QDN && props.SLK_CHAN_BF_C0C6U7RQ44D,'옮기기·채우기 한 번 표시');
  // 옛 자료: CS 방·전체방·팀방에 있던 Slack 글
  db.talk.msgs.cs=Object.assign(db.talk.msgs.cs||{},{s900_1:{uid:'slack',name:'테스트9',text:'옛 CSO 글',ts:1,slk:{ch:'C0AT8RP3QDN',ts:'900.1',cn:'handover-cso-fsg'}},'-p':{uid:'u1',name:'테스트1',text:'CS 포털 글',ts:2}});
  db.talk.msgs.all=Object.assign(db.talk.msgs.all||{},{s901_1:{uid:'slack',name:'모름이',text:'옛 talk 글',ts:3,slk:{ch:'C0C6U7RQ44D',ts:'901.1',cn:'group-sysmex-talk'}}});
  db.talk.msgs.west=Object.assign(db.talk.msgs.west||{},{s902_1:{uid:'slack',name:'테스트2',text:'옛 팀 글',ts:4,slk:{ch:'C0C6U7RQ44D',ts:'902.1',cn:'group-sysmex-talk'}}});
  delete props.SLK_MIG_224;
  const t0=Date.now()/1000-10;
  hist.C0AT8RP3QDN=[{ts:t0.toFixed(6),user:'U3',text:'&lt;기술요청&gt;&lt;인계 : FS SOUTH &gt; <!subteam^S1|@fssouth-busan>\n1) 기 관 명 : 테스트백병원\n2) 장 비 명 : XN-550\n3) 요청사항 : 에러'}];
  hist.C0AHFJGKMTL=[{ts:(t0+1).toFixed(6),user:'U3',text:'&lt;기술요청&gt;&lt;인계 : FS EAST&gt;\n[CS쉐어링 접수] 테스트이백병원 야간'}];
  hist.C0C6U7RQ44D=[{ts:(t0+2).toFixed(6),user:'U2',text:'테스트삼백병원 이동합니다'},{ts:(t0+3).toFixed(6),user:'U3',text:'회신 부탁드립니다'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const k=x=>'s'+String(x.toFixed(6)).replace('.','_');
  assert(M('sk_cso')[k(t0)] && M('busan')[k(t0)+'t'] && !M('south')[k(t0)+'t'],'CSO 글: 채널 방 + @fssouth-busan → 부산 사무소방(멘션이 양식보다 먼저)');
  assert(M('sk_night')[k(t0+1)] && M('east')[k(t0+1)+'t'],'CS쉐어링 글: 채널 방 + 인계 FS EAST → east');
  assert(M('sk_talk')[k(t0+2)] && M('west')[k(t0+2)+'t'],'talk 엔지니어 글: 채널 방 + 작성자 팀방');
  assert(M('sk_talk')[k(t0+3)] && !Object.values(M('all')).some(v=>v&&/회신 부탁/.test(v.text)) && !Object.values(M('cs')).some(v=>v&&/회신 부탁/.test(v.text)),'명단 밖 작성자: 채널 방에만(전체방·CS 방 아님)');
  assert(M('sk_cso').s900_1 && !M('cs').s900_1 && M('cs')['-p'],'옛 CS 방 Slack 글 → sk_cso, 포털 글은 그대로');
  assert(M('sk_talk').s901_1 && !M('all').s901_1,'옛 전체방 Slack 글 → sk_talk');
  assert(M('west').s902_1t && !M('west').s902_1,'옛 팀방 복사본 키 → +t');
  assert(db.talk.slack.cso.U3 && !db.talk.slack.cso.U2,'CSO 직원 기록은 그대로');
  console.log('slack_pull 224: 통과');
}
// 224-B: 포털 채널 방에서 쓴 글 → Slack(이름 (FS 포털)) + 채널 방 + 작성자 팀방, 승인 안 된 사람·없는 방은 거절
if(require.main===module){
  const assert=require('assert');
  db.talk.users={u2:{name:'테스트2',team:'FS WEST',status:'approved'},u9:{name:'테스트9',team:'FS WEST',status:'pending'}};
  let r=g.slackSend_({idToken:'tok-u2',room:'sk_talk',text:'테스트사백병원 <마칩니다> & 확인'});
  assert(r.ok,'보내기 성공 '+JSON.stringify(r));
  const p=sent[sent.length-1];
  assert(p.channel==='C0C6U7RQ44D' && p.username==='테스트2 (FS Portal)' && /&lt;마칩니다&gt; &amp; 확인/.test(p.text),'Slack 채널·이름·이스케이프');
  const key='s'+r.ts.replace('.','_');
  assert(db.talk.msgs.sk_talk[key].uid==='u2' && db.talk.msgs.sk_talk[key].slk.out && db.talk.msgs.west[key+'t'],'채널 방(내 글) + 팀방 복사본');
  r=g.slackSend_({idToken:'tok-u2',room:'sk_cso',text:'&lt;기술요청&gt;'}); // 같은 사람 2초 안
  assert(!r.ok,'연속 보내기 막음');
  delete cache['slks:u2'];
  r=g.slackSend_({idToken:'tok-u2',room:'west',text:'x'}); assert(!r.ok && /bad room/.test(r.err),'채널 방 아닌 곳 거절');
  r=g.slackSend_({idToken:'tok-u9',room:'sk_talk',text:'x'}); assert(!r.ok,'승인 안 된 사람 거절');
  r=g.slackSend_({idToken:'bad',room:'sk_talk',text:'x'}); assert(!r.ok && r.err==='auth','토큰 없으면 거절');
  console.log('slack_pull 224-B: 통과');
}
// 227: 머리말로 FS 팀에 다시 넘긴 학술요청 = 요청, 같은 날 재요청은 「재요청」으로 붙이고 완료였으면 다시 새 요청, 같은 글(두 채널)은 재요청 아님, 한 번 다시 보기
if(require.main===module){
  const assert=require('assert');const RQ=()=>Object.values(db.talk.slack.req);
  const t0=Date.now()/1000-600;
  const form=h=>`&lt;기술요청&gt;&lt;인계 : FS WEST &gt;\n1) 기 관 명 : ${h}\n2) 장 비 명 : UC-3500\n3) 요청사항 : 에러 해소 방법 문의`;
  hist.C0AT8RP3QDN=[
    {ts:t0.toFixed(6),user:'U3',text:'CSO Team 먼저 인계드렸으나,\nFS WEST CAL 시행 거래처로 확인되어 전달드립니다.\n==============================\n&lt;학술요청&gt;&lt;인계 : CSO &gt;\n1) 기 관 명 : 테스트칠병원\n2) 장 비 명 : XR-3000\n3) 요청사항 : CAL 일정 요청'},
    {ts:(t0+10).toFixed(6),user:'U3',text:form('테스트팔병원')}];
  hist.C0AHFJGKMTL=[];hist.C0C6U7RQ44D=[{ts:(t0+12).toFixed(6),user:'U3',text:form('테스트팔병원')}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const a=RQ().find(r=>r.f&&r.f.hosp==='테스트칠병원');assert(a&&a.f.team==='FS WEST'&&a.st==='new','머리말 FS WEST 전달 → 요청(학술요청 양식이어도)');
  let b=RQ().find(r=>r.f&&r.f.hosp==='테스트팔병원');assert(b&&!b.rr,'두 채널 같은 글은 재요청 아님');
  const bid=Object.keys(db.talk.slack.req).find(k=>db.talk.slack.req[k]===b);db.talk.slack.req[bid].st='done';db.talk.slack.req[bid].doneBy='테스트2';
  hist.C0AT8RP3QDN=[{ts:(t0+200).toFixed(6),user:'U3',text:'&lt; 기술 요청 &gt;&lt; 인계 : FS WEST &gt;\n바코드 재등록후 사용했으나 증상 동일함\n기술 회신 요청\n=======================\n'+form('테스트팔병원')}];hist.C0C6U7RQ44D=[];
  g.slackPull(true);
  b=db.talk.slack.req[bid];assert(b.rr&&Object.keys(b.rr).length===1&&b.st==='new'&&!b.doneBy&&b.rrAt,'재요청 → rr 붙이고 완료를 새 요청으로');
  g.slackPull(true);assert(Object.keys(db.talk.slack.req[bid].rr).length===1,'같은 재요청 두 번 안 붙음');
  // 다시 보기: 이미 읽은 글이지만 요청이 없던 것 → 요청함에만, 채널 방은 다시 안 씀
  delete db.talk.slack.req[Object.keys(db.talk.slack.req).find(k=>db.talk.slack.req[k].f&&db.talk.slack.req[k].f.hosp==='테스트칠병원')];
  const ck='s'+t0.toFixed(6).replace('.','_');delete db.talk.msgs.sk_cso[ck];
  hist.C0AT8RP3QDN=[{ts:t0.toFixed(6),user:'U3',text:'CSO Team 먼저 인계드렸으나,\nFS WEST CAL 시행 거래처로 확인되어 전달드립니다.\n==============================\n&lt;학술요청&gt;&lt;인계 : CSO &gt;\n1) 기 관 명 : 테스트칠병원\n2) 장 비 명 : XR-3000\n3) 요청사항 : CAL 일정 요청'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0+300);
  delete props.SLK_RESCAN_227;g.slackPull(true);
  assert(RQ().some(r=>r.f&&r.f.hosp==='테스트칠병원'),'다시 보기로 빠졌던 요청 생김');
  assert(!db.talk.msgs.sk_cso[ck],'다시 보기는 채널 방을 다시 쓰지 않음');
  assert(+props.SLK_TS_C0AT8RP3QDN>=t0+300 && props.SLK_RESCAN_227,'읽은 시각은 뒤로 안 감·한 번 표시');
  console.log('slack_pull 227: 통과');
}
// 229: 주소(permalink)만 있는 글 → 그 글 내용을 펼쳐 저장, 이미 들어온 것도 한 번 펼침
if(require.main===module){
  const assert=require('assert');
  const lts='1794175506.273949', now=Date.now()/1000;
  hist.C0AHFJGKMTL=[{ts:lts,user:'U3',text:'11/8 CS쉐어링 전화접수 인계사항\n[CS쉐어링 접수] [인계 : L2]\n1) 기 관 명(지역) : 테스트희망병원 (서울)'}];
  hist.C0AT8RP3QDN=[];hist.C0C6U7RQ44D=[{ts:(now-5).toFixed(6),bot_id:'B9',subtype:'bot_message',username:'CS쉐어링 전화접수 인계사항',text:'<https://skr-x.slack.com/archives/C0AHFJGKMTL/p1794175506273949>'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(now-10);
  props.SLK_TS_C0AHFJGKMTL=String(+lts+1);
  g.slackPull(true);
  const k='s'+(now-5).toFixed(6).replace('.','_'),v=db.talk.msgs.sk_talk[k];
  assert(v&&/^↪ #handover-cssharing-fsg 글\n/.test(v.text)&&/테스트희망병원/.test(v.text),'새 글: 주소 대신 내용 '+(v&&v.text.slice(0,40)));
  db.talk.msgs.sk_talk.s999_1={uid:'slack',name:'CS쉐어링 전화접수 인계사항',text:'https://skr-x.slack.com/archives/C0AHFJGKMTL/p1794175506273949',ts:1,slk:{ch:'C0C6U7RQ44D',ts:'999.1',cn:'group-sysmex-talk'}};
  delete props.SLK_LINK_229;g.slackPull(true);
  assert(/테스트희망병원/.test(db.talk.msgs.sk_talk.s999_1.text)&&props.SLK_LINK_229,'옛 글도 한 번 펼침');
  console.log('slack_pull 229: 통과');
}
// 232: 같은 글을 두 채널에 올리면 팀 방엔 한 번, 이미 두 번 들어간 것은 정리
if(require.main===module){
  const assert=require('assert');const now=Date.now()/1000;
  const form='&lt;기술요청&gt;&lt;인계 : FS EAST &gt;\n1) 기 관 명 : 테스트척병원\n2) 장 비 명 : XN-1000\n3) 요청사항 : CAL 전 점검';
  hist.C0AT8RP3QDN=[{ts:(now-6).toFixed(6),user:'U3',text:form}];hist.C0AHFJGKMTL=[];hist.C0C6U7RQ44D=[{ts:(now-5).toFixed(6),user:'U3',text:form}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(now-10);
  g.slackPull(true);
  const E=Object.values(db.talk.msgs.east||{}).filter(v=>v&&/테스트척병원/.test(v.text));
  assert.strictEqual(E.length,1,'팀 방엔 한 번');
  assert(Object.values(db.talk.msgs.sk_cso).some(v=>v&&/테스트척병원/.test(v.text))&&Object.values(db.talk.msgs.sk_talk).some(v=>v&&/테스트척병원/.test(v.text)),'채널 방엔 각각');
  db.talk.msgs.east.s100_1t={uid:'slack',name:'X',text:'같은 글',ts:1000,slk:{}};db.talk.msgs.east.s101_1t={uid:'slack',name:'X',text:'같은  글',ts:2000,slk:{}};
  delete props.SLK_DEDUP_232;g.slackPull(true);
  assert(db.talk.msgs.east.s100_1t&&!db.talk.msgs.east.s101_1t,'이미 두 번 들어간 것 정리(나중 것 삭제)');
  console.log('slack_pull 232: 통과');
}
// 233: 고친 글을 다시 읽어도 같은 Slack 글이면 요청 하나, 이미 두 건이면 진행한 것만 남김
if(require.main===module){
  const assert=require('assert');const now=Date.now()/1000;const ts=(now-30).toFixed(6);
  const f=r=>`&lt;기술요청&gt;&lt;인계 : FS WEST &gt;\n1) 기 관 명 : 테스트경기지부\n2) 장 비 명 : XN-2000\n3) 요청사항 : ${r}`;
  hist.C0AT8RP3QDN=[{ts,user:'U3',text:f('CAL 전 점검 요청')}];hist.C0AHFJGKMTL=[];hist.C0C6U7RQ44D=[];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(now-60);
  g.slackPull(true);
  hist.C0AT8RP3QDN=[{ts,user:'U3',text:f('CAL 전 점검 요청\n-11월 17일 13시 CAL 예정')}];
  props.SLK_TS_C0AT8RP3QDN=String(now-60);g.slackPull(true);
  const L=Object.values(db.talk.slack.req).filter(r=>r&&r.f&&r.f.hosp==='테스트경기지부');
  assert.strictEqual(L.length,1,'고친 글 다시 읽어도 요청 하나');
  const id=Object.keys(db.talk.slack.req).find(k=>db.talk.slack.req[k]&&db.talk.slack.req[k].f&&db.talk.slack.req[k].f.hosp==='테스트경기지부');
  db.talk.slack.req.cso_dDUP000000001=Object.assign({},db.talk.slack.req[id],{st:'doing',who:'테스트2'});
  delete props.SLK_REQDUP_233;g.slackPull(true);
  const L2=Object.entries(db.talk.slack.req).filter(([k,r])=>r&&r.f&&r.f.hosp==='테스트경기지부');
  assert(L2.length===1&&L2[0][0]==='cso_dDUP000000001','이미 두 건이면 진행한 것만 남김');
  console.log('slack_pull 233: 통과');
}
// 235: Slack 글도 알림 — 채널 방·팀 방 켬/끔 기준, 본인 제외, 같은 글 한 번, 다른 팀 방은 관리자가 직접 켠 것만, 오래된 글은 안 보냄
if(require.main===module){
  const assert=require('assert');
  db.talk.users={a:{name:'테스트2',team:'FS WEST',status:'approved'},b:{name:'테스트3',team:'FS WEST',status:'approved'},
    c:{name:'테스트4',team:'FS EAST',status:'approved'},d:{name:'테스트5',team:'FSS Team',status:'approved'},e:{name:'테스트6',team:'FS EAST',status:'approved'},f:{name:'테스트7',team:'FS EAST',status:'approved'}};
  db.talk.tokens={};['a','b','c','d','e','f'].forEach(u=>db.talk.tokens[u]={k1:{token:'T-'+u}});
  db.talk.admins={d:true};
  db.talk.mute={b:{west:true,sk_talk:true},c:{sk_talk:true},d:{sk_talk:true,west:false},f:{_all:true}};
  const ts=(Date.now()/1000-20).toFixed(6);
  hist.C0AT8RP3QDN=[];hist.C0AHFJGKMTL=[];hist.C0C6U7RQ44D=[{ts,user:'U2',text:'테스트병원 점검 끝났습니다'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(Date.now()/1000-60);
  fcm.length=0;g.slackPull(true);
  const to=u=>fcm.filter(m=>m.token==='T-'+u);
  assert.strictEqual(to('a').length,0,'쓴 사람(테스트2) 본인은 안 받음');
  assert.strictEqual(to('b').length,0,'팀 방·채널 방 둘 다 끈 사람은 안 받음');
  assert.strictEqual(to('c').length,0,'채널 방 끈 다른 팀 사람은 안 받음');
  assert.strictEqual(to('e').length,1,'채널 방 켠(기본) 사람은 한 번');
  assert(/sk_talk/.test(to('e')[0].webpush.fcm_options.link),'채널 방으로 연결');
  assert.strictEqual(to('d').length,1,'관리자가 직접 켠 다른 팀 방(west)으로 한 번');
  assert(/#room-west/.test(to('d')[0].webpush.fcm_options.link) && /Slack/.test(to('d')[0].webpush.notification.title),'팀 방 이름·Slack 표시');
  assert.strictEqual(to('f').length,0,'전체 알림 끈 기기는 안 받음');
  // 다시 읽어도(새 글 없음) 또 보내지 않음, 오래된 글은 안 보냄
  fcm.length=0;g.slackPull(true);assert.strictEqual(fcm.length,0,'새 글 없으면 안 보냄');
  hist.C0C6U7RQ44D=[{ts:(Date.now()/1000-3600).toFixed(6),user:'U1',text:'한 시간 전 글'}];
  props.SLK_TS_C0C6U7RQ44D=String(Date.now()/1000-7200);fcm.length=0;g.slackPull(true);assert.strictEqual(fcm.length,0,'15분 넘은 글은 안 보냄');
  // 포털 채널 방에서 Slack 으로 보낸 글 → 같은 팀 사람 알림, 본인 제외
  delete cache['slks:b'];fcm.length=0;
  db.talk.mute={};
  const r=g.slackSend_({idToken:'tok-b',room:'sk_talk',text:'테스트 포털에서 보냄'});assert(r.ok,'보내기');
  assert(to('a').length===1 && to('b').length===0 && to('e').length===1,'포털→Slack 글도 알림, 본인 제외');
  // 2건 이상이면 기기마다 한 번(「새 글 n건」)
  const t2=Date.now()/1000-10;hist.C0C6U7RQ44D=[{ts:(t2).toFixed(6),user:'U1',text:'하나'},{ts:(t2+1).toFixed(6),user:'U1',text:'둘'}];
  props.SLK_TS_C0C6U7RQ44D=String(t2-5);fcm.length=0;g.slackPull(true);
  assert(to('e').length===1 && /2건/.test(to('e')[0].webpush.notification.title),'여러 글은 한 번에 묶음');
  assert(db.talk.slack.meta.push && db.talk.slack.meta.push.posts===2,'보낸 기록 meta.push');
  console.log('slack_pull 235: 통과');
}
