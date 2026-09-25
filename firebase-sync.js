/* =========================================================
   firebase-sync.js  —  端末間ログ同期アドオン（スマホ⇔iPad）
   ---------------------------------------------------------
   ・app.js / index.html の既存部分は一切変更しない後付けモジュール。
   ・localStorage を「正」として使い続け、裏でFirestoreと双方向マージ同期する。
     → オフラインでもこれまで通り解ける（PWAの強みを維持）。
   ・保存先: users/{uid}/units/{unitKey}  … payload は JSON文字列1本
     （Firestoreの型制約・undefined制約を完全に回避するため）
   ・読み込み方法: <script type="module" src="firebase-sync.js?v=2"></script>
   ・2026-09〜: LEAP/planner(デイリークエスト)と同じFirebaseプロジェクト
     （leap-app-sync）・同じ子供用ログインIDに統一。加えて、同期のたびに
     「kyotsu-math-summary/{uid}」へ最終学習日時・今日の演習数・累計演習数
     だけの軽量サマリーを書き込み、planner側（dq-firebase-sync.js）から
     読めるようにしてある。
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

/* ---------- 設定 ----------
   2026-09〜: LEAP単語帳アプリ／デイリークエスト(planner)と同じ
   Firebaseプロジェクト（leap-app-sync）・同じログインIDに統一。
   これにより、子どもは1つのID/パスワードでLEAP・kyotsu-math・plannerに
   ログインでき、plannerのFirestoreルールもこのプロジェクト内で一元管理できる。
   ※旧kyotsu-mathプロジェクト（projectId: "kyotsu-math"）に貯まっていた
   クラウド同期履歴はこの切り替えでは引き継がれない（端末内localStorageは
   そのまま残るのでローカルの学習データ自体は消えない）。 */
const firebaseConfig = {
  apiKey: "AIzaSyBkrhdO_041b7Hi0nyAY8p--uHRYoFKUqk",
  authDomain: "leap-app-sync.firebaseapp.com",
  projectId: "leap-app-sync",
  storageBucket: "leap-app-sync.firebasestorage.app",
  messagingSenderId: "734689387742",
  appId: "1:734689387742:web:102895181b561af204ce4f"
};

const PREFIX = "kyotsu_app_v14_";
const RELOAD_FLAG = "kyotsu_sync_reloaded";
const PUSH_DELAY = 4000; // 保存後、これだけ静かになったらアップロード

/* ---------- 保護者（閲覧専用）設定 ----------
   ・LEAP/planner側と同じUIDを流用する（leap-app-syncプロジェクトの値）。
   ・GUARDIAN_UIDS に入っているuidでログインした場合は「閲覧モード」になる:
     - データの読み込み先は自分のuidではなく CHILD_UID 固定
     - Firestoreへのアップロードは一切行わない（検証プレイのログを汚さないため） */
const CHILD_UID = "hjWTc7Ll0UeHv5iKbRTlTLRrY8x1";
const GUARDIAN_UIDS = [
  "eVm3klGUSpcxRPtxN7NHo4lYx7f2"
];

// plannerが読みに来る「学習サマリー」の保存先（1ドキュメントだけの軽量な要約）
const SUMMARY_COLLECTION = "kyotsu-math-summary";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let pushTimer = null;
let dirtyUnits = new Set();   // 未送信の単元（メモリだけ。リロード後は起動時の syncAll が local から送り直す）
let busy = false;
let savedWhileBusy = false;   // 同期中にアプリが保存した（同期が終わったら、もう一度送る）

const UNSENT_MSG = "未送信のデータがあります。通信が戻ると自動で再送します。";

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushDirty, PUSH_DELAY);
}

// 同期中に保存されたものがあれば、同期が終わった後にもう一度送る
// （失敗しただけの単元は、ここでは送り直さない＝短い間隔で再試行し続けない）
function afterBusy() {
  if (savedWhileBusy) {
    savedWhileBusy = false;
    schedulePush();
  }
}

function isGuardian() {
  return !!currentUser && GUARDIAN_UIDS.indexOf(currentUser.uid) >= 0;
}

/* 読み書き先のuid。保護者なら常に子ども側のuidを見る（＝閲覧モード） */
function targetUid() {
  return isGuardian() ? CHILD_UID : currentUser.uid;
}

/* =========================================================
   小道具
   ========================================================= */
function log(msg, color) {
  const s = document.getElementById("syncStatus");
  if (s) { s.innerText = msg; s.style.color = color || "#475569"; }
  console.log("[sync] " + msg);
}

function unitKeys() {
  const keys = new Set();
  if (typeof UNIT_META !== "undefined") Object.keys(UNIT_META).forEach(k => keys.add(k));
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf(PREFIX) === 0) keys.add(k.slice(PREFIX.length));
  }
  return Array.from(keys);
}

function readLocal(unit) {
  const raw = localStorage.getItem(PREFIX + unit);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* データの「新しさ」= answerLogの最終タイムスタンプ */
function freshness(data) {
  if (!data || !data.state || !Array.isArray(data.state.answerLog)) return 0;
  let max = 0;
  for (const r of data.state.answerLog) {
    if (r && typeof r.timestamp === "number" && r.timestamp > max) max = r.timestamp;
  }
  return max;
}

/* =========================================================
   マージ本体
   local / remote のどちらか片方しか無ければそれを返す。
   両方あれば「追記系は合体・進行状況は新しい方優先」で統合する。
   ========================================================= */
// wrong（長期の復習対象）を [{id}] の形にそろえる。旧形式（問題オブジェクト丸ごと）や文字列IDも受け付け、
// IDの無い要素は捨て、同じIDは最初の1つだけ残す（順番は維持、元の配列は変更しない）
function normalizeWrong(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach(x => {
    const id = typeof x === "string" ? x : (x && typeof x === "object" ? x.id : null);
    if (typeof id !== "string" || !id || seen.has(id)) return;
    seen.add(id);
    out.push({ id });
  });
  return out;
}

// 旧仕様の tipList（使っていない）を取り除き、wrong を [{id}] にそろえたコピーを返す。
// 未挑戦セッション（旧仕様の unansweredSnapshot と、mode が未挑戦のままの途中位置）も持ち越さない
// （app.js の endUnansweredSessionForSave と同じ正規化。別端末やリロード後に未挑戦セッションを再開しない）
function cleanLegacyFields(d) {
  if (!d || !d.state) return d;
  const state = Object.assign({}, d.state);
  delete state.tipList;
  if ("wrong" in state) state.wrong = normalizeWrong(state.wrong);
  delete state.unansweredSnapshot;
  // 古い回答の archive（log-archive.js）は正規形にそろえ、中身が無ければキーを消す
  if ("logArchive" in state && globalThis.LogArchive) {
    const arc = globalThis.LogArchive.normalizeArchive(state.logArchive);
    if (Object.keys(arc).length) state.logArchive = arc;
    else delete state.logArchive;
  }
  // Phase 2 救済用の失敗時刻（log-archive.js）は正規形にし、卒業時刻以前のものを消す。空ならキーを消す
  if ("rescueLog" in state && globalThis.LogArchive) {
    const rl = globalThis.LogArchive.pruneRescueLog(state.rescueLog, state.graduatedAt);
    if (Object.keys(rl).length) state.rescueLog = rl;
    else delete state.rescueLog;
  }
  if (state.mode === "unanswered") {
    state.mode = "normal";
    state.index = 0;
    state.finished = true;
  }
  const out = Object.assign({}, d, { state });
  // 生ログの削減（最新300件・180日。古いものは archive へ。save と同じ log-archive.js の関数）。
  // merge では Phase 2 救済の判定が終わったあと（mergeUnitData の最後）にここを通る
  return globalThis.LogArchive ? globalThis.LogArchive.compactUnitData(out) : out;
}

function mergeUnitData(a, b) {
  if (!a) return cleanLegacyFields(b);
  if (!b) return cleanLegacyFields(a);

  // --- resetGen: 単元の「リセット世代」（学習データをリセットするたびに +1。無ければ 0）---
  //  世代が違えば、新しい世代の側をまるごと採用し、古い世代の学習データは一切 merge しない
  //  （リセットより前のデータが remote や別端末から復活しないように）。同じ世代なら通常の merge。
  const genOf = d => (d.state && typeof d.state.resetGen === "number" && d.state.resetGen > 0) ? Math.floor(d.state.resetGen) : 0;
  const genA = genOf(a), genB = genOf(b);
  if (genA !== genB) return cleanLegacyFields(genA > genB ? a : b);

  // newer / older を決める
  const fa = freshness(a), fb = freshness(b);
  const newer = (fa >= fb) ? a : b;
  const older = (fa >= fb) ? b : a;


  const nS = newer.state || {}, oS = older.state || {};

  // --- answerLog: 合体して重複除去（追記オンリーなので消えない） ---
  const seen = new Set();
  const logAll = [];
  [].concat(Array.isArray(oS.answerLog) ? oS.answerLog : [],
            Array.isArray(nS.answerLog) ? nS.answerLog : [])
    .forEach(r => {
      if (!r) return;
      const k = [r.questionId, r.timestamp, r.outcome, r.selectedIndex, r.selectedText].join("|");
      if (seen.has(k)) return;
      seen.add(k);
      logAll.push(r);
    });
  logAll.sort((x, y) => (x.timestamp || 0) - (y.timestamp || 0));

  // --- reviewMeta: idごとに lastSeenAt が新しい方を採用 ---
  const rm = {};
  const nRM = nS.reviewMeta || {}, oRM = oS.reviewMeta || {};
  // ※あえて「片方に無い＝削除された」とは判定しない。
  //   「もう片方の端末でまだ一度も解いていないだけ」と区別がつかず、
  //   誤判定すると復習の進捗が消える（＝取り返しがつかない）ため、
  //   安全側に倒して和集合を取る。
  //   卒業（＝削除）だけは graduatedAt で別に伝える（下の liveRM を参照）。
  Object.keys(oRM).forEach(id => { rm[id] = oRM[id]; });
  Object.keys(nRM).forEach(id => {
    const ne = nRM[id], oe = rm[id];
    if (!oe) { rm[id] = ne; return; }
    const nt = (ne && (ne.lastSeenAt || ne.dueAt)) || 0;
    const ot = (oe && (oe.lastSeenAt || oe.dueAt)) || 0;
    rm[id] = (nt >= ot) ? ne : oe;
  });

  // --- graduatedAt: 問題ID→卒業時刻。IDごとに新しい方を採用（引数順に依存せず、何度マージしても同じ）---
  const nGA = nS.graduatedAt || {}, oGA = oS.graduatedAt || {};
  const hasGA = !!(nS.graduatedAt || oS.graduatedAt);
  const ga = {};
  Object.keys(nGA).concat(Object.keys(oGA)).forEach(id => {
    const x = typeof nGA[id] === "number" ? nGA[id] : -Infinity;
    const y = typeof oGA[id] === "number" ? oGA[id] : -Infinity;
    const t = Math.max(x, y);
    if (t !== -Infinity) ga[id] = t;
  });
  const isGraduated = id => Object.prototype.hasOwnProperty.call(ga, id);

  // --- 卒業前の古いreviewMetaを捨てる ---
  //  活動時刻 = lastSeenAt（まだ一度も復習していなければ dueAt）。上のLWWと同じ基準。
  //  活動時刻 <= 卒業時刻 なら卒業前のデータとみなして捨てる（同時刻も卒業側を優先）。
  //  卒業より後に新しく作られたreviewMeta（再度の誤答など）は、これまでどおり残る。
  //
  //  ただし、卒業を知らない古い端末で卒業後に間違えた場合、app.js の addReviewTarget は
  //  既存のreviewMetaを更新しないので、reviewMeta上は「卒業前の古いデータ」に見えてしまう。
  //  そこで answerLog から「卒業後に addReviewTarget が呼ばれた回答」を拾い、あれば
  //  同じ端末で卒業後に間違えたときと同じ reviewMeta（streak 0 / dueAt=その時刻）に作り直す。
  //  addReviewTarget が呼ばれるのは: 誤答(answered かつ isCorrect:false) / timeout（正誤を問わない）/ skip
  //  卒業と同時刻のログは卒業側を優先して対象外。複数あれば卒業後で最初のもの（logAll は時刻順）。
  const reAddedAt = {};
  logAll.forEach(r => {
    if (!r || !isGraduated(r.questionId) || typeof r.timestamp !== "number") return;
    if (r.timestamp <= ga[r.questionId]) return;
    const reAdd = r.outcome === "timeout" || r.outcome === "skip" ||
      (r.outcome === "answered" && r.isCorrect === false);
    if (reAdd && !Object.prototype.hasOwnProperty.call(reAddedAt, r.questionId)) reAddedAt[r.questionId] = r.timestamp;
  });
  //  生ログから消えた（archive へ移った）失敗は rescueLog に時刻だけ残る。生ログの失敗と合わせて、
  //  卒業時刻より厳密に後で最初のものを使う（同じ時刻は同じものとして扱うので二重にならない）。
  const hasRescueLog = ("rescueLog" in nS || "rescueLog" in oS) && !!globalThis.LogArchive;
  const rescueLog = hasRescueLog ? globalThis.LogArchive.unionRescueLogs(oS.rescueLog, nS.rescueLog) : null;
  if (rescueLog) {
    Object.keys(rescueLog).forEach(id => {
      if (!isGraduated(id)) return;
      globalThis.LogArchive.rescueTimes(rescueLog, id).forEach(t => {
        if (t <= ga[id]) return;
        if (!Object.prototype.hasOwnProperty.call(reAddedAt, id) || t < reAddedAt[id]) reAddedAt[id] = t;
      });
    });
  }
  const liveRM = {};
  Object.keys(rm).forEach(id => {
    const e = rm[id];
    if (isGraduated(id) && ((e && (e.lastSeenAt || e.dueAt)) || 0) <= ga[id]) {
      if (Object.prototype.hasOwnProperty.call(reAddedAt, id)) {
        liveRM[id] = { streak: 0, dueAt: reAddedAt[id], lastSeenAt: null };
      }
      return;
    }
    liveRM[id] = e;
  });

  // --- wrong: [{id}] の配列（旧形式の問題オブジェクトも入口で {id} にそろえる） ---
  //  ・新しい側にあるものは全部残す
  //  ・古い側にしか無いものは、マージ後のreviewMetaにidが残っている場合だけ採用
  //    （古い端末でだけ新しく間違えた問題はちゃんと拾える）
  //  ・wrong は liveRM で判定し、さらに「卒業済みで有効なreviewMetaが無い」問題は新しい側からも外す
  //    （＝remoteに残った卒業前のwrongで卒業が取り消されない）
  function mergeQList(nList, oList, meta) {
    const n = normalizeWrong(nList);
    const o = normalizeWrong(oList);
    const nIds = new Set(n.map(q => q && q.id));
    const out = n.slice();
    o.forEach(q => {
      if (!q || !q.id) return;
      if (nIds.has(q.id)) return;
      if (meta[q.id]) out.push(q);
    });
    return out;
  }
  const wrong = mergeQList(nS.wrong, oS.wrong, liveRM)
    .filter(q => !(q && q.id && isGraduated(q.id) && !liveRM[q.id]));

  // --- history: 合体して重複除去、直近5件 ---
  const hSeen = new Set();
  const hist = [];
  [].concat(Array.isArray(nS.history) ? nS.history : [],
            Array.isArray(oS.history) ? oS.history : [])
    .forEach(h => {
      const k = JSON.stringify(h);
      if (hSeen.has(k)) return;
      hSeen.add(k);
      hist.push(h);
    });

  // --- 進行状況（index / correct / total / mode など）は新しい側をそのまま採用 ---
  const mergedFields = {
    answerLog: logAll,
    wrong: wrong,
    reviewMeta: liveRM,
    history: hist.slice(0, 5),
    lastShuffle: Object.assign({}, oS.lastShuffle || {}, nS.lastShuffle || {}),
    timer: null // タイマーIDは端末固有なので必ず捨てる
  };
  // どちらにも graduatedAt が無ければキーを作らない（graduatedAt導入前のデータでは出力を変えない）
  if (hasGA) mergedFields.graduatedAt = ga;
  // Phase 2 救済用の失敗時刻：同じ世代なら問題ごとの和集合（卒業時刻以前の刈り込みは cleanLegacyFields）
  if (rescueLog) mergedFields.rescueLog = rescueLog;
  // 古い回答の archive：同じ世代なら event の和集合（どちらにも無ければキーを作らない）
  if (("logArchive" in nS || "logArchive" in oS) && globalThis.LogArchive) {
    mergedFields.logArchive = globalThis.LogArchive.unionArchives(oS.logArchive, nS.logArchive);
  }
  const state = Object.assign({}, oS, nS, mergedFields);
  delete state.tipList;   // 旧仕様の tipList（使っていない）は、古い local / remote / 端末から来ても出力しない

  // --- stats: 累積カウンタなので「大きい方」を採用（足すと二重計上になる） ---
  const nT = newer.stats || {}, oT = older.stats || {};
  const stats = { weakness: {}, stage: {}, clearedCount: 0 };
  const wKeys = new Set([].concat(Object.keys(nT.weakness || {}), Object.keys(oT.weakness || {})));
  wKeys.forEach(k => {
    stats.weakness[k] = Math.max((nT.weakness || {})[k] || 0, (oT.weakness || {})[k] || 0);
  });
  const sKeys = new Set([].concat(Object.keys(nT.stage || {}), Object.keys(oT.stage || {})));
  sKeys.forEach(k => {
    const a2 = (nT.stage || {})[k] || { t: 0, c: 0 };
    const b2 = (oT.stage || {})[k] || { t: 0, c: 0 };
    stats.stage[k] = { t: Math.max(a2.t || 0, b2.t || 0), c: Math.max(a2.c || 0, b2.c || 0) };
  });
  stats.clearedCount = Math.max(nT.clearedCount || 0, oT.clearedCount || 0);

  // --- questionHistory: 問題ID→{date, isCorrect}（app.jsが回答のたびに上書きする「前回結果」）---
  //  ・問題IDごとに date が新しい方を採用
  //  ・date が同じなら isCorrect:false を優先（「前回正解済み→スキップ」を誤って出さない側に倒す）
  //  ・キー順は newer の並び → older にしか無いID の順。単一端末なら newer＝local なので
  //    local の並びがそのまま保たれ、並び順の違いだけで changedLocal → リロード にならない
  //  ・どちらにも無ければキー自体を作らない（従来の出力を変えない）
  if (nT.questionHistory || oT.questionHistory) {
    const nQH = nT.questionHistory || {}, oQH = oT.questionHistory || {};
    const pick = (x, y) => {
      if (!y) return x;
      if (!x) return y;
      const dx = typeof x.date === "number" ? x.date : 0;
      const dy = typeof y.date === "number" ? y.date : 0;
      if (dx !== dy) return dx > dy ? x : y;
      if (x.isCorrect !== y.isCorrect) return x.isCorrect === false ? x : y;
      return x;
    };
    const qh = {};
    Object.keys(nQH).forEach(id => { qh[id] = null; });
    Object.keys(oQH).forEach(id => { qh[id] = null; });
    Object.keys(qh).forEach(id => { qh[id] = pick(nQH[id], oQH[id]); });
    stats.questionHistory = qh;
  }

  return cleanLegacyFields({ state, stats });
}

/* =========================================================
   Firestore 入出力
   ========================================================= */
function unitDocRef(unit) {
  return doc(db, "users", targetUid(), "units", unit);
}

// 単元ドキュメントの中身（payload の JSON 文字列）を取り出す。無い・壊れている場合は null
function parsePayload(d) {
  if (!d || !d.payload) return null;
  try { return JSON.parse(d.payload); } catch (e) { return null; }
}

async function fetchRemote(unit) {
  const snap = await getDoc(unitDocRef(unit));
  if (!snap.exists()) return null;
  return parsePayload(snap.data());
}

async function writeRemote(unit, data) {
  await setDoc(unitDocRef(unit), {
    payload: JSON.stringify(data),
    updatedAt: Date.now(),
    device: navigator.userAgent.slice(0, 120)
  });
}

/* =========================================================
   学習サマリーの送信（planner連携用）
   ・全単元のanswerLogを軽く舐めて「今日の演習数」「累計演習数」
     「最終学習日時」だけをまとめた1ドキュメントをFirestoreに書く。
   ・planner側はこの1ドキュメントを読むだけで済むので、単元ごとの
     重いpayloadをplannerが直接読みに行く必要がない。
   ・保護者（閲覧モード）は書き込まない。
   ========================================================= */
function todayKeyJST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST固定
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

// 回答数の集計用：古い回答の archive（log-archive.js）＋生ログ（archive が無ければ生ログそのもの）
function countableLog(local) {
  if (!local || !local.state) return [];
  if (globalThis.LogArchive) return globalThis.LogArchive.countableLog(local.state);
  return Array.isArray(local.state.answerLog) ? local.state.answerLog : [];
}

function buildSummary() {
  let lastStudiedAt = 0;
  let todayCount = 0;
  let totalCount = 0;
  const today = todayKeyJST();

  unitKeys().forEach(unit => {
    const local = readLocal(unit);
    const log = countableLog(local);
    log.forEach(r => {
      if (!r || typeof r.timestamp !== "number") return;
      totalCount++;
      if (r.timestamp > lastStudiedAt) lastStudiedAt = r.timestamp;
      const jst = new Date(r.timestamp + 9 * 3600 * 1000);
      const key = jst.getUTCFullYear() + "-" + String(jst.getUTCMonth() + 1).padStart(2, "0") + "-" + String(jst.getUTCDate()).padStart(2, "0");
      if (key === today) todayCount++;
    });
  });

  return { lastStudiedAt, todayCount, totalCount };
}

/* =========================================================
   plannerの「今日のクエスト」に直接反映する
   ・plannerを開かなくても、この端末で学習してsyncが走るたびに
     dailyquest-logs/{CHILD_UID} の「今日」の欄へ直接書き込む。
   ・plannerの構造（{days:{key:{events,eventDone,quests}}}のJSON文字列1本）
     を壊さないよう、フェッチ→パース→autoSource:"kyotsu-math"の
     エントリだけ更新→書き戻し、という手順を踏む。
   ・plannerの記録がまだ一度も存在しない場合は何もしない（安全側）。
   ・保護者（閲覧モード）では絶対に動かさない。
   ========================================================= */
async function pushDailyQuestToday(s) {
  if (!currentUser || isGuardian()) return;
  const uid = targetUid();
  try {
    const snap = await getDoc(doc(db, "dailyquest-logs", uid));
    if (!snap.exists() || !snap.data().data) return;
    let store;
    try { store = JSON.parse(snap.data().data); } catch (e) { return; }
    if (!store.days) store.days = {};
    const today = todayKeyJST();
    if (!store.days[today]) store.days[today] = { events: [], eventDone: {}, quests: [] };
    const day = store.days[today];
    if (!day.quests) day.quests = [];
    const label = s.todayCount
      ? "kyotsu-math（自動記録）（本日" + s.todayCount + "問）"
      : "kyotsu-math（自動記録）";
    const existing = day.quests.find(q => q.autoSource === "kyotsu-math");
    let changed = false;
    if (existing) {
      if (existing.label !== label || !existing.done) {
        existing.label = label;
        existing.done = true;
        changed = true;
      }
    } else {
      day.quests.push({ label: label, done: true, tag: "数学", autoSource: "kyotsu-math" });
      changed = true;
    }
    if (!changed) return;
    store._updatedAt = Date.now();
    await setDoc(doc(db, "dailyquest-logs", uid), {
      data: JSON.stringify(store),
      clientUpdatedAt: store._updatedAt,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("[sync] dailyquest push失敗", e);
  }
}

async function pushSummary() {
  if (!currentUser || isGuardian()) return; // 閲覧モードでは絶対に書かない
  try {
    const s = buildSummary();
    await setDoc(doc(db, SUMMARY_COLLECTION, targetUid()), {
      lastStudiedAt: s.lastStudiedAt,
      todayCount: s.todayCount,
      totalCount: s.totalCount,
      updatedAt: Date.now()
    });
    pushDailyQuestToday(s);
  } catch (e) {
    console.error("[sync] summary push failed", e);
  }
}

/* =========================================================
   過去の学習履歴を、plannerの「今日のクエスト」に一括で反映する
   （一回限りの移行用）
   ・全単元のanswerLogを日付ごとに集計し、dailyquest-logs/{uid}の
     各日付にautoSource:"kyotsu-math"のクエストとして書き込む。
   ・plannerの記録が一度も存在しない場合は何もしない（安全のため）。
   ・既存の他のクエストには一切触れない。
   ========================================================= */
async function backfillDailyQuestLogs() {
  if (!currentUser || isGuardian()) return { ok: false, reason: "not-child" };
  const uid = targetUid();

  const perDay = {};
  unitKeys().forEach(unit => {
    const local = readLocal(unit);
    const log = countableLog(local);
    log.forEach(r => {
      const t = r && typeof r.timestamp === "number" ? r.timestamp : 0;
      if (!t) return;
      const jst = new Date(t + 9 * 3600 * 1000);
      const key = jst.getUTCFullYear() + "-" + String(jst.getUTCMonth() + 1).padStart(2, "0") + "-" + String(jst.getUTCDate()).padStart(2, "0");
      perDay[key] = (perDay[key] || 0) + 1;
    });
  });

  const dayKeys = Object.keys(perDay);
  if (dayKeys.length === 0) return { ok: true, updatedDays: 0, totalDaysFound: 0 };

  const today = todayKeyJST();

  try {
    const snap = await getDoc(doc(db, "dailyquest-logs", uid));
    if (!snap.exists() || !snap.data().data) return { ok: false, reason: "no-dailyquest-doc" };
    let store;
    try { store = JSON.parse(snap.data().data); } catch (e) { return { ok: false, reason: "parse-error" }; }
    if (!store.days) store.days = {};

    // 過去分を追加しても、Plannerの「記録開始日」(appStartDate)より前だと
    // 振り返りカレンダー上でグレーアウトしてタップできなくなってしまう。
    // バックフィルする日付の中に記録開始日より前のものがあれば、記録開始日を繰り上げる。
    const earliestKey = dayKeys.reduce((min, k) => (k < min ? k : min), dayKeys[0]);
    let appStartDateChanged = false;
    if (!store.appStartDate || earliestKey < store.appStartDate) {
      store.appStartDate = earliestKey;
      appStartDateChanged = true;
    }

    let updated = 0;
    dayKeys.forEach(key => {
      if (!store.days[key]) store.days[key] = { events: [], eventDone: {}, quests: [] };
      const day = store.days[key];
      if (!day.quests) day.quests = [];
      const label = key === today
        ? "kyotsu-math（自動記録）（本日" + perDay[key] + "問）"
        : "kyotsu-math（自動記録）（" + perDay[key] + "問）";
      const existing = day.quests.find(q => q.autoSource === "kyotsu-math");
      if (existing) {
        if (existing.label !== label || !existing.done) {
          existing.label = label;
          existing.done = true;
          updated++;
        }
      } else {
        day.quests.push({ label: label, done: true, tag: "数学", autoSource: "kyotsu-math" });
        updated++;
      }
    });

    if (updated === 0 && !appStartDateChanged) return { ok: true, updatedDays: 0, totalDaysFound: dayKeys.length };

    store._updatedAt = Date.now();
    await setDoc(doc(db, "dailyquest-logs", uid), {
      data: JSON.stringify(store),
      clientUpdatedAt: store._updatedAt,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { ok: true, updatedDays: updated, totalDaysFound: dayKeys.length };
  } catch (e) {
    console.warn("[sync] backfill失敗", e);
    return { ok: false, reason: String(e) };
  }
}

/* =========================================================
   同期処理
   ========================================================= */
async function syncAll(opts) {
  if (!currentUser || busy) return;
  busy = true;
  const silent = opts && opts.silent;
  if (!silent) log("同期中…");

  let changedLocal = false;
  const units = new Set(unitKeys());
  console.log("[sync] ローカル既知の単元数:", units.size);

  // サーバー側にしか無い単元も拾う。一覧で受け取ったドキュメントの中身は、そのまま remote として使う
  // （単元ごとに getDoc で取り直さない＝同じ payload を2回ダウンロードしない）。一覧に無い単元は remote なし
  let listFailed = false;
  let remoteMap = null;   // 一覧の取得に成功したときだけ使う（unit → payload）
  try {
    const snap = await getDocs(collection(db, "users", targetUid(), "units"));
    const map = new Map();
    snap.forEach(d => { units.add(d.id); map.set(d.id, parsePayload(d.data())); });
    remoteMap = map;
  } catch (e) {
    // 一覧が取れなくても既知の単元だけで続行するが、原因が見えないと詰むので必ずログに出す
    console.error("[sync] unit一覧の取得に失敗:", e);
    listFailed = true;   // この場合は最後に「同期済み」で上書きしない
    if (!silent) log("単元一覧の取得に失敗しました（" + ((e && e.code) || e) + "）", "#991b1b");
  }
  console.log("[sync] 同期対象の単元数（サーバー分含む）:", units.size, Array.from(units));

  const failed = [];
  for (const unit of units) {
    try {
      const local = readLocal(unit);
      // 一覧が取れたらその中身を使う。一覧の取得に失敗したときだけ、単元ごとに取りに行く（従来の方法）
      const remote = remoteMap ? (remoteMap.has(unit) ? remoteMap.get(unit) : null) : await fetchRemote(unit);
      if (!local && !remote) continue;

      const merged = mergeUnitData(local, remote);
      const mergedStr = JSON.stringify(merged);

      // ローカルに書き戻し（変化があった場合のみ）
      const localStr = local ? JSON.stringify(local) : null;
      if (mergedStr !== localStr) {
        setItemRaw(PREFIX + unit, mergedStr);
        changedLocal = true;
      }

      // サーバーに書き戻し（変化があった場合のみ）
      // 保護者（閲覧モード）は絶対にアップロードしない＝検証プレイのログを汚さない
      const remoteStr = remote ? JSON.stringify(remote) : null;
      if (mergedStr !== remoteStr && !isGuardian()) {
        await writeRemote(unit, merged);
      }
    } catch (e) {
      console.error("[sync] unit failed: " + unit, e);
      failed.push(unit);
    }
  }

  // 失敗した単元は未送信として残す（通信が戻ったときや次の保存で pushDirty が送り直す）
  if (!isGuardian()) failed.forEach(unit => dirtyUnits.add(unit));
  busy = false;
  if (failed.length > 0) {
    log(UNSENT_MSG, "#991b1b");
  } else if (!listFailed) {
    const t = new Date().toLocaleTimeString("ja-JP");
    log("同期済み（" + t + "）", "#166534");
  }
  pushSummary();
  afterBusy();

  // 画面に出ている単元のデータが書き換わったら、1回だけリロードして反映
  // 手動の「今すぐ同期」で押されたときは、リロード回数の制限を無視して必ず反映する
  //（自動同期のほうは従来どおり1セッション1回のまま＝ループ防止）
  if (changedLocal && ((opts && opts.forceReload) || !sessionStorage.getItem(RELOAD_FLAG))) {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    log("他の端末のデータを取り込みました。画面を更新します…", "#166534");
    setTimeout(() => location.reload(), 900);
  }
}

/* localStorage.setItem を横取りして、保存を検知したら遅延アップロード */
const setItemRaw = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  setItemRaw(key, value);
  // 保護者（閲覧モード）は検証プレイで書き込んでもアップロード対象に積まない
  // 同期中（busy）の保存も取りこぼさない（同期処理自身は setItemRaw で書くのでここには来ない）
  if (typeof key === "string" && key.indexOf(PREFIX) === 0 && currentUser && !isGuardian()) {
    dirtyUnits.add(key.slice(PREFIX.length));
    if (busy) savedWhileBusy = true;
    schedulePush();
  }
};

async function pushDirty() {
  if (!currentUser || busy || dirtyUnits.size === 0 || isGuardian()) return;
  busy = true;
  const targets = Array.from(dirtyUnits);
  dirtyUnits.clear();

  const failed = [];
  for (const unit of targets) {
    try {
      const local = readLocal(unit);
      if (!local) continue;
      const remote = await fetchRemote(unit);
      const merged = mergeUnitData(local, remote);
      await writeRemote(unit, merged);
    } catch (e) {
      console.error("[sync] push failed: " + unit, e);
      failed.push(unit);
    }
  }
  // 失敗した単元だけ未送信として残す（成功した単元は戻さない）
  failed.forEach(unit => dirtyUnits.add(unit));
  busy = false;
  if (failed.length > 0) {
    log(UNSENT_MSG, "#991b1b");
  } else {
    log("同期済み（" + new Date().toLocaleTimeString("ja-JP") + "）", "#166534");
  }
  pushSummary();   // サマリーは単元本体とは別。失敗しても単元は未送信扱いにしない（次の push で local から計算し直す）
  afterBusy();
}

/* =========================================================
   UI 注入
   ========================================================= */
function injectUI() {
  if (document.getElementById("syncPanel")) return true;
  const anchor = document.getElementById("saveStatus");
  if (!anchor) return false;

  const box = document.createElement("div");
  box.id = "syncPanel";
  box.style.marginTop = "12px";
  box.style.paddingTop = "10px";
  box.style.borderTop = "1px dashed #cbd5e1";
  box.innerHTML =
    '<div class="small-text" style="margin-bottom:6px;"><strong>端末間同期</strong>（スマホ⇔iPad）</div>' +
    '<div id="syncLoggedOut">' +
    '  <input id="syncEmail" type="email" autocomplete="username" placeholder="メールアドレス" ' +
    '    style="width:100%;padding:8px;margin-bottom:6px;border:1px solid #cbd5e1;border-radius:6px;font-size:16px;">' +
    '  <input id="syncPass" type="password" autocomplete="current-password" placeholder="パスワード" ' +
    '    style="width:100%;padding:8px;margin-bottom:6px;border:1px solid #cbd5e1;border-radius:6px;font-size:16px;">' +
    '  <div class="stack-buttons"><button class="btn primary" id="syncLoginBtn">ログインして同期</button></div>' +
    '</div>' +
    '<div id="syncLoggedIn" style="display:none;">' +
    '  <div class="small-text" id="syncWho" style="margin-bottom:6px;"></div>' +
    '  <div class="stack-buttons">' +
    '    <button class="btn primary" id="syncNowBtn">今すぐ同期</button>' +
    '    <button class="btn secondary" id="syncLogoutBtn">ログアウト</button>' +
    '  </div>' +
    '  <div class="stack-buttons" id="syncBackfillRow" style="display:none;margin-top:6px;">' +
    '    <button class="btn secondary" id="syncBackfillBtn">過去ログをデイリークエストに反映</button>' +
    '  </div>' +
    '  <div class="stack-buttons" id="syncResetRow" style="display:none;margin-top:6px;">' +
    '    <button class="btn secondary" id="syncResetBtn" style="color:#991b1b;border-color:#991b1b;">このPCの検証データをリセット</button>' +
    '  </div>' +
    '</div>' +
    '<div class="small-text" id="syncStatus" style="margin-top:6px;">未ログイン</div>';

  anchor.parentNode.appendChild(box);

  document.getElementById("syncLoginBtn").addEventListener("click", doLogin);
  document.getElementById("syncPass").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("syncNowBtn").addEventListener("click", () => {
    sessionStorage.removeItem(RELOAD_FLAG);
    syncAll({ forceReload: true });
  });
  document.getElementById("syncLogoutBtn").addEventListener("click", () => signOut(auth));
  document.getElementById("syncResetBtn").addEventListener("click", resetLocalTestData);
  document.getElementById("syncBackfillBtn").addEventListener("click", async () => {
    const btn = document.getElementById("syncBackfillBtn");
    btn.disabled = true;
    const r = await backfillDailyQuestLogs();
    btn.disabled = false;
    if (!r.ok) {
      if (r.reason === "no-dailyquest-doc") {
        alert("デイリークエスト側の記録がまだ見つかりませんでした。先にデイリークエストのアプリを一度開いてから、もう一度試してください。");
      } else {
        alert("反映に失敗しました。もう一度試してみてください。");
      }
      return;
    }
    if (r.updatedDays > 0) {
      alert("デイリークエストに" + r.updatedDays + "日分の記録を反映しました！");
    } else {
      alert("すでに最新の状態でした（今回は追加・更新はありませんでした）。");
    }
  });
  return true;
}

/* =========================================================
   保護者（閲覧モード）専用：このPCに溜まった検証ログを消して、
   クラウド上の子どものデータだけをまっさらに取り直す。
   ※ Firestoreには一切書き込まない（isGuardian()中はwriteRemoteが
     呼ばれない設計なので、このリセットもローカルだけの操作）。
   ========================================================= */
async function resetLocalTestData() {
  if (!isGuardian()) return; // 念のため：閲覧モード以外では動かさない
  if (!confirm("このPCに保存されている検証プレイのログを消して、子どものデータだけを取り直します。よろしいですか？")) return;

  log("リセット中…");
  unitKeys().forEach(unit => localStorage.removeItem(PREFIX + unit));
  // 「図形と計量(keiryo)」だけ、v14キーが無いとv13時代の旧データを自動で
  // 引き継いでしまう移行処理がapp.js側にある（STORAGE_PREFIX導入前の名残）。
  // これを消さないとリセットしても keiryo だけゾンビのように復活するので、
  // 念のためこちらも一緒に消しておく。
  localStorage.removeItem("kyotsu_app_v13");
  sessionStorage.removeItem(RELOAD_FLAG);

  try {
    await syncAll({ forceReload: true, silent: true });
  } catch (e) {
    console.error("[sync] reset failed", e);
  }
  // クラウド側にも何も無い（＝比較のしようがない）ケースだと syncAll 内部では
  // 「変化なし」判定でリロードされないことがある。リセットは押した時点で
  // 必ず画面をまっさらにしたいので、ここで無条件にリロードする。
  log("リセットしました。画面を更新します…", "#166534");
  setTimeout(() => location.reload(), 500);
}

async function doLogin() {
  const email = (document.getElementById("syncEmail").value || "").trim();
  const pass = document.getElementById("syncPass").value || "";
  if (!email || !pass) { log("メールアドレスとパスワードを入れてください。", "#991b1b"); return; }
  log("ログイン中…");
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    const code = (e && e.code) || "";
    let msg = "ログインに失敗しました（" + code + "）";
    if (code.indexOf("wrong-password") >= 0 || code.indexOf("invalid-credential") >= 0) {
      msg = "メールアドレスかパスワードが違います。";
    } else if (code.indexOf("user-not-found") >= 0) {
      msg = "そのユーザーが見つかりません。Firebaseコンソールで作成してください。";
    } else if (code.indexOf("network") >= 0) {
      msg = "ネットワークに繋がりません。オフラインでも学習は続けられます。";
    }
    log(msg, "#991b1b");
  }
}

function renderAuthUI() {
  const out = document.getElementById("syncLoggedOut");
  const inn = document.getElementById("syncLoggedIn");

  // ✅ ヘッダー側の「ログイン中」表示（通常画面・問題演習画面の両方）
  // exam-mode中はサイドバーのsyncPanelが隠れるので、ここが唯一の目印になる。
  const syncCardTop = document.getElementById("syncStatusCardTop");
  const syncPillExam = document.getElementById("syncPillExam");
  const whoText = currentUser
    ? "ログイン中: " + (currentUser.email || currentUser.uid) + (isGuardian() ? "（閲覧のみ・アップロードなし）" : "")
    : "";
  [syncCardTop, syncPillExam].forEach((elm) => {
    if (!elm) return;
    elm.style.display = currentUser ? (elm === syncCardTop ? "block" : "inline-flex") : "none";
    if (currentUser) elm.title = whoText;
  });

  const resetRow = document.getElementById("syncResetRow");
  if (resetRow) resetRow.style.display = (currentUser && isGuardian()) ? "block" : "none";

  const backfillRow = document.getElementById("syncBackfillRow");
  if (backfillRow) backfillRow.style.display = (currentUser && !isGuardian()) ? "block" : "none";

  if (!out || !inn) return;
  if (currentUser) {
    out.style.display = "none";
    inn.style.display = "block";
    document.getElementById("syncWho").innerText = whoText;
  } else {
    out.style.display = "block";
    inn.style.display = "none";
    log("未ログイン（このままでも学習データは端末内に保存されます）");
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user || null;
  renderAuthUI();
  if (currentUser) {
    log("ログインしました。同期します…", "#166534");
    syncAll({});
  }
});

/* ページを離れるとき、未送信ぶんを可能な範囲で送る */
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && dirtyUnits.size > 0) {
    clearTimeout(pushTimer);
    pushDirty();
  }
});

/* 通信が戻ったら、未送信ぶんを送る */
window.addEventListener("online", () => {
  if (dirtyUnits.size > 0) {
    clearTimeout(pushTimer);
    pushDirty();
  }
});

/* 起動 */
function boot() {
  if (injectUI()) { renderAuthUI(); return; }
  const obs = new MutationObserver(() => {
    if (injectUI()) { renderAuthUI(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

/* デバッグ用 */
window.kyotsuSync = { syncAll, mergeUnitData, readLocal, buildSummary, pushSummary, backfillDailyQuestLogs };
