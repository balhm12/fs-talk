// 대화 속 일정 제안(schSuggestParse) 시뮬레이션 — node tests/sched_suggest.js (실패 0이어야 함)
const fs=require('fs');const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const grab=(start,end)=>{const a=src.indexOf(start);const b=src.indexOf(end,a);return src.slice(a,b);};
const code=grab('function schParseDates(t){','function schSuggest(m){');
const pad=n=>String(n).padStart(2,"0");const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
function schAdd(d,n){const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+n);return ymd(x);}
eval(code);
const today=ymd(new Date());const names=['현준','허석','김보석','이인구','손흥민'];
const C=[
 // [글, 내글, 기대(null=칩없음 / 'work:휴가:2026-11-03' 형식 앞부분)]
 ['저 11/3 휴가 갑니다',1,'work:휴가'],['11/3 오전 반차 쓸게요',1,'work:오전휴가'],['11월 5일 오후휴가',1,'work:오후휴가'],
 ['내일 교육 XN 신규 과정 참석',1,'work:교육'],['11/4 회의 팀장회의',1,'work:회의'],['11/6~11/7 연차',1,'work:휴가'],['11/6~7 휴가입니다',1,'work:휴가'],
 ['11/3 휴가 갑니다',0,null],['11/3 김보석 휴가입니다',1,null],['11/3 휴가 가능할까요?',1,null],['11/3 휴가 취소했어요',1,null],['11/3 휴가 못 가요',1,null],
 ['10/1 휴가였어요',1,null],['XN 2.5배 빨라짐 교육',1,null],['1/2 정도 남았어요 회의',1,null],['v2.1 업데이트 교육',1,null],['3.5시간 교육',1,null],
 ['11월 10일 가나대학병원 XN-1000 설치 예정입니다',0,'inst:설치'],['11/12 다라의료원 XR 이전설치',0,'inst:이전'],['11/12 이전 설치 마바병원',0,'inst:이전'],
 ['11/5 이전에 자료 제출 바랍니다',0,null],['11/5 이전 버전으로 설치',0,null],['11/20 인사 평가 면담',1,null],['11/20 평가 일정 잡혔어요',0,null],
 ['11/20 서울대병원 UF-5000 평가',0,'inst:평가'],['11/8 데모 CN-6000 사라병원',0,'inst:데모'],['11/3 설치 완료했습니다 가나병원',0,null],
 ['내일 가나병원 XN 설치',0,'inst:설치'],['11/3 설치 예정',0,null],['13/40 휴가',1,null],['2/30 교육',1,null],['오늘 내근',1,'work:내근'],
 ['11/3 DP',1,'work:DP'],['11/3 휴가?',1,null],['11/3 휴가 안 가요',1,null],['/휴가 11/3',1,null],['12/31~1/2 휴가',1,'work:휴가'],
 ['11.3 휴가',1,'work:휴가'],['11.3.2 펌웨어 교육',1,null],['회의 11/7 오후 2시',1,'work:회의'],['11/7 14:00 회의',1,'work:회의'],
];
let fail=0;for(const [t,mine,exp] of C){const r=schSuggestParse(t,{mine:!!mine,today,me:'현준',names});
 const got=r?r.kind+':'+r.k:null;const ok=exp===null?got===null:got===exp;if(!ok)fail++;
 console.log((ok?'OK ':'XX ')+JSON.stringify(t).padEnd(42)+' → '+(r?JSON.stringify(r):'없음')+(ok?'':'   (기대 '+exp+')'));}
console.log('실패',fail,'/',C.length);
// 추가: 다른 사람 글·여러 경우
const X=[['현준님 11/3 교육 참석 부탁드려요',0,null],['11/3 가나병원 방문',1,null],['1/2 정도 남음 회의',1,null],['다음주 화요일 휴가',1,null],['11/3(월) 휴가',1,'work:휴가'],['11/3일 휴가',1,'work:휴가']];
let f2=0;for(const [t,mine,exp] of X){const r=schSuggestParse(t,{mine:!!mine,today,me:'현준',names});const got=r?r.kind+':'+r.k:null;const ok=exp===null?got===null:got===exp;if(!ok)f2++;console.log((ok?'OK ':'XX ')+t+' → '+(r?JSON.stringify(r):'없음'));}
console.log('추가 실패',f2);
