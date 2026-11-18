/* 저점수(3점 이하) 후속 조치 — 정적 시험
 *
 * 이 기록은 만족도 시트 Apps Script 의 「저점수조치」 시트로 자동으로 옮겨진다.
 * 옮기는 쪽은 포털과 **같은 해시**로 응답을 찾으므로, vocKey 가 바뀌면 두 곳이 어긋나
 * 조치 기록이 엉뚱한 응답에 붙는다. 아래 고정값은 그래서 둔 것이다 —
 * 값이 바뀌면 Apps Script 의 vocKeyOf_ 도 같이 고치고 이 파일의 기대값을 갱신해야 한다.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };

/* ---------- 1. vocKey 해시 고정 ---------- */
const src = /const vocKey=r=>\{[\s\S]*?\};/.exec(html);
ok(!!src, 'index.html 에서 vocKey 를 찾지 못함');
const vocKey = eval('(' + src[0].replace(/^const vocKey=/, '').replace(/;$/, '') + ')');

[
  ['테스트3', '테스트의료원', '2026-11-11 21:15', 'vjq6wnj'],
  ['테스트2', '테스트검사센터', '2026-11-10 14:02', 'vx9m42t'],
  ['A', '', '2026-01-01 00:00', 'v1bcd90g'],
  ['홍길동', '가나다라마바사 의료원 (분원)', '2026-02-29 09:05', 'vnjzog1'],
].forEach(([fsr, org, ts, want]) => {
  const got = vocKey({ fsr, org, ts });
  ok(got === want, 'vocKey(' + [fsr, org, ts].join('|') + ') = ' + got + ' (기대 ' + want + ')');
});

/* 세 값의 순서·구분자가 바뀌면 안 된다 */
ok(vocKey({ fsr: 'a', org: 'b', ts: 'c' }) !== vocKey({ fsr: 'b', org: 'a', ts: 'c' }),
  'fsr·org 를 바꿔도 같은 키가 나옴');

/* ---------- 2. 사유 목록 ---------- */
const rs = /const VOC_REASONS=\[([^\]]*)\]/.exec(html);
ok(!!rs, 'VOC_REASONS 를 찾지 못함');
const reasons = rs[1].split(',').map(s => s.trim().replace(/^"|^'|"$|'$/g, ''));
const want = ['조치 지연', '재방문 발생', '부품 수급', '설명·안내 부족', '장비 상태', '응대 태도', '고객 착오', '기타'];
ok(reasons.length === want.length && reasons.every((v, i) => v === want[i]),
  '사유 목록이 Apps Script 쪽 VOC_REASONS 와 달라짐: ' + JSON.stringify(reasons));
ok(reasons.every(r => r.length <= 30), '사유가 규칙의 30자 제한을 넘음');

/* ---------- 3. DB 규칙 ---------- */
const vf = rules.rules.talk.vocfu;
ok(!!vf, 'talk/vocfu 규칙 없음');
const val = vf.$k['.validate'];
ok(/hasChildren\(\['s','by','ts'\]\)/.test(val), 's·by·ts 필수 조건이 사라짐');
/* 화면에서 막는 것만으로는 막은 것이 아니다 — 서버도 '조치 완료' 에 내용을 요구해야 한다 */
ok(/'done'[\s\S]*child\('t'\)/.test(val), '조치 완료인데 조치 내용 없이 저장되는 것을 규칙이 막지 않음');
ok(vf.$k.r && /length <= 30/.test(vf.$k.r['.validate']), '사유(r) 길이 제한 없음');
ok(vf.$k.t && /length <= 500/.test(vf.$k.t['.validate']), '조치 내용(t) 길이 제한 없음');
ok(vf.$k.at && /isNumber/.test(vf.$k.at['.validate']), '완료일시(at) 검증 없음');
ok(vf.$k.$other && vf.$k.$other['.validate'] === false, '선언하지 않은 칸이 막히지 않음');

/* 규칙 식은 전부 JS 문법으로 파싱돼야 한다 (CLAUDE.md 규칙 9) */
let exprs = 0;
(function walk(o) {
  for (const k in o) {
    const v = o[k];
    if ((k === '.read' || k === '.write' || k === '.validate') && typeof v === 'string') {
      exprs++; try { new Function('return (' + v + ')'); } catch (e) { ok(false, '규칙 식 문법 오류: ' + k); }
    } else if (v && typeof v === 'object') walk(v);
  }
})(rules.rules);
ok(exprs > 100, '규칙 식 수가 비정상 (' + exprs + ')');

/* ---------- 4. 화면 ---------- */
ok(/\.vfta\{/.test(html) && /font-size:16px/.test(/\.vfta\{[^}]*\}/.exec(html)[0]),
  '조치 내용 입력칸이 16px 미만 — 아이폰에서 화면이 확대된다');
ok(/@media\(pointer:coarse\)\{\.vfsel,\.vfsave\{min-height:44px\}\}/.test(html),
  '손가락 화면에서 사유·저장이 44px 미만');
ok(/R\("vocfu\/"\+k\)\.update\(o\)/.test(html),
  '조치 저장이 update 가 아님 — set 이면 상태만 바꿀 때 사유·조치 내용이 지워진다');

/* ---------- 5. 저점수 기준 = 만족도 시트 기준 ----------
 * 시트(Sysmex-schedule apps-script/survey_analysis.gs 의 lowMaxAt_·isLowRow_)는 응답 접수일이
 * 2026-11-01 이후면 최저 문항 3점 이하, 그 전이면 2점 이하를 저점수로 센다. 「저점수조치」 탭은
 * 그 기준에 드는 응답만 받으므로 포털이 다르게 잡으면 조치 기록이 시트에 나타나지 않는다.
 * 시트 CONFIG.ALERT_THRESHOLD·_PREV·_FROM 을 바꾸면 여기 기대값과 index.html 을 같이 바꾼다. */
const lowSrc = /const VOC_LOW_MAX=[\s\S]*?const vocLowTxt=[^\n]*;/.exec(html);
ok(!!lowSrc, 'index.html 에서 저점수 기준(VOC_LOW_MAX ~ vocLowTxt)을 찾지 못함');
if (lowSrc) {
  const L = new Function(lowSrc[0] + ';return {VOC_LOW_MAX,VOC_LOW_PREV,VOC_LOW_FROM,vocLowMax,vocLow,vocLowTxt};')();
  ok(L.VOC_LOW_MAX === 3 && L.VOC_LOW_PREV === 2 && L.VOC_LOW_FROM === '2026-11-01',
    '기준 값이 시트(3 · 2 · 2026-11-01)와 다름');
  const rec = (ts, q1, q2, q3) => ({ ts, q1, q2, q3 });
  [
    ['2026-10-31 23:59', 3, 5, 5, false, '전환 전날 3점은 저점수가 아님'],
    ['2026-10-31 23:59', 2, 5, 5, true, '전환 전날 2점은 저점수'],
    ['2026-11-01 00:00', 3, 5, 5, true, '전환일 3점은 저점수'],
    ['2026-11-11 16:17', 5, 3, 4, true, '11월 3점(둘째 문항)은 저점수'],
    ['2026-11-11 16:17', 4, 4, 4, false, '11월 4점은 저점수가 아님'],
    ['2026-09-15 10:00', 5, 5, 1, true, '9월 1점은 저점수'],
    ['2027-01-02 09:00', 3, 3, 3, true, '해가 바뀌어도 3점 이하'],
    ['', 3, 5, 5, true, '접수일이 없으면 지금 기준(3점) — 시트 lowMaxAt_ 와 같음'],
    ['2026-10-20 10:00', '', 5, 5, false, '빈 문항은 5점으로 보고 저점수로 세지 않음'],
  ].forEach(([ts, a, b, c, want, msg]) => ok(L.vocLow(rec(ts, a, b, c)) === want, msg));
  ok(L.vocLowTxt('2026-10') === '2점 이하' && L.vocLowTxt('2026-11') === '3점 이하' && L.vocLowTxt() === '3점 이하',
    '화면 문구가 달 기준과 다름: ' + [L.vocLowTxt('2026-10'), L.vocLowTxt('2026-11'), L.vocLowTxt()].join(' / '));
}
/* 화면 문구에 「3점 이하」를 직접 적으면 10월 이전 달을 볼 때 기준과 문구가 어긋난다 */
ok(!/(?:el|tile|it)\([^)\n]*"[^"\n]*3점 이하/.test(html), '화면 문구에 「3점 이하」가 직접 적혀 있음 — vocLowTxt 를 쓴다');
ok(!/vocLow=r=>[^;]*<=3;/.test(html), 'vocLow 가 날짜와 상관없이 3점으로 고정돼 있음');

console.log(fail ? '\n저점수 후속 조치: ' + pass + ' 통과 / ' + fail + ' 실패'
  : '저점수 후속 조치: ' + pass + '항목 통과');
process.exit(fail ? 1 : 0);
