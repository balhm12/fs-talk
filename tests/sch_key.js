/* 일정표 DB 서버용 키(2026-11-25) — 스크립트 속성 SCH_KEY 가 있으면 그것, 없으면 예전 값(동작 변화 없음) */
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'notify.gs'), 'utf8');
const a = src.indexOf('const SCH_KEY_DEF'), b = src.indexOf('const SCH_TEAMS', a);
assert.ok(a > 0 && b > a, 'SCH_KEY_DEF·schApiKey_ 블록을 찾지 못함');
const mk = props => new Function('P_', src.slice(a, b) + '; return {schApiKey_, SCH_KEY_DEF};')(k => props[k]);
{ const m = mk({}); assert.strictEqual(m.schApiKey_(), m.SCH_KEY_DEF, '속성이 없으면 예전 값'); }
{ const m = mk({ SCH_KEY: ' SRV ' }); assert.strictEqual(m.schApiKey_(), 'SRV', '속성 SCH_KEY 를 쓴다'); }
{ const m = mk({}); assert.strictEqual(m.schApiKey_({ SCH_KEY: 'FROMPR' }), 'FROMPR', '한 번에 읽은 속성(PR)도 쓴다'); }
assert.ok(!/\?key='\+SCH_KEY[,)]/.test(src), '로그인 주소에 예전 상수를 바로 쓰면 안 됨');
assert.strictEqual((src.match(/schApiKey_\(/g) || []).length, 3, '정의 1 + 익명 로그인 1 + 서버 계정 로그인 1');
console.log('sch_key: 통과');
