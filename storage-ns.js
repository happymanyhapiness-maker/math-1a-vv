/* =========================================================
   storage-ns.js  —  学習データの localStorage 名前空間（Phase 8A）
   ---------------------------------------------------------
   ・学習データのキーは、ここでだけ組み立てる（app.js / firebase-sync.js / calendar.js /
     progress.js / crossunit.js / unit-strength.js が共通で使う）。
       ログイン中の本人・保護者自身 : kyotsu_app_v15_u_{uid}_{unit}
       未ログイン（guest session）   : kyotsu_app_v15_g_{guestSessionId}_{unit}
       保護者が見る子どもの閲覧用    : kyotsu_view_v1_{viewerUid}_{targetUid}_{unit}（読むだけ・merge も push もしない）
     UID や session ID には "_" が入らないので、接頭辞でキーがあいまいにならない。
   ・今の context（誰のデータを表示・保存するか）は kyotsu_ctx_v1 に置く。書くのは index.html の
     firebase-sync.js（Auth の判定後）だけ。calendar.html / progress.html は Auth を持たないので、これを読む。
     別タブで context が変わったら（storage イベント）、表示中のページを読み込み直す。
   ・未ログインの学習は guest session ごとに分ける（kyotsu_guest_sessions_v1）。
   ・旧キー（kyotsu_app_v14_{unit} / kyotsu_app_v13）は読み書きの経路から外した。原本は消さない。
   ========================================================= */
(function (root) {
  "use strict";

  var CLIENT_VERSION = "8a-1";               // 同期欄に表示し、学習サマリーにも書く（rollout の確認用）
  var WRITER_MARKER = "kyotsu-8a";           // Phase 8A 以降のクライアントが単元・サマリーの書き込みに付ける固定値
  var USER_PREFIX = "kyotsu_app_v15_u_";
  var GUEST_PREFIX = "kyotsu_app_v15_g_";
  var VIEW_PREFIX = "kyotsu_view_v1_";
  var CTX_KEY = "kyotsu_ctx_v1";
  var GUEST_KEY = "kyotsu_guest_sessions_v1";
  var LEGACY_V14_PREFIX = "kyotsu_app_v14_";
  var LEGACY_V13_KEY = "kyotsu_app_v13";
  var ID_RE = /^[A-Za-z0-9-]+$/;

  function ls() {
    try { return root.localStorage; } catch (e) { return null; }
  }
  function readJSON(key) {
    var s = ls();
    if (!s) return null;
    try { return JSON.parse(s.getItem(key)); } catch (e) { return null; }
  }
  // 学習データ以外の管理用キーの書き込み（firebase-sync.js の setItem 横取りの対象外の接頭辞）
  function writeJSON(key, value) {
    var s = ls();
    if (!s) return false;
    try { s.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function validId(id) {
    return typeof id === "string" && ID_RE.test(id);
  }
  function userPrefix(uid) {
    return validId(uid) ? USER_PREFIX + uid + "_" : null;
  }
  function guestPrefix(sessionId) {
    return validId(sessionId) ? GUEST_PREFIX + sessionId + "_" : null;
  }
  function viewPrefix(viewerUid, targetUid) {
    return validId(viewerUid) && validId(targetUid) ? VIEW_PREFIX + viewerUid + "_" + targetUid + "_" : null;
  }

  // 書き込みできる自分の領域（学習・保存・同期で使う）
  //  本人 / 保護者 → 自分の UID、guest → その session。確認中（unresolved）は null＝読まない・書かない
  function ownPrefix(ctx) {
    if (!ctx) return null;
    if (ctx.state === "authenticated") return userPrefix(ctx.storageOwnerUid);
    if (ctx.state === "guest") return guestPrefix(ctx.guestSessionId);
    return null;
  }
  // 集計ページ（calendar / progress / crossunit / unit-strength）が読む領域
  //  保護者は子どもの閲覧用キャッシュ、それ以外は自分の領域
  function readPrefix(ctx) {
    if (ctx === undefined) ctx = readContext();
    if (!ctx) return null;
    if (ctx.state === "authenticated" && ctx.role === "guardian") return viewPrefix(ctx.storageOwnerUid, ctx.remoteTargetUid);
    return ownPrefix(ctx);
  }
  // その接頭辞の単元名の一覧
  function unitsWithPrefix(prefix) {
    var s = ls();
    var out = [];
    if (!s || !prefix) return out;
    for (var i = 0; i < s.length; i++) {
      var k = s.key(i);
      if (k && k.indexOf(prefix) === 0 && k.length > prefix.length) out.push(k.slice(prefix.length));
    }
    return out;
  }

  function readContext() {
    var c = readJSON(CTX_KEY);
    return c && typeof c === "object" ? c : null;
  }
  function writeContext(ctx) {
    return writeJSON(CTX_KEY, ctx);
  }
  // 画面に出している context と、保存されている context が同じか
  function sameContext(a, b) {
    if (!a || !b) return false;
    return a.state === b.state && (a.authUid || null) === (b.authUid || null) && (a.role || null) === (b.role || null) &&
      (a.storageOwnerUid || null) === (b.storageOwnerUid || null) && (a.remoteTargetUid || null) === (b.remoteTargetUid || null) &&
      (a.guestSessionId || null) === (b.guestSessionId || null);
  }

  /* ---------- 未ログインの学習（guest session） ---------- */
  function newId() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === "function") return root.crypto.randomUUID();
    } catch (e) { /* 下へ */ }
    var rnd = "";
    try {
      if (root.crypto && root.crypto.getRandomValues) {
        var a = new Uint32Array(4);
        root.crypto.getRandomValues(a);
        rnd = Array.prototype.map.call(a, function (x) { return x.toString(36); }).join("-");
      }
    } catch (e) { /* 下へ */ }
    if (!rnd) rnd = Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2);
    return "g" + Date.now().toString(36) + "-" + rnd;
  }
  function readGuestSessions() {
    var g = readJSON(GUEST_KEY);
    if (!g || typeof g !== "object" || !g.sessions || typeof g.sessions !== "object") g = { active: null, sessions: {} };
    return g;
  }
  function writeGuestSessions(g) {
    return writeJSON(GUEST_KEY, g);
  }
  function resetGenOf(data) {
    var s = data && data.state;
    return s && typeof s.resetGen === "number" && s.resetGen > 0 ? Math.floor(s.resetGen) : 0;
  }
  // 未ログインが確定したとき：続きの session があればそれ、無ければ新しく作る。
  //  origin = 直前にログインしていたアカウント（無ければ null）。本人（learner）由来なら、その端末にある
  //  本人の単元データの世代（resetGen）を baseGen として記録する（取り込み時に、その後リセットされていないかを見る）
  function ensureActiveGuestSession(origin, now) {
    var g = readGuestSessions();
    if (g.active && g.sessions[g.active] && g.sessions[g.active].status !== "closed-imported") return g.active;
    var id = newId();
    var sess = {
      id: id,
      originUid: origin && validId(origin.uid) ? origin.uid : null,
      originRole: origin && origin.role ? origin.role : null,
      startedAt: typeof now === "number" ? now : Date.now(),
      baseGen: null,
      status: "active",
      units: {},
      importedTo: null,
      importedAt: null
    };
    if (sess.originUid && sess.originRole === "learner") {
      var p = userPrefix(sess.originUid);
      var bg = {};
      unitsWithPrefix(p).forEach(function (u) { bg[u] = resetGenOf(readJSON(p + u)); });
      sess.baseGen = bg;
    }
    g.sessions[id] = sess;
    g.active = id;
    writeGuestSessions(g);
    return id;
  }
  // ログインしたら active を閉じる（データと記録は残す＝あとで取り込めるように）
  function closeActiveGuestSession() {
    var g = readGuestSessions();
    if (!g.active) return;
    var s = g.sessions[g.active];
    if (s && s.status === "active") s.status = "pending";
    g.active = null;
    writeGuestSessions(g);
  }

  // Auth を持たない集計ページ（calendar.html / progress.html）用：表示中の領域のデータが別タブで変わったら読み込み直す
  // （別タブの同期・取り込み・保護者の閲覧用キャッシュの更新を反映する）。index.html では使わない（演習中の画面を消さない）
  function watchData() {
    var t = null;
    try {
      root.addEventListener("storage", function (e) {
        var p = readPrefix();
        if (!e || !e.key || !p || e.key.indexOf(p) !== 0) return;
        clearTimeout(t);
        t = setTimeout(function () { root.location.reload(); }, 400);
      });
    } catch (e) { /* 何もしない */ }
  }

  function key(prefix, unit) {
    return prefix && typeof unit === "string" && unit ? prefix + unit : null;
  }

  var api = {
    CLIENT_VERSION: CLIENT_VERSION,
    WRITER_MARKER: WRITER_MARKER,
    USER_PREFIX: USER_PREFIX,
    GUEST_PREFIX: GUEST_PREFIX,
    VIEW_PREFIX: VIEW_PREFIX,
    CTX_KEY: CTX_KEY,
    GUEST_KEY: GUEST_KEY,
    LEGACY_V14_PREFIX: LEGACY_V14_PREFIX,
    LEGACY_V13_KEY: LEGACY_V13_KEY,
    validId: validId,
    userPrefix: userPrefix,
    guestPrefix: guestPrefix,
    viewPrefix: viewPrefix,
    ownPrefix: ownPrefix,
    readPrefix: readPrefix,
    unitsWithPrefix: unitsWithPrefix,
    key: key,
    watchData: watchData,
    readContext: readContext,
    writeContext: writeContext,
    sameContext: sameContext,
    newId: newId,
    readGuestSessions: readGuestSessions,
    writeGuestSessions: writeGuestSessions,
    ensureActiveGuestSession: ensureActiveGuestSession,
    closeActiveGuestSession: closeActiveGuestSession,
    resetGenOf: resetGenOf
  };
  root.KyotsuNS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // 別タブで context が変わったら、このページを読み込み直す（古い人のデータを表示し続けない）
  try {
    if (root.addEventListener && root.document) {
      root.addEventListener("storage", function (e) {
        if (e && e.key === CTX_KEY && e.oldValue !== e.newValue && root.location) root.location.reload();
      });
    }
  } catch (e) { /* 何もしない */ }
})(typeof window !== "undefined" ? window : globalThis);
