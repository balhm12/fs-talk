/* 명단(roster) 읽기 제한 회귀 방지(정적 확인) — node tests/roster_read.js
 * 승인 전(익명) 사용자가 직원 명단을 읽지 못하고, 가입은 이름·소속 직접 입력 + 서버 규칙의 명단 대조로 이뤄지는지. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8')).rules.talk;
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

const rr = rules.roster['.read'];
ok(/status'\)\.val\(\) === 'approved'/.test(rr), 'roster 읽기에 승인됨 조건이 없음: ' + rr);
ok(rr !== 'auth != null', 'roster 읽기가 로그인(익명 포함)만으로 열려 있음');
ok(/admins/.test(rules.roster['.write']) && /approved/.test(rules.roster['.write']), 'roster 쓰기는 승인된 관리자만이어야 함');
ok(/talk\/roster\/' \+ newData\.child\('team'\)\.val\(\) \+ '\/' \+ newData\.child\('name'\)\.val\(\)\)\.exists\(\)/.test(rules.users.$uid['.validate']), '가입(pending)이 명단과 대조되지 않음(서버 규칙)');
ok(/let roster=\{\},picked=null,manual=false,rosterVer=0,rosterDenied=false/.test(idx), 'rosterDenied 상태가 없음');
ok(/\(\)=>\{rosterWatched=false;rosterDenied=true;roster=\{\};syncPickMode\(\);\}/.test(idx), '명단 읽기 거부 시 직접 입력 모드로 가지 않음');
ok(/\$\("rManual"\)\.hidden=!rosterDenied/.test(idx) && /\$\("regBtn"\)\.disabled=!has&&!rosterDenied/.test(idx), '가입 화면이 명단 거부 상태를 반영하지 않음');
ok(/if\(me&&me\.status==="approved"&&rosterDenied\)watchRoster\(\)/.test(idx), '승인된 뒤 명단을 다시 읽지 않음(새로고침 전까지 명단이 비어 보임)');
ok(/if\(rosterDenied\)\{[\s\S]*?\$\("rName"\)\.value\.trim\(\)/.test(idx), '가입 제출이 직접 입력 값을 쓰지 않음');
ok(/명단에 없는 이름·소속입니다/.test(idx), '명단에 없는 이름일 때 안내 문구가 없음');
console.log((fail ? 'FAIL' : 'OK') + ' — 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
