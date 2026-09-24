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

  // (参考) questionHistory とは無関係な既存のリロード要因: state.timer
  const l4 = C(l2);
  l4.state.timer = 17; // app.js は clearInterval 後も state.timer に ID を残したまま save する
  const r4 = startupSync(l4, rem);
  console.log("  参考 state.timer が数値で保存されていると changedLocal=" + r4.changedLocal +
    "（今回の対象外。timer:null への正規化による既存の差分）");
}

console.log("\n結果: " + pass + " OK / " + fail + " NG");
process.exit(fail ? 1 : 0);
