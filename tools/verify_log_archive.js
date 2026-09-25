// -*- coding: utf-8 -*-
// verify_log_archive.js
// Phase 7B-1: 古い回答の compact event archive（log-archive.js, schema v1）の回帰テスト。
//  ・schema（18文字 token・JST・cyrb53 のテストベクタ）が変わっていないこと
//  ・壊れたデータで throw しないこと
//  ・正規形・和集合（複数端末の反例 A〜C）
//  ・archive＋生ログの集計（重複は archive 側を正）… calendar / progress / unit-strength / crossunit /
//    復習モード正答率 / buildSummary / dailyquest 過去分
//  ・archive が無いデータでは、全集計が HEAD（変更前）と完全に同じ
//  ・AI分析（analyzeLog / crossunit の分析部分）は生ログだけ
//  ・merge（通常 / 片側 null / resetGen 世代違い / 旧コードの LWW からの復旧）
//
//   node tools/verify_log_archive.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const DIR = path.join(__dirname, "..");
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));
const LA = require(path.join(DIR, "log-archive.js"));
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8").replace(/\r\n/g, "\n");
let headOk = true;
const head = (f) => {
  // 比較の基準は archive 導入前の本番版（Phase 7A-2c = 31fed99）に固定する
  try { return execSync("git show 31fed99:" + f, { cwd: DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n"); }
  catch (e) { headOk = false; return null; }
};

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail).slice(0, 400) : "")); }
}
function section(title, fn) {
  console.log("\n" + title);
  try { fn(); } catch (e) { check("例外なく実行できる", false, String(e && e.stack || e).split("\n").slice(0, 3).join(" ")); }
}
function slice(src, start, end) {
  const s = src.indexOf(start);
  const e = src.indexOf(end, s + start.length);
  if (s < 0 || e < 0) throw new Error("抽出失敗: " + start);
  return src.slice(s, e);
}

// ---- テストデータ ----
const DAY = 86400000;
const BASE = Date.UTC(2026, 7, 1, 0, 0, 0); // 2026-08-01 09:00 JST
const UNITS = ["keiryo", "seishitsu", "hojosankaku", "kyokusen"];
let seed = 7;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
function rawLog(unit, i, opts) {
  const o = opts || {};
  return {
    questionId: unit.slice(0, 2) + "-" + (i % 12), stage: "第" + (1 + i % 4) + "問", num: 1 + i % 5,
    weakness: ["計算精度", "方針切替", "時間判断"][i % 3], route: i % 2 ? ["比の条件"] : [],
    selectedIndex: i % 4, selectedText: "選択肢" + (i % 4), selectedTag: i % 3 ? "correct" : "calc_error",
    correctIndex: 1, correctText: "正解", correctTag: "correct",
    isCorrect: o.isCorrect !== undefined ? o.isCorrect : i % 3 !== 0,
    outcome: ["answered", "answered", "timeout", "skip"][i % 4],
    mode: o.mode || ["normal", "review", "dueReview", "stage", "tips", "unanswered"][i % 6],
    timestamp: o.timestamp !== undefined ? o.timestamp : BASE + i * 3 * 3600000 + (i % 7) * 61000,
    elapsedTime: 20 + (i % 40)
  };
}
function unitData(unit, log, extra) {
  const qh = {};
  log.forEach((r) => { if (r.questionId && typeof r.timestamp === "number") qh[r.questionId] = { date: r.timestamp, isCorrect: r.isCorrect }; });
  return {
    state: Object.assign({ unit, index: 0, correct: 0, total: 0, wrong: [], mode: "normal", answerLog: log, reviewMeta: {}, history: [] }, extra || {}),
    stats: { weakness: {}, stage: {}, questionHistory: qh, clearedCount: 0 }
  };
}
// 実データ風：単元ごとに数十〜数百件、timestamp の無い古いログ・mode の無い古いログも混ぜる
function realisticStore() {
  const store = {};
  UNITS.forEach((u, k) => {
    const n = 40 + rnd(160);
    const log = [];
    for (let i = 0; i < n; i++) {
      const r = rawLog(u, i + k * 1000);
      if (i === 3) delete r.mode;
      if (i === 5) delete r.timestamp;
      log.push(r);
    }
    store["kyotsu_app_v14_" + u] = J(unitData(u, log));
  });
  return store;
}
const archiveOf = (log) => {
  const arc = {};
  log.forEach((r) => { const t = LA.tokenOf(r); if (t) { const k = LA.jstDayKey(r.timestamp); arc[k] = (arc[k] || "") + t; } });
  return LA.normalizeArchive(arc);
};
const countArc = (arc) => Object.values(arc).reduce((s, v) => s + v.length / 18, 0);

// ---- ページごとの集計関数を、本物のソースから取り出して動かす ----
function fakeLS(store) {
  return {
    getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; }
  };
}
function readers(ver) {
  const get = ver === "head" ? head : read;
  const cal = get("calendar.js"), prog = get("progress.js"), us = get("unit-strength.js"), cross = get("crossunit.js"), sync = get("firebase-sync.js");
  if (!cal) return null;
  const withLA = ver !== "head";
  const mk = (src, start, end, ret) => new Function("localStorage", "window", "UNIT_META", "LogArchive",
    slice(src, start, end) + "\nreturn " + ret + ";");
  const UNIT_META = {};
  UNITS.forEach((u) => { UNIT_META[u] = { label: u, questions: Array.from({ length: 12 }, (_, i) => ({ id: u.slice(0, 2) + "-" + i })) }; });
  return {
    calendar: (store) => mk(cal, '"use strict";', "var dayMap = buildDayMap();", "buildDayMap()")(fakeLS(store), withLA ? { LogArchive: LA } : {}, UNIT_META, withLA ? LA : undefined),
    progress: (store) => mk(prog, '"use strict";', "/* ---------- 日付表示", "collectUnitProgress()")(fakeLS(store), withLA ? { LogArchive: LA } : {}, UNIT_META, withLA ? LA : undefined),
    strength: (store) => mk(us, '"use strict";', "/* ---------- 描画", "collectUnitAccuracy()")(fakeLS(store), withLA ? { LogArchive: LA } : {}, UNIT_META, withLA ? LA : undefined),
    cross: (store) => {
      const ctx = { console, localStorage: fakeLS(store), UNIT_META, TAG_LABELS: {}, document: { readyState: "loading", addEventListener() {}, getElementById: () => null } };
      ctx.window = ctx;
      if (withLA) ctx.LogArchive = LA;
      vm.createContext(ctx);
      vm.runInContext(cross, ctx);
      return vm.runInContext("buildCrossUnitReport()", ctx).split("\n").filter((l) => !l.startsWith("出力日時")).join("\n");
    },
    summary: async (store, now) => {
      const body = slice(sync, "function unitKeys", "/* データの「新しさ」") +
        slice(sync, "function todayKeyJST", "/* =========================================================\n   plannerの「今日のクエスト」") +
        slice(sync, "async function backfillDailyQuestLogs", "\n  } catch (e) {") + "\n  } catch (e) { throw e; }\n}\n" +
        "return { buildSummary, backfillDailyQuestLogs };";
      let written = null;
      const g = withLA ? { LogArchive: LA } : {};
      const f = new Function("localStorage", "UNIT_META", "PREFIX", "globalThis", "currentUser", "isGuardian", "targetUid", "getDoc", "setDoc", "doc", "db", "serverTimestamp", "Date",
        body)(fakeLS(store), UNIT_META, "kyotsu_app_v14_", g, { uid: "x" }, () => false, () => "x",
        async () => ({ exists: () => true, data: () => ({ data: J({ days: {}, appStartDate: "2020-01-01" }) }) }),
        async (_d, v) => { written = JSON.parse(v.data); }, () => ({}), {}, () => 0,
        class extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } });
      const s = f.buildSummary();
      await f.backfillDailyQuestLogs();
      const perDay = {};
      Object.keys((written && written.days) || {}).forEach((k) => {
        const q = written.days[k].quests.find((x) => x.autoSource === "kyotsu-math");
        perDay[k] = q && Number((q.label.match(/(\d+)問/) || [])[1]);
      });
      return { summary: s, perDay };
    }
  };
}
// 復習モード正答率（app.js の update()）
function reviewRateOf(appSrc, withLA, data) {
  const els = {};
  const mkEl = () => new Proxy({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    { get: (o, p) => (p in o ? o[p] : () => undefined), set: (o, p, v) => { o[p] = v; return true; } });
  const store = {};
  const ctx = {
    console, alert() {}, confirm: () => true, scrollTo() {}, setTimeout, clearTimeout, setInterval, clearInterval,
    getComputedStyle: (e) => e.style, localStorage: fakeLS(store),
    document: { getElementById: (id) => (els[id] || (els[id] = mkEl())), querySelector: () => null, querySelectorAll: () => [],
      createElement: () => mkEl(), addEventListener() {}, body: mkEl(), readyState: "loading" }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  read("index.html").match(/questions_[a-z_0-9]+\.js/g).forEach((f) => vm.runInContext(read(f), ctx));
  if (withLA) vm.runInContext(read("log-archive.js"), ctx);
  vm.runInContext(appSrc, ctx);
  store["kyotsu_app_v14_keiryo"] = J(data);
  vm.runInContext('selectUnit("keiryo"); update();', ctx);
  return String(els.reviewRate.innerText);
}
function loadMerge(src) {
  return new Function("globalThis", slice(src, "function freshness",
    "/* =========================================================\n   Firestore 入出力") + "\nreturn mergeUnitData;");
}
const mergeNew = loadMerge(read("firebase-sync.js"))({ LogArchive: LA });

(async () => {
  section("[1] schema：token 長・JST・時刻の復元", () => {
    const at = (h, m, s, ms, d) => Date.UTC(2026, 8, d || 25, h, m, s, ms) - 9 * 3600000; // JST の時刻
    const cases = [
      ["00:00:00.000", at(0, 0, 0, 0), "2026-09-25", "000000"],
      ["16:47:46.175（36^5-1 ms）", at(16, 47, 46, 175), "2026-09-25", "0zzzzz"],
      ["16:47:46.176（36^5 ms・6桁目が必要）", at(16, 47, 46, 176), "2026-09-25", "100000"],
      ["23:59:59.999", at(23, 59, 59, 999), "2026-09-25", "1ffunz"],
      ["翌日 00:00:00.000（日付境界）", at(0, 0, 0, 0, 26), "2026-09-26", "000000"],
      ["UTC 14:59:59.999 は JST 23:59:59.999", Date.UTC(2026, 8, 25, 14, 59, 59, 999), "2026-09-25", "1ffunz"],
      ["UTC 15:00:00.000 は JST 翌日 00:00", Date.UTC(2026, 8, 25, 15, 0, 0, 0), "2026-09-26", "000000"]
    ];
    cases.forEach(([name, ts, day, time]) => {
      const r = { questionId: "q", timestamp: ts, outcome: "answered", selectedIndex: 0, selectedText: "a", isCorrect: true, mode: "normal" };
      const tok = LA.tokenOf(r);
      check("1 " + name + "：日付 " + day + "・時刻 " + time + "・18文字・元の timestamp に戻る",
        tok.length === 18 && LA.jstDayKey(ts) === day && tok.slice(0, 6) === time &&
        LA.tsFromDayOffset(day, parseInt(tok.slice(0, 6), 36)) === ts, { tok, day: LA.jstDayKey(ts) });
    });
    // 端末のタイムゾーンに依存しない（TZ を変えた別プロセスで同じ token）
    const r = { questionId: "q", timestamp: Date.UTC(2026, 8, 25, 15, 30, 0, 1), outcome: "answered", selectedIndex: 0, selectedText: "a", isCorrect: false, mode: "review" };
    const script = `const LA=require(${J(path.join(DIR, "log-archive.js"))});const r=${J(r)};process.stdout.write(LA.jstDayKey(r.timestamp)+" "+LA.tokenOf(r));`;
    const outs = ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"].map((tz) =>
      execSync(`node -e ${J(script)}`, { env: Object.assign({}, process.env, { TZ: tz }), encoding: "utf8" }));
    check("1-8 TZ=UTC / Los_Angeles / Tokyo / Kiritimati で同じ日付キー・token", outs.every((o) => o === outs[0]) && outs[0].startsWith("2026-09-26 "), outs);
  });

  section("[2] hash テストベクタ（変わったら schema 変更＝archive の ID が変わる）", () => {
    const T = Date.UTC(2026, 8, 25, 3, 4, 5, 678);
    const vectors = [
      [{ questionId: "ho1-1", timestamp: T, outcome: "answered", selectedIndex: 2, selectedText: "点O、点O'、点Bによる三角形OO'B", isCorrect: false, mode: "normal" }, "03rt871layx", "0pv6we03rt871layx0"],
      [{ questionId: "g1-3", timestamp: 1790000000000, outcome: "answered", selectedIndex: 0, selectedText: "1:2", isCorrect: true, mode: "review" }, "0x3jb32uh48", "1dru680x3jb32uh483"],
      [{ questionId: "ky1-2", timestamp: 1790000123456, outcome: "timeout", selectedIndex: null, selectedText: "", isCorrect: false, mode: "dueReview" }, "1f5na6m0tbh", "1duhfk1f5na6m0tbh2"],
      [{ questionId: "v2-1", timestamp: 1790000999999, outcome: "skip", selectedIndex: null, selectedText: null, isCorrect: false, mode: "normal" }, "2b3c4kmi2kd", "1ed9rz2b3c4kmi2kd0"],
      [{ questionId: "z3-4", timestamp: Date.UTC(2026, 8, 25, 14, 59, 59, 999), outcome: "answered", selectedIndex: 3, selectedText: "$x=\\frac{1}{2}$", isCorrect: true, mode: "tips" }, "2gfk6kj77uo", "1ffunz2gfk6kj77uo1"],
      [{ questionId: "legacy", timestamp: 1700000000000, isCorrect: true }, "0knjzfa3g6s", "0fh9q80knjzfa3g6s1"]
    ];
    vectors.forEach(([r, hash, tok], i) => {
      const h = LA.cyrb53(LA.dedupeKey(r)).toString(36).padStart(11, "0");
      check("2-" + (i + 1) + " " + J(LA.dedupeKey(r)).slice(0, 40) + " → " + hash + " / " + tok, h === hash && LA.tokenOf(r) === tok, { h, tok: LA.tokenOf(r) });
    });
    // firebase-sync.js の answerLog 重複判定キーと同じ式
    const syncKey = slice(read("firebase-sync.js"), "const k = [r.questionId", ";\n");
    check("2-7 firebase-sync.js の重複判定キーと log-archive.js の dedupeKey が同じ式", syncKey.trim() === 'const k = [r.questionId, r.timestamp, r.outcome, r.selectedIndex, r.selectedText].join("|")' &&
      /return \[r\.questionId, r\.timestamp, r\.outcome, r\.selectedIndex, r\.selectedText\]\.join\("\|"\);/.test(read("log-archive.js")), syncKey);
    check("2-8 flag：正解=bit0 / review・dueReview=bit1（tips・stage・unanswered は review ではない）",
      ["normal", "review", "dueReview", "tips", "stage", "unanswered", undefined].map((m) => LA.flagOf({ isCorrect: true, mode: m })).join("") === "1331111" &&
      LA.flagOf({ isCorrect: false, mode: "review" }) === "2" && LA.flagOf({ isCorrect: false }) === "0");
    check("2-9 timestamp が無効なログは ID を作らない", LA.eventId({ questionId: "a" }) === null && LA.eventId({ questionId: "a", timestamp: "1" }) === null && LA.eventId(null) === null);
  });

  section("[3] 壊れたデータで throw しない（読み飛ばし方を固定）", () => {
    const good = LA.tokenOf(rawLog("keiryo", 1));
    const day = LA.jstDayKey(rawLog("keiryo", 1).timestamp);
    const cases = [
      ["logArchive が null", null, {}],
      ["logArchive が文字列", "abc", {}],
      ["logArchive が配列", [good], {}],
      ["日別の値が数値", { [day]: 123 }, {}],
      ["日付キーが不正", { "2026/09/25": good, "x": good }, {}],
      ["18の倍数でない末尾は無視", { [day]: good + "abc" }, { [day]: good }],
      ["flag が 0〜3 でない token は無視", { [day]: good.slice(0, 17) + "7" + good }, { [day]: good }],
      ["時刻が1日の範囲外（1ffuo0）は無視", { [day]: "1ffuo0" + good.slice(6) }, {}],
      ["大文字など base36 小文字以外は無視", { [day]: good.toUpperCase() }, {}],
      ["空文字の日は消える", { [day]: "" }, {}]
    ];
    cases.forEach(([name, input, expected], i) => {
      let out, err = null;
      try { out = LA.normalizeArchive(input); } catch (e) { err = e; }
      check("3-" + (i + 1) + " " + name, !err && J(out) === J(expected), err ? String(err) : out);
    });
    let err = null, n = null;
    try { n = LA.countableLog({ answerLog: [rawLog("keiryo", 2)], logArchive: { [day]: 5, bad: "x" } }).length; } catch (e) { err = e; }
    check("3-11 集計（countableLog）も壊れた archive で throw せず生ログだけ数える", !err && n === 1);
    const s = { answerLog: [rawLog("keiryo", 2)] };
    check("3-12 archive が無ければ生ログの配列そのもの（同じ参照）", LA.countableLog(s) === s.answerLog && LA.countableLog({}).length === 0 && LA.countableLog(null).length === 0);
  });

  section("[4] 正規形・和集合・複数端末の反例", () => {
    const mk = (n, dev, start) => Array.from({ length: n }, (_, i) => rawLog("keiryo", (start || 0) + i, { timestamp: BASE + (dev === "A" ? 0 : 1800000) + ((start || 0) + i) * 61000 }));
    const A5 = mk(5, "A");
    [["A 5＋7 重複なし → 12", A5, mk(7, "B"), 12], ["B 5＋7 うち3件重複 → 9", A5, A5.slice(0, 3).concat(mk(4, "B")), 9], ["C 5＋5 重複なし → 10", A5, mk(5, "B"), 10]]
      .forEach(([name, a, b, truth]) => {
        const x = archiveOf(a), y = archiveOf(b);
        const m1 = LA.unionArchives(x, y), m2 = LA.unionArchives(y, x);
        check("4 ケース" + name, countArc(m1) === truth && J(m1) === J(m2), { n: countArc(m1) });
      });
    const all = mk(30, "A");
    const shuffled = all.slice().sort(() => rnd(3) - 1);
    const a1 = archiveOf(all), a2 = archiveOf(shuffled);
    const raw1 = {}; all.forEach((r) => { const k = LA.jstDayKey(r.timestamp); raw1[k] = LA.tokenOf(r) + (raw1[k] || ""); });
    check("4-4 入力順が違っても、正規化すると完全に同じ文字列（ID 順・区切りなし）", J(a1) === J(a2) && J(LA.normalizeArchive(raw1)) === J(a1));
    check("4-5 何度正規化・和集合しても同じ", J(LA.unionArchives(a1, a1, LA.normalizeArchive(a1))) === J(a1));
    Object.values(a1).forEach((s) => { for (let i = 18; i < s.length; i += 18) if (s.slice(i - 18, i - 1) >= s.slice(i, i + 17)) throw new Error("ID 順でない"); });
    check("4-6 各日の token は ID 昇順・重複なし", true);
    const r = rawLog("keiryo", 3, { isCorrect: true, mode: "review" });
    const d = LA.jstDayKey(r.timestamp), id = LA.eventId(r);
    const f1 = LA.unionArchives({ [d]: id + "3" }, { [d]: id + "0" }), f2 = LA.unionArchives({ [d]: id + "0" }, { [d]: id + "3" });
    check("4-7 同じ ID で flag だけ違う → 1 event・誤答の flag（0）・順番に依存しない", J(f1) === J(f2) && f1[d] === id + "0", f1);
    // flag 競合の全組み合わせ：誤答優先、正誤が同じなら review でない方
    const expect = { "00": "0", "01": "0", "02": "0", "03": "0", "11": "1", "12": "2", "13": "1", "22": "2", "23": "2", "33": "3" };
    Object.keys(expect).forEach((pair) => {
      const [p, q] = pair.split("");
      const u1 = LA.unionArchives({ [d]: id + p }, { [d]: id + q }), u2 = LA.unionArchives({ [d]: id + q }, { [d]: id + p });
      const one = LA.normalizeArchive({ [d]: id + p + id + q }), two = LA.normalizeArchive({ [d]: id + q + id + p });
      check("4-7 flag " + p + " vs " + q + " → " + expect[pair] + "（逆順・同じ日の文字列内でも同じ）",
        u1[d] === id + expect[pair] && J(u1) === J(u2) && J(one) === J(u1) && J(two) === J(u1) &&
        LA.preferFlag(p, q) === expect[pair] && LA.preferFlag(q, p) === expect[pair], { u1, one });
    });
    // 複数 event の中の競合でも canonical 文字列は入力順に依存しない
    const r2 = rawLog("keiryo", 4, { isCorrect: true, mode: "normal" });
    const id2 = LA.eventId(r2), d2 = LA.jstDayKey(r2.timestamp);
    if (d2 === d) {
      const perms = [[id + "1", id2 + "3", id + "2", id2 + "1"], [id2 + "1", id + "2", id2 + "3", id + "1"], [id + "2", id + "1", id2 + "1", id2 + "3"]];
      const outs = perms.map((ts) => J(LA.normalizeArchive({ [d]: ts.join("") })));
      check("4-7 複数 event の競合を含んでも canonical 文字列は入力順に依存しない（1 vs 2 → 2、3 vs 1 → 1）",
        outs.every((o) => o === outs[0]) && JSON.parse(outs[0])[d] === [id + "2", id2 + "1"].sort().join(""), outs[0]);
    } else check("4-7 （同じ日の2件目が作れなかった）", false, { d, d2 });
    const xa = archiveOf(A5), xb = archiveOf(mk(7, "B")), sa = J(xa), sb = J(xb);
    LA.unionArchives(xa, xb);
    check("4-8 和集合は入力の archive を変更しない", J(xa) === sa && J(xb) === sb);
  });

  section("[5] synthetic archive：archive＋生ログの集計（重複は archive 側を正）", () => {
    const logs = Array.from({ length: 100 }, (_, i) => rawLog("keiryo", i));
    const expectRate = (l) => ({ n: l.length, c: l.filter((r) => r.isCorrect).length, rv: l.filter((r) => r.mode === "review" || r.mode === "dueReview").length,
      rvc: l.filter((r) => (r.mode === "review" || r.mode === "dueReview") && r.isCorrect).length });
    const stat = (s) => { const l = LA.countableLog(s); return expectRate(l); };
    const truth = expectRate(logs);
    check("5-A archive だけ 100件 → 100件として回答数・正解数・復習の数も一致", J(stat({ answerLog: [], logArchive: archiveOf(logs) })) === J(truth), stat({ answerLog: [], logArchive: archiveOf(logs) }));
    check("5-B 生ログだけ 100件 → 生ログのまま", J(stat({ answerLog: logs })) === J(truth));
    check("5-C archive 50＋生ログ 50（重複なし）→ 100件", J(stat({ answerLog: logs.slice(50), logArchive: archiveOf(logs.slice(0, 50)) })) === J(truth));
    const d = stat({ answerLog: logs.slice(30, 80), logArchive: archiveOf(logs.slice(0, 50)) });
    check("5-D archive 50（0〜49）＋生ログ 50（30〜79）で20件重複 → 80件", J(d) === J(expectRate(logs.slice(0, 80))), d);
    const r = rawLog("keiryo", 3, { isCorrect: true, mode: "review" });
    const day = LA.jstDayKey(r.timestamp), id = LA.eventId(r);
    const e = LA.countableLog({ answerLog: [r], logArchive: { [day]: id + "0" + id + "3" } });
    check("5-E 同じ ID で flag だけ違う archive（0 と 3）＋同じ生ログ → 1件・誤答・review でない", e.length === 1 && e[0].isCorrect === false && e[0].mode === "normal" && e[0].archived === true, e);
    // 各ページの集計に反映される（archive だけの単元）
    const R = readers("new");
    const store = { kyotsu_app_v14_keiryo: J(unitData("keiryo", [], { logArchive: archiveOf(logs) })) };
    const cal = R.calendar(store);
    const calN = Object.values(cal).reduce((s, v) => s + v.attempts, 0), calC = Object.values(cal).reduce((s, v) => s + v.correct, 0);
    check("5-F calendar：archive だけで日別の回答数・正解数・単元別内訳が 100件ぶん", calN === 100 && calC === truth.c &&
      Object.values(cal).every((v) => v.byUnit.keiryo && v.byUnit.keiryo.attempts === v.attempts));
    const p = R.progress(store).find((x) => x.unit === "keiryo");
    check("5-G progress：回答数・正解数・最終学習日は archive から、解いた問題数は questionHistory（今回は空なので0）",
      p.attempts === 100 && p.correct === truth.c && p.lastTs === logs[99].timestamp && p.answeredCount === 0, p);
    const s = R.strength(store).find((x) => x.unit === "keiryo");
    check("5-H unit-strength：archive から 100件", s.attempts === 100 && s.correct === truth.c);
    const rep = R.cross(store);
    check("5-I crossunit：全体サマリの総回答数は 100、分析部分（誤答タグ）は生ログだけ（0件）",
      rep.includes("総回答数: 100 回") && rep.includes("誤答 0 回の内訳"), rep.slice(0, 600));
  });

  console.log("\n[6] archive が無いデータでは HEAD（変更前）と全集計が同じ");
  if (!headOk || !head("calendar.js")) { console.log("  （git が無いので省略）"); }
  else {
    const H = readers("head"), N = readers("new");
    for (let t = 0; t < 5; t++) {
      const store = realisticStore();
      const now = BASE + 30 * DAY;
      check("6-" + t + "a calendar", J(H.calendar(store)) === J(N.calendar(store)));
      check("6-" + t + "b progress", J(H.progress(store)) === J(N.progress(store)));
      check("6-" + t + "c unit-strength", J(H.strength(store)) === J(N.strength(store)));
      check("6-" + t + "d crossunit レポート全文", H.cross(store) === N.cross(store));
      const hs = await H.summary(store, now), ns = await N.summary(store, now);
      check("6-" + t + "e buildSummary / dailyquest 過去分の日別件数", J(hs) === J(ns), { hs: hs.summary, ns: ns.summary });
    }
    const data = JSON.parse(realisticStore().kyotsu_app_v14_keiryo);
    check("6-5 復習モード正答率（app.js update）", reviewRateOf(head("app.js"), false, data) === reviewRateOf(read("app.js"), true, data), reviewRateOf(read("app.js"), true, data));
  }

  await (async () => {
    console.log("\n[7] archive＋生ログ（重複あり）の各集計");
    try {
      const logs = Array.from({ length: 60 }, (_, i) => rawLog("keiryo", i));
      const full = { kyotsu_app_v14_keiryo: J(unitData("keiryo", logs)) };
      const split = { kyotsu_app_v14_keiryo: J(unitData("keiryo", logs.slice(20), { logArchive: archiveOf(logs.slice(0, 40)) })) };
      const N = readers("new");
      check("7-1 calendar：archive 0〜39＋生ログ 20〜59 は、全部生ログのときと同じ", J(N.calendar(full)) === J(N.calendar(split)));
      const pf = N.progress(full), ps = N.progress(split);
      check("7-2 progress：回答数・正解数・最終学習日・解いた問題数が同じ", J(pf) === J(ps));
      check("7-3 unit-strength が同じ", J(N.strength(full)) === J(N.strength(split)));
      const now = BASE + 30 * DAY;
      const sf = await N.summary(full, now), ss = await N.summary(split, now);
      check("7-4 buildSummary（totalCount / todayCount / lastStudiedAt）と dailyquest 過去分が同じ", J(sf) === J(ss), { sf: sf.summary, ss: ss.summary });
      const today = { kyotsu_app_v14_keiryo: J(unitData("keiryo", [rawLog("keiryo", 1, { timestamp: now - 60000 }), rawLog("keiryo", 2, { timestamp: now - 120000 })], { logArchive: archiveOf(logs.slice(0, 40)) })) };
      const st = (await N.summary(today, now)).summary;
      check("7-5 todayCount は今日のぶんだけ（archive の古い日は入らない）", st.todayCount === 2 && st.totalCount === 42 && st.lastStudiedAt === now - 60000, st);
      const cf = N.cross(full), cs = N.cross(split);
      const sumPart = (s) => s.slice(0, s.indexOf("【ミスの傾向"));
      check("7-6 crossunit：全体サマリ・単元別は同じ", sumPart(cf) === sumPart(cs));
      check("7-7 crossunit：分析部分（ミスの傾向以降）は生ログ（20〜59）だけ", cs.slice(cs.indexOf("【ミスの傾向")) ===
        N.cross({ kyotsu_app_v14_keiryo: J(unitData("keiryo", logs.slice(20))) }).slice(cs.indexOf("【ミスの傾向") >= 0 ? N.cross({ kyotsu_app_v14_keiryo: J(unitData("keiryo", logs.slice(20))) }).indexOf("【ミスの傾向") : 0));
      const dataFull = unitData("keiryo", logs), dataSplit = unitData("keiryo", logs.slice(20), { logArchive: archiveOf(logs.slice(0, 40)) });
      check("7-8 復習モード正答率が同じ", reviewRateOf(read("app.js"), true, dataFull) === reviewRateOf(read("app.js"), true, dataSplit), [reviewRateOf(read("app.js"), true, dataFull), reviewRateOf(read("app.js"), true, dataSplit)]);
    } catch (e) { check("例外なく実行できる", false, String(e && e.stack).split("\n").slice(0, 3).join(" ")); }
  })();

  section("[8] AI分析は生ログだけ（archive の有無で変わらない）", () => {
    const appSrc = read("app.js");
    const analyze = new Function(slice(appSrc, "const TAG_LABELS", "/* =========================\n   図形問題用SVG図") +
      slice(appSrc, "function tagLabel", "function renderInsightsPanel") + "\nreturn analyzeLog;")();
    const logs = Array.from({ length: 40 }, (_, i) => rawLog("keiryo", i));
    check("8-1 analyzeLog は answerLog だけを見る（archive を足しても同じ結果）", J(analyze(logs)) === J(analyze(LA.countableLog({ answerLog: logs }))));
    check("8-2 app.js の analyzeLog / buildAnalysisReport / 直近誤答は state.answerLog のまま",
      /analyzeLog\(state\.answerLog\)/.test(appSrc) && /const wrongs = state\.answerLog\.filter/.test(appSrc) && !/analyzeLog\([^)]*countable/.test(appSrc));
  });

  section("[9] merge：同じ世代は和集合、世代違いは新しい世代だけ", () => {
    const logs = Array.from({ length: 30 }, (_, i) => rawLog("keiryo", i));
    const a = unitData("keiryo", logs.slice(20), { logArchive: archiveOf(logs.slice(0, 10)) });
    const b = unitData("keiryo", logs.slice(25), { logArchive: archiveOf(logs.slice(5, 15)) });
    const m1 = mergeNew(C(a), C(b)), m2 = mergeNew(C(b), C(a));
    check("9-1 通常：archive は和集合（0〜14 の 15件）・正規形・順番に依存しない",
      countArc(m1.state.logArchive) === 15 && J(m1.state.logArchive) === J(archiveOf(logs.slice(0, 15))) && J(m1.state.logArchive) === J(m2.state.logArchive));
    check("9-2 片側 null でも archive は残る（正規形）", J(mergeNew(C(a), null).state.logArchive) === J(a.state.logArchive) && J(mergeNew(null, C(b)).state.logArchive) === J(b.state.logArchive));
    const messy = C(a); messy.state.logArchive = { [Object.keys(a.state.logArchive)[0]]: Object.values(a.state.logArchive)[0] + "zz", bad: 1 };
    check("9-3 片側 null の壊れた archive は正規形にそろう", J(mergeNew(messy, null).state.logArchive) === J({ [Object.keys(a.state.logArchive)[0]]: Object.values(a.state.logArchive)[0] }));
    const plain = unitData("keiryo", logs.slice(20));
    const mp = mergeNew(C(plain), C(unitData("keiryo", logs.slice(25))));
    check("9-4 どちらにも archive が無ければキーを作らない（今の出力と同じ）", !("logArchive" in mp.state) && !("logArchive" in mergeNew(C(plain), null).state));
    check("9-5 片側だけ archive あり → そのまま残る", J(mergeNew(C(plain), C(b)).state.logArchive) === J(b.state.logArchive) && J(mergeNew(C(b), C(plain)).state.logArchive) === J(b.state.logArchive));
    const g1 = unitData("keiryo", [], { resetGen: 1 });
    const r1 = mergeNew(C(a), C(g1)), r2 = mergeNew(C(g1), C(a));
    check("9-6 resetGen 世代違い：新しい世代（archive 無し）を採用し、古い世代の archive は戻らない", !("logArchive" in r1.state) && J(r1) === J(r2));
    const g1a = unitData("keiryo", [], { resetGen: 1, logArchive: archiveOf(logs.slice(0, 3)) });
    check("9-7 resetGen 世代違い：新しい世代の archive だけが残る", J(mergeNew(C(a), C(g1a)).state.logArchive) === J(archiveOf(logs.slice(0, 3))));
    const empty = unitData("keiryo", logs.slice(20), { logArchive: {} });
    check("9-8 中身の無い archive はキーごと消える", !("logArchive" in mergeNew(C(empty), C(plain)).state));
  });

  section("[10] 旧コード（archive を知らない HEAD の merge）の LWW からの復旧", () => {
    const oldSrc = head("firebase-sync.js");
    if (!oldSrc) { console.log("  （git が無いので省略）"); return; }
    const mergeOld = loadMerge(oldSrc)({});
    const logs = Array.from({ length: 30 }, (_, i) => rawLog("keiryo", i));
    const newDev = unitData("keiryo", logs.slice(25), { logArchive: archiveOf(logs.slice(0, 20)) }); // 新しい端末：0〜19 を archive 済み
    const oldLocal = unitData("keiryo", logs.slice(0, 29), { logArchive: archiveOf(logs.slice(0, 5)) }); // 古いタブ：以前受け取った古い archive（0〜4）
    oldLocal.state.answerLog.push(rawLog("keiryo", 99, { timestamp: BASE + 400 * DAY })); // 古いタブの方が新しい回答を持つ
    const remote = mergeOld(C(oldLocal), C(newDev));
    check("10-1 旧コードの merge では archive が古いタブの版に巻き戻る（前提）", countArc(remote.state.logArchive) === 5);
    const back = mergeNew(C(newDev), C(remote));
    // 7B-2 以降は merge の最後に生ログの削減も走るので、archive は 0〜19 を含む（さらに古い生ログも archive へ移る）
    const want = archiveOf(logs.slice(0, 20));
    const covered = Object.keys(want).every((k) => { const have = LA.parseDay(back.state.logArchive[k]); return [...LA.parseDay(want[k]).keys()].every((id) => have.has(id)); });
    check("10-2 新コードの端末が次に merge すると、自分の archive との和集合で 0〜19 が戻る", covered);
    const cnt = LA.countableLog(back.state);
    check("10-3 旧コードが書き戻した生ログ（archive 済みのもの）は二重に数えない（0〜29 と 99 の 31件）", cnt.length === 31, cnt.length);
    const bOld = mergeOld(C(newDev), null);
    check("10-4 旧コードの片側 null でも archive は保持される（知らないフィールドとして残る）", J(bOld.state.logArchive) === J(newDev.state.logArchive));
  });

  section("[11] archive の生成は log-archive.js の compactUnitData だけ（save と merge から呼ぶ）", () => {
    const srcs = ["app.js", "firebase-sync.js", "crossunit.js", "calendar.js", "progress.js", "unit-strength.js"].map(read).join("\n");
    check("11-1 tokenOf（archive 生成）はテスト以外から呼ばれない", !/tokenOf\(/.test(srcs));
    check("11-2 compactUnitData を呼ぶのは app.js の save と firebase-sync.js の cleanLegacyFields の1か所ずつ",
      (read("app.js").match(/compactUnitData\(/g) || []).length === 1 && (read("firebase-sync.js").match(/compactUnitData\(/g) || []).length === 1);
    const logs = Array.from({ length: 10 }, (_, i) => rawLog("keiryo", i));
    const m = mergeNew(C(unitData("keiryo", logs.slice(0, 6))), C(unitData("keiryo", logs.slice(4))));
    check("11-3 保持条件の内側（10件）なら merge は生ログを削らず、archive も作らない", m.state.answerLog.length === 10 && !("logArchive" in m.state));
  });

  console.log("\n結果: " + pass + " OK / " + fail + " NG");
  process.exit(fail ? 1 : 0);
})();
