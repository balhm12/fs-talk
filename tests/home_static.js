/* 홈 정리(194) 회귀 방지(정적 확인) — node tests/home_static.js
 * 실제 화면·동작은 브라우저로 확인해야 하고, 여기서는 되돌아가지 않았는지만 본다. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cl = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

const blocks = idx.split('}');
const colorOf = (k, dark) => { const b = blocks.find(x => x.indexOf('--cc:') >= 0 && x.indexOf((dark ? 'html[data-theme=dark] ' : '') + '.hcard[data-hk=' + k + ']') >= 0 && (dark || !/^\s*html\[data-theme=dark\]/.test(x.trim()))); const m = b && /--cc:(#[0-9A-Fa-f]{6})/.exec(b); return m && m[1].toUpperCase(); };
const GROUPS = { 업무: ['sched', 'comm'], '찾기·자료': ['sil', 'hist', 'parts', 'tech'], '현황·교육': ['video', 'voc', 'kpi'] };
const seen = {};
Object.keys(GROUPS).forEach(g => {
  const cs = GROUPS[g].map(k => colorOf(k, false)), ds = GROUPS[g].map(k => colorOf(k, true));
  ok(cs.every(c => c) && new Set(cs).size === 1, g + ' 카드가 같은 색을 쓰지 않음: ' + cs);
  ok(ds.every(c => c) && new Set(ds).size === 1, g + ' 카드 다크 모드 색이 같지 않음: ' + ds);
  seen[g] = cs[0];
});
ok(new Set(Object.values(seen)).size === 3, '쓰임새 3가지 색이 서로 다르지 않음');
// 조직도 팀 색과 같은 값을 카드 색으로 쓰지 않음(의미 충돌 방지)
const tc = /const TEAM_COLOR=\{([^}]*)\}/.exec(idx);
const teamHex = tc ? (tc[1].match(/#[0-9A-Fa-f]{6}/g) || []).map(x => x.toUpperCase()) : [];
ok(teamHex.length >= 6, 'TEAM_COLOR 를 읽지 못함');
ok(Object.values(seen).every(c => teamHex.indexOf(c) < 0), '카드 색이 팀 색과 같은 값: ' + Object.values(seen).filter(c => teamHex.indexOf(c) >= 0));
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
ok(/\.hstats\{display:flex;overflow-x:auto;[^}]*scroll-padding:0 14px/.test(idx), '휴대폰 요약 한 줄 가로 스크롤 규칙(scroll-padding 포함)이 없음');
ok(/\.hbrief\{flex-wrap:nowrap;overflow-x:auto/.test(idx), '휴대폰 브리핑 한 줄 규칙이 없음');
ok(/\.hscopes\{flex-wrap:nowrap;overflow-x:auto/.test(idx), '휴대폰 범위 칩 한 줄 규칙이 없음');
ok(/\.schft\{flex-wrap:wrap;row-gap:4px\}\.schft \.hmore\{white-space:nowrap\}/.test(idx), '오늘의 업무 하단 줄바꿈 정리 규칙이 없음');
// 터치 44px 규칙은 기존 40px 규칙(.hav,.mehead{min-width:40px…})보다 뒤에 있어야 이김
const p40 = idx.indexOf('.hav,.mehead{min-width:40px;min-height:40px}'), p44 = idx.indexOf('.htool,.hav,.scanb,.obpi,.allbell{min-width:44px;min-height:44px}');
ok(p40 > 0 && p44 > p40, '터치 44px 규칙이 기존 40px 규칙보다 앞에 있어 적용되지 않음');
['id="lq" placeholder="검색" aria-label="대화 검색"', 'q.id="tq";q.type="search";q.setAttribute("aria-label"', 'q.id="obq";q.type="search";q.setAttribute("aria-label"'].forEach(x => ok(idx.indexOf(x) >= 0, '검색 입력 라벨 없음: ' + x.slice(0, 30)));
const av = /const APP_VERSION="([^"]+)"/.exec(idx);
ok(av && cl.indexOf(av[1]) >= 0, 'APP_VERSION(' + (av && av[1]) + ')이 CLAUDE.md 에 기록돼 있지 않음');
console.log((fail ? 'FAIL' : 'OK') + ' — 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
