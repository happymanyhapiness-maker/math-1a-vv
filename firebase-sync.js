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
  getFirestore, doc, getDoc, setDoc, collection, getDocs
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

// 学習データのキーは storage-ns.js（KyotsuNS）が context ごとに作る（Phase 8A）。旧キー kyotsu_app_v14_ は読み書きしない
const NS = globalThis.KyotsuNS;
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
// 今のページの context（Phase 8A）。gen はこのページ内の世代番号で、context が変わる（ログイン・ログアウト・
// アカウント切替）と増える。非同期処理は開始時の gen を覚えておき、await のあとと local / remote を書き換える直前に
// alive(gen) を確かめる。違えば何も書かずに終わる（古い context の処理が新しい context を変えない）。
let activeCtx = null;   // { state, authUid, role, storageOwnerUid, remoteTargetUid, guestSessionId, lastAuth }
let ctxGen = 0;
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
  return !!activeCtx && activeCtx.state === "authenticated" && activeCtx.role === "guardian";
}

/* 読み書き先のuid。保護者なら常に子ども側のuidを見る（＝閲覧モード） */
function targetUid() {
  if (!activeCtx || activeCtx.state !== "authenticated" || !activeCtx.remoteTargetUid) throw new Error("no-authenticated-context");
  return activeCtx.remoteTargetUid;
}

// 開始時の世代のまま、ログイン中の context が続いているか
function alive(gen) {
  return gen === ctxGen && !!activeCtx && activeCtx.state === "authenticated";
}

// Auth のユーザーから、このページで使う context を決める
function contextFor(user) {
  const stored = NS.readContext();
  const lastAuth = stored && stored.lastAuth ? stored.lastAuth : null;
  if (!user) {
    // 未ログイン：続きの session があればそれ、無ければ直前のアカウントを由来として新しく作る
    const sid = NS.ensureActiveGuestSession(lastAuth);
    return { state: "guest", authUid: null, role: null, storageOwnerUid: null, remoteTargetUid: null, guestSessionId: sid, lastAuth };
  }
  const guardian = GUARDIAN_UIDS.indexOf(user.uid) >= 0;
  const role = guardian ? "guardian" : "learner";
  return { state: "authenticated", authUid: user.uid, role,
    storageOwnerUid: user.uid,                           // local の書き込み先は常に自分（保護者は自分の検証用）
    remoteTargetUid: guardian ? CHILD_UID : user.uid,    // Firestore は本人なら自分、保護者なら子ども（読むだけ）
    guestSessionId: null, lastAuth: { uid: user.uid, role } };
}

// context を無効にする（非同期処理・タイマー・未送信の記録をこの世代で打ち切る）
function invalidateContext() {
  ctxGen++;
  activeCtx = null;
  currentUser = null;
  clearTimeout(pushTimer);
  pushTimer = null;
  dirtyUnits = new Set();
  busy = false;
  savedWhileBusy = false;
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch (e) { /* 何もしない */ }
}

/* =========================================================
   小道具
   ========================================================= */
function log(msg, color) {
  const s = document.getElementById("syncStatus");
  if (s) { s.innerText = msg; s.style.color = color || "#475569"; }
  console.log("[sync] " + msg);
}

// 自分の書き込み領域（本人・保護者自身・guest session）の接頭辞。確認中は null
function ownPrefixNow() {
  return activeCtx ? NS.ownPrefix(activeCtx) : null;
}

function unitKeys() {
  const p = ownPrefixNow();
  if (!p) return [];
  const keys = new Set();
  if (typeof UNIT_META !== "undefined") Object.keys(UNIT_META).forEach(k => keys.add(k));
  NS.unitsWithPrefix(p).forEach(k => keys.add(k));
  return Array.from(keys);
}

function readLocal(unit) {
  const p = ownPrefixNow();
  if (!p) return null;
  const raw = localStorage.getItem(p + unit);
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

/* 未ログインの学習から本人へ足した累計（Phase 8A）
   state.guestImportDeltas = { "<sessionId>": { weakness: {名前: 回数}, stage: {"第n問": {t, c}}, clearedCount: n } }
   ・取り込んだ session ごとに「その session から足した量」を、あとで変わらない値として持つ（取り込み済みの印も兼ねる）。
   ・merge では、各側の stats から自分の持つ delta の合計を引いた「通常の学習の累計」を今までどおり大きい方で合わせ、
     そこへ両側の delta の和集合（session ごと）の合計を足す。別々の端末が別々の session を取り込んでも失わず、
     同じ session を両側が持っていても1回分だけ。 */
const posInt = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.floor(v) : 0);
function normalizeDelta(d) {
  const src = d && typeof d === "object" ? d : {};
  const out = { weakness: {}, stage: {}, clearedCount: posInt(src.clearedCount) };
  Object.keys(src.weakness || {}).sort().forEach((k) => { const v = posInt(src.weakness[k]); if (v) out.weakness[k] = v; });
  Object.keys(src.stage || {}).sort().forEach((k) => {
    const e = src.stage[k] || {};
    const t = posInt(e.t), c = posInt(e.c);
    if (t || c) out.stage[k] = { t, c };
  });
  return out;
}
function normalizeDeltas(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  Object.keys(obj).filter((id) => /^[A-Za-z0-9-]+$/.test(id)).sort().forEach((id) => { out[id] = normalizeDelta(obj[id]); });
  return out;
}
// 両側の delta を session ごとに合わせる。同じ session の delta は本来同じ（取り込みは1回・guest の領域は閉じたあと変わらない）。
// 万一違えば、項目ごとに大きい方（順番に依存しない・何度やっても同じ）
function unionDeltas(a, b) {
  const out = normalizeDeltas(a);
  const nb = normalizeDeltas(b);
  Object.keys(nb).forEach((id) => {
    if (!out[id]) { out[id] = nb[id]; return; }
    const x = out[id], y = nb[id];
    const m = { weakness: {}, stage: {}, clearedCount: Math.max(x.clearedCount, y.clearedCount) };
    Array.from(new Set(Object.keys(x.weakness).concat(Object.keys(y.weakness)))).sort().forEach((k) => { m.weakness[k] = Math.max(x.weakness[k] || 0, y.weakness[k] || 0); });
    Array.from(new Set(Object.keys(x.stage).concat(Object.keys(y.stage)))).sort().forEach((k) => {
      const p = x.stage[k] || { t: 0, c: 0 }, q = y.stage[k] || { t: 0, c: 0 };
      m.stage[k] = { t: Math.max(p.t, q.t), c: Math.max(p.c, q.c) };
    });
    out[id] = m;
  });
  const sorted = {};
  Object.keys(out).sort().forEach((id) => { sorted[id] = out[id]; });
  return sorted;
}
function sumDeltas(ds) {
  const total = { weakness: {}, stage: {}, clearedCount: 0 };
  Object.keys(ds || {}).forEach((id) => {
    const d = ds[id];
    Object.keys(d.weakness).forEach((k) => { total.weakness[k] = (total.weakness[k] || 0) + d.weakness[k]; });
    Object.keys(d.stage).forEach((k) => {
      const e = total.stage[k] || { t: 0, c: 0 };
      total.stage[k] = { t: e.t + d.stage[k].t, c: e.c + d.stage[k].c };
    });
    total.clearedCount += d.clearedCount;
  });
  return total;
}
// 累計（weakness / stage / clearedCount）に delta の合計を足した新しい stats を返す（入力は変更しない）
function addGuestCounters(stats, gStats) {
  const out = Object.assign({}, stats || {});
  const g = gStats || {};
  const num = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : 0);
  out.weakness = Object.assign({}, out.weakness || {});
  Object.keys(g.weakness || {}).forEach((k) => { out.weakness[k] = num(out.weakness[k]) + num(g.weakness[k]); });
  out.stage = Object.assign({}, out.stage || {});
  Object.keys(g.stage || {}).forEach((k) => {
    const a = out.stage[k] || {}, b = g.stage[k] || {};
    out.stage[k] = { t: num(a.t) + num(b.t), c: num(a.c) + num(b.c) };
  });
  out.clearedCount = num(out.clearedCount) + num(g.clearedCount);
  return out;
}
// 累計（weakness / stage / clearedCount）から delta の合計を引いた値（0 未満にはしない）。ほかの stats の項目はそのまま
function subtractCounters(stats, total) {
  const src = stats || {};
  const out = Object.assign({}, src, { weakness: Object.assign({}, src.weakness || {}), stage: Object.assign({}, src.stage || {}) });
  Object.keys(total.weakness).forEach((k) => { out.weakness[k] = Math.max(0, posInt(out.weakness[k]) - total.weakness[k]); });
  Object.keys(total.stage).forEach((k) => {
    const e = out.stage[k] || {};
    out.stage[k] = { t: Math.max(0, posInt(e.t) - total.stage[k].t), c: Math.max(0, posInt(e.c) - total.stage[k].c) };
  });
  out.clearedCount = Math.max(0, posInt(out.clearedCount) - total.clearedCount);
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
  // 未ログインの学習から足した累計（Phase 8A）：session ID 順・項目名順にそろえる。空ならキーを消す
  if ("guestImportDeltas" in state) {
    const ds = normalizeDeltas(state.guestImportDeltas);
    if (Object.keys(ds).length) state.guestImportDeltas = ds;
    else delete state.guestImportDeltas;
  }
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
  // 未ログインの学習から足した累計（Phase 8A）：同じ世代なら session ごとの和集合（下の stats の計算でも使う）
  const hasDeltas = ("guestImportDeltas" in nS || "guestImportDeltas" in oS);
  const nDeltas = normalizeDeltas(nS.guestImportDeltas), oDeltas = normalizeDeltas(oS.guestImportDeltas);
  const allDeltas = hasDeltas ? unionDeltas(oDeltas, nDeltas) : null;
  if (hasDeltas) mergedFields.guestImportDeltas = allDeltas;
  // 古い回答の archive：同じ世代なら event の和集合（どちらにも無ければキーを作らない）
  if (("logArchive" in nS || "logArchive" in oS) && globalThis.LogArchive) {
    mergedFields.logArchive = globalThis.LogArchive.unionArchives(oS.logArchive, nS.logArchive);
  }
  const state = Object.assign({}, oS, nS, mergedFields);
  delete state.tipList;   // 旧仕様の tipList（使っていない）は、古い local / remote / 端末から来ても出力しない

  // --- stats: 累積カウンタなので「大きい方」を採用（足すと二重計上になる） ---
  //  未ログインの学習から足した分（guestImportDeltas）があれば、各側からその側の delta を引いた「通常の学習の累計」を
  //  大きい方で合わせ、最後に両側の delta の和集合の合計を足す（Phase 8A）
  const nT = newer.stats || {}, oT = older.stats || {};
  const nC = hasDeltas ? subtractCounters(nT, sumDeltas(nDeltas)) : nT;
  const oC = hasDeltas ? subtractCounters(oT, sumDeltas(oDeltas)) : oT;
  const stats = { weakness: {}, stage: {}, clearedCount: 0 };
  const wKeys = new Set([].concat(Object.keys(nC.weakness || {}), Object.keys(oC.weakness || {})));
  wKeys.forEach(k => {
    stats.weakness[k] = Math.max((nC.weakness || {})[k] || 0, (oC.weakness || {})[k] || 0);
  });
  const sKeys = new Set([].concat(Object.keys(nC.stage || {}), Object.keys(oC.stage || {})));
  sKeys.forEach(k => {
    const a2 = (nC.stage || {})[k] || { t: 0, c: 0 };
    const b2 = (oC.stage || {})[k] || { t: 0, c: 0 };
    stats.stage[k] = { t: Math.max(a2.t || 0, b2.t || 0), c: Math.max(a2.c || 0, b2.c || 0) };
  });
  stats.clearedCount = Math.max(nC.clearedCount || 0, oC.clearedCount || 0);
  if (hasDeltas) {
    const add = addGuestCounters(stats, sumDeltas(allDeltas));
    stats.weakness = add.weakness; stats.stage = add.stage; stats.clearedCount = add.clearedCount;
  }

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
    device: navigator.userAgent.slice(0, 120),
    w: NS.WRITER_MARKER   // Phase 8A 以降のクライアントの印（丸ごと上書きなので、古いクライアントの書き込みには付かない）
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
   plannerの「今日のクエスト」に、専用フィールド kyotsuMathAuto で反映する
   ・dailyquest-logs/{uid} のトップレベルフィールド kyotsuMathAuto だけを
     setDoc(merge:true) で書く：
       kyotsuMathAuto: { "YYYY-MM-DD": { date, source:"kyotsu-math", count, updatedAt } }
     LEAP側の leapAuto・英コミュ側の eikomiAuto と同じ考え方
     （日付キーごとのFirestoreネイティブmap）。
   ・plannerの store（dataフィールドのJSON文字列）は一切読まない・書かない。
     merge:trueはネストしたmapもキー単位でマージされるため、今日の日付キー
     だけを更新でき、他の日付キーや data / leapAuto / eikomiAuto には
     一切触れない。
   ・plannerの記録がまだ一度も存在しない場合は何もしない（安全側）。
   ・保護者（閲覧モード）では絶対に動かさない。
   ========================================================= */
async function pushDailyQuestToday(s, gen) {
  if (!currentUser || isGuardian()) return;
  if (gen === undefined) gen = ctxGen;
  if (!alive(gen)) return;
  const uid = targetUid();
  const today = todayKeyJST();
  const count = s.todayCount || 0;
  if (count <= 0) return; // 今日まだ0件なら書かない（Planner側もcount<=0の記録は表示しない）
  try {
    const ref = doc(db, "dailyquest-logs", uid);
    const snap = await getDoc(ref);
    if (!alive(gen)) return;
    if (!snap.exists()) return;
    const existing = snap.data().kyotsuMathAuto || {};
    const prev = existing[today];
    if (prev && prev.count === count) return; // 変化なし。同日再実行での重複書き込みを避ける
    await setDoc(ref, {
      kyotsuMathAuto: { [today]: { date: today, source: "kyotsu-math", count, updatedAt: Date.now() } }
    }, { merge: true });
  } catch (e) {
    console.warn("[sync] dailyquest push失敗", e);
  }
}

async function pushSummary(gen) {
  if (!currentUser || isGuardian()) return; // 閲覧モードでは絶対に書かない
  if (gen === undefined) gen = ctxGen;
  if (!alive(gen)) return;
  try {
    const s = buildSummary();
    await setDoc(doc(db, SUMMARY_COLLECTION, targetUid()), {
      lastStudiedAt: s.lastStudiedAt,
      todayCount: s.todayCount,
      totalCount: s.totalCount,
      updatedAt: Date.now(),
      w: NS.WRITER_MARKER,
      client: NS.CLIENT_VERSION   // rollout の確認用（どの版のクライアントが最後に同期したか）
    });
    if (alive(gen)) pushDailyQuestToday(s, gen);
  } catch (e) {
    console.error("[sync] summary push failed", e);
  }
}

/* =========================================================
   過去の学習履歴を、kyotsuMathAuto へ一括で反映する（一回限りの移行用）
   ・全単元のanswerLogを日付ごとに集計し、dailyquest-logs/{uid}.kyotsuMathAuto
     の各日付キーへ { date, source:"kyotsu-math", count, updatedAt } として書き込む。
   ・plannerの記録が一度も存在しない場合は何もしない（安全のため）。
   ・data・leapAuto・eikomiAuto・既存data.days内のautoSource:"kyotsu-math"
     には一切触れない（削除・移行・書き換えのいずれもしない）。
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

  try {
    const ref = doc(db, "dailyquest-logs", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, reason: "no-dailyquest-doc" };
    const existing = snap.data().kyotsuMathAuto || {};

    const updates = {};
    let updated = 0;
    dayKeys.forEach(key => {
      const count = perDay[key];
      const prev = existing[key];
      if (prev && prev.count === count) return; // 変化なし
      updates[key] = { date: key, source: "kyotsu-math", count, updatedAt: Date.now() };
      updated++;
    });

    if (updated === 0) return { ok: true, updatedDays: 0, totalDaysFound: dayKeys.length };

    await setDoc(ref, { kyotsuMathAuto: updates }, { merge: true });
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
  if (!currentUser || busy || !activeCtx || activeCtx.state !== "authenticated") return;
  const gen = ctxGen;
  // 保護者は子どもの remote を閲覧用キャッシュに入れるだけ（自分の検証データとは merge しない・何も送らない）
  if (isGuardian()) return refreshGuardianView(gen, opts);
  busy = true;
  const silent = opts && opts.silent;
  if (!silent) log("同期中…");

  let changedLocal = false;
  const units = new Set(unitKeys());
  const prefix = ownPrefixNow();
  console.log("[sync] ローカル既知の単元数:", units.size);

  // サーバー側にしか無い単元も拾う。一覧で受け取ったドキュメントの中身は、そのまま remote として使う
  // （単元ごとに getDoc で取り直さない＝同じ payload を2回ダウンロードしない）。一覧に無い単元は remote なし
  let listFailed = false;
  let remoteMap = null;   // 一覧の取得に成功したときだけ使う（unit → payload）
  try {
    const snap = await getDocs(collection(db, "users", targetUid(), "units"));
    if (!alive(gen)) return;
    const map = new Map();
    snap.forEach(d => { units.add(d.id); map.set(d.id, parsePayload(d.data())); });
    remoteMap = map;
  } catch (e) {
    if (!alive(gen)) return;
    // 一覧が取れなくても既知の単元だけで続行するが、原因が見えないと詰むので必ずログに出す
    console.error("[sync] unit一覧の取得に失敗:", e);
    listFailed = true;   // この場合は最後に「同期済み」で上書きしない
    if (!silent) log("単元一覧の取得に失敗しました（" + ((e && e.code) || e) + "）", "#991b1b");
  }
  console.log("[sync] 同期対象の単元数（サーバー分含む）:", units.size, Array.from(units));

  const failed = [];
  const synced = new Set();
  for (const unit of units) {
    if (!alive(gen)) return;
    try {
      const local = readLocal(unit);
      // 一覧が取れたらその中身を使う。一覧の取得に失敗したときだけ、単元ごとに取りに行く（従来の方法）
      const remote = remoteMap ? (remoteMap.has(unit) ? remoteMap.get(unit) : null) : await fetchRemote(unit);
      if (!alive(gen)) return;
      if (!local && !remote) continue;

      const merged = mergeUnitData(local, remote);
      const mergedStr = JSON.stringify(merged);

      // ローカルに書き戻し（変化があった場合のみ）
      const localStr = local ? JSON.stringify(local) : null;
      if (mergedStr !== localStr) {
        if (!alive(gen)) return;
        setItemRaw(prefix + unit, mergedStr);
        changedLocal = true;
      }

      // サーバーに書き戻し（変化があった場合のみ）
      const remoteStr = remote ? JSON.stringify(remote) : null;
      if (mergedStr !== remoteStr) {
        if (!alive(gen)) return;
        await writeRemote(unit, merged);
        if (!alive(gen)) return;
      }
      synced.add(unit);
    } catch (e) {
      if (!alive(gen)) return;
      console.error("[sync] unit failed: " + unit, e);
      failed.push(unit);
    }
  }
  if (!alive(gen)) return;

  // 未ログインの学習の取り込み（本人のアカウントだけ）と、旧キーの確認（書き込みはしない）
  if (!listFailed) {
    const imported = await importGuestSessions(gen, synced);
    if (!alive(gen)) return;
    if (imported) changedLocal = true;
    checkLegacyLocal(gen);
  }
  if (!alive(gen)) return;

  // 失敗した単元は未送信として残す（通信が戻ったときや次の保存で pushDirty が送り直す）
  failed.forEach(unit => dirtyUnits.add(unit));
  busy = false;
  if (failed.length > 0) {
    log(UNSENT_MSG, "#991b1b");
  } else if (!listFailed) {
    const t = new Date().toLocaleTimeString("ja-JP");
    log("同期済み（" + t + "）", "#166534");
  }
  pushSummary(gen);
  afterBusy();

  // 画面に出ている単元のデータが書き換わったら、1回だけリロードして反映
  // 手動の「今すぐ同期」で押されたときは、リロード回数の制限を無視して必ず反映する
  //（自動同期のほうは従来どおり1セッション1回のまま＝ループ防止）
  if (changedLocal && ((opts && opts.forceReload) || !sessionStorage.getItem(RELOAD_FLAG))) {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    log("他の端末のデータを取り込みました。画面を更新します…", "#166534");
    setTimeout(() => { if (alive(gen)) location.reload(); }, 900);
  }
}

/* 保護者：子どもの remote を閲覧用キャッシュ（kyotsu_view_v1_{保護者}_{子ども}_{unit}）へそのまま入れる。
   保護者自身の検証データ（自分の領域）とは混ぜない。Firestore へは何も書かない。 */
async function refreshGuardianView(gen, opts) {
  busy = true;
  const silent = opts && opts.silent;
  if (!silent) log("子どものデータを取得中…");
  const vp = NS.viewPrefix(activeCtx.storageOwnerUid, activeCtx.remoteTargetUid);
  try {
    const snap = await getDocs(collection(db, "users", targetUid(), "units"));
    if (!alive(gen)) return;
    const seen = new Set();
    snap.forEach(d => {
      const p = parsePayload(d.data());
      if (!p || !vp || !alive(gen)) return;
      seen.add(d.id);
      setItemRaw(vp + d.id, JSON.stringify(p));
    });
    // remote に無くなった単元の閲覧用キャッシュは消す（一覧が取れたときだけ）
    NS.unitsWithPrefix(vp).forEach(u => { if (!seen.has(u) && alive(gen)) localStorage.removeItem(vp + u); });
    busy = false;
    log("子どものデータを表示中（" + new Date().toLocaleTimeString("ja-JP") + "・閲覧のみ）", "#166534");
  } catch (e) {
    if (!alive(gen)) return;
    busy = false;
    console.error("[sync] guardian view failed", e);
    log("子どものデータを取得できませんでした（" + ((e && e.code) || e) + "）", "#991b1b");
  }
}

/* =========================================================
   未ログインの学習（guest session）の取り込み（Phase 8A）
   ・本人（learner）のアカウントだけ。保護者でログインしたときは取り込まない（確認も出さない）。
   ・session の由来：
       直前が同じ本人（originUid === 本人）        → 自動で取り込む
       由来なし（最初から未ログイン）              → 自動で取り込む（未ログインで学習するのは子ども、という運用）
       保護者由来・別の本人由来                    → 取り込まずに残す
   ・単元ごとに、取り込み先の今の世代（resetGen）が
       由来が本人の session：session 開始時の世代（baseGen）と同じ
       由来なし：0
     のときだけ取り込む。違えば（別端末でリセットされた可能性）取り込まずに残す。
   ・guest の resetGen・画面位置・mode・shuffle・timer などは持ち込まない。
   ・学習の事実（回答ログ・archive・rescueLog・誤答リスト・復習の状態・卒業時刻・前回結果）は merge（和集合）。
     弱点・ステージの累計・卒業数（stats.weakness / stats.stage / stats.clearedCount）は独立した累計値なので、
     guest の領域にある値（＝その session で増えた分。guest の領域は空から始まり、guest 内のリセットで 0 に戻る）を
     本人の今の値に足す。
   ・足した量は単元データの state.guestImportDeltas[session ID] に、あとで変わらない値として入れる（同じ payload で
     local・Firestore に保存。merge では session ごとの和集合で、別々の端末の取り込み分も失わない）。
     その session ID がすでにあれば、足さずに確認だけする（取り込み済みの印も兼ねる）。
   ・Firestore へ書いて読み直し、guest の回答と session ID の両方が remote にあると確かめてから取り込み済みにする。
   ========================================================= */
function guestFacts(g, targetGen) {
  const s = g.state || {}, t = g.stats || {};
  const state = { unit: s.unit, answerLog: Array.isArray(s.answerLog) ? s.answerLog : [], wrong: Array.isArray(s.wrong) ? s.wrong : [],
    reviewMeta: s.reviewMeta && typeof s.reviewMeta === "object" ? s.reviewMeta : {} };
  if (s.graduatedAt && typeof s.graduatedAt === "object") state.graduatedAt = s.graduatedAt;
  if (s.logArchive) state.logArchive = s.logArchive;
  if (s.rescueLog) state.rescueLog = s.rescueLog;
  if (targetGen > 0) state.resetGen = targetGen;   // 取り込み先の今の世代の記録として入れる（guest 側の resetGen は使わない）
  // 累計（weakness / stage / clearedCount）はここに入れない（merge の「大きい方」ではなく、下で足し算する）
  const stats = {};
  if (t.questionHistory && typeof t.questionHistory === "object") stats.questionHistory = t.questionHistory;
  return { state, stats };
}
function eventKeysOf(d) {
  const out = new Set();
  const LA = globalThis.LogArchive;
  if (!d || !d.state || !LA) return out;
  Object.entries(LA.normalizeArchive(d.state.logArchive)).forEach(([k, v]) => { for (let i = 0; i < v.length; i += 18) out.add(k + v.slice(i, i + 17)); });
  (d.state.answerLog || []).forEach(r => { const id = LA.eventId(r); if (id) out.add(LA.jstDayKey(r.timestamp) + id); });
  return out;
}
const hasSession = (d, id) => !!(d && d.state && d.state.guestImportDeltas && typeof d.state.guestImportDeltas === "object" &&
  Object.prototype.hasOwnProperty.call(d.state.guestImportDeltas, id));

async function importGuestSessions(gen, synced) {
  if (!alive(gen) || isGuardian() || activeCtx.role !== "learner") return false;
  const me = activeCtx.authUid, prefix = ownPrefixNow();
  const reg = NS.readGuestSessions();
  let changed = false;
  for (const id of Object.keys(reg.sessions)) {
    if (!alive(gen)) return changed;
    const sess = reg.sessions[id];
    if (!sess || sess.status === "imported" || sess.status === "active" || id === reg.active) continue;
    const fromMe = sess.originUid === me && sess.originRole === "learner";
    const firstGuest = !sess.originUid;
    if (!fromMe && !firstGuest) continue;                     // 保護者由来・別の本人由来は取り込まない
    const gp = NS.guestPrefix(id);
    const units = NS.unitsWithPrefix(gp).filter(u => {
      try { const d = JSON.parse(localStorage.getItem(gp + u)); return d && d.state && Array.isArray(d.state.answerLog) && (d.state.answerLog.length || d.state.logArchive); } catch (e) { return false; }
    });
    if (!units.length) continue;
    for (const unit of units) {
      if (!alive(gen)) return changed;
      if (sess.units && sess.units[unit] && sess.units[unit].importedTo === me) continue;
      if (!synced.has(unit) && readLocal(unit)) continue;    // この単元の同期が終わっていなければ今回は見送る
      let g;
      try { g = JSON.parse(localStorage.getItem(gp + unit)); } catch (e) { g = null; }
      if (!g || !g.state) continue;
      const local = readLocal(unit);
      // 1. 世代の安全条件
      const currentGen = NS.resetGenOf(local);
      const base = fromMe ? ((sess.baseGen && typeof sess.baseGen[unit] === "number") ? sess.baseGen[unit] : 0) : 0;
      if (currentGen !== base) continue;                      // リセットされた可能性（R2/R3）→ 取り込まずに残す
      try {
        // 2. まだこの単元に取り込んでいなければ（印が無ければ）、3. 学習の事実を merge、4. 累計を足す、5. 印を付ける、6. local・remote に書く
        if (!hasSession(local, id)) {
          const merged = mergeUnitData(local, guestFacts(g, currentGen));
          const delta = normalizeDelta(g.stats);   // この session から足す量（guest の領域の累計＝その session で増えた分）
          merged.stats = addGuestCounters(merged.stats, delta);
          merged.state = Object.assign({}, merged.state, { guestImportDeltas: unionDeltas(merged.state.guestImportDeltas, { [id]: delta }) });
          if (!alive(gen)) return changed;
          setItemRaw(prefix + unit, JSON.stringify(merged));
          changed = true;
          await writeRemote(unit, merged);
          if (!alive(gen)) return changed;
        } else {
          // 前回、印は付けたが確認の前に止まった：足さずに、local を remote に送り直すだけ（確認は下で）
          const remoteNow = await fetchRemote(unit);
          if (!alive(gen)) return changed;
          if (!hasSession(remoteNow, id)) {
            await writeRemote(unit, mergeUnitData(readLocal(unit), remoteNow));
            if (!alive(gen)) return changed;
          }
        }
        // 7. remote を読み直して、回答と印の両方を確かめる
        const remote = await fetchRemote(unit);
        if (!alive(gen)) return changed;
        const have = eventKeysOf(remote);
        let all = hasSession(remote, id);
        eventKeysOf(guestFacts(g, currentGen)).forEach(k => { if (!have.has(k)) all = false; });
        if (!all) continue;
        // 8. 確かめられたら取り込み済みにする
        const r = NS.readGuestSessions();
        const s2 = r.sessions[id];
        if (!s2) continue;
        s2.units = s2.units || {};
        s2.units[unit] = { importedTo: me, importedAt: Date.now() };
        const left = units.filter(u => !(s2.units[u] && s2.units[u].importedTo === me));
        if (!left.length) { s2.status = "imported"; s2.importedTo = me; s2.importedAt = Date.now(); }
        NS.writeGuestSessions(r);
      } catch (e) {
        if (!alive(gen)) return changed;
        console.error("[sync] guest import failed: " + unit, e);
        dirtyUnits.add(unit);   // local に入っていれば次の送信で remote へ（印があるので、次回は足さずに確認だけする）
      }
    }
  }
  return changed;
}

/* 旧キー（kyotsu_app_v14_{unit} / kyotsu_app_v13）の確認（Phase 8A）。
   誰のデータか分からないので、移しも消しもしない。今のアカウントのデータと merge しても学習の中身
   （回答・前回結果・誤答・復習・卒業・救済・世代）が変わらなければ「新しい情報なし」、変わるなら「新しい情報あり」
   として記録するだけ（kyotsu_legacy_check_v1）。 */
function learningView(d) {
  if (!d || !d.state) return null;
  const s = d.state, t = d.stats || {};
  const sortObj = (o) => Object.keys(o || {}).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {});
  return JSON.stringify({
    events: Array.from(eventKeysOf(d)).sort(),
    qh: sortObj(t.questionHistory),
    wrong: (s.wrong || []).map(w => (w && w.id) || w).filter(Boolean).sort(),
    rm: sortObj(s.reviewMeta), ga: sortObj(s.graduatedAt), rescue: sortObj(s.rescueLog),
    gen: NS.resetGenOf(d)
  });
}
function checkLegacyLocal(gen) {
  if (!alive(gen) || isGuardian()) return;
  const legacyUnits = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf(NS.LEGACY_V14_PREFIX) === 0) legacyUnits.push([k.slice(NS.LEGACY_V14_PREFIX.length), k]);
  }
  if (localStorage.getItem(NS.LEGACY_V13_KEY)) legacyUnits.push(["keiryo", NS.LEGACY_V13_KEY]);
  if (!legacyUnits.length) return;
  const result = {};
  legacyUnits.forEach(([unit, key]) => {
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(key)); } catch (e) { legacy = null; }
    if (!legacy || !legacy.state) { result[key] = "unreadable"; return; }
    const mine = readLocal(unit);
    const base = mergeUnitData(mine, null);
    const withLegacy = mergeUnitData(mine, legacy);
    result[key] = learningView(base) === learningView(withLegacy) ? "no-new-info" : "has-new-info";
  });
  if (!alive(gen)) return;
  try {
    setItemRaw("kyotsu_legacy_check_v1", JSON.stringify({ uid: activeCtx.authUid, checkedAt: Date.now(), result }));
  } catch (e) { /* 記録できなくても何もしない */ }
  console.log("[sync] 旧キーの確認（移行はしない）:", result);
}

/* localStorage.setItem を横取りして、保存を検知したら遅延アップロード */
const setItemRaw = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  setItemRaw(key, value);
  // 送るのは、本人（learner）がログイン中で、自分の領域の単元データが保存されたときだけ。
  // 保護者（自分の検証用）・未ログイン（guest session）・確認中・ほかの領域は積まない。
  // 同期中（busy）の保存も取りこぼさない（同期処理自身は setItemRaw で書くのでここには来ない）
  const p = ownPrefixNow();
  if (typeof key === "string" && p && key.indexOf(p) === 0 && currentUser && activeCtx.state === "authenticated" && activeCtx.role === "learner") {
    dirtyUnits.add(key.slice(p.length));
    if (busy) savedWhileBusy = true;
    schedulePush();
  }
};

async function pushDirty() {
  if (!currentUser || busy || dirtyUnits.size === 0 || isGuardian() || !activeCtx || activeCtx.role !== "learner") return;
  const gen = ctxGen;
  busy = true;
  const targets = Array.from(dirtyUnits);
  dirtyUnits.clear();
  const failed = [];
  for (const unit of targets) {
    if (!alive(gen)) return;
    try {
      const local = readLocal(unit);
      if (!local) continue;
      const remote = await fetchRemote(unit);
      if (!alive(gen)) return;
      const merged = mergeUnitData(local, remote);
      if (!alive(gen)) return;
      await writeRemote(unit, merged);
      if (!alive(gen)) return;
    } catch (e) {
      if (!alive(gen)) return;
      console.error("[sync] push failed: " + unit, e);
      failed.push(unit);
    }
  }
  if (!alive(gen)) return;
  // 失敗した単元だけ未送信として残す（成功した単元は戻さない）
  failed.forEach(unit => dirtyUnits.add(unit));
  busy = false;
  if (failed.length > 0) {
    log(UNSENT_MSG, "#991b1b");
  } else {
    log("同期済み（" + new Date().toLocaleTimeString("ja-JP") + "）", "#166534");
  }
  pushSummary(gen);   // サマリーは単元本体とは別。失敗しても単元は未送信扱いにしない（次の push で local から計算し直す）
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
    '<div class="small-text" id="syncStatus" style="margin-top:6px;">未ログイン</div>' +
    '<div class="small-text" id="syncClientVersion" style="margin-top:2px;color:#94a3b8;">クライアント ' + NS.CLIENT_VERSION + '</div>';

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
   保護者（閲覧モード）専用：この端末の保護者自身の検証データ（kyotsu_app_v15_u_{保護者}_*）を消して、
   子どもの閲覧用キャッシュを取り直す。子どもの領域・旧キー・Firestore には触らない（Phase 8A）。
   ========================================================= */
async function resetLocalTestData() {
  if (!isGuardian()) return; // 念のため：閲覧モード以外では動かさない
  if (!confirm("このPCに保存されている保護者の検証プレイのログを消して、子どものデータを取り直します。よろしいですか？")) return;

  log("リセット中…");
  const p = ownPrefixNow();
  if (p) NS.unitsWithPrefix(p).forEach(unit => localStorage.removeItem(p + unit));
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
  const next = contextFor(user);
  // このページで有効になっている context（firebase-sync を読めずに app が先に確定した場合も含む）
  const appCtx = typeof window.kyotsuCurrentContext === "function" ? window.kyotsuCurrentContext() : null;
  const shown = activeCtx || appCtx;
  if (shown && !NS.sameContext(shown, next)) {
    // 別の人・別の状態に変わった（ログアウト・ログイン・切替・別タブでの変更）：古い世代の処理と未送信の記録を打ち切り、
    // 新しい context を保存して読み込み直す（app のメモリ上の学習状態・セッションもすべて捨てる）
    invalidateContext();
    if (next.state === "authenticated") NS.closeActiveGuestSession();
    NS.writeContext(next);
    renderAuthUI();
    location.reload();
    return;
  }
  if (activeCtx) return;   // 同じ context のまま（トークンの更新など）
  // このページで最初の確定。まだ学習データを読んでいないので、読み込み直さずにそのまま使う
  if (next.state === "authenticated") NS.closeActiveGuestSession();
  ctxGen++;
  activeCtx = next;
  currentUser = next.state === "authenticated" ? user : null;
  NS.writeContext(next);
  renderAuthUI();
  if (typeof window.kyotsuContextReady === "function") window.kyotsuContextReady(next);
  if (currentUser) {
    log(isGuardian() ? "ログインしました。子どものデータを取得します…" : "ログインしました。同期します…", "#166534");
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
