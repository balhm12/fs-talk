// 259: Slack 글이 한꺼번에 많이 올라올 때 — 6쪽(1300건)·시간 한도·rate limit·이름 조회 실패
// 하니스는 slack_pull.js 앞부분을 그대로 쓰되 conversations.history 를 실제처럼(최신부터, oldest·cursor 적용) 흉내 낸다.
const fs=require('fs'),assert=require('assert');
let h=fs.readFileSync(__dirname+'/slack_pull.js','utf8');
h=h.slice(0,h.indexOf('module.exports'));
h=h.replace("if(m==='conversations.history')r={ok:true,messages:hist[q.get('channel')]||[]};","if(m==='conversations.history'){const rr=HISTFN(q);if(rr.http)return {getContentText:()=>'{}',getResponseCode:()=>rr.http,getHeaders:()=>({'Retry-After':'1'})};r=rr;}");
h=h.replace("if(m==='users.info')r=","if(m==='users.info'&&USERFAIL.n>0){USERFAIL.n--;r={ok:false,error:'ratelimited'};}else if(m==='users.info')r=");
// 가짜 시계: DB 호출마다 0.4초 흐름
h=h.replace("const ctx={","let CLOCK=Date.now();const RD=Date;function FD(...a){return a.length?new RD(...a):new RD(CLOCK);}FD.now=()=>CLOCK;FD.prototype=RD.prototype;FD.UTC=RD.UTC;\nconst ctx={Date:FD,");
h=h.replace("fetch(u,o={}){calls.push(u);","fetch(u,o={}){calls.push(u);CLOCK+=400;");
h=h.replace("Utilities:{","Utilities:{sleep(){},");
const body=h+";module.exports={g,db,props,calls,cache,hist,sent,setClock:v=>CLOCK=v,getClock:()=>CLOCK};";
const M={exports:{}};
global.HISTFN=null;global.USERFAIL={n:0};
new Function('require','module','global','__dirname','HISTFN','USERFAIL',body.replace(/^const fs=require\('fs'\);/,'const fs=require("fs");'))(require,M,global,__dirname,q=>global.HISTFN(q),global.USERFAIL);
const {g,db,props,cache}=M.exports;
cache.at='tok';
const CH='C0C6U7RQ44D';
function mk(n,t0){const a=[];for(let i=0;i<n;i++)a.push({ts:(t0+i).toFixed(6),user:i%2?'U1':'U2',text:'테스트 글 '+i});return a;}
function pager(all){return q=>{let l=all.filter(m=>+m.ts>+(q.get('oldest')||0));l=l.sort((x,y)=>+y.ts-+x.ts);const lim=+q.get('limit')||100,off=+(q.get('cursor')||0);const part=l.slice(off,off+lim);return {ok:true,messages:part,response_metadata:{next_cursor:off+lim<l.length?String(off+lim):''}};};}
const t0=Math.floor(Date.now()/1000)-3000;
// A) 1300건 — 600건에서 끊기지 않고 모두 들어옴
let all=mk(1300,t0);global.HISTFN=q=>q.get('channel')===CH?pager(all)(q):{ok:true,messages:[]};
props['SLK_TS_'+CH]=String(t0-1);props.SLK_CHAN_BF_C0AT8RP3QDN=props.SLK_CHAN_BF_C0AHFJGKMTL=props['SLK_CHAN_BF_'+CH]='1';props.SLK_RESCAN_227=props.SLK_DEDUP_232=props.SLK_REQDUP_233=props.SLK_LINK_229=props.SLK_MIG_224='1';
for(let i=0;i<12;i++){g.slackPull(true);if(Object.keys(db.talk.msgs&&db.talk.msgs.sk_talk||{}).length>=1300)break;}
const n=Object.keys(db.talk.msgs.sk_talk).length;
assert.strictEqual(n,1300,'A) 1300건 모두 들어와야 함: '+n);
assert(+props['SLK_TS_'+CH]>=+all[1299].ts,'A) 읽은 시각이 끝까지 넘어감');
// B) 시간 한도 — 한 번에 다 못 하면 오래된 글부터 처리하고 나머지는 다음 분에(빠지는 글 없음)
Object.keys(db.talk.msgs.sk_talk).forEach(k=>delete db.talk.msgs.sk_talk[k]);
Object.keys(db.talk.msgs).forEach(r=>{if(r!=='sk_talk')delete db.talk.msgs[r];});
props['SLK_TS_'+CH]=String(t0-1);
g.slackPull(true);
const first=Object.keys(db.talk.msgs.sk_talk||{}).length;
assert(first>0&&first<1300,'B) 첫 번째 실행은 시간 한도로 일부만: '+first);
const done=Object.values(db.talk.msgs.sk_talk).map(v=>v.slk.ts).sort();
assert.strictEqual(done[done.length-1],all[first-1].ts.toString?all.slice().sort((x,y)=>+x.ts-+y.ts)[first-1].ts:'','B) 오래된 글부터 연속으로 처리');
assert(+props['SLK_TS_'+CH]<+all[1299].ts,'B) 읽은 시각은 처리한 데까지만');
for(let i=0;i<30;i++){g.slackPull(true);if(Object.keys(db.talk.msgs.sk_talk).length>=1300)break;}
assert.strictEqual(Object.keys(db.talk.msgs.sk_talk).length,1300,'B) 여러 번 돌면 하나도 빠지지 않음');
// C) 429 — 한 번 쉬고 다시 시도
let first429=true;const base=pager(all);global.HISTFN=q=>{if(q.get('channel')!==CH)return {ok:true,messages:[]};if(first429){first429=false;return {http:429};}return base(q);};
props['SLK_TS_'+CH]=String(t0+1295);delete db.talk.msgs.sk_talk;db.talk.msgs.sk_talk={};
g.slackPull(true);
assert(Object.keys(db.talk.msgs.sk_talk).length>=4,'C) 429 뒤 재시도로 가져옴: '+Object.keys(db.talk.msgs.sk_talk).length);
// D) 이름 조회 실패(ratelimited)는 저장하지 않음 — 다음 실행에서 이름이 들어감
all=[{ts:(t0+2000).toFixed(6),user:'U1',text:'이름 조회 시험'}];global.HISTFN=pager(all);
Object.keys(cache).forEach(k=>{if(k!=='at')delete cache[k];});USERFAIL.n=1;
g.slackPull(true);
const k1=Object.keys(db.talk.msgs.sk_talk).filter(k=>db.talk.msgs.sk_talk[k].text==='이름 조회 시험')[0];
assert(k1&&db.talk.msgs.sk_talk[k1].name==='Slack','D) 실패하면 임시로 Slack 이름');
assert(cache['slu:U1']===undefined,'D) 실패한 이름은 캐시에 저장 안 함');
console.log('slack_burst OK');
