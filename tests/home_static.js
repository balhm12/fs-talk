/* 홈 정리(194) 회귀 방지(정적 확인) — node tests/home_static.js
 * 실제 화면·동작은 브라우저로 확인해야 하고, 여기서는 되돌아가지 않았는지만 본다. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cl = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

['sched', 'comm', 'sil', 'hist', 'parts', 'tech', 'video', 'voc', 'kpi'].forEach(k => {
  ok(new RegExp('\\.hcard\\[data-hk=' + k + '\\]\\{--cc:').test(idx) || new RegExp('\\.hcard\\[data-hk=' + k + '\\],\\.hcard\\[data-hk=\\w+\\]\\{--cc:').test(idx) || new RegExp('\\.hcard\\[data-hk=\\w+\\],\\.hcard\\[data-hk=' + k + '\\]\\{--cc:').test(idx), '카드 색 규칙 없음: ' + k);
  ok(new RegExp('html\\[data-theme=dark\\] \\.hcard\\[data-hk=' + k + '\\]').test(idx), '다크 모드 카드 색 규칙 없음: ' + k);
});
ok(/\.hcard\[data-hk\]\{border-top:4px solid var\(--cc/.test(idx), '카드 컬러바 규칙 없음');
ok(/\.hcard\[data-hk\] \.hcic\{[^}]*width:30px;height:30px/.test(idx), '아이콘 칩 규칙 없음');
ok(/let homeScope="all"/.test(idx), 'homeScope 상태 변수 없음');
const sc = /const SCOPES=\[(.*?)\];/.exec(idx);
ok(sc && (sc[1].match(/\["/g) || []).length === 4, '검색 범위가 4개가 아님');
ok(/if\(homeScope==="hist"\)\{goHist\(v\);return;\}/.test(idx), '수리이력 범위 분기 없음');
ok(/homeScope==="parts"&&document\.getElementById\("hpq"\)/.test(idx), '부품 범위 분기(카드 없을 때 대비) 없음');
ok(/homeScope==="tech"\)\{silHistAdd\(v\);go\("tech~"/.test(idx), '기술·실마리 범위 분기 없음');
ok(/\$\("q"\)\.value=v;go\("search"\);\};/.test(idx), '전체 범위(기존 통합 검색) 동작이 사라짐');
ok(/@media \(pointer:coarse\)\{\.hscopes \.hchip\{height:44px/.test(idx), '휴대폰 범위 칩 44px 규칙 없음');
const av = /const APP_VERSION="([^"]+)"/.exec(idx);
ok(av && cl.indexOf(av[1]) >= 0, 'APP_VERSION(' + (av && av[1]) + ')이 CLAUDE.md 에 기록돼 있지 않음');
console.log((fail ? 'FAIL' : 'OK') + ' — 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
