const fs=require('fs');const src=fs.readFileSync(process.env.GS||require('path').join(__dirname,'../apps-script/notify.gs'),'utf8');
const db={talk:{roster:{'FSS Team':{'테스트1':'',},'FS WEST':{'테스트2':''}},slack:{req:{}}}};
const props={SLACK_BOT_TOKEN:'x',DB_URL:'https://db.example.invalid'};const cache={};let calls=[];
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
const f=new Function(...Object.keys(ctx),src+';return {slackPull,doPost,accessToken_:typeof accessToken_!=="undefined"?accessToken_:null};');
const g=f(...Object.values(ctx));
module.exports={g,db,props,calls,cache,hist};
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
// 222: 요청 채널(CSO·CS쉐어링) 글 → CS 방 (처음 한 번 7일치 + 새 글), talk 채널 글은 CS 방에 안 감, 같은 글은 한 번
if(require.main===module){
  const assert=require('assert');
  const cs=()=>Object.values((db.talk.msgs||{}).cs||{});
  assert(props.SLK_CS_BF_C0AT8RP3QDN && props.SLK_CS_BF_C0AHFJGKMTL, '처음 한 번 옮기기 표시');
  const t0=Date.now()/1000-20;
  hist.C0AHFJGKMTL=[{ts:t0.toFixed(6),user:'U2',text:'[CS쉐어링 접수] 테스트사병원 야간 문의'}];
  hist.C0AT8RP3QDN.push({ts:(t0+1).toFixed(6),user:'U1',text:'&lt;학술 요청&gt; 테스트오병원 자료 요청'});
  hist.C0C6U7RQ44D=[{ts:(t0+2).toFixed(6),user:'U1',text:'테스트육병원 마칩니다'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true); g.slackPull(true);
  const M=cs();
  assert(M.some(m=>m.slk.cn==='handover-cssharing-fsg'&&/테스트사병원/.test(m.text)), 'CS쉐어링 글이 CS 방에');
  assert(M.some(m=>/학술 요청/.test(m.text)), '요청함에 안 가는 학술요청도 CS 방에는 표시');
  assert(M.every(m=>m.uid==='slack'&&m.slk.cn!=='group-sysmex-talk'), 'talk 채널 글은 CS 방에 없음');
  assert.strictEqual(M.filter(m=>/테스트사병원/.test(m.text)).length,1,'같은 글은 한 번');
  console.log('slack_pull 222: 통과');
}
// 222-B: 요청 채널에 글 쓴 명단 밖 사람 = CSO → #group-sysmex-talk 일반 글은 전체방 대신 CS 방, 명단에 있는 사람은 CSO 로 안 봄
if(require.main===module){
  const assert=require('assert');
  const t0=Date.now()/1000-10;
  hist.C0AHFJGKMTL=[{ts:t0.toFixed(6),user:'U3',text:'[CS쉐어링 접수] 테스트팔병원 야간 문의'}];
  hist.C0AT8RP3QDN=[{ts:(t0+1).toFixed(6),user:'U1',text:'테스트구병원 이동합니다'}];
  hist.C0C6U7RQ44D=[{ts:(t0+2).toFixed(6),user:'U3',text:'테스트십병원 회신 부탁드립니다'}];
  for(const k in props) if(k.startsWith('SLK_TS_')) props[k]=String(t0-1);
  g.slackPull(true);
  const cso=db.talk.slack.cso||{};
  assert(cso.U3 && !cso.U1, 'U3(명단 밖)만 CSO 로 기록, U1(명단)은 아님');
  const inCs=Object.values(db.talk.msgs.cs).some(m=>/테스트십병원/.test(m.text));
  const inAll=Object.values(db.talk.msgs.all||{}).some(m=>/테스트십병원/.test(m.text));
  assert(inCs && !inAll, 'CSO 직원의 talk 글은 CS 방으로');
  console.log('slack_pull 222-B: 통과');
}
// 222-C: 전체방에 있던 Slack 글을 새 이름 기준으로 다시 맞춤([서부팀]·SKR FSW 앞머리, CS쉐어링 봇 → CS 방), 포털 글은 그대로
if(require.main===module){
  const assert=require('assert');
  db.talk.msgs.all=Object.assign(db.talk.msgs.all||{},{
    s111:{uid:'slack',name:'SKR FSW 테스트2',text:'가',ts:1,slk:{ch:'C0C6U7RQ44D',ts:'1.0',cn:'group-sysmex-talk'}},
    s112:{uid:'slack',name:'CS쉐어링 전화접수 인계사항',text:'나',ts:2,slk:{ch:'C0C6U7RQ44D',ts:'2.0',cn:'group-sysmex-talk'}},
    s113:{uid:'slack',name:'[동부팀]모름이',text:'다',ts:3,slk:{ch:'C0C6U7RQ44D',ts:'3.0',cn:'group-sysmex-talk'}},
    '-p1':{uid:'u1',name:'테스트1',text:'포털 글',ts:4}});
  delete props.SLK_REROUTE_222; g.slackPull(true);
  const A=db.talk.msgs.all;
  assert(!A.s111 && db.talk.msgs.west && db.talk.msgs.west.s111 && db.talk.msgs.west.s111.name==='테스트2','SKR FSW 테스트2 → 팀방');
  assert(!A.s112 && db.talk.msgs.cs.s112,'CS쉐어링 봇 → CS 방');
  assert(A.s113 && A.s113.name==='모름이' && A['-p1'],'명단 밖은 전체방(이름만 정리), 포털 글 그대로');
  console.log('slack_pull 222-C: 통과');
}
