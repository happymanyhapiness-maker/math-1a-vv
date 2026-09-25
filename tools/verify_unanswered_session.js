// -*- coding: utf-8 -*-
// verify_unanswered_session.js
// Phase 7A-2c: 「未挑戦の問題だけ」の対象リスト（旧 state.unansweredSnapshot = 問題オブジェクト丸ごと）を
// 保存・同期せず、そのページのセッション中だけのメモリ上のID配列（unansweredSessionIds）にした変更の回帰テスト。
//  ・開始時に固定した順で出題（回答で questionHistory が埋まっても縮まない）、group 仕様も同じ
//  ・表示・採点は最新の UNIT_META
//  ・保存データに unansweredSnapshot も未挑戦の途中位置も残さない（回答履歴は残る）
//  ・リロード後は TOP、未挑戦セッションは再開しない、「再開」で通常問題の別の位置へ飛ばない
//  ・通常試験の「再開」は今までどおり
//  ・merge（片側null / 両側 / resetGen 世代違い / 旧端末からの再流入）の出力に残らない
//
//   node tools/verify_unanswered_session.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const DIR = path.join(__dirname, "..");
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));
const APP_SRC = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
const SYNC_SRC = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8");
let OLD_APP_SRC = null;
try { OLD_APP_SRC = execSync("git show HEAD:app.js", { cwd: DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch (e) { /* git が無い環境では旧端末テストを省略 */ }

function extract(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error("抽出失敗: " + startMarker);
  return src.slice(s, e);
}
const mergeUnitData = new Function(extract(SYNC_SRC.replace(/\r\n/g, "\n"), "function freshness",
  "/* =========================================================\n   Firestore 入出力") + "\nreturn mergeUnitData;")();

// ---- 偽 DOM（verify_review_session.js と同じ） ----
function makeElement() {
  const t = {
    style: {}, dataset: {}, innerHTML: "", innerText: "", value: "", disabled: false, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  };
  const noop = () => undefined;
  const methods = {
    appendChild: noop, removeChild: noop, insertBefore: noop, remove: noop, addEventListener: noop,
    removeEventListener: noop, setAttribute: noop, removeAttribute: noop, focus: noop, blur: noop,
    click: noop, scrollIntoView: noop, querySelector: () => null, closest: () => null, querySelectorAll: () => []
  };
  return new Proxy(t, {
    get: (o, p) => (p in o ? o[p] : methods[p]),
    set: (o, p, v) => { o[p] = v; return true; }
  });
}
// store を渡すと、その保存データのある端末でページを開いた状態（= リロード）になる
function launch(store, appSrc) {
  const els = {};
  store = store || {};
  const alerts = [];
  const ctx = {
    console,
    alert: (m) => { alerts.push(String(m)); }, confirm: () => true, scrollTo: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    getComputedStyle: (e) => e.style,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      key: (i) => Object.keys(store)[i],
      get length() { return Object.keys(store).length; }
    },
    document: {
      getElementById: (id) => (els[id] || (els[id] = makeElement())),
      querySelector: () => null, querySelectorAll: () => [],
      createElement: () => makeElement(),
      addEventListener: () => {}, body: makeElement(), readyState: "loading"
    },
    __NOW: Date.UTC(2026, 9, 1)
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext("Date.now = () => __NOW;", ctx);
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  html.match(/questions_[a-z_0-9]+\.js/g).forEach((f) =>
    vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, { filename: f }));
  vm.runInContext(appSrc || APP_SRC, ctx, { filename: "app.js" }); // 最後の選択単元があれば起動時に selectUnit される
  return { ctx, els, store, alerts, run: (code) => vm.runInContext(code, ctx) };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail) : "")); }
}
function section(title, fn) {
  console.log("\n" + title);
  try { fn(); } catch (e) { check("例外なく実行できる", false, String(e && e.stack || e).split("\n").slice(0, 2).join(" ")); }
}

const UNIT = "seishitsu"; // 32問・group あり
const KEY = "kyotsu_app_v14_" + UNIT;
const UNIT_KEY_NAME = "kyotsu_app_unit_v1";
const probe = launch();
const ALL = probe.run(`UNIT_META.${UNIT}.questions.map((q) => ({ id: q.id, group: q.group || null }))`);
const allIds = ALL.map((q) => q.id);
// buildUnansweredList と同じ規則で期待値を独立に計算する
function expectedUnanswered(answered) {
  const need = new Set(ALL.filter((q) => !answered.includes(q.id) && q.group).map((q) => q.group));
  return ALL.filter((q) => !answered.includes(q.id) || (q.group && need.has(q.group))).map((q) => q.id);
}
// group の無い問題を3つだけ未挑戦にする（それ以外は回答済み）
const noGroup = ALL.filter((q) => !q.group).map((q) => q.id);
const [A, B, Cq] = noGroup;

// 単元を開いて questionHistory を仕込んだ端末
function deviceWith(answered) {
  const d = launch();
  d.run(`selectUnit(${J(UNIT)})`);
  d.ctx.__ans = answered;
  d.run("__ans.forEach((id) => { stats.questionHistory[id] = { date: 1, isCorrect: true }; }); save();");
  return d;
}
const reload = (d, appSrc) => launch(C(d.store), appSrc);
const saved = (d) => JSON.parse(d.store[KEY]);
const cur = (d) => (d.run("currentQuestion()") || {}).id;

section("[1] 通常セッション：開始時の A/B/C を固定、回答しても縮まない", () => {
  const d = deviceWith(allIds.filter((id) => ![A, B, Cq].includes(id)));
  d.run("startUnansweredOnly()");
  check("1-1 開始時に unansweredSessionIds = [A, B, C]", J(d.run("unansweredSessionIds")) === J([A, B, Cq]), d.run("unansweredSessionIds"));
  check("1-2 最初は A", cur(d) === A);
  d.run("answer(currentQuestion().correct)");
  check("1-3 A に回答すると questionHistory に記録される", !!d.run(`stats.questionHistory[${J(A)}]`));
  check("1-4 回答後も unansweredSessionIds は [A, B, C] のまま", J(d.run("unansweredSessionIds")) === J([A, B, Cq]));
  d.run("nextQuestion()");
  check("1-5 次は B", cur(d) === B);
  d.run("answer(currentQuestion().correct); nextQuestion();");
  check("1-6 その次は C", cur(d) === Cq);
  d.run("answer(currentQuestion().correct); nextQuestion();");
  check("1-7 C の後で終了し、unansweredSessionIds は空", d.run("state.finished") === true && J(d.run("unansweredSessionIds")) === "[]");
  check("1-8 回答履歴（answerLog）は3件保存されている", saved(d).state.answerLog.length === 3);
});

section("[2] group 仕様・順番は buildUnansweredList のまま", () => {
  const grouped = ALL.filter((q) => q.group);
  const g = grouped[0].group;
  const inG = grouped.filter((q) => q.group === g).map((q) => q.id);
  const answered = allIds.filter((id) => id !== inG[1] && id !== A); // group の2問目と A だけ未回答
  const d = deviceWith(answered);
  d.run("startUnansweredOnly()");
  const exp = expectedUnanswered(answered);
  check("2-1 未回答の問題と同じ group の問題がまとめて対象（問題データの順）", J(d.run("unansweredSessionIds")) === J(exp) && inG.every((id) => exp.includes(id)), { got: d.run("unansweredSessionIds"), exp });
  const shown = [];
  for (let i = 0; i < 50 && d.run("currentQuestion()"); i++) { shown.push(cur(d)); d.run("answer(currentQuestion().correct); nextQuestion();"); }
  check("2-2 出題順も開始時のまま、group の問題も飛ばさない", J(shown) === J(exp), shown);
  const d2 = deviceWith([]);
  d2.run("startUnansweredOnly()");
  check("2-3 全部未回答なら全問（問題データの順）", J(d2.run("unansweredSessionIds")) === J(allIds));
  const d3 = deviceWith(allIds);
  d3.alerts.length = 0;
  d3.run("startUnansweredOnly()");
  check("2-4 全部回答済みなら「未挑戦の問題はありません」でセッションに入らない", d3.alerts.length === 1 && d3.run("state.mode") !== "unanswered");
});

section("[3] 表示・採点は最新の UNIT_META", () => {
  const d = deviceWith(allIds.filter((id) => ![A, B].includes(id)));
  d.run("startUnansweredOnly()");
  d.run(`(function () { const q = UNIT_META.${UNIT}.questions.find((x) => x.id === ${J(A)}); q.q = "差し替えた問題文"; })()`);
  check("3-1 セッション中に問題データが変わっても、表示は UNIT_META の最新", d.run("currentQuestion().q") === "差し替えた問題文");
  check("3-2 currentQuestion は UNIT_META と同じオブジェクト", d.run(`currentQuestion() === UNIT_META.${UNIT}.questions.find((x) => x.id === ${J(A)})`));
  // 旧データの unansweredSnapshot（古い中身）は使われない
  const d2 = deviceWith([]);
  const s = saved(d2);
  s.state.mode = "unanswered"; s.state.index = 0; s.state.finished = false;
  s.state.unansweredSnapshot = [{ id: A, q: "古い問題文", a: ["古い"], correct: 0, explain: { why: "古い解説", tip: "古いコツ" } }];
  d2.store[KEY] = J(s);
  const r = reload(d2);
  check("3-3 旧 unansweredSnapshot を持つデータを読んでも、古い問題が表示・採点されない",
    r.run("state.mode") !== "unanswered" && !("unansweredSnapshot" in r.run("state")) && (r.run("currentQuestion()") || {}).q !== "古い問題文");
});

section("[4] 保存データ：未挑戦の対象リストと途中位置は残さない（回答履歴は残す）", () => {
  const d = deviceWith(allIds.filter((id) => ![A, B, Cq].includes(id)));
  d.run("startUnansweredOnly(); answer(currentQuestion().correct); nextQuestion();");
  const s = saved(d).state;
  check("4-1 保存データに unansweredSnapshot が無い", !("unansweredSnapshot" in s));
  check("4-2 保存データの mode は未挑戦ではない（終了済みの通常モード）", s.mode === "normal" && s.finished === true && s.index === 0, { mode: s.mode, finished: s.finished, index: s.index });
  check("4-3 メモリ上のセッションはそのまま（mode 未挑戦・B 表示中）", d.run("state.mode") === "unanswered" && cur(d) === B && d.run("state.finished") === false);
  check("4-4 A の回答は answerLog / questionHistory に保存されている",
    s.answerLog.some((r) => r.questionId === A) && !!saved(d).stats.questionHistory[A]);
  check("4-5 defaultState に unansweredSnapshot が無い", !("unansweredSnapshot" in d.run(`defaultState(${J(UNIT)})`)));
});

section("[5] リロード：TOP に戻り、未挑戦セッションは再開しない、「再開」で別の問題へ飛ばない", () => {
  const d = deviceWith(allIds.filter((id) => ![A, B, Cq].includes(id)));
  d.run("startUnansweredOnly(); answer(currentQuestion().correct); nextQuestion();"); // B 表示中
  const r = reload(d);
  check("5-1 A の回答履歴は残っている", r.run(`state.answerLog.some((x) => x.questionId === ${J(A)}) && !!stats.questionHistory[${J(A)}]`));
  check("5-2 TOP（controlPanel 表示・問題パネル非表示）", r.els.controlPanel.style.display === "block" && r.els.questionPanel.style.display === "none");
  check("5-3 mode は未挑戦ではなく、unansweredSessionIds は空", r.run("state.mode") !== "unanswered" && J(r.run("unansweredSessionIds")) === "[]");
  r.alerts.length = 0;
  r.run("resumeExam()");
  check("5-4 「再開」は「終了済み」の案内で、問題を表示しない（通常問題の別の位置へ飛ばない）",
    r.alerts.length === 1 && r.alerts[0].includes("終了済み") && r.els.questionPanel.style.display === "none", r.alerts);
  r.run("startUnansweredOnly()");
  check("5-5 もう一度「未挑戦」を押すと、今の questionHistory から作り直す（A は外れて B, C）", J(r.run("unansweredSessionIds")) === J([B, Cq]), r.run("unansweredSessionIds"));
  check("5-6 作り直したセッションは B から", cur(r) === B);
});

section("[6] 通常試験の「再開」は今までどおり", () => {
  const d = deviceWith([]);
  d.run("startExam(); answer(currentQuestion().correct); nextQuestion(); answer(currentQuestion().correct); nextQuestion();");
  const s = saved(d).state;
  const r = reload(d);
  check("6-1 リロード後の state は保存どおり（mode normal・未終了・index）",
    r.run("state.mode") === "normal" && r.run("state.finished") === false && r.run("state.index") === s.index);
  r.alerts.length = 0;
  r.run("resumeExam()");
  check("6-2 「再開」で通常問題の保存位置から出題される", r.alerts.length === 0 && cur(r) === allIds[s.index] && r.run("state.mode") === "normal", { cur: cur(r), idx: s.index });
  // 未挑戦セッション中に単元を切り替えて戻っても未挑戦は残らない
  const d2 = deviceWith(allIds.filter((id) => ![A, B].includes(id)));
  d2.run(`startUnansweredOnly(); selectUnit("kyokusen"); selectUnit(${J(UNIT)});`);
  check("6-3 単元切替で unansweredSessionIds は空、mode は未挑戦でない", J(d2.run("unansweredSessionIds")) === "[]" && d2.run("state.mode") !== "unanswered");
  d2.run("startUnansweredOnly(); exitExamMode();");
  check("6-4 TOP に戻る（exitExamMode）でも空", J(d2.run("unansweredSessionIds")) === "[]");
});

section("[7] 別端末：未挑戦の途中は引き継がず、回答履歴は merge される", () => {
  const devA = deviceWith(allIds.filter((id) => ![A, B, Cq].includes(id)));
  devA.run("startUnansweredOnly(); answer(currentQuestion().correct); nextQuestion();");
  const devB = deviceWith([]);
  const m = mergeUnitData(saved(devA), saved(devB));
  devB.store[KEY] = J(m);
  const r = reload(devB);
  check("7-1 端末B は未挑戦の途中として再開しない", r.run("state.mode") !== "unanswered" && J(r.run("unansweredSessionIds")) === "[]");
  check("7-2 端末A で回答した A の履歴は端末B に届く", r.run(`state.answerLog.some((x) => x.questionId === ${J(A)}) && !!stats.questionHistory[${J(A)}]`));
});

section("[8] merge の出力に unansweredSnapshot・未挑戦の途中位置を残さない", () => {
  const base = saved(deviceWith([]));
  const legacy = (ts, extra) => {
    const x = C(base);
    x.state.mode = "unanswered"; x.state.index = 3; x.state.finished = false;
    x.state.unansweredSnapshot = [{ id: A, q: "古い問題文" }, { id: B, q: "古い" }];
    x.state.answerLog = [{ questionId: A, timestamp: ts, isCorrect: true, outcome: "answered" }];
    return Object.assign(x.state, extra || {}), x;
  };
  const plain = (ts) => { const x = C(base); x.state.answerLog = [{ questionId: B, timestamp: ts, isCorrect: false, outcome: "answered" }]; return x; };
  const clean = (m) => !("unansweredSnapshot" in m.state) && m.state.mode !== "unanswered";
  check("8-1 local だけ旧データ（local が新しい）", clean(mergeUnitData(legacy(9000), plain(1000))));
  check("8-2 remote だけ旧データ（remote が新しい）", clean(mergeUnitData(plain(1000), legacy(9000))));
  check("8-3 両方とも旧データ", clean(mergeUnitData(legacy(9000), legacy(8000))));
  check("8-4 片側 null（local だけ）", clean(mergeUnitData(legacy(9000), null)));
  check("8-5 片側 null（remote だけ）", clean(mergeUnitData(null, legacy(9000))));
  const g1 = legacy(100, { resetGen: 1 });
  check("8-6 resetGen 世代違い（新しい世代が旧データ）", clean(mergeUnitData(plain(9000), g1)) && clean(mergeUnitData(g1, plain(9000))) &&
    mergeUnitData(plain(9000), g1).state.resetGen === 1);
  const m = mergeUnitData(legacy(9000), plain(1000));
  check("8-7 未挑戦の途中位置は「終了済みの通常モード」になる（「再開」で別問題へ飛ばない）", m.state.mode === "normal" && m.state.finished === true && m.state.index === 0);
  check("8-8 回答履歴は今までどおり merge される", m.state.answerLog.length === 2);
  // 通常試験の途中（mode normal）は merge で変えない
  const n = plain(9000); n.state.index = 5; n.state.finished = false;
  const mn = mergeUnitData(n, plain(1000));
  check("8-9 通常試験の途中位置（mode normal / index / finished）は変えない", mn.state.mode === "normal" && mn.state.index === 5 && mn.state.finished === false);
});

section("[9] 旧端末（HEAD の app.js）からの再流入", () => {
  if (!OLD_APP_SRC) { console.log("  （git が無いので省略）"); return; }
  const old = launch(null, OLD_APP_SRC);
  old.run(`selectUnit(${J(UNIT)}); startUnansweredOnly(); answer(currentQuestion().correct); nextQuestion();`);
  const oldPayload = JSON.parse(old.store[KEY]);
  if (!("unansweredSnapshot" in oldPayload.state)) console.log("  （情報）HEAD の app.js はすでに unansweredSnapshot を保存しない");
  const fresh = saved(deviceWith([]));
  const m = mergeUnitData(fresh, oldPayload);
  check("9-1 旧端末の payload を merge しても unansweredSnapshot・未挑戦の途中位置は残らない", !("unansweredSnapshot" in m.state) && m.state.mode !== "unanswered");
  check("9-2 旧端末の回答履歴は merge される", m.state.answerLog.length === oldPayload.state.answerLog.length);
  const r = launch({ [KEY]: J(oldPayload), [UNIT_KEY_NAME]: UNIT });
  check("9-3 旧端末の保存データをそのまま読んでも、未挑戦として再開しない", r.run("state.mode") !== "unanswered" && !("unansweredSnapshot" in r.run("state")));
  r.run("save()");
  check("9-4 次の save で保存データからも消える", !("unansweredSnapshot" in saved(r).state) && saved(r).state.mode === "normal");
});

console.log("\n結果: " + pass + " OK / " + fail + " NG");
process.exit(fail ? 1 : 0);
