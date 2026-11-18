/* KPI 대시보드를 일반 직원에게(302) · 전체 화면은 팀장까지(303) — 정적 시험
 *
 * 직원은 KPI 페이지의 「직원용 화면」(이름 없는 사본)만 본다. 포털이 하는 일:
 *  ① 접근 코드가 저장된 관리자 기기가 「직원용 코드」를 talk/kpistaff 에 올린다
 *  ② 승인된 직원 기기가 그 값을 받아 localStorage fsg-kpi-staff 에 넣는다(KPI 페이지와 같은 출처)
 *  ③ (303) 같은 관리자 기기가 접근 코드를 talk/kpilead 에 올리고, 규칙이 FSS Team·팀장·그룹장·부문장·관리자에게만 읽기를 허용한다.
 *     그 사람들 기기는 받아서 fsg-kpi-code 에 넣는다(코드 입력 없이 전체 화면). 그 밖의 직원 기기에는 접근 코드가 가지 않는다
 * 직원용 코드를 만드는 식은 KPI 페이지(Sysmex-schedule fsg-kpi.html 의 staffCodeOf)와 같아야 한다 —
 * 아래 기준값은 그쪽 tests/test_staff.js 와 같은 값이다. 한쪽 식을 바꾸면 두 곳을 같이 바꾼다.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

(async () => {
  /* ---------- 1. 직원용 코드 기준값 ---------- */
  const src = /async function kpiStaffCodeOf\(code\)\{[\s\S]*?\n\}/.exec(html);
  ok(!!src, 'index.html 에서 kpiStaffCodeOf 를 찾지 못함');
  if (src) {
    const f = new Function('crypto', 'TextEncoder', 'btoa', src[0] + '\nreturn kpiStaffCodeOf;')(require('crypto').webcrypto, TextEncoder, btoa);
    const got = await f('TESTCODE');
    ok(got === 'zBSVPjImvCNFIuXF-p9jD3C4L6FsMBD_dvFpC1lZZ4Q', '직원용 코드 기준값이 KPI 페이지와 다름: ' + got);
    ok(got !== await f('TESTCODF') && got.length >= 20 && got.length <= 100, '직원용 코드 길이·구분');
  }

  /* ---------- 2. DB 규칙 ---------- */
  const ks = rules.rules.talk.kpistaff;
  ok(!!ks, 'talk/kpistaff 규칙 없음');
  if (ks) {
    ok(/status'\)\.val\(\) === 'approved'/.test(ks['.read']) && !/admins/.test(ks['.read']), '읽기 = 승인된 직원');
    ok(/talk\/admins\//.test(ks['.write']) && /approved/.test(ks['.write']), '쓰기 = 관리자(승인된 계정)');
    ok(/hasChildren\(\['k','at'\]\)/.test(ks['.validate']) && /length <= 100/.test(ks['.validate']) && /isNumber/.test(ks['.validate']), '값 형식 검사');
    ok(ks.$other && /\$other === 'k' \|\| \$other === 'at'/.test(ks.$other['.validate']), '정해지지 않은 칸을 막지 않음');
    ['.read', '.write', '.validate'].forEach(k => { try { new Function('auth', 'root', 'newData', 'return (' + ks[k] + ')'); } catch (e) { ok(false, '규칙 식 문법 오류: ' + k); } });
  }
  /* 승인 전(익명) 사용자가 읽을 수 있는 곳이 늘지 않았는지 — kpistaff 는 승인 조건이 있어야 한다 */
  ok(ks && ks['.read'].indexOf("auth != null &&") === 0, '로그인 없이 읽힘');

  /* ---------- 3. 올리는 값 ---------- */
  const pub = /async function kpiStaffPublish\(\)\{[\s\S]*?\n\}/.exec(html);
  ok(!!pub, 'kpiStaffPublish 를 찾지 못함');
  if (pub) {
    ok(/if\(!isAdmin\|\|!kpiHasCode\(\)\)return false;/.test(pub[0]), '관리자·접근 코드가 있는 기기만 올려야 함');
    ok(/R\("kpistaff"\)\.set\(\{k,at:firebase\.database\.ServerValue\.TIMESTAMP\}\)/.test(pub[0]), '올리는 값은 직원용 코드와 시각뿐이어야 함');
    ok(/if\(!\(await kpiStaffOpens\(k\)\)\)return false;/.test(pub[0]), '올라와 있는 직원용 자료가 그 코드로 열리는지 확인하지 않음');
  }
  /* 접근 코드를 DB 에 쓰는 곳은 kpiLeadPublish 한 곳(talk/kpilead)뿐이어야 한다 */
  const lp = /async function kpiLeadPublish\(\)\{[\s\S]*?\n\}/.exec(html);
  ok(!!lp, 'kpiLeadPublish 를 찾지 못함');
  if (lp) {
    ok(/if\(!isAdmin\|\|!kpiHasCode\(\)\)return false;/.test(lp[0]), '접근 코드는 관리자 기기만 올려야 함');
    ok(/kpiStaffOpens\(c,"kpi-dashboard\/meta"\)/.test(lp[0]), '원본이 그 코드로 열리는지 확인하지 않고 올림');
    ok(/R\("kpilead"\)\.set\(\{k:c,at:firebase\.database\.ServerValue\.TIMESTAMP\}\)/.test(lp[0]), '올리는 자리는 talk/kpilead');
    const rest = html.replace(lp[0], '');
    ok(!/R\("(?!kpilead)[^"]*"\)\.(set|update|push)\([^;]*localStorage\.getItem\("fsg-kpi-code"\)/.test(rest) && !/\.(set|update|push)\(\{k:c\b/.test(rest), '접근 코드를 다른 자리에 쓰는 곳이 있음');
  }
  ok(/R\("kpistaff"\)\.on\("value",s=>kpiStaffGot\(s\.val\(\)\)/.test(html), '직원 기기가 직원용 코드를 받지 않음');
  ok(/localStorage\.setItem\("fsg-kpi-staff",k\)/.test(html), 'KPI 페이지가 읽는 자리(fsg-kpi-staff)에 넣지 않음');

  /* ---------- 3-2. 전체 화면 대상(303): 화면 기준 = 규칙의 읽기 조건 ---------- */
  ok(/const kpiFull=\(\)=>isAdmin\|\|myLead\(\)\|\|\(!!me&&me\.team==="FSS Team"\);/.test(html), 'kpiFull 기준(관리자·팀장·그룹장·부문장·FSS Team)');
  ok(/const TOP_TEAM="고객접점부문";const isTop=t=>t==="FSG"\|\|t===TOP_TEAM;/.test(html) && /const myLead=\(\)=>\{if\(!me\)return false;if\(isTop\(me\.team\)\)return true;/.test(html), '그룹장·부문장 = myLead 에 포함');
  const kl = rules.rules.talk.kpilead;
  ok(!!kl, 'talk/kpilead 규칙 없음');
  if (kl) {
    const rd = kl['.read'];
    ok(/talk\/admins\//.test(rd) && /=== 'FSG'/.test(rd) && /=== '고객접점부문'/.test(rd) && /=== 'FSS Team'/.test(rd) && /\/lead'\)\.val\(\) === true/.test(rd), '읽기 대상(관리자·그룹장·부문장·FSS Team·팀장)');
    ok(!/FSOM/.test(rd) && (rd.match(/status'\)\.val\(\) === 'approved'/g) || []).length === 2, '대상이 넓어졌거나 승인 조건이 빠짐');
    ok(/talk\/admins\//.test(kl['.write']) && !/FSS Team/.test(kl['.write']), '쓰기 = 관리자만');
    ok(/hasChildren\(\['k','at'\]\)/.test(kl['.validate']) && kl.$other && /\$other === 'k' \|\| \$other === 'at'/.test(kl.$other['.validate']), '값 형식');
    /* 규칙을 실제로 계산해 본다 — 직원·FSOM 은 못 읽고 대상만 읽는다 */
    const can = (u, admin, lead) => { const tree = { ['talk/admins/u1']: admin || null, ['talk/users/u1/status']: u.status, ['talk/users/u1/team']: u.team, ['talk/users/u1/name']: u.name, ['talk/roster/' + u.team + '/' + u.name + '/lead']: lead || null };
      const root = { child: p => ({ val: () => (p in tree ? tree[p] : null) }) }; return !!new Function('auth', 'root', 'return (' + rd + ')')({ uid: 'u1' }, root); };
    const U = (team, status) => ({ team, name: '가명', status: status || 'approved' });
    ok(!can(U('FS WEST')) && !can(U('FS CENTRAL')) && !can(U('FSOM Team')), '일반 직원·FSOM 직원이 접근 코드를 읽을 수 있음');
    ok(can(U('FSS Team')) && can(U('FSG')) && can(U('고객접점부문')) && can(U('FS WEST'), null, true) && can(U('FSOM Team'), null, true) && can(U('FS EAST'), true), '대상(FSS Team·그룹장·부문장·팀장·관리자)이 못 읽음');
    ok(!can(U('FSS Team', 'pending')) && !can(U('FS WEST', 'pending'), null, true) && !new Function('auth', 'root', 'return (' + rd + ')')(null, { child: () => ({ val: () => null }) }), '승인 전·로그인 없는 사용자가 읽을 수 있음');
  }
  const lg = /function kpiLeadGot\(v\)\{[\s\S]*?\n\}/.exec(html), ls = /function kpiLeadStart\(n\)\{[\s\S]*?\n\}/.exec(html);
  ok(lg && /if\(k&&kpiFull\(\)&&!\(isAdmin&&kpiHasCode\(\)\)&&/.test(lg[0]) && /localStorage\.setItem\("fstalk-kpilead","1"\)/.test(lg[0]), '대상 기기만 받고, 관리자 기기의 코드는 덮어쓰지 않아야 함');
  ok(ls && /if\(kpiFull\(\)\)\{kpiLeadStart\.on=true;R\("kpilead"\)\.on\(/.test(ls[0]) && /if\(!rosterVer\)/.test(ls[0]) && /localStorage\.removeItem\("fsg-kpi-code"\);localStorage\.removeItem\("fstalk-kpilead"\)/.test(ls[0]), '대상이 아니면 받지 않고, 포털이 넣어 준 코드를 지워야 함(명단을 받은 뒤에만 판단)');

  /* ---------- 4. 들어가는 곳 ---------- */
  ok(/const kpiOk=\(\)=>kpiFull\(\)\|\|!!kpiStaffK;/.test(html), 'kpiOk 기준');
  ok(/const kpiUrl=\(\)=>LINKS\.kpi\+\(kpiFull\(\)\?"\?lead":""\);/.test(html), '전체 화면 대상은 ?lead 로 열어야 코드가 아직 없을 때 접근 코드를 묻는다');
  ok(/\$\("rKpi"\)\.hidden=!kpiOk\(\);/.test(html), 'PC 레일 KPI');
  ok((html.match(/\(!APPS\[k\]\.kpi\|\|kpiOk\(\)\)/g) || []).length === 2, '앱 탭·빠른 찾기의 KPI 기준');
  ok((html.match(/concat\(kpiOk\(\)\?\["kpi"\]:\[\]/g) || []).length === 2 && /k!=="kpi"\|\|kpiOk\(\)/.test(html), '메뉴·바로가기의 KPI 기준');
  ok(/f\.src=want\|\|\(A\.kpi\?kpiUrl\(\):A\.u\)/.test(html), 'KPI 앱 주소');
  /* 개인 KPI·팀 비교(점수)가 들어 있는 홈 「서비스 KPI」 카드와 팀원 KPI 는 그대로 팀장·관리자만 */
  ok(/if\(k==="kpi"&&!\(isAdmin\|\|myLead\(\)\)\)return;/.test(html), '홈 「서비스 KPI」 카드가 직원에게 열림');
  const km = rules.rules.talk.kpime;
  ok(km && km.$p && /\$p === \(root\.child\('talk\/users\/' \+ auth\.uid \+ '\/team'\)/.test(km.$p['.read']), '개인 KPI 는 본인만(규칙) — 바뀌면 안 됨');

  console.log(fail ? '\nKPI 직원용: ' + pass + ' 통과 / ' + fail + ' 실패' : 'KPI 직원용: ' + pass + '항목 통과');
  process.exit(fail ? 1 : 0);
})();
