/* 서버 쪽 방 접근·관리자 권한 시험 (가명 데이터만 사용 — 실명 없음)
 * 실행: node tests/room_scope.js
 *  1) notify.gs 의 canReadFixedRoom_ 가 database.rules.json 의 talk/msgs .read 와 같은 결과를 내는지
 *  2) summary_ 가 고정 방에도 그 검사를 하는지
 *  3) rules 의 모든 관리자 조건이 「승인됨」을 함께 요구하는지
 *  4) notify.gs 문법
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
const gs = fs.readFileSync(path.join(root, 'apps-script/notify.gs'), 'utf8');
const rulesTxt = fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8');
let pass = 0, fail = 0;
function ok(c, m){ if(c){ pass++; } else { fail++; console.log('FAIL: ' + m); } }

/* ---- 1) canReadFixedRoom_ 동작 ---- */
const scope = /const ROOM_SCOPE = \{[^\n]*\};/.exec(gs);
const fn = /function canReadFixedRoom_\(uid, me, room\)\{[\s\S]*?\n\}\n/.exec(gs);
ok(scope && fn, 'ROOM_SCOPE / canReadFixedRoom_ 를 notify.gs 에서 찾지 못함');
const DB = {
  'talk/admins/adm': true,
  'talk/roster/FS CENTRAL/가명대전': '대전',
  'talk/roster/FS CENTRAL/가명광주': '광주',
  'talk/roster/FS CENTRAL/가명팀장': { o: '대전', lead: true },
  'talk/roster/FS SOUTH/가명부산': { o: '부산', lead: true },
};
const sb = { db_: p => (p in DB ? DB[p] : null) };
vm.createContext(sb);
vm.runInContext(scope[0].replace('const ROOM_SCOPE', 'var ROOM_SCOPE') + '\n' + fn[0], sb);
const can = (uid, me, room) => vm.runInContext('canReadFixedRoom_', sb)(uid, me, room);
const WEST = { team: 'FS WEST', name: '가명서울' }, EAST = { team: 'FS EAST', name: '가명동부' };
const DJ = { team: 'FS CENTRAL', name: '가명대전' }, GJ = { team: 'FS CENTRAL', name: '가명광주' }, DJL = { team: 'FS CENTRAL', name: '가명팀장' };
const BS = { team: 'FS SOUTH', name: '가명부산' }, FSS = { team: 'FSS Team', name: '가명지원' }, ADM = { team: 'FSS Team', name: '가명관리' };
['all', 'notice', 'ts', 'cs'].forEach(r => { ok(can('u1', WEST, r), r + ' 은 승인된 누구나'); });
ok(can('u1', WEST, 'west'), 'WEST 팀원은 west 방');
ok(!can('u1', EAST, 'west'), 'EAST 팀원은 west 방 불가');
ok(!can('u1', FSS, 'west'), '지원팀도 west 방 불가(규칙과 동일)');
ok(can('adm', ADM, 'west') && can('adm', ADM, 'fss') && can('adm', ADM, 'daejeon'), '관리자는 모든 고정 방');
ok(can('u2', DJ, 'daejeon'), 'FS CENTRAL 대전 소속은 daejeon 방');
ok(can('u3', DJL, 'daejeon'), '팀장(명단이 객체 {o}) 도 사무소 방');
ok(!can('u2', DJ, 'gwangju'), '대전 소속은 gwangju 방 불가');
ok(can('u4', GJ, 'gwangju') && !can('u4', GJ, 'daejeon'), '광주 소속은 gwangju 방만');
ok(can('u2', DJ, 'central') && can('u4', GJ, 'central'), 'FS CENTRAL 은 central 방');
ok(!can('u5', BS, 'daejeon') && can('u5', BS, 'busan') && can('u5', BS, 'south'), 'FS SOUTH 부산은 busan·south 방');
ok(can('u6', FSS, 'fss') && !can('u6', WEST, 'fss'), 'fss 방은 FSS Team 만');
ok(!can('u7', WEST, 'nosuchroom'), '없는 방 불가');
ok(!can('u8', null, 'west'), '사용자 정보가 없으면 불가');
ok(!can('u9', { team: 'FS CENTRAL', name: '가명없음' }, 'daejeon'), '명단에 없으면 사무소 방 불가');

/* ---- 2) summary_ 가 고정 방에도 검사를 부른다 ---- */
const sum = /function summary_\(req\)\{[\s\S]*?\n\}\n/.exec(gs);
ok(sum && /!isDm && !isGroup && !canReadFixedRoom_\(uid, me, room\)/.test(sum[0]), 'summary_ 가 고정 방 읽기 권한을 확인하지 않음');

/* ---- 3) rules: 모든 관리자 조건이 승인됨과 함께 ---- */
const rules = JSON.parse(rulesTxt);
ok(rules && rules.rules, 'rules JSON 구조');
const adminRef = "root.child('talk/admins/' + auth.uid).val() === true";
const guarded = "(" + adminRef + " && root.child('talk/users/' + auth.uid + '/status').val() === 'approved')";
const nRef = rulesTxt.split("talk/admins/' + auth.uid").length - 1;
const nGuard = rulesTxt.split(guarded).length - 1;
ok(nRef > 0 && nRef === nGuard, 'rules 의 관리자 조건 ' + nRef + '곳 중 승인됨 확인이 붙은 곳 ' + nGuard);

/* ---- 4) notify.gs 문법 ---- */
const tmp = path.join(os.tmpdir(), 'notify_check_' + process.pid + '.js');
fs.writeFileSync(tmp, gs);
try { cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok(true, ''); }
catch (e) { ok(false, 'notify.gs 문법 오류: ' + String(e.stderr).split('\n')[0]); }
fs.unlinkSync(tmp);

console.log((fail ? 'FAIL' : 'OK') + ' — 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
