// 307: 「Slack 글 붙여넣기」로 링크 없이 넣은 요청 → 같은 병원·장비의 요청 채널 원래 글을 찾아 연결하고 그 글의 ✅(✔)를 읽는다
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const db=t.db,g=t.g,now=Date.now()/1000,N=Date.now();
const CSO='C0AT8RP3QDN',NIGHT='C0AHFJGKMTL';
const form=(h,e,q,head)=>(head===undefined?'<기술요청><인계 : FS WEST>':head)+'\n1) 기 관 명 : '+h+'\n2) 장 비 명 : '+e+'\n3) 요청사항 : '+q+'\n6) 회 신 처 : 테스트9';
const ack=n=>[{name:n||'heavy_check_mark',users:['U2']}];
const T=s=>(now-s).toFixed(6);
t.hist[CSO]=[
  {ts:T(3600),user:'U1',text:form('테스트군립병원','XR-10','정기점검 요청','@fswest 재인입되었습니다.'),reactions:ack()},            // A: 머리말이 달라 자동으로 안 들어온 글 — 붙여넣은 요청의 원래 글
  {ts:T(3000),user:'U1',text:form('테스트도립병원','XN-550','프린터 문의'),reactions:[]},                                        // B: ✅ 없음 — 연결만
  {ts:T(90000),user:'U1',text:form('테스트시립병원','CA-600','오래된 건'),reactions:ack('white_check_mark')},                       // C: 붙여넣기 25시간 전 — 너무 오래됨
  {ts:T(2000),user:'U1',text:form('테스트읍립병원','XN-1000','이미 묶인 글'),reactions:ack()},                                    // D: 다른 요청이 이미 가리킴
  {ts:T(5000),user:'U1',text:form('테스트면립병원','UF-5000','다른 요청사항'),reactions:[]},                                       // E1: 같은 병원·장비, 요청사항 다름
  {ts:T(4000),user:'U1',text:form('테스트면립병원','UF-5000','같은 요청사항'),reactions:ack()},                                    // E2: 요청사항까지 같음 → 이 글
  {ts:T(1000),user:'U1',text:form('테스트리립병원','XN-350','야간 채널에 붙일 건'),reactions:ack()}];                                // F: CSO 채널 글 — CS쉐어링으로 붙여넣은 요청에는 쓰지 않음
t.hist[CSO].push({ts:T(2500),user:'U1',text:form('테스트구립병원','XN-2000','이미 확인한 붙여넣기'),reactions:ack()});   // H: 이미 포털에서 확인한 붙여넣기의 원래 글
t.hist[NIGHT]=[];
const P=(h,e,q,o)=>Object.assign({kind:'paste',src:'cso',st:'new',at:N-1800e3,t:'x',pb:'테스트1',f:{hosp:h,eq:e,req:q}},o||{});
db.talk.slack.req={
  p_A:P('테스트군립병원','XR-10','정기점검 요청'),
  p_B:P('테스트도립병원','XN-550','프린터 문의'),
  p_C:P('테스트시립병원','CA-600','오래된 건'),
  p_D:P('테스트읍립병원','XN-1000','이미 묶인 글'),
  cso_dD:{kind:'cso',ch:CSO,ts:t.hist[CSO][3].ts,st:'done',doneBy:'테스트2',ackDone:true,ack:{n:'테스트2',at:N-1900e3},at:N-2000e3,t:'x',f:{hosp:'테스트읍립병원',eq:'XN-1000',req:'이미 묶인 글'}},
  p_E:P('테스트면립병원','UF-5000','같은 요청사항'),
  p_F:P('테스트리립병원','XN-350','야간 채널에 붙일 건',{src:'night'}),
  p_G:P('테스트동립병원','XN-9000','원래 글 없음'),
  p_H:P('테스트구립병원','XN-2000','이미 확인한 붙여넣기',{ack:{n:'테스트3',at:N-100e3},st:'done',doneBy:'테스트3',at:N-1700e3})};
g.slkSync_({});
const S=db.talk.slack.req;
assert(S.p_A.ch===CSO&&S.p_A.ts===t.hist[CSO][0].ts,'붙여넣은 요청 → 원래 글로 연결 '+JSON.stringify(S.p_A));
assert(S.p_A.ack&&!S.p_A.ack.via&&S.p_A.st==='done'&&S.p_A.ackDone,'원래 글의 ✔(heavy_check_mark) → 확인 완료 '+JSON.stringify(S.p_A));
assert(S.p_B.ch===CSO&&S.p_B.ts===t.hist[CSO][1].ts&&!S.p_B.ack&&S.p_B.st==='new','✅ 없는 원래 글은 연결만 '+JSON.stringify(S.p_B));
assert(!S.p_C.ch&&!S.p_C.ack,'24시간보다 오래된 글은 연결하지 않음 '+JSON.stringify(S.p_C));
assert(!S.p_D.ch||S.p_D.ts!==t.hist[CSO][3].ts,'다른 요청이 가리키는 글은 가져오지 않음 '+JSON.stringify(S.p_D));
assert(S.p_E.ts===t.hist[CSO][5].ts&&S.p_E.ack,'같은 병원·장비가 여럿이면 요청사항까지 같은 글 '+JSON.stringify(S.p_E));
assert(!S.p_F.ch&&!S.p_F.ack,'종류가 다른 채널 글은 쓰지 않음 '+JSON.stringify(S.p_F));
assert(!S.p_G.ch&&S.p_G.st==='new','원래 글이 없으면 그대로 '+JSON.stringify(S.p_G));
assert(!S.p_H.ch,'이미 확인·완료한 붙여넣기는 건드리지 않음 '+JSON.stringify(S.p_H));
// 다시 돌려도 그대로(연결은 한 번)
const snap=JSON.stringify(S);g.slkSync_({});assert(JSON.stringify(db.talk.slack.req.p_B)===JSON.stringify(JSON.parse(snap).p_B),'다시 돌려도 같은 연결');
console.log('slack_paste_link ok');
