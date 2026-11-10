// 대화방 묶음 판정 same() 이 index.html 과 같은지 + Slack 글은 이름이 달라야 따로 표시
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../index.html','utf8');
const m=/const same=(\(a,b\)=>.*?);\n/.exec(src);assert(m,'same() 없음');
const ymd=d=>d.toISOString().slice(0,10),hm=d=>d.toISOString().slice(11,16);
const same=eval('('+m[1].replace(/;$/,'')+')');
const t=Date.UTC(2026,10,10,22,21,5);
const A={author:'slack',name:'박재우',room:'sk_talk',ts:t},B={author:'slack',name:'백원욱',room:'sk_talk',ts:t+20000},C={author:'slack',name:'박재우',room:'sk_talk',ts:t+30000};
assert(!same(A,B),'다른 Slack 보낸 사람은 묶이면 안 됨');
assert(same(A,C),'같은 Slack 보낸 사람은 묶임');
assert(same({author:'u1',name:'가',room:'r',ts:t},{author:'u1',name:'가',room:'r',ts:t+1000}),'일반 글 묶음 유지');
assert(!same({author:'u1',name:'가',room:'r',ts:t},{author:'u2',name:'가',room:'r',ts:t+1000}),'다른 uid 는 따로');
console.log('chat_group OK');
