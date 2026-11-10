// 261: 글을 모아 멀티패스 PATCH 로 쓰기 — 호출 수 감소 / 쓰기 실패 시 읽은 시각 유지·재처리 때 팀 방 복사본 보존 / 현장 판정용 요청 목록 한 번만 읽기
// 하니스는 slack_pull.js 앞부분을 그대로 쓰되 conversations.history 를 실제처럼(최신부터, oldest·cursor 적용) 흉내 낸다.
const fs=require('fs'),assert=require('assert');
let h=fs.readFileSync(__dirname+'/slack_pull.js','utf8');
h=h.slice(0,h.indexOf('module.exports'));
h=h.replace("if(m==='conversations.history')r={ok:true,messages:hist[q.get('channel')]||[]};","if(m==='conversations.history'){const rr=HISTFN(q);if(rr.http)return {getContentText:()=>'{}',getResponseCode:()=>rr.http,getHeaders:()=>({'Retry-After':'1'})};r=rr;}");
h=h.replace("if(m==='users.info')r=","if(m==='users.info'&&USERFAIL.n>0){USERFAIL.n--;r={ok:false,error:'ratelimited'};}else if(m==='users.info')r=");
// 가짜 시계: DB 호출마다 0.4초 흐름
h=h.replace("const ctx={","let CLOCK=Date.now();const RD=Date;function FD(...a){return a.length?new RD(...a):new RD(CLOCK);}FD.now=()=>CLOCK;FD.prototype=RD.prototype;FD.UTC=RD.UTC;\nconst ctx={Date:FD,");
h=h.replace("fetch(u,o={}){calls.push(u);","fetch(u,o={}){calls.push(u);CLOCK+=((o.method==='patch'||o.method==='put')?global.WSTEP:400);");
h=h.replace("Utilities:{","Utilities:{sleep(){},");
h=h.replace("if(o.method==='put')","if(global.FAILW&&(o.method==='put'||o.method==='patch')&&/\\/talk(\\.json|\\/msgs|\\/slack\\/feed)/.test(u))throw new Error('쓰기 실패(시험)');if(o.method==='put')");
h=h.replace("calls.push(u);","calls.push((o.method||'get')+' '+u);");
const body=h+";module.exports={g,db,props,calls,cache,hist,sent,setClock:v=>CLOCK=v,getClock:()=>CLOCK};";
const M={exports:{}};
global.HISTFN=null;global.FAILW=false;global.USERFAIL={n:0};global.WSTEP=400;
new Function('require','module','global','__dirname','HISTFN','USERFAIL',body.replace(/^const fs=require\('fs'\);/,'const fs=require("fs");'))(require,M,global,__dirname,q=>global.HISTFN(q),global.USERFAIL);
const {g,db,props,cache,calls,setClock}=M.exports;
cache.at='tok';
const CH='C0C6U7RQ44D';
const t0=Math.floor(Date.now()/1000)-3000;
function mk(n,txt){const a=[];for(let i=0;i<n;i++)a.push({ts:(t0+i).toFixed(6),user:i%2?'U1':'U2',text:(txt||'테스트 글 ')+i});return a;}
function pager(all){return q=>{let l=all.filter(m=>+m.ts>+(q.get('oldest')||0));l=l.sort((x,y)=>+y.ts-+x.ts);const lim=+q.get('limit')||100,off=+(q.get('cursor')||0);const part=l.slice(off,off+lim);return {ok:true,messages:part,response_metadata:{next_cursor:off+lim<l.length?String(off+lim):''}};};}
function reset(all){global.HISTFN=q=>q.get('channel')===CH?pager(all)(q):{ok:true,messages:[]};
  if(db.talk.msgs)Object.keys(db.talk.msgs).forEach(k=>delete db.talk.msgs[k]);if(db.talk.slack)db.talk.slack={req:{}};
  props['SLK_TS_'+CH]=String(t0-1);props.SLK_CHAN_BF_C0AT8RP3QDN=props.SLK_CHAN_BF_C0AHFJGKMTL=props['SLK_CHAN_BF_'+CH]='1';props.SLK_RESCAN_227=props.SLK_DEDUP_232=props.SLK_REQDUP_233=props.SLK_LINK_229=props.SLK_MIG_224='1';
  Object.keys(cache).forEach(k=>{if(k!=='at')delete cache[k];});calls.length=0;const d=new Date();d.setMinutes(7,0,0);setClock(+d);}   // 가짜 DB 는 orderBy 를 무시해 정리(30분마다)가 새 글을 지우므로 정리 시각을 피함
cache.at='tok';
const wr=()=>calls.filter(c=>/^(patch|put|delete) .*\/talk/.test(c));
const copies=()=>{let n=0;Object.keys(db.talk.msgs||{}).forEach(r=>{if(r!=='sk_talk')Object.keys(db.talk.msgs[r]).forEach(k=>{if(/t$/.test(k))n++;});});return n;};
// A) 300건 — 채널 방·팀 방 복사본·feed 가 모두 들어오고, 쓰기 호출은 글 수보다 훨씬 적음
let all=mk(300);reset(all);g.slackPull(true);
assert.strictEqual(Object.keys(db.talk.msgs.sk_talk).length,300,'A) 채널 방 300건');
assert.strictEqual(Object.keys(db.talk.slack.feed||{}).length,300,'A) feed 300건');
const cleanCopies=copies();assert(cleanCopies>0,'A) 팀 방 복사본이 만들어짐(시험 전제)');
assert(wr().length<=20,'A) 쓰기 호출이 크게 줄어야 함: '+wr().length);
assert(wr().some(c=>/^patch .*\/talk\.json/.test(c)),'A) talk 멀티패스 PATCH 사용');
// B) 쓰기가 계속 실패하면 읽은 시각을 넘기지 않음 → 복구되면 같은 글부터 다시 처리하고 팀 방 복사본도 빠지지 않음
reset(all);global.FAILW=true;g.slackPull(true);
assert.strictEqual(props['SLK_TS_'+CH],String(t0-1),'B) 실패하면 읽은 시각 유지');
assert.strictEqual(Object.keys((db.talk.msgs&&db.talk.msgs.sk_talk)||{}).length,0,'B) 실패하면 아무것도 안 들어감');
assert(/저장 실패/.test((db.talk.slack.meta||{}).err||''),'B) 요청함 위 오류 줄에 이유: '+((db.talk.slack.meta||{}).err));
global.FAILW=false;g.slackPull(true);
assert.strictEqual(Object.keys(db.talk.msgs.sk_talk).length,300,'B) 복구 뒤 300건');
assert.strictEqual(copies(),cleanCopies,'B) 복구 뒤 팀 방 복사본도 빠지지 않음: '+copies()+' / '+cleanCopies);
assert(+props['SLK_TS_'+CH]>=+all[299].ts,'B) 복구 뒤 읽은 시각 넘어감');
// C) 현장 「이동」 글 50건 — 요청 목록을 글마다가 아니라 한 번만 읽음
all=mk(50,'테스트병원 서비스 이동합니다 ');reset(all);g.slackPull(true);
const reads=calls.filter(c=>/^get .*slack\/req\.json.*orderBy/.test(c)).length;
assert(reads<=3,'C) 요청 목록 읽기 횟수: '+reads);
console.log('slack_batch OK');
