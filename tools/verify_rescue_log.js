// -*- coding: utf-8 -*-
// verify_rescue_log.js
// Phase 7B-1.5: Phase 2 救済用の失敗時刻 rescueLog（log-archive.js, schema v1）の回帰テスト。
//  ・schema（9文字 base36 の epoch ミリ秒）・正規形・壊れたデータ
//  ・merge（同じ世代は問題ごとの和集合、世代違いは新しい世代だけ、片側 null も正規化）
//  ・Phase 2 救済が「生ログの失敗＋rescueLog」から卒業後で最初の失敗を使うこと
//  ・救済済み・復習が進んだ reviewMeta が巻き戻らないこと
//  ・刈り込み（卒業時刻以前だけ消す）・再卒業・stale 端末・旧コード（7B-1）の LWW からの復旧
//  ・rescueLog が無いデータでは merge 結果が HEAD（7B-1）と完全に同じ
//  ・7B-1.5 では rescueLog を作らない
//
//   node tools/verify_rescue_log.js

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DIR = path.join(__dirname, "..");
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));
const LA = require(path.join(DIR, "log-archive.js"));
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8").replace(/\r\n/g, "\n");
let OLD_SYNC = null;
// 比較の基準は rescueLog を知らない 7B-1 本番版（50eeb32）に固定する
try { OLD_SYNC = execSync("git show 50eeb32:firebase-sync.js", { cwd: DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n"); } catch (e) { /* git 無し */ }

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail).slice(0, 500) : "")); }
}
function section(title, fn) {
  console.log("\n" + title);
  try { fn(); } catch (e) { check("例外なく実行できる", false, String(e && e.stack || e).split("\n").slice(0, 3).join(" ")); }
}
function loadMerge(src, g) {
  const s = src.indexOf("function freshness");
  const e = src.indexOf("/* =========================================================\n   Firestore 入出力", s);
  return new Function("globalThis", src.slice(s, e) + "\nreturn mergeUnitData;")(g);
}
const mergeNew = loadMerge(read("firebase-sync.js"), { LogArchive: LA });
const mergeOld = OLD_SYNC ? loadMerge(OLD_SYNC, { LogArchive: LA }) : null; // 7B-1 本番版（rescueLog を知らない）

const DAY = 86400000;
const T0 = Date.UTC(2026, 8, 1);
const T1 = T0 + 10 * DAY, T2 = T0 + 12 * DAY, T3 = T0 + 15 * DAY, T4 = T0 + 30 * DAY, T5 = T0 + 33 * DAY;
const X = "ky1-1", Y = "ky1-2";
const tok = (...ts) => ts.map(LA.rescueTsToken).join("");
const fail_ = (id, ts, outcome) => ({ questionId: id, timestamp: ts, outcome: outcome || "answered", isCorrect: false, selectedIndex: 1, selectedText: "b", mode: "normal" });
const ok_ = (id, ts) => ({ questionId: id, timestamp: ts, outcome: "answered", isCorrect: true, selectedIndex: 0, selectedText: "a", mode: "normal" });
function unit(o) {
  return {
    state: Object.assign({ unit: "kyokusen", wrong: [], reviewMeta: {}, answerLog: [], history: [] }, o || {}),
    stats: { questionHistory: {} }
  };
}
// 端末A：X を T1 に卒業（wrong / reviewMeta から外れ、graduatedAt に記録）
const devA = (extra) => unit(Object.assign({ graduatedAt: { [X]: T1 }, answerLog: [ok_(X, T1)] }, extra || {}));
// 端末B：卒業を知らない。X の reviewMeta は卒業前のまま、wrong にも残る。卒業後の失敗 T2 は生ログから archive へ移り、rescueLog にだけ残っている
const devB = (extra) => unit(Object.assign({
  wrong: [{ id: X }], reviewMeta: { [X]: { streak: 3, dueAt: T0, lastSeenAt: T0 } },
  answerLog: [ok_(Y, T4)], rescueLog: { [X]: tok(T2) }
}, extra || {}));

section("[1] schema：9文字の epoch ミリ秒（テストベクタ）", () => {
  const vectors = [
    ["現在付近", 1790294400000, "0mug72800"],
    ["2030-01-01", Date.UTC(2030, 0, 1), "0o5uatc00"],
    ["2059 付近（36^8 = 8文字の上限を超える）", Math.pow(36, 8), "100000000"],
    ["2059-12-31 23:59:59.999", Date.UTC(2059, 11, 31, 23, 59, 59, 999), "108qqi2nz"],
    ["2100-01-01", Date.UTC(2100, 0, 1), "1gcmxpmo0"],
    ["上限 36^9-1（Number の安全な整数範囲内）", Math.pow(36, 9) - 1, "zzzzzzzzz"],
    ["最小 1", 1, "000000001"]
  ];
  vectors.forEach(([name, ts, t]) => {
    const got = LA.rescueTsToken(ts);
    check("1 " + name + "：" + ts + " → " + t + " → 元の値", got === t && got.length === 9 && [...LA.parseRescueTimes(got)][0] === ts, got);
  });
  check("1-8 表せない値は token にしない（0・負・小数・36^9・NaN・文字列）",
    [0, -1, 1.5, Math.pow(36, 9), NaN, Infinity, "1790294400000", null].every((v) => LA.rescueTsToken(v) === null));
});

section("[2] 正規形", () => {
  const a = { [X]: tok(T3, T2, T3), [Y]: tok(T1) };
  const b = { [Y]: tok(T1), [X]: tok(T2) + tok(T3) };
  const n1 = LA.normalizeRescueLog(a), n2 = LA.normalizeRescueLog(b);
  check("2-1 入力順・重複が違っても同じ文字列（重複なし・昇順・区切りなし）", J(n1) === J(n2) && n1[X] === tok(T2, T3), n1);
  check("2-2 問題キーの順も一定", J(Object.keys(n1)) === J([X, Y].sort()));
  check("2-3 空になった問題はキーごと消える", J(LA.normalizeRescueLog({ [X]: "", [Y]: tok(T1) })) === J({ [Y]: tok(T1) }));
  const u1 = LA.unionRescueLogs(a, { [X]: tok(T5) }), u2 = LA.unionRescueLogs({ [X]: tok(T5) }, a);
  check("2-4 和集合は順番に依存せず、何度やっても同じ", J(u1) === J(u2) && J(LA.unionRescueLogs(u1, u1, a)) === J(u1) && u1[X] === tok(T2, T3, T5));
  const sa = J(a);
  LA.unionRescueLogs(a, b);
  check("2-5 入力を変更しない", J(a) === sa);
});

section("[3] 壊れたデータで throw しない（不正な token だけ無視）", () => {
  const good = tok(T2);
  const cases = [
    ["rescueLog が null", null, {}],
    ["rescueLog が文字列", "abc", {}],
    ["rescueLog が配列", [good], {}],
    ["値が数値", { [X]: 123 }, {}],
    ["9の倍数でない末尾は無視", { [X]: good + "0ab" }, { [X]: good }],
    ["base36 でない文字（大文字・記号）", { [X]: good.toUpperCase() + "-00000001" + good }, { [X]: good }],
    ["0 は無効", { [X]: "000000000" + good }, { [X]: good }],
    ["空の問題 ID は無視", { "": good, [X]: good }, { [X]: good }]
  ];
  cases.forEach(([name, input, expected], i) => {
    let out, err = null;
    try { out = LA.normalizeRescueLog(input); } catch (e) { err = e; }
    check("3-" + (i + 1) + " " + name, !err && J(out) === J(expected), err ? String(err) : out);
  });
  let err = null;
  try { mergeNew(devA(), devB({ rescueLog: { [X]: 5, [Y]: "zz" } })); mergeNew(devB({ rescueLog: "x" }), null); } catch (e) { err = e; }
  check("3-9 merge も壊れた rescueLog で throw しない", !err, String(err));
});

section("[4] merge", () => {
  const a = devA({ rescueLog: { [Y]: tok(T3) } }), b = devB({ rescueLog: { [X]: tok(T2), [Y]: tok(T3, T5) } });
  const m1 = mergeNew(C(a), C(b)), m2 = mergeNew(C(b), C(a));
  check("4-1 同じ世代：問題ごとの和集合・正規形・順番に依存しない", J(m1.state.rescueLog) === J(m2.state.rescueLog) &&
    m1.state.rescueLog[Y] === tok(T3, T5) && m1.state.rescueLog[X] === tok(T2), m1.state.rescueLog);
  check("4-2 冪等（merge 結果同士をもう一度 merge しても同じ）", J(mergeNew(C(m1), C(m1)).state.rescueLog) === J(m1.state.rescueLog) &&
    J(mergeNew(C(m1), C(b)).state.rescueLog) === J(m1.state.rescueLog));
  const messy = devB({ rescueLog: { [X]: tok(T3, T2, T2) + "0a", bad: 5 } });
  check("4-3 片側 null でも正規化される", J(mergeNew(C(messy), null).state.rescueLog) === J({ [X]: tok(T2, T3) }) &&
    J(mergeNew(null, C(messy)).state.rescueLog) === J({ [X]: tok(T2, T3) }));
  const g1 = unit({ resetGen: 1, answerLog: [ok_(Y, T0)] });
  const r1 = mergeNew(C(b), C(g1)), r2 = mergeNew(C(g1), C(b));
  check("4-4 resetGen 世代違い：新しい世代（rescueLog 無し）を採用し、古い世代の rescueLog は戻らない", !("rescueLog" in r1.state) && J(r1) === J(r2));
  const g1r = unit({ resetGen: 1, rescueLog: { [Y]: tok(T5) } });
  check("4-5 resetGen 世代違い：新しい世代の rescueLog だけが残る", J(mergeNew(C(b), C(g1r)).state.rescueLog) === J({ [Y]: tok(T5) }));
  check("4-6 どちらにも無ければキーを作らない", !("rescueLog" in mergeNew(devA(), devA({ answerLog: [ok_(Y, T4)] })).state));
});

section("[5] Phase 2 救済：生ログの失敗＋rescueLog から、卒業後で最初の失敗", () => {
  const m = mergeNew(C(devA()), C(devB())), mr = mergeNew(C(devB()), C(devA()));
  check("5-1 生ログに無く rescueLog にだけある T2 で救済（streak 0 / dueAt T2 / lastSeenAt null）",
    J(m.state.reviewMeta[X]) === J({ streak: 0, dueAt: T2, lastSeenAt: null }) && m.state.graduatedAt[X] === T1, m.state.reviewMeta);
  check("5-2 X は wrong に戻る（wrong の復帰条件は今までどおり）", m.state.wrong.some((w) => w.id === X));
  check("5-3 引数順に依存しない", J(m) === J(mr));
  const noR = mergeNew(C(devA()), C(devB({ rescueLog: undefined })));
  check("5-4 （比較）rescueLog が無いと救済されない＝7B-2 の反例", !noR.state.reviewMeta[X] && !noR.state.wrong.some((w) => w.id === X));
  const mix = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T3) }, answerLog: [ok_(Y, T4), fail_(X, T2, "timeout")] })));
  check("5-5 生ログの T2（timeout）と rescueLog の T3 → 早い T2", mix.state.reviewMeta[X].dueAt === T2);
  const mix2 = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T2) }, answerLog: [ok_(Y, T4), fail_(X, T3, "skip")] })));
  check("5-6 rescueLog の T2 と生ログの T3（skip）→ 早い T2", mix2.state.reviewMeta[X].dueAt === T2);
  const eq = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T1, T0) } })));
  check("5-7 卒業時刻と同じ・前の失敗では救済しない（厳密に後だけ）", !eq.state.reviewMeta[X]);
  const plus1 = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T1 + 1) } })));
  check("5-8 卒業時刻の 1ms 後なら救済", plus1.state.reviewMeta[X] && plus1.state.reviewMeta[X].dueAt === T1 + 1);
  const notGrad = mergeNew(C(devA({ graduatedAt: {} })), C(devB({ rescueLog: { [X]: tok(T2) } })));
  check("5-9 卒業していない問題の reviewMeta は rescueLog で変わらない", J(notGrad.state.reviewMeta[X]) === J({ streak: 3, dueAt: T0, lastSeenAt: T0 }));
});

section("[6] 救済済み・復習が進んだ reviewMeta は巻き戻らない", () => {
  const m1 = mergeNew(C(devA()), C(devB()));
  check("6-0 前提：T2 で救済された", m1.state.reviewMeta[X].dueAt === T2);
  // その後、復習で1回正解して T3 の状態へ進む（回答ログも増える）
  const progressed = C(m1);
  progressed.state.reviewMeta[X] = { streak: 1, dueAt: T3 + DAY, lastSeenAt: T3 };
  progressed.state.answerLog.push(ok_(X, T3));
  const stillOld = devB(); // 同じ rescueLog T2 を持った古いデータ
  const r1 = mergeNew(C(progressed), C(stillOld)), r2 = mergeNew(C(stillOld), C(progressed));
  check("6-1 同じ rescueLog T2 と再 merge しても reviewMeta は T3 の状態のまま（両方の順番）",
    J(r1.state.reviewMeta[X]) === J({ streak: 1, dueAt: T3 + DAY, lastSeenAt: T3 }) && J(r2.state.reviewMeta[X]) === J(r1.state.reviewMeta[X]), [r1.state.reviewMeta[X], r2.state.reviewMeta[X]]);
  const r3 = mergeNew(C(r1), C(devA()));
  check("6-2 さらに merge を重ねても変わらない", J(r3.state.reviewMeta[X]) === J(r1.state.reviewMeta[X]));
  check("6-3 救済直後の reviewMeta（dueAt T2）も、再 merge で同じまま", J(mergeNew(C(m1), C(devB())).state.reviewMeta[X]) === J({ streak: 0, dueAt: T2, lastSeenAt: null }));
});

section("[7] 刈り込み：卒業時刻以前の失敗だけ消す", () => {
  const m = mergeNew(C(devA()), C(devB()));
  check("7-1 卒業（T1）より後の T2 は残る（reviewMeta の dueAt が T2 でも消さない）", m.state.rescueLog && m.state.rescueLog[X] === tok(T2));
  const mixed = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T0, T1, T2), [Y]: tok(T3) } })));
  check("7-2 T0・T1（卒業時刻以前）は消え、T2 と卒業していない問題の失敗は残る",
    mixed.state.rescueLog[X] === tok(T2) && mixed.state.rescueLog[Y] === tok(T3), mixed.state.rescueLog);
  const allOld = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T0, T1) } })));
  check("7-3 全部消えたら rescueLog キーごと消える", !("rescueLog" in allOld.state));
  check("7-4 片側 null でも、その側の graduatedAt で刈り込む", J(mergeNew(C(devA({ rescueLog: { [X]: tok(T0, T2) } })), null).state.rescueLog) === J({ [X]: tok(T2) }));
});

section("[8] 再卒業", () => {
  let d = mergeNew(C(devA()), C(devB({ rescueLog: { [X]: tok(T2, T3) } })));
  check("8-1 卒業 T1 のあとの失敗 T2・T3 → dueAt は最初の T2、rescueLog には両方", d.state.reviewMeta[X].dueAt === T2 && d.state.rescueLog[X] === tok(T2, T3));
  // 復習して T4 に再卒業
  d = C(d);
  delete d.state.reviewMeta[X];
  d.state.wrong = d.state.wrong.filter((w) => w.id !== X);
  d.state.graduatedAt[X] = T4;
  d.state.answerLog.push(ok_(X, T4));
  const g = mergeNew(C(d), C(devB({ rescueLog: { [X]: tok(T2, T3) } })));
  check("8-2 再卒業 T4 > T2・T3 → T2・T3 は rescueLog から消え、救済もされない", !("rescueLog" in g.state) && !g.state.reviewMeta[X] && g.state.graduatedAt[X] === T4, g.state.rescueLog);
  const later = mergeNew(C(g), C(devB({ rescueLog: { [X]: tok(T2, T3, T5) } })));
  check("8-3 その後 T5 で失敗 → T5 だけが残り、dueAt は T5", later.state.rescueLog[X] === tok(T5) && later.state.reviewMeta[X].dueAt === T5, later.state.rescueLog);
});

section("[9] stale 端末：生ログの失敗と rescueLog が重なっても二重にならない", () => {
  const fresh = devA({ rescueLog: { [X]: tok(T2) } });
  const stale = devB({ rescueLog: undefined, answerLog: [ok_(Y, T4), fail_(X, T0 + DAY), fail_(X, T2), fail_(X, T5, "timeout")] });
  const m1 = mergeNew(C(fresh), C(stale)), m2 = mergeNew(C(stale), C(fresh));
  check("9-1 最初の失敗は T2（卒業前の失敗は無視、生ログと rescueLog の T2 は同じもの）", m1.state.reviewMeta[X].dueAt === T2 && J(m1) === J(m2));
  check("9-2 rescueLog は T2 の1件だけ（生ログの失敗は rescueLog に書かない＝7B-1.5 では生成しない）", m1.state.rescueLog[X] === tok(T2));
  const both = mergeNew(C(devB({ rescueLog: { [X]: tok(T2, T5) } })), C(devA({ rescueLog: { [X]: tok(T5, T2) } })));
  check("9-3 両端末が同じ時刻を持っていても rescueLog は重複しない", both.state.rescueLog[X] === tok(T2, T5));
});

section("[10] 旧コード（7B-1 本番版）の LWW からの復旧", () => {
  if (!mergeOld) { console.log("  （git が無いので省略）"); return; }
  const newDev = devB({ rescueLog: { [X]: tok(T2, T3) } });
  const oldTab = devB({ rescueLog: { [X]: tok(T2) }, answerLog: [ok_(Y, T4), ok_(Y, T5)] }); // 以前受け取った古い版＋新しい回答
  const remote = mergeOld(C(oldTab), C(newDev));
  check("10-1 前提：7B-1 の merge では rescueLog は知らないフィールドとして新しい側（古いタブ）の版に巻き戻る", remote.state.rescueLog[X] === tok(T2), remote.state.rescueLog);
  const back = mergeNew(C(newDev), C(remote));
  check("10-2 7B-1.5 の端末が次に merge すると、和集合で T2・T3 に戻る", back.state.rescueLog[X] === tok(T2, T3));
  check("10-3 7B-1 の片側 null でも rescueLog は保持される", J(mergeOld(C(newDev), null).state.rescueLog) === J(newDev.state.rescueLog));
});

section("[11] rescueLog が無いデータでは HEAD（7B-1 本番版）と merge 結果が完全に同じ", () => {
  if (!mergeOld) { console.log("  （git が無いので省略）"); return; }
  let seed = 99;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const ids = ["a", "b", "c", "d"];
  const randData = () => {
    const rm = {}, ga = {}, log = [];
    ids.forEach((id) => { if (rnd(2)) rm[id] = { streak: rnd(4), dueAt: rnd(3000), lastSeenAt: rnd(2) ? rnd(3000) : null }; if (rnd(3) === 0) ga[id] = rnd(3000); });
    for (let i = 0, n = rnd(6); i < n; i++) log.push({ questionId: ids[rnd(4)], timestamp: 1 + rnd(3000), outcome: ["answered", "timeout", "skip"][rnd(3)], isCorrect: !!rnd(2), selectedIndex: rnd(3), selectedText: "t" });
    const d = unit({ reviewMeta: rm, answerLog: log, wrong: ids.filter(() => rnd(2)).map((id) => ({ id })) });
    if (rnd(2)) d.state.graduatedAt = ga;
    if (rnd(6) === 0) d.state.resetGen = rnd(2);
    if (rnd(5) === 0) d.state.logArchive = {};
    return d;
  };
  let diff = 0, first = null;
  for (let i = 0; i < 20000; i++) {
    const x = rnd(8) === 0 ? null : randData(), y = rnd(8) === 0 ? null : randData();
    if (!x && !y) continue;
    // Phase 7C 以降は、生ログから欠けている questionHistory を補う。7B-1 の結果に同じ補完をかけたものと比べる
    const old = mergeOld(C(x), C(y));
    const qhF = LA.backfillQuestionHistory(old.stats.questionHistory, old.state.answerLog);
    if (qhF !== old.stats.questionHistory) old.stats.questionHistory = qhF;
    const a = J(mergeNew(C(x), C(y))), b = J(old);
    if (a !== b) { diff++; if (!first) first = { x, y, a, b }; }
  }
  check("11-1 ランダム 20000 ケース：merge 結果（answerLog・wrong・reviewMeta・graduatedAt・救済を含む全体）が 7B-1＋questionHistory 補完と完全一致", diff === 0, first);
});

section("[12] rescueLog の生成は log-archive.js の compactUnitData だけ", () => {
  const srcs = ["app.js", "firebase-sync.js", "crossunit.js", "calendar.js", "progress.js", "unit-strength.js"].map(read).join("\n");
  check("12-1 rescueTsToken（rescueLog の生成）は本番コードから呼ばれない", !/rescueTsToken\(/.test(srcs));
  check("12-2 merge で rescueLog を足すのは和集合（mergedFields）の1か所だけ", (srcs.match(/mergedFields\.rescueLog\s*=/g) || []).length === 1);
  const m = mergeNew(unit({ answerLog: [fail_(X, T2)], graduatedAt: { [X]: T1 }, reviewMeta: { [X]: { streak: 2, dueAt: T0, lastSeenAt: T0 } } }), unit({ answerLog: [ok_(Y, T0)] }));
  check("12-3 保持条件の内側の生ログの失敗で救済しても rescueLog は作らない", !("rescueLog" in m.state) && m.state.reviewMeta[X].dueAt === T2);
});

console.log("\n結果: " + pass + " OK / " + fail + " NG");
process.exit(fail ? 1 : 0);
