/**
 * FS Talk 알림 발송기 (Google Apps Script 웹앱)
 * 앱이 메시지를 저장한 뒤 이 웹앱을 호출 → 보낸 사람 확인 → 방 참여자의 기기로 FCM 알림 발송
 *
 * 스크립트 속성(프로젝트 설정 → 스크립트 속성)에 넣을 값 — 코드나 GitHub에 절대 넣지 말 것
 *   SA_JSON     : Firebase 서비스 계정 키 JSON 파일 내용 전체
 *   API_KEY     : 웹앱 apiKey (AIza...)
 *   PROJECT_ID  : fs-talk-fa383
 *   DB_URL      : https://fs-talk-fa383-default-rtdb.asia-southeast1.firebasedatabase.app
 */
const APP_URL = 'https://balhm12.github.io/fs-talk/';
const ROOM_NAME = {all:'전체방',notice:'전체공지',ts:'FS',cs:'CS',west:'FS WEST',east:'FS EAST',central:'FS CENTRAL',daejeon:'대전 사무소',gwangju:'광주 사무소',south:'FS SOUTH',busan:'부산 사무소',daegu:'대구 사무소',fss:'FSS Team',fsom:'FSOM Team'};
const ROOM_SCOPE = {west:['FS WEST'],east:['FS EAST'],central:['FS CENTRAL'],daejeon:['FS CENTRAL','대전'],gwangju:['FS CENTRAL','광주'],south:['FS SOUTH'],busan:['FS SOUTH','부산'],daegu:['FS SOUTH','대구'],fss:['FSS Team'],fsom:['FSOM Team']};

function P_(k){ return PropertiesService.getScriptProperties().getProperty(k); }
function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e){
  try{
    const req = JSON.parse(e.postData.contents);
    if(req.type === 'register') return out_(notifyRegister_(req));
    if(req.type === 'testAdmin') return out_(testAdmin_(req));
    if(req.type === 'pushStatus') return out_(pushStatus_(req));
    if(req.type === 'summary') return out_(summary_(req));
    if(req.type === 'upload') return out_(upload_(req));
    if(req.type === 'deleteFile') return out_(deleteFile_(req));
    if(req.type === 'remind') return out_(remind_(req));
    const room = String(req.room||''), msgId = String(req.msgId||'');
    const isDm = /^dm_[^\/.#$\[\]]+__[^\/.#$\[\]]+$/.test(room);
    const isGroup = /^g_[-\w]{10,40}$/.test(room);
    if((!ROOM_NAME[room] && !isDm && !isGroup) || !/^[-\w]{10,40}$/.test(msgId)) return out_({ok:false,err:'bad request',ver:NOTIFY_VER});
    const uid = verifyUser_(String(req.idToken||''));
    if(!uid) return out_({ok:false,err:'auth',ver:NOTIFY_VER});
    const msg = db_('talk/msgs/'+encodeURIComponent(room)+'/'+msgId);
    if(!msg || msg.uid !== uid) return out_({ok:false,err:'message',ver:NOTIFY_VER});
    // 같은 메시지로 두 번 보내지 않기
    const cache = CacheService.getScriptCache();
    if(cache.get('sent:'+msgId)) return out_({ok:true,dup:true,ver:NOTIFY_VER});
    cache.put('sent:'+msgId,'1',600);

    const users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {}, mute = db_('talk/mute') || {};
    const me = users[uid] || {};   // 보낸 사람의 다른 기기(같은 이름·팀)에는 보내지 않음
    const myKey = me.team + '_' + me.name;
    const dmKeys = isDm ? room.slice(3).split('__') : null;
    if(isDm && dmKeys.indexOf(myKey) < 0) return out_({ok:false,err:'dm',ver:NOTIFY_VER});
    const grp = isGroup ? (db_('talk/groups/'+room) || {}) : null;
    const gMembers = grp ? (grp.members || {}) : null;
    if(isGroup && !gMembers[myKey]) return out_({ok:false,err:'group',ver:NOTIFY_VER});
    const mentioned = (isDm || isGroup) ? {} : mentions_(String(msg.text||''), users);
    const sc = ROOM_SCOPE[room], targets = [];
    const groupName = grp ? (grp.name || '그룹 대화') : '';
    const roomLabel = isDm ? '1:1' : isGroup ? groupName : ROOM_NAME[room];
    // 왜 0대인지 알 수 있게 셈: 내 다른 기기 / 이 방 대상인 다른 사람 / 그중 알림 켠 기기 / 꺼 둔 기기
    const st = {myOther:0, people:{}, pushPeople:{}, noPush:{}, muted:0};
    Object.keys(users).forEach(function(id){
      const u = users[id];
      if(!u || u.status!=='approved' || id===uid) return;
      if(u.name===me.name && u.team===me.team){ st.myOther++; return; }
      const ment = !!mentioned[u.name];
      if(isDm){ if(dmKeys.indexOf(u.team + '_' + u.name) < 0) return; }
      else if(isGroup){ if(!gMembers[u.team + '_' + u.name]) return; }
      else if(!ment && sc && !(u.team===sc[0] && (!sc[1] || u.office===sc[1]))) return;
      const pk = u.team + '_' + u.name; st.people[pk] = true;
      const hasTok = Object.keys(tokens[id] || {}).some(function(k){ return tokens[id][k] && tokens[id][k].token; });
      if(!hasTok){ st.noPush[pk] = u.name; return; }
      st.pushPeople[pk] = true;
      if(mute[id] && mute[id]._all){ st.muted++; return; }  // 이 기기는 전체 알림 꺼짐 (멘션·1:1 포함)
      if(!ment && mute[id] && mute[id][room]){ st.muted++; return; }     // 멘션은 방 알림을 꺼 둬도 보냄
      const t = tokens[id] || {};
      Object.keys(t).forEach(function(k){ if(t[k] && t[k].token) targets.push({uid:id,key:k,token:t[k].token,
        title: ment ? '🔔 ' + (msg.name||'') + '님이 나를 언급 · ' + roomLabel : null}); });
    });
    const stats = {myOther:st.myOther, people:Object.keys(st.people).length, pushPeople:Object.keys(st.pushPeople).length, muted:st.muted,
      noPush:Object.keys(st.noPush).filter(function(k){ return !st.pushPeople[k]; }).map(function(k){ return st.noPush[k]; }).slice(0,30)};
    if(!targets.length) return out_({ok:true,sent:0,targets:0,stats:stats,ver:NOTIFY_VER});
    const isNotice = room === 'notice';
    const title = isDm ? '💬 ' + (msg.name||'') + ' (1:1)' : isGroup ? '👥 ' + groupName + ' · ' + (msg.name||'') : isNotice ? '📢 [공지] ' + (msg.name||'') : ROOM_NAME[room] + ' · ' + (msg.name||'');
    if(isNotice) targets.forEach(function(t){ t.title = null; });   // 공지는 멘션이 있어도 공지 제목으로
    let body = String(msg.text||'').replace(/\s+/g,' ');
    if(msg.file) body = (/^image\//.test(msg.file.mime||'') ? '📷 사진' : '📎 ' + (msg.file.name||'파일')) + (body ? ' ' + body : '');
    if(msg.re) body = '↪ ' + body;
    // 공지: 눌러서 확인할 때까지 화면에 남김(PC·안드로이드) + 진동을 길게
    const extra = isNotice ? {requireInteraction:true, vibrate:[200,100,200,100,500]} : null;
    const sent = send_(targets, title, body.slice(0,140), APP_URL + '#room-' + encodeURIComponent(room), 'room-' + room, {room:room}, extra);
    return out_({ok:true,sent:sent,targets:targets.length,stats:stats,ver:NOTIFY_VER});
  }catch(err){
    return out_({ok:false,err:String(err)});
  }
}

const NOTIFY_VER = 'v13';

/** 본문의 @이름 → 언급된 사람 이름 목록 (등록된 사용자 이름 중 긴 이름 우선) */
function mentions_(text, users){
  const names = {}; Object.keys(users).forEach(function(id){ const u = users[id]; if(u && u.name) names[u.name] = true; });
  const list = Object.keys(names).sort(function(a,b){ return b.length - a.length; });
  const out = {}; const re = /@([^\s@]+)/g; let m;
  while((m = re.exec(text))){ for(let i=0;i<list.length;i++){ if(m[1].indexOf(list[i]) === 0){ out[list[i]] = true; break; } } }
  return out;
}

/* ---------- 공지 다시 알림: 공지를 쓴 사람(같은 사람의 다른 기기 포함)이나 관리자만, 확인 안 한 사람에게만 ---------- */
function remind_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const msgId = String(req.msgId||'');
  if(!/^[-\w]{10,40}$/.test(msgId)) return {ok:false,err:'bad request',ver:NOTIFY_VER};
  const msg = db_('talk/msgs/notice/'+msgId);
  if(!msg) return {ok:false,err:'공지를 찾을 수 없습니다',ver:NOTIFY_VER};
  const users = db_('talk/users') || {}, me = users[uid] || {}, author = users[msg.uid] || {};
  if(me.status !== 'approved') return {ok:false,err:'승인된 사용자가 아닙니다',ver:NOTIFY_VER};
  const isAuthor = msg.uid === uid || (author.name === me.name && author.team === me.team);
  if(!isAuthor && db_('talk/admins/'+uid) !== true) return {ok:false,err:'공지를 쓴 사람이나 관리자만 보낼 수 있습니다',ver:NOTIFY_VER};
  const cache = CacheService.getScriptCache();
  if(cache.get('remind:'+msgId)) return {ok:false,err:'같은 공지는 30분에 한 번만 다시 알릴 수 있습니다',ver:NOTIFY_VER};
  const acks = db_('talk/acks/'+msgId) || {}, tokens = db_('talk/tokens') || {};
  const authorKey = (author.team||me.team) + '_' + (author.name||msg.name);
  const targets = [], people = {}, pushPeople = {};
  Object.keys(users).forEach(function(id){
    const u = users[id];
    if(!u || u.status !== 'approved') return;
    const pk = u.team + '_' + u.name;
    if(pk === authorKey || acks[pk]) return;     // 작성자·이미 확인한 사람 제외 (꼭 봐야 하는 공지라 방 알림을 꺼 둬도 보냄)
    people[pk] = true;
    const t = tokens[id] || {};
    Object.keys(t).forEach(function(k){ if(t[k] && t[k].token){ pushPeople[pk] = true; targets.push({uid:id,key:k,token:t[k].token}); } });
  });
  let body = String(msg.text||'').replace(/\s+/g,' ');
  if(msg.file) body = (/^image\//.test(msg.file.mime||'') ? '📷 사진' : '📎 ' + (msg.file.name||'파일')) + (body ? ' ' + body : '');
  const n = Object.keys(people).length, np = Object.keys(pushPeople).length;
  const sent = targets.length ? send_(targets, '📢 [공지·확인 요청] ' + (msg.name||''), ('눌러서 확인해 주세요 — ' + body).slice(0,140), APP_URL + '#room-notice', 'room-notice', {room:'notice'}, {requireInteraction:true, vibrate:[200,100,200,100,500]}) : 0;
  cache.put('remind:'+msgId, '1', 1800);
  return {ok:true, sent:sent, people:n, noPush:n - np, ver:NOTIFY_VER};
}

/* ---------- 사진·파일 첨부 → Google 드라이브 「FS Talk 첨부」/yyyy-MM ---------- */
const UPLOAD_FOLDER = 'FS Talk 첨부';
function upload_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const u = db_('talk/users/'+uid);
  if(!u || u.status !== 'approved') return {ok:false,err:'승인된 사용자가 아닙니다',ver:NOTIFY_VER};
  const data = String(req.data||'');
  if(!data) return {ok:false,err:'빈 파일',ver:NOTIFY_VER};
  const bytes = Utilities.base64Decode(data);
  if(bytes.length > 10*1024*1024) return {ok:false,err:'10MB를 넘습니다',ver:NOTIFY_VER};
  const name = String(req.name||'파일').replace(/[\\\/:*?"<>|]/g,'_').slice(0,200);
  const mime = String(req.mime||'application/octet-stream').slice(0,100);
  const month = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const f = subFolder_(rootFolder_(UPLOAD_FOLDER), month).createFile(Utilities.newBlob(bytes, mime, name));
  f.setDescription('FS Talk · ' + u.team + ' ' + u.name);
  try{ f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch(e){ f.setTrashed(true); return {ok:false,err:'드라이브 공유 설정 실패: '+e,ver:NOTIFY_VER}; }
  return {ok:true,id:f.getId(),ver:NOTIFY_VER};
}
/** 사진·파일 삭제 — 메시지를 쓴 본인(같은 사람의 다른 기기 포함)만, FS Talk 첨부 폴더의 파일만 휴지통으로 */
function deleteFile_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const room = String(req.room||''), msgId = String(req.msgId||'');
  if(!/^[-\w]{10,40}$/.test(msgId) || !(ROOM_NAME[room] || /^dm_[^\/.#$\[\]]+__[^\/.#$\[\]]+$/.test(room) || /^g_[-\w]{10,40}$/.test(room))) return {ok:false,err:'bad request',ver:NOTIFY_VER};
  const msg = db_('talk/msgs/'+encodeURIComponent(room)+'/'+msgId);
  if(!msg || !msg.file || !msg.file.id) return {ok:false,err:'첨부가 없는 메시지',ver:NOTIFY_VER};
  const me = db_('talk/users/'+uid) || {}, author = msg.uid === uid ? me : (db_('talk/users/'+msg.uid) || {});
  if(me.status !== 'approved' || !(msg.uid === uid || (author.name === me.name && author.team === me.team))) return {ok:false,err:'본인 글만 지울 수 있습니다',ver:NOTIFY_VER};
  let f;
  try{ f = DriveApp.getFileById(String(msg.file.id)); }catch(e){ return {ok:true,gone:true,ver:NOTIFY_VER}; }
  // 첨부 폴더(FS Talk 첨부/yyyy-MM) 안의 파일인지 확인 — 다른 드라이브 파일은 절대 건드리지 않음
  let inUpload = false;
  const ps = f.getParents();
  while(ps.hasNext() && !inUpload){ const pf = ps.next(); const gp = pf.getParents(); while(gp.hasNext()){ if(gp.next().getName() === UPLOAD_FOLDER){ inUpload = true; break; } } }
  if(!inUpload || String(f.getDescription()||'').indexOf('FS Talk · ') !== 0) return {ok:false,err:'FS Talk 첨부 파일이 아닙니다',ver:NOTIFY_VER};
  if(f.isTrashed()) return {ok:true,gone:true,ver:NOTIFY_VER};
  f.setTrashed(true);
  return {ok:true,ver:NOTIFY_VER};
}
/* ---------- AI 대화 요약 (Groq — 무료, 보낸 내용을 학습에 쓰지 않음) ----------
 * 스크립트 속성 GROQ_API_KEY 필요 (console.groq.com → API Keys). 선택: GROQ_MODEL
 * 요청한 사람이 그 방을 읽을 수 있는지 서버에서 다시 확인한 뒤, 서버가 직접 대화를 읽어 요약함 */
const FIXED_ROOMS = ['notice','ts','cs','west','east','central','daejeon','gwangju','south','busan','daegu','fss','fsom'];
function summary_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const key = P_('GROQ_API_KEY');
  if(!key) return {ok:false,err:'AI 요약이 아직 설정되지 않았습니다 (관리자: Apps Script 속성 GROQ_API_KEY)',ver:NOTIFY_VER};
  const me = db_('talk/users/'+uid) || {};
  if(me.status !== 'approved') return {ok:false,err:'승인된 사용자가 아닙니다',ver:NOTIFY_VER};
  const myKey = me.team + '_' + me.name;
  const room = String(req.room||'');
  const isDm = /^dm_[^\/.#$\[\]]+__[^\/.#$\[\]]+$/.test(room), isGroup = /^g_[-\w]{10,40}$/.test(room);
  if(!(ROOM_NAME[room] || isDm || isGroup)) return {ok:false,err:'bad request',ver:NOTIFY_VER};
  if(isDm && room.slice(3).split('__').indexOf(myKey) < 0) return {ok:false,err:'이 방을 볼 수 없습니다',ver:NOTIFY_VER};
  let label = isDm ? '1:1 대화' : ROOM_NAME[room];
  if(isGroup){ const gr = db_('talk/groups/'+room) || {}; if(!(gr.members||{})[myKey]) return {ok:false,err:'이 방을 볼 수 없습니다',ver:NOTIFY_VER}; label = gr.name || '그룹 대화'; }
  // 너무 잦은 요청 막기 (한 사람당 15초)
  const cache = CacheService.getScriptCache();
  if(cache.get('sum:'+uid)) return {ok:false,err:'잠시 후 다시 눌러 주세요',ver:NOTIFY_VER};
  cache.put('sum:'+uid,'1',15);
  const since = Math.max(0, +req.since || 0), limit = Math.min(300, Math.max(10, +req.limit || 150));
  const rooms = room === 'all' ? ['all','ts','cs'] : [room];   // 전체방 = 전체방 글 + FS + CS
  let msgs = [];
  rooms.forEach(function(r){
    const q = 'orderBy=%22ts%22' + (since ? '&startAt=' + (since+1) : '') + '&limitToLast=' + limit;
    const v = dbQuery_('talk/msgs/'+encodeURIComponent(r), q) || {};
    Object.keys(v).forEach(function(k){ const m = v[k]; if(m && typeof m.text === 'string') msgs.push({r:r,ts:+m.ts||0,name:m.name||'',text:m.text,file:m.file,re:m.re}); });
  });
  msgs.sort(function(a,b){ return a.ts-b.ts; });
  msgs = msgs.slice(-limit);
  if(!msgs.length) return {ok:true,count:0,summary:'',ver:NOTIFY_VER};
  const fmt = function(ts){ return Utilities.formatDate(new Date(ts),'Asia/Seoul','MM-dd HH:mm'); };
  let lines = msgs.map(function(m){
    let t = String(m.text||'').replace(/\s+/g,' ');
    if(m.file) t = (/^image\//.test(m.file.mime||'') ? '[사진]' : '[파일 '+(m.file.name||'')+']') + (t ? ' ' + t : '');
    if(m.re) t = '(↪'+(m.re.name||'')+'에게 답장) ' + t;
    return '['+fmt(m.ts)+(room==='all'&&m.r!=='all'?' '+(ROOM_NAME[m.r]||m.r):'')+'] '+m.name+': '+t.slice(0,600);
  });
  // 무료 등급 한도에 맞게 최근 글 위주로 약 9,000자까지만
  let text = '', used = 0;
  for(let i=lines.length-1;i>=0;i--){ if(text.length + lines[i].length > 9000) break; text = lines[i] + '\n' + text; used++; }
  const sys = '너는 Sysmex Korea 필드서비스 조직(FSG)의 사내 메신저 대화를 요약하는 도우미다. 반드시 한국어로, 대화에 실제로 나온 내용만 쓴다. 추측하거나 없는 사실을 만들지 않는다. 장비 모델명·에러 코드·부품명·병원명·숫자는 원문 그대로 쓴다.';
  const ask = '아래는 「'+label+'」 방의 대화 '+used+'건이다. 다음 형식으로 짧게 요약해라. 해당 내용이 없는 항목은 통째로 생략한다.\n'+
    '■ 한눈에 보기: 2~4줄\n■ 결정·합의된 것: 글머리표\n■ 할 일: 「담당자 – 할 일 (기한)」 글머리표\n■ 장비·에러·부품 이슈: 「장비/에러 – 조치·상태」 글머리표\n■ 확인이 필요한 질문: 답이 아직 없는 질문\n\n대화:\n'+text;
  const models = [P_('GROQ_MODEL') || 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
  let last = '';
  for(let i=0;i<models.length;i++){
    const r = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions',{method:'post',contentType:'application/json',muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+key},
      payload:JSON.stringify({model:models[i],temperature:0.2,max_tokens:1200,messages:[{role:'system',content:sys},{role:'user',content:ask}]})});
    const c = r.getResponseCode(), body = r.getContentText();
    if(c === 200){
      const j = JSON.parse(body); const out = j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content||'').trim() : '';
      if(out) return {ok:true,summary:out,count:used,total:msgs.length,model:models[i],ver:NOTIFY_VER};
    }
    last = c + ' ' + body.slice(0,160);
    if(c === 429) return {ok:false,err:'오늘 무료 사용량을 다 썼거나 요청이 몰렸습니다. 잠시 후 다시 시도하세요.',ver:NOTIFY_VER};
  }
  return {ok:false,err:'AI 응답 실패: '+last,ver:NOTIFY_VER};
}
function dbQuery_(path, query){
  const r = UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json?'+query+'&access_token='+accessToken_(),{muteHttpExceptions:true});
  if(r.getResponseCode()!==200) throw new Error('DB 읽기 실패 '+r.getResponseCode()+' '+r.getContentText().slice(0,200));
  return JSON.parse(r.getContentText());
}

function rootFolder_(n){ const it = DriveApp.getFoldersByName(n); return it.hasNext() ? it.next() : DriveApp.createFolder(n); }
function subFolder_(parent, n){ const it = parent.getFoldersByName(n); return it.hasNext() ? it.next() : parent.createFolder(n); }

/** 관리자 기기 목록 — 관리자로 지정된 기기 + 그 사람(같은 이름·팀)의 다른 기기 전부 */
function adminTargets_(){
  const admins = db_('talk/admins') || {}, users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {};
  const people = {};
  Object.keys(admins).forEach(function(id){ if(admins[id] === true && users[id]) people[users[id].team + '_' + users[id].name] = true; });
  const ids = Object.keys(users).filter(function(id){
    const u = users[id];
    return (admins[id] === true) || (u && u.status === 'approved' && people[u.team + '_' + u.name]);
  });
  const targets = [];
  ids.forEach(function(id){
    const t = tokens[id] || {};
    Object.keys(t).forEach(function(k){ if(t[k] && t[k].token) targets.push({uid:id,key:k,token:t[k].token}); });
  });
  return {targets:targets, devices:ids.length, people:Object.keys(people).length};
}

/** 등록 요청 → 관리자 기기로 알림 */
function notifyRegister_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const u = db_('talk/users/'+uid);
  if(!u || u.status !== 'pending') return {ok:false,err:'not pending',ver:NOTIFY_VER};
  const cache = CacheService.getScriptCache();
  if(cache.get('reg:'+uid)) return {ok:true,dup:true,ver:NOTIFY_VER};     // 10분 안 중복 요청은 한 번만
  cache.put('reg:'+uid,'1',600);
  const a = adminTargets_();
  const dev = /iPhone|iPad/.test(u.ua||'') ? 'iPhone' : /Android/.test(u.ua||'') ? 'Android' : 'PC';
  const sent = send_(a.targets, '👥 등록 요청', u.name + ' · ' + u.team + (u.office ? ' ' + u.office : '') + ' · ' + dev + ' — 승인이 필요합니다', APP_URL + '#admin', 'admin-register', {room:''});
  return {ok:true,sent:sent,targets:a.targets.length,ver:NOTIFY_VER};
}

/** 관리 화면: 기기별 알림 켬 여부 — 관리자만 */
function pushStatus_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  if(db_('talk/admins/'+uid) !== true) return {ok:false,err:'관리자가 아님',ver:NOTIFY_VER};
  const tokens = db_('talk/tokens') || {}, out = {};
  Object.keys(tokens).forEach(function(id){ const n = Object.keys(tokens[id]||{}).filter(function(k){ return tokens[id][k] && tokens[id][k].token; }).length; if(n) out[id] = n; });
  return {ok:true,push:out,ver:NOTIFY_VER};
}

/** 관리 화면의 「등록 알림 테스트」 — 관리자만 */
function testAdmin_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  if((db_('talk/admins/'+uid)) !== true) return {ok:false,err:'관리자가 아님',ver:NOTIFY_VER};
  const a = adminTargets_();
  const sent = send_(a.targets, '🔔 등록 알림 테스트', '이 알림이 보이면 등록 요청 알림도 이 기기로 옵니다.', APP_URL + '#admin', 'admin-test', {room:''});
  return {ok:true,sent:sent,targets:a.targets.length,devices:a.devices,people:a.people,ver:NOTIFY_VER};
}

/** FCM 발송 공통 (쓸 수 없는 토큰은 정리) */
function send_(targets, title, body, link, tag, data, extra){
  if(!targets.length) return 0;
  const at = accessToken_();
  const reqs = targets.map(function(t){ return {
    url:'https://fcm.googleapis.com/v1/projects/'+P_('PROJECT_ID')+'/messages:send',
    method:'post', contentType:'application/json', muteHttpExceptions:true,
    headers:{Authorization:'Bearer '+at},
    payload:JSON.stringify({message:{token:t.token,data:data||{},
      webpush:{notification:Object.assign({title:t.title||title,body:body,icon:APP_URL+'icons/icon-192.png',tag:tag,renotify:true}, extra||{}),fcm_options:{link:link}}}})
  };});
  let sent = 0;
  UrlFetchApp.fetchAll(reqs).forEach(function(r,i){
    const c = r.getResponseCode();
    if(c===200){ sent++; return; }
    if(c===404 || /UNREGISTERED/.test(r.getContentText())) dbDelete_('talk/tokens/'+targets[i].uid+'/'+targets[i].key);
  });
  return sent;
}

function doGet(){ return out_({ok:true,app:'FS Talk notify',ver:NOTIFY_VER}); }

/** Firebase 로그인 토큰 확인 → uid */
function verifyUser_(idToken){
  if(!idToken) return null;
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+P_('API_KEY'),
    {method:'post',contentType:'application/json',payload:JSON.stringify({idToken:idToken}),muteHttpExceptions:true});
  if(r.getResponseCode()!==200) return null;
  const j = JSON.parse(r.getContentText());
  return j.users && j.users[0] ? j.users[0].localId : null;
}

/** 서비스 계정으로 OAuth 토큰 발급 (50분 캐시) */
function accessToken_(){
  const cache = CacheService.getScriptCache();
  const hit = cache.get('at'); if(hit) return hit;
  const sa = JSON.parse(P_('SA_JSON'));
  const now = Math.floor(Date.now()/1000);
  const enc = function(o){ return Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/,''); };
  const head = enc({alg:'RS256',typ:'JWT'});
  const claim = enc({iss:sa.client_email,
    scope:'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(head+'.'+claim, sa.private_key)).replace(/=+$/,'');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token',{method:'post',
    payload:{grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+claim+'.'+sig}});
  const at = JSON.parse(r.getContentText()).access_token;
  cache.put('at',at,3000);
  return at;
}

function db_(path){
  const r = UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json?access_token='+accessToken_(),{muteHttpExceptions:true});
  if(r.getResponseCode()!==200) throw new Error('DB 읽기 실패 '+r.getResponseCode()+' '+r.getContentText().slice(0,200));
  return JSON.parse(r.getContentText());
}
function dbDelete_(path){
  UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json?access_token='+accessToken_(),{method:'delete',muteHttpExceptions:true});
}

/** 설치 확인용: 편집기에서 한 번 실행 → 권한 승인 + 설정 점검 (실행 로그 확인) */
function setupCheck(){
  ['SA_JSON','API_KEY','PROJECT_ID','DB_URL','GROQ_API_KEY'].forEach(function(k){ Logger.log(k+': '+(P_(k)?'있음':(k==='GROQ_API_KEY'?'없음 (AI 요약 안 씀)':'❌ 없음'))); });
  const users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {};
  Logger.log('등록 사용자: '+Object.keys(users).length+'명 · 알림 켠 사용자: '+Object.keys(tokens).length+'명');
  Logger.log('✅ 서비스 계정 인증과 DB 읽기 성공');
}

/* =====================================================================
 * 매일 자동 백업 (Google 드라이브 「FS Talk 백업」 폴더, 30일 보관)
 *  - installBackupTrigger() 를 편집기에서 한 번 실행하면 매일 새벽 3시대에 backupDaily() 가 돌아감
 *  - 알림 기기 정보(tokens)는 백업하지 않음
 * ===================================================================== */
const BACKUP_FOLDER = 'FS Talk 백업';
const BACKUP_KEEP_DAYS = 30;

function backupDaily(){
  const talk = db_('talk') || {};
  delete talk.tokens;
  const folder = backupFolder_();
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const name = 'fs-talk-backup-' + day + '.json';
  const old = folder.getFilesByName(name);
  while(old.hasNext()) old.next().setTrashed(true);          // 같은 날 다시 돌리면 덮어쓰기
  folder.createFile(name, JSON.stringify(talk), 'application/json');
  // 오래된 백업 정리
  const limit = Date.now() - BACKUP_KEEP_DAYS*864e5;
  const it = folder.getFiles();
  while(it.hasNext()){ const f = it.next(); if(/^fs-talk-backup-/.test(f.getName()) && f.getDateCreated().getTime() < limit) f.setTrashed(true); }
  let n = 0; Object.keys(talk.msgs||{}).forEach(function(r){ n += Object.keys(talk.msgs[r]||{}).length; });
  Logger.log('✅ 백업 완료: ' + name + ' · 메시지 ' + n + '건 · 사용자 ' + Object.keys(talk.users||{}).length + '대');
}

function installBackupTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='backupDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupDaily').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Seoul').create();
  backupDaily();
  Logger.log('✅ 매일 새벽 3시대 자동 백업을 예약했습니다. (지금 1회 실행함)');
}

function backupFolder_(){
  const it = DriveApp.getFoldersByName(BACKUP_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
}

/**
 * 복구 — 지워진 것만 되살림 (지금 있는 메시지·사용자·명단은 절대 덮어쓰지 않음)
 * 사용법: 아래 RESTORE_DATE 를 복구할 날짜로 바꾸고 restoreMissing 실행
 */
const RESTORE_DATE = '2026-10-28';
function restoreMissing(){
  const it = backupFolder_().getFilesByName('fs-talk-backup-' + RESTORE_DATE + '.json');
  if(!it.hasNext()) throw new Error(RESTORE_DATE + ' 백업 파일이 없습니다.');
  const bak = JSON.parse(it.next().getBlob().getDataAsString());
  const now = db_('talk') || {};
  let added = 0;
  ['msgs','users','roster','admins','mute','profiles','reacts','pins','dms','prefs','groups','gidx'].forEach(function(sec){
    const b = bak[sec] || {}, c = now[sec] || {};
    Object.keys(b).forEach(function(k1){
      const bv = b[k1], cv = c[k1];
      if(cv === undefined || cv === null){ dbPut_('talk/'+sec+'/'+encodeURIComponent(k1), bv); added++; return; }
      if(bv && typeof bv === 'object' && cv && typeof cv === 'object'){
        const miss = {};
        Object.keys(bv).forEach(function(k2){ if(cv[k2] === undefined) miss[k2] = bv[k2]; });
        if(Object.keys(miss).length){ dbPatch_('talk/'+sec+'/'+encodeURIComponent(k1), miss); added += Object.keys(miss).length; }
      }
    });
  });
  Logger.log('✅ 복구 완료: 없던 항목 ' + added + '개를 되살렸습니다. (기존 내용은 그대로)');
}
function dbPut_(path, val){
  UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json?access_token='+accessToken_(),{method:'put',contentType:'application/json',payload:JSON.stringify(val)});
}
function dbPatch_(path, val){
  UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json?access_token='+accessToken_(),{method:'patch',contentType:'application/json',payload:JSON.stringify(val)});
}
