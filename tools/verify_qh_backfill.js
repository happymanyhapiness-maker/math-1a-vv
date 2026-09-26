// -*- coding: utf-8 -*-
// verify_qh_backfill.js
// Phase 7C: 生ログ（answerLog）から欠けている questionHistory を Phase 1 のルールで補う（log-archive.js の
// backfillQuestionHistory / compactUnitData）回帰テスト。
//  ・pickHistory が firebase-sync.js の Phase 1 merge（pick）と同じ判定
//  ・既存の正しい値を壊さない（A〜E）・archive へ移す回答がなくても補う・何も無ければ同じオブジェクト
//  ・stale 端末・archive 前の補完・resetGen（世代を選んでから補う）
//  ・save でも merge だけでも補われる・保存失敗時はメモリを進めない
//  ・「前回の結果」・前回正解スキップ・未挑戦モードが補完後の questionHistory を使う
//  ・回答数・正答率・calendar・progress・unit-strength・crossunit・buildSummary・dailyquest は変わらない
//
//   node tools/verify_qh_backfill.js

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
const SYNC = read("firebase-sync.js");
const mergeNew = new Function("globalThis", slice(SYNC, "function freshness",
  "/* =========================================================\n   Firestore 入出力") + "\nreturn mergeUnitData;")({ LogArchive: LA });
const backfill = LA.backfillQuestionHistory;
const compact = LA.compactUnitData;

const DAY = 86400000;
const BASE = Date.UTC(2026, 6, 8, 3, 0, 0);
function log(qid, ts, isCorrect, outcome, mode) {
  return { questionId: qid, stage: "第1問", num: 1, weakness: "計算精度", route: [], selectedIndex: isCorrect ? 0 : 1, selectedText: isCorrect ? "a" : "b",
    selectedTag: null, correctIndex: 0, correctText: "a", correctTag: "correct", isCorrect, outcome: outcome || "answered", mode: mode || "normal", timestamp: ts, elapsedTime: 30 };
}
function unit(answerLog, extra, statsExtra) {
  return { state: Object.assign({ unit: "keiryo", index: 0, correct: 0, total: 0, wrong: [], mode: "normal", answerLog, reviewMeta: {}, history: [] }, extra || {}),
    stats: Object.assign({ weakness: { "計算精度": 2 }, stage: { "第1問": { t: 3, c: 1 } }, clearedCount: 1 }, statsExtra || {}) };
}

(async () => {
  await section("[1] Phase 1 の merge と同じ判定（pickHistory）", () => {
    const pickSrc = slice(SYNC, "const pick = (x, y) => {", "const qh = {};");
    const mergePick = new Function(pickSrc + "\nreturn pick;")();
    const vals = [undefined, null];
    [undefined, "x", 0, 5, 7].forEach((date) => [true, false, undefined].forEach((isCorrect) => vals.push({ date, isCorrect })));
    let diff = 0;
    vals.forEach((x) => vals.forEach((y) => { if (LA.pickHistory(x, y) !== mergePick(x, y)) diff++; }));
    check("1-1 date（数値・非数値・欠落）× isCorrect（true/false/欠落）の全組み合わせで firebase-sync.js の pick と同じ", diff === 0, diff);
  });

  await section("[2] 既存の questionHistory を壊さない（A〜E）", () => {
    const T = BASE + 10 * DAY;
    const A = backfill({ q: { date: T + 5, isCorrect: true } }, [log("q", T, false)]);
    check("2-A 既存の方が新しい → 既存を維持（同じオブジェクト）", J(A) === J({ q: { date: T + 5, isCorrect: true } }));
    const B = backfill({ q: { date: T, isCorrect: true } }, [log("q", T, false)]);
    check("2-B 同じ時刻・既存が正解・ログが誤答 → 誤答", J(B.q) === J({ date: T, isCorrect: false }));
    const Cc = backfill({ q: { date: T, isCorrect: false } }, [log("q", T, true)]);
    check("2-C 同じ時刻・既存が誤答・ログが正解 → 誤答のまま", J(Cc.q) === J({ date: T, isCorrect: false }));
    const D = backfill({ q: { date: T, isCorrect: true } }, [log("q", T + 1000, false)]);
    check("2-D ログの方が新しい → ログで更新", J(D.q) === J({ date: T + 1000, isCorrect: false }));
    const logs = [log("q", T, true), log("r", T + 1, false), log("q", T + 2, false), log("q", T + 2, true)];
    const e1 = backfill({}, logs), e2 = backfill(e1, logs), e3 = backfill(e2, logs.slice().reverse());
    check("2-E 何度かけても同じ（2回目以降は同じオブジェクト・順番を変えても同じ中身）", e2 === e1 && e3 === e2 && J(e1) === J({ q: { date: T + 2, isCorrect: false }, r: { date: T + 1, isCorrect: false } }));
    const same = { q: { date: T + 9, isCorrect: true } };
    check("2-F 何も変わらなければ入力と同じ参照（undefined もそのまま）", backfill(same, [log("q", T, true)]) === same && backfill(undefined, []) === undefined);
    const inp = { q: { date: T, isCorrect: true } }, snap = J(inp);
    backfill(inp, [log("q", T + 1, false), log("z", T, true)]);
    check("2-G 入力を変更しない", J(inp) === snap);
    check("2-H timestamp が無効・問題 ID が無いログは無視", J(backfill({}, [{ questionId: "a", isCorrect: true }, log(undefined, T, true), log("", T, true), log("b", "123", true), log("c", -5, false), null])) === "{}");
    check("2-I outcome ごとの isCorrect はログの値そのもの（answered 正/誤・timeout・skip、mode は問わない）",
      J(backfill({}, [log("a", T, true, "answered", "review"), log("b", T, false, "answered", "dueReview"), log("c", T, false, "timeout", "tips"), log("d", T, true, "timeout"), log("e", T, false, "skip", "stage")])) ===
      J({ a: { date: T, isCorrect: true }, b: { date: T, isCorrect: false }, c: { date: T, isCorrect: false }, d: { date: T, isCorrect: true }, e: { date: T, isCorrect: false } }));
  });

  await section("[3] archive へ移す回答が0件でも補う", () => {
    const logs = [log("q1", BASE, true), log("q2", BASE + 1000, false), log("q1", BASE + 2000, false)];
    const d0 = unit(logs); // 本番と同じ：stats.questionHistory キーが無い
    const d1 = compact(d0);
    check("3-1 生ログ 3件（300件以下・180日以内）でも questionHistory が作られ、新しいオブジェクトが返る",
      d1 !== d0 && J(d1.stats.questionHistory) === J({ q1: { date: BASE + 2000, isCorrect: false }, q2: { date: BASE + 1000, isCorrect: false } }));
    check("3-2 変わるのは stats.questionHistory だけ（state は同じ参照、stats のほかの値も同じ）",
      d1.state === d0.state && J(Object.assign({}, d1.stats, { questionHistory: undefined })) === J(Object.assign({}, d0.stats, { questionHistory: undefined })));
    check("3-3 補完済みなら同じオブジェクトを返す", compact(d1) === d1);
    const empty = unit([]);
    check("3-4 生ログが無ければキーを作らない（同じオブジェクト）", compact(empty) === empty && !("questionHistory" in empty.stats));
    const withNewer = unit(logs, {}, { questionHistory: { q1: { date: BASE + 5000, isCorrect: true }, q2: { date: BASE + 5000, isCorrect: true } } });
    check("3-5 既存の方がすべて新しければ同じオブジェクト（書き込みも起きない）", compact(withNewer) === withNewer);
    check("3-6 前回正解スキップ（skipKnownQuestion）はログを残さないので、補完でも作られない",
      !("q9" in compact(unit(logs)).stats.questionHistory) && !/questionHistory/.test(slice(read("app.js"), "function skipKnownQuestion", "/* =========================\n   次へ")));
  });

  await section("[4] stale 端末", () => {
    const fresh = unit([log("q1", BASE + 10 * DAY, true)], {}, { questionHistory: { q1: { date: BASE + 10 * DAY, isCorrect: true } } });
    const stale = unit([log("q1", BASE, false), log("q2", BASE + DAY, false), log("q3", BASE + 2 * DAY, true)]); // questionHistory 無し
    const m1 = mergeNew(C(fresh), C(stale)), m2 = mergeNew(C(stale), C(fresh));
    const want = { q1: { date: BASE + 10 * DAY, isCorrect: true }, q2: { date: BASE + DAY, isCorrect: false }, q3: { date: BASE + 2 * DAY, isCorrect: true } };
    const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    check("4-1 新端末の questionHistory は消えず、古い生ログから足りない問題だけ補われる（引数順に依存しない）",
      J(sortKeys(m1.stats.questionHistory)) === J(want) && J(m1) === J(m2), [m1.stats.questionHistory, m2.stats.questionHistory]);
    check("4-2 もう一度 merge・compact しても同じ", J(mergeNew(C(m1), C(stale))) === J(m1) && compact(m1) === m1);
  });

  await section("[5] archive へ移す前に補完", () => {
    const logs = Array.from({ length: 320 }, (_, i) => log("q" + (i % 40), BASE + i * 60000, i % 3 !== 0));
    const d = compact(unit(logs));
    const movedQ = logs.slice(0, 20).map((r) => r.questionId);
    check("5-1 archive に移った回答の問題も questionHistory に残る（生ログ300・archive20）", d.state.answerLog.length === 300 &&
      Object.values(d.state.logArchive).reduce((s, v) => s + v.length / 18, 0) === 20 && movedQ.every((q) => q in d.stats.questionHistory));
    const onlyOld = Array.from({ length: 5 }, (_, i) => log("old" + i, BASE + i, true)).concat(Array.from({ length: 300 }, (_, i) => log("new", BASE + DAY + i * 1000, true)));
    const d2 = compact(unit(onlyOld));
    check("5-2 生ログから消えた問題（old0〜4）も questionHistory に残る", ["old0", "old1", "old2", "old3", "old4"].every((q) => q in d2.stats.questionHistory) &&
      !d2.state.answerLog.some((r) => r.questionId.startsWith("old")));
    check("5-3 archive の形式（v1 token）は変わらない", Object.values(d.state.logArchive).every((v) => typeof v === "string" && v.length % 18 === 0));
  });

  await section("[6] resetGen：世代を選んでから補う", () => {
    const oldGen = unit([log("z", BASE, true), log("y", BASE + 1, false)]);
    const newGen = unit([log("a", BASE + 10 * DAY, true)], { resetGen: 1 });
    const m1 = mergeNew(C(oldGen), C(newGen)), m2 = mergeNew(C(newGen), C(oldGen));
    check("6-1 古い世代の生ログから新しい世代へ補完しない（a だけ）", J(m1.stats.questionHistory) === J({ a: { date: BASE + 10 * DAY, isCorrect: true } }) && J(m1) === J(m2));
    const newGenEmpty = unit([], { resetGen: 1 });
    const m3 = mergeNew(C(oldGen), C(newGenEmpty));
    check("6-2 新しい世代に回答が無ければ questionHistory も作らない", !("questionHistory" in m3.stats));
  });

  // ---- app.js（save・保存失敗・UI） ----
  function fakeLS(store) {
    return { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
      key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
  }
  function launchApp(store) {
    const els = {};
    const mkEl = () => new Proxy({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
      { get: (o, p) => (p in o ? o[p] : () => undefined), set: (o, p, v) => { o[p] = v; return true; } });
    const alerts = [];
    const ls = fakeLS(store);
    const flags = { fail: false };
    const origSet = ls.setItem;
    ls.setItem = (k, v) => { if (flags.fail && k.startsWith("kyotsu_app_v15_")) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } origSet(k, v); };
    const ctx = { console: { log() {}, error() {}, warn() {} }, alert: (m) => alerts.push(m), confirm: () => true, scrollTo() {}, setTimeout, clearTimeout, setInterval, clearInterval,
      getComputedStyle: (e) => e.style, localStorage: ls,
      document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {}, body: mkEl(), readyState: "loading" } };
    ctx.window = ctx;
    vm.createContext(ctx);
    read("index.html").match(/questions_[a-z_0-9]+\.js/g).forEach((f) => vm.runInContext(read(f), ctx));
    vm.runInContext(read("storage-ns.js"), ctx);
    vm.runInContext(read("log-archive.js"), ctx);
    vm.runInContext(read("app.js"), ctx);
    require("./test-context.js").readyApp((c) => vm.runInContext(c, ctx)); // Phase 8A：テスト用アカウントで確定
    return { ctx, els, alerts, flags, store, run: (c) => vm.runInContext(c, ctx) };
  }
  const KEY = "kyotsu_app_v15_u_t_kyokusen";
  function storeWith(fn) {
    const probe = launchApp({});
    const qs = probe.run("UNIT_META.kyokusen.questions.map((q) => ({ id: q.id, correct: q.correct, group: q.group || null }))");
    const data = { state: probe.run('defaultState("kyokusen")'), stats: probe.run("defaultStats()") };
    delete data.stats.questionHistory; // 本番と同じ：キー自体が無い
    fn(data, qs);
    return { store: { [KEY]: J(data), kyotsu_app_unit_v1: "kyokusen" }, qs, data };
  }

  await section("[7] save / merge のどちらでも補われる・保存失敗時はメモリを進めない", () => {
    const { store, qs, data } = storeWith((d, qs) => { d.state.answerLog = [log(qs[0].id, BASE, true), log(qs[1].id, BASE + 1000, false)]; });
    const m = mergeNew(C(data), null);
    check("7-1 同期（merge）だけでも補われる", J(m.stats.questionHistory) === J({ [qs[0].id]: { date: BASE, isCorrect: true }, [qs[1].id]: { date: BASE + 1000, isCorrect: false } }));
    const app = launchApp(store);
    check("7-2 読み込んだだけではメモリの questionHistory は空（保存も同期もしていない）", J(app.run("stats.questionHistory")) === "{}");
    app.flags.fail = true;
    const ok1 = app.run("save()");
    check("7-3 保存失敗：false を返し、メモリも保存データも補完しない（Phase 7A-1 のまま）",
      ok1 === false && J(app.run("stats.questionHistory")) === "{}" && !("questionHistory" in JSON.parse(app.store[KEY]).stats) && app.alerts.length === 1);
    app.flags.fail = false;
    const ok2 = app.run("save()");
    const saved = JSON.parse(app.store[KEY]);
    check("7-4 保存成功：保存データとメモリが同じ補完結果にそろう", ok2 === true && J(saved.stats.questionHistory) === J(m.stats.questionHistory) &&
      J(app.run("stats.questionHistory")) === J(m.stats.questionHistory));
  });

  await section("[8] 画面：前回の結果・前回正解スキップ・未挑戦モード", () => {
    const { store, qs } = storeWith((d, qs) => {
      d.state.answerLog = [log(qs[0].id, BASE, true), log(qs[1].id, BASE + DAY, false)];
    });
    const app = launchApp(store);
    const before = app.run("buildUnansweredList().map((q) => q.id)");
    app.run("save()");
    const after = app.run("buildUnansweredList().map((q) => q.id)");
    // group 仕様：未回答の問題と同じ group の問題は、回答済みでも対象に入る（今までどおり）
    const ans = new Set([qs[0].id, qs[1].id]);
    const need = new Set(qs.filter((q) => !ans.has(q.id) && q.group).map((q) => q.group));
    const expected = qs.filter((q) => !ans.has(q.id) || (q.group && need.has(q.group))).map((q) => q.id);
    check("8-1 補完前は全問が未挑戦扱い、補完後は回答済みの問題を外す（group 仕様はそのまま）", before.length === qs.length && J(after) === J(expected), { before, after, expected });
    app.run(`startExam(); state.index = UNIT_META.kyokusen.questions.findIndex((q) => q.id === ${J(qs[0].id)}); show();`);
    const label = String(app.els.qLastResultLabel.innerText), box = String(app.els.questionStartBox.innerHTML);
    check("8-2 「前回の結果」が表示され、前回正解の問題に「前回正解済み→スキップ」が出る", /前回\(\d+\/\d+\): ○/.test(label) && box.includes("skipKnownBtn"), { label });
    app.run(`state.index = UNIT_META.kyokusen.questions.findIndex((q) => q.id === ${J(qs[1].id)}); show();`);
    check("8-3 前回誤答の問題は ×、スキップボタンは出ない", /: ×/.test(String(app.els.qLastResultLabel.innerText)) && !String(app.els.questionStartBox.innerHTML).includes("skipKnownBtn"));
  });

  await section("[9] 学習実績の数字は補完前後で同じ", async () => {
    const UNIT_META_MINI = { keiryo: { label: "keiryo", questions: Array.from({ length: 12 }, (_, i) => ({ id: "q" + i })) } };
    const pageTotals = async (store, now) => {
      const mk = (f, start, end, ret) => new Function("localStorage", "window", "UNIT_META", "LogArchive", slice(read(f), start, end) + "\nreturn " + ret + ";")(fakeLS(store), require("./test-context.js").readerWindow(LA), UNIT_META_MINI, LA);
      const ctx = { console, localStorage: fakeLS(store), UNIT_META: UNIT_META_MINI, TAG_LABELS: {}, LogArchive: LA, KyotsuNS: require("./test-context.js").readerWindow(LA).KyotsuNS, document: { readyState: "loading", addEventListener() {}, getElementById: () => null } };
      ctx.window = ctx;
      vm.createContext(ctx);
      vm.runInContext(read("crossunit.js"), ctx);
      let written = null;
      const f = new Function("localStorage", "UNIT_META", "PREFIX", "globalThis", "currentUser", "isGuardian", "targetUid", "getDoc", "setDoc", "doc", "db", "serverTimestamp", "Date", "ownPrefixNow", "NS",
        slice(SYNC, "function unitKeys", "/* データの「新しさ」") + slice(SYNC, "function todayKeyJST", "/* =========================================================\n   plannerの「今日のクエスト」") +
        slice(SYNC, "async function backfillDailyQuestLogs", "\n  } catch (e) {") + "\n  } catch (e) { throw e; }\n}\nreturn { buildSummary, backfillDailyQuestLogs };")(
        fakeLS(store), UNIT_META_MINI, "kyotsu_app_v14_", { LogArchive: LA }, { uid: "x" }, () => false, () => "x",
        async () => ({ exists: () => true, data: () => ({ data: J({ days: {}, appStartDate: "2020-01-01" }) }) }), async (_d, v) => { written = JSON.parse(v.data); }, () => ({}), {}, () => 0,
        class extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }, require("./test-context.js").syncNS(store).ownPrefixNow, require("./test-context.js").syncNS(store).NS);
      const summary = f.buildSummary();
      await f.backfillDailyQuestLogs();
      return {
        calendar: mk("calendar.js", '"use strict";', "var dayMap = buildDayMap();", "buildDayMap()"),
        progress: mk("progress.js", '"use strict";', "/* ---------- 日付表示", "collectUnitProgress()").find((x) => x.unit === "keiryo"),
        strength: mk("unit-strength.js", '"use strict";', "/* ---------- 描画", "collectUnitAccuracy()"),
        cross: vm.runInContext("buildCrossUnitReport()", ctx).split("\n").filter((l) => !l.startsWith("出力日時")).join("\n"),
        summary, written
      };
    };
    const logs = Array.from({ length: 113 }, (_, i) => log("q" + (i % 12), BASE + i * 5 * 3600000, i % 4 !== 0, ["answered", "answered", "timeout", "skip"][i % 4], ["normal", "review", "dueReview"][i % 3]));
    const d0 = unit(logs);
    const d1 = compact(d0);
    const now = BASE + 200 * DAY;
    const p0 = await pageTotals({ ["kyotsu_app_v15_u_t_keiryo"]: J(d0) }, now), p1 = await pageTotals({ ["kyotsu_app_v15_u_t_keiryo"]: J(d1) }, now);
    check("9-1 calendar・progress（回答回数・解いた問題数を含む）・unit-strength・crossunit 全文・buildSummary・dailyquest がすべて同じ",
      J(p0) === J(p1) && Object.keys(d1.stats.questionHistory).length === 12, Object.keys(p0).filter((k) => J(p0[k]) !== J(p1[k])));
  });

  console.log("\n結果: " + pass + " OK / " + fail + " NG");
  process.exit(fail ? 1 : 0);
})();
