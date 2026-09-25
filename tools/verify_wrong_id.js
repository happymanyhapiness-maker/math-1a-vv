// -*- coding: utf-8 -*-
// verify_wrong_id.js
// Phase 7A-2b: 長期の復習対象 state.wrong を「問題オブジェクト丸ごと」から [{id}] だけにした変更の回帰テスト。
//  ・正規化（旧形式 / {id} / 文字列 / 不正値、重複除去、順番維持、非破壊）
//  ・load / addReviewTarget / save / 卒業
//  ・今日の復習 / 間違えた問題だけ / TIPS / 結果画面の再挑戦が、最新の UNIT_META だけで出題・採点される
//  ・UNIT_META に無いID（stale）は保存からは消さず、出題・件数表示からは外す
//  ・merge（通常 / 片側null / resetGen 世代違い / 旧端末からの再流入 / Phase 2 救済）
//  ・merge の wrong 以外は HEAD（変更前）と同じ結果
//  ・{id} 形式を旧コード（HEAD の app.js / firebase-sync.js）に渡しても壊れない
//
//   node tools/verify_wrong_id.js [比較元の firebase-sync.js] [比較元の app.js]
//   （比較元を省略すると git の HEAD から取り出す）

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const DIR = path.join(__dirname, "..");
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));

function gitShow(file) {
  return execSync("git show HEAD:" + file, { cwd: DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}
const OLD_SYNC_SRC = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : gitShow("firebase-sync.js");
const OLD_APP_SRC = process.argv[3] ? fs.readFileSync(process.argv[3], "utf8") : gitShow("app.js");
const NEW_SYNC_SRC = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8");
const NEW_APP_SRC = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
const CROSS_SRC = fs.readFileSync(path.join(DIR, "crossunit.js"), "utf8");

function extract(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error("抽出失敗: " + startMarker);
  return src.slice(s, e);
}
function loadMerge(src) {
  const body = extract(src.replace(/\r\n/g, "\n"), "function freshness",
    "/* =========================================================\n   Firestore 入出力");
  return new Function(body + "\nreturn mergeUnitData;")();
}
const mergeNew = loadMerge(NEW_SYNC_SRC);
const mergeOld = loadMerge(OLD_SYNC_SRC);

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
function makeContext(appSrc, withCross) {
  const els = {};
  const store = {};
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
  vm.runInContext(appSrc, ctx, { filename: "app.js" });
  if (withCross) vm.runInContext(CROSS_SRC, ctx, { filename: "crossunit.js" });
  return { ctx, els, store, alerts, run: (code) => vm.runInContext(code, ctx) };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail) : "")); }
}

const UNIT = "kyokusen"; // 4問・方針クイズなし
const KEY = "kyotsu_app_v14_" + UNIT;
const env = makeContext(NEW_APP_SRC, true);
const qs = env.run(`UNIT_META.${UNIT}.questions`);
const [A, B, Cq, D] = qs.map((q) => q.id);
const GONE = "gone-q1"; // UNIT_META に無いID
const isIdOnly = (w) => Array.isArray(w) && w.every((x) => x && typeof x === "object" && Object.keys(x).length === 1 && typeof x.id === "string");
const wIds = (w) => (w || []).map((x) => (typeof x === "string" ? x : x && x.id));
const saved = () => JSON.parse(env.store[KEY]);

// 旧形式の問題オブジェクト（中身は古い内容にしておく）
function staleObj(id) {
  const q = C(qs.find((x) => x.id === id) || qs[0]);
  q.id = id;
  q.q = "【古い問題文】" + id;
  q.a = ["古い選択肢0", "古い選択肢1", "古い選択肢2"];
  q.correct = (q.correct + 1) % q.a.length; // 古い正解
  q.explain = { why: "古い解説", mistake: "古いミス", tip: "古いコツ" };
  return q;
}
// localStorage に保存データを直接置いて単元を開く（= 起動・リロード相当）
function openWith(wrong, meta, extra) {
  const data = {
    state: Object.assign(env.run(`defaultState(${J(UNIT)})`), { wrong, reviewMeta: meta || {} }, extra || {}),
    stats: env.run("defaultStats()")
  };
  env.store[KEY] = J(data);
  env.run(`selectUnit(${J(UNIT)})`);
}
const pastDue = (ids) => Object.fromEntries(ids.map((id) => [id, { streak: 0, dueAt: env.ctx.__NOW - 1000, lastSeenAt: null }]));
function play(actions) {
  const shown = [];
  for (const a of actions) {
    const q = env.run("currentQuestion()");
    if (!q) break;
    shown.push({ id: q.id, q: q.q });
    env.ctx.__NOW += 1000;
    if (a === "c") env.run("answer(currentQuestion().correct)");
    else if (a === "w") env.run("answer((currentQuestion().correct + 1) % currentQuestion().a.length)");
    env.run("nextQuestion()");
  }
  return shown;
}

// ---------------------------------------------------------------
console.log("[1] 正規化 helper（app.js / firebase-sync.js）");
try {
  const newSyncNorm = new Function(extract(NEW_SYNC_SRC.replace(/\r\n/g, "\n"), "function normalizeWrong", "// 旧仕様の tipList") + "\nreturn normalizeWrong;")();
  const input = [staleObj(A), { id: B }, Cq, null, undefined, 3, {}, { id: "" }, { id: 5 }, { id: A }, "", B, { id: D, q: "x" }];
  const before = J(input);
  const expected = [{ id: A }, { id: B }, { id: Cq }, { id: D }];
  const outApp = env.run(`normalizeWrong(${before})`);
  check("1-1 app.js: 旧形式 / {id} / 文字列 / 不正値の混在 → [{id}]・重複除去・最初の順番", J(outApp) === J(expected), outApp);
  check("1-2 firebase-sync.js も同じ結果", J(newSyncNorm(JSON.parse(before))) === J(expected));
  const arr = JSON.parse(before);
  newSyncNorm(arr); env.ctx.__arr = arr; env.run("normalizeWrong(__arr)");
  check("1-3 元の配列を変更しない", J(arr) === before);
  check("1-4 null / 非配列 → []", J(env.run("normalizeWrong(null)")) === "[]" && J(newSyncNorm({ id: A })) === "[]");
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n[2] load / save / addReviewTarget / 卒業");
try {
  openWith([staleObj(A), staleObj(B), staleObj(A)], pastDue([A, B]));
  check("2-1 load: 旧形式の wrong が [{id}] になる（順番維持・重複除去）", J(env.run("state.wrong")) === J([{ id: A }, { id: B }]), env.run("state.wrong"));
  check("2-2 reviewMeta は変わらない", J(env.run("state.reviewMeta")) === J(pastDue([A, B])));
  env.run("save()");
  check("2-3 save: 保存された wrong は [{id}] だけ", isIdOnly(saved().state.wrong) && J(wIds(saved().state.wrong)) === J([A, B]));
  // save で state.wrong に不正な形が混じっていても保存は [{id}]
  env.run(`state.wrong.push(${J(staleObj(Cq))})`); env.run("save()");
  check("2-4 save: メモリに旧形式が混じっても保存は [{id}]", isIdOnly(saved().state.wrong) && J(wIds(saved().state.wrong)) === J([A, B, Cq]));
  env.run("state.wrong = normalizeWrong(state.wrong)");

  env.run(`state.mode = "normal"; addReviewTarget(UNIT_META.${UNIT}.questions.find((q) => q.id === ${J(D)}))`);
  check("2-5 addReviewTarget: 追加は {id} だけ", J(env.run("state.wrong[state.wrong.length - 1]")) === J({ id: D }));
  env.run(`addReviewTarget(UNIT_META.${UNIT}.questions.find((q) => q.id === ${J(D)}))`);
  check("2-6 addReviewTarget: 同じIDは重複しない", env.run("state.wrong.length") === 4);
  check("2-7 addReviewTarget: 新しい問題の reviewMeta は従来どおり作られる", env.run(`state.reviewMeta[${J(D)}].streak`) === 0);

  // 卒業：kyokusen は reviewClearStreak 既定 4 → streak 3 から1回正解で卒業
  env.run(`state.reviewMeta[${J(A)}] = { streak: 3, dueAt: 0, lastSeenAt: 1 }`);
  env.run(`markReviewResult(UNIT_META.${UNIT}.questions.find((q) => q.id === ${J(A)}), true)`);
  check("2-8 卒業: {id} 形式の wrong から ID で外れ、graduatedAt に記録",
    !wIds(env.run("state.wrong")).includes(A) && typeof env.run(`state.graduatedAt[${J(A)}]`) === "number" && !env.run(`state.reviewMeta[${J(A)}]`));
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n[3] 最新の UNIT_META だけが問題の正本（古い問題文・正解・解説を使わない）");
try {
  openWith([staleObj(A), staleObj(B)], pastDue([A, B]));
  env.run("startDueReview()");
  const q = env.run("currentQuestion()");
  const meta = qs.find((x) => x.id === A);
  check("3-1 今日の復習: 表示は最新の問題文", q.id === A && q.q === meta.q && !String(q.q).includes("古い"));
  env.ctx.__NOW += 1000;
  env.run(`answer(${meta.correct})`);
  const rec = env.run("state.answerLog[state.answerLog.length - 1]");
  check("3-2 採点は最新の正解（最新の correct を選ぶと正解になる）", rec.questionId === A && rec.isCorrect === true, rec);

  openWith([staleObj(A), staleObj(B)], pastDue([A, B]));
  env.run("startWrongOnlyReview()");
  check("3-3 間違えた問題だけ: 最新の問題文", env.run("currentQuestion().q") === meta.q);

  openWith([staleObj(A), staleObj(B)], pastDue([A, B]));
  env.run("startTipReview()");
  const html = env.run("explainHTML(currentQuestion(), true)");
  check("3-4 TIPS: 最新のコツが出て、古いコツは出ない", html.includes(String(meta.explain.tip).slice(0, 10)) && !html.includes("古いコツ"));
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n[4] UNIT_META に無いID（stale）：保存からは消さず、出題・件数からは外す");
try {
  openWith([{ id: GONE }, staleObj(A), { id: B }], pastDue([GONE, A, B]));
  check("4-1 load 後も stale ID は wrong に残る", J(wIds(env.run("state.wrong"))) === J([GONE, A, B]));
  env.run("save()");
  check("4-2 save 後の保存データにも残る", J(wIds(saved().state.wrong)) === J([GONE, A, B]));
  env.run("update()");
  check("4-3 今日の復習の件数に含めない（2件）", env.run("dueReviewCount()") === 2 && String(env.els.todayReviewCount.innerText) === "2");
  env.run("startDueReview()");
  check("4-4 今日の復習に出ない", J(play(["w", "w", "w"]).map((x) => x.id)) === J([A, B]));
  openWith([{ id: GONE }, { id: A }, { id: B }], pastDue([GONE, A, B]));
  env.run("startWrongOnlyReview()");
  check("4-5 間違えた問題だけに出ない", J(play(["w", "w", "w"]).map((x) => x.id)) === J([A, B]));
  openWith([{ id: GONE }, { id: A }, { id: B }], pastDue([GONE, A, B]));
  env.run("startTipReview()");
  const t = play(["c", "c", "c"]);
  check("4-6 TIPS に出ない・undefined 問題にならない", J(t.map((x) => x.id)) === J([A, B]) && t.every((x) => x.q));
  check("4-7 セッション後も stale ID は wrong に残る", wIds(env.run("state.wrong")).includes(GONE));

  // 結果画面の再挑戦（今回の試験の誤答との照合）
  openWith([{ id: GONE }], pastDue([GONE]));
  env.run("startExam()");
  env.run(`examWrongIds = [${J(GONE)}, ${J(A)}]; state.wrong.push({ id: ${J(A)} });`);
  env.alerts.length = 0;
  env.run("retryWrongFromResult()");
  check("4-8 結果画面の再挑戦も stale ID を除く", env.run("reviewSessionIds") && J(env.run("reviewSessionIds")) === J([A]));

  // 有効な wrong が0件
  openWith([{ id: GONE }, { id: "gone-q2" }], pastDue([GONE, "gone-q2"]));
  const modeBefore = env.run("state.mode");
  env.alerts.length = 0;
  env.run("startDueReview()");
  env.run("startWrongOnlyReview()");
  env.run("startTipReview()");
  check("4-9 有効な wrong が0件: 3つとも「対象なし」の alert でセッションに入らない",
    env.alerts.length === 3 && env.run("state.mode") === modeBefore && env.run("currentQuestion()") !== undefined, env.alerts);
  check("4-10 0件のときの今日の復習 alert は「復習対象の問題がありません」", env.alerts[0] === "復習対象の問題がありません。", env.alerts[0]);
  openWith([{ id: GONE }], pastDue([GONE]));
  env.run("startExam()");
  env.run(`examWrongIds = [${J(GONE)}]`);
  env.alerts.length = 0;
  env.run("retryWrongFromResult()");
  check("4-11 結果画面の再挑戦が stale だけなら「対象なし」", env.alerts.length === 1 && env.run("state.mode") === "normal");

  // crossunit の件数
  env.store[KEY] = J({ state: Object.assign(env.run(`defaultState(${J(UNIT)})`), {
    wrong: [{ id: GONE }, staleObj(A), { id: B }, B],
    answerLog: [{ questionId: A, isCorrect: false, timestamp: env.ctx.__NOW, outcome: "answered" }]
  }), stats: env.run("defaultStats()") });
  const rep = env.run("buildCrossUnitReport()");
  const line = rep.split("\n").find((l) => l.includes(env.run(`UNIT_META.${UNIT}.label`)) && l.includes("正答率"));
  check("4-12 crossunit の誤答リスト件数は有効IDだけ（2問）", !!line && line.includes("誤答リスト 2問"), line);

  // 問題データに戻したら、また有効
  env.run(`UNIT_META.${UNIT}.questions.push(Object.assign({}, UNIT_META.${UNIT}.questions[0], { id: ${J(GONE)}, q: "戻した問題" }))`);
  openWith([{ id: GONE }, { id: A }], pastDue([GONE, A]));
  check("4-13 UNIT_META に戻すと件数に入る", env.run("dueReviewCount()") === 2);
  env.run("startDueReview()");
  check("4-14 UNIT_META に戻すとまた出題される（最新の問題文）", J(play(["w", "w"]).map((x) => x.q)) === J(["戻した問題", qs[0].q]));
  env.run(`UNIT_META.${UNIT}.questions.pop()`);
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n[5] merge");
try {
  const mk = (wrong, meta, log, extra) => ({
    state: Object.assign({ unit: UNIT, wrong, reviewMeta: meta || {}, answerLog: log || [], history: [] }, extra || {}),
    stats: { questionHistory: {} }
  });
  const log = (id, ts, isCorrect, outcome) => ({ questionId: id, timestamp: ts, isCorrect, outcome: outcome || "answered" });

  const a = mk([staleObj(A), { id: B }], { [A]: { streak: 1, dueAt: 10, lastSeenAt: 5 }, [B]: { streak: 0, dueAt: 20, lastSeenAt: null } }, [log(A, 5, false)]);
  const b = mk([Cq, staleObj(A)], { [A]: { streak: 0, dueAt: 30, lastSeenAt: 30 }, [Cq]: { streak: 0, dueAt: 40, lastSeenAt: null } }, [log(Cq, 40, false)]);
  const m = mergeNew(C(a), C(b));
  check("5-1 通常: 結果は [{id}] だけ", isIdOnly(m.state.wrong), m.state.wrong);
  check("5-2 通常: 新しい側の順 → 古い側だけのもの（既存の順序仕様）", J(wIds(m.state.wrong)) === J([Cq, A, B]), wIds(m.state.wrong));
  check("5-3 片側 null（local だけ）でも [{id}]", isIdOnly(mergeNew(C(a), null).state.wrong) && J(wIds(mergeNew(C(a), null).state.wrong)) === J([A, B]));
  check("5-4 片側 null（remote だけ）でも [{id}]", isIdOnly(mergeNew(null, C(b)).state.wrong) && J(wIds(mergeNew(null, C(b)).state.wrong)) === J([Cq, A]));
  const g1 = mk([staleObj(D)], {}, [], { resetGen: 1 });
  const r1 = mergeNew(C(a), C(g1)), r2 = mergeNew(C(g1), C(a));
  check("5-5 resetGen 世代違いの早期 return でも [{id}]（新しい世代を採用）",
    isIdOnly(r1.state.wrong) && J(wIds(r1.state.wrong)) === J([D]) && J(r1) === J(r2));
  const s1 = mk([{ id: GONE }, staleObj(A)], { [GONE]: { streak: 0, dueAt: 1, lastSeenAt: null }, [A]: { streak: 0, dueAt: 1, lastSeenAt: null } });
  const s2 = mk([{ id: A }], { [A]: { streak: 0, dueAt: 2, lastSeenAt: 2 } }, [log(A, 2, false)]);
  check("5-6 stale ID を merge で勝手に消さない", wIds(mergeNew(C(s2), C(s1)).state.wrong).includes(GONE) && wIds(mergeNew(C(s1), C(s2)).state.wrong).includes(GONE));
  check("5-7 入力を変更しない", J(a) === J(mk([staleObj(A), { id: B }], { [A]: { streak: 1, dueAt: 10, lastSeenAt: 5 }, [B]: { streak: 0, dueAt: 20, lastSeenAt: null } }, [log(A, 5, false)])));
  // 同じ中身で形式だけ違う入力 → 同じ結果
  const toId = (d) => { const x = C(d); x.state.wrong = wIds(x.state.wrong).filter(Boolean).map((id) => ({ id })); return x; };
  const toStr = (d) => { const x = C(d); x.state.wrong = wIds(x.state.wrong); return x; };
  check("5-8 旧形式 / {id} / 文字列のどれで来ても同じ結果",
    J(mergeNew(C(a), C(b))) === J(mergeNew(toId(a), toStr(b))) && J(mergeNew(toStr(a), toId(b))) === J(m));

  // Phase 2 救済：卒業後、卒業を知らない旧端末で間違えた
  const GA = 1000;
  const local = mk([{ id: B }], { [B]: { streak: 0, dueAt: 1, lastSeenAt: null } }, [log(A, 900, true)], { graduatedAt: { [A]: GA } });
  const oldDev = mk([staleObj(A), staleObj(B)], { [A]: { streak: 3, dueAt: 800, lastSeenAt: 800 }, [B]: { streak: 0, dueAt: 1, lastSeenAt: null } },
    [log(A, 1500, false), log(A, 1600, false)]);
  const pr = mergeNew(C(local), C(oldDev));
  check("5-9 Phase 2 救済: A は wrong に戻り、reviewMeta は streak 0 / dueAt = 卒業後最初の誤答時刻",
    wIds(pr.state.wrong).includes(A) && J(pr.state.reviewMeta[A]) === J({ streak: 0, dueAt: 1500, lastSeenAt: null }) && pr.state.graduatedAt[A] === GA);
  const pOld = mergeOld(C(local), C(oldDev));
  const strip = (d) => { const x = C(d); x.state.wrong = wIds(x.state.wrong); return x; };
  check("5-10 Phase 2 救済: wrong の形式以外は HEAD と完全一致（reviewMeta / graduatedAt / answerLog / 順番）", J(strip(pr)) === J(strip(pOld)));
  // 卒業前の古い wrong は戻らない
  const oldDev2 = mk([staleObj(A)], { [A]: { streak: 3, dueAt: 800, lastSeenAt: 800 } }, [log(A, 800, true)]);
  const pr2 = mergeNew(C(local), C(oldDev2));
  check("5-11 卒業前の旧形式 wrong では卒業が取り消されない", !wIds(pr2.state.wrong).includes(A) && !pr2.state.reviewMeta[A]);
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n[6] merge: HEAD（変更前）とのランダム比較（wrong は ID 列として比較、それ以外は完全一致）");
try {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const pool = [A, B, Cq, D, GONE];
  const randWrong = () => {
    const out = [];
    const n = rnd(5);
    for (let i = 0; i < n; i++) {
      const id = pool[rnd(pool.length)];
      const k = rnd(3);
      out.push(k === 0 ? staleObj(id) : { id });
    }
    return out;
  };
  const dedupe = (w) => { const s = new Set(); return w.filter((x) => { if (s.has(x.id)) return false; s.add(x.id); return true; }); };
  const randData = () => {
    const meta = {};
    pool.forEach((id) => { if (rnd(2)) meta[id] = { streak: rnd(4), dueAt: rnd(3000), lastSeenAt: rnd(2) ? rnd(3000) : null }; });
    const ga = {};
    pool.forEach((id) => { if (rnd(4) === 0) ga[id] = rnd(3000); });
    const lg = [];
    for (let i = 0, n = rnd(5); i < n; i++) lg.push({ questionId: pool[rnd(pool.length)], timestamp: rnd(3000), isCorrect: !!rnd(2), outcome: ["answered", "timeout", "skip"][rnd(3)] });
    lg.sort((x, y) => x.timestamp - y.timestamp);
    const d = { state: { unit: UNIT, wrong: dedupe(randWrong()), reviewMeta: meta, answerLog: lg, history: [] }, stats: { questionHistory: {} } };
    if (rnd(2)) d.state.graduatedAt = ga;
    if (rnd(5) === 0) d.state.resetGen = rnd(3);
    return d;
  };
  let diff = 0, notIdOnly = 0, firstDiff = null;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const x = rnd(8) === 0 ? null : randData();
    const y = rnd(8) === 0 ? null : randData();
    if (!x && !y) continue;
    const n = mergeNew(C(x), C(y));
    const o = mergeOld(C(x), C(y));
    if (!isIdOnly(n.state.wrong)) notIdOnly++;
    const norm = (d) => { const z = C(d); z.state.wrong = wIds(z.state.wrong); return z; };
    if (J(norm(n)) !== J(norm(o))) { diff++; if (!firstDiff) firstDiff = { x, y, n, o }; }
  }
  check("6-1 " + N + " ケースすべて merge 結果の wrong は [{id}]", notIdOnly === 0, notIdOnly);
  check("6-2 " + N + " ケースすべて、wrong の形式以外は HEAD と完全一致（ID の並びも同じ）", diff === 0, firstDiff);
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n[7] 旧端末との互換（HEAD の app.js / firebase-sync.js）");
try {
  const newData = { state: { unit: UNIT, wrong: [{ id: A }, { id: B }], reviewMeta: pastDue([A, B]), answerLog: [], history: [] }, stats: { questionHistory: {} } };
  // new → 旧 merge
  const om = mergeOld(C(newData), mk2([staleObj(Cq)], pastDue([Cq])));
  check("7-1 旧 merge に {id} 形式を渡しても壊れず、ID は保たれる", J(wIds(om.state.wrong)) === J([A, B, Cq]), wIds(om.state.wrong));
  const om2 = mergeOld(mk2([staleObj(Cq)], { [Cq]: { streak: 0, dueAt: 1, lastSeenAt: 9e12 } }), C(newData));
  check("7-2 旧 merge で {id} 形式が古い側でも取り込まれる", J(wIds(om2.state.wrong).sort()) === J([A, B, Cq].sort()));

  // new → 旧 app（キャッシュされた旧 JS のタブ）
  const old = makeContext(OLD_APP_SRC, false);
  old.ctx.__NOW = env.ctx.__NOW;
  const full = Object.assign(old.run(`defaultState(${J(UNIT)})`), { wrong: [{ id: A }, { id: B }], reviewMeta: pastDue([A, B]) });
  old.store[KEY] = J({ state: full, stats: old.run("defaultStats()") });
  old.run(`selectUnit(${J(UNIT)})`);
  old.run("update()");
  check("7-3 旧 app: 読み込み・件数表示が壊れない", old.run("dueReviewCount()") === 2);
  old.run("startDueReview()");
  const oq = old.run("currentQuestion()");
  check("7-4 旧 app: 今日の復習は最新の UNIT_META から出る", oq && oq.id === A && oq.q === qs[0].q);
  old.run("startWrongOnlyReview()");
  check("7-5 旧 app: 間違えた問題だけも出る", old.run("currentQuestion().id") === A);
  old.run("startTipReview()");
  check("7-6 旧 app: TIPS も出る", old.run("currentQuestion().id") === A);
  old.run(`state.mode = "normal"; addReviewTarget(UNIT_META.${UNIT}.questions[2])`);
  check("7-7 旧 app: addReviewTarget は旧形式を足すが ID 重複はしない", J(wIds(old.run("state.wrong"))) === J([A, B, Cq]));
  old.run(`markReviewResult(UNIT_META.${UNIT}.questions[0], true); state.reviewMeta[${J(A)}] = { streak: 3, dueAt: 0, lastSeenAt: 1 }; markReviewResult(UNIT_META.${UNIT}.questions[0], true);`);
  check("7-8 旧 app: {id} 形式の要素も卒業で外れる", !wIds(old.run("state.wrong")).includes(A));
  old.run("save()");
  const oldSaved = JSON.parse(old.store[KEY]);

  // 旧端末が旧形式を再流入 → 新コードの merge / load / save で [{id}] に戻る
  const back = mergeNew(C(newData), C(oldSaved));
  check("7-9 旧形式の再流入: merge 結果は [{id}]", isIdOnly(back.state.wrong), back.state.wrong);
  env.store[KEY] = J(oldSaved);
  env.run(`selectUnit(${J(UNIT)})`);
  check("7-10 旧形式の再流入: load で [{id}]", isIdOnly(env.run("state.wrong")) && J(wIds(env.run("state.wrong"))) === J([B, Cq]));
  env.run("save()");
  check("7-11 旧形式の再流入: 次の save で保存も [{id}]", isIdOnly(saved().state.wrong));

  function mk2(wrong, meta) { return { state: { unit: UNIT, wrong, reviewMeta: meta, answerLog: [], history: [] }, stats: { questionHistory: {} } }; }
} catch (e) { check("例外なく実行できる", false, String(e && e.message)); }

console.log("\n結果: " + pass + " OK / " + fail + " NG");
process.exit(fail ? 1 : 0);
