// 290: 학술요청 집계 — 종류(학술·기술·그 밖)·시간대(평일 주간·평일 야간·주말)·CS쉐어링 묶음 글·머리말 전달·관리자만
const assert=require('assert');const t=require('./slack_pull.js');t.cache.at='tok';
const {g,db,hist,props}=t;
db.talk.users=db.talk.users||{};db.talk.admins=db.talk.admins||{};
db.talk.users.uA={name:'테스트1',team:'FSS Team',status:'approved'};db.talk.admins.uA=true;
db.talk.users.uB={name:'테스트2',team:'FS WEST',status:'approved'};
// 한국 시간 기준 시각 만들기(지난 월요일 기준)
const kst=(dayOff,h)=>{const n=new Date(Date.now()+9*3600e3);const wd=(n.getUTCDay()+6)%7;const base=Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()-wd-7);return (base+dayOff*864e5+h*3600e3-9*3600e3)/1000;};
assert.strictEqual(g.slkStatBand_(kst(0,10)*1000),'wd','월 10시 = 평일 주간');
assert.strictEqual(g.slkStatBand_(kst(0,20)*1000),'wn','월 20시 = 평일 야간');
assert.strictEqual(g.slkStatBand_(kst(1,7)*1000),'wn','화 07시 = 평일 야간');
assert.strictEqual(g.slkStatBand_(kst(5,10)*1000),'we','토 = 주말');
const acad='&lt;학술요청&gt;&lt;인계 : CSO&gt;\n1) 기 관 명 : 테스트병원\n2) 장 비 명 : XN-1000\n3) 요청사항 : 참고치 문의';
const tech='&lt;기술요청&gt;&lt;인계 : FS WEST&gt;\n1) 기 관 명 : 테스트병원\n2) 장 비 명 : CN-6000\n3) 요청사항 : 에러';
const fwd='CSO Team 먼저 인계드렸으나, FS WEST 전달드립니다\n=====\n'+acad;
const blk=(h,e,q)=>'[CS쉐어링 접수] [인계 : L0]\n1. 기 관 명(지역) : '+h+' (서울)\n2. 장 비 명 : '+e+'\n3. 요청사항 : '+q;
const night='<@U0AAA|테스트6> XN\n=====\n'+blk('테스트의원','XN-550','학술 문의 - 결과 해석')+'\n=====\n'+blk('테스트병원','UF-5000','에러');
hist.C0AT8RP3QDN=[{ts:kst(0,10).toFixed(6),user:'U1',text:acad},{ts:kst(0,20).toFixed(6),user:'U1',text:acad},{ts:kst(1,11).toFixed(6),user:'U1',text:tech},
  {ts:kst(2,22).toFixed(6),user:'U1',text:fwd},{ts:kst(2,22.5).toFixed(6),user:'U2',text:'답글',thread_ts:kst(2,22).toFixed(6)},{ts:kst(3,9).toFixed(6),user:'U1',text:'&lt;완료 : 테스트병원&gt; 처리했습니다'}];
hist.C0AHFJGKMTL=[{ts:kst(5,2).toFixed(6),user:'U3',text:night},{ts:kst(6,23).toFixed(6),user:'U3',text:blk('테스트병원','CN-6000','학술요청 시약')}];
let r=g.slackStats_({idToken:'tok-uB',days:28});assert(!r.ok&&/관리자/.test(r.err),'직원은 거절');
r=g.slackStats_({idToken:'tok-uA',days:28});assert(r.ok,JSON.stringify(r));
const C=r.ch.cso,N=r.ch.night;
assert.strictEqual(C.msgs,5,'CSO 맨 위 글 5(답글 제외)');
assert.deepStrictEqual(C.acad,{wd:1,wn:2,we:0},'CSO 학술 '+JSON.stringify(C.acad));
assert.deepStrictEqual(C.tech,{wd:1,wn:0,we:0});assert.deepStrictEqual(C.etc,{wd:1,wn:0,we:0},'완료 글은 그 밖');
assert.strictEqual(C.fwd,1,'머리말로 FS 전달 1');
assert.strictEqual(N.msgs,2);assert.strictEqual(N.blocks,3,'묶음 글은 접수 건마다');
assert.deepStrictEqual(N.acad,{wd:0,wn:0,we:2},'야간 학술 '+JSON.stringify(N.acad));assert.deepStrictEqual(N.tech,{wd:0,wn:0,we:1});
assert.strictEqual(r.eq.XN,3,'장비 XN 3 '+JSON.stringify(r.eq));assert.strictEqual(r.eq['XN-L'],1,'XN-550 → XN-L');assert.strictEqual(r.eq.CN,1);
assert.deepStrictEqual(r.eqB.XN,{wd:1,wn:2,we:0},'XN 시간대 '+JSON.stringify(r.eqB));assert.deepStrictEqual(r.eqB['XN-L'],{wd:0,wn:0,we:1});assert.deepStrictEqual(r.eqB.CN,{wd:0,wn:0,we:1});
assert(!JSON.stringify(r).includes('테스트병원'),'병원 이름 안 돌려줌');assert(!JSON.stringify(r).includes('테스트1'),'이름 안 돌려줌');
const W=Object.values(r.week).reduce((a,w)=>a+w.acad,0);assert.strictEqual(W,5,'주별 학술 합 5');
assert.deepStrictEqual(r.fld['혈액'],{wd:1,wn:2,we:1},'혈액 '+JSON.stringify(r.fld));assert.deepStrictEqual(r.fld['응고'],{wd:0,wn:0,we:1});
// 291: 미분류 목록·직접 정한 분야
delete props.SLK_STAT_BF;   // 새 글이 7일보다 앞일 수 있어 다시 채움
hist.C0AT8RP3QDN.push({ts:kst(4,21).toFixed(6),user:'U1',text:'&lt;학술요청&gt;&lt;인계 : CSO&gt;\n1) 기 관 명 : 테스트의원\n3) 요청사항 : 참고치 문의 010-1234-5678'});
r=g.slackStats_({idToken:'tok-uA',days:28});
const u=r.unk.find(x=>/참고치/.test(x.req)&&x.hosp==='테스트의원');assert(u,'미분류 목록에 나옴 '+JSON.stringify(r.unk));assert(!/5678/.test(u.req)||/\*\*\*\*/.test(u.req),'전화번호 가림 '+u.req);
const un0=r.fld['미분류']?r.fld['미분류'].wn:0;
db.talk.slack.acadfld={[u.k]:'면역'};r=g.slackStats_({idToken:'tok-uA',days:28});
assert.strictEqual((r.fld['미분류']||{wn:0}).wn,un0-1,'직접 정하면 미분류에서 빠짐');assert.strictEqual(r.fld['면역'].wn,1,'면역으로');assert.strictEqual(r.manual,1);
assert(r.unk.find(x=>x.k===u.k&&x.fld==='면역'),'직접 정한 것도 목록에(바꿀 수 있게)');
// 292: 야간 접수 지역 × 수탁기관·병원
{const N=Date.now();db.talk.slack.req={
 night_n1:{kind:'night',at:N-3600e3,f:{hosp:'GC녹십자의료재단',area:'경기'},mv:{n:'테스트2',at:N}},
 night_n2:{kind:'night',at:N-3600e3,f:{hosp:'테스트병원 (부산)'}},
 night_n3:{kind:'night',at:N-3600e3,f:{hosp:'씨젠의료재단',area:'대전'},autoFin:true},
 night_n4:{kind:'night',at:N-3600e3,f:{hosp:'테스트의원'}},
 cso_c1:{kind:'cso',at:N-3600e3,f:{hosp:'테스트병원'}}};
 r=g.slackStats_({idToken:'tok-uA',days:28});const Ng=r.night;
 assert.deepStrictEqual(Ng.ew,{lab:{n:1,v:1},hosp:{n:0,v:0}},'수도권 수탁 '+JSON.stringify(Ng));
 assert.deepStrictEqual(Ng.central.lab,{n:1,v:1});assert.deepStrictEqual(Ng.south.hosp,{n:1,v:0});assert.deepStrictEqual(Ng['-'].hosp,{n:1,v:0});
 assert(!JSON.stringify(Ng).includes('cso'),'CSO 제외');}
// 293: 검사 코드로 분야 유추(장비 없는 글)
const F=g.slkStatFld_;
assert.strictEqual(F('-','PT, APTT 참고치 문의'),'응고');assert.strictEqual(F('-','혈액응고 검사 결과'),'응고','혈액응고 = 응고');
assert.strictEqual(F('-','HBsAg 결과 해석'),'면역');assert.strictEqual(F('-','TSH, FT4 값 차이'),'면역');
assert.strictEqual(F('-','요침사 RBC 결과'),'뇨화학','요침사 + RBC → 뇨화학');assert.strictEqual(F('-','KET, BLD 양성'),'뇨화학');
assert.strictEqual(F('-','WBC, PLT 낮게 나옴'),'혈액');assert.strictEqual(F('-','D-dimer 상승'),'응고');
assert.strictEqual(F('-','참고치 문의'),'미분류');assert.strictEqual(F('CN','WBC'),'응고','장비가 있으면 장비군');
assert.strictEqual(F('-','APPT 확인'),'미분류','오타는 모름');
// 293: 쌓아 두기 — Slack 기록에서 사라져도 포털 DB 의 기록으로 셈
const st=db.talk.slack.stat||{};assert(Object.keys(st).length>=9,'stat 기록 '+Object.keys(st).length);
const one=Object.values(st).find(v=>v.k==='a'&&/010-/.test(v.q));assert(one&&/\*\*\*\*/.test(one.q)&&!/1234/.test(one.q),'기록의 전화번호 가림');
assert(!Object.values(st).some(v=>v.k!=='a'&&(v.q||v.h)),'학술 아닌 글은 본문 안 남김');
const before=g.slackStats_({idToken:'tok-uA',days:28});
hist.C0AT8RP3QDN=[];hist.C0AHFJGKMTL=[];
r=g.slackStats_({idToken:'tok-uA',days:28});
assert.deepStrictEqual(r.ch.cso.acad,before.ch.cso.acad,'Slack 에서 사라져도 그대로');assert.strictEqual(r.ch.night.blocks,before.ch.night.blocks);
r=g.slackStats_({idToken:'tok-uA',days:0});assert(r.ok&&r.days===0&&r.since,'전체 기간·누적 시작 '+r.since);
// 293: slackPull 이 새 글마다 기록을 남김
{const ts=(Date.now()/1000-30).toFixed(6);hist.C0AT8RP3QDN=[{ts,user:'U1',text:'&lt;학술요청&gt;&lt;인계 : CSO&gt;\n1) 기 관 명 : 테스트삼병원\n3) 요청사항 : PT 결과 문의'}];
 g.slackPull(true);const k='cso_'+ts.replace('.','');assert(db.talk.slack.stat[k]&&db.talk.slack.stat[k].k==='a','slackPull 기록 '+k);
 r=g.slackStats_({idToken:'tok-uA',days:7});assert.strictEqual(r.fld['응고'].wd+r.fld['응고'].wn+r.fld['응고'].we>=1,true,'검사 코드 PT → 응고');}
console.log('slack_stats ok');
