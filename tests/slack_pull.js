const fs=require('fs');const src=fs.readFileSync(process.env.GS||require('path').join(__dirname,'../apps-script/notify.gs'),'utf8');
const db={talk:{roster:{'FSS Team':{'테스트1':'',},'FS WEST':{'테스트2':''}},slack:{req:{}}}};
const props={SLACK_BOT_TOKEN:'x',DB_URL:'https://db.example.invalid'};const cache={};let calls=[];const sent=[];
function get(p){let o=db;for(const k of p.split('/').filter(Boolean)){o=o&&o[decodeURIComponent(k)];}return o;}
function set(p,v,patch){const ks=p.split('/').filter(Boolean).map(decodeURIComponent);let o=db;for(const k of ks.slice(0,-1)){o[k]=o[k]||{};o=o[k];}const L=ks[ks.length-1];if(patch){o[L]=o[L]||{};for(const k in v){if(v[k]===null)delete o[L][k];else o[L][k]=v[k];}}else o[L]=v;}
const now=Date.now()/1000;
const hist={C0AT8RP3QDN:[{ts:(now-60).toFixed(6),user:'U1',text:'<기술 요청>\n<인계 : FS WEST>\n기관명 : 테스트병원\n장비 : XN-1000\n요청사항 : 에러 확인',reactions:[{name:'white_check_mark',users:['U2']}],reply_count:1,latest_reply:(now-30).toFixed(6)}],C0AHFJGKMTL:[],C0C6U7RQ44D:[{ts:(now-50).toFixed(6),user:'U1',text:'테스트병원 이동합니다'}]};
const ctx={
 UrlFetchApp:{fetch(u,o={}){calls.push(u);if(/[" ]/.test(u))throw new Error('잘못된 인수: '+u);
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
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock(){},releaseLock(){}})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 Utilities:{formatDate:(d)=>d.toISOString().slice(0,10).replace(/-/g,''),computeDigest:(a,s)=>[...require('crypto').createHash('md5').update(String(s)).digest()],DigestAlgorithm:{MD5:1,SHA_1:1,SHA_256:1},Charset:{UTF_8:1},base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),base64Encode:s=>Buffer.from(String(s)).toString('base64')},
 ContentService:{createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:1}},
 ScriptApp:{getProjectTriggers:()=>[]},Logger:{log(){}},console};
ctx.accessToken_=null;
const f=new Function(...Object.keys(ctx),src+';verifyUser_=function(t){return String(t||"").indexOf("tok-")===0?String(t).slice(4):null;};return {slackPull,doPost,slackSend_,accessToken_:typeof accessToken_!=="undefined"?accessToken_:null};');
const g=f(...Object.values(ctx));
module.exports={g,db,props,calls,cache,hist,sent};
// 213: Slack 가져오기 회귀 시험 — 한 글 오류가 전체를 멈추지 않는지, 따옴표 쿼리, 확인(✅) 동기화, 이벤트 처리
if(require.main===module){
  const assert=require('assert');cache.at='tok';
  g.slackPull(true);
  const m=db.talk.slack.meta, R=Object.values(db.talk.slack.req);
  assert(m.ok && !m.err, 'meta 오류 없음: '+m.err);
  assert(R.length===1 && R[0].st==='doing' && R[0].ack.n==='테스트2' && R[0].mv && R[0].mv.n==='테스트1', '요청·확인·이동(방문 중) 표시');
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
  assert(R.ack && R.ack.n==='테스트2' && R.st==='doing','handover 의 ✔ 를 확인으로');
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
// 215: 「A 마치고 B 이동합니다」 → A 완료·B 방문 중, 다른 병원은 그대로
if(require.main===module){
  const assert=require('assert');
  const mk=(h)=>'&lt;기술요청&gt;&lt;인계 : FS WEST &gt;\n1) 기 관 명 : '+h+'\n2) 장 비 명 : XN-550\n3) 요청사항 : 방문 요청';
  const t0=(Date.now()/1000-20);
  hist.C0AT8RP3QDN=[{ts:t0.toFixed(6),user:'U1',text:mk('테스트오병원')},{ts:(t0+1).toFixed(6),user:'U1',text:mk('테스트육병원')},{ts:(t0+2).toFixed(6),user:'U1',text:mk('테스트칠병원')}];
  hist.C0C6U7RQ44D=[{ts:(t0+5).toFixed(6),user:'U2',text:'테스트오병원 소음 마치고, 식사 후 테스트육병원 확인 이동 합니다'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const by=h=>Object.values(db.talk.slack.req).find(v=>v.f.hosp===h);
  const a=by('테스트오병원'),b=by('테스트육병원'),c=by('테스트칠병원');
  assert(a.st==='done' && a.autoFin && a.doneBy==='테스트2','A 완료');
  assert(b.st==='doing' && b.mv && b.mv.n==='테스트2' && b.who==='테스트2','B 방문 중');
  assert(c.st==='new' && !c.mv && !c.fin,'C 그대로');
  console.log('slack_pull 215: 통과');
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
  assert(p.channel==='C0C6U7RQ44D' && p.username==='테스트2 (FS 포털)' && /&lt;마칩니다&gt; &amp; 확인/.test(p.text),'Slack 채널·이름·이스케이프');
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
