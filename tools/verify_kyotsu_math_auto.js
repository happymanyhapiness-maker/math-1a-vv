// -*- coding: utf-8 -*-
// verify_kyotsu_math_auto.js
// kyotsu-math → Daily Quest 連携（kyotsuMathAuto方式）の最小回帰テスト。
// firebase-sync.js から pushDailyQuestToday / backfillDailyQuestLogs / todayKeyJST を
// 実ソースのまま取り出し、vmで実行する。unitKeys/readLocal/countableLog（学習ログの集計、
// 今回変更していない部分）と Firestore はテスト用のスタブに差し替える。
// 本物のFirebaseには一切アクセスしない。
//
//   node tools/verify_kyotsu_math_auto.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "firebase-sync.js"), "utf8");

function extractFunction(name) {
  let start = src.indexOf("async function " + name + "(");
  if (start < 0) start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error(name + " が見つからない");
  let i = src.indexOf("{", start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

let failed = 0, passed = 0;
function check(label, cond, extra) {
  if (cond) { passed++; console.log("  OK  " + label); }
  else { failed++; console.error("  NG  " + label, extra !== undefined ? extra : ""); }
}

const CHILD_UID = "hjWTc7Ll0UeHv5iKbRTlTLRrY8x1";
const GUARDIAN_UID = "eVm3klGUSpcxRPtxN7NHo4lYx7f2";
const DQ_PATH = "dailyquest-logs/" + CHILD_UID;
// 備考：kyotsu-mathの役割モデルは guardian（保護者・閲覧専用） / それ以外はすべて
// learner として自分のuid配下へ書き込む設計（LearningScopeのような
// child/parent/unauthorized/guestの4分類は無い）。family外UIDを弾く境界は
// Firestore RulesとFirebase Authのアカウント発行そのものが担っており、
// アプリ側のrole判定はguardianか否かだけ（今回の移行でもこの仕様は維持する）。

// ---- Firestoreのmerge:trueは、ネストしたmapフィールドもキー単位で再帰的にマージする。
// 単純な{...old, ...new}のシャロー統合だとこの挙動を再現できないため、再帰merge関数を使う。
const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
function deepMergeFirestoreStyle(oldObj, newObj) {
  const result = { ...(oldObj || {}) };
  Object.keys(newObj || {}).forEach(k => {
    const oldVal = result[k];
    const newVal = newObj[k];
    result[k] = (isPlainObject(oldVal) && isPlainObject(newVal))
      ? deepMergeFirestoreStyle(oldVal, newVal)
      : newVal;
  });
  return result;
}

function makeContext({ initialDoc, uid, isGuardianUser, unitLogs = {} } = {}) {
  const docs = new Map();
  if (initialDoc) docs.set(DQ_PATH, JSON.parse(JSON.stringify(initialDoc)));
  const writes = [];

  const ctx = {
    console,
    Date, JSON, Math, Object, Array, String, Number, Error, Promise,
    currentUser: uid ? { uid } : null,
    ctxGen: 0,
    isGuardian: () => !!isGuardianUser,
    alive: (gen) => gen === ctx.ctxGen && !!ctx.currentUser,
    targetUid: () => {
      if (!ctx.currentUser) throw new Error("no-authenticated-context");
      return isGuardianUser ? CHILD_UID : ctx.currentUser.uid;
    },
    // 学習ログの集計（今回変更していない部分）はテスト用にスタブする。
    unitKeys: () => Object.keys(unitLogs),
    readLocal: (unit) => ({ state: { answerLog: unitLogs[unit] || [] } }),
    countableLog: (local) => (local && local.state && Array.isArray(local.state.answerLog)) ? local.state.answerLog : [],
    // ---- 偽Firestore ----
    db: {},
    doc: (_db, ...seg) => ({ path: seg.join("/") }),
    getDoc: async (ref) => ({
      exists: () => docs.has(ref.path),
      data: () => (docs.has(ref.path) ? JSON.parse(JSON.stringify(docs.get(ref.path))) : undefined)
    }),
    setDoc: async (ref, data, opts) => {
      writes.push({ path: ref.path, data: JSON.parse(JSON.stringify(data)), merge: !!(opts && opts.merge) });
      docs.set(ref.path, opts && opts.merge ? deepMergeFirestoreStyle(docs.get(ref.path), data) : JSON.parse(JSON.stringify(data)));
    }
  };
  vm.createContext(ctx);
  vm.runInContext(extractFunction("todayKeyJST"), ctx);
  vm.runInContext(extractFunction("pushDailyQuestToday"), ctx);
  vm.runInContext(extractFunction("backfillDailyQuestLogs"), ctx);
  return { ctx, docs, writes };
}

function todayKeyJSTNode() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

async function run() {
  const today = todayKeyJSTNode();

  console.log("\n[1] 今日分1日をkyotsuMathAutoへ保存する");
  {
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID });
    await vm.runInContext(`pushDailyQuestToday({ todayCount: 2 }, 0)`, ctx);
    const doc = docs.get(DQ_PATH);
    check("1-1 kyotsuMathAutoフィールドが書き込まれる", !!(doc && doc.kyotsuMathAuto), doc);
    check("1-2 今日の日付キーにcount:2が入る", doc.kyotsuMathAuto[today].count === 2, doc.kyotsuMathAuto);
    check("1-3 sourceはkyotsu-math", doc.kyotsuMathAuto[today].source === "kyotsu-math");
    check("1-4 dataフィールドは変更されない", doc.data === "{}");
  }

  console.log("\n[2] 同日への再実行は重複せず、同じ日付キーを更新するだけ");
  {
    const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID });
    await vm.runInContext(`pushDailyQuestToday({ todayCount: 3 }, 0)`, ctx);
    await vm.runInContext(`pushDailyQuestToday({ todayCount: 3 }, 0)`, ctx); // 同じ件数で再実行
    const doc = docs.get(DQ_PATH);
    check("2-1 日付キーは1つだけ", Object.keys(doc.kyotsuMathAuto).length === 1, doc.kyotsuMathAuto);
    const dqWrites = writes.filter(w => w.path === DQ_PATH);
    check("2-2 変化が無い2回目はsetDocを呼ばない（冪等）", dqWrites.length === 1, dqWrites);

    await vm.runInContext(`pushDailyQuestToday({ todayCount: 5 }, 0)`, ctx); // 件数が変わった再実行
    check("2-3 件数が変われば同じ日付キーを更新する", docs.get(DQ_PATH).kyotsuMathAuto[today].count === 5);
    check("2-4 日付キーはやはり1つだけ（重複しない）", Object.keys(docs.get(DQ_PATH).kyotsuMathAuto).length === 1);
  }

  console.log("\n[3] 複数日backfillで各日付キーが保存される");
  {
    const day1 = new Date("2026-09-01T01:00:00.000Z").getTime(); // JST 9/1 10:00
    const day2a = new Date("2026-09-02T01:00:00.000Z").getTime(); // JST 9/2 10:00
    const day2b = new Date("2026-09-02T02:00:00.000Z").getTime(); // JST 9/2 11:00
    const { ctx, docs } = makeContext({
      initialDoc: { data: "{}" }, uid: CHILD_UID,
      unitLogs: { u1: [{ timestamp: day1 }, { timestamp: day2a }, { timestamp: day2b }] }
    });
    const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
    check("3-1 ok:true", r.ok === true, r);
    check("3-2 2日分が更新される", r.updatedDays === 2, r);
    const doc = docs.get(DQ_PATH);
    check("3-3 2026-09-01はcount:1", doc.kyotsuMathAuto["2026-09-01"].count === 1);
    check("3-4 2026-09-02はcount:2", doc.kyotsuMathAuto["2026-09-02"].count === 2);
  }

  console.log("\n[4] 既存kyotsuMathAutoの別日付を保持する");
  {
    const { ctx, docs } = makeContext({
      initialDoc: { data: "{}", kyotsuMathAuto: { "2026-08-01": { date: "2026-08-01", source: "kyotsu-math", count: 9, updatedAt: 1 } } },
      uid: CHILD_UID,
      unitLogs: { u1: [{ timestamp: new Date("2026-09-02T01:00:00.000Z").getTime() }] }
    });
    await vm.runInContext("backfillDailyQuestLogs()", ctx);
    const doc = docs.get(DQ_PATH);
    check("4-1 既存の別日付キーは変化しない", doc.kyotsuMathAuto["2026-08-01"].count === 9, doc.kyotsuMathAuto);
    check("4-2 新しい日付キーが追加される", doc.kyotsuMathAuto["2026-09-02"].count === 1);
  }

  console.log("\n[5-7] data / leapAuto / eikomiAutoを変更しない");
  {
    const initialData = JSON.stringify({ days: { "2026-01-01": { quests: [{ label: "手動", done: true }] } }, appStartDate: "2026-01-01" });
    const { ctx, docs } = makeContext({
      initialDoc: {
        data: initialData,
        leapAuto: { "2026-08-01": { date: "2026-08-01", source: "leap", count: 5, updatedAt: 1 } },
        eikomiAuto: { "2026-08-01": { date: "2026-08-01", source: "eikomi", count: 7, updatedAt: 1 } }
      },
      uid: CHILD_UID,
      unitLogs: { u1: [{ timestamp: new Date("2026-09-02T01:00:00.000Z").getTime() }] }
    });
    await vm.runInContext("backfillDailyQuestLogs()", ctx);
    const doc = docs.get(DQ_PATH);
    check("5 dataフィールドは変更されない", doc.data === initialData);
    check("6 leapAutoは変更されない", JSON.stringify(doc.leapAuto) === JSON.stringify({ "2026-08-01": { date: "2026-08-01", source: "leap", count: 5, updatedAt: 1 } }));
    check("7 eikomiAutoは変更されない", JSON.stringify(doc.eikomiAuto) === JSON.stringify({ "2026-08-01": { date: "2026-08-01", source: "eikomi", count: 7, updatedAt: 1 } }));
  }

  console.log("\n[8] 未認証・書き込み対象外role（guardian）から書かない");
  {
    // guest（未認証）
    {
      const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}" }, uid: null, unitLogs: { u1: [{ timestamp: Date.now() }] } });
      const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
      check("8-1 guestはnot-childで拒否される", r.ok === false && r.reason === "not-child", r);
      check("8-2 guestはkyotsuMathAutoを書けない", !docs.get(DQ_PATH).kyotsuMathAuto);
      check("8-3 guestではsetDocが呼ばれない", writes.filter(w => w.path === DQ_PATH).length === 0);
    }
    // guardian（保護者・閲覧モード）
    {
      const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}" }, uid: GUARDIAN_UID, isGuardianUser: true, unitLogs: { u1: [{ timestamp: Date.now() }] } });
      const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
      check("8-4 guardianはnot-childで拒否される", r.ok === false && r.reason === "not-child", r);
      check("8-5 guardianはkyotsuMathAutoを書けない", !docs.get(DQ_PATH).kyotsuMathAuto);
      check("8-6 guardianではsetDocが呼ばれない", writes.filter(w => w.path === DQ_PATH).length === 0);
    }
  }

  console.log("\n[9] 正しい学習者（本人）のみ書き込み可能");
  {
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: { u1: [{ timestamp: new Date("2026-09-02T01:00:00.000Z").getTime() }] } });
    const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
    check("9-1 本人はok:true", r.ok === true, r);
    check("9-2 本人はkyotsuMathAutoを書ける", !!docs.get(DQ_PATH).kyotsuMathAuto);
  }

  console.log("\n[10] Daily Quest document未作成ならsetDoc0回・新規作成しない");
  {
    // pushDailyQuestToday経由
    {
      const { ctx, docs, writes } = makeContext({ initialDoc: null, uid: CHILD_UID }); // ドキュメント自体が無い
      await vm.runInContext(`pushDailyQuestToday({ todayCount: 3 }, 0)`, ctx);
      check("10-1 pushDailyQuestToday: setDocが0回", writes.filter(w => w.path === DQ_PATH).length === 0, writes);
      check("10-2 pushDailyQuestToday: documentが新規作成されない", !docs.has(DQ_PATH));
    }
    // backfillDailyQuestLogs経由
    {
      const { ctx, docs, writes } = makeContext({ initialDoc: null, uid: CHILD_UID, unitLogs: { u1: [{ timestamp: new Date("2026-09-02T01:00:00.000Z").getTime() }] } });
      const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
      check("10-3 backfillDailyQuestLogs: no-dailyquest-doc", r.ok === false && r.reason === "no-dailyquest-doc", r);
      check("10-4 backfillDailyQuestLogs: setDocが0回", writes.filter(w => w.path === DQ_PATH).length === 0, writes);
      check("10-5 backfillDailyQuestLogs: documentが新規作成されない", !docs.has(DQ_PATH));
    }
  }

  console.log("\n[11] 既存data内のautoSource:\"kyotsu-math\"を変更しない");
  {
    const initialData = JSON.stringify({
      days: { "2026-09-02": { quests: [{ label: "kyotsu-math（自動記録）（本日3問）", done: true, tag: "数学", autoSource: "kyotsu-math" }] } }
    });
    const { ctx, docs } = makeContext({
      initialDoc: { data: initialData }, uid: CHILD_UID,
      unitLogs: { u1: [{ timestamp: new Date("2026-09-02T01:00:00.000Z").getTime() }, { timestamp: new Date("2026-09-02T02:00:00.000Z").getTime() }] }
    });
    await vm.runInContext("backfillDailyQuestLogs()", ctx);
    const doc = docs.get(DQ_PATH);
    check("11-1 旧autoSourceエントリを含むdataは一切書き換えられない", doc.data === initialData);
    check("11-2 新kyotsuMathAuto側には正しい件数が書かれる", doc.kyotsuMathAuto["2026-09-02"].count === 2);
  }

  console.log(`\n合計: ${passed}件成功 / ${failed}件失敗`);
  if (failed > 0) process.exitCode = 1;
}

run();
