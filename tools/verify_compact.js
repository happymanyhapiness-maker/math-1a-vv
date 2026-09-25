// -*- coding: utf-8 -*-
// verify_compact.js
// Phase 7B-2: 生ログ（answerLog）の削減の回帰テスト（log-archive.js の compactUnitData）。
//  ・保持ルール：timestamp 降順 → event ID 降順で上から300件以内、かつ集合内の最新 timestamp から180日以内
//    （ちょうど180日前は残す、1ms でも古ければ archive）
//  ・移す生ログ：questionHistory の補完（Phase 1 のルール）・rescueLog への回収・archive への追加
//  ・merge / save が同じ変換、冪等・交換則、stale 端末、Phase 2 の反例、再卒業、初回移行、resetGen
//  ・保存失敗時は Phase 7A-1 の挙動のまま（メモリの生ログは減らさない）
//  ・集計（calendar / progress / unit-strength / crossunit / 復習モード正答率 / buildSummary / dailyquest 過去分）は削減前と同じ
//  ・AI分析は削減後の生ログ（最大300件）だけ
//
//   node tools/verify_compact.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..");
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));
const LA = require(path.join(DIR, "log-archive.js"));
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8").replace(/\r\n/g, "\n");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail).slice(0, 500) : "")); }
}
async function section(title, fn) {
  console.log("\n" + title);
  try { await fn(); } catch (e) { check("例外なく実行できる", false, String(e && e.stack || e).split("\n").slice(0, 3).join(" ")); }
}
function slice(src, start, end) {
  const s = src.indexOf(start);
  const e = src.indexOf(end, s + start.length);
  if (s < 0 || e < 0) throw new Error("抽出失敗: " + start);
  return src.slice(s, e);
}
const compact = LA.compactUnitData;
if (typeof compact !== "function") { console.log("compactUnitData がありません"); }
const mergeNew = new Function("globalThis", slice(read("firebase-sync.js"), "function freshness",
  "/* =========================================================\n   Firestore 入出力") + "\nreturn mergeUnitData;")({ LogArchive: LA });

// ---- テストデータ ----
const DAY = 86400000;
const BASE = Date.UTC(2026, 3, 1, 0, 0, 0);
const QIDS = Array.from({ length: 12 }, (_, i) => "ke-" + i);
function rawLog(i, o) {
  o = o || {};
  const outcome = o.outcome || ["answered", "answered", "answered", "timeout", "skip"][i % 5];
  return {
    questionId: o.questionId || QIDS[i % 12], stage: "第" + (1 + i % 4) + "問", num: 1 + i % 5, weakness: "計算精度", route: [],
    selectedIndex: i % 4, selectedText: "選択肢" + (i % 4), selectedTag: i % 3 ? "correct" : "calc_error",
    correctIndex: 1, correctText: "正解", correctTag: "correct",
    isCorrect: o.isCorrect !== undefined ? o.isCorrect : (outcome === "answered" ? i % 3 !== 0 : false),
    outcome, mode: o.mode || ["normal", "review", "dueReview", "stage"][i % 4],
    timestamp: o.timestamp !== undefined ? o.timestamp : BASE + i * 3600000, elapsedTime: 30
  };
}
const logs = (n, step, from) => Array.from({ length: n }, (_, i) => rawLog(i, { timestamp: (from || BASE) + i * (step || 3600000) }));
function unitData(log, extra, qh) {
  const h = qh !== undefined ? qh : {};
  if (qh === undefined) log.forEach((r) => { h[r.questionId] = { date: r.timestamp, isCorrect: r.isCorrect }; });
  return {
    state: Object.assign({ unit: "keiryo", index: 0, correct: 0, total: 0, wrong: [], mode: "normal", answerLog: log, reviewMeta: {}, history: [] }, extra || {}),
    stats: { weakness: {}, stage: {}, questionHistory: h, clearedCount: 0 }
  };
}
const countArc = (arc) => Object.values(arc || {}).reduce((s, v) => s + v.length / 18, 0);
const eventSet = (d) => {
  const s = new Set();
  Object.entries(d.state.logArchive || {}).forEach(([k, v]) => { for (let i = 0; i < v.length; i += 18) s.add(k + v.slice(i, i + 17)); });
  (d.state.answerLog || []).forEach((r) => { const id = LA.eventId(r); if (id) s.add(LA.jstDayKey(r.timestamp) + id); });
  return s;
};
const totals = (d) => { const l = LA.countableLog(d.state); return { n: l.length, c: l.filter((r) => r.isCorrect).length, rv: l.filter((r) => r.mode === "review" || r.mode === "dueReview").length,
  rvc: l.filter((r) => (r.mode === "review" || r.mode === "dueReview") && r.isCorrect).length, last: Math.max(0, ...l.map((r) => r.timestamp || 0)) }; };

// ---- ページごとの集計（verify_log_archive.js と同じ取り出し方） ----
function fakeLS(store) {
  return { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
}
const UNIT_META_MINI = { keiryo: { label: "keiryo", questions: QIDS.map((id) => ({ id })) } };
function pageTotals(store, now) {
  const mk = (f, start, end, ret) => new Function("localStorage", "window", "UNIT_META", "LogArchive", slice(read(f), start, end) + "\nreturn " + ret + ";")(fakeLS(store), { LogArchive: LA }, UNIT_META_MINI, LA);
  const calendar = mk("calendar.js", '"use strict";', "var dayMap = buildDayMap();", "buildDayMap()");
  const progress = mk("progress.js", '"use strict";', "/* ---------- 日付表示", "collectUnitProgress()").find((x) => x.unit === "keiryo");
  const strength = mk("unit-strength.js", '"use strict";', "/* ---------- 描画", "collectUnitAccuracy()");
  const ctx = { console, localStorage: fakeLS(store), UNIT_META: UNIT_META_MINI, TAG_LABELS: {}, LogArchive: LA, document: { readyState: "loading", addEventListener() {}, getElementById: () => null } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("crossunit.js"), ctx);
  const rep = vm.runInContext("buildCrossUnitReport()", ctx).split("\n").filter((l) => !l.startsWith("出力日時"));
  const summaryPart = rep.slice(0, rep.findIndex((l) => l.startsWith("【ミスの傾向"))).join("\n");
  const sync = read("firebase-sync.js");
  let written = null;
  const f = new Function("localStorage", "UNIT_META", "PREFIX", "globalThis", "currentUser", "isGuardian", "targetUid", "getDoc", "setDoc", "doc", "db", "serverTimestamp", "Date",
    slice(sync, "function unitKeys", "/* データの「新しさ」") + slice(sync, "function todayKeyJST", "/* =========================================================\n   plannerの「今日のクエスト」") +
    slice(sync, "async function backfillDailyQuestLogs", "\n  } catch (e) {") + "\n  } catch (e) { throw e; }\n}\nreturn { buildSummary, backfillDailyQuestLogs };")(
    fakeLS(store), UNIT_META_MINI, "kyotsu_app_v14_", { LogArchive: LA }, { uid: "x" }, () => false, () => "x",
    async () => ({ exists: () => true, data: () => ({ data: J({ days: {}, appStartDate: "2020-01-01" }) }) }), async (_d, v) => { written = JSON.parse(v.data); }, () => ({}), {}, () => 0,
    class extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } });
  const summary = f.buildSummary();
  return f.backfillDailyQuestLogs().then(() => {
    const perDay = {};
    Object.keys((written && written.days) || {}).forEach((k) => { const q = written.days[k].quests.find((x) => x.autoSource === "kyotsu-math"); perDay[k] = q && q.label; });
    // progress の answeredCount は questionHistory＋生ログの問題ID（補完で同じになることを確認する）
    return { calendar, progress, strength, summaryPart, summary, perDay };
  });
}

// ---- app.js を vm で動かす（save の経路・保存失敗・AI分析） ----
function launchApp(store, opts) {
  const els = {};
  const mkEl = () => new Proxy({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    { get: (o, p) => (p in o ? o[p] : () => undefined), set: (o, p, v) => { o[p] = v; return true; } });
  const alerts = [];
  const ls = fakeLS(store);
  const flags = { fail: false };
  const origSet = ls.setItem;
  ls.setItem = (k, v) => { if (flags.fail && k.startsWith("kyotsu_app_v14_")) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } origSet(k, v); };
  const ctx = { console: { log() {}, error() {}, warn() {} }, alert: (m) => alerts.push(m), confirm: () => true, scrollTo() {}, setTimeout, clearTimeout, setInterval, clearInterval,
    getComputedStyle: (e) => e.style, localStorage: ls,
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {}, body: mkEl(), readyState: "loading" } };
  ctx.window = ctx;
  vm.createContext(ctx);
  read("index.html").match(/questions_[a-z_0-9]+\.js/g).forEach((f) => vm.runInContext(read(f), ctx));
  vm.runInContext(read("log-archive.js"), ctx);
  vm.runInContext(read("app.js"), ctx);
  return { ctx, els, alerts, flags, store, run: (c) => vm.runInContext(c, ctx) };
}

(async () => {
  await section("[1] 300件の境界（同じ timestamp が並んでも event ID で順位が決まる）", () => {
    [[299, 299, 0], [300, 300, 0], [301, 300, 1], [500, 300, 200], [1000, 300, 700]].forEach(([n, raw, arc]) => {
      const d = compact(unitData(logs(n, 60000)));
      const kept = d.state.answerLog;
      check("1 " + n + "件 → 生ログ " + raw + " / archive " + arc, kept.length === raw && countArc(d.state.logArchive) === arc &&
        (n <= 300 || kept.every((r) => r.timestamp >= BASE + (n - 300) * 60000)), { raw: kept.length, arc: countArc(d.state.logArchive) });
    });
    const same = Array.from({ length: 320 }, (_, i) => rawLog(i, { timestamp: BASE + DAY, questionId: "ke-" + (i % 12) + "-" + i }));
    const a = compact(unitData(same)), b = compact(unitData(same.slice().reverse())), c = compact(unitData(same.slice(160).concat(same.slice(0, 160))));
    const keptIds = (d) => d.state.answerLog.map((r) => LA.eventId(r)).sort();
    const expected = same.map((r) => LA.eventId(r)).sort().reverse().slice(0, 300).sort();
    check("1-6 同じ timestamp の 320件：event ID の大きい方から 300件が残り、入力順が違っても同じ", J(keptIds(a)) === J(expected) && J(keptIds(b)) === J(expected) && J(keptIds(c)) === J(expected) &&
      J(a.state.logArchive) === J(b.state.logArchive));
  });

  await section("[2] 180日の境界（基準は集合内の最新 timestamp、ちょうど180日前は残す）", () => {
    const T = BASE + 400 * DAY;
    const mk = (ts, i) => rawLog(i, { timestamp: ts });
    const d = compact(unitData([mk(T - 180 * DAY - 1, 1), mk(T - 180 * DAY, 2), mk(T - 179 * DAY, 3), mk(T, 4)]));
    const kept = d.state.answerLog.map((r) => r.timestamp);
    check("2-1 最新 T・T−179日・ちょうど T−180日は生ログ、T−180日−1ms は archive",
      J(kept) === J([T - 180 * DAY, T - 179 * DAY, T]) && countArc(d.state.logArchive) === 1, kept);
    const real = Date.now;
    Date.now = () => T + 1000 * DAY; // 端末の時計が進んでいても結果は同じ
    const d2 = compact(unitData([mk(T - 180 * DAY - 1, 1), mk(T - 180 * DAY, 2), mk(T - 179 * DAY, 3), mk(T, 4)]));
    Date.now = real;
    check("2-2 端末の時計（Date.now）に依存しない", J(d2) === J(d));
    // 最新 event が archive 側にあっても基準になる
    const arcNewest = unitData([mk(T - 181 * DAY, 1), mk(T - 100 * DAY, 2)], { logArchive: LA.normalizeArchive({ [LA.jstDayKey(T)]: LA.tokenOf(mk(T, 9)) }) });
    const d3 = compact(arcNewest);
    check("2-3 archive にある最新 event も基準に含める（T−181日は archive、T−100日は生ログ）", J(d3.state.answerLog.map((r) => r.timestamp)) === J([T - 100 * DAY]));
  });

  await section("[3] 件数と日数の組み合わせ", () => {
    const now = BASE + 400 * DAY;
    const a = logs(99, 3600000, now - 50 * DAY).concat([rawLog(500, { timestamp: now - 50 * DAY + 98 * 3600000 - 200 * DAY })]); // 最新から200日前
    const da = compact(unitData(a));
    check("3-A 100件だが200日前が1件 → その1件だけ archive", da.state.answerLog.length === 99 && countArc(da.state.logArchive) === 1);
    const db = compact(unitData(logs(500, 5000000, now - 30 * DAY)));
    check("3-B 500件すべて30日以内 → 最新300件が生ログ、200件が archive", db.state.answerLog.length === 300 && countArc(db.state.logArchive) === 200);
    const dc = compact(unitData(logs(200, 5000000, now - 30 * DAY)));
    check("3-C 200件すべて30日以内 → 全部生ログ（入力と同じオブジェクト）", dc.state.answerLog.length === 200 && !("logArchive" in dc.state));
  });

  await section("[4] 移す生ログ：archive・questionHistory・rescueLog", () => {
    const all = logs(310, 60000);
    const qhEmpty = unitData(all, {}, {}); // questionHistory が欠けている（Phase 1 前の不具合）
    const d = compact(qhEmpty);
    const moved = all.slice(0, 10);
    const expectQh = {};
    moved.forEach((r) => { const e = expectQh[r.questionId]; if (!e || r.timestamp > e.date) expectQh[r.questionId] = { date: r.timestamp, isCorrect: r.isCorrect === true }; });
    // Phase 7C 以降は、移す分だけでなく生ログ全体から補う（各問題の最新の回答）
    const expectAll = {};
    all.forEach((r) => { const e = expectAll[r.questionId]; if (!e || r.timestamp > e.date) expectAll[r.questionId] = { date: r.timestamp, isCorrect: r.isCorrect === true }; });
    check("4-1 questionHistory を生ログ全体から補完（移した10件の問題も含む・新しい方）", J(d.stats.questionHistory) === J(expectAll) && Object.keys(expectQh).every((q) => q in d.stats.questionHistory), d.stats.questionHistory);
    const newer = all[all.length - 1].timestamp + 1;
    const existing = unitData(all, {}, { [all[0].questionId]: { date: newer, isCorrect: true } });
    check("4-2 既存の questionHistory の方が新しければ変えない", J(compact(existing).stats.questionHistory[all[0].questionId]) === J({ date: newer, isCorrect: true }));
    const tie = unitData(all, {}, { [all[3].questionId]: { date: all[3].timestamp, isCorrect: true } }); // all[3] は timeout（誤答扱い）
    check("4-3 同じ時刻なら誤答を優先", compact(tie).stats.questionHistory[all[3].questionId].isCorrect === false);
    const fails = moved.filter(LA.isRescueFailure);
    const exp = {};
    fails.forEach((r) => { exp[r.questionId] = (exp[r.questionId] || "") + LA.rescueTsToken(r.timestamp); });
    check("4-4 移した失敗（誤答・timeout・skip）だけが rescueLog に入る", J(d.state.rescueLog) === J(LA.normalizeRescueLog(exp)) && fails.length > 0 && fails.length < 10, d.state.rescueLog);
    const tOk = rawLog(3, { outcome: "timeout", isCorrect: true, timestamp: BASE - DAY });
    check("4-5 timeout は正誤に関係なく rescueLog に入る（Phase 2 と同じ判定）", LA.isRescueFailure(tOk) && !LA.isRescueFailure(rawLog(1, { outcome: "answered", isCorrect: true })));
    const withGa = compact(unitData(all, { graduatedAt: Object.fromEntries(QIDS.map((q) => [q, BASE + 5 * 60000])) }));
    const left = Object.values(withGa.state.rescueLog || {}).flatMap((s) => [...LA.parseRescueTimes(s)]);
    check("4-6 卒業時刻以前の失敗は rescueLog から刈り込む", left.every((t) => t > BASE + 5 * 60000) && left.length < fails.length);
    check("4-7 archive の event は生ログからそのまま作った token（v1）", J(d.state.logArchive) === J(LA.normalizeArchive(Object.fromEntries(
      Object.entries(moved.reduce((o, r) => { const k = LA.jstDayKey(r.timestamp); o[k] = (o[k] || "") + LA.tokenOf(r); return o; }, {}))))));
    check("4-8 入力を変更しない", J(qhEmpty) === J(unitData(logs(310, 60000), {}, {})));
  });

  await section("[5] 冪等性・交換則（archive・生ログ・rescueLog・questionHistory すべて）", () => {
    const x = compact(unitData(logs(700, 60000)));
    check("5-1 compact(compact(x)) = compact(x)", J(compact(x)) === J(x) && compact(x) === x);
    const A = unitData(logs(400, 60000).filter((_, i) => i % 3 !== 0));
    // 最新の回答時刻が同じだと、既存の merge（Phase 1〜）は引数の先を「新しい側」にする（下の 5-7）。ここでは B の方を新しくする
    const B = unitData(logs(401, 60000).filter((_, i) => i % 2 === 0), { graduatedAt: { "ke-1": BASE + 30 * 60000 } });
    const m1 = mergeNew(C(A), C(B)), m2 = mergeNew(C(B), C(A));
    check("5-2 merge(A,B) = merge(B,A)", J(m1) === J(m2));
    check("5-3 merge 後の save 相当（compact）でも変わらない", J(compact(m1)) === J(m1));
    check("5-4 merge を重ねても同じ", J(mergeNew(C(m1), C(A))) === J(m1) && J(mergeNew(C(m1), C(m1))) === J(m1));
    const cA = compact(A), cB = compact(B);
    check("5-5 先にそれぞれ compact してから merge しても同じ", J(mergeNew(C(cA), C(cB))) === J(m1) && J(mergeNew(C(cB), C(A))) === J(m1));
    const tA = unitData(logs(400, 60000).filter((_, i) => i % 3 !== 0)), tB = unitData(logs(400, 60000).filter((_, i) => i % 2 === 0));
    const t1 = mergeNew(C(tA), C(tB)), t2 = mergeNew(C(tB), C(tA));
    const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    check("5-7 （既存の制約）最新時刻が同点のときは questionHistory のキー順だけが引数順で変わる。生ログ・archive・rescueLog・中身は同じ",
      J(t1.state) === J(t2.state) && J(sortKeys(t1.stats.questionHistory)) === J(sortKeys(t2.stats.questionHistory)));
    check("5-6 生ログは 300件以下、event 数は和集合どおり", m1.state.answerLog.length === 300 && eventSet(m1).size === new Set([...eventSet(A), ...eventSet(B)]).size);
  });

  await section("[6] stale 端末の再流入", () => {
    const all = logs(900, 60000);
    const fresh = compact(unitData(all.slice(100)));                     // 新端末：100〜899 を知っていて削減済み
    const unsynced = [rawLog(5000, { timestamp: BASE + 50 * 60000 + 7, outcome: "skip" }), rawLog(5001, { timestamp: BASE + 70 * 60000 + 3, outcome: "answered", isCorrect: true })];
    const stale = unitData(all.slice(0, 600).concat(unsynced).sort((p, q) => p.timestamp - q.timestamp)); // 古い端末：archive 済みの生ログを大量に＋未同期の2件
    const m1 = mergeNew(C(fresh), C(stale)), m2 = mergeNew(C(stale), C(fresh));
    const truth = new Set([...eventSet(unitData(all)), ...eventSet(unitData(unsynced))]);
    check("6-1 順番に依存しない", J(m1) === J(m2));
    check("6-2 event は重複せず、未同期の2件も含めて和集合（902件）", eventSet(m1).size === truth.size && truth.size === 902 && totals(m1).n === 902);
    check("6-3 archive 済みの event は生ログへ復活しない（生ログ 300件以下・最新の300件）", m1.state.answerLog.length === 300 && m1.state.answerLog.every((r) => r.timestamp >= all[600].timestamp));
    check("6-4 未同期の失敗（skip）は rescueLog に回収される", (m1.state.rescueLog && LA.rescueTimes(m1.state.rescueLog, unsynced[0].questionId).includes(unsynced[0].timestamp)));
    check("6-5 未同期の回答で questionHistory も補完される（その問題の最新がこれなら）", !!m1.stats.questionHistory[unsynced[0].questionId]);
    check("6-6 もう一度 merge・compact しても同じ状態", J(mergeNew(C(m1), C(stale))) === J(m1) && J(compact(m1)) === J(m1));
  });

  await section("[7] Phase 2 の反例：押し出された失敗も rescueLog で救済", () => {
    const X = "ke-7", T1 = BASE + 10 * DAY, T2 = BASE + 12 * DAY;
    const devA = unitData([rawLog(1, { questionId: X, timestamp: T1, isCorrect: true, outcome: "answered" })], { graduatedAt: { [X]: T1 } });
    // 端末B：卒業を知らない。T2 に X を通常モードで誤答 → その後 400件解いて T2 が押し出される
    const later = logs(400, 60000, T2 + 60000).map((r) => Object.assign(r, { questionId: "ke-2" }));
    const bRaw = [rawLog(2, { questionId: X, timestamp: T2, outcome: "answered", isCorrect: false, mode: "normal" })].concat(later);
    const devB = compact(unitData(bRaw, { wrong: [{ id: X }], reviewMeta: { [X]: { streak: 3, dueAt: BASE, lastSeenAt: BASE } } }));
    check("7-1 前提：T2 は生ログから消え、archive と rescueLog にある", !devB.state.answerLog.some((r) => r.timestamp === T2) &&
      LA.rescueTimes(devB.state.rescueLog, X).includes(T2) && totals(devB).n === 401);
    const m = mergeNew(C(devA), C(devB)), mr = mergeNew(C(devB), C(devA));
    check("7-2 A の卒業 T1 と merge → T2 で救済（streak 0 / dueAt T2 / lastSeenAt null）、wrong にも戻る",
      J(m.state.reviewMeta[X]) === J({ streak: 0, dueAt: T2, lastSeenAt: null }) && m.state.wrong.some((w) => w.id === X) && J(m) === J(mr), m.state.reviewMeta[X]);
    // 救済後に復習が進んでも巻き戻らない
    const p = C(m); p.state.reviewMeta[X] = { streak: 1, dueAt: T2 + 5 * DAY, lastSeenAt: T2 + 4 * DAY };
    p.state.answerLog.push(rawLog(3, { questionId: X, timestamp: T2 + 4 * DAY + 999999999, isCorrect: true, outcome: "answered", mode: "dueReview" }));
    const again = mergeNew(C(p), C(devB));
    check("7-3 復習が進んだ reviewMeta は、同じ rescueLog と再 merge しても巻き戻らない", J(again.state.reviewMeta[X]) === J(p.state.reviewMeta[X]));
  });

  await section("[8] 再卒業", () => {
    const X = "ke-7", T1 = BASE + 10 * DAY, T2 = BASE + 12 * DAY, T3 = BASE + 13 * DAY, T4 = BASE + 20 * DAY, T5 = BASE + 25 * DAY;
    const filler = (from) => logs(320, 60000, from).map((r) => Object.assign(r, { questionId: "ke-2" }));
    const withFails = (ts, extra) => compact(unitData([rawLog(1, { questionId: X, timestamp: ts[0], outcome: "timeout" })].concat(ts.slice(1).map((t, i) => rawLog(i + 2, { questionId: X, timestamp: t, outcome: "skip" }))).concat(filler(ts[ts.length - 1] + 1000)), extra));
    const b = withFails([T2, T3], { wrong: [{ id: X }], reviewMeta: { [X]: { streak: 3, dueAt: BASE, lastSeenAt: BASE } } });
    let m = mergeNew(unitData([rawLog(9, { questionId: X, timestamp: T1, isCorrect: true, outcome: "answered" })], { graduatedAt: { [X]: T1 } }), C(b));
    check("8-1 T2・T3 が押し出されて rescueLog に。卒業 T1 のあと dueAt は T2", m.state.reviewMeta[X].dueAt === T2 && J(LA.rescueTimes(m.state.rescueLog, X)) === J([T2, T3]));
    m = C(m); delete m.state.reviewMeta[X]; m.state.wrong = m.state.wrong.filter((w) => w.id !== X); m.state.graduatedAt[X] = T4;
    m.state.answerLog.push(rawLog(10, { questionId: X, timestamp: T4 + 400 * 60000 * 2, isCorrect: true, outcome: "answered", mode: "dueReview" }));
    const g = mergeNew(C(m), C(b));
    check("8-2 再卒業 T4 → T2・T3 は刈り込まれ、救済もされない", LA.rescueTimes(g.state.rescueLog, X).length === 0 && !g.state.reviewMeta[X]);
    // 再卒業を知らない端末B：reviewMeta は前回の救済時（dueAt T2）のまま、T5 に通常モードで失敗（addReviewTarget は既存の reviewMeta を更新しない）
    const b5 = withFails([T5], { wrong: [{ id: X }], reviewMeta: { [X]: { streak: 0, dueAt: T2, lastSeenAt: null } } });
    const g5 = mergeNew(C(g), C(b5));
    check("8-3 その後 T5 の失敗が押し出される → rescueLog は T5 だけ、dueAt は T5", J(LA.rescueTimes(g5.state.rescueLog, X)) === J([T5]) && g5.state.reviewMeta[X] && g5.state.reviewMeta[X].dueAt === T5);
  });

  await section("[9] 初回移行（archive の無い今の本番データ）", () => {
    const d0 = unitData(logs(1200, 45 * 60000));
    const d1 = compact(d0);
    check("9-1 保持条件を超えた生ログが archive へ（生ログ 300 / archive 900）・rescueLog も作る", d1.state.answerLog.length === 300 && countArc(d1.state.logArchive) === 900 && !!d1.state.rescueLog);
    check("9-2 もう一度実行しても変化しない（同じオブジェクト）", compact(d1) === d1);
    check("9-3 回答数・正解数・復習の数・最終日時は移行前と同じ", J(totals(d1)) === J(totals(d0)));
    const m = mergeNew(C(d0), null);
    check("9-4 片側だけの merge（ログイン直後の初回同期など）でも同じ結果", J(m.state.answerLog) === J(d1.state.answerLog) && J(m.state.logArchive) === J(d1.state.logArchive) && J(m.state.rescueLog) === J(d1.state.rescueLog));
  });

  await section("[10] resetGen", () => {
    const old = compact(unitData(logs(600, 60000), { graduatedAt: { "ke-1": BASE } }, {}));
    const fresh = unitData([rawLog(1, { timestamp: BASE + 700 * 60000 })], { resetGen: 1 });
    const m1 = mergeNew(C(old), C(fresh)), m2 = mergeNew(C(fresh), C(old));
    check("10-1 新しい世代だけ：古い世代の生ログ・archive・rescueLog・補完した questionHistory は戻らない",
      J(m1) === J(m2) && m1.state.answerLog.length === 1 && !("logArchive" in m1.state) && !("rescueLog" in m1.state) &&
      J(m1.stats.questionHistory) === J(fresh.stats.questionHistory), { log: m1.state.answerLog.length, qh: m1.stats.questionHistory });
  });

  await section("[11] 集計は削減前と完全に同じ（calendar / progress / unit-strength / crossunit / buildSummary / dailyquest 過去分）", async () => {
    for (const [n, step] of [[250, 3 * 3600000], [800, 2 * 3600000], [1500, 3 * 3600000]]) {
      const d0 = unitData(logs(n, step, BASE));
      const d1 = compact(d0);
      const now = BASE + n * step + DAY;
      const p0 = await pageTotals({ kyotsu_app_v14_keiryo: J(d0) }, now), p1 = await pageTotals({ kyotsu_app_v14_keiryo: J(d1) }, now);
      check("11 " + n + "件：calendar・progress・unit-strength・crossunit サマリ・buildSummary・dailyquest 日別件数がすべて同じ（生ログ " + d1.state.answerLog.length + "）", J(p0) === J(p1),
        Object.keys(p0).filter((k) => J(p0[k]) !== J(p1[k])));
    }
  });

  await section("[12] app.js の save：同じ変換・保存失敗・AI分析", () => {
    const store = {};
    const app = launchApp(store);
    app.run('selectUnit("keiryo")');
    app.ctx.__logs = logs(450, 60000);
    app.run("state.answerLog = __logs.slice(); stats.questionHistory = {};");
    // 保存失敗（容量エラー）：Phase 7A-1 どおり、メモリの学習は続き、生ログも減らさない
    app.flags.fail = true;
    const ok1 = app.run("save()");
    check("12-1 保存失敗：false を返し、保存できていない表示・alert は1回、メモリの生ログは 450件のまま",
      ok1 === false && app.run("saveFailing") === true && app.alerts.length === 1 && app.run("state.answerLog.length") === 450 && !app.run('"logArchive" in state'));
    app.flags.fail = false;
    const ok2 = app.run("save()");
    const saved = JSON.parse(store.kyotsu_app_v14_keiryo);
    const expect = compact({ state: JSON.parse(J(saved.state)), stats: saved.stats });
    check("12-2 次の保存で成功：保存データは compactUnitData と同じ形（生ログ 300・archive 150）", ok2 === true && saved.state.answerLog.length === 300 && countArc(saved.state.logArchive) === 150 && J(expect) === J(saved));
    check("12-3 メモリ上も同じ形にそろう（生ログ・archive・rescueLog・questionHistory）", app.run("state.answerLog.length") === 300 &&
      J(app.run("state.logArchive")) === J(saved.state.logArchive) && J(app.run("state.rescueLog")) === J(saved.state.rescueLog) && J(app.run("stats.questionHistory")) === J(saved.stats.questionHistory));
    const merged = mergeNew(C(saved), null);
    check("12-4 save の結果を merge（片側）に通しても同じ＝save と merge が同じ変換", J(merged.state.answerLog) === J(saved.state.answerLog) && J(merged.state.logArchive) === J(saved.state.logArchive) &&
      J(merged.state.rescueLog) === J(saved.state.rescueLog) && J(merged.stats.questionHistory) === J(saved.stats.questionHistory));
    const ai = app.run("analyzeLog(state.answerLog).totalAnswered");
    check("12-5 AI分析（analyzeLog）は削減後の生ログ 300件だけ（archive・rescueLog は混ぜない）", ai === 300);
    const report = app.run("buildAnalysisReport()");
    check("12-6 分析レポートの総回答も 300問", /総回答 300問/.test(report));
    app.run("update()");
    const rate = String(app.els.reviewRate.innerText);
    const all = logs(450, 60000), rv = all.filter((r) => r.mode === "review" || r.mode === "dueReview");
    const want = Math.round((rv.filter((r) => r.isCorrect).length / rv.length) * 100) + "%";
    check("12-7 復習モード正答率は archive＋生ログ（削減前の 450件ぶん）", rate === want, { rate, want });
  });

  console.log("\n結果: " + pass + " OK / " + fail + " NG");
  process.exit(fail ? 1 : 0);
})();
