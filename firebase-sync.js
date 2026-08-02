/* =========================================================
   firebase-sync.js  —  端末間ログ同期アドオン（スマホ⇔iPad）
   ---------------------------------------------------------
   ・app.js / index.html の既存部分は一切変更しない後付けモジュール。
   ・localStorage を「正」として使い続け、裏でFirestoreと双方向マージ同期する。
     → オフラインでもこれまで通り解ける（PWAの強みを維持）。
   ・保存先: users/{uid}/units/{unitKey}  … payload は JSON文字列1本
     （Firestoreの型制約・undefined制約を完全に回避するため）
   ・読み込み方法: <script type="module" src="firebase-sync.js?v=1"></script>
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

/* ---------- 設定 ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAyla5xMj7i_nWRgN958Z-tK-06uUq7z8Q",
  authDomain: "kyotsu-math.firebaseapp.com",
  projectId: "kyotsu-math",
  storageBucket: "kyotsu-math.firebasestorage.app",
  messagingSenderId: "704799365381",
  appId: "1:704799365381:web:7d1abef4e454e09c887f6c"
};

const PREFIX = "kyotsu_app_v14_";
const RELOAD_FLAG = "kyotsu_sync_reloaded";
const PUSH_DELAY = 4000; // 保存後、これだけ静かになったらアップロード

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let pushTimer = null;
let dirtyUnits = new Set();
let busy = false;

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
function mergeUnitData(a, b) {
  if (!a) return b;
  if (!b) return a;

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
  //   副作用: 片方で卒業した問題が、もう片方の古いデータから一度だけ復活することがある。
  Object.keys(oRM).forEach(id => { rm[id] = oRM[id]; });
  Object.keys(nRM).forEach(id => {
    const ne = nRM[id], oe = rm[id];
    if (!oe) { rm[id] = ne; return; }
    const nt = (ne && (ne.lastSeenAt || ne.dueAt)) || 0;
    const ot = (oe && (oe.lastSeenAt || oe.dueAt)) || 0;
    rm[id] = (nt >= ot) ? ne : oe;
  });

  // --- wrong / tipList: 問題オブジェクトの配列 ---
  //  ・新しい側にあるものは全部残す
  //  ・古い側にしか無いものは、マージ後のreviewMetaにidが残っている場合だけ採用
  //    （＝どちらかの端末で「卒業」して消えた問題は復活させない。
  //      逆に、古い端末でだけ新しく間違えた問題はちゃんと拾える）
  function mergeQList(nList, oList) {
    const n = Array.isArray(nList) ? nList : [];
    const o = Array.isArray(oList) ? oList : [];
    const nIds = new Set(n.map(q => q && q.id));
    const out = n.slice();
    o.forEach(q => {
      if (!q || !q.id) return;
      if (nIds.has(q.id)) return;
      if (rm[q.id]) out.push(q);
    });
    return out;
  }

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
  const state = Object.assign({}, oS, nS, {
    answerLog: logAll,
    wrong: mergeQList(nS.wrong, oS.wrong),
    tipList: mergeQList(nS.tipList, oS.tipList),
    reviewMeta: rm,
    history: hist.slice(0, 5),
    lastShuffle: Object.assign({}, oS.lastShuffle || {}, nS.lastShuffle || {}),
    timer: null // タイマーIDは端末固有なので必ず捨てる
  });

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

  return { state, stats };
}

/* =========================================================
   Firestore 入出力
   ========================================================= */
function unitDocRef(unit) {
  return doc(db, "users", currentUser.uid, "units", unit);
}

async function fetchRemote(unit) {
  const snap = await getDoc(unitDocRef(unit));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (!d || !d.payload) return null;
  try { return JSON.parse(d.payload); } catch (e) { return null; }
}

async function writeRemote(unit, data) {
  await setDoc(unitDocRef(unit), {
    payload: JSON.stringify(data),
    updatedAt: Date.now(),
    device: navigator.userAgent.slice(0, 120)
  });
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

  // サーバー側にしか無い単元も拾う
  try {
    const snap = await getDocs(collection(db, "users", currentUser.uid, "units"));
    snap.forEach(d => units.add(d.id));
  } catch (e) { /* 一覧が取れなくても既知の単元だけで続行 */ }

  for (const unit of units) {
    try {
      const local = readLocal(unit);
      const remote = await fetchRemote(unit);
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
      const remoteStr = remote ? JSON.stringify(remote) : null;
      if (mergedStr !== remoteStr) {
        await writeRemote(unit, merged);
      }
    } catch (e) {
      console.error("[sync] unit failed: " + unit, e);
    }
  }

  busy = false;
  const t = new Date().toLocaleTimeString("ja-JP");
  log("同期済み（" + t + "）", "#166534");

  // 画面に出ている単元のデータが書き換わったら、1回だけリロードして反映
  if (changedLocal && !sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    log("他の端末のデータを取り込みました。画面を更新します…", "#166534");
    setTimeout(() => location.reload(), 900);
  }
}

/* localStorage.setItem を横取りして、保存を検知したら遅延アップロード */
const setItemRaw = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  setItemRaw(key, value);
  if (typeof key === "string" && key.indexOf(PREFIX) === 0 && currentUser && !busy) {
    dirtyUnits.add(key.slice(PREFIX.length));
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushDirty, PUSH_DELAY);
  }
};

async function pushDirty() {
  if (!currentUser || busy || dirtyUnits.size === 0) return;
  busy = true;
  const targets = Array.from(dirtyUnits);
  dirtyUnits.clear();

  for (const unit of targets) {
    try {
      const local = readLocal(unit);
      if (!local) continue;
      const remote = await fetchRemote(unit);
      const merged = mergeUnitData(local, remote);
      await writeRemote(unit, merged);
    } catch (e) {
      console.error("[sync] push failed: " + unit, e);
      log("アップロードに失敗しました（電波が戻れば自動で再送されます）", "#991b1b");
    }
  }
  busy = false;
  log("同期済み（" + new Date().toLocaleTimeString("ja-JP") + "）", "#166534");
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
    '</div>' +
    '<div class="small-text" id="syncStatus" style="margin-top:6px;">未ログイン</div>';

  anchor.parentNode.appendChild(box);

  document.getElementById("syncLoginBtn").addEventListener("click", doLogin);
  document.getElementById("syncPass").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("syncNowBtn").addEventListener("click", () => {
    sessionStorage.removeItem(RELOAD_FLAG);
    syncAll({});
  });
  document.getElementById("syncLogoutBtn").addEventListener("click", () => signOut(auth));
  return true;
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
  if (!out || !inn) return;
  if (currentUser) {
    out.style.display = "none";
    inn.style.display = "block";
    document.getElementById("syncWho").innerText = "ログイン中: " + (currentUser.email || currentUser.uid);
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
window.kyotsuSync = { syncAll, mergeUnitData, readLocal };
