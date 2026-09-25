// -*- coding: utf-8 -*-
// verify_review_session.js
// 「今日の復習」「間違えた問題だけ」で、回答によって出題リストが縮んだり、
// セッション中に別の問題の期限が来てリストが増えたりしても、
//  ・開始時点の対象問題が1回ずつ順番どおり表示される（問題が飛ばない）
//  ・画面に出ている問題として採点・記録される
// ことを確認する回帰テスト。ほかのモードの出題順が変わっていないことも確認する。
//
// index.html と同じ順で questions_*.js と本物の app.js を node の vm に読み込み、
// 最小限の偽 DOM / 偽 localStorage の上で本物の関数（startDueReview / answer /
// skipQuestion / timeoutQuestion / nextQuestion / show / finish など）を呼ぶ。
// Firestore / firebase-sync.js は読み込まない。
//
//   node tools/verify_review_session.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..");

// ---- 偽 DOM ----
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
function makeContext() {
  const els = {};
  const store = {};
  const ctx = {
    console,
    alert: () => {}, confirm: () => true, scrollTo: () => {},
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
      addEventListener: () => {}, body: makeElement(), readyState: "complete"
    },
    __NOW: Date.UTC(2026, 9, 1)
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext("Date.now = () => __NOW;", ctx);
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  const scripts = html.match(/questions_[a-z_0-9]+\.js|app\.js(?=\?)/g);
  scripts.forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, { filename: f }));
  return { ctx, els, store, run: (code) => vm.runInContext(code, ctx) };
}

// ---- テスト小道具 ----
let pass = 0, fail = 0;
const J = JSON.stringify;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail) : "")); }
}

// 単元を選び、wrong / tipList / reviewMeta を仕込む（全問 streak を指定、dueAt は過去）
function setup(env, unit, wrongIds, streakOf, dueAtOf) {
  env.run(`localStorage.clear && 0; selectUnit(${J(unit)});`);
  env.ctx.__setup = { wrongIds, streaks: wrongIds.map(streakOf), dues: wrongIds.map(dueAtOf || (() => env.ctx.__NOW - 1000)) };
  env.run(`(function () {
    const s = __setup, qs = UNIT_META[state.unit].questions, byId = (id) => qs.find((q) => q.id === id);
    state.wrong = s.wrongIds.map(byId);
    state.tipList = s.wrongIds.map(byId);
    state.reviewMeta = {};
    s.wrongIds.forEach((id, i) => { state.reviewMeta[id] = { streak: s.streaks[i], dueAt: s.dues[i], lastSeenAt: __NOW - 86400000 }; });
    state.graduatedAt = {};
    state.history = [];
    stats.questionHistory = {};
    save();
  })();`);
}
// 表示中の問題に action を行い「次へ」。表示された問題の順と、各回答の記録を返す
//  c: 正解 / w: 不正解 / s: スキップ / t: 時間切れ
function play(env, actions) {
  const shown = [];
  const records = [];
  for (const a of actions) {
    const q = env.run("currentQuestion()");
    if (!q) break;
    shown.push(q.id);
    env.ctx.__NOW += 1000;
    const before = env.run("state.answerLog.length");
    if (a === "c") env.run(`answer(currentQuestion().correct)`);
    else if (a === "w") env.run(`answer((currentQuestion().correct + 1) % currentQuestion().a.length)`);
    else if (a === "s") env.run(`skipQuestion()`);
    else if (a === "t") env.run(`timeoutQuestion()`);
    const rec = env.run("state.answerLog").slice(before)[0];
    records.push({ shown: q.id, recorded: rec && rec.questionId, feedbackQ: (env.run("currentQuestion()") || {}).id });
    env.run("nextQuestion()");
  }
  const left = env.run("currentQuestion()");
  return { shown, records, finishedAfter: !left && env.run("state.finished") };
}
const unitIds = (env, unit) => env.run(`UNIT_META[${J(unit)}].questions.map((q) => q.id)`);

const env = makeContext();
const [A, B, C, D] = unitIds(env, "kyokusen"); // 曲線ユニット（4問・方針クイズなし）
const due0 = () => 0;

console.log("[1] 今日の復習：回答でリストが縮んでも飛ばない");
{
  const cases = [
    ["1-1 [A,B,C] A正解 → B → C → 終了", [A, B, C], ["c", "c", "c"], [A, B, C]],
    ["1-2 [A,B,C] A不正解 → B → C", [A, B, C], ["w", "w", "w"], [A, B, C]],
    ["1-3 [A,B,C,D] A処理後 B正解 → C → D", [A, B, C, D], ["w", "c", "w", "w"], [A, B, C, D]],
    ["1-4 [A,B,C] 最後だけ正解 → 正常終了", [A, B, C], ["w", "w", "c"], [A, B, C]],
    ["1-5 [A,B,C] skip / timeout / 正解", [A, B, C], ["s", "t", "c"], [A, B, C]],
    ["1-6 [A,B,C] 全部正解", [A, B, C], ["c", "c", "c"], [A, B, C]]
  ];
  cases.forEach(([name, list, actions, expected]) => {
    setup(env, "kyokusen", list, due0);
    env.run("startDueReview()");
    const r = play(env, actions);
    check(name + "：表示順", J(r.shown) === J(expected), r.shown);
    check(name + "：各回答は表示した問題として記録", r.records.every((x) => x.recorded === x.shown), r.records);
    check(name + "：解説表示中の currentQuestion も回答した問題", r.records.every((x) => x.feedbackQ === x.shown), r.records);
    check(name + "：最後まで進むと finish", r.finishedAfter === true);
  });
  // 結果画面の数値
  setup(env, "kyokusen", [A, B, C], due0);
  env.run("startDueReview()");
  play(env, ["c", "w", "c"]);
  check("1-7 終了時の total=3 / correct=2 / history に1件追加",
    env.run("state.total") === 3 && env.run("state.correct") === 2 && env.run("state.history.length") === 1 &&
    env.run("el('finalScore').innerText") === "2/3");
}

console.log("\n[2] 間違えた問題だけ：卒業で wrong から消えても飛ばない");
{
  const grad = (ids) => (id) => (ids.includes(id) ? 3 : 0);  // 3 → 次の正解で卒業（卒業条件 4）
  const cases = [
    ["2-1 先頭 A が卒業", [A, B, C], grad([A]), ["c", "w", "w"], [A]],
    ["2-2 途中 B が卒業", [A, B, C], grad([B]), ["w", "c", "w"], [B]],
    ["2-3 A・B が連続で卒業", [A, B, C], grad([A, B]), ["c", "c", "w"], [A, B]],
    ["2-4 卒業しない正解", [A, B, C], grad([]), ["c", "c", "c"], []],
    ["2-5 不正解のみ", [A, B, C], grad([A, B, C]), ["w", "w", "w"], []],
    ["2-6 最後の C で卒業", [A, B, C], grad([C]), ["w", "w", "c"], [C]]
  ];
  cases.forEach(([name, list, streakOf, actions, graduated]) => {
    setup(env, "kyokusen", list, streakOf);
    const cleared0 = env.run("stats.clearedCount");
    env.run("startWrongOnlyReview()");
    const r = play(env, actions);
    check(name + "：開始時の対象が1回ずつ順番どおり", J(r.shown) === J(list), r.shown);
    check(name + "：各回答は表示した問題として記録", r.records.every((x) => x.recorded === x.shown), r.records);
    check(name + "：最後まで進むと finish", r.finishedAfter === true);
    // 卒業の効果（Phase 2 の仕様のまま）
    const wrongNow = env.run("state.wrong.map((q) => q.id)");
    const metaNow = env.run("Object.keys(state.reviewMeta)");
    const gaNow = env.run("Object.keys(state.graduatedAt)");
    check(name + "：卒業した問題は wrong / reviewMeta から外れ、graduatedAt に記録",
      graduated.every((id) => !wrongNow.includes(id) && !metaNow.includes(id) && gaNow.includes(id)) &&
      list.filter((id) => !graduated.includes(id)).every((id) => wrongNow.includes(id) && metaNow.includes(id) && !gaNow.includes(id)),
      { wrongNow, metaNow, gaNow });
    check(name + "：clearedCount は卒業数だけ増える", env.run("stats.clearedCount") === cleared0 + graduated.length);
  });
}

console.log("\n[3] 今日の復習中に、並びで前にある問題の期限が来る");
{
  // wrong の並び [X, A, B, C]。X は開始時点では期限前
  const [X, P, Q, R] = [A, B, C, D];
  setup(env, "kyokusen", [X, P, Q, R], () => 1, (id) => (id === X ? env.ctx.__NOW + 1500 : env.ctx.__NOW - 1000));
  env.run("startDueReview()");
  check("3-0 開始時の対象は X を含まない", J(env.run("currentList().map((q) => q.id)")) === J([P, Q, R]));
  env.ctx.__NOW += 100;
  env.run(`answer((currentQuestion().correct + 1) % currentQuestion().a.length)`); // P 不正解
  env.run("nextQuestion()");                                                  // Q を表示
  const shownQ = env.run("currentQuestion().id");
  env.ctx.__NOW += 5000;                                                     // Q 表示中に X の期限が来る
  check("3-1 前提: X は今 due になっている", env.run("dueReviewList().map((q) => q.id)").includes(X));
  check("3-2 期限が来ても表示中の問題は Q のまま", env.run("currentQuestion().id") === shownQ && shownQ === Q);
  const before = env.run("state.answerLog.length");
  env.run(`answer(currentQuestion().correct)`);                              // 画面の Q に正解
  const rec = env.run("state.answerLog").slice(before)[0];
  check("3-3 Q として採点・記録（isCorrect:true）", rec.questionId === Q && rec.isCorrect === true, rec);
  check("3-4 questionHistory も Q に記録", env.run(`stats.questionHistory[${J(Q)}].isCorrect`) === true &&
    !env.run(`stats.questionHistory[${J(X)}]`));
  check("3-5 解説は Q のもの", env.run("el('feedback').innerHTML") === env.run(`explainHTML(UNIT_META.kyokusen.questions.find((q) => q.id === ${J(Q)}), true)`));
  env.run("nextQuestion()");
  check("3-6 次は R、X はこのセッションに途中参加しない", env.run("currentQuestion().id") === R);
  env.run(`answer(currentQuestion().correct)`); env.run("nextQuestion()");
  check("3-7 R の後で終了", !env.run("currentQuestion()") && env.run("state.finished") === true);
  env.run("startDueReview()");
  check("3-8 次回の「今日の復習」で X が対象になる", env.run("currentList().map((q) => q.id)").includes(X));
}

console.log("\n[4] 回答後に currentQuestion() を読み直しても回答した問題（svgReveal が使う）");
{
  const hq = env.run("UNIT_META.hojosankaku.questions.filter((q) => q.svgReveal).map((q) => q.id)").slice(0, 3);
  setup(env, "hojosankaku", hq, due0);
  env.run("startDueReview()");
  const q0 = env.run("currentQuestion().id");
  env.run("answer(currentQuestion().correct)");
  check("4-1 正解でリストが縮んでも、解説表示中の currentQuestion は " + q0, env.run("currentQuestion().id") === q0);
  check("4-2 その問題に svgReveal がある", !!env.run("currentQuestion().svgReveal"));
}

console.log("\n[5] ほかのモードの出題順は変わらない");
{
  const all = unitIds(env, "kyokusen");
  setup(env, "kyokusen", [], due0);
  env.run("startExam()");
  check("5-1 通常試験", J(play(env, ["c", "w", "c", "c"]).shown) === J(all));
  setup(env, "kyokusen", [], due0);
  const stage = env.run("UNIT_META.kyokusen.questions[0].stage");
  env.run(`startStageOnly(${J(stage)})`);
  const stageIds = env.run(`UNIT_META.kyokusen.questions.filter((q) => q.stage === ${J(stage)}).map((q) => q.id)`);
  check("5-2 ステージ限定", J(play(env, ["c", "c", "c", "c"]).shown) === J(stageIds));
  setup(env, "kyokusen", [A, B, C], () => 3);
  env.run("startTipReview()");
  check("5-3 TIPS（卒業条件の問題でも tipList から減らない）", J(play(env, ["c", "w", "s"]).shown) === J([A, B, C]));
  setup(env, "kyokusen", [], due0);
  env.run("startUnansweredOnly()");
  const snap = env.run("state.unansweredSnapshot.map((q) => q.id)");
  const r = play(env, ["c", "w", "c", "c"]);
  check("5-4 未挑戦（unansweredSnapshot の順・内容のまま）", J(r.shown) === J(all) && J(snap) === J(all));
  check("5-5 未挑戦：unansweredSnapshot は従来どおり state に保存される", J(env.run("state.unansweredSnapshot.map((q) => q.id)")) === J(all));
}

console.log("\n[6] 固定リストはメモリだけ・破棄のタイミング");
{
  setup(env, "kyokusen", [A, B, C], due0);
  env.run("startDueReview()");
  const saved = JSON.parse(env.store["kyotsu_app_v14_kyokusen"]);
  check("6-1 保存データに固定リストが入らない（state のキーは defaultState と同じ）",
    J(Object.keys(saved.state)) === J(env.run("Object.keys(defaultState('kyokusen'))")), Object.keys(saved.state));
  check("6-2 reviewSessionIds は state のプロパティではない", !("reviewSessionIds" in saved.state) && !env.run("'reviewSessionIds' in state"));
  env.run("exitExamMode()");
  check("6-3 TOPへ戻る（exitExamMode）で破棄", env.run("reviewSessionIds") === null);
  env.run("startWrongOnlyReview()");
  play(env, ["w", "w", "w"]);
  check("6-4 finish で破棄", env.run("reviewSessionIds") === null);
  env.run("startDueReview()");
  env.run("selectUnit('keiryo')");
  check("6-5 単元切替で破棄", env.run("reviewSessionIds") === null);
  // リロード相当: 保存された mode が dueReview でも、固定リストが無ければ動的リストに戻さない
  setup(env, "kyokusen", [A, B, C], due0);
  env.run("startDueReview()");
  const reloaded = makeContext();
  Object.assign(reloaded.store, env.store);
  reloaded.run("selectUnit('kyokusen')");
  check("6-6 リロード後: 保存された mode は dueReview のまま", reloaded.run("state.mode") === "dueReview");
  check("6-7 リロード後: 固定リストが無いので currentList は空（動的リストに戻らない）", reloaded.run("currentList().length") === 0);
  reloaded.run("resumeExam()");
  check("6-8 リロード後の「途中から再開」は従来どおり通常モード", reloaded.run("state.mode") === "normal");
}

console.log("\n結果: " + pass + " OK / " + fail + " NG");
process.exit(fail ? 1 : 0);
