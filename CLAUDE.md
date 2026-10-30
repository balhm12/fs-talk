# FS 포털 (구 FS Talk) — 작업 지침·현재 상태

> **FS 포털 – Field Service Integrated Portal.** 대화(메신저)를 포함한 FSG 통합 업무 시스템.
> 이 파일은 작업할 때마다 갱신한다. 「현재 상태」 「변경 이력」을 최신으로 유지하는 것이 규칙이다.

## 1. 구조

| 항목 | 값 |
|---|---|
| 앱 | `index.html` 한 파일(HTML·CSS·JS), 프레임워크 없음 · `sw.js`(오프라인·푸시 배지, 캐시 이름 `fstalk-vN`) · `manifest.json`(이름 「FS 포털」) |
| 주소 | GitHub Pages `https://balhm12.github.io/fs-talk/` (main 푸시 = 즉시 배포) |
| 자체 DB | Firebase RTDB `fs-talk-fa383` (asia-southeast1), 경로 `talk/*`, 익명 인증 + 명단·관리자 승인 |
| 서버 | Apps Script 「FS TALK 알림」 = `apps-script/notify.gs` (알림·첨부·요약·음성·기기 연결·아침 근무 알림·백업) |
| 자동 배포 | `.github/workflows/deploy-rules.yml`(규칙) · `deploy-apps-script.yml`(clasp, 같은 웹앱 URL로 새 버전). 비밀값 이름: `FIREBASE_SERVICE_ACCOUNT`, `CLASPRC_JSON`, `SCRIPT_ID`, `DEPLOYMENT_ID` (값은 GitHub Secrets에만) |
| 결과 확인 | `curl https://api.github.com/repos/balhm12/fs-talk/actions/runs?per_page=3` (인증 없이 읽힘) |

## 2. 외부 데이터 (모두 같은 출처 기준을 그대로 씀)

| 무엇 | 어디서 | 방식 |
|---|---|---|
| 설치일정 | `sysmex-system-schedule` RTDB: 페이지 안 `BASE_EVENTS` + `schedule-overrides/{custom,edited,deleted}` | 익명 토큰(REST). **쓰기는 `custom/user-{시각}` 한 건 PUT만** (일정표 「일정 추가」와 같은 모양) |
| 근무일정 | `work-schedule/{west,east,central,south,fss,fsom}/{날짜}/{이름}` = `{night,weekend,am1..pm2,by,at,meta}`, 별명 `work-schedule/teamRoster` | 7일치 `orderBy="$key"` 범위 조회. **쓰기는 본인 칸만**(휴가·오전/오후휴가·교육·회의·내근·DP), 바뀐 슬롯만 `meta[slot]={by,at}`. 야간·당직은 연쇄 규칙 때문에 근무일정표에서만 |
| 고객 만족도 | 같은 DB `voc-dashboard/data` (recs: month·fsr·team·org·ts·avg·q1~q3·comment) | 읽기만. 3점 이하 = min(q1,q2,q3) ≤ 3. 후속 조치는 포털 `talk/vocfu/{해시}` |
| KPI | `fsg-kpi.html`(접근 코드 암호화) | **관리자 PC(코드 저장된 기기)에서 그 페이지를 숨은 iframe으로 열고 `curPeriod()/stats()/renderProd()` 결과를 읽어** `talk/kpisvc`(FSG)·`talk/kpime/{팀_이름}`(개인)에 올림. 계산 기준을 복제·변경하지 않음 |
| 실마리 | `https://balhm12.github.io/sysmex-ts/` 암호화 데이터 | 같은 출처라 비밀번호 키(`sysmex-ts-key`) 공유. 검색 인덱스·장비 상세(원인·조치·부품) 복호화 |

## 3. 권한·보는 기준

- 일반: 승인된 직원 / 관리자: `talk/admins/{uid}` / 팀장: 명단(roster) `lead:true` / 그룹장: 팀 `FSG`
- 홈·일정·만족도·KPI 기본 범위: **직원 = 나 + 우리 팀, 팀장 = 우리 팀, 그룹장 = FSG 전체**, 지원 팀(FSS·FSOM)은 FSG 전체 (`myRole()`·`myField()`)
- 개인 KPI: 본인만(규칙), 팀장은 팀원, 그룹장·관리자는 전원. 만족도 3점 이하 상세: 팀장·관리자만

## 4. 화면 지도

- **홈**: 위쪽 바(검색·알림 센터·테마·프로필, 휴대폰 ☰ 전체 메뉴) → 요약 숫자 4개(역할별) → 오늘의 업무(일정·내 이번 주·7일 근무·일정 등록) | 업무 커뮤니케이션 → 기술지원(실마리·기술정보·동영상) → 서비스 현황(만족도·KPI) → 바로가기(편집 가능, `prefs/{나}/links`)
- **대화**: 방·1:1·그룹, 전체공지 확인, AI 요약, 음성, 실마리 칩, 일정 칩, `/휴가 11/3` `/설치 11/10 병원 장비` 명령
- **조직도**: 보드형(팀 카드·팀장 위·사무소별·오늘 근무·검색·필터·목록 보기)
- **포털 안 앱**: `#app-install|work|silmari|voc|kpi|system` iframe 탭(전국시스템은 다른 출처라 새 창 안내)
- **알림 센터**: 공지·언급·신규 기술자료·개정·교육·내 일정 변경, 읽음 `prefs/{나}/noti`
- **검색**: 대화 + 실마리(미리보기·즐겨찾기) + 기술정보·교육 + 이번 주 일정

## 5. 지켜야 할 것

1. 기존 기능·데이터·권한을 지우거나 바꾸지 않는다. 데이터가 없으면 「–」와 이유를 보이고 **실적을 만들어 넣지 않는다.**
2. 외부 일정 DB에는 위 두 경로 외에 절대 쓰지 않는다. 전체 트리 PUT 금지.
3. 이름을 바꿀 때 **저장 식별자는 유지**: 드라이브 폴더 `FS Talk 첨부`·`FS Talk 백업`, 파일 설명 `FS Talk · …`, localStorage 키 `fstalk-*`, 캐시 `fstalk-v*`.
4. 키·비밀번호·명단(실명)을 저장소·채팅에 남기지 않는다. 규칙은 fs-talk-fa383에만.
5. 큰 블록을 바꿀 때 사이에 있던 함수가 같이 지워지지 않았는지 확인한다(2026-10-30 `schChips` 누락 사고).
6. 디자인: 글꼴 `var(--font)`(Pretendard → 맑은 고딕), 색은 Sysmex 브랜드(#005BAC·#00B8EE·#3FBA46·#E69E0B·#E7413E), 디자인 v3 블록은 `</style>` 바로 앞(마지막에 덮어씀). 로고 비율 유지.
7. 테스트: Playwright + Firebase 목(`/tmp/fbmock/mock.js` 방식), PC 1440·휴대폰(iPhone 13)·다크, 콘솔 오류 0.

## 6. 현재 상태 (2026-10-30 22:45 기준, 버전 2026-10-30.107)

- 배포됨: 디자인 v3(Pretendard 웹폰트·흰 레일·파란 선택 띠·카드 그림자, sysmex.co.kr 톤), 동영상 교육에 sysmex.co.kr 공식 교육 영상(장비 12종) 바로가기, 기술정보 분류(기술회보·매뉴얼 개정·부품 변경)·개정 표시·즐겨찾기(`prefs/{나}/bfav`)·최근 본 자료·검색, 홈 v2·역할별 요약, 알림 센터, 실마리 미리보기·즐겨찾기, 만족도 추이·팀별·3점 이하 조치, KPI 요약·개인 KPI, 포털 안 앱, 일정 등록(근무·설치)·대화 명령, 조직도 보드, 이름 FS 포털
- 사용자 확인 완료(2026-10-30 22:28): KPI 첫 올리기, 실제 데이터 카드 확인, 근무 등록 시험, `installDigestTrigger` 실행
- 남은 작업: 8장 「앞으로의 순서」 참고 (Slack·Salesforce 연동, 회사 서버 이전 — 사용자가 시작을 말하면 착수)

## 7. 변경 이력 (최근 것 위)

- 2026-10-30 · 107 지원 팀(FSS·FSOM)은 FSG 전체 기준(일정·3점 이하·만족도), 우리 팀 응답 없으면 FSG로, 카드 줄 높이 맞춤
- 2026-10-30 · 106 디자인 v3(글꼴 Pretendard — 문서·이메일은 브랜드 기준 맑은 고딕 유지, 웹앱만 기기 간 통일을 위해 웹폰트), 공식 교육 영상 링크, 캐시 v5
- 2026-10-30 · 105 기술정보 분류·개정(✎)·즐겨찾기·최근 본 자료·검색, 규칙 board.c/rv/ru/rby
- 2026-10-30 · 104 이름 FS 포털, 조직도 보드, 캐시 v4
- 2026-10-30 · 103 일정 등록(근무 본인·설치), 대화 /명령, 내 설치·평가 표시, 일정 칩 복구
- 2026-10-30 · 102 포털 안 앱(iframe 탭)
- 2026-10-30 · 101 역할별 대시보드(직원·팀장·그룹장)
- 2026-10-30 · 100 홈 v2, 알림 센터, 실마리 강화, 만족도·KPI, 규칙(links·noti·silfav·bfav·vocfu·kpisvc·kpime)
- 2026-10-30 · 84~92 오늘 일정·게시판·만족도 카드·조직도 오늘 근무·아침 근무 알림(notify v17)·자동 배포

## 8. 앞으로의 순서 (2026-10-30 합의 — 「나중에 진행」, 사용자가 시작을 말하면 착수)

확정된 사실: **NEW CRM = Salesforce**, **회사에서 Slack을 공식 사용**. 연동 키는 앱 화면에 두지 않고 서버(지금은 Apps Script, 이전 후 회사 서버)에만.

1. **IT 요청서 1장 작성** (Docs 문서): Salesforce Connected App·API 권한 계정(처음엔 읽기 전용), Slack 앱 승인(Webhook → 이후 명령·이벤트), 회사 서버 이전 요구사항.
2. **Slack 연동**
   - 1차: 포털 → Slack (전체공지·새 기술정보·3점 이하 만족도·아침 근무 알림을 채널로) — Incoming Webhook, notify.gs에서 발송
   - 2차: Slack → 포털 (`/실마리 코드` 조회, 채널 글 가져오기) — Slack 앱(Events·Slash Command), 워크스페이스 관리자 승인 필요
3. **Salesforce(NEW CRM) 연동** — 서버에서 OAuth, 읽기부터
   - 오늘 내 방문·작업 지시 → 「오늘의 업무」 / 설치·근무일정과 CRM 일정 맞추기 / 실마리 결과에 장비 수리 이력 / KPI를 CRM 데이터로 직접 계산(엑셀 업로드 대체 — 단 KPI 계산 기준은 fsg-kpi `kpiCore()`와 같게)
4. **회사 서버로 이전** (단계별)
   - 4-1 주소 이전(1~2일): 예 `fsportal.sysmex.co.kr`, Firebase는 유지. **설치·근무일정표·실마리·KPI 대시보드도 같은 주소 아래로 함께**(포털 안 열기·실마리 키 공유·KPI iframe 계산이 같은 출처 전제). 새 주소는 기기 저장값이 넘어가지 않으므로 「다른 기기 연결(6자리)」로 옮기는 안내 화면, Firebase 승인 도메인 추가
   - 4-2 회사 계정 SSO 로그인(명단·승인 대체, 퇴사자 자동 차단)
   - 4-3 Salesforce·Slack 연동을 회사 서버로
   - 4-4 (IT 요구 시) 데이터까지 사내: Firebase → 회사 DB + 실시간 서버, 첨부 → 사내 저장소, AI 음성·요약 → 승인된 공급자 (몇 주 단위)
   - IT 확인: **현장 휴대폰 외부 접속(인터넷 공개 HTTPS 또는 VPN)**, 서버 종류(리눅스/IIS), 도메인·인증서, 구글(FCM)·Salesforce·Slack 외부 통신 허용, 회사 로그인 방식
5. 그 밖: 대화 명령 안내 개선, 휴대폰 세부 다듬기, 직원 의견 반영

## 9. 자동 개선 사이클 (2026-10-30 22:45 ~ 약 02:45, 사용자 요청 「4시간 연속 자동 개선」)

비교 대상: Salesforce Field Service 모바일(오늘 일정·다음 방문 위젯·Pre-Work Brief·길찾기·바코드 스캔), ServiceNow FSM(My Tasks·Today's Roster·지식 검색·관리자 모바일), Dynamics 365 FS(Agenda/Day 보기·오프라인·음성 메모·바코드).
사이클마다: 아래 맨 위 미완료 1개 → 구현 → 회귀 테스트(PC·휴대폰·다크) → 배포 → 이 표 체크·변경 이력 → 사용자에게 짧게 보고. 실제 데이터 없는 숫자는 만들지 않음. 문제 생기면 `git revert`로 즉시 되돌림.

| # | 항목 | 참고 | 상태 |
|---|---|---|---|
| C1 | 오늘의 브리핑(아침 요약 한 줄 묶음) + 「다음 일정」 위젯 + 병원 길찾기(네이버·카카오 지도) | SF Pre-Work Brief·Next appointment, D365 Driving directions | 진행 |
| C2 | 팀 현황(팀장·그룹장): 팀원 오늘 상태 표, 팀 설치·3점 이하·KPI 한 화면 | ServiceNow Today's Roster·Manager Mobile | 대기 |
| C3 | PC 빠른 이동(Ctrl+K 명령 창) + 글자 크기 설정(보통·크게) | SaaS 공통 | 대기 |
| C4 | 불러오는 중 스켈레톤·빈 화면 안내·휴대폰 당겨서 새로고침 | SaaS 공통 | 대기 |
| C5 | 카메라로 부품번호·S/N 바코드/QR 스캔 → 실마리·검색 | SF·D365 Barcode scan | 대기 |
| C6 | 새 기능 안내(버전별 한 번) + 접근성(대비·키보드·스크린리더 이름) | 공통 | 대기 |
| C7 | 전체 회귀·첫 화면 속도 점검·최종 보고 | — | 대기 |
