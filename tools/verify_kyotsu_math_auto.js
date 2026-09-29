// -*- coding: utf-8 -*-
// verify_kyotsu_math_auto.js
// kyotsu-math → Daily Quest 連携（kyotsuMathAuto方式）の回帰テスト。
// firebase-sync.js から buildSummary / dailyQuestWindowStart / planKyotsuAutoUpdates / syncKyotsuAuto /
// pushDailyQuestAuto / backfillDailyQuestLogs / todayKeyJST を実ソースのまま取り出し、vmで実行する。
// unitKeys/readLocal/countableLog（学習ログの集計）と Firestore はテスト用のスタブに差し替える。
// 時計は固定（既定は 2026-09-29 12:00 JST）。本物のFirebaseには一切アクセスしない。
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

// テスト用のダミーUID（本物のアカウントとは無関係）
const CHILD_UID = "testChildUid000000000000001";
const GUARDIAN_UID = "testGuardianUid0000000000001";
const DQ_PATH = "dailyquest-logs/" + CHILD_UID;
// アプリ側の role は guardian（閲覧専用）か learner（自分のuid配下へ書く）の2つだけ。

// 既定の「今」：2026-09-29 12:00 JST（9/28 の8問が翌日に同期された状況と同じ日）
const NOW_DEFAULT = Date.UTC(2026, 8, 29, 3, 0, 0);
const jstMs = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h - 9, mi || 0);   // JSTの日時 → epoch ms

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

function makeContext({ initialDoc, uid, isGuardianUser, unitLogs = {}, now = NOW_DEFAULT, getDocThrows = false } = {}) {
  const docs = new Map();
  if (initialDoc) docs.set(DQ_PATH, JSON.parse(JSON.stringify(initialDoc)));
  const writes = [];
  const state = { now, getDocCalls: 0 };

  // 固定時計（引数なしの new Date() と Date.now() だけが固定される）
  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(state.now); }
    static now() { return state.now; }
  }

  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Date: FakeDate, JSON, Math, Object, Array, String, Number, Error, Promise,
    currentUser: uid ? { uid } : null,
    ctxGen: 0,
    isGuardian: () => !!isGuardianUser,
    // 本人（CHILD_UID）だけが同期する。このテストの uid はダミーなので、保護者でないログインを本人役として扱う
    isLearner: () => !!ctx.currentUser && !isGuardianUser,
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
    getDoc: async (ref) => {
      state.getDocCalls++;
      if (getDocThrows) throw new Error("network");
      return {
        exists: () => docs.has(ref.path),
        data: () => (docs.has(ref.path) ? JSON.parse(JSON.stringify(docs.get(ref.path))) : undefined)
      };
    },
    setDoc: async (ref, data, opts) => {
      writes.push({ path: ref.path, data: JSON.parse(JSON.stringify(data)), merge: !!(opts && opts.merge) });
      docs.set(ref.path, opts && opts.merge ? deepMergeFirestoreStyle(docs.get(ref.path), data) : JSON.parse(JSON.stringify(data)));
    }
  };
  vm.createContext(ctx);
  vm.runInContext("var dqAutoCache = {};", ctx);
  ["todayKeyJST", "buildSummary", "dailyQuestWindowStart", "planKyotsuAutoUpdates", "syncKyotsuAuto", "pushDailyQuestAuto", "backfillDailyQuestLogs"]
    .forEach(name => vm.runInContext(extractFunction(name), ctx));
  return { ctx, docs, writes, state };
}

const push = ctx => vm.runInContext("pushDailyQuestAuto(buildSummary(), 0)", ctx);
const dqWrites = writes => writes.filter(w => w.path === DQ_PATH);
const logsOf = (...timestamps) => timestamps.map(t => ({ timestamp: t }));
const times = (n, base, step = 60000) => Array.from({ length: n }, (_, i) => base + i * step);

async function run() {
  console.log("\n[0] 対象期間：直近7日、ただし 2026-09-27 より前にはさかのぼらない");
  {
    const start = (nowMs) => { const { ctx } = makeContext({ now: nowMs }); return vm.runInContext("dailyQuestWindowStart()", ctx); };
    check("0-1 9/29 → 9/27（7日前の9/23は下限より前なので9/27）", start(jstMs(2026, 9, 29, 12)) === "2026-09-27", start(jstMs(2026, 9, 29, 12)));
    check("0-2 9/27 → 9/27", start(jstMs(2026, 9, 27, 0, 30)) === "2026-09-27");
    check("0-3 10/2 → 9/27（6日前の9/26は下限より前）", start(jstMs(2026, 10, 2, 9)) === "2026-09-27", start(jstMs(2026, 10, 2, 9)));
    check("0-4 10/3 → 9/27（ちょうど6日前が下限）", start(jstMs(2026, 10, 3, 9)) === "2026-09-27", start(jstMs(2026, 10, 3, 9)));
    check("0-5 10/10 → 10/4（下限より後は、直近7日＝今日を含めて7日）", start(jstMs(2026, 10, 10, 9)) === "2026-10-04", start(jstMs(2026, 10, 10, 9)));
    check("0-6 月をまたぐ 11/2 → 10/27", start(jstMs(2026, 11, 2, 9)) === "2026-10-27", start(jstMs(2026, 11, 2, 9)));
  }

  console.log("\n[1] 今日分をkyotsuMathAutoへ保存する");
  {
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: { u1: logsOf(jstMs(2026, 9, 29, 10), jstMs(2026, 9, 29, 11)) } });
    await push(ctx);
    const doc = docs.get(DQ_PATH);
    check("1-1 kyotsuMathAutoフィールドが書き込まれる", !!(doc && doc.kyotsuMathAuto), doc);
    check("1-2 今日の日付キーにcount:2が入る", doc.kyotsuMathAuto["2026-09-29"].count === 2, doc.kyotsuMathAuto);
    check("1-3 sourceはkyotsu-math", doc.kyotsuMathAuto["2026-09-29"].source === "kyotsu-math");
    check("1-4 dataフィールドは変更されない", doc.data === "{}");
  }

  console.log("\n[2] 同日への再実行は重複せず、増えたときだけ同じ日付キーを更新する");
  {
    const logs = { u1: logsOf(...times(3, jstMs(2026, 9, 29, 10))) };
    const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs });
    await push(ctx);
    await push(ctx); // 同じ件数で再実行
    const doc = docs.get(DQ_PATH);
    check("2-1 日付キーは1つだけ", Object.keys(doc.kyotsuMathAuto).length === 1, doc.kyotsuMathAuto);
    check("2-2 変化が無い2回目はsetDocを呼ばない（冪等）", dqWrites(writes).length === 1, dqWrites(writes));

    logs.u1 = logsOf(...times(5, jstMs(2026, 9, 29, 10))); // 件数が増えた再実行
    await push(ctx);
    check("2-3 件数が増えれば同じ日付キーを更新する", docs.get(DQ_PATH).kyotsuMathAuto["2026-09-29"].count === 5);
    check("2-4 日付キーはやはり1つだけ（重複しない）", Object.keys(docs.get(DQ_PATH).kyotsuMathAuto).length === 1);
  }

  console.log("\n[3] 期間内の複数日を再集計して保存する（日付はJSTの0時区切り）");
  {
    const { ctx, docs } = makeContext({
      initialDoc: { data: "{}" }, uid: CHILD_UID,
      unitLogs: {
        u1: logsOf(jstMs(2026, 9, 27, 10), jstMs(2026, 9, 28, 10), jstMs(2026, 9, 28, 11)),
        u2: logsOf(jstMs(2026, 9, 28, 12))
      }
    });
    const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
    check("3-1 ok:true", r.ok === true, r);
    check("3-2 2日分が更新される", r.updatedDays === 2, r);
    const doc = docs.get(DQ_PATH);
    check("3-3 2026-09-27はcount:1", doc.kyotsuMathAuto["2026-09-27"].count === 1);
    check("3-4 2026-09-28は単元をまたいでcount:3", doc.kyotsuMathAuto["2026-09-28"].count === 3);
  }

  console.log("\n[3b] JST境界：UTC 14:59:59 は当日、15:00:00 は翌日");
  {
    const before = Date.UTC(2026, 8, 28, 14, 59, 59);  // JST 9/28 23:59:59
    const after = Date.UTC(2026, 8, 28, 15, 0, 0);     // JST 9/29 00:00:00
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: { u1: logsOf(before, after) } });
    await push(ctx);
    const auto = docs.get(DQ_PATH).kyotsuMathAuto;
    check("3b-1 23:59:59 は 9/28、00:00:00 は 9/29 に数える", auto["2026-09-28"].count === 1 && auto["2026-09-29"].count === 1, auto);
  }

  console.log("\n[3c] 端末の時計が進んでいて「未来の日付」のログがあっても、今日より先の日は書かない");
  {
    const { ctx, docs } = makeContext({
      initialDoc: { data: "{}" }, uid: CHILD_UID,
      unitLogs: { u1: logsOf(jstMs(2026, 9, 29, 10), jstMs(2026, 9, 30, 10), jstMs(2026, 12, 1, 10)) }
    });
    await push(ctx);
    const keys = Object.keys(docs.get(DQ_PATH).kyotsuMathAuto);
    check("3c-1 今日(9/29)だけが書かれ、9/30・12/1（未来）は書かれない", keys.join() === "2026-09-29", keys);
  }

  console.log("\n[4] 既存kyotsuMathAutoの別日付を保持する");
  {
    const { ctx, docs } = makeContext({
      initialDoc: { data: "{}", kyotsuMathAuto: { "2026-08-01": { date: "2026-08-01", source: "kyotsu-math", count: 9, updatedAt: 1 } } },
      uid: CHILD_UID,
      unitLogs: { u1: logsOf(jstMs(2026, 9, 28, 10)) }
    });
    await vm.runInContext("backfillDailyQuestLogs()", ctx);
    const doc = docs.get(DQ_PATH);
    check("4-1 既存の別日付キーは変化しない", doc.kyotsuMathAuto["2026-08-01"].count === 9, doc.kyotsuMathAuto);
    check("4-2 新しい日付キーが追加される", doc.kyotsuMathAuto["2026-09-28"].count === 1);
  }

  console.log("\n[5-7] data / leapAuto / eikomiAutoを変更しない（書くのはkyotsuMathAutoだけ）");
  {
    const initialData = JSON.stringify({ days: { "2026-01-01": { quests: [{ label: "手動", done: true }] } }, appStartDate: "2026-01-01" });
    const { ctx, docs, writes } = makeContext({
      initialDoc: {
        data: initialData,
        leapAuto: { "2026-08-01": { date: "2026-08-01", source: "leap", count: 5, updatedAt: 1 } },
        eikomiAuto: { "2026-08-01": { date: "2026-08-01", source: "eikomi", count: 7, updatedAt: 1 } }
      },
      uid: CHILD_UID,
      unitLogs: { u1: logsOf(jstMs(2026, 9, 28, 10)) }
    });
    await vm.runInContext("backfillDailyQuestLogs()", ctx);
    const doc = docs.get(DQ_PATH);
    check("5 dataフィールドは変更されない", doc.data === initialData);
    check("6 leapAutoは変更されない", JSON.stringify(doc.leapAuto) === JSON.stringify({ "2026-08-01": { date: "2026-08-01", source: "leap", count: 5, updatedAt: 1 } }));
    check("7 eikomiAutoは変更されない", JSON.stringify(doc.eikomiAuto) === JSON.stringify({ "2026-08-01": { date: "2026-08-01", source: "eikomi", count: 7, updatedAt: 1 } }));
    check("7b setDocに渡すのはkyotsuMathAutoフィールドだけ", dqWrites(writes).every(w => Object.keys(w.data).join() === "kyotsuMathAuto" && w.merge === true), dqWrites(writes));
  }

  console.log("\n[8] 未認証・書き込み対象外role（guardian）から書かない");
  {
    // guest（未認証）
    {
      const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}" }, uid: null, unitLogs: { u1: logsOf(jstMs(2026, 9, 29, 10)) } });
      const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
      await push(ctx);
      check("8-1 guestはnot-childで拒否される", r.ok === false && r.reason === "not-child", r);
      check("8-2 guestはkyotsuMathAutoを書けない", !docs.get(DQ_PATH).kyotsuMathAuto);
      check("8-3 guestではsetDocが呼ばれない", dqWrites(writes).length === 0);
    }
    // guardian（保護者・閲覧モード）
    {
      const { ctx, docs, writes, state } = makeContext({ initialDoc: { data: "{}" }, uid: GUARDIAN_UID, isGuardianUser: true, unitLogs: { u1: logsOf(jstMs(2026, 9, 29, 10)) } });
      const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
      await push(ctx);
      check("8-4 guardianはnot-childで拒否される", r.ok === false && r.reason === "not-child", r);
      check("8-5 guardianはkyotsuMathAutoを書けない", !docs.get(DQ_PATH).kyotsuMathAuto);
      check("8-6 guardianではsetDocもgetDocも呼ばれない", dqWrites(writes).length === 0 && state.getDocCalls === 0);
    }
  }

  console.log("\n[9] 正しい学習者（本人）のみ書き込み可能");
  {
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: { u1: logsOf(jstMs(2026, 9, 28, 10)) } });
    const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
    check("9-1 本人はok:true", r.ok === true, r);
    check("9-2 本人はkyotsuMathAutoを書ける", !!docs.get(DQ_PATH).kyotsuMathAuto);
  }

  console.log("\n[10] Daily Quest document未作成ならsetDoc0回・新規作成しない（あとで作られたら書く）");
  {
    const { ctx, docs, writes } = makeContext({ initialDoc: null, uid: CHILD_UID, unitLogs: { u1: logsOf(jstMs(2026, 9, 29, 10)) } });
    await push(ctx);
    check("10-1 push: setDocが0回", dqWrites(writes).length === 0, writes);
    check("10-2 push: documentが新規作成されない", !docs.has(DQ_PATH));
    const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
    check("10-3 backfill: no-dailyquest-doc", r.ok === false && r.reason === "no-dailyquest-doc", r);
    check("10-4 backfill: setDocが0回・新規作成されない", dqWrites(writes).length === 0 && !docs.has(DQ_PATH));
    docs.set(DQ_PATH, { data: "{}" });   // Planner側の記録があとから作られた
    await push(ctx);
    check("10-5 記録が作られたあとの次のpushでは書く（未作成を『確認済み』として覚えていない）", !!docs.get(DQ_PATH).kyotsuMathAuto && docs.get(DQ_PATH).kyotsuMathAuto["2026-09-29"].count === 1, docs.get(DQ_PATH));
  }

  console.log("\n[11] 既存data内のautoSource:\"kyotsu-math\"を変更しない");
  {
    const initialData = JSON.stringify({
      days: { "2026-09-02": { quests: [{ label: "kyotsu-math（自動記録）（本日3問）", done: true, tag: "数学", autoSource: "kyotsu-math" }] } }
    });
    const { ctx, docs } = makeContext({
      initialDoc: { data: initialData }, uid: CHILD_UID,
      unitLogs: { u1: logsOf(jstMs(2026, 9, 2, 10), jstMs(2026, 9, 2, 11), jstMs(2026, 9, 28, 10)) }
    });
    await vm.runInContext("backfillDailyQuestLogs()", ctx);
    const doc = docs.get(DQ_PATH);
    check("11-1 旧autoSourceエントリを含むdataは一切書き換えられない", doc.data === initialData);
    check("11-2 旧方式がありうる期間（9/27より前）の日は、既定では新方式で書かない（旧記録を入れ替えない）", !doc.kyotsuMathAuto["2026-09-02"], doc.kyotsuMathAuto);
    check("11-3 期間内の日は書かれる", doc.kyotsuMathAuto["2026-09-28"].count === 1);
  }

  console.log("\n[12] 今回の事故：9/28の8問が翌日(9/29)に同期されても、9/28分が書かれる");
  {
    const { ctx, docs } = makeContext({
      initialDoc: { data: "{}" }, uid: CHILD_UID,
      unitLogs: { chugaku: logsOf(...times(8, jstMs(2026, 9, 28, 22, 26), 60000)), keiryo: logsOf(jstMs(2026, 9, 26, 15, 51)) }
    });
    await push(ctx);   // 9/29 17:47 の起動時同期に相当（今日9/29の件数は0）
    const auto = docs.get(DQ_PATH).kyotsuMathAuto;
    check("12-1 9/28 が count:8 で書かれる", auto && auto["2026-09-28"] && auto["2026-09-28"].count === 8, auto);
    check("12-2 今日(9/29)は0件なので書かない", !auto["2026-09-29"]);
    check("12-3 9/26（旧方式がありうる期間）は書かない", !auto["2026-09-26"]);
  }

  console.log("\n[13] 期間の窓：9/27より前・窓より古い日は書かない（過去分の一斉表示をしない）");
  {
    const logs = { u1: logsOf(jstMs(2026, 9, 26, 12), jstMs(2026, 9, 27, 12), jstMs(2026, 10, 3, 12), jstMs(2026, 10, 4, 12), jstMs(2026, 10, 10, 12)) };
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs, now: jstMs(2026, 10, 10, 20) });
    await push(ctx);
    const keys = Object.keys(docs.get(DQ_PATH).kyotsuMathAuto).sort();
    check("13-1 10/10 の窓は 10/4〜10/10。10/4 と 10/10 だけが書かれる", JSON.stringify(keys) === JSON.stringify(["2026-10-04", "2026-10-10"]), keys);
  }

  console.log("\n[14] 増加のみ：既存が同じか大きければ書かない・減らさない");
  {
    const mk = (count) => ({ "2026-09-28": { date: "2026-09-28", source: "kyotsu-math", count, updatedAt: 1 } });
    const logs = { u1: logsOf(...times(8, jstMs(2026, 9, 28, 22, 0))) };
    // 既存の方が大きい（別端末の記録・ログの整理で今の集計が少なく見える場合）
    {
      const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mk(10) }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      check("14-1 既存10 > 集計8 → 書かない・10のまま", dqWrites(writes).length === 0 && docs.get(DQ_PATH).kyotsuMathAuto["2026-09-28"].count === 10);
    }
    // 同数
    {
      const { ctx, writes } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mk(8) }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      const w = dqWrites(writes);
      check("14-2 既存8（内訳なし）= 集計8 → 件数は変えず、内訳だけを付けて書く（同数で内訳が無い日の補完）",
        w.length === 1 && w[0].data.kyotsuMathAuto["2026-09-28"].count === 8 && !!w[0].data.kyotsuMathAuto["2026-09-28"].breakdown, w);
    }
    // 同数で、既存に有効な内訳がある → 書かない
    {
      const withB = { "2026-09-28": { date: "2026-09-28", source: "kyotsu-math", count: 8, updatedAt: 1, breakdown: { normal: 8, review: 0 } } };
      const { ctx, writes } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: withB }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      check("14-2b 既存8（有効な内訳あり）= 集計8 → 書かない", dqWrites(writes).length === 0);
    }
    // 既存の方が小さい
    {
      const { ctx, docs } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mk(5) }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      check("14-3 既存5 < 集計8 → 8に更新", docs.get(DQ_PATH).kyotsuMathAuto["2026-09-28"].count === 8);
    }
  }

  console.log("\n[15] 通信を減らす：差分が無ければ再読み込みしない・増えたときだけ読む");
  {
    const logs = { u1: logsOf(...times(3, jstMs(2026, 9, 29, 10))) };
    const { ctx, writes, state } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs });
    await push(ctx);
    const afterFirst = state.getDocCalls;
    await push(ctx);
    await push(ctx);
    check("15-1 最初の1回だけgetDoc（同じ件数の再実行ではgetDocしない）", afterFirst === 1 && state.getDocCalls === 1, state.getDocCalls);
    logs.u1 = logsOf(...times(4, jstMs(2026, 9, 29, 10)));
    await push(ctx);
    check("15-2 件数が増えたらgetDocして書く", state.getDocCalls === 2 && dqWrites(writes).length === 2, { calls: state.getDocCalls, writes: dqWrites(writes).length });
    // 既存の方が大きいと分かった日は、記憶して以後getDocしない
    const c2 = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: { "2026-09-29": { date: "2026-09-29", source: "kyotsu-math", count: 9, updatedAt: 1 } } }, uid: CHILD_UID, unitLogs: logs });
    await push(c2.ctx); await push(c2.ctx);
    check("15-3 既存9 > 集計4 と分かったら、以後は読まない（1回だけ）", c2.state.getDocCalls === 1 && dqWrites(c2.writes).length === 0, c2.state.getDocCalls);
  }

  console.log("\n[16] 通信エラーでも例外を投げない・何も書かない");
  {
    const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: { u1: logsOf(jstMs(2026, 9, 29, 10)) }, getDocThrows: true });
    let threw = false;
    try { await push(ctx); } catch (e) { threw = true; }
    check("16-1 pushは例外を外に出さない", !threw);
    check("16-2 何も書かれない", dqWrites(writes).length === 0 && !docs.get(DQ_PATH).kyotsuMathAuto);
    const r = await vm.runInContext("backfillDailyQuestLogs()", ctx);
    check("16-3 backfillはok:falseを返す", r.ok === false && /network/.test(r.reason), r);
  }

  console.log("\n[17] backfill：fromDay を指定したときだけ、それより前も反映（既定は期間内のみ）");
  {
    const logs = { u1: logsOf(jstMs(2026, 9, 2, 10), jstMs(2026, 9, 28, 10)) };
    const a = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs });
    await vm.runInContext("backfillDailyQuestLogs()", a.ctx);
    check("17-1 既定：9/2は書かれず9/28だけ", Object.keys(a.docs.get(DQ_PATH).kyotsuMathAuto).join() === "2026-09-28");
    const b = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs });
    await vm.runInContext(`backfillDailyQuestLogs({ fromDay: "2026-09-01" })`, b.ctx);
    check("17-2 fromDay指定：9/2も書かれる", Object.keys(b.docs.get(DQ_PATH).kyotsuMathAuto).sort().join() === "2026-09-02,2026-09-28");
    const c = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs });
    await vm.runInContext(`backfillDailyQuestLogs({ fromDay: "yesterday" })`, c.ctx);
    check("17-3 不正なfromDayは無視して既定の期間になる", Object.keys(c.docs.get(DQ_PATH).kyotsuMathAuto).join() === "2026-09-28");
  }

  console.log("\n[18] 純関数 planKyotsuAutoUpdates");
  {
    const { ctx } = makeContext({});
    const plan = (existing, counts) => JSON.parse(vm.runInContext(`JSON.stringify(planKyotsuAutoUpdates(${JSON.stringify(existing)}, ${JSON.stringify(counts)}, 123))`, ctx));
    const u = plan({ "2026-09-28": { count: 3 }, "2026-09-29": { count: 5 } }, { "2026-09-27": 2, "2026-09-28": 3, "2026-09-29": 4, "2026-09-30": 0 });
    check("18-1 新規の日だけ書く（同数・減少・0件は書かない）", JSON.stringify(Object.keys(u)) === JSON.stringify(["2026-09-27"]), u);
    check("18-2 エントリの形", JSON.stringify(u["2026-09-27"]) === JSON.stringify({ date: "2026-09-27", source: "kyotsu-math", count: 2, updatedAt: 123 }), u);
    check("18-3 existingが空・未定義でも動く", Object.keys(plan({}, { "2026-09-28": 1 })).length === 1 && Object.keys(plan(null, { "2026-09-28": 1 })).length === 1);
  }

  console.log("\n[19] buildSummary：サマリーの3項目は従来どおり、perDayが追加される");
  {
    const { ctx } = makeContext({ uid: CHILD_UID, unitLogs: { u1: logsOf(jstMs(2026, 9, 28, 10), jstMs(2026, 9, 29, 9), jstMs(2026, 9, 29, 11)), u2: [{ nothing: true }, { timestamp: "x" }] } });
    const s = JSON.parse(vm.runInContext("JSON.stringify(buildSummary())", ctx));
    check("19-1 totalCount=3・todayCount=2（timestampが数値でないログは数えない）", s.totalCount === 3 && s.todayCount === 2, s);
    check("19-2 lastStudiedAt は最新の回答時刻", s.lastStudiedAt === jstMs(2026, 9, 29, 11), s);
    check("19-3 perDay は日別の件数", JSON.stringify(s.perDay) === JSON.stringify({ "2026-09-28": 1, "2026-09-29": 2 }), s.perDay);
  }

  console.log("\n[20] pushSummary が書くサマリーのフィールドに perDay を含めない");
  {
    const m = src.match(/async function pushSummary\(gen\) \{[\s\S]*?\n\}/);
    check("20-1 pushSummary の setDoc は lastStudiedAt / todayCount / totalCount / updatedAt / w / client だけ", !!m && !/perDay/.test(m[0]) && /pushDailyQuestAuto\(s, gen\)/.test(m[0]), m && m[0]);
  }

  // ================= 内訳（breakdown:{normal, review}） =================
  const modeLog = (t, mode) => ({ timestamp: t, mode });
  const D28 = jstMs(2026, 9, 28, 22, 0);
  const mkEntry = (count, breakdown) => ({ "2026-09-28": Object.assign({ date: "2026-09-28", source: "kyotsu-math", count, updatedAt: 1 }, breakdown ? { breakdown } : {}) });

  console.log("\n[21] 内訳：復習（review / dueReview）とそれ以外（通常）に分ける。合計＝count。日付ごと");
  {
    const logs = {
      u1: [modeLog(D28, "normal"), modeLog(D28 + 1, "review"), modeLog(D28 + 2, "dueReview"), modeLog(D28 + 3, "stage"), modeLog(D28 + 4, "tips"), { timestamp: D28 + 5 }],
      u2: [modeLog(jstMs(2026, 9, 29, 10), "review")]
    };
    const { ctx, docs } = makeContext({ initialDoc: { data: "{}" }, uid: CHILD_UID, unitLogs: logs });
    const sum = JSON.parse(vm.runInContext("JSON.stringify(buildSummary())", ctx));
    check("21-1 buildSummary.perDayReview は日別の復習件数（review と dueReview だけ）", JSON.stringify(sum.perDayReview) === JSON.stringify({ "2026-09-28": 2, "2026-09-29": 1 }), sum.perDayReview);
    await push(ctx);
    const auto = docs.get(DQ_PATH).kyotsuMathAuto;
    check("21-2 9/28：count 6、内訳 通常4・復習2（mode の無い・stage・tips・normal は通常）",
      auto["2026-09-28"].count === 6 && JSON.stringify(auto["2026-09-28"].breakdown) === JSON.stringify({ normal: 4, review: 2 }), auto["2026-09-28"]);
    check("21-3 9/29：count 1、内訳 通常0・復習1", auto["2026-09-29"].count === 1 && JSON.stringify(auto["2026-09-29"].breakdown) === JSON.stringify({ normal: 0, review: 1 }), auto["2026-09-29"]);
    const ps = (src.match(/async function pushSummary\(gen\) \{[\s\S]*?\n\}/) || [""])[0];
    check("21-4 サマリー(kyotsu-math-summary)に perDay / perDayReview は入らない", ps.length > 0 && !/perDay/.test(ps), ps);
  }

  console.log("\n[22] 内訳の書き換え規則：増えたら内訳ごと置き換え・同数で内訳無しなら補完・同数で有効な内訳があれば書かない・減らさない");
  {
    const logs = { u1: [...times(6, D28).map(t => modeLog(t, "normal")), ...times(2, D28 + 100000).map(t => modeLog(t, "review"))] };   // 8問（通常6・復習2）
    {
      const { ctx, docs } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mkEntry(5, { normal: 5, review: 0 }) }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      const e = docs.get(DQ_PATH).kyotsuMathAuto["2026-09-28"];
      check("22-1 既存5（内訳あり）→ 8：count 8・内訳は新しい値（通常6・復習2）に置き換わる", e.count === 8 && JSON.stringify(e.breakdown) === JSON.stringify({ normal: 6, review: 2 }), e);
    }
    {
      const { ctx, writes } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mkEntry(10) }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      check("22-2 既存10 > 集計8（内訳なし）→ 書かない（減らさない・内訳の補完もしない）", dqWrites(writes).length === 0);
    }
    for (const bad of [{ normal: 5, review: 2 }, { normal: 7.5, review: 0.5 }, { normal: -1, review: 9 }, { normal: 8 }, "x", []]) {
      const { ctx, docs } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mkEntry(8, bad) }, uid: CHILD_UID, unitLogs: logs });
      await push(ctx);
      const e = docs.get(DQ_PATH).kyotsuMathAuto["2026-09-28"];
      check("22-3 同数8で既存の内訳が無効(" + JSON.stringify(bad) + ") → 有効な内訳に直す", e.count === 8 && JSON.stringify(e.breakdown) === JSON.stringify({ normal: 6, review: 2 }), e);
    }
    {
      const old = { "2026-09-02": { date: "2026-09-02", source: "kyotsu-math", count: 3, updatedAt: 1 } };
      const { ctx, docs, writes } = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: old }, uid: CHILD_UID, unitLogs: { u1: times(3, jstMs(2026, 9, 2, 10)).map(t => modeLog(t, "review")) } });
      await push(ctx);
      await vm.runInContext("backfillDailyQuestLogs()", ctx);
      check("22-4 窓の外の過去日（9/2）は内訳の補完もしない（過去分の書き換えをしない）", dqWrites(writes).length === 0 && !docs.get(DQ_PATH).kyotsuMathAuto["2026-09-02"].breakdown);
      await vm.runInContext('backfillDailyQuestLogs({ fromDay: "2026-09-01" })', ctx);
      check("22-5 fromDay を明示したときだけ補完される（件数は変わらない）",
        !!docs.get(DQ_PATH).kyotsuMathAuto["2026-09-02"].breakdown && docs.get(DQ_PATH).kyotsuMathAuto["2026-09-02"].count === 3);
    }
  }

  console.log("\n[23] 通信を減らす：内訳を補完したあとは再読み込みしない");
  {
    const logs = { u1: times(4, D28).map(t => modeLog(t, "review")) };
    const a = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mkEntry(4) }, uid: CHILD_UID, unitLogs: logs });
    await push(a.ctx); await push(a.ctx); await push(a.ctx);
    check("23-1 補完の1回だけ getDoc・書き込み（以後は再実行しても読まない・書かない）", a.state.getDocCalls === 1 && dqWrites(a.writes).length === 1, { calls: a.state.getDocCalls, writes: dqWrites(a.writes).length });
    const b = makeContext({ initialDoc: { data: "{}", kyotsuMathAuto: mkEntry(4, { normal: 0, review: 4 }) }, uid: CHILD_UID, unitLogs: logs });
    await push(b.ctx); await push(b.ctx);
    check("23-2 別端末が先に有効な内訳つきで書いていた日は、読むだけで書かない（1回だけ読む）", b.state.getDocCalls === 1 && dqWrites(b.writes).length === 0, b.state.getDocCalls);
  }

  console.log("\n[24] 純関数 planKyotsuAutoUpdates（内訳）");
  {
    const { ctx } = makeContext({});
    const plan = (existing, counts, reviews) => JSON.parse(vm.runInContext(
      "JSON.stringify(planKyotsuAutoUpdates(" + JSON.stringify(existing) + ", " + JSON.stringify(counts) + ", 7" + (reviews === undefined ? "" : ", " + JSON.stringify(reviews)) + "))", ctx));
    const u1 = plan({}, { "2026-09-28": 8 }, { "2026-09-28": 2 });
    check("24-1 内訳 通常6・復習2", JSON.stringify(u1["2026-09-28"].breakdown) === JSON.stringify({ normal: 6, review: 2 }), u1);
    check("24-2 reviews を渡さない従来の呼び方は内訳なし・同数の補完もしない",
      !plan({}, { "2026-09-28": 8 })["2026-09-28"].breakdown && Object.keys(plan({ "2026-09-28": { count: 8 } }, { "2026-09-28": 8 })).length === 0);
    check("24-3 復習が無い日（reviewsに無い）は 通常のみ・review 0", JSON.stringify(plan({}, { "2026-09-28": 3 }, {})["2026-09-28"].breakdown) === JSON.stringify({ normal: 3, review: 0 }));
    for (const bad of [9, -1, 1.5, "2"]) {
      const u = plan({}, { "2026-09-28": 8 }, { "2026-09-28": bad });
      check("24-4 復習件数が不正(" + JSON.stringify(bad) + ") → 内訳を付けない（count だけ書く）", !!u["2026-09-28"] && u["2026-09-28"].count === 8 && !u["2026-09-28"].breakdown, u);
    }
  }

  console.log(`\n合計: ${passed}件成功 / ${failed}件失敗`);
  if (failed > 0) process.exitCode = 1;
}

run();
