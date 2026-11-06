// Slack 요청 양식 나누기 시험 (가명 데이터) — node tests/slack_parse.js
const src=require('fs').readFileSync(__dirname+'/../apps-script/notify.gs','utf8');
const pick=n=>{const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&!--d)break;}return src.slice(i,j+1);};
eval(['slkClean_','slkParse_','slkPerson_'].map(pick).join('\n'));
let fail=0;const eq=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b)){fail++;console.log('✗',m,'\n  got',JSON.stringify(a),'\n  exp',JSON.stringify(b));}else console.log('✓',m);};
const cso=`<!subteam^S0AAAA>\n<기술요청><인계 : FS SOUTH >\n1) 기 관 명           : 테스트1병원\n2) 장 비 명 \t    : XN-1000\n3) 요청사항         : 프린터기 연결 문의\n4) Error/증상       :\nSN: A0000 프린터 연결이 불안정\n설정이 안됨\n5) 확인/조치사항 : 확인 후 연락드리기로 함.\n6) 회 신 처 \t    : 테스트2 <tel:01000000000|0100000-0000>`;
let f=slkParse_(slkClean_(cso));
eq([f.team,f.hosp,f.eq,f.req],['FS SOUTH','테스트1병원','XN-1000','프린터기 연결 문의'],'CSO 양식 칸');
eq(f.sym,'SN: A0000 프린터 연결이 불안정\n설정이 안됨','증상 여러 줄');
eq(f.contact,'테스트2 0100000-0000','회신처 전화 정리');
const cso2=`< 기술 요청 >< 인계 : FS WEST >\n1) 기 관 명 : 테스트3병원\n2) 장 비 명 : SP-10\n3) 요청사항 :\n- 장비 셧다운함\n- 염색제1 에러\n4) Error/증상 :\n5) 확인/조치사항 :\n- FS WEST 전달\n6) 회 신 처 : 테스트4`;
f=slkParse_(slkClean_(cso2));eq([f.team,f.eq,f.req,f.sym],['FS WEST','SP-10','- 장비 셧다운함\n- 염색제1 에러',undefined],'목록형 요청사항·빈 증상');
const cso3=`< 기술요청 >< 인계 : FS EAST >\n1. 기 관 명           : 테스트5병원\n2. 장 비 명 \t    : CS-5100\n3. 요청사항         : 장비 에러\n4. Error/증상       : 검체 에러`;
f=slkParse_(cso3);eq([f.team,f.hosp,f.eq,f.sym],['FS EAST','테스트5병원','CS-5100','검체 에러'],'1. 번호 형식');
const night=`<@U0AAA|테스트6(Juno)> \nHLC-723 / 파란 화면\n=====\n[CS쉐어링 접수] [인계 : L0]\n1. 기 관 명(지역) : 테스트7병원 (제주)\n2. 장 비 명 : HLC-723\n3. 요청사항 : 정전 후 파란 화면\n4. 확인/조치사항 : 담당자 전달\n5. 회신여부 [Y]\n• 회신기간 : 즉시 통화 요청\n• 회신고객성함, 연락처 : 테스트8 / <tel:01011112222|0101111-2222>\n6. 접수처 : 테스트8 / 0101111-2222`;
f=slkParse_(slkClean_(night));eq([f.lvl,f.hosp,f.area,f.eq,f.back,f.when],['L0','테스트7병원','제주','HLC-723','Y','즉시 통화 요청'],'야간 접수 양식');
eq(slkPerson_('테스트6(Juno)'),'테스트6','이름 영문 별칭 빼기');
eq(slkParse_('테스트병원 마칩니다\n• XN pm'),null,'양식 아닌 글은 요청 아님');
eq(slkParse_('CSO Team 응대 접수 시작: AM 8:00 부터'),null,'안내 글은 요청 아님');

// 포털(index.html)의 붙여넣기 나누기 — 서버와 같은 함수인지, 여러 건·앞 줄(@담당자) 처리
const html=require('fs').readFileSync(__dirname+'/../index.html','utf8');
const pickH=n=>{const i=html.indexOf('function '+n+'(');if(i<0)return '';let d=0,j=html.indexOf('{',i);for(;j<html.length;j++){if(html[j]==='{')d++;else if(html[j]==='}'&&!--d)break;}return html.slice(i,j+1);};
['slkClean_','slkParse_','slkPerson_'].forEach(n=>eq(pickH(n),pick(n),'포털·서버 '+n+' 같음'));
eval(pickH('slkSplit'));
const copied=`테스트9  오후 3:21\n@테스트6(Juno) HLC-723 / 파란 화면\n=====\n[CS쉐어링 접수] [인계 : L0]\n1. 기 관 명(지역) : 테스트7병원 (제주)\n2. 장 비 명 : HLC-723\n3. 요청사항 : 정전 후 파란 화면\n=====\n@테스트10 XN 셧다운\n[CS쉐어링 접수] [인계 : L1]\n1. 기 관 명(지역) : 테스트11병원 (부산)\n2. 장 비 명 : XN-1000\n3. 요청사항 : 셧다운 안 됨\n(편집됨)`;
let sp=slkSplit(copied);
eq(sp.map(x=>[x.src,x.f.hosp,x.f.lvl,x.mention]),[['night','테스트7병원','L0','테스트6'],['night','테스트11병원','L1','테스트10']],'붙여넣기 여러 건·담당자');
sp=slkSplit(cso);eq(sp.map(x=>[x.src,x.f.team,x.f.hosp]),[['cso','FS SOUTH','테스트1병원']],'붙여넣기 CSO 한 건');
eq(slkSplit('테스트병원 마칩니다').length,0,'붙여넣기 양식 아님');
const mixed=`테스트7  오후 2:10\n<기술요청><인계 : FS WEST >\n1) 기 관 명 : 테스트14병원\n2) 장 비 명 : XR-1000\n3) 요청사항 : QC 에러 문의\n6) 회 신 처 : 테스트15 010-2222-3333\n\n테스트10  오후 11:40\n@테스트6(Ray) XN 셧다운\n=====\n[CS쉐어링 접수] [인계 : L1]\n1. 기 관 명(지역) : 테스트16병원 (대전)\n2. 장 비 명 : XN-550\n3. 요청사항 : 셧다운 안 됨`;
sp=slkSplit(mixed);
eq(sp.map(x=>[x.src,x.f.hosp,x.f.contact||'',x.mention]),[['cso','테스트14병원','테스트15 010-2222-3333',''],['night','테스트16병원','','테스트6']],'Slack 복사본: 다음 글 머리(이름·시각·@담당자)는 다음 건으로');
// 200: #group-sysmex-talk 글이 들어갈 방 (가명 명단)
eval(/const ROOM_SCOPE = [^\n]*/.exec(src)[0].replace('const ','var '));eval(pick('slkRoomFor_'));
const RS={"FS WEST":{"테스트1":{o:"",lead:true}},"FS CENTRAL":{"테스트2":{o:"대전"},"테스트3":"광주","테스트4":""},"FS SOUTH":{"테스트5":"부산"},"FSS Team":{"테스트6":""},"FSOM Team":{"테스트1":""}};
eq(['테스트2','테스트3','테스트4','테스트5','테스트6','테스트1','테스트99'].map(n=>slkRoomFor_(n,RS)),['daejeon','gwangju','central','busan','fss','all','all'],'Slack 글 방: 사무소방 > 팀방, 동명이인·명단 없음은 전체방');
// 202: 실마리 대조 함수가 포털에 있는지(지어낸 검색어 함수 slkQuery 는 없어야 함)
eq(!!pickH('slkSil')&&!pickH('slkQuery'),true,'요청 → 실마리 사전 대조만');
// 202: Slack 표시 이름 앞머리(팀·회사) 빼기 — 명단 이름과 맞추기
eq(['FS EAST 윤테스트','SKR FS 테스트30','SKR FS Central 테스트31','FS East 테스트32','테스트33(Woody)','이테스트 (Matt)'].map(slkPerson_),['윤테스트','테스트30','테스트31','테스트32','테스트33','이테스트'],'이름 앞머리·영문 별칭 빼기');
// 203: 연결 전 미리보기의 방 고르기(포털)가 서버 slkRoomFor_ 와 같은지
{const rl=()=>{const out=[];Object.keys(RS).forEach(t=>{const g=RS[t];Object.keys(g).forEach(n=>{const v=g[n];out.push({team:t,name:n,office:typeof v==='string'?v:(v&&v.o)||''});});});return out;};
 const f=new Function('rosterList','ROOM_SCOPE','return ('+pickH('slkRoomForC')+')');const C=f(rl,ROOM_SCOPE);
 eq(['테스트2','테스트3','테스트4','테스트5','테스트6','테스트1','테스트99'].map(n=>C(n).id),['테스트2','테스트3','테스트4','테스트5','테스트6','테스트1','테스트99'].map(n=>slkRoomFor_(n,RS)),'미리보기 방 = 서버 방');}
// 205: Slack 요청함 바꾸기(붙여넣기·담당·회신·완료·삭제)는 관리자만 — 규칙·서버·화면 세 곳
{const rules=JSON.parse(require('fs').readFileSync(__dirname+'/../database.rules.json','utf8'));const w=rules.rules.talk.slack.req.$id['.write'];
 eq(/talk\/admins\//.test(w)&&/status'\)\.val\(\) === 'approved'/.test(w),true,'규칙: 요청함 쓰기 = 승인된 관리자');
 eq(/talk\/admins\/'\+uid\) !== true/.test(pick('slackAct_')),true,'서버 slackAct_: 관리자 확인');
 eq(/if\(!isAdmin\)/.test(pickH('slkDo'))&&/if\(!isAdmin\)return/.test(pickH('openSlkPaste')),true,'화면: 직원은 확인만');}
console.log(fail?fail+'개 실패':'모두 통과');process.exit(fail?1:0);
