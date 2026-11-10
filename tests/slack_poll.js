// 258: Slack 가져오기 호출 수 — 이벤트가 오고 있으면 시간 트리거는 5분마다만, 평소에도 매분 읽기·쓰기 줄이기
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const RD=Date;function at(minute){global.Date=class extends RD{constructor(...a){if(a.length){super(...a);}else{super();this.setMinutes(minute);}}static now(){return RD.now();}};}
function run(minute,opt){at(minute);t.calls.length=0;t.g.slackPull(undefined,opt);global.Date=RD;return t.calls.length;}
t.g.slackPull(true);                      // 처음(채우기·한 번 작업)
delete t.props.SLK_EV_AT;
const idle1=run(1), idle5=run(5);
console.log('이벤트 없음: 매분',idle1,'회 · 5분째',idle5,'회');
assert(idle1<=6,'이벤트 없을 때 한 번에 6회 이하 (예전 8회): '+idle1);
assert(idle5<=7,'5분째(상태 기록 포함) 7회 이하: '+idle5);
t.props.SLK_EV_AT=String(RD.now()-3600e3);  // 1시간 전 이벤트 → 이벤트로 받는 중
const ev1=run(1), ev5=run(5);
console.log('이벤트 받는 중: 매분',ev1,'회 · 5분째',ev5,'회');
assert(ev1===0,'이벤트 받는 중이면 1분 트리거는 호출 0: '+ev1);
assert(ev5>0,'5분마다는 빠진 것 줍기');
t.cache.slkSyncPend='1';assert(run(2)>0,'이벤트가 못 한 확인 맞추기는 다음 1분에 바로');delete t.cache.slkSyncPend;
t.props.SLK_EV_AT=String(RD.now()-13*3600e3);  // 12시간 넘게 이벤트 없음 → 1분 확인으로 복귀
assert(run(1)>0,'이벤트가 끊기면 1분 확인으로 돌아감');
const m=t.db.talk.slack.meta;assert(m.ok&&!m.err&&m.chans,'상태 기록 정상');
const day=idle1*1440, dayEv=ev5*288;
console.log('하루 예상(새 글 없을 때): 이벤트 없음 약',day,'회 · 이벤트 사용 약',dayEv,'회 (예전 11,520)');
// 261: 시스템 상태 — 오늘 외부 호출 수·자동 실행 횟수를 meta.stat 에
t.calls.length=0;delete t.props.SLK_EV_AT;for(const k of Object.keys(t.cache))if(k.startsWith('st:'))delete t.cache[k];delete t.props.SLK_STAT;
run(1);run(2);const n2=0;at(5);t.calls.length=0;t.g.slackPull();global.Date=RD;
const st=t.db.talk.slack.meta.stat;
assert(st&&st.runs===3&&st.f>=12&&st.ex===3,'meta.stat 에 오늘 실행 3번·외부 호출 수: '+JSON.stringify(st));
assert(JSON.parse(t.props.SLK_STAT).f===st.f,'스크립트 속성에도 저장(캐시가 지워져도 이어서 셈)');
console.log('오늘 사용량 기록:',JSON.stringify(st));
console.log('slack_poll 258·261: 통과');
