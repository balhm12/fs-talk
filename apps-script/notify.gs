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
    if(req.type === 'adminsync') return out_(adminSync_(req));
    if(req.type === 'slack') return out_(slackAct_(req));
    if(req.type === 'slackTest') return out_(slackTest_(req));
    if(req.type === 'slackBulk') return out_(slackBulk_(req));
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

const NOTIFY_VER = 'v29';

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
/* v20: 관리자 = 사람 기준. 같은 이름·팀의 다른 기기가 관리자면 이 기기도 관리자로(사파리↔홈 화면 앱, 새 휴대폰·PC 등 접속 방법과 무관) */
function adminSync_(req){
  const uid = verifyUser_(String(req.idToken||''));
  if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const u = db_('talk/users/'+uid);
  if(!u || u.status !== 'approved') return {ok:true,admin:false,ver:NOTIFY_VER};
  if(db_('talk/admins/'+uid) === true) return {ok:true,admin:true,ver:NOTIFY_VER};
  const admins = db_('talk/admins') || {}, users = db_('talk/users') || {};
  const same = Object.keys(admins).some(function(id){ const x = users[id]; return admins[id] === true && x && x.status === 'approved' && x.team === u.team && x.name === u.name; });
  if(!same) return {ok:true,admin:false,ver:NOTIFY_VER};
  dbPut_('talk/admins/'+uid, true);
  return {ok:true,admin:true,granted:true,ver:NOTIFY_VER};
}
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
  if(db_('talk/admins/'+String(lc.uid||'')) === true) dbPut_('talk/admins/'+uid, true);   // v20: 관리자 기기에서 만든 코드면 새 기기도 관리자
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
/* 고정 방(전체·공지·팀·사무소) 읽기 권한 — database.rules.json 의 talk/msgs/$room .read 와 같은 조건.
 * 서버는 서비스 권한으로 대화를 읽으므로, 읽기 전에 요청한 사람이 그 방을 볼 수 있는지 다시 확인한다.
 * (전체방·공지·FS·CS = 승인된 누구나, 팀·사무소 방 = 그 팀(+사무소)과 관리자) */
function canReadFixedRoom_(uid, me, room){
  if(['all','notice','ts','cs'].indexOf(room) >= 0) return true;
  if(db_('talk/admins/'+uid) === true) return true;
  const sc = ROOM_SCOPE[room];
  if(!sc || !me || me.team !== sc[0]) return false;
  if(!sc[1]) return true;
  const r = db_('talk/roster/'+me.team+'/'+me.name);
  const office = (r && typeof r === 'object') ? r.o : r;   // 명단: 사무소 문자열 또는 {o:사무소, lead:true}
  return office === sc[1];
}
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
  if(!isDm && !isGroup && !canReadFixedRoom_(uid, me, room)) return {ok:false,err:'이 방을 볼 수 없습니다',ver:NOTIFY_VER};
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
      const n = schKey_(e.night); if(n && n!=='OFF') add(nm, n);
      const wk = schKey_(e.weekend); if(wk) add(nm, wk==='전화' ? '전화대기' : wk);
      const sl = ['am1','am2','pm1','pm2'].map(function(k){ return schKey_(e[k]); });
      if(sl.indexOf('휴가')>=0) add(nm,'휴가'); else if(sl.indexOf('오전휴가')>=0) add(nm,'오전휴가'); else if(sl.indexOf('오후휴가')>=0) add(nm,'오후휴가');
      // v19: 개인 일정 — 교육·회의·내근·DP와 세부 내용(「회의:팀장회의」), 반나절이면 (오전)/(오후)
      const pl = {};
      ['am1','am2','pm1','pm2'].forEach(function(k, j){ const v = String(e[k]||'').trim(), k0 = schKey_(v);
        if(!k0 || ['ON','휴가','오전휴가','오후휴가'].indexOf(k0) >= 0) return;   // v22: 휴가 외 모든 칸(당직·OFF·그 밖에 적힌 값 포함)
        const d = v.indexOf(':') >= 0 ? v.slice(v.indexOf(':')+1).trim().slice(0,20) : '', lab = (k0==='OFF'?'휴무(OFF)':k0) + (d ? ' ' + d : '');
        (pl[lab] = pl[lab] || {}); pl[lab][j < 2 ? 'am' : 'pm'] = 1; });
      Object.keys(pl).forEach(function(lab){ const h = pl[lab]; add(nm, lab + (h.am && h.pm ? '' : h.am ? '(오전)' : '(오후)')); });
    });
  });
  return out;
}
/* 아침 일정 브리핑 (v18) — 예전 「아침 근무(당직) 알림」을 대신한다. 트리거 이름(morningDigest)은 그대로라 다시 설치할 필요 없음.
   사람마다: 오늘 내 일정(설치·이전·평가 등, 담당자 이름·별명 기준) + 오늘 내 근무(교육·당직 등) + 우리 팀 오늘 설치·휴가 인원 + 내일 내 일정.
   지원 팀(FSS·FSOM)·그룹장은 FSG 전체 설치 건수. 휴가인 날, 주말에 아무 일정 없는 사람, 브리핑을 끈 사람(prefs.digest=false)은 보내지 않는다. */
const SCH_PAGE = 'https://balhm12.github.io/Sysmex-schedule/index.html';
const SCH_CATK = {install:'설치', relocation:'이전', evaluation:'평가', demo:'데모', education:'교육'};
function schEvents_(){
  let base = [];
  try{ const h = UrlFetchApp.fetch(SCH_PAGE, {muteHttpExceptions:true}).getContentText();
       const m = /const\s+BASE_EVENTS\s*=\s*(\[[\s\S]*?\]);\s*\n/.exec(h); if(m) base = JSON.parse(m[1]); }catch(e){ console.error('BASE_EVENTS', e); }
  const vals = function(o){ return Array.isArray(o) ? o.filter(Boolean) : Object.keys(o||{}).map(function(k){ return o[k]; }).filter(Boolean); };
  let custom = {}, edited = {}, deleted = {};
  try{ custom = schGet_('schedule-overrides/custom') || {}; }catch(e){}
  try{ edited = schGet_('schedule-overrides/edited') || {}; }catch(e){}
  try{ deleted = schGet_('schedule-overrides/deleted') || {}; }catch(e){}
  const del = {}; (Array.isArray(deleted) ? deleted : Object.keys(deleted)).forEach(function(k){ del[k] = 1; });
  return base.filter(function(e){ return e && !del[e.id]; }).map(function(e){ return edited[e.id] || e; })
    .concat(vals(custom).filter(function(e){ return !del[e.id]; }));
}
function evOn_(e, day){ const s = String(e.start||''), en = String(e.end||e.start||''); return s && s <= day && day <= en; }
function morningDigest(){
  const tz = 'Asia/Seoul', now = new Date();
  const fmt = function(d, p){ return Utilities.formatDate(d, tz, p); };
  const today = fmt(now, 'yyyy-MM-dd'), tmd = new Date(now.getTime()+864e5), tom = fmt(tmd, 'yyyy-MM-dd');
  const wd = function(d){ return '월화수목금토일'.charAt(+fmt(d, 'u') - 1); };
  const weekend = +fmt(now, 'u') >= 6;
  const tl = fmt(now, 'M/d') + '(' + wd(now) + ')', tl1 = fmt(tmd, 'M/d') + '(' + wd(tmd) + ')';
  const D0 = schDay_(today), D1 = schDay_(tom);
  const EV = schEvents_().filter(function(e){ return e.category !== 'holiday'; });
  const E0 = EV.filter(function(e){ return evOn_(e, today); }), E1 = EV.filter(function(e){ return evOn_(e, tom); });
  let troster = {}; try{ troster = schGet_('work-schedule/teamRoster') || {}; }catch(e){}
  const nick = {}; Object.keys(troster).forEach(function(tk){ const t = troster[tk] || {};
    Object.keys(t).forEach(function(k){ const m = t[k]; if(m && m.name) nick[m.name] = String(m.nickname||'').trim(); }); });
  const mine = function(e, name){ const a = String(e.assignee||''); if(!a) return false; if(a.indexOf(name) >= 0) return true;
    const nn = nick[name]; return !!nn && new RegExp('(^|[^A-Za-z])' + nn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z]|$)', 'i').test(a); };
  const lbl = function(e){ return (SCH_CATK[e.category] || '일정') + ' ' + String(e.title||'').slice(0, 14) + (e.device ? '(' + String(e.device).slice(0, 10) + ')' : ''); };
  const FIELD = ['FS WEST','FS EAST','FS CENTRAL','FS SOUTH'];
  const users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {}, mute = db_('talk/mute') || {}, prefs = db_('talk/prefs') || {};
  const roster = db_('talk/roster') || {};
  const teamOf = {}; Object.keys(roster).forEach(function(t){ Object.keys(roster[t]||{}).forEach(function(n){ teamOf[n] = t; }); });
  const LEAVE = ['휴가','오전휴가','오후휴가'];
  let people = 0, sent = 0; const done = {};
  Object.keys(users).forEach(function(id){
    const u = users[id]; if(!u || u.status !== 'approved') return;
    const pk = u.team + '_' + u.name; if(done[pk]) return;
    if(prefs[pk] && prefs[pk].digest === false) return;
    if(mute[id] && mute[id]._all) return;
    const w0 = D0[u.name] || [];
    if(w0.indexOf('휴가') >= 0) return;                                            // 하루 휴가면 보내지 않음
    const t = tokens[id] || {}, targets = [];
    Object.keys(t).forEach(function(k){ if(t[k] && t[k].token) targets.push({uid:id,key:k,token:t[k].token}); });
    if(!targets.length) return;
    const my0 = E0.filter(function(e){ return mine(e, u.name); }), my1 = E1.filter(function(e){ return mine(e, u.name); });
    const work1 = (D1[u.name] || []).filter(function(x){ return LEAVE.indexOf(x) < 0 && x !== '교육'; });
    const tu = String(u.team||'').toUpperCase(), field = FIELD.indexOf(tu) >= 0;
    const scopeEv = field ? E0.filter(function(e){ return String(e.team||'').toUpperCase() === tu; }) : E0;
    const off = Object.keys(D0).filter(function(n){ return LEAVE.indexOf((D0[n]||[])[0]) >= 0 && (!field || String(teamOf[n]||'').toUpperCase() === tu); }).length;
    if(weekend && !my0.length && !w0.length && !my1.length && !work1.length) return;   // 주말엔 내 일이 있을 때만
    const lines = [];
    if(my0.length) lines.push('내 일정 ' + my0.map(lbl).join(', '));
    if(w0.length) lines.push('근무 ' + w0.join('·'));
    const inst = scopeEv.filter(function(e){ return e.category === 'install' || e.category === 'relocation'; }).length;
    const tp = []; if(inst) tp.push('설치·이전 ' + inst + '건'); if(off) tp.push('휴가 ' + off + '명');
    if(tp.length) lines.push((field ? '우리 팀 ' : 'FSG ') + tp.join(' · '));
    const n1 = my1.map(lbl).concat(work1); if(n1.length) lines.push('내일 ' + tl1 + ' ' + n1.join(', '));
    if(!lines.length) lines.push('오늘 등록된 내 일정은 없습니다');
    done[pk] = true; people++;
    sent += send_(targets, '오늘의 일정 브리핑 · ' + tl, lines.join(' / '), APP_URL + '#home', 'digest-' + today, {room:''});
  });
  Logger.log('✅ 아침 일정 브리핑: ' + people + '명 · ' + sent + '대 발송 (' + today + ', 일정 ' + E0.length + '건)');
  return {people:people, sent:sent};
}
function installDigestTrigger(){
  removeDigestTrigger();
  ScriptApp.newTrigger('morningDigest').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Seoul').create();
  Logger.log('✅ 매일 아침 7시대 「아침 일정 브리핑」을 예약했습니다. 바로 확인하려면 morningDigest 를 한 번 실행하세요.');
}
function removeDigestTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='morningDigest') ScriptApp.deleteTrigger(t); });
}


/* =====================================================================
 * v24: Slack 요청함 — Slack 채널의 요청을 포털로 가져와 처리하고, 처리 내용을 Slack 스레드로 되돌림
 *  - 비밀값: 스크립트 속성 SLACK_BOT_TOKEN (xoxb-…, Slack 앱 「FS 포털」) — 코드·저장소·채팅에 두지 않음
 *  - installSlackTrigger() 한 번 실행 → 1분마다 slackPull() (새 글 가져오기 + 5분마다 열린 요청의 스레드·반응 맞추기)
 *  - DB: talk/slack/meta · req/{id} · feed/{ts}  (읽기 = 승인된 직원, 쓰기 = 이 서버만)
 *  - 포털 → Slack: doPost type 'slack' (op: claim·reply·done·reopen) — 승인된 직원만, 그 사람 이름으로 스레드에 씀
 * ===================================================================== */
const SLACK_CH = {
  C0AT8RP3QDN: {k:'cso',   name:'handover-cso-fsg',      type:'req'},   // CSO → FSG 기술 문의 이관
  C0AHFJGKMTL: {k:'night', name:'handover-cssharing-fsg', type:'req'},   // 야간 전화 접수(CS쉐어링) 인계
  C0C6U7RQ44D: {k:'talk',  name:'group-sysmex-talk',      type:'feed', room:true}   // 현장 대화 → 작성자 팀·사무소방(200)
};
const SLK_FEED_KEEP_DAYS = 30;

function slackApi_(method, params, post){
  const tok = P_('SLACK_BOT_TOKEN'); if(!tok) throw new Error('SLACK_BOT_TOKEN 없음');
  let r;
  if(post){
    r = UrlFetchApp.fetch('https://slack.com/api/'+method,{method:'post',contentType:'application/json; charset=utf-8',
      headers:{Authorization:'Bearer '+tok},payload:JSON.stringify(params||{}),muteHttpExceptions:true});
  }else{
    const q = Object.keys(params||{}).map(function(k){ return encodeURIComponent(k)+'='+encodeURIComponent(params[k]); }).join('&');
    r = UrlFetchApp.fetch('https://slack.com/api/'+method+(q?'?'+q:''),{headers:{Authorization:'Bearer '+tok},muteHttpExceptions:true});
  }
  const j = JSON.parse(r.getContentText()||'{}');
  if(!j.ok && ['already_reacted','no_reaction'].indexOf(j.error) < 0) throw new Error('Slack '+method+': '+(j.error||r.getResponseCode()));
  return j;
}
function slkKey_(ts){ return String(ts).replace('.','_'); }
function slkClean_(t){
  return String(t||'')
    .replace(/<tel:[^|>]*\|([^>]*)>/g,'$1').replace(/<mailto:[^|>]*\|([^>]*)>/g,'$1')
    .replace(/<@[A-Z0-9]+\|([^>]*)>/g,'@$1').replace(/<!subteam\^[A-Z0-9]+(\|[^>]*)?>/g,'').replace(/<!(here|channel|everyone)>/g,'')
    .replace(/<(https?:[^|>]*)\|([^>]*)>/g,'$2 ($1)').replace(/<(https?:[^>]*)>/g,'$1')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();
}
/* 「이준호(Juno)」 → 「이준호」 — 포털 명단 이름과 맞추기 */
function slkPerson_(n){ return String(n||'').replace(/\s*[\(（][^\)）]*[\)）]\s*/g,' ').replace(/^\s*(?:SKR\s+)?FS(?:\s+(?:WEST|EAST|CENTRAL|SOUTH|SS|OM))?\s+/i,'').replace(/\s+/g,' ').trim(); }
function slkBotId_(){
  const c = CacheService.getScriptCache(), h = c.get('slkBot'); if(h !== null) return h;
  let id = ''; try{ id = slackApi_('auth.test',{}).user_id || ''; }catch(e){}
  c.put('slkBot', id, 21600); return id;
}
/* 210: 오늘 근무일정표에서 이 사람 칸에 「DP」가 있는지 (서버도 화면과 같은 조건으로 확인) */
function isDpToday_(name){
  if(!name) return false;
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  return SCH_TEAMS.some(function(t){
    let e = null; try{ e = schGet_('work-schedule/'+t+'/'+day+'/'+encodeURIComponent(name)); }catch(err){ return false; }
    if(!e || typeof e !== 'object') return false;
    return ['am1','am2','pm1','pm2','weekend','night'].some(function(k){ return schKey_(e[k]) === 'DP'; });
  });
}
function slkUser_(uid, cacheObj){
  if(!uid) return '';
  if(cacheObj[uid] !== undefined) return cacheObj[uid];
  const c = CacheService.getScriptCache(), hit = c.get('slu:'+uid);
  if(hit !== null){ cacheObj[uid] = hit; return hit; }
  let n = '';
  try{ const j = slackApi_('users.info',{user:uid}); const u = j.user||{}; n = (u.profile && (u.profile.real_name || u.profile.display_name)) || u.real_name || u.name || ''; }catch(e){}
  c.put('slu:'+uid, n, 21600); cacheObj[uid] = n; return n;
}
/* 양식 글(CSO 기술요청·CS쉐어링 접수)을 칸으로 나눔 — 칸이 없으면 null */
function slkParse_(text){
  const t = String(text||'');
  const f = {};
  const tm = /<\s*인계\s*:\s*([^>]+?)\s*>/.exec(t) || /\[\s*인계\s*:\s*([^\]]+?)\s*\]/.exec(t);
  if(tm){ const v = tm[1].trim(); if(/^L\d/i.test(v)) f.lvl = v.toUpperCase(); else f.team = v.replace(/\s+/g,' ').toUpperCase().replace(/^FS(?=\S)/,'FS '); }
  const KEYS = [['hosp',/^기관명/],['eq',/^장비명/],['req',/^요청사항/],['sym',/^(error|에러)\/?증상/i],['act',/^확인\/?조치/],['contact',/^회신처|^회신고객|^접수처/],['when',/^회신기간/],['back',/^회신여부/]];
  let cur = null;
  t.split(/\n/).forEach(function(line){
    const m = /^\s*(?:\d+\s*[).:]|[-•·]|)\s*([가-힣A-Za-z\/ (),]{2,24}?)\s*(?:\[[^\]]*\])?\s*[:：]\s*(.*)$/.exec(line);
    if(m){
      const key = m[1].replace(/\s+/g,'').replace(/\(지역\)/,'');
      const hit = KEYS.filter(function(k){ return k[1].test(key); })[0];
      if(hit){ cur = hit[0]; if(f[cur] && cur==='contact'){ f[cur] += ' / ' + m[2].trim(); } else f[cur] = m[2].trim(); return; }
    }
    if(/^\s*\d+\s*[).]/.test(line) || /^\s*=+\s*$/.test(line) || /^\s*\[CS/.test(line)) { cur = null; return; }
    if(cur && line.trim()) f[cur] = ((f[cur]||'') + (f[cur] ? '\n' : '') + line.trim()).slice(0,600);
  });
  const rb = /회신여부\s*\[\s*([YN])\s*\]/i.exec(t); if(rb) f.back = rb[1].toUpperCase();
  if(f.hosp){ const rg = /\(([^)]+)\)\s*$/.exec(f.hosp); if(rg && rg[1].length <= 4){ f.area = rg[1]; f.hosp = f.hosp.replace(/\s*\([^)]+\)\s*$/,''); } }
  Object.keys(f).forEach(function(k){ f[k] = String(f[k]).replace(/[ \t]+/g,' ').trim().slice(0,600); if(!f[k]) delete f[k]; });
  return (f.hosp && (f.eq || f.req)) ? f : null;
}
function slkHash_(s){ return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)).replace(/[=_-]/g,'').slice(0,14); }

/* 1분마다: 새 글 가져오기. 5분마다(또는 force): 열린 요청의 스레드·반응 맞추기 */
function slackPull(force){
  if(!P_('SLACK_BOT_TOKEN')) return;
  const lock = LockService.getScriptLock(); if(!lock.tryLock(1000)) return;
  try{
    const props = PropertiesService.getScriptProperties(), names = {}, now = Date.now();
    const meta = db_('talk/slack/meta') || {};
    if(!meta.team){ try{ const a = slackApi_('auth.test',{}); meta.team = a.team_id; meta.teamName = a.team; meta.url = a.url; }catch(e){} }
    let added = 0;
    Object.keys(SLACK_CH).forEach(function(ch){
      const C = SLACK_CH[ch];
      const last = props.getProperty('SLK_TS_'+ch) || String((now - 3*864e5)/1000);
      let cursor = '', maxTs = last, page = 0;
      do{
        const prm = {channel:ch, oldest:last, limit:200}; if(cursor) prm.cursor = cursor;
        let j; try{ j = slackApi_('conversations.history', prm); }catch(e){ meta.err = String(e.message||e).slice(0,200); break; }
        (j.messages||[]).forEach(function(m){
          if(+m.ts <= +last) return;
          if(+m.ts > +maxTs) maxTs = m.ts;
          if(m.subtype && ['bot_message','thread_broadcast'].concat(C.type === 'feed' ? ['file_share'] : []).indexOf(m.subtype) < 0) return;   // 들어옴·나감 등
          if(m.bot_id && m.app_id && m.username && /FS 포털/.test(m.username)) return;          // 우리가 보낸 글
          const raw = String(m.text||''), text = slkClean_(raw);
          const who = m.user ? slkUser_(m.user, names) : (m.username || (m.bot_profile && m.bot_profile.name) || '');
          const men = /<@([A-Z0-9]+)\|([^>]*)>/.exec(raw);
          const mention = men ? slkPerson_(men[2]) : (/<@([A-Z0-9]+)>/.exec(raw) ? slkPerson_(slkUser_(/<@([A-Z0-9]+)>/.exec(raw)[1], names)) : '');
          const at = Math.round(+m.ts*1000);
          if(C.type === 'feed' && /<\s*(기술|학술)\s*요청\s*>/.test(text)){   // 202: 대화방엔 안 옮김
            if(/학술\s*요청/.test(text) || !/<\s*인계\s*:\s*FS/i.test(text)) return;   // 학술요청·<완료 : …>·CSO 인계는 FSG 요청 아님
          }
          else if(C.type === 'feed'){
            dbPut_('talk/slack/feed/'+slkKey_(m.ts), {n:slkPerson_(who), t:text.slice(0,2000), at:at, ch:ch, ts:m.ts});
            slkToRoom_(m, text, slkPerson_(who), at, ch, C);
            slkFinHint_(text, slkPerson_(who), at);
            return;
          }
          // 요청 채널: 양식 블록마다 요청 1건 (야간 인계 요약 글은 여러 건 — 같은 내용은 같은 id 라 두 번 들어오지 않음)
          const blocks = /\[CS쉐어링 접수\]/.test(text) && (text.match(/\[CS쉐어링 접수\]/g)||[]).length > 1
            ? text.split(/(?=\[CS쉐어링 접수\])/).filter(function(b){ return /\[CS쉐어링 접수\]/.test(b); }) : [text];
          blocks.forEach(function(b, i){
            const f = slkParse_(b); if(!f) return;
            if(/학술\s*요청/.test(b) || (f.team && !/^FS/.test(f.team))) return;   // 202: 학술요청·CSO/SA 인계는 FSG 요청함에 넣지 않음
            const day = Utilities.formatDate(new Date(at), 'Asia/Seoul', 'yyyyMMdd');
            const id = blocks.length > 1 ? C.k+'_n'+slkHash_([f.hosp,f.eq,f.req].join('|')) : (C.k === 'talk' ? 'cso' : C.k)+'_d'+slkHash_([day,f.hosp,f.eq,f.req].join('|'));
            const cur = db_('talk/slack/req/'+id);
            if(cur && !(blocks.length > 1)) return;   // 같은 요청이 다른 채널에 또 올라온 것 — 처음 것을 그대로 둠
            const base = {ch:ch, ts:m.ts, kind:(C.k === 'talk' ? 'cso' : C.k), by:slkPerson_(who), at:(cur&&cur.at)||at, t:b.slice(0,4000), f:f, mention:mention||null, multi:blocks.length>1||null};
            if(!cur){ base.st = 'new'; added++; }
            dbPatch_('talk/slack/req/'+id, base);
          });
        });
        cursor = j.response_metadata && j.response_metadata.next_cursor || '';
      }while(cursor && ++page < 3);
      props.setProperty('SLK_TS_'+ch, String(maxTs));
    });
    const min = new Date().getMinutes();
    if(force || min % 5 === 0) slkSync_(names);
    if(min % 30 === 0) slkTrimFeed_();
    meta.at = now; meta.ok = true; if(!meta.err) delete meta.err; meta.chans = {}; Object.keys(SLACK_CH).forEach(function(c){ meta.chans[c] = SLACK_CH[c].name; });
    meta.added = added;
    dbPut_('talk/slack/meta', meta);
  }catch(e){
    console.error(e);
    try{ dbPatch_('talk/slack/meta',{ok:false, err:String(e.message||e).slice(0,200), at:Date.now()}); }catch(e2){}
  }finally{ try{lock.releaseLock();}catch(e){} }
}
/* 열린 요청(7일 안)의 스레드 답글·반응을 읽어 상태를 맞춤 — Slack 에서 👀/답글 = 처리 중, ✅ = 완료 */
function slkSync_(names){
  const all = dbQuery_('talk/slack/req','orderBy="at"&startAt='+(Date.now()-7*864e5)) || {};
  Object.keys(all).slice(-40).forEach(function(id){
    const r = all[id]; if(!r || r.multi) return;
    const autoDone = r.st === 'done' && !r.doneBy;   // 210: v24~28 은 ✅ 를 「완료」로 잘못 봤음 — 사람이 완료하지 않은 것은 다시 맞춤
    if(r.st === 'done' && !autoDone) return;
    let j; try{ j = slackApi_('conversations.replies',{channel:r.ch, ts:r.ts, limit:50}); }catch(e){ return; }
    const msgs = j.messages || []; if(!msgs.length) return;
    const parent = msgs[0], patch = {}, th = {};
    msgs.slice(1).forEach(function(m){
      const n = m.user ? slkPerson_(slkUser_(m.user, names)) : slkPerson_(String(m.username||'').replace(/\s*\(FS 포털\)\s*$/,''));
      th[slkKey_(m.ts)] = {n:n, t:slkClean_(m.text).slice(0,1500), at:Math.round(+m.ts*1000), p:/FS 포털/.test(m.username||'')||null};
    });
    if(Object.keys(th).length) patch.th = th;
    const rx = (parent.reactions||[]).map(function(x){ return x.name; });
    if(rx.length) patch.rx = rx.join(',');
    if(autoDone){ patch.st = 'new'; patch.doneAt = null; }
    // 210: ✅(white_check_mark) = 담당·DP 가 「확인(접수)」했다는 뜻 (사용자 확인 2026-11-09). 완료는 포털 「완료」로만
    const ackR = (parent.reactions||[]).filter(function(x){ return /^(white_check_mark|heavy_check_mark|ballot_box_with_check|v)$/.test(x.name); })[0];
    if(ackR && !r.ack){
      const uids = (ackR.users||[]).filter(function(u){ return u !== slkBotId_(); });
      const an = uids.length ? slkPerson_(slkUser_(uids[0], names)) : '';
      patch.ack = {n: an || '', at: Date.now()};
    }
    if(ackR && (r.st === 'new' || autoDone)){ patch.st = 'doing'; if(!r.who && patch.ack && patch.ack.n) { patch.who = patch.ack.n; patch.whoAt = Date.now(); } }
    else if(r.st === 'new' || autoDone){
      const rep = Object.keys(th).map(function(k){ return th[k]; }).filter(function(x){ return x.n && x.n !== r.by; })[0];
      if(rep){ patch.st = 'doing'; patch.who = r.who || rep.n; patch.whoAt = rep.at; }
      else if(rx.indexOf('eyes') >= 0){ patch.st = 'doing'; }
    }
    dbPatch_('talk/slack/req/'+id, patch);
  });
}
/* 200: #group-sysmex-talk 글 → 포털 대화방 (Slack → 포털 한쪽만, 사용자 결정 2026-11-06)
 *  작성자 이름을 명단과 맞춰 사무소방(있으면) 또는 팀방, 명단에 없거나 같은 이름이 둘 이상이면 전체방.
 *  키 = 's'+Slack ts 라 같은 글은 두 번 들어오지 않음. 알림(푸시)은 보내지 않음. Slack 에서 고치거나 지운 것·스레드 답글은 옮기지 않음 */
function slkRoomFor_(name, roster){
  const hits = [];
  Object.keys(roster||{}).forEach(function(team){ const g = roster[team]||{}; if(Object.prototype.hasOwnProperty.call(g, name)){ const v = g[name]; hits.push({team:team, office: typeof v === 'string' ? v : (v && v.o) || ''}); } });
  if(hits.length !== 1) return 'all';
  const p = hits[0], keys = Object.keys(ROOM_SCOPE);
  return keys.filter(function(k){ return ROOM_SCOPE[k][0] === p.team && ROOM_SCOPE[k][1] && ROOM_SCOPE[k][1] === p.office; })[0]
      || keys.filter(function(k){ return ROOM_SCOPE[k][0] === p.team && !ROOM_SCOPE[k][1]; })[0] || 'all';
}
function slkToRoom_(m, text, name, at, ch, C){
  if(!C.room) return;
  if(!slkToRoom_.roster) slkToRoom_.roster = db_('talk/roster') || {};
  const files = (m.files||[]).length, t = (text + (files ? (text ? '\n' : '') + '(첨부 ' + files + '개 — Slack 에서 보기)' : '')).trim();
  if(!t) return;
  const room = slkRoomFor_(name, slkToRoom_.roster);
  dbPut_('talk/msgs/'+room+'/s'+slkKey_(m.ts), {uid:'slack', name:(name||'Slack').slice(0,40), text:t.slice(0,4000), ts:at, slk:{ch:ch, ts:m.ts, cn:C.name}});
}
/* 현장 마무리 보고(「○○병원 마칩니다」)에 열린 요청의 기관명이 있으면 요청에 표시 — 자동으로 닫지는 않음 */
function slkFinHint_(text, who, at){
  if(!/마칩니다|마쳤|마무리|완료|종료/.test(text)) return;
  const all = dbQuery_('talk/slack/req','orderBy="at"&startAt='+(Date.now()-10*864e5)) || {};
  const flat = text.replace(/\s+/g,'');
  Object.keys(all).forEach(function(id){
    const r = all[id]; if(!r || r.st === 'done' || !r.f || !r.f.hosp) return;
    const h = String(r.f.hosp).replace(/\s+/g,'').replace(/^(의료법인|재단법인|학교법인)/,'');
    if(h.length >= 3 && (flat.indexOf(h) >= 0 || flat.indexOf(h.slice(0,4)) >= 0 && h.length >= 6))
      dbPatch_('talk/slack/req/'+id, {fin:{n:who, t:text.slice(0,400), at:at}});
  });
}
function slkTrimFeed_(){
  const old = dbQuery_('talk/slack/feed','orderBy="at"&endAt='+(Date.now()-SLK_FEED_KEEP_DAYS*864e5)) || {};
  Object.keys(old).slice(0,200).forEach(function(k){ dbDelete_('talk/slack/feed/'+k); });
}

/* 포털 → Slack: 담당·회신·완료·다시 열기 (승인된 직원, 그 사람 이름으로) */
function slackAct_(req){
  const uid = verifyUser_(String(req.idToken||'')); if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const me = db_('talk/users/'+uid); if(!me || me.status !== 'approved') return {ok:false,err:'승인된 직원만 할 수 있습니다',ver:NOTIFY_VER};
  const isAdm = db_('talk/admins/'+uid) === true;
  if(!isAdm && String(req.op||'') !== 'ack') return {ok:false,err:'담당·회신·완료는 관리자만 할 수 있습니다',ver:NOTIFY_VER};   // 205: 직원은 확인만 (210: ✅ 확인은 담당·오늘 DP 도)
  if(!P_('SLACK_BOT_TOKEN')) return {ok:false,err:'Slack 연결 전입니다 (관리자가 SLACK_BOT_TOKEN 설정)',ver:NOTIFY_VER};
  const id = String(req.id||''); if(!/^[a-z]+_[-\w]{6,40}$/.test(id)) return {ok:false,err:'bad id',ver:NOTIFY_VER};
  const r = db_('talk/slack/req/'+id); if(!r || !SLACK_CH[r.ch]) return {ok:false,err:'요청이 없습니다',ver:NOTIFY_VER};
  const op = String(req.op||''), name = String(me.name||'').slice(0,20), text = String(req.text||'').trim().slice(0,1500);
  if(op === 'ack' && !isAdm && !(r.who === name || r.mention === name || isDpToday_(name))) return {ok:false,err:'담당자·오늘 DP·관리자만 확인할 수 있습니다',ver:NOTIFY_VER};
  const post = function(t){ return slackApi_('chat.postMessage',{channel:r.ch, thread_ts:r.ts, text:t, username:name+' (FS 포털)', unfurl_links:false}, true); };
  const now = Date.now(), patch = {};
  if(r.multi && op !== 'claim' && op !== 'ack' && op !== 'done' && op !== 'reopen') return {ok:false,err:'야간 인계 요약 글은 스레드 회신 대신 담당·완료만 할 수 있습니다',ver:NOTIFY_VER};
  if(op === 'claim'){
    if(!r.multi){ slackApi_('reactions.add',{channel:r.ch, timestamp:r.ts, name:'eyes'}, true); post('👀 '+name+'님이 담당합니다'+(text?'\n'+text:'')); }
    patch.st = 'doing'; patch.who = name; patch.whoAt = now;
  }else if(op === 'reply'){
    if(!text) return {ok:false,err:'내용이 비었습니다',ver:NOTIFY_VER};
    const j = post(text); patch['th/'+slkKey_(j.ts)] = {n:name, t:text, at:now, p:true};
    if(r.st === 'new'){ patch.st = 'doing'; patch.who = r.who || name; patch.whoAt = now; }
  }else if(op === 'ack'){   // 210: ✅ = 확인(접수)
    if(!r.multi){ try{ slackApi_('reactions.add',{channel:r.ch, timestamp:r.ts, name:'white_check_mark'}, true); }catch(e){} post('✅ '+name+' 확인'+(text?'\n'+text:'')); }
    patch.ack = {n:name, at:now}; if(r.st === 'new'){ patch.st = 'doing'; } if(!r.who){ patch.who = name; patch.whoAt = now; }
  }else if(op === 'done'){   // 210: ✅ 는 「확인」이라 완료에는 반응을 달지 않음
    if(!r.multi){ post('처리 완료 — '+name+(text?'\n'+text:'')); }
    patch.st = 'done'; patch.doneAt = now; patch.doneBy = name; if(!r.who) patch.who = name;
  }else if(op === 'reopen'){
    patch.st = 'doing'; patch.doneAt = null; patch.doneBy = null;
  }else return {ok:false,err:'bad op',ver:NOTIFY_VER};
  dbPatch_('talk/slack/req/'+id, patch);
  return {ok:true,ver:NOTIFY_VER};
}
/* 관리 화면 「Slack 연결 시험」 — 관리자만. 토큰·채널 초대 상태와 마지막 가져오기 결과 */
/* 208: 관리자 「목록 정리」 — 요청 여러 건을 완료로 정리(Slack 에는 아무것도 안 보냄) 또는 포털에서 삭제.
 *  삭제한 요청은 slackPull 이 마지막으로 읽은 시각 이후 글만 가져오므로 다시 들어오지 않음 */
function slackBulk_(req){
  const uid = verifyUser_(String(req.idToken||'')); if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const me = db_('talk/users/'+uid);
  if(!(db_('talk/admins/'+uid) === true && me && me.status === 'approved')) return {ok:false,err:'관리자만 할 수 있습니다',ver:NOTIFY_VER};
  const op = String(req.op||''); if(op !== 'done' && op !== 'del') return {ok:false,err:'bad op',ver:NOTIFY_VER};
  const ids = (Array.isArray(req.ids) ? req.ids : []).map(String).filter(function(id){ return /^[a-z]+_[-\w]{6,40}$/.test(id); }).slice(0,400);
  if(!ids.length) return {ok:false,err:'대상이 없습니다',ver:NOTIFY_VER};
  const now = Date.now(), name = String(me.name||'').slice(0,20), patch = {};
  ids.forEach(function(id){
    if(op === 'del') patch[id] = null;
    else { patch[id+'/st'] = 'done'; patch[id+'/doneAt'] = now; patch[id+'/doneBy'] = name; }
  });
  dbPatch_('talk/slack/req', patch);
  return {ok:true, n:ids.length, ver:NOTIFY_VER};
}
function slackTest_(req){
  const uid = verifyUser_(String(req.idToken||'')); if(!uid) return {ok:false,err:'auth',ver:NOTIFY_VER};
  const me = db_('talk/users/'+uid);
  if(!(db_('talk/admins/'+uid) === true && me && me.status === 'approved')) return {ok:false,err:'관리자만',ver:NOTIFY_VER};
  if(!P_('SLACK_BOT_TOKEN')) return {ok:false,err:'스크립트 속성 SLACK_BOT_TOKEN 이 없습니다',ver:NOTIFY_VER};
  const a = slackApi_('auth.test',{});
  const chans = Object.keys(SLACK_CH).map(function(ch){
    try{ const j = slackApi_('conversations.info',{channel:ch}); return {id:ch, name:SLACK_CH[ch].name, member:!!(j.channel&&j.channel.is_member)}; }
    catch(e){ return {id:ch, name:SLACK_CH[ch].name, member:false, err:String(e.message||e).slice(0,80)}; }
  });
  const trig = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'slackPull'; });
  if(req.pull) slackPull(true);
  return {ok:true, team:a.team, bot:a.user, chans:chans, trigger:trig, ver:NOTIFY_VER};
}
function installSlackTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction() === 'slackPull') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('slackPull').timeBased().everyMinutes(1).create();
  slackPull(true);
  Logger.log('✅ 1분마다 Slack 요청 가져오기 시작');
}
function removeSlackTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction() === 'slackPull') ScriptApp.deleteTrigger(t); });
  Logger.log('Slack 가져오기 멈춤');
}
