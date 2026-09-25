// -*- coding: utf-8 -*-
// verify_sync_merge.js
// firebase-sync.js の mergeUnitData() を「ソースから抜き出して」そのまま動かし、
// stats.questionHistory が同期マージで失われないこと（2026-09 監査 ④-1）と、
// 既存フィールドのマージ結果が変わっていないことを確認する。
// あわせて、起動時 syncAll の「local と merged の文字列比較 → changedLocal → リロード」を
// 再現し、questionHistory の差分だけでリロードが起きないことを確認する。
// Firestore には一切アクセスしない（純粋関数のテスト）。
//
//   node tools/verify_sync_merge.js            … 現在の firebase-sync.js を検査
//   node tools/verify_sync_merge.js <path>     … 別ファイル（修正前の版など）を検査

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..");
const SYNC_PATH = process.argv[2] || path.join(DIR, "firebase-sync.js");

// ---- firebase-sync.js / app.js から本物の関数を抜き出す ----
function extract(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error("抽出失敗: " + startMarker);
  return src.slice(s, e);
}
const syncSrc = fs.readFileSync(SYNC_PATH, "utf8");
const mergeUnitData = new Function(
  extract(syncSrc, "function freshness", "/* =========================================================\n   Firestore 入出力") +
  "\nreturn mergeUnitData;"
)();
const appSrc = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
const { defaultState, defaultStats } = new Function(
  extract(appSrc, "function defaultState", "let state = defaultState(null);") +
  "\nreturn { defaultState, defaultStats };"
)();

// ---- 小道具 ----
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));
// キー順を無視した意味上の比較用
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = {};
    Object.keys(v).sort().forEach((k) => { o[k] = canon(v[k]); });
    return o;
  }
  return v;
}
const same = (a, b) => J(canon(a)) === J(canon(b));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail) : "")); }
}

// app.js の logAnswer() と同じ形で1回答を記録する
function answer(data, qid, ts, isCorrect) {
  data.state.answerLog.push({
    questionId: qid, stage: "第1問", num: 1, weakness: "計算精度", route: [],
    selectedIndex: isCorrect ? 0 : 1, selectedText: isCorrect ? "a" : "b", selectedTag: null,
    correctIndex: 0, correctText: "a", correctTag: null,
    isCorrect, outcome: "answered", mode: "normal", timestamp: ts, elapsedTime: 30
  });
  data.state.total++;
  if (isCorrect) data.state.correct++;
  data.stats.stage["第1問"].t++;
  if (isCorrect) data.stats.stage["第1問"].c++;
  else data.stats.weakness["計算精度"]++;
  data.stats.questionHistory[qid] = { date: ts, isCorrect };
}
// app.js の save() が書く形そのもの（state/stats の既定キー順を含む）
function fresh(unit) {
  return { state: defaultState(unit), stats: defaultStats() };
}
// firebase-sync.js syncAll() の比較部分の再現
function startupSync(local, remote) {
  const merged = mergeUnitData(local, remote);
  const mergedStr = J(merged);
  return {
    merged,
    changedLocal: mergedStr !== (local ? J(local) : null),
    writeRemote: mergedStr !== (remote ? J(remote) : null)
  };
}

console.log("対象: " + path.relative(DIR, SYNC_PATH));

// ---------------------------------------------------------------
console.log("\n[1] local だけに questionHistory がある");
{
  const local = fresh("keiryo");
  answer(local, "k1", 1000, true);
  answer(local, "k2", 2000, false);
  const remote = C(local);
  delete remote.stats.questionHistory; // 旧版マージで剥がされた remote（本番の現状）
  const m = mergeUnitData(local, remote);
  check("k1/k2 が残る", same(m.stats.questionHistory, local.stats.questionHistory), m.stats.questionHistory);
}

console.log("\n[2] remote だけに questionHistory がある");
{
  const remote = fresh("keiryo");
  answer(remote, "k1", 1000, true);
  const local = C(remote);
  delete local.stats.questionHistory;
  const m = mergeUnitData(local, remote);
  check("remote の k1 が取り込まれる", same(m.stats.questionHistory, { k1: { date: 1000, isCorrect: true } }), m.stats.questionHistory);
}

console.log("\n[3] 両方に同じ問題の履歴がある");
{
  const base = fresh("keiryo");
  answer(base, "k1", 1000, false);
  const a = C(base), b = C(base);
  answer(a, "k1", 3000, true);  // 端末A: 後で正解
  answer(b, "k1", 2000, false); // 端末B: その前に不正解
  const m1 = mergeUnitData(a, b), m2 = mergeUnitData(b, a);
  check("date が新しい方（A: 3000/○）を採用", same(m1.stats.questionHistory.k1, { date: 3000, isCorrect: true }), m1.stats.questionHistory.k1);
  check("引数順を入れ替えても同じ", same(m1.stats.questionHistory, m2.stats.questionHistory), m2.stats.questionHistory);

  // 古い側が新しい date を持つケース（answerLog の freshness と questionHistory の date がねじれても date で決まる）
  const c = C(base), d = C(base);
  answer(c, "k9", 9000, false);                          // c の方が freshness は新しい
  c.stats.questionHistory.k1 = { date: 1000, isCorrect: false };
  d.stats.questionHistory.k1 = { date: 5000, isCorrect: true };
  const m3 = mergeUnitData(c, d);
  check("freshness ではなく問題ごとの date で決まる", same(m3.stats.questionHistory.k1, { date: 5000, isCorrect: true }), m3.stats.questionHistory.k1);

  // 同一 date の tie: isCorrect:false を優先（どちらの引数順でも）
  const e = C(base), f = C(base);
  e.stats.questionHistory.k1 = { date: 7000, isCorrect: true };
  f.stats.questionHistory.k1 = { date: 7000, isCorrect: false };
  const t1 = mergeUnitData(e, f).stats.questionHistory.k1;
  const t2 = mergeUnitData(f, e).stats.questionHistory.k1;
  check("tie は isCorrect:false を優先（e,f）", same(t1, { date: 7000, isCorrect: false }), t1);
  check("tie は isCorrect:false を優先（f,e）", same(t2, { date: 7000, isCorrect: false }), t2);

  // 壊れたエントリ（date 無し）は date=0 扱いで、正常な方に負ける
  const g = C(base), h = C(base);
  g.stats.questionHistory.k1 = { isCorrect: true };
  h.stats.questionHistory.k1 = { date: 10, isCorrect: false };
  check("date 欠落エントリは正常な方に負ける",
    same(mergeUnitData(g, h).stats.questionHistory.k1, { date: 10, isCorrect: false }) &&
    same(mergeUnitData(h, g).stats.questionHistory.k1, { date: 10, isCorrect: false }));
}

console.log("\n[4] 両方に別の問題の履歴がある");
{
  const base = fresh("keiryo");
  const a = C(base), b = C(base);
  answer(a, "k1", 1000, true);
  answer(b, "k2", 2000, false);
  const m = mergeUnitData(a, b);
  check("k1 と k2 の両方が残る", same(m.stats.questionHistory, {
    k1: { date: 1000, isCorrect: true }, k2: { date: 2000, isCorrect: false }
  }), m.stats.questionHistory);
}

console.log("\n[5] merge(local, local のコピー) で消えない");
{
  const local = fresh("keiryo");
  answer(local, "k1", 1000, true);
  answer(local, "k2", 2000, false);
  const m = mergeUnitData(local, C(local));
  check("questionHistory が残る", same(m.stats.questionHistory, local.stats.questionHistory), m.stats.questionHistory);
  check("文字列として local と完全一致（キー順含む）", J(m) === J(local));
}

console.log("\n[6] 冪等性");
{
  const a = fresh("keiryo"), b = fresh("keiryo");
  answer(a, "k1", 1000, true); answer(a, "k3", 3000, true);
  answer(b, "k2", 2000, false); answer(b, "k3", 2500, false);
  const m = mergeUnitData(a, b);
  check("merge(m, m) === m", J(mergeUnitData(m, C(m))) === J(m));
  check("merge(m, a) === m（取り込み済みの片側を再マージ）", J(mergeUnitData(m, a)) === J(m));
  check("merge(m, b) === m", J(mergeUnitData(m, b)) === J(m));
}

console.log("\n[7] 引数順を変えても意味上同じ");
{
  const a = fresh("keiryo"), b = fresh("keiryo");
  answer(a, "k1", 1000, true); answer(a, "k3", 3000, true);
  answer(b, "k2", 2000, false); answer(b, "k3", 2500, false);
  const ab = mergeUnitData(a, b), ba = mergeUnitData(b, a);
  check("questionHistory が一致", same(ab.stats.questionHistory, ba.stats.questionHistory));
  check("stats 全体が一致", same(ab.stats, ba.stats));
  check("answerLog が一致", same(ab.state.answerLog, ba.state.answerLog));
}

console.log("\n[8] 既存フィールドのマージ結果は修正前と同じ");
{
  // 修正前の版は questionHistory 以外は同じはず、を直接比べる代わりに、
  // 旧仕様（answerLog 和集合 / weakness・stage・clearedCount は max / 進行状況は newer 優先）を明示検査
  const a = fresh("keiryo"), b = fresh("keiryo");
  answer(a, "k1", 1000, true); answer(a, "k2", 3000, false);
  answer(b, "k1", 1000, true); answer(b, "k3", 2000, false); answer(b, "k4", 2100, false);
  a.stats.clearedCount = 2; b.stats.clearedCount = 5;
  a.state.index = 7; b.state.index = 3;
  const m = mergeUnitData(a, b);
  check("answerLog は和集合＋重複除去＋時刻順",
    J(m.state.answerLog.map((r) => r.questionId + "@" + r.timestamp)) === J(["k1@1000", "k3@2000", "k4@2100", "k2@3000"]),
    m.state.answerLog.map((r) => r.questionId + "@" + r.timestamp));
  check("weakness は max", m.stats.weakness["計算精度"] === 2, m.stats.weakness);
  check("stage は t/c それぞれ max", same(m.stats.stage["第1問"], { t: 3, c: 1 }), m.stats.stage["第1問"]);
  check("clearedCount は max", m.stats.clearedCount === 5);
  check("進行状況は newer（a: freshness 3000）優先", m.state.index === 7);
  check("stats のキー順は app.js defaultStats と同じ",
    J(Object.keys(m.stats)) === J(Object.keys(defaultStats())), Object.keys(m.stats));

  // どちらにも questionHistory が無い古いデータでは、キーを生やさない（出力不変）
  const x = C(a), y = C(b);
  delete x.stats.questionHistory; delete y.stats.questionHistory;
  const mx = mergeUnitData(x, y);
  check("両側に無ければ questionHistory キーを作らない", !("questionHistory" in mx.stats), Object.keys(mx.stats));
}

console.log("\n[9] 起動時 syncAll の changedLocal（＝リロード）判定");
{
  // (a) 本番の現状: remote は旧版マージで questionHistory が剥がれている、local は持っている
  const local = fresh("keiryo");
  answer(local, "k1", 1000, true);
  const remote = C(local);
  delete remote.stats.questionHistory;
  const r1 = startupSync(local, remote);
  check("(a) 修正後の初回起動: changedLocal=false（local は書き換わらない）", r1.changedLocal === false);
  check("(a) remote には questionHistory を補って1回だけ書き戻す", r1.writeRemote === true && !!r1.merged.stats.questionHistory.k1);

  // (b) 定常状態（単一端末）: 前回セッションで回答→pushDirty 済み、そのまま次回起動
  const l2 = C(r1.merged);
  let rem = r1.merged;
  answer(l2, "k2", 2000, false);           // 新しい問題
  rem = mergeUnitData(l2, rem);            // pushDirty 相当
  answer(l2, "k1", 3000, false);           // 既存の問題を再回答（キー位置は据え置き）
  rem = mergeUnitData(l2, rem);            // pushDirty 相当
  const r2 = startupSync(l2, rem);
  check("(b) 次回起動: changedLocal=false", r2.changedLocal === false);
  check("(b) 次回起動: remote 書き込みも発生しない", r2.writeRemote === false);

  // (c) pushDirty が届かずに終わった場合（remote が1回分古い）でも local は変わらない
  const l3 = C(l2);
  answer(l3, "k5", 4000, true);
  const r3 = startupSync(l3, rem);
  check("(c) remote が古いだけなら changedLocal=false", r3.changedLocal === false);

}

// ---------------------------------------------------------------
// [10] 以降は app.js の本物の save() / loadUnit() を抜き出して、偽の localStorage 上で動かす
function makeApp() {
  const store = {};
  const ls = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const consts = appSrc.match(/^const (STORAGE_PREFIX|LEGACY_STORAGE_KEY|UNIT_KEY) = .*$/gm).join("\n");
  const factory = new Function("localStorage", "el",
    consts + "\n" +
    extract(appSrc, "function defaultState", "let state = defaultState(null);") +
    "\nlet state = defaultState(null); let stats = defaultStats();\n" +
    extract(appSrc, "function save()", "function shuffleArray") +
    extract(appSrc, "function loadUnit", "function currentList") +
    "\nreturn { save, loadUnit, STORAGE_PREFIX," +
    " get state() { return state; }, get stats() { return stats; } };");
  return { app: factory(ls, () => null), store };
}
// 実行中の app（メモリ上の state/stats）に1回答を記録する（logAnswer 相当＋回答時の clearInterval 後に save）
function answerLive(app, qid, ts, isCorrect, timerId) {
  app.state.timer = timerId;           // startQuestionTimer: state.timer = setInterval(...)
  answer({ state: app.state, stats: app.stats }, qid, ts, isCorrect);
  app.save();                          // clearInterval(state.timer) の後の save()
}

console.log("\n[10] state.timer を永続化しない（Phase 1.5）");
{
  // 10-1 古いデータに数値 timer が残っていても、load 後のメモリでは null
  const { app, store } = makeApp();
  const old = fresh("keiryo");
  old.state.timer = 17;
  store[app.STORAGE_PREFIX + "keiryo"] = J(old);
  app.loadUnit("keiryo");
  check("10-1 古い timer:17 は load 後のメモリで null", app.state.timer === null, app.state.timer);

  // 10-2 / 10-3 実行中の数値 timer は save 後もメモリでは数値のまま、保存コピーだけ null
  app.state.timer = 42;
  app.save();
  const saved = JSON.parse(store[app.STORAGE_PREFIX + "keiryo"]);
  check("10-2 save 後もメモリ上の state.timer は 42 のまま", app.state.timer === 42, app.state.timer);
  check("10-3 localStorage の state.timer は null", saved.state.timer === null, saved.state.timer);
  const mem = C({ state: app.state, stats: app.stats });
  mem.state.timer = null;
  check("10-3 timer 以外は保存内容とメモリが完全一致（キー順含む）", J(saved) === J(mem));
  check("10-3 state のキー順は defaultState と同じ（timer の位置も据え置き）",
    J(Object.keys(saved.state)) === J(Object.keys(defaultState("keiryo"))));
}

console.log("\n[11] 起動 → 複数回答 → push → 次回起動 のシミュレーション（本物の save/loadUnit）");
{
  // 端末1台で3日間。毎日: loadUnit → 起動 syncAll（localStorage を直接読む）→ 5問回答（毎回 save→pushDirty）
  const { app, store } = makeApp();
  const key = app.STORAGE_PREFIX + "keiryo";
  let remote = null, tid = 100;
  const days = [];
  for (let day = 0; day < 3; day++) {
    app.loadUnit("keiryo");
    const local = store[key] ? JSON.parse(store[key]) : null;
    if (local) {
      const r = startupSync(local, remote);
      days.push(r.changedLocal);
      if (r.changedLocal) store[key] = J(r.merged);   // setItemRaw
      if (r.writeRemote) remote = r.merged;
    }
    for (let i = 0; i < 5; i++) {
      answerLive(app, "k" + ((day * 5 + i) % 7), 1e12 + day * 1e6 + i * 1000, i % 2 === 0, ++tid);
      remote = mergeUnitData(JSON.parse(store[key]), remote);  // pushDirty
    }
  }
  check("2日目・3日目の起動で changedLocal=false（不要リロードなし）", days.length === 2 && days.every((c) => c === false), days);
}

console.log("\n[12] 修正前に数値 timer で保存された既存データからの起動");
{
  // 修正前の app.js で保存されたデータ（timer:17）が localStorage と remote に残っている状態
  const { app, store } = makeApp();
  const key = app.STORAGE_PREFIX + "keiryo";
  const old = fresh("keiryo");
  answer(old, "k1", 1000, true);
  old.state.timer = 17;
  store[key] = J(old);
  const remote = C(old);
  remote.state.timer = null;              // remote は旧版マージ済みなので null
  // 1回目の起動: loadUnit はメモリだけ無害化。syncAll は localStorage を直接読む
  app.loadUnit("keiryo");
  check("12-1 メモリ上は null", app.state.timer === null);
  const r1 = startupSync(JSON.parse(store[key]), remote);
  console.log("  情報 12-2 デプロイ後の初回起動（まだ save 前）: changedLocal=" + r1.changedLocal +
    "（localStorage に残った timer:17 が差分になる）");
  if (r1.changedLocal) store[key] = J(r1.merged);   // syncAll の setItemRaw で null に置き換わる
  // 2回目の起動
  app.loadUnit("keiryo");
  const r2 = startupSync(JSON.parse(store[key]), remote);
  check("12-3 2回目以降の起動では changedLocal=false", r2.changedLocal === false);
  // 初回起動の前に1問でも解いて save されていれば、その単元は初回から差分なし
  const b = makeApp();
  b.store[key] = J(old);
  b.app.loadUnit("keiryo");
  answerLive(b.app, "k2", 2000, true, 55);
  const saved = JSON.parse(b.store[key]);
  check("12-4 save 済みの単元は localStorage も null", saved.state.timer === null);
}

// ---------------------------------------------------------------
// [13] 以降は ④-2「卒業した問題が同期で戻る」の回帰テスト。
// app.js の本物の addReviewTarget / markReviewResult / dueReviewList / startExam を、時計をモックして動かす。
let NOW = Date.UTC(2026, 8, 1);
const DAY = 864e5;
function makeReviewApp() {
  return new Function("UNIT_META", "el", "show", "save",
    extract(appSrc, "function defaultState", "let state = defaultState(null);") +
    "\nlet state = defaultState('keiryo'); let stats = defaultStats();\n" +
    // app.js のモジュール変数（切り出した関数が参照する。null なら通常試験の誤答記録は行わない）
    "let examWrongIds = null;\n" +
    extract(appSrc, "function addReviewTarget", "function addHistory") +
    extract(appSrc, "function startExam", "function resumeExam") +
    "\nreturn { addReviewTarget, markReviewResult, dueReviewList, startExam," +
    " get data() { return { state, stats }; }, set data(d) { state = d.state; stats = d.stats; } };"
  )({ keiryo: {} }, () => null, () => {}, () => {});
}
function withClock(fn) {
  const real = Date.now;
  Date.now = () => NOW;
  try { return fn(); } finally { Date.now = real; }
}
const Q = (id) => ({ id, stage: "第1問", weakness: "計算精度", a: ["a", "b"], correct: 0 });
let seq = 0;
// app.js answer() の復習まわりと同じ順序：ログ → 誤答なら addReviewTarget → 復習モードなら markReviewResult
function reviewAnswer(app, id, ok, mode) {
  withClock(() => {
    const d = app.data;
    d.state.answerLog.push({ questionId: id, timestamp: NOW + (++seq), outcome: "answered",
      selectedIndex: ok ? 0 : 1, selectedText: ok ? "a" : "b", isCorrect: ok });
    if (!ok) app.addReviewTarget(Q(id));
    if (mode === "review" || mode === "dueReview") app.markReviewResult(Q(id), ok);
  });
}
// 誤答 → 復習で3回正解（streak 3、卒業の1歩手前）まで進めた app を返す
function nearGraduation(id) {
  const app = makeReviewApp();
  reviewAnswer(app, id, false, "normal");
  for (let i = 0; i < 3; i++) { reviewAnswer(app, id, true, "dueReview"); NOW += 31 * DAY; }
  return app;
}
const ids = (list) => (list || []).map((q) => q.id);
const due = (app) => withClock(() => app.dueReviewList().map((q) => q.id));

console.log("\n[13] ④-2 端末1台：local=卒業済み / remote=卒業前（streak 3）");
{
  const app = nearGraduation("k1");
  const remote = C(app.data);
  reviewAnswer(app, "k1", true, "dueReview"); // 4回目で卒業
  const local = C(app.data);
  check("13-0 前提: local は wrong/reviewMeta に k1 なし、graduatedAt あり、clearedCount=1",
    !ids(local.state.wrong).includes("k1") && !local.state.reviewMeta.k1 &&
    typeof local.state.graduatedAt.k1 === "number" && local.stats.clearedCount === 1);
  check("13-0 前提: remote は wrong に k1、reviewMeta.k1.streak=3",
    ids(remote.state.wrong).includes("k1") && remote.state.reviewMeta.k1.streak === 3);
  const m = mergeUnitData(local, remote);
  check("13-1 wrong へ戻らない", !ids(m.state.wrong).includes("k1"), ids(m.state.wrong));
  check("13-2 reviewMeta へ戻らない", !m.state.reviewMeta.k1, m.state.reviewMeta);
  check("13-3 graduatedAt が残る", m.state.graduatedAt.k1 === local.state.graduatedAt.k1);
  check("13-4 tipList は従来どおり残る（卒業では消さない仕様）", ids(m.state.tipList).includes("k1"));
  check("13-5 clearedCount は 1 のまま", m.stats.clearedCount === 1);

  console.log("\n[14] ④-2 マージ順序・冪等性");
  const m2 = mergeUnitData(remote, local);
  check("14-1 merge(local,remote) と merge(remote,local) が意味上一致", same(m.state, m2.state) && same(m.stats, m2.stats));
  check("14-2 merge(m, m) === m", J(mergeUnitData(m, C(m))) === J(m));
  check("14-3 merge(m, remote) === m（古い remote を何度マージしても同じ）", J(mergeUnitData(m, remote)) === J(m));
  check("14-4 merge(m, local) === m", J(mergeUnitData(m, local)) === J(m));

  // graduatedAt そのものの merge：IDごとに新しい方、順序非依存
  const a = C(local), b = C(local);
  a.state.graduatedAt = { k1: 100, k2: 300 };
  b.state.graduatedAt = { k1: 200, k3: 50 };
  const g1 = mergeUnitData(a, b).state.graduatedAt, g2 = mergeUnitData(b, a).state.graduatedAt;
  check("14-5 graduatedAt は IDごとに新しい時刻を採用", same(g1, { k1: 200, k2: 300, k3: 50 }), g1);
  check("14-6 graduatedAt は引数順に依存しない", same(g1, g2));
}

console.log("\n[15] ④-2 境界条件：活動時刻 <= 卒業時刻 は卒業側を優先");
{
  const base = fresh("keiryo");
  answer(base, "k9", 1, true); // freshness 用
  const mk = (meta, gradAt) => {
    const d = C(base);
    if (meta) { d.state.reviewMeta.k1 = meta; d.state.wrong = [Q("k1")]; }
    if (gradAt !== undefined) d.state.graduatedAt = { k1: gradAt };
    return d;
  };
  const g = mk(null, 1000);
  const eq = mergeUnitData(g, mk({ streak: 3, dueAt: 9e12, lastSeenAt: 1000 }));
  check("15-1 lastSeenAt == 卒業時刻 → 捨てる（dueAt が未来でも lastSeenAt を優先）",
    !eq.state.reviewMeta.k1 && !ids(eq.state.wrong).includes("k1"));
  const after = mergeUnitData(g, mk({ streak: 0, dueAt: 900, lastSeenAt: 1001 }));
  check("15-2 lastSeenAt が卒業時刻より 1ms 後 → 残す", !!after.state.reviewMeta.k1 && ids(after.state.wrong).includes("k1"));
  const noSeenOld = mergeUnitData(g, mk({ streak: 0, dueAt: 1000, lastSeenAt: null }));
  check("15-3 lastSeenAt 無し → dueAt で判定（== なら捨てる）", !noSeenOld.state.reviewMeta.k1);
  const noSeenNew = mergeUnitData(g, mk({ streak: 0, dueAt: 1001, lastSeenAt: null }));
  check("15-4 lastSeenAt 無し・dueAt が卒業より後 → 残す", !!noSeenNew.state.reviewMeta.k1);
}

console.log("\n[16] ④-2 端末2台：A は卒業済み、B は卒業前の古い state のまま");
{
  const A = nearGraduation("k1");
  let remote = C(A.data);
  const B = makeReviewApp();
  B.data = C(remote);                                  // B は卒業前の state を持っている
  reviewAnswer(A, "k1", true, "dueReview");            // A で卒業
  remote = mergeUnitData(C(A.data), remote);           // A の push
  reviewAnswer(B, "k2", false, "normal");              // B は別の問題を解いて freshness が新しくなる
  remote = mergeUnitData(C(B.data), remote);           // B の push（B は newer 側で wrong に k1 を持つ）
  check("16-1 B の古い state を push しても k1 は wrong に戻らない", !ids(remote.state.wrong).includes("k1"), ids(remote.state.wrong));
  check("16-2 reviewMeta.k1 も戻らない", !remote.state.reviewMeta.k1);
  check("16-3 B で新しく間違えた k2 はちゃんと残る", ids(remote.state.wrong).includes("k2") && !!remote.state.reviewMeta.k2);
  const bootB = mergeUnitData(C(B.data), remote);      // B の次回起動
  check("16-4 B の次回起動でも k1 は復習対象に戻らない", !ids(bootB.state.wrong).includes("k1"));
}

console.log("\n[17] ④-2 卒業 → push → 次回起動 のループが止まる／clearedCount が増え続けない");
{
  const app = nearGraduation("k1");
  let remote = C(app.data);
  const push = () => { remote = mergeUnitData(C(app.data), remote); };
  const boot = () => { const m = mergeUnitData(C(app.data), remote); app.data = C(m); if (J(m) !== J(remote)) remote = m; };
  reviewAnswer(app, "k1", true, "dueReview");          // 卒業
  push();
  check("17-1 push 後の remote に k1 が戻らない", !ids(remote.state.wrong).includes("k1") && !remote.state.reviewMeta.k1);
  const counts = [];
  for (let day = 0; day < 5; day++) {
    NOW += DAY;
    boot();
    counts.push(app.data.stats.clearedCount);
    if (due(app).includes("k1")) reviewAnswer(app, "k1", true, "dueReview"); // 戻っていたら再卒業される
    push();
  }
  check("17-2 5日間 起動・同期を繰り返しても k1 は due に出ない", !due(app).includes("k1"));
  check("17-3 clearedCount は 1 のまま増えない", counts.every((c) => c === 1), counts);
}

console.log("\n[18] ④-2 graduatedAt が無い既存データ");
{
  const legacy = fresh("keiryo");
  delete legacy.state.graduatedAt;
  answer(legacy, "k1", 1000, false);
  legacy.state.wrong = [Q("k1")];
  legacy.state.reviewMeta.k1 = { streak: 1, dueAt: 5000, lastSeenAt: 1000 };
  const { app, store } = makeApp();
  store[app.STORAGE_PREFIX + "keiryo"] = J(legacy);
  app.loadUnit("keiryo");
  check("18-1 loadUnit で graduatedAt は {} になる", same(app.state.graduatedAt, {}));
  check("18-2 wrong/reviewMeta は従来どおり読み込まれる", ids(app.state.wrong).includes("k1") && app.state.reviewMeta.k1.streak === 1);
  const m = mergeUnitData(legacy, C(legacy));
  check("18-3 両側に graduatedAt が無ければ merge 結果にもキーを作らない", !("graduatedAt" in m.state));
  check("18-4 legacy 同士の merge は入力と完全一致", J(m) === J(legacy));
  // 新しい端末（graduatedAt あり）と legacy remote の merge
  const newer = C(legacy); newer.state.graduatedAt = {};
  answer(newer, "k2", 2000, true);
  const m2 = mergeUnitData(newer, legacy);
  check("18-5 片側だけ graduatedAt:{} でも wrong/reviewMeta は従来どおり", ids(m2.state.wrong).includes("k1") && !!m2.state.reviewMeta.k1);
}

console.log("\n[19] ④-2 卒業していない問題の merge は変わらない");
{
  const a = makeReviewApp(), b = makeReviewApp();
  reviewAnswer(a, "k1", false, "normal"); reviewAnswer(a, "k1", true, "dueReview");
  NOW += DAY;
  reviewAnswer(b, "k2", false, "normal"); reviewAnswer(b, "k1", false, "normal");
  // 未卒業のみ（graduatedAt は両側 {}）
  const m = mergeUnitData(C(a.data), C(b.data));
  check("19-1 wrong は k1,k2 の和集合", same(ids(m.state.wrong).sort(), ["k1", "k2"]), ids(m.state.wrong));
  check("19-2 reviewMeta は IDごとの LWW（k1 は b の新しい誤答側）",
    m.state.reviewMeta.k1.lastSeenAt === null && m.state.reviewMeta.k1.dueAt === b.data.state.reviewMeta.k1.dueAt);
  check("19-3 answerLog は和集合", m.state.answerLog.length === 4);
  // 卒業済みの k9 が混ざっていても、未卒業の k1,k2 の結果は同じ
  const a2 = C(a.data), b2 = C(b.data);
  a2.state.graduatedAt = { k9: NOW };
  const m2 = mergeUnitData(a2, b2);
  check("19-4 他の問題の graduatedAt は未卒業問題の wrong/reviewMeta/tipList/stats に影響しない",
    same(m2.state.wrong, m.state.wrong) && same(m2.state.reviewMeta, m.state.reviewMeta) &&
    same(m2.state.tipList, m.state.tipList) && same(m2.stats, m.stats));
}

console.log("\n[20] ④-2 卒業より後の新しい活動がある場合（既存挙動の維持）");
{
  // 同じ端末で卒業 → 通常モードでまた誤答：addReviewTarget が新しい reviewMeta を作る（今の仕様）
  const app = nearGraduation("k1");
  const remote = C(app.data);                          // 卒業前の remote
  reviewAnswer(app, "k1", true, "dueReview");          // 卒業
  NOW += DAY;
  reviewAnswer(app, "k1", false, "normal");            // 卒業後に通常モードで誤答
  const local = C(app.data);
  check("20-0 前提: local で k1 は wrong に戻り、reviewMeta は streak 0 で作り直されている",
    ids(local.state.wrong).includes("k1") && local.state.reviewMeta.k1.streak === 0);
  const m = mergeUnitData(local, remote), m2 = mergeUnitData(remote, local);
  check("20-1 merge 後も k1 は wrong に残る（sync なしの時と同じ）", ids(m.state.wrong).includes("k1"));
  check("20-2 reviewMeta は新しい方（streak 0）", m.state.reviewMeta.k1 && m.state.reviewMeta.k1.streak === 0);
  check("20-3 順序非依存", same(m.state, m2.state));
  // 卒業後、復習モードで再度出題されて誤答（lastSeenAt が更新される）
  const app2 = nearGraduation("k3");
  reviewAnswer(app2, "k3", true, "dueReview");
  NOW += DAY;
  withClock(() => { app2.addReviewTarget(Q("k3")); });   // 何らかの経路で再追加
  reviewAnswer(app2, "k3", false, "review");
  const m3 = mergeUnitData(C(app2.data), C(app2.data));
  check("20-4 卒業後に lastSeenAt が更新された reviewMeta は残る", !!m3.state.reviewMeta.k3 && ids(m3.state.wrong).includes("k3"));
}

console.log("\n[21] startExam() の wrong/tipList 消去は従来どおり（graduatedAt で挙動を変えない）");
{
  // 未卒業の k2 が remote にあり、local で startExam → 次回起動の merge で従来どおり戻る
  const app = makeReviewApp();
  reviewAnswer(app, "k2", false, "normal");
  const remote = C(app.data);
  withClock(() => app.startExam());
  reviewAnswer(app, "k5", true, "normal");
  const m = mergeUnitData(C(app.data), remote);
  check("21-1 未卒業の k2 は従来どおり wrong/tipList に戻る", ids(m.state.wrong).includes("k2") && ids(m.state.tipList).includes("k2"));
  // 卒業済みの k1 の tipList（卒業では消えない）を startExam で消した場合。
  // tipList は従来どおり「和集合の reviewMeta に k1 があるか」で戻すかが決まる：
  //  (a) remote が卒業前（reviewMeta.k1 あり）→ 従来どおり戻る
  //  (b) remote も卒業後（どちらの reviewMeta にも k1 なし）→ 従来どおり戻らない
  const g = nearGraduation("k1");
  const remotePre = C(g.data);
  reviewAnswer(g, "k1", true, "dueReview");
  const remotePost = C(g.data);
  withClock(() => g.startExam());
  reviewAnswer(g, "k5", true, "normal");
  const mPre = mergeUnitData(C(g.data), remotePre);
  const mPost = mergeUnitData(C(g.data), remotePost);
  check("21-2 (a) remote が卒業前: tipList の k1 は従来どおり戻る", ids(mPre.state.tipList).includes("k1"));
  check("21-2 (a) remote が卒業前: wrong の k1 は戻らない（④-2 の修正）", !ids(mPre.state.wrong).includes("k1"));
  check("21-3 (b) remote も卒業後: tipList の k1 は従来どおり戻らない", !ids(mPost.state.tipList).includes("k1"));
  check("21-4 startExam は graduatedAt に触れない", typeof g.data.state.graduatedAt.k1 === "number");
}

// ---------------------------------------------------------------
// [22] 以降：卒業を知らない古い端末Bで、卒業後に addReviewTarget 相当の回答をした場合。
// 単一端末で「卒業 → その回答」を行った結果と、B 経由の merge 結果が一致することを確認する。
// app.js の各ハンドラと同じ順序（ログ → addReviewTarget → 復習モードなら markReviewResult）で再現する。
function evLog(app, id, outcome, ok) {
  app.data.state.answerLog.push({ questionId: id, timestamp: Date.now(), outcome,
    selectedIndex: ok ? 0 : null, selectedText: ok ? "a" : null, isCorrect: ok });
}
const EV = {
  wrong:   (app, mode) => { evLog(app, "k1", "answered", false); app.addReviewTarget(Q("k1")); if (mode === "review" || mode === "dueReview") app.markReviewResult(Q("k1"), false); },   // answer() / submitFillin() の誤答
  correct: (app, mode) => { evLog(app, "k1", "answered", true); if (mode === "review" || mode === "dueReview") app.markReviewResult(Q("k1"), true); },                                  // 正解
  timeout: (app, mode) => { evLog(app, "k1", "timeout", false); app.addReviewTarget(Q("k1")); if (mode === "review" || mode === "dueReview") app.markReviewResult(Q("k1"), false); },   // timeoutQuestion()
  timeoutCorrect: (app, mode) => { evLog(app, "k1", "timeout", true); app.addReviewTarget(Q("k1")); if (mode === "review" || mode === "dueReview") app.markReviewResult(Q("k1"), true); }, // timeoutFillin() で全問正解
  skip:    (app, mode) => { evLog(app, "k1", "skip", false); app.addReviewTarget(Q("k1")); if (mode === "review" || mode === "dueReview") app.markReviewResult(Q("k1"), false); },      // skipQuestion() / skipFillin()
  skipKnown: () => {}                                                                                                                                                               // skipKnownQuestion(): ログも addReviewTarget も無し
};
function runEv(app, list) {
  list.forEach((e) => { const [kind, mode] = e.split("@"); NOW += 1000; withClock(() => EV[kind](app, mode || "normal")); });
}
// 端末A: 誤答 → 復習3回正解（streak 3）→ 端末B にコピー → A で4回目に卒業
function twoDevices() {
  NOW = Date.UTC(2026, 9, 1);
  const A = makeReviewApp();
  withClock(() => EV.wrong(A, "normal"));
  for (let i = 0; i < 3; i++) { NOW += 31 * DAY; withClock(() => EV.correct(A, "dueReview")); }
  NOW += 31 * DAY;
  const B = makeReviewApp();
  B.data = C(A.data);
  NOW += 1;
  withClock(() => EV.correct(A, "dueReview"));
  return { A, B, T1: A.data.state.graduatedAt.k1 };
}
const k1View = (d) => ({
  inWrong: ids(d.state.wrong).includes("k1"),
  meta: d.state.reviewMeta.k1 ? { streak: d.state.reviewMeta.k1.streak, dueAt: d.state.reviewMeta.k1.dueAt, lastSeenAt: d.state.reviewMeta.k1.lastSeenAt } : null
});
// 同じイベント列を「単一端末（A で卒業後）」と「古い端末B」でそれぞれ行い、結果を比べる
function compareWithSingle(list) {
  const s = twoDevices();
  const single = makeReviewApp();
  single.data = C(s.A.data);
  NOW += DAY;
  runEv(single, list);
  const d = twoDevices();
  NOW += DAY;
  runEv(d.B, list);
  const m1 = mergeUnitData(C(d.B.data), C(d.A.data));
  const m2 = mergeUnitData(C(d.A.data), C(d.B.data));
  return { ref: k1View(single.data), m1, m2, v1: k1View(m1), v2: k1View(m2), A: d.A, B: d.B };
}

console.log("\n[22] 卒業後の古い端末Bでの回答：単一端末の時系列と一致する");
{
  const cases = [
    ["22-1 卒業後の通常誤答 → 戻る", ["wrong"], true],
    ["22-2 誤答→正解 → 戻る", ["wrong", "correct"], true],
    ["22-3 正解→誤答 → 戻る", ["correct", "wrong"], true],
    ["22-4 誤答を複数回 → 戻る", ["wrong", "wrong", "wrong"], true],
    ["22-5 timeout → 戻る", ["timeout"], true],
    ["22-6 timeout かつ isCorrect:true → 戻る", ["timeoutCorrect"], true],
    ["22-7 skip → 戻る", ["skip"], true],
    ["22-8 TIPSモードでの誤答 → 戻る", ["wrong@tips"], true],
    ["22-9 正解のみ → 戻らない", ["correct", "correct"], false],
    ["22-10 前回正解済みスキップ → 戻らない", ["skipKnown"], false]
  ];
  cases.forEach(([name, list, expectBack]) => {
    const r = compareWithSingle(list);
    check(name + "（単一端末でも " + (expectBack ? "戻る" : "戻らない") + "）", r.ref.inWrong === expectBack, r.ref);
    check(name + "：B 経由の merge が単一端末と一致", same(r.v1, r.ref), { merge: r.v1, single: r.ref });
    check(name + "：引数順を逆にしても一致", same(r.v2, r.v1) && same(r.m1.state.graduatedAt, r.m2.state.graduatedAt));
    check(name + "：冪等", J(mergeUnitData(C(r.m1), C(r.m1))) === J(r.m1) &&
      J(mergeUnitData(C(r.m1), C(r.B.data))) === J(r.m1) && J(mergeUnitData(C(r.m1), C(r.A.data))) === J(r.m1));
  });
  // 22-4 補足：再構築される reviewMeta は「卒業後で最初の対象ログ」の時刻・streak 0
  const r = compareWithSingle(["wrong", "wrong", "wrong"]);
  const firstReAdd = r.B.data.state.answerLog.filter((x) => x.timestamp > r.A.data.state.graduatedAt.k1 && x.isCorrect === false)[0];
  check("22-4b 誤答が複数でも dueAt は最初の対象ログの時刻・streak 0・lastSeenAt null",
    same(r.v1.meta, { streak: 0, dueAt: firstReAdd.timestamp, lastSeenAt: null }), r.v1.meta);
}

console.log("\n[23] 境界条件");
{
  // 卒業と同じ時刻の対象ログは卒業側を優先
  const d = twoDevices();
  withClock(() => EV.wrong(d.B, "normal"));        // NOW は卒業と同じ ms のまま
  check("23-0 前提: B の誤答ログは卒業と同時刻", d.B.data.state.answerLog.slice(-1)[0].timestamp === d.T1);
  const m = mergeUnitData(C(d.B.data), C(d.A.data));
  check("23-1 卒業と同一 timestamp の誤答 → 戻らない", !k1View(m).inWrong && !k1View(m).meta);

  // 卒業後に B で誤答 → その後 A 側でもう一度卒業（誤答より後）→ 最後の卒業を優先して戻らない
  const e = twoDevices();
  NOW += DAY; withClock(() => EV.wrong(e.B, "normal"));
  NOW += DAY; withClock(() => EV.wrong(e.A, "normal"));                // A でも卒業後に誤答 → 同じ端末なので新しい meta
  for (let i = 0; i < 4; i++) { NOW += 31 * DAY; withClock(() => EV.correct(e.A, "dueReview")); }
  check("23-2 前提: A で再卒業して graduatedAt が更新された", e.A.data.state.graduatedAt.k1 > e.T1);
  const m2 = mergeUnitData(C(e.B.data), C(e.A.data)), m3 = mergeUnitData(C(e.A.data), C(e.B.data));
  check("23-3 対象ログの後にもう一度卒業 → 戻らない", !k1View(m2).inWrong && !k1View(m2).meta && same(k1View(m2), k1View(m3)));
}

console.log("\n[24] 卒業と無関係な問題・tipList は変わらない");
{
  // B で k1（卒業後の誤答）と k2（普通の誤答）
  const d = twoDevices();
  NOW += DAY; withClock(() => EV.wrong(d.B, "normal"));
  NOW += 1000; withClock(() => { evLog(d.B, "k2", "answered", false); d.B.addReviewTarget(Q("k2")); });
  const m = mergeUnitData(C(d.B.data), C(d.A.data));
  const noK1 = (x) => { const y = C(x); y.state.wrong = y.state.wrong.filter((q) => q.id !== "k1"); delete y.state.reviewMeta.k1; return y; };
  // 同じ状況で k1 に卒業後の対象ログが無い版と比べ、k1 以外は完全一致
  const d2 = twoDevices();
  NOW += DAY + 1000; withClock(() => { evLog(d2.B, "k2", "answered", false); d2.B.addReviewTarget(Q("k2")); });
  d2.B.data.state.answerLog.slice(-1)[0].timestamp = d.B.data.state.answerLog.slice(-1)[0].timestamp;
  d2.B.data.state.reviewMeta.k2 = C(d.B.data.state.reviewMeta.k2);
  const mNo = mergeUnitData(C(d2.B.data), C(d2.A.data));
  check("24-1 k2 の wrong/reviewMeta は k1 の救済と無関係", same(m.state.reviewMeta.k2, mNo.state.reviewMeta.k2) && ids(m.state.wrong).includes("k2"));
  check("24-2 stats は変わらない", same(m.stats, mNo.stats));
  check("24-3 tipList は救済の有無に関係なく同じ（和集合 reviewMeta で判定のまま）", same(ids(m.state.tipList), ids(mNo.state.tipList)));
  check("24-4 救済された k1 以外の reviewMeta は一致", same(noK1(m).state.reviewMeta, noK1(mNo).state.reviewMeta));
}

console.log("\n結果: " + pass + " OK / " + fail + " NG");
process.exit(fail ? 1 : 0);
