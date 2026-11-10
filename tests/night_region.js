// 237 CS쉐어링 지역 배정: 서버(notify.gs)·화면(index.html)의 지역 판정이 같고, 담당자 멘션 > 기관명 지역 순서로 방을 정하는지 확인
const fs=require("fs"),assert=require("assert");
const N=fs.readFileSync(__dirname+"/../apps-script/notify.gs","utf8"),H=fs.readFileSync(__dirname+"/../index.html","utf8");
const fn=(src,name)=>{const i=src.indexOf("function "+name+"(");let d=0,j=src.indexOf("{",i);for(let k=j;k<src.length;k++){if(src[k]==="{")d++;else if(src[k]==="}"&&--d===0)return src.slice(i,k+1);}};
const sv=new Function(fn(N,"slkNightRegion_")+";return slkNightRegion_")(),cl=new Function(fn(H,"slkNightRegion")+";return slkNightRegion")();
const cases={"서울":"ew","경기":"ew","강원":"ew","제주":"ew","인천":"ew","목동":"ew","대전":"central","충북 청주":"central","전북":"central","전남":"central","광주":"central","부산":"south","대구":"south","울산/경남":"south","경남":"south","":"","해외":""};
Object.keys(cases).forEach(k=>{assert.strictEqual(sv(k),cases[k],"server "+k);assert.strictEqual(cl(k),cases[k],"client "+k);});
// 방 정하기(서버): 멘션 우선, 없으면 지역
const roster={"FS EAST":{"테스트1":"","테스트2":""},"FSS Team":{"테스트3":""}};
const ctx=new Function("slkRoster_","slkRoomFor_","slkPerson_",fn(N,"slkNightRegion_")+fn(N,"slkNightRooms_")+";return slkNightRooms_");
const rf=n=>n==="테스트4"?"daejeon":n==="테스트5"?"busan":n==="테스트1"||n==="테스트2"?"east":n==="테스트3"?"fss":"all";
const rooms=ctx(()=>roster,rf,x=>x);
const blk=a=>"[CS쉐어링 접수] [인계 : L0]\n1. 기 관 명(지역) : 테스트병원 ("+a+")\n2. 장 비 명 : UF-5000";
assert.deepStrictEqual(rooms("<@U1|테스트1> x",blk("부산")),["east"],"멘션 우선");
assert.deepStrictEqual(rooms("<@U1|테스트1> <@U2|테스트3>",blk("서울")),["east","fss"]);
assert.deepStrictEqual(rooms("x",blk("경기")),["east","west","fss"],"서울·경기 = 공동 대응");
assert.deepStrictEqual(rooms("<@U3|테스트4> x",blk("서울")),["central"],"대전·광주는 함께 = 팀 방");
assert.deepStrictEqual(rooms("<@U4|테스트5> x",blk("서울")),["south"],"부산·대구는 함께 = 팀 방");
assert.deepStrictEqual(rooms("x",blk("부산")),["south"]);
assert.deepStrictEqual(rooms("x",blk("전북")),["central"]);
assert.deepStrictEqual(rooms("x",blk("경기")+"\n\n"+blk("대구")),["east","west","fss","south"],"묶음 글은 건별 합침");
assert.deepStrictEqual(rooms("x","[CS쉐어링 접수]\n기 관 명 : 지역 없음"),[]);
// 화면: 같은 판정으로 요청함 팀
const T=new Function("slkTeam1","slkSrc","slkNightRegion",fn(H,"slkTeams")+";return slkTeams")(r=>r.t||"",r=>r.kind,cl);
const tn=a=>T({kind:"night",f:{area:a}});
assert.deepStrictEqual(tn("서울"),["FS EAST","FS WEST","FSS TEAM"]);assert.deepStrictEqual(tn("부산"),["FS SOUTH"]);
assert.deepStrictEqual(T({kind:"cso",f:{area:"서울"}}),[],"CSO 평일 요청은 그대로");
assert.deepStrictEqual(T({kind:"night",t:"FS EAST",f:{area:"부산"}}),["FS EAST"],"멘션·양식 팀이 우선");
console.log("night_region 237: 통과");
