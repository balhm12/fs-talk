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
const ROOM_NAME = {all:'전체방',notice:'공지',ts:'FS',cs:'CS',west:'FS WEST',east:'FS EAST',central:'FS CENTRAL',daejeon:'대전 사무소',gwangju:'광주 사무소',south:'FS SOUTH',busan:'부산 사무소',daegu:'대구 사무소',fss:'FSS Team',fsom:'FSOM Team'};
const ROOM_SCOPE = {west:['FS WEST'],east:['FS EAST'],central:['FS CENTRAL'],daejeon:['FS CENTRAL','대전'],gwangju:['FS CENTRAL','광주'],south:['FS SOUTH'],busan:['FS SOUTH','부산'],daegu:['FS SOUTH','대구'],fss:['FSS Team'],fsom:['FSOM Team']};

function P_(k){ return PropertiesService.getScriptProperties().getProperty(k); }
function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e){
  try{
    const req = JSON.parse(e.postData.contents);
    const room = String(req.room||''), msgId = String(req.msgId||'');
    if(!ROOM_NAME[room] || !/^[-\w]{10,40}$/.test(msgId)) return out_({ok:false,err:'bad request'});
    const uid = verifyUser_(String(req.idToken||''));
    if(!uid) return out_({ok:false,err:'auth'});
    const msg = db_('talk/msgs/'+room+'/'+msgId);
    if(!msg || msg.uid !== uid) return out_({ok:false,err:'message'});
    // 같은 메시지로 두 번 보내지 않기
    const cache = CacheService.getScriptCache();
    if(cache.get('sent:'+msgId)) return out_({ok:true,dup:true});
    cache.put('sent:'+msgId,'1',600);

    const users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {}, mute = db_('talk/mute') || {};
    const sc = ROOM_SCOPE[room], targets = [];
    Object.keys(users).forEach(function(id){
      const u = users[id];
      if(!u || u.status!=='approved' || id===uid) return;
      if(sc && !(u.team===sc[0] && (!sc[1] || u.office===sc[1]))) return;
      if(mute[id] && mute[id][room]) return;
      const t = tokens[id] || {};
      Object.keys(t).forEach(function(k){ if(t[k] && t[k].token) targets.push({uid:id,key:k,token:t[k].token}); });
    });
    if(!targets.length) return out_({ok:true,sent:0});

    const at = accessToken_();
    const title = ROOM_NAME[room] + ' · ' + (msg.name||'');
    const body = String(msg.text||'').replace(/\s+/g,' ').slice(0,140);
    const reqs = targets.map(function(t){ return {
      url:'https://fcm.googleapis.com/v1/projects/'+P_('PROJECT_ID')+'/messages:send',
      method:'post', contentType:'application/json', muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+at},
      payload:JSON.stringify({message:{token:t.token,data:{room:room},
        webpush:{notification:{title:title,body:body,icon:APP_URL+'icons/icon-192.png',tag:'room-'+room,renotify:true},
                 fcm_options:{link:APP_URL+'#room-'+room}}}})
    };});
    const res = UrlFetchApp.fetchAll(reqs);
    let sent = 0;
    res.forEach(function(r,i){
      const c = r.getResponseCode();
      if(c===200){ sent++; return; }
      // 앱 삭제·알림 해제로 더 이상 쓸 수 없는 토큰만 정리
      if(c===404 || /UNREGISTERED/.test(r.getContentText())) dbDelete_('talk/tokens/'+targets[i].uid+'/'+targets[i].key);
    });
    return out_({ok:true,sent:sent,targets:targets.length});
  }catch(err){
    return out_({ok:false,err:String(err)});
  }
}

function doGet(){ return out_({ok:true,app:'FS Talk notify'}); }

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
  ['SA_JSON','API_KEY','PROJECT_ID','DB_URL'].forEach(function(k){ Logger.log(k+': '+(P_(k)?'있음':'❌ 없음')); });
  const users = db_('talk/users') || {}, tokens = db_('talk/tokens') || {};
  Logger.log('등록 사용자: '+Object.keys(users).length+'명 · 알림 켠 사용자: '+Object.keys(tokens).length+'명');
  Logger.log('✅ 서비스 계정 인증과 DB 읽기 성공');
}
