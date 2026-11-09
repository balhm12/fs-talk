/* 홈 v4(승인된 정리안) 회귀 방지(정적 확인) — node tests/home_static.js
 * 실제 화면·동작은 브라우저로 확인해야 하고, 여기서는 되돌아가지 않았는지만 본다. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cl = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

/* 카드 색: 쓰임새 3색, 팀 색(TEAM_COLOR)과 같은 값 금지 */
const blocks = idx.split('}');
const colorOf = (k, dark) => { const b = blocks.find(x => x.indexOf('--cc:') >= 0 && x.indexOf((dark ? 'html[data-theme=dark] ' : '') + '.hcard[data-hk=' + k + ']') >= 0 && (dark || !/^\s*html\[data-theme=dark\]/.test(x.trim()))); const m = b && /--cc:(#[0-9A-Fa-f]{6})/.exec(b); return m && m[1].toUpperCase(); };
const GROUPS = { 업무: ['sched', 'comm'], '찾기·자료': ['parts', 'tech'], '현황·교육': ['video', 'voc', 'kpi', 'more'] };
const seen = {};
Object.keys(GROUPS).forEach(g => {
  const cs = GROUPS[g].map(k => colorOf(k, false)), ds = GROUPS[g].map(k => colorOf(k, true));
  ok(cs.every(c => c) && new Set(cs).size === 1, g + ' 카드가 같은 색을 쓰지 않음: ' + cs);
  ok(ds.every(c => c) && new Set(ds).size === 1, g + ' 카드 다크 모드 색이 같지 않음: ' + ds);
  seen[g] = cs[0];
});
ok(new Set(Object.values(seen)).size === 3, '쓰임새 3가지 색이 서로 다르지 않음');
const tc = /const TEAM_COLOR=\{([^}]*)\}/.exec(idx);
const teamHex = tc ? (tc[1].match(/#[0-9A-Fa-f]{6}/g) || []).map(x => x.toUpperCase()) : [];
ok(teamHex.length >= 6, 'TEAM_COLOR 를 읽지 못함');
ok(Object.values(seen).every(c => teamHex.indexOf(c) < 0), '카드 색이 팀 색과 같은 값: ' + Object.values(seen).filter(c => teamHex.indexOf(c) >= 0));
ok(/\.hcard\[data-hk\]\{border-top:4px solid var\(--cc/.test(idx), '카드 컬러바 규칙 없음');
ok(/\.hcard\[data-hk\] \.hcic\{[^}]*width:30px;height:30px/.test(idx), '아이콘 칩 규칙 없음');

/* v4 구조 */
ok(/b\.classList\.add\("hv4","hv5"\)/.test(idx) && /\.hv5 \.hsp,\.hv5 \.hbrief,\.hv5 \.hstats\{display:none!important\}/.test(idx), 'v5 표시·검색 패널·브리핑·요약 4칸 숨김이 없음');
ok(/function homeMoreOpen\(/.test(idx) && /\.hv4g:not\(\.m5open\)>\.hsec\.rowb/.test(idx), '217 「더 보기」 접기가 없음');
ok(/id="rApps"/.test(idx) && /id="rMenu"/.test(idx) && /id="rSearch" title="검색" hidden/.test(idx), '217 PC 레일 정리(업무 앱·메뉴)가 없음');
ok(/\["#hreq","Slack 요청"/.test(idx) && /\["#hc-sched","오늘의 업무"/.test(idx), '217 처음 둘러보기에 홈 요청·오늘의 업무 단계가 없음');
ok(/const HCARDS=\{sched:[^}]*parts:[^}]*tech:[^}]*more:[^}]*links:[^}]*\}/.test(idx) && !/const HCARDS=\{[^}]*(sil:|hist:)/.test(idx), 'HCARDS 가 v4 카드(오늘의 업무·커뮤니케이션·부품 재고·기술정보·더 보기·바로가기)가 아님');
ok(/function applyHomeHidden\(grid\)/.test(idx) && !/function applyHomeLayout/.test(idx), '홈은 보이기·숨기기만(applyHomeHidden) 이어야 함');
ok(/const mc=hcard\("더 보기"/.test(idx) && /function renderMore\(\)/.test(idx), '더 보기 카드가 없음');
ok(/function openAddChooser\(\)/.test(idx) && /\+ 일정 등록/.test(idx), '일정 등록 선택창이 없음');
ok(/\[\["me","나"\],\["team",host\?"우리 팀"/.test(idx), '일정 카드 「나」 보기가 없음');

/* 검색 패널·범위 */
ok(/let homeScope="all"/.test(idx), 'homeScope 상태 변수 없음');
const sc = /const SCOPES=\[(.*?)\];/.exec(idx);
ok(sc && (sc[1].match(/\["/g) || []).length === 5, '검색 범위가 5개가 아님');
ok(/function goHist\(v\)/.test(idx), 'goHist 정의가 없음(수리이력 범위·장비 칩이 멈춤)');
ok(/if\(k==="hist"\)\{goHist\(t\);return;\}/.test(idx), '수리이력 범위 분기 없음');
ok(/silOpenUrl\(SIL_BASE\+"#\/q\/"/.test(idx) && /k==="sil"/.test(idx), '실마리 범위 분기 없음');
ok(/k==="parts"&&document\.getElementById\("hpq"\)/.test(idx), '부품 범위 분기(카드 없을 때 대비) 없음');
ok(/k==="tech"\|\|\(k==="all"&&dev&&!v\)/.test(idx), '기술정보 범위 분기 없음');
ok(/\$\("q"\)\.value=t;go\("search"\);\};/.test(idx), '전체 범위(기존 통합 검색) 동작이 사라짐');
ok(!/hd\.appendChild\(f\);/.test(idx), '검색창이 다시 헤더에 붙음(검색 패널 안에 있어야 함)');
ok(/\.hsp-seg button\{min-height:44px/.test(idx), '휴대폰 검색 범위 탭 44px 규칙 없음');

/* 휴대폰 */
ok(/\.hbrief\{flex-wrap:nowrap;overflow-x:auto/.test(idx), '휴대폰 브리핑 한 줄 규칙이 없음');
ok(/\.hsp-r\{flex-direction:column/.test(idx), '휴대폰 검색 패널 두 줄 규칙이 없음');
ok(/\.hv4g \.hch\{flex-wrap:wrap\}/.test(idx), '휴대폰 카드 제목 줄바꿈 규칙이 없음');
const p40 = idx.indexOf('.hav,.mehead{min-width:40px;min-height:40px}'), p44 = idx.indexOf('.htool,.hav,.scanb,.obpi,.allbell{min-width:44px;min-height:44px}');
ok(p40 > 0 && p44 > p40, '터치 44px 규칙이 기존 40px 규칙보다 앞에 있어 적용되지 않음');
['id="lq" placeholder="검색" aria-label="대화 검색"', 'q.id="tq";q.type="search";q.setAttribute("aria-label"', 'q.id="obq";q.type="search";q.setAttribute("aria-label"'].forEach(x => ok(idx.indexOf(x) >= 0, '검색 입력 라벨 없음: ' + x.slice(0, 30)));
const av = /const APP_VERSION="([^"]+)"/.exec(idx);
ok(av && cl.indexOf(av[1]) >= 0, 'APP_VERSION(' + (av && av[1]) + ')이 CLAUDE.md 에 기록돼 있지 않음');
console.log((fail ? 'FAIL' : 'OK') + ' — 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
