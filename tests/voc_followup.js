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

console.log(fail ? '\n저점수 후속 조치: ' + pass + ' 통과 / ' + fail + ' 실패'
  : '저점수 후속 조치: ' + pass + '항목 통과');
process.exit(fail ? 1 : 0);
