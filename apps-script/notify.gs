// ⚠ 이 파일은 GitHub(balhm12/fs-talk) apps-script/notify.gs 가 원본입니다. main 에 올라가면 GitHub Actions가 자동으로 붙여 넣고 새 버전으로 배포합니다.
//   편집기에서 직접 고치면 다음 자동 배포 때 덮어써집니다 — 고칠 내용은 저장소에서 고치세요.
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
    if(req.type === 'voice') return out_(voice_(req));
    if(req.type === 'link') return out_(link_(req));
    const room = String(req.room||''), msgId = String(req.msgId||'');
    const isDm = /^dm_[^\/.#$\[\]]+__[^\/.#$\[\]]+$/.test(room);
    const isGroup = /^g_[-\w]{10,40}$/.test(room);
    if((!ROOM_NAME[room] && !isDm && !isGroup) || !/^[-\w]{10,40}$/.test(msgId)) return out_({ok:false,err:'bad request',ver:NOTIFY_VER});
    const uid = verifyUser_(String(req.idToken||''));
    if(!uid) return out_({ok:false,err:'auth',ver:NOTIFY_VER});
    const msg = db_('talk/msgs/'+encodeURIComponent(room)+'/'+msgId);
    if(!msg || msg.uid !== uid) return out_({ok:false,err:'message',ver:NOTIFY_VER});
    // 예전 글로 알림을 다시 보내지 못하게: 방금(5분 안) 쓴 글만
    if(!(+msg.ts > Date.now() - 5*60*1000)) return out_({ok:false,err:'old message',ver:NOTIFY_VER});
    // 같은 메시지로 두 번 보내지 않기 (보내기에 성공한 뒤에 표시 — 중간에 실패하면 다시 보낼 수 있게)
    const cache = CacheService.getScriptCache();
    if(cache.get('sent:'+msgId)) return out_({ok:true,dup:true,ver:NOTIFY_VER});
    const lock = LockService.getScriptLock(); try{ lock.waitLock(5000); }catch(e){}
    if(cache.get('sent:'+msgId)){ try{lock.releaseLock();}catch(e){} return out_({ok:true,dup:true,ver:NOTIFY_VER}); }
    cache.put('sent:'+msgId,'1',600); try{ lock.releaseLock(); }catch(e){}

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
    let sent = 0;
    try{ sent = send_(targets, title, body.slice(0,140), APP_URL + '#room-' + encodeURIComponent(room), 'room-' + room, {room:room}, extra); }
    catch(e){ cache.remove('sent:'+msgId); throw e; }
    return out_({ok:true,sent:sent,targets:targets.length,stats:stats,ver:NOTIFY_VER});
  }catch(err){
    console.error(err);   // 자세한 내용은 Apps Script 실행 기록에만 (응답에 토큰 등이 섞이지 않게)
    return out_({ok:false,err:'서버 오류 — 잠시 뒤 다시 시도해 주세요',ver:NOTIFY_VER});
  }
}

const NOTIFY_VER = 'v17';

/** 본문의 @이름 → 언급된 사람 이름 목록 (등록된 사용자 이름 중 긴 이름 우선) */
function mentions_(text, users){
  const names = {}; Object.keys(users).forEach(function(id){ const u = users[id]; if(u && u.name) names[u.name] = true; });
  const list = Object.keys(names).sort(function(a,b){ return b.length - a.length; });
  const out = {}; const re = /@([^\s@]+)/g; let m;
  while((m = re.exec(text))){ for(let i=0;i<list.length;i++){ if(m[1].indexOf(list[i]) === 0){ out[list[i]] = true; break; } } }
  return out;
}

/* ---------- 기기 연결: 쓰던 기기에서 만든 6자리 코드로, 새 브라우저·앱을 같은 사람으로 바로 승인 ----------
 * (카톡 링크로 열린 브라우저·사파리·새 PC처럼 저장 공간이 다른 곳에서 다시 등록·승인받지 않게)
 * 코드는 talk/linkcodes/{코드} = {p:팀_이름, uid:만든 기기, exp:만료시각} — 5분, 한 번만 */
function link_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const code = String(req.code||'').replace(/\D/g,'');
  if(!/^\d{6}$/.test(code)) return {ok:false,err:'6자리 숫자 코드를 넣어 주세요',ver:NOTIFY_VER};
  // 무작위로 맞혀 보기 막기: 이 기기 10분에 5번, 전체 10분에 60번
  const cache = CacheService.getScriptCache(), k1 = 'lnk:'+uid, n1 = +(cache.get(k1)||0), n2 = +(cache.get('lnk:all')||0);
  if(n1 >= 5 || n2 >= 60) return {ok:false,err:'시도가 너무 많습니다. 10분 뒤 다시 해 주세요',ver:NOTIFY_VER};
  cache.put(k1, String(n1+1), 600); cache.put('lnk:all', String(n2+1), 600);
  const lc = db_('talk/linkcodes/'+code);
  if(!lc || !(+lc.exp > Date.now()) || +lc.exp > Date.now() + 10*60*1000) return {ok:false,err:'코드가 맞지 않거나 시간이 지났습니다. 쓰던 기기에서 새 코드를 만들어 주세요',ver:NOTIFY_VER};
  const src = db_('talk/users/'+String(lc.uid||'')) || {};
  if(src.status !== 'approved' || (src.team + '_' + src.name) !== String(lc.p||'')) return {ok:false,err:'코드를 만든 기기가 승인 상태가 아닙니다',ver:NOTIFY_VER};
  const cur = db_('talk/users/'+uid);
  if(cur && cur.status === 'approved' && !(cur.team === src.team && cur.name === src.name)) return {ok:false,err:'이 기기는 이미 다른 사람으로 승인되어 있습니다',ver:NOTIFY_VER};
  const now = Date.now();
  const rec = {name:src.name, team:src.team, status:'approved', createdAt:now, approvedAt:now, ua:String(req.ua||'').slice(0,200)};
  if(src.office) rec.office = src.office;
  dbPut_('talk/users/'+uid, rec);
  dbDelete_('talk/linkcodes/'+code);   // 한 번 쓰면 끝
  return {ok:true,name:src.name,team:src.team,ver:NOTIFY_VER};
}

/* ---------- 말로 보내기: 음성 → 글자(Groq Whisper) → (명령이면) 보낼 방·내용 나누기(Groq) ----------
 * 스크립트 속성 GROQ_API_KEY (AI 요약과 같은 키). 음성 파일은 저장하지 않고 바로 버림.
 * mode 'dictate': 받아쓰기만 / 'command': 「○○방에 ~라고 보내줘」 → {room, message} */
function voice_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const key = P_('GROQ_API_KEY');
  if(!key) return {ok:false,err:'음성 기능이 아직 설정되지 않았습니다 (관리자: Apps Script 속성 GROQ_API_KEY)',ver:NOTIFY_VER};
  const me = db_('talk/users/'+uid) || {};
  if(me.status !== 'approved') return {ok:false,err:'승인된 사용자가 아닙니다',ver:NOTIFY_VER};
  // 한 사람당 1시간 60번까지 (무료 한도 보호)
  const cache = CacheService.getScriptCache(), ck = 'voice:'+me.team+'_'+me.name, n = +(cache.get(ck)||0);
  if(n >= 60) return {ok:false,err:'1시간에 쓸 수 있는 음성 횟수를 넘었습니다. 잠시 뒤 다시 해 주세요',ver:NOTIFY_VER};
  cache.put(ck, String(n+1), 3600);
  const data = String(req.data||'');
  if(!data || data.length > 4*1024*1024) return {ok:false,err:'녹음이 비었거나 너무 깁니다 (30초 이내)',ver:NOTIFY_VER};
  const mime = /^audio\/[\w.+-]+/.exec(String(req.mime||''));
  const mt = mime ? mime[0] : 'audio/webm';
  const ext = /mp4|m4a|aac/.test(mt) ? 'm4a' : /ogg/.test(mt) ? 'ogg' : /wav/.test(mt) ? 'wav' : /mpeg|mp3/.test(mt) ? 'mp3' : 'webm';
  const rooms = (Array.isArray(req.rooms) ? req.rooms : []).map(function(x){ return String(x).replace(/[\r\n]+/g,' ').slice(0,40); }).filter(String).slice(0,200);
  // 1) 받아쓰기 — 방 이름·장비 용어를 힌트로 주면 더 정확함
  const hint = ('FS 포털(사내 메신저·업무 포털). 방: ' + rooms.slice(0,40).join(', ') + '. 장비: XN, XN-L, UF, UC, SP-50, CN, HISCL, CS-1600, CA-620.').slice(0,600);
  const blob = Utilities.newBlob(Utilities.base64Decode(data), mt, 'voice.'+ext);
  const tr = UrlFetchApp.fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'post',muteHttpExceptions:true,
    headers:{Authorization:'Bearer '+key},
    payload:{file:blob, model:'whisper-large-v3-turbo', language:'ko', response_format:'json', temperature:'0', prompt:hint}});
  const tc = tr.getResponseCode();
  if(tc === 429) return {ok:false,err:'요청이 몰렸습니다. 잠시 후 다시 해 주세요',ver:NOTIFY_VER};
  if(tc !== 200){ console.error('whisper '+tc+' '+tr.getContentText().slice(0,300)); return {ok:false,err:'음성을 글자로 바꾸지 못했습니다',ver:NOTIFY_VER}; }
  const text = String((JSON.parse(tr.getContentText())||{}).text||'').trim();
  if(!text) return {ok:false,err:'말소리를 알아듣지 못했습니다. 조금 더 크게 다시 말해 주세요',ver:NOTIFY_VER};
  if(req.mode !== 'command' || !rooms.length) return {ok:true,text:text,ver:NOTIFY_VER};
  // 2) 보낼 방·내용 나누기
  const sys = '너는 사내 메신저의 음성 명령을 해석한다. 사용자가 말한 문장에서 메시지를 보낼 대화방과 보낼 내용을 나눈다. '+
    '방은 반드시 아래 목록에 있는 이름 중 하나를 그대로 고르고, 알 수 없으면 빈 문자열로 둔다. 사람 이름만 말하면 그 사람과의 1:1 방이다. '+
    '보낼 내용에서는 「○○방에」「~라고 보내줘」「~라고 전해줘」 같은 명령 부분만 빼고, 나머지는 사용자가 한 말 그대로 둔다(내용을 바꾸거나 덧붙이지 말 것, 띄어쓰기·문장부호만 정리). '+
    '결과는 JSON 하나만: {"room":"방 이름","message":"보낼 내용"}';
  const ask = '방 목록:\n' + rooms.map(function(r,i){ return (i+1)+'. '+r; }).join('\n') + '\n\n사용자가 한 말: ' + text;
  const models = [P_('GROQ_MODEL') || 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
  for(let i=0;i<models.length;i++){
    const r = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions',{method:'post',contentType:'application/json',muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+key},
      payload:JSON.stringify({model:models[i],temperature:0,max_tokens:400,response_format:{type:'json_object'},messages:[{role:'system',content:sys},{role:'user',content:ask}]})});
    if(r.getResponseCode() !== 200) continue;
    try{
      const j = JSON.parse(r.getContentText()); const o = JSON.parse(j.choices[0].message.content);
      const room = rooms.indexOf(String(o.room||'')) >= 0 ? String(o.room) : '';
      return {ok:true,text:text,room:room,message:String(o.message||text).slice(0,2000),ver:NOTIFY_VER};
    }catch(e){}
  }
  return {ok:true,text:text,room:'',message:text,ver:NOTIFY_VER};   // 해석이 안 되면 받아쓴 글만 돌려줌 (방은 사용자가 고름)
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
  // 한 사람이 드라이브 용량을 다 쓰지 않게: 1시간에 40개·200MB까지
  const uc = CacheService.getScriptCache(), uk = 'up:'+u.team+'_'+u.name, ust = JSON.parse(uc.get(uk)||'{"n":0,"b":0}');
  if(ust.n >= 40 || ust.b >= 200*1024*1024) return {ok:false,err:'1시간에 보낼 수 있는 첨부를 넘었습니다. 잠시 뒤 다시 보내 주세요',ver:NOTIFY_VER};
  const data = String(req.data||'');
  if(!data) return {ok:false,err:'빈 파일',ver:NOTIFY_VER};
  const bytes = Utilities.base64Decode(data);
  if(bytes.length > 10*1024*1024) return {ok:false,err:'10MB를 넘습니다',ver:NOTIFY_VER};
  const name = String(req.name||'파일').replace(/[\\\/:*?"<>|]/g,'_').slice(0,200);
  const mime = String(req.mime||'application/octet-stream').slice(0,100);
  const month = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const f = subFolder_(rootFolder_(UPLOAD_FOLDER), month).createFile(Utilities.newBlob(bytes, mime, name));
  uc.put(uk, JSON.stringify({n:ust.n+1, b:ust.b+bytes.length}), 3600);
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
  // 올린 사람 본인 파일만 (업로드 때 적어 둔 「FS Talk · 팀 이름」으로 확인 — 남의 파일 id를 내 글에 넣어 지우는 것을 막음)
  if(String(f.getDescription()) !== 'FS Talk · ' + me.team + ' ' + me.name) return {ok:false,err:'내가 올린 파일만 지울 수 있습니다',ver:NOTIFY_VER};
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
  const r = UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json?'+query,{headers:{Authorization:'Bearer '+accessToken_()},muteHttpExceptions:true});
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
  const rc = +(cache.get('reg:count')||0);                                   // 전체 합쳐 1시간에 20번까지만 관리자에게 알림 (장난 방지)
  if(rc >= 20) return {ok:true,limited:true,ver:NOTIFY_VER};
  cache.put('reg:count', String(rc+1), 3600);
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
  const r = UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json',{headers:{Authorization:'Bearer '+accessToken_()},muteHttpExceptions:true});
  if(r.getResponseCode()!==200) throw new Error('DB 읽기 실패 '+r.getResponseCode()+' '+r.getContentText().slice(0,200));
  return JSON.parse(r.getContentText());
}
function dbDelete_(path){
  UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json',{method:'delete',headers:{Authorization:'Bearer '+accessToken_()},muteHttpExceptions:true});
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
  // 관리자 지정·사용자 승인 상태는 되살리지 않음 (백업 뒤 해제·중지한 권한이 돌아오지 않게)
  ['msgs','roster','mute','profiles','reacts','pins','dms','prefs','groups','gidx'].forEach(function(sec){
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
  UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json',{method:'put',headers:{Authorization:'Bearer '+accessToken_()},contentType:'application/json',payload:JSON.stringify(val)});
}
function dbPatch_(path, val){
  UrlFetchApp.fetch(P_('DB_URL')+'/'+path+'.json',{method:'patch',headers:{Authorization:'Bearer '+accessToken_()},contentType:'application/json',payload:JSON.stringify(val)});
}

/* ===== v17: 아침 근무 알림 — 설치·근무일정표(sysmex-system-schedule)를 「읽기만」 해서
   오늘 내 근무(석간·석/야·당직·교육)나 내일 당직·야간이 있는 사람에게만 아침에 한 번 푸시.
   일정표 DB는 익명 인증으로 읽는다(그 저장소에 공개된 웹 API 키). 일정표에는 아무것도 쓰지 않는다.
   설치: installDigestTrigger() 한 번 실행 → 매일 아침 7시대. 끄기: removeDigestTrigger().
   사람별로 끄기: 앱 설정의 「아침 근무 알림」(talk/prefs/{팀_이름}/digest = false). */
const SCH_DB = 'https://sysmex-system-schedule-default-rtdb.firebaseio.com';
const SCH_KEY = 'AIzaSyANZEYTXeDy3M1TV_rIG9Rp3m1TJk3MEy8';
const SCH_TEAMS = ['west','east','central','south','fss','fsom'];
function schToken_(){
  const c = CacheService.getScriptCache(), t = c.get('schTok');
  if(t) return t;
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+SCH_KEY,{method:'post',contentType:'application/json',payload:JSON.stringify({returnSecureToken:true}),muteHttpExceptions:true});
  if(r.getResponseCode()!==200) throw new Error('일정표 인증 실패 '+r.getResponseCode());
  const id = JSON.parse(r.getContentText()).idToken; c.put('schTok', id, 3000); return id;
}
function schGet_(path){
  const r = UrlFetchApp.fetch(SCH_DB+'/'+path+'.json?auth='+encodeURIComponent(schToken_()),{muteHttpExceptions:true});
  if(r.getResponseCode()!==200) throw new Error('일정표 '+path+' '+r.getResponseCode());
  return JSON.parse(r.getContentText());
}
function schKey_(v){ return String(v||'').split(':')[0].trim(); }
/** 그날 사람별 근무 → {이름:[문구…]} */
function schDay_(day){
  const out = {};
  const add = function(nm, s){ (out[nm] = out[nm] || []).push(s); };
  SCH_TEAMS.forEach(function(t){
    let w = {}; try{ w = schGet_('work-schedule/'+t+'/'+day) || {}; }catch(e){ console.error(e); }
    Object.keys(w).forEach(function(nm){
      const e = w[nm]; if(!e || typeof e !== 'object') return;
      const n = schKey_(e.night); if(n && n!=='OFF' && n!=='잔업') add(nm, n);
      const wk = schKey_(e.weekend); if(wk) add(nm, wk==='전화' ? '전화대기' : wk);
      const sl = ['am1','am2','pm1','pm2'].map(function(k){ return schKey_(e[k]); });
      if(sl.indexOf('휴가')>=0) add(nm,'휴가'); else if(sl.indexOf('오전휴가')>=0) add(nm,'오전휴가'); else if(sl.indexOf('오후휴가')>=0) add(nm,'오후휴가');
      else if(sl.indexOf('교육')>=0) add(nm,'교육');
    });
  });
  return out;
}
function morningDigest(){
  const tz = 'Asia/Seoul', now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd'), tom = Utilities.formatDate(new Date(now.getTime()+864e5), tz, 'yyyy-MM-dd');
  const D0 = schDay_(today), D1 = schDay_(tom);
  const users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {}, mute = db_('talk/mute') || {}, prefs = db_('talk/prefs') || {};
  const tmd = new Date(now.getTime()+864e5), tl = Utilities.formatDate(tmd, tz, 'M/d') + '(' + '월화수목금토일'.charAt(+Utilities.formatDate(tmd, tz, 'u') - 1) + ')';
  const LEAVE = ['휴가','오전휴가','오후휴가'];
  let people = 0, sent = 0; const done = {};
  Object.keys(users).forEach(function(id){
    const u = users[id]; if(!u || u.status !== 'approved') return;
    const pk = u.team + '_' + u.name;
    const a = (D0[u.name] || []).filter(function(x){ return LEAVE.indexOf(x) < 0; });                 // 쉬는 날엔 알림 안 보냄
    const b = (D1[u.name] || []).filter(function(x){ return LEAVE.indexOf(x) < 0 && x !== '교육'; });   // 내일은 당직·야간만 미리
    if(!a.length && !b.length) return;
    if(prefs[pk] && prefs[pk].digest === false) return;
    if(mute[id] && mute[id]._all) return;
    const t = tokens[id] || {}, targets = [];
    Object.keys(t).forEach(function(k){ if(t[k] && t[k].token) targets.push({uid:id,key:k,token:t[k].token}); });
    if(!targets.length) return;
    if(!done[pk]){ done[pk] = true; people++; }
    const parts = []; if(a.length) parts.push('오늘 ' + a.join('·')); if(b.length) parts.push('내일 ' + tl + ' ' + b.join('·'));
    sent += send_(targets, '📅 ' + (a.length ? '오늘 근무 · ' + a.join('·') : '내일 ' + b.join('·')), parts.join(' / ') + ' — 근무일정표 기준', APP_URL + '#home', 'digest-' + today, {room:''});
  });
  Logger.log('✅ 아침 근무 알림: ' + people + '명 · ' + sent + '대 발송 (' + today + ')');
  return {people:people, sent:sent};
}
function installDigestTrigger(){
  removeDigestTrigger();
  ScriptApp.newTrigger('morningDigest').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Seoul').create();
  Logger.log('✅ 매일 아침 7시대 「아침 근무 알림」을 예약했습니다. 바로 확인하려면 morningDigest 를 한 번 실행하세요.');
}
function removeDigestTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='morningDigest') ScriptApp.deleteTrigger(t); });
}
