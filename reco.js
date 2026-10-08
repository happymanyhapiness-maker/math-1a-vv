/* =========================================================
   reco.js  —  ホーム上部の「お知らせ」（ベル）と、保護者の登録欄
   ---------------------------------------------------------
   ・app.js / firebase-sync.js / questions_*.js は変更しない後付けモジュール（unit-strength.js と同じ方式）。
   ・保護者が貼り付けた文章（ふり返り / 次にやること）を、学習者と保護者がベルのモーダルで読む。
   ・保存先: kyotsu-math-reco/{子のuid}  { payload: JSON文字列, savedAt: serverTimestamp }
       payload = { version: 2, updatedAt: "YYYY-MM-DD", review: "...", next: "..." }
     読む権限は 本人 / 保護者、書く権限は 保護者のみ（Firestore Rules。クライアントの判定は見た目だけ）。
   ・回答履歴（answerLog / questionHistory）は読まない。文章は textContent で描画する（HTMLとして解釈しない）。
   ・読み込み失敗・permission-denied・未登録・guest・unauthorized では何も出さない（保護者の「読めた」場合を除く）。
   ・firebase-sync.js より先に実行されても落ちない（getApp を再試行し、認証は onAuthStateChanged 経由）。
   ・読み込み順: firebase-sync.js の後に <script type="module"> で追加する。
   ========================================================= */
import { getApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const COLLECTION = "kyotsu-math-reco";
const PAYLOAD_VERSION = 2;
const MAX_REVIEW = 3000;        // 画面側の文字数上限（コードポイント数）
const MAX_NEXT = 1500;
const MAX_PAYLOAD_BYTES = 19000; // Rules の payload.size() < 20000 より手前。size() が文字数でもバイト数でも通る値
const CACHE_PREFIX = "kyotsu_reco_cache_v1_";
const SEEN_PREFIX = "kyotsu_reco_seen_v1_";
const DENIED_CODES = ["permission-denied", "unauthenticated"];

/* ---- 純粋な関数（BEGIN: tools/verify_reco.js がここを抜き出して試す。DOM・Firebase には触らない） ---- */

// 制御文字を除去する（改行 \n とタブは残す）。\r\n / \r は \n にそろえ、前後の空白を落とす
function cleanText(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g, "")
    .trim();
}

function cpLen(s) {
  let n = 0;
  for (const _ of s) n++; // eslint-disable-line no-unused-vars
  return n;
}

function utf8Len(s) {
  return new TextEncoder().encode(s).length;
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

// ミリ秒 → 日本時間（Asia/Tokyo）の "YYYY-MM-DD"
function jstDateKey(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}

function formatDateLabel(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key.replace(/-/g, "/") : "";
}

// payload（JSON文字列）を読む。形が違う・どちらの文章も空のときは null（＝未登録と同じ扱い）
function parsePayload(str) {
  if (typeof str !== "string" || !str) return null;
  let o;
  try { o = JSON.parse(str); } catch (e) { return null; }
  if (!o || typeof o !== "object" || o.version !== PAYLOAD_VERSION) return null;
  const review = cleanText(o.review);
  const next = cleanText(o.next);
  if (!review && !next) return null;
  const updatedAt = typeof o.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.updatedAt) ? o.updatedAt : "";
  return { review, next, updatedAt };
}

// 保護者の入力を検証する。問題なければ null、あれば画面に出す文
function validateInput(review, next) {
  if (!review || !next) return "「ふり返り」と「次にやること」の両方を入れてね";
  if (cpLen(review) > MAX_REVIEW) return "「ふり返り」は" + MAX_REVIEW + "文字までだよ（いま" + cpLen(review) + "文字）";
  if (cpLen(next) > MAX_NEXT) return "「次にやること」は" + MAX_NEXT + "文字までだよ（いま" + cpLen(next) + "文字）";
  return null;
}

// 保存する payload（JSON文字列）。updatedAt は端末の日付（表示の第一候補ではない。savedAt が無いときの予備）
function buildPayload(review, next, nowMs) {
  return JSON.stringify({ version: PAYLOAD_VERSION, updatedAt: jstDateKey(nowMs), review, next });
}

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// 「最後に見た値」と比べるための印。savedAt が timestamp のときはその値、無いとき（Console 手入力など）は payload の中身から作る
function versionKey(savedMs, payloadStr) {
  if (typeof savedMs === "number" && isFinite(savedMs)) return "t" + savedMs;
  return "p" + (payloadStr || "").length + ":" + hashStr(payloadStr || "");
}

// 表示する更新日: savedAt（サーバー時刻）の日本時間の日付が第一候補。無いときだけ payload.updatedAt
function displayDate(savedMs, payloadUpdatedAt) {
  if (typeof savedMs === "number" && isFinite(savedMs)) return formatDateLabel(jstDateKey(savedMs));
  return formatDateLabel(payloadUpdatedAt || "");
}

// Firestore の savedAt（Timestamp）→ ミリ秒。timestamp 型でなければ null
function savedAtMs(v) {
  return v && typeof v.toMillis === "function" ? v.toMillis() : null;
}

/* ---- 純粋な関数（END） ---- */

/* ---------- 状態 ---------- */
let db = null;
let gen = 0;            // ログイン状態が変わるたびに増える。古い非同期処理の結果は捨てる
let saving = false;
let st = null;          // { role, authUid, target, readOk, data: {review,next,updatedAt,savedMs,key,payload} | null }

function warn(msg, e) {
  try { console.warn("[reco] " + msg, (e && e.code) || e || ""); } catch (x) { /* 何もしない */ }
}

/* ---------- localStorage（表示の便利機能。読めなくても動く） ---------- */
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* 何もしない */ }
}
function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* 何もしない */ }
}
function cacheKey() { return CACHE_PREFIX + st.authUid + "_" + st.target; }
function seenKey() { return SEEN_PREFIX + st.authUid + "_" + st.target; }

function readCache() {
  const raw = lsGet(cacheKey());
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    if (!c || typeof c.payload !== "string") return null;
    return { payload: c.payload, savedMs: typeof c.savedMs === "number" ? c.savedMs : null };
  } catch (e) { return null; }
}
function writeCache(payload, savedMs) {
  lsSet(cacheKey(), JSON.stringify({ payload, savedMs }));
}

/* ---------- データの反映 ---------- */
// payload 文字列と savedAt(ms) を状態に入れる。読めない形なら data は null
function applyDoc(payloadStr, savedMs) {
  const p = parsePayload(payloadStr);
  st.data = p ? {
    review: p.review,
    next: p.next,
    updatedAt: p.updatedAt,
    savedMs,
    payload: payloadStr,
    key: versionKey(savedMs, payloadStr)
  } : null;
}

function isUnread() {
  return !!(st && st.data) && lsGet(seenKey()) !== st.data.key;
}
function markSeen() {
  if (st && st.data) lsSet(seenKey(), st.data.key);
}

/* ---------- ベル ---------- */
function examActive() {
  const t = document.getElementById("examTopbar");
  if (!t) return false;
  try { return getComputedStyle(t).display !== "none"; } catch (e) { return false; }
}

function ensureBell() {
  let b = document.getElementById("recoBellBtn");
  if (b) return b;
  const topbar = document.getElementById("topbar") || document.querySelector(".topbar");
  const stats = topbar && topbar.querySelector(".top-stats");
  if (!topbar || !stats) return null;
  b = document.createElement("button");
  b.type = "button";
  b.id = "recoBellBtn";
  b.className = "reco-bell";
  b.setAttribute("aria-label", "お知らせ");
  b.title = "お知らせ";
  const icon = document.createElement("span");
  icon.className = "reco-bell-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "🔔";
  const dot = document.createElement("span");
  dot.className = "reco-bell-dot";
  dot.hidden = true;
  b.appendChild(icon);
  b.appendChild(dot);
  b.addEventListener("click", openModal);
  // 「分析」ボタン（unit-strength.js）があればその隣、まだなければ統計カードの隣。
  // あとから分析ボタンが注入されても、それは統計カードの直後に入るので並びは 統計 / 分析 / ベル になる
  const anchor = document.getElementById("unitStrengthBtn") || stats;
  anchor.parentNode.insertBefore(b, anchor.nextSibling);
  topbar.classList.add("has-reco-bell");
  return b;
}

function removeBell() {
  const b = document.getElementById("recoBellBtn");
  if (b && b.parentNode) {
    const topbar = b.parentNode;
    b.parentNode.removeChild(b);
    if (topbar.classList) topbar.classList.remove("has-reco-bell");
  }
}

function shouldShowBell() {
  if (!st) return false;
  if (st.role === "guardian") return st.readOk;   // 保護者は、まだ何も登録されていなくても（読めたなら）ベルから登録できる
  return !!st.data;                               // 学習者は、読める内容があるときだけ
}

function updateBell() {
  if (!shouldShowBell()) { removeBell(); closeModal(); return; }
  const b = ensureBell();
  if (!b) return;
  const exam = examActive();
  b.hidden = exam;
  if (exam) closeModal();
  const dot = b.querySelector(".reco-bell-dot");
  if (dot) dot.hidden = !isUnread();
}

function watchExam() {
  const t = document.getElementById("examTopbar");
  if (!t || typeof MutationObserver === "undefined") return;
  new MutationObserver(updateBell).observe(t, { attributes: true, attributeFilter: ["style", "class"] });
}

/* ---------- モーダル ---------- */
function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function closeModal() {
  const m = document.getElementById("recoModal");
  if (m) m.remove();
  document.removeEventListener("keydown", onKeydown);
}
function onKeydown(e) {
  if (e.key === "Escape") closeModal();
}

function textBlock(title, text) {
  const sec = h("section", "reco-section");
  sec.appendChild(h("h3", "reco-section-title", title));
  const body = h("div", "reco-text");
  body.textContent = text;   // HTML として解釈しない。改行は CSS（white-space: pre-wrap）で保つ
  sec.appendChild(body);
  return sec;
}

function renderView(box) {
  box.textContent = "";
  const d = st && st.data;
  if (!d) {
    box.appendChild(h("div", "small-text", "まだお知らせはないよ。"));
    return;
  }
  const date = displayDate(d.savedMs, d.updatedAt);
  if (date) box.appendChild(h("div", "reco-date", "更新日　" + date));
  if (d.review) box.appendChild(textBlock("ふり返り", d.review));
  if (d.next) box.appendChild(textBlock("次にやること", d.next));
}

// 保護者だけに作る登録欄（学習者の画面には DOM ごと作らない）
function buildEditor(viewBox) {
  const sec = h("section", "reco-editor");
  sec.appendChild(h("h3", "reco-section-title", "お知らせを登録（保護者用）"));
  sec.appendChild(h("div", "small-text", "AIの分析結果の文章を、そのまま貼り付けてね。保存すると、子どもの画面のお知らせが入れ替わるよ。"));

  function field(label, max, initial) {
    const wrap = h("label", "reco-field");
    wrap.appendChild(h("span", "reco-field-label", label));
    const ta = document.createElement("textarea");
    ta.className = "reco-textarea";
    ta.rows = 6;
    ta.value = initial || "";
    const count = h("span", "reco-count");
    function refresh() {
      const n = cpLen(cleanText(ta.value));
      count.textContent = n + " / " + max;
      count.classList.toggle("reco-count-over", n > max);
    }
    ta.addEventListener("input", refresh);
    refresh();
    wrap.appendChild(ta);
    wrap.appendChild(count);
    return { wrap, ta };
  }

  const d = st.data;
  const fReview = field("ふり返り", MAX_REVIEW, d ? d.review : "");
  const fNext = field("次にやること", MAX_NEXT, d ? d.next : "");
  sec.appendChild(fReview.wrap);
  sec.appendChild(fNext.wrap);

  const status = h("div", "reco-status");
  status.setAttribute("role", "status");
  const btn = h("button", "btn primary reco-save", "保存する");
  btn.type = "button";

  function setStatus(text, ok) {
    status.textContent = text;
    status.className = "reco-status" + (text ? (ok ? " reco-status-ok" : " reco-status-ng") : "");
  }

  btn.addEventListener("click", async () => {
    if (saving || !st || st.role !== "guardian" || !db) return;
    const review = cleanText(fReview.ta.value);
    const next = cleanText(fNext.ta.value);
    const invalid = validateInput(review, next);
    if (invalid) { setStatus(invalid, false); return; }
    const payload = buildPayload(review, next, Date.now());
    if (utf8Len(payload) > MAX_PAYLOAD_BYTES) { setStatus("文章が長すぎるよ。少し短くしてね", false); return; }

    const g = gen;
    saving = true;
    btn.disabled = true;
    setStatus("保存中…", true);
    try {
      const ref = doc(db, COLLECTION, st.target);
      await setDoc(ref, { payload, savedAt: serverTimestamp() });
      if (g !== gen) return;
      let ms = null;
      try {
        const snap = await getDoc(ref);
        if (g !== gen) return;
        if (snap.exists()) ms = savedAtMs(snap.data().savedAt);
      } catch (e) { /* 読み戻せなくても、保存は成功している */ }
      applyDoc(payload, ms);
      st.readOk = true;
      writeCache(payload, ms);
      markSeen();              // 自分が保存したものは、自分の端末では既読
      fReview.ta.value = review;
      fNext.ta.value = next;
      renderView(viewBox);
      updateBell();
      setStatus("保存したよ", true);
    } catch (e) {
      if (g !== gen) return;
      warn("save failed", e);
      setStatus("保存できなかったよ。入力はそのまま残してあるから、少ししてからもう一度押してね", false);
    } finally {
      saving = false;
      btn.disabled = false;
    }
  });

  sec.appendChild(status);
  sec.appendChild(btn);
  return sec;
}

function openModal() {
  if (!st || document.getElementById("recoModal") || examActive()) return;
  const modal = h("div", "unit-strength-modal reco-modal");   // 見た目は分析モーダル（unit-strength.js）と共通
  modal.id = "recoModal";
  const box = h("div", "unit-strength-modal-box");
  const head = h("div", "unit-strength-modal-head");
  head.appendChild(h("h2", "", "お知らせ"));
  const close = h("button", "unit-strength-modal-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "閉じる");
  close.addEventListener("click", closeModal);
  head.appendChild(close);
  box.appendChild(head);

  const viewBox = h("div", "reco-view");
  renderView(viewBox);
  box.appendChild(viewBox);
  if (st.role === "guardian") box.appendChild(buildEditor(viewBox));

  modal.appendChild(box);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.body.appendChild(modal);
  document.addEventListener("keydown", onKeydown);

  markSeen();
  updateBell();
}

/* ---------- 読み込み ---------- */
async function load(g) {
  const s = st;
  try {
    const snap = await getDoc(doc(db, COLLECTION, s.target));
    if (g !== gen) return;
    s.readOk = true;
    if (snap.exists()) {
      const d = snap.data() || {};
      const payload = typeof d.payload === "string" ? d.payload : "";
      const ms = savedAtMs(d.savedAt);
      applyDoc(payload, ms);
      if (s.data) writeCache(payload, ms); else lsRemove(cacheKey());
    } else {
      s.data = null;
      lsRemove(cacheKey());
    }
  } catch (e) {
    if (g !== gen) return;
    warn("read failed", e);
    if (e && DENIED_CODES.indexOf(e.code) >= 0) {
      // 権限が無い（Rules の反映前など）：何も出さない。古いキャッシュも使わない
      lsRemove(cacheKey());
      return;
    }
    // 通信エラーなど：前回取れた内容があればそれを出す（オフライン用）
    const c = readCache();
    if (!c) return;
    applyDoc(c.payload, c.savedMs);
    if (!s.data) return;
    s.readOk = true;
  }
  updateBell();
}

/* ---------- 起動 ---------- */
function contextFor(user) {
  const NS = window.KyotsuNS;
  const ctx = NS && NS.readContext && NS.readContext();
  if (!ctx || ctx.state !== "authenticated" || ctx.authUid !== user.uid) return null;
  if (ctx.role !== "learner" && ctx.role !== "guardian") return null;   // unauthorized は対象外
  if (typeof ctx.remoteTargetUid !== "string" || !ctx.remoteTargetUid) return null;
  return ctx;
}

function start(user, g, tries) {
  if (g !== gen) return;
  const ctx = contextFor(user);
  if (!ctx) {
    // firebase-sync.js が context を書く前かもしれないので、少し待って確かめ直す（それでも無ければ何も出さない）
    if (tries < 10) setTimeout(() => start(user, g, tries + 1), 300);
    return;
  }
  st = { role: ctx.role, authUid: user.uid, target: ctx.remoteTargetUid, readOk: false, data: null };
  load(g);
}

function onUser(user) {
  gen++;
  st = null;
  removeBell();
  closeModal();
  if (!user) return;   // guest: 何も出さない
  start(user, gen, 0);
}

function init(app) {
  try {
    db = getFirestore(app);
    watchExam();
    onAuthStateChanged(getAuth(app), onUser, (e) => warn("auth failed", e));
  } catch (e) {
    warn("init failed", e);
  }
}

// firebase-sync.js が先に initializeApp している前提。まだなら少し待って再試行し、だめなら静かに終わる
function boot(tries) {
  let app = null;
  try { app = getApp(); } catch (e) { app = null; }
  if (app) { init(app); return; }
  if (tries < 8) setTimeout(() => boot(tries + 1), 750);
  else warn("firebase app not available");
}

boot(0);
