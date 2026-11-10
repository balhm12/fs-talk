/* 접근성·출처 등급 회귀 방지(정적 확인) — node tests/a11y_static.js
 * 실제 동작은 브라우저로 확인해야 하고(모달 포커스·대비), 여기서는 되돌아가지 않았는지만 본다. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const hist = fs.readFileSync(path.join(root, 'hist.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

const vp = /<meta name="viewport" content="([^"]*)"/.exec(idx);
ok(vp && !/maximum-scale|user-scalable/.test(vp[1]), 'viewport 가 핀치 확대를 막고 있음');
ok(/html\[data-theme=dark\] \.tabbar button\.on\{color:#8CC4F5\}/.test(idx), '다크 모드 하단 탭 활성 라벨 색 규칙이 없음');
ok(/card\.setAttribute\("role","dialog"\);card\.setAttribute\("aria-modal","true"\)/.test(idx), '모달 role=dialog·aria-modal 설정이 없음');
ok(/key!=="Tab"\|\|ov\.hidden/.test(idx) || /e\.key!=="Tab"\|\|ov\.hidden/.test(idx), '모달 Tab 순환 처리가 없음');
ok(/l\.htmlFor=node\.id/.test(idx) && /fl\.htmlFor="bffile"/.test(idx), '기술정보 등록 창 라벨 연결이 없음');
// 248: 카드마다 붙던 「대화 기록 · 미검증」 배지(모든 글이 같아 의미가 없음 — 사용자 지적) 대신 결과 위 안내 한 줄
ok(/id="srcnote"[^>]*>모든 글은 Sysmex Talk 현장 대화 기록입니다\(검증 전\)[^<]*서비스 매뉴얼/.test(hist), 'hist.html 결과 위 출처 안내 한 줄이 없음');
ok(!/class="tag src"/.test(hist), 'hist.html 카드마다 출처 배지가 다시 생김');
const av = /const APP_VERSION="([^"]+)"/.exec(idx), cl = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
ok(av && cl.indexOf(av[1]) >= 0, 'APP_VERSION(' + (av && av[1]) + ')이 CLAUDE.md 에 기록돼 있지 않음');
console.log((fail ? 'FAIL' : 'OK') + ' — 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
