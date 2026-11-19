// 308: 「재인입」 글 — 사진·파일이 붙은 글(file_share)·예전 요청 글을 공유(전달)한 글도 요청으로, 이름이 포함 관계인 같은 병원은 조건부로 함께 확인
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,g=t.g,now=Date.now()/1000,N=Date.now();
const CSO='C0AT8RP3QDN';
const form=(h,e,q,team)=>'<기술요청><인계 : FS '+(team||'WEST')+' >\n1) 기 관 명 : '+h+'\n2) 장 비 명 : '+e+'\n3) 요청사항 : '+q+'\n6) 회 신 처 : 테스트9';
const T=s=>(now-s).toFixed(6);
const byHosp=h=>Object.keys(db.talk.slack.req).map(k=>Object.assign({id:k},db.talk.slack.req[k])).filter(r=>r.f&&r.f.hosp===h);
db.talk.slack.req={};
t.hist[CSO]=[
  {ts:T(500),user:'U1',subtype:'file_share',files:[{id:'F1'}],text:'재인입되었습니다.\n=============================\n'+form('테스트군립병원','XR-10','정기점검 요청')},   // 사진이 붙은 글
  {ts:T(400),user:'U1',text:'PM일정 연락받지 못한 내용으로 재인입되었습니다.',attachments:[{is_share:true,text:form('테스트도립병원','XN-550','PM 일정 문의')}]},   // 예전 글 공유
  {ts:T(300),user:'U1',text:'아래 건 완료되었습니다.',attachments:[{is_share:true,text:form('테스트시립병원','CA-600','끝난 건')}]},                       // 완료 안내 + 공유 → 요청 아님
  {ts:T(200),user:'U1',subtype:'file_share',files:[{id:'F2'}],text:'캡처 공유드립니다'},                                                              // 양식 없는 사진 글 → 요청 아님
  {ts:T(100),user:'U1',subtype:'channel_join',text:form('테스트읍립병원','XN-1000','들어옴 글')}];                                                     // 그 밖의 subtype 은 그대로 건너뜀
t.hist['C0AHFJGKMTL']=[];t.hist['C0C6U7RQ44D']=[];
g.slackPull(true);
assert(!db.talk.slack.meta.err,'가져오기 오류 없음: '+db.talk.slack.meta.err);
{const a=byHosp('테스트군립병원');assert(a.length===1&&a[0].ts===t.hist[CSO][0].ts&&a[0].f.eq==='XR-10','사진이 붙은 글도 요청으로 '+JSON.stringify(a));}
{const a=byHosp('테스트도립병원');assert(a.length===1&&a[0].ts===t.hist[CSO][1].ts&&a[0].ch===CSO&&a[0].f.req==='PM 일정 문의','공유한 글의 양식으로 요청, 원래 글 = 재인입 글 '+JSON.stringify(a));
 assert(/재인입/.test(a[0].t),'안내 문장도 원문에 남음');}
assert(!byHosp('테스트시립병원').length,'완료 안내 + 공유는 요청 아님');
assert(!byHosp('테스트읍립병원').length,'들어옴·나감 글은 그대로 건너뜀');
assert(Object.keys(db.talk.slack.req).length===2,'요청 2건만 '+Object.keys(db.talk.slack.req).length);
// 재인입 글에 ✔ → 확인
t.hist[CSO][1].reactions=[{name:'heavy_check_mark',users:['U2']}];
g.slkSync_({});
{const a=byHosp('테스트도립병원')[0];assert(a.ack&&a.st==='done','재인입 글의 ✔ → 확인 완료 '+JSON.stringify(a));}
console.log('slack_reentry ok');

// 이름이 포함 관계인 같은 병원 — 조건부로 함께 확인
{const A=N-3*36e5,K=N-36e5;   // 붙여넣은 요청 3시간 전, 확인 1시간 전
 const P=(h,e,team,o)=>Object.assign({kind:'paste',src:'cso',st:'new',at:A,t:'x',pb:'테스트1',f:{hosp:h,eq:e,req:'정기점검 요청',team:team||'FS WEST'}},o||{});
 const D=(h,e,team,o)=>Object.assign({kind:'cso',ch:CSO,ts:'9.'+Math.random().toString().slice(2,8),st:'done',doneBy:'테스트2',ackDone:true,ack:{n:'테스트2',at:K},at:K-12e4,t:'x',f:{hosp:h,eq:e,req:'에러 문의',team:team||'FS WEST'}},o||{});
 t.hist[CSO]=[];
 db.talk.slack.req={
  p_ok:P('테스트세종병원','XR-10'),            d_ok:D('인천테스트세종병원','XR-10'),                    // 뒤에 그대로 들어 있음 → 함께 확인
  p_team:P('테스트한빛병원','XN-550','FS EAST'), d_team:D('강남테스트한빛병원','XN-550','FS WEST'),        // 팀이 다름
  p_eq:P('테스트누리병원','XN-1000'),          d_eq:D('분당테스트누리병원','XN-2000'),                  // 장비가 다름
  p_amb:P('테스트다온병원','CA-600'),          d_amb:D('부천테스트다온병원','CA-600'), x_amb:D('인천테스트다온병원','UF-5000',null,{at:A-36e5}),   // 짧은 이름을 품은 다른 병원이 또 있음
  p_short:P('가나병원','XN-350'),             d_short:D('다라가나병원','XN-350',null,{}),              // 짧은 쪽 4자 — 통과
  p_3:P('가나의','XN-450'),                  d_3:D('다가나의','XN-450'),                            // 짧은 쪽 3자 → 안 함
  p_mid:P('테스트솔병원','XN-9000'),          d_mid:D('새테스트솔병원분원','XN-9000'),                 // 가운데에만 들어 있음 → 안 함
  p_area:P('테스트별병원','XN-3000',null,{}),  d_area:D('서울테스트별병원','XN-3000'),
  p_late:P('테스트달병원','XN-L',null,{at:K+36e5}), d_late:D('광주테스트달병원','XN-L')};                // 확인 뒤에 온 요청
 db.talk.slack.req.p_area.f.area='경기';db.talk.slack.req.d_area.f.area='서울';
 g.slkSync_({});const S=db.talk.slack.req;
 assert(S.p_ok.ack&&S.p_ok.ack.via==='d_ok'&&S.p_ok.ack.sim==='인천테스트세종병원'&&S.p_ok.st==='done','이름이 뒤에 들어 있는 같은 병원 → 함께 확인(표시 남김) '+JSON.stringify(S.p_ok));
 assert(S.p_short.ack&&S.p_short.ack.sim,'짧은 쪽 4자는 묶음 '+JSON.stringify(S.p_short));
 for(const [k,why] of [['p_team','담당 팀이 다름'],['p_eq','장비가 다름'],['p_amb','후보 병원이 둘'],['p_3','짧은 쪽 3자'],['p_mid','가운데에만 포함'],['p_area','지역 표시가 다름'],['p_late','확인 뒤에 온 요청']])
   assert(!S[k].ack&&S[k].st==='new',why+' → 묶지 않음 '+JSON.stringify(S[k]));
 console.log('slack_reentry 이름 묶기 ok');}
