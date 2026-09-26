// -*- coding: utf-8 -*-
// verify_uid_context.js
// Phase 8A-1: 学習データのアカウント分離（storage-ns.js）と context の世代管理（firebase-sync.js / app.js）の回帰テスト。
// 本物の questions_*.js / storage-ns.js / log-archive.js / app.js / firebase-sync.js を端末ごとの vm で動かし、
// Firebase の import だけを偽 Auth・偽 Firestore（端末間で共有）に差し替える。偽 Firestore は本番の Rules と同じく
// users/{uid}/units と kyotsu-math-summary/{uid} への書き込みを「ログイン中の本人の uid だけ」に制限する。
//
//   node tools/verify_uid_context.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..");
const J = JSON.stringify;
const C = (o) => JSON.parse(J(o));
const SYNC_SRC = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8");
const CHILD = (SYNC_SRC.match(/const CHILD_UID = "([A-Za-z0-9]+)";/) || [])[1];
const GUARDIAN = (SYNC_SRC.match(/const GUARDIAN_UIDS = \[\s*"([A-Za-z0-9]+)"/) || [])[1];
const OTHER = "otherLearnerUid0000000000001";
const UNIT = "kyokusen";
const DAY = 864e5;
const NS = require(path.join(DIR, "storage-ns.js"));
const LA = require(path.join(DIR, "log-archive.js"));

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail).slice(0, 400) : "")); }
}
async function section(title, fn) {
  console.log("\n" + title);
  try { await fn(); } catch (e) { check("例外なく実行できる", false, String(e && e.stack || e).split("\n").slice(0, 3).join(" ")); }
}
async function settle() { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); }

// ---- 偽 Firestore（端末間で共有）。gate を入れると、読み書きがそこで止まる（同期の途中を作る） ----
function makeCloud() {
  const store = {};
  const cloud = { store, writes: [], rejected: [], gate: null };
  const snap = (d) => ({ exists: () => !!d, data: () => (d ? JSON.parse(J(d)) : undefined) });
  const wait = async () => { while (cloud.gate) await cloud.gate; };
  cloud.fbFor = (dev) => ({
    initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => ({}),
    setPersistence: async () => {}, browserLocalPersistence: {},
    signInWithEmailAndPassword: async () => {}, signOut: async () => {},
    onAuthStateChanged: (_a, cb) => { dev.page.authCb = cb; },
    doc: (_db, ...seg) => ({ path: seg.join("/") }),
    collection: (_db, ...seg) => ({ path: seg.join("/") }),
    getDoc: async (ref) => {
      await wait();
      if (cloud.failOnce && cloud.failOnce.op === "read" && ref.path.indexOf(cloud.failOnce.match) >= 0) { cloud.failOnce = null; throw new Error("read failed once"); }
      return snap(store[ref.path]);
    },
    getDocs: async (col) => {
      await wait();
      const depth = col.path.split("/").length + 1;
      const docs = Object.keys(store).filter((p) => p.startsWith(col.path + "/") && p.split("/").length === depth)
        .map((p) => { const d = JSON.parse(J(store[p])); return { id: p.split("/").pop(), data: () => d }; });
      return { forEach: (f) => docs.forEach(f) };
    },
    setDoc: async (ref, data, opts) => {
      await wait();
      if (cloud.failOnce && cloud.failOnce.op === "write" && ref.path.indexOf(cloud.failOnce.match) >= 0) { cloud.failOnce = null; throw new Error("write failed once"); }
      const seg = ref.path.split("/");
      const owner = seg[0] === "users" || seg[0] === "kyotsu-math-summary" || seg[0] === "dailyquest-logs" ? seg[1] : null;
      // 本番の Rules：本人の uid だけ書ける（書いた瞬間のトークン＝その端末の今のログイン）
      if (owner && owner !== dev.authUid) { cloud.rejected.push({ path: ref.path, by: dev.authUid }); throw Object.assign(new Error("permission-denied"), { code: "permission-denied" }); }
      cloud.writes.push({ path: ref.path, by: dev.authUid, data: JSON.parse(J(data)) });
      store[ref.path] = opts && opts.merge ? Object.assign({}, store[ref.path] || {}, JSON.parse(J(data))) : JSON.parse(J(data));
    },
    serverTimestamp: () => "SERVER_TS"
  });
  cloud.unit = (uid, unit) => (store["users/" + uid + "/units/" + (unit || UNIT)] ? JSON.parse(store["users/" + uid + "/units/" + (unit || UNIT)].payload) : null);
  return cloud;
}

function makeElement() {
  const t = { style: {}, dataset: {}, innerHTML: "", innerText: "", value: "", disabled: false, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
  const noop = () => undefined;
  const methods = { appendChild: noop, removeChild: noop, insertBefore: noop, remove: noop, addEventListener: noop,
    removeEventListener: noop, setAttribute: noop, removeAttribute: noop, focus: noop, blur: noop, click: noop,
    scrollIntoView: noop, querySelector: () => null, closest: () => null, querySelectorAll: () => [] };
  return new Proxy(t, { get: (o, p) => (p in o ? o[p] : methods[p]), set: (o, p, v) => { o[p] = v; return true; } });
}

// 端末：localStorage は端末ごと。open() でページを開き（Auth は端末に残っている authUser で判定される）、
// login / logout で Auth を変える。context が変わってページが読み込み直しを求めたら、同じ端末で開き直す。
function makeDevice(cloud, clock, name) {
  const store = {};
  const dev = { name, store, authUser: null, authUid: null, confirms: [], confirmAnswer: true, reloads: 0, page: null };
  const session = {};
  dev.open = async () => {
    const page = { reloaded: false, timers: [] };
    dev.page = page;
    const els = {};
    const ctx = {
      console: { log() {}, warn() {}, error() {} },
      alert: () => {}, confirm: (m) => { dev.confirms.push(m); return dev.confirmAnswer; }, scrollTo: () => {},
      addEventListener: () => {},
      setTimeout: (fn, ms) => { page.timers.push({ fn, ms }); return page.timers.length; },
      clearTimeout: (id) => { if (page.timers[id - 1]) page.timers[id - 1].fn = null; },
      setInterval: () => 0, clearInterval: () => {},
      getComputedStyle: (e) => e.style,
      navigator: { userAgent: "verify-" + name },
      location: { reload: () => { page.reloaded = true; dev.reloads++; } },
      sessionStorage: { getItem: (k) => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: (k) => { delete session[k]; } },
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { if (dev.quota) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        key: (i) => Object.keys(store)[i],
        get length() { return Object.keys(store).length; }
      },
      document: { getElementById: (id) => (els[id] || (els[id] = makeElement())), querySelector: () => null, querySelectorAll: () => [],
        createElement: () => makeElement(), addEventListener: () => {}, body: makeElement(), readyState: "complete" },
      __fb: cloud.fbFor(dev),
      __NOW: clock.now
    };
    ctx.window = ctx;
    ctx.document.getElementById("saveStatus").parentNode = makeElement();
    vm.createContext(ctx);
    vm.runInContext("Date.now = () => __NOW;", ctx);
    const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
    html.match(/questions_[a-z_0-9]+\.js|storage-ns\.js(?=\?)|log-archive\.js(?=\?)|app\.js(?=\?)/g)
      .forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, { filename: f }));
    vm.runInContext(SYNC_SRC.replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]+";/g, "const {$1} = __fb;"), ctx, { filename: "firebase-sync.js" });
    page.ctx = ctx;
    page.els = els;
    page.run = (code) => { ctx.__NOW = clock.now; return vm.runInContext(code, ctx); };
    return page;
  };
  // Auth の状態をページに伝える（Firebase が起動時・ログイン・ログアウトで呼ぶ onAuthStateChanged）
  dev.auth = async (user) => {
    dev.authUser = user;
    dev.authUid = user ? user.uid : null;
    dev.page.authCb(user);
    await settle();
    if (dev.page.reloaded) { await dev.open(); dev.page.authCb(dev.authUser); await settle(); }
    return dev.page;
  };
  // 端末でアプリを開く（Auth は端末に残っている状態）
  dev.start = async () => { await dev.open(); dev.page.authCb(dev.authUser); await settle(); return dev.page; };
  dev.login = (uid) => dev.auth({ uid, email: uid + "@example.com" });
  dev.logout = () => dev.auth(null);
  dev.flush = async () => {
    for (let i = 0; i < 5; i++) {
      const due = dev.page.timers.splice(0);
      if (!due.length) break;
      for (const t of due) if (t.fn && t.ms !== 900 && t.ms !== 8000) { dev.page.ctx.__NOW = clock.now; t.fn(); }
      await settle();
    }
  };
  dev.ctx = () => JSON.parse(store[NS.CTX_KEY] || "null");
  dev.guest = () => JSON.parse(store[NS.GUEST_KEY] || "null");
  dev.keys = (prefix) => Object.keys(store).filter((k) => k.indexOf(prefix) === 0);
  dev.localOf = (prefix, unit) => (store[prefix + (unit || UNIT)] ? JSON.parse(store[prefix + (unit || UNIT)]) : null);
  return dev;
}

// 表示中の単元で n 問答える（正解・誤答を交互）
function answerN(dev, n, clock) {
  const p = dev.page;
  p.run(`selectUnit(${J(UNIT)}); startExam();`);
  for (let i = 0; i < n; i++) {
    clock.now += 60000;
    const q = p.run("currentQuestion()");
    if (!q) break;
    p.run(i % 2 ? "answer((currentQuestion().correct + 1) % currentQuestion().a.length)" : "answer(currentQuestion().correct)");
    p.run("nextQuestion()");
  }
}
const events = (d) => (d && d.state ? new Set(LA.countableLog(d.state).map((r) => r.timestamp + "|" + r.questionId + "|" + r.outcome)) : new Set());
const up = (uid) => NS.userPrefix(uid);
// firebase-sync.js の本物の mergeUnitData（LogArchive あり）
function mergeForTest() {
  const src = SYNC_SRC.replace(/\r\n/g, "\n");
  const a = src.indexOf("function freshness");
  const b = src.indexOf("/* =========================================================\n   Firestore 入出力", a);
  return new Function("globalThis", src.slice(a, b) + "\nreturn mergeUnitData;")({ LogArchive: LA, KyotsuNS: NS });
}
const setup = () => { const clock = { now: Date.UTC(2026, 8, 20, 1) }; const cloud = makeCloud(); return { clock, cloud }; };

(async () => {
  await section("[1] 確認中（unresolved）は学習データを開かない・保存しない", async () => {
    const { clock, cloud } = setup();
    const d = makeDevice(cloud, clock, "A");
    const p = await d.open();       // Auth の判定前
    p.run(`selectUnit(${J(UNIT)})`);
    check("1-1 確認中は単元を開かない（state.unit が無い）", p.run("state.unit") == null);
    check("1-2 確認中は保存しない（save は false・学習データのキーを作らない）", p.run("save()") === false && !Object.keys(d.store).some((k) => k.indexOf("kyotsu_app_v1") === 0));
    check("1-3 確認中は context が無い（kyotsuCtx が null）", p.run("kyotsuCtx") === null && p.run("typeof setCtxBanner") === "function");
    p.authCb(null); await settle();
    check("1-4 未ログインが確定したら guest session を作り、その領域で開く", d.ctx().state === "guest" && NS.validId(d.ctx().guestSessionId) && d.guest().active === d.ctx().guestSessionId);
    p.run(`selectUnit(${J(UNIT)})`);
    check("1-5 確定後は単元を開ける", p.run("state.unit") === UNIT);
  });

  await section("[1b] Auth を確認できないときは確認中のまま止める（fail closed）", async () => {
    const { clock, cloud } = setup();
    const d = makeDevice(cloud, clock, "A");
    await d.start(); await d.login(CHILD); answerN(d, 2, clock); await d.flush();   // 以前この端末で本人がログインしていた
    const guestBefore = J(d.guest());
    const storeBefore = J(d.store), writesBefore = cloud.writes.length;
    // SDK を読み込めない（onerror）／ Auth の判定が8秒以上届かない
    const p = await d.open();
    p.run("kyotsuSyncUnavailable()");
    p.timers.forEach((t) => { if (t.fn && t.ms === 8000) t.fn(); });
    await settle();
    check("1b-1 前回のアカウントを推測して開かない（context は null のまま）", p.run("kyotsuCtx") === null && p.run("activeCtx") === null);
    check("1b-2 「確認できません」の案内を出す", /アカウントを確認できません/.test(p.run("kyotsuCtxBannerText") || ""), p.run("kyotsuCtxBannerText"));
    p.run(`selectUnit(${J(UNIT)})`);
    check("1b-3 単元を開かない・保存しない", p.run("state.unit") == null && p.run("save()") === false);
    check("1b-4 guest にも切り替えない（新しい session を作らない）", J(d.guest()) === guestBefore);
    check("1b-5 localStorage も Firestore も一切変わらない", J(d.store) === storeBefore && cloud.writes.length === writesBefore);
    // あとから Auth の判定が届けば、ふつうに確定する
    p.authCb(d.authUser); await settle();
    check("1b-6 あとから Auth の判定が届けば、そのアカウントで確定して開ける", p.run("kyotsuCtx") !== null && p.run("kyotsuCtx.authUid") === CHILD);
    // 最初から一度もログインしていない端末でも、Auth の結果が「未ログイン」と届くまでは guest にしない
    const e = makeDevice(cloud, clock, "E");
    const pe = await e.open();
    pe.run("kyotsuSyncUnavailable()");
    check("1b-7 初めての端末でも、Auth を確認できなければ guest を作らない", pe.run("kyotsuCtx") === null && !e.guest() && !(NS.CTX_KEY in e.store));
    pe.authCb(null); await settle();
    check("1b-8 Auth が「未ログイン」と判定したときだけ guest に入る", pe.run("kyotsuCtx.state") === "guest" && !!e.guest());
  });

  await section("[2] アカウントごとに分かれる（本人A・本人B・保護者）", async () => {
    const { clock, cloud } = setup();
    const d = makeDevice(cloud, clock, "A");
    await d.start(); await d.login(CHILD);
    answerN(d, 4, clock); await d.flush();
    const childLocal = d.localOf(up(CHILD));
    check("2-1 本人の回答は本人の領域 kyotsu_app_v15_u_{uid}_ に入り、Firestore にも送られる",
      childLocal.state.answerLog.length === 4 && cloud.unit(CHILD).state.answerLog.length === 4);
    check("2-2 単元・サマリーの書き込みに印 w と client version", cloud.store["users/" + CHILD + "/units/" + UNIT].w === NS.WRITER_MARKER &&
      cloud.store["kyotsu-math-summary/" + CHILD].w === NS.WRITER_MARKER && cloud.store["kyotsu-math-summary/" + CHILD].client === NS.CLIENT_VERSION);
    await d.login(OTHER);
    check("2-3 別の本人Bでログインするとページを読み込み直し、Bの領域（空）で開く", d.reloads >= 1 && d.ctx().storageOwnerUid === OTHER && !d.localOf(up(OTHER)));
    answerN(d, 2, clock); await d.flush();
    check("2-4 Bの回答はBの領域とBの Firestore だけ。Aの local・remote は変わらない",
      d.localOf(up(OTHER)).state.answerLog.length === 2 && cloud.unit(OTHER).state.answerLog.length === 2 &&
      d.localOf(up(CHILD)).state.answerLog.length === 4 && cloud.unit(CHILD).state.answerLog.length === 4);
    const before = cloud.writes.length;
    await d.login(GUARDIAN);
    check("2-5 保護者でログイン：保護者自身の領域は空、子どもは閲覧用キャッシュ kyotsu_view_v1_{保護者}_{子ども}_ に入る",
      !d.localOf(up(GUARDIAN)) && J(d.localOf(NS.viewPrefix(GUARDIAN, CHILD))) === J(cloud.unit(CHILD)));
    answerN(d, 3, clock); await d.flush();
    check("2-6 保護者の検証プレイは保護者の領域だけ・Firestore への書き込みは0（Rules で拒否されたものも0）",
      d.localOf(up(GUARDIAN)).state.answerLog.length === 3 && cloud.writes.length === before && cloud.rejected.length === 0 &&
      d.localOf(NS.viewPrefix(GUARDIAN, CHILD)).state.answerLog.length === 4 && d.localOf(up(CHILD)).state.answerLog.length === 4);
    await d.login(CHILD);
    check("2-7 そのあと子どもでログインしても、保護者の検証プレイは子どもの local・remote に入らない",
      d.localOf(up(CHILD)).state.answerLog.length === 4 && cloud.unit(CHILD).state.answerLog.length === 4 && cloud.rejected.length === 0);
    check("2-8 閲覧用キャッシュは子どもの書き込み領域と別のキー", d.keys(NS.viewPrefix(GUARDIAN, CHILD)).every((k) => k.indexOf(NS.USER_PREFIX) !== 0));
  });

  await section("[3] 同期の途中で context が変わっても、古い処理は新しい context を変えない", async () => {
    for (const [name, next] of [["別の本人でログイン", OTHER], ["ログアウト", null], ["保護者に切替", GUARDIAN]]) {
      const { clock, cloud } = setup();
      const d = makeDevice(cloud, clock, "A");
      await d.start(); await d.login(CHILD);
      answerN(d, 3, clock); await d.flush();
      // 子どもの端末で remote が進んでいる（別端末で解いた）状態にして、起動時同期の途中で止める
      const rem = C(cloud.unit(CHILD)); rem.state.answerLog.push(Object.assign({}, rem.state.answerLog[0], { timestamp: clock.now + 999 }));
      cloud.store["users/" + CHILD + "/units/" + UNIT].payload = J(rem);
      let release; cloud.gate = new Promise((r) => { release = r; });
      await d.open(); d.page.authCb(d.authUser); await settle();   // 起動時の syncAll が getDocs で止まる
      const oldPage = d.page;
      const writesBefore = cloud.writes.length;
      d.authUser = next ? { uid: next } : null; d.authUid = next;
      oldPage.authCb(d.authUser); await settle();                  // 同期の途中で context が変わる
      check("3 " + name + "：古いページは無効化されて読み込み直しを要求", oldPage.reloaded === true && oldPage.run("activeCtx") === null && oldPage.run("dirtyUnits.size") === 0);
      const storeSnap = J(d.store);
      cloud.gate = null; release(); await settle();                // 止まっていた古い同期が再開
      check("3 " + name + "：再開した古い同期は Firestore にも local にも書かない", cloud.writes.length === writesBefore && J(d.store) === storeSnap && cloud.rejected.length === 0,
        { writes: cloud.writes.slice(writesBefore).map((w) => w.path), rejected: cloud.rejected });
      check("3 " + name + "：古いページの busy・dirty・タイマーは新しい context に残らない", oldPage.run("busy") === false && oldPage.run("dirtyUnits.size") === 0 && oldPage.run("pushTimer") === null);
      await d.open(); d.page.authCb(d.authUser); await settle();
      check("3 " + name + "：開き直したページは新しい context で動く（新しい同期は飛ばされない）", d.ctx().storageOwnerUid === (next || null) || (next === null && d.ctx().state === "guest"));
    }
    // 未送信（dirty・タイマー）を持ったまま切り替え
    const { clock, cloud } = setup();
    const d = makeDevice(cloud, clock, "A");
    await d.start(); await d.login(CHILD);
    answerN(d, 2, clock);                                          // 4秒後の pushDirty が予約された状態
    const p = d.page;
    const writesBefore = cloud.writes.length;
    check("3-4 前提：dirty とタイマーがある", p.run("dirtyUnits.size") > 0 && p.run("pushTimer") !== null);
    d.authUser = { uid: OTHER }; d.authUid = OTHER;
    p.authCb(d.authUser); await settle();
    p.timers.forEach((t) => { if (t.fn) t.fn(); }); await settle(); // 古いタイマーが走っても
    check("3-5 切り替えで dirty とタイマーは消え、古いタイマーが走っても新しいアカウントへ送らない",
      p.run("dirtyUnits.size") === 0 && cloud.writes.slice(writesBefore).every((w) => w.path.indexOf(OTHER) < 0) && !cloud.unit(OTHER));
  });

  await section("[4] 未ログインの学習の取り込み", async () => {
    // R1：本人 → ログアウト → guest で回答 → 同じ本人でログイン（リセットなし）
    {
      const { clock, cloud } = setup();
      const d = makeDevice(cloud, clock, "A");
      await d.start(); await d.login(CHILD);
      answerN(d, 2, clock); await d.flush();
      await d.logout();
      const sid = d.ctx().guestSessionId;
      const sess = d.guest().sessions[sid];
      check("4-1 ログアウトで新しい guest session（由来は本人・開始時の世代を記録）", d.ctx().state === "guest" && sess.originUid === CHILD && sess.originRole === "learner" && sess.baseGen[UNIT] === 0);
      check("4-2 ログアウト後は本人の学習状態を表示しない（guest の領域で開く）", d.page.run("state.answerLog.length") === 0 || d.page.run("state.unit") == null);
      answerN(d, 3, clock);
      const gp = NS.guestPrefix(sid);
      check("4-3 guest の回答は guest session の領域だけ（Firestore には送らない）", d.localOf(gp).state.answerLog.length === 3 && cloud.unit(CHILD).state.answerLog.length === 2);
      await d.start();   // reload しても同じ session を続ける
      check("4-4 reload・再起動でも同じ guest session を続ける", d.ctx().guestSessionId === sid && d.guest().active === sid);
      await d.login(CHILD);
      const rem = cloud.unit(CHILD);
      check("4-5 同じ本人でログイン：確認なしで取り込み、remote は 2＋3＝5件", d.confirms.length === 0 && rem.state.answerLog.length === 5, rem.state.answerLog.length);
      const s2 = d.guest().sessions[sid];
      check("4-6 取り込み済みの印（importedTo / importedAt / status）", s2.status === "imported" && s2.importedTo === CHILD && typeof s2.importedAt === "number" && s2.units[UNIT].importedTo === CHILD);
      check("4-7 guest の画面位置・mode などは持ち込まない（resetGen も無いまま）", rem.state.resetGen === undefined && d.localOf(up(CHILD)).state.answerLog.length === 5);
      await d.start();
      check("4-8 もう一度同期しても二重に入らない（5件のまま）", cloud.unit(CHILD).state.answerLog.length === 5);
    }
    // 最初から guest → 本人でログイン（本人の世代 0）→ 確認して取り込み
    {
      const { clock, cloud } = setup();
      const d = makeDevice(cloud, clock, "A");
      await d.start();
      check("4-9 最初から未ログイン：由来なしの session", d.ctx().state === "guest" && d.guest().sessions[d.ctx().guestSessionId].originUid === null);
      answerN(d, 2, clock);
      const sid = d.ctx().guestSessionId;
      await d.login(CHILD);
      check("4-10 本人の世代 0：確認なしで自動で取り込む（未ログインで学習するのは子ども）", d.confirms.length === 0 && cloud.unit(CHILD).state.answerLog.length === 2 && d.guest().sessions[sid].status === "imported");
    }
    // 最初から guest → 本人の世代が 1 以上 → 取り込まない
    {
      const { clock, cloud } = setup();
      const other = makeDevice(cloud, clock, "B");
      await other.start(); await other.login(CHILD);
      answerN(other, 1, clock);
      other.page.run("resetStatsOnly()"); await other.flush();
      check("4-11 前提：本人の世代は 1", cloud.unit(CHILD).state.resetGen === 1);
      const d = makeDevice(cloud, clock, "A");
      await d.start(); answerN(d, 2, clock);
      const sid = d.ctx().guestSessionId;
      await d.login(CHILD);
      check("4-12 由来なし session・本人の世代1：取り込まず session を残す（世代・回答は変えない）",
        (cloud.unit(CHILD).state.answerLog || []).length === 0 && cloud.unit(CHILD).state.resetGen === 1 && d.guest().sessions[sid].status === "pending" &&
        d.localOf(NS.guestPrefix(sid)).state.answerLog.length === 2);
    }
    // 本人 → ログアウト → guest で回答 → 別端末でリセット → 同じ本人でログイン（R2/R3）→ 取り込まない
    {
      const { clock, cloud } = setup();
      const d = makeDevice(cloud, clock, "A");
      await d.start(); await d.login(CHILD); answerN(d, 2, clock); await d.flush();
      await d.logout(); answerN(d, 3, clock);
      const sid = d.ctx().guestSessionId;
      const other = makeDevice(cloud, clock, "B");
      await other.start(); await other.login(CHILD);
      other.page.run(`selectUnit(${J(UNIT)}); resetStatsOnly();`); await other.flush();
      await d.login(CHILD);
      check("4-13 guest 開始後に世代が増えていた：取り込まず、session を残す", cloud.unit(CHILD).state.resetGen === 1 &&
        cloud.unit(CHILD).state.answerLog.length === 0 && d.guest().sessions[sid].status === "pending");
    }
    // guest の中でリセット（guest の世代1）→ 本人の世代0 へ取り込んでも、本人の世代は上書きされない
    {
      const { clock, cloud } = setup();
      const d = makeDevice(cloud, clock, "A");
      await d.start(); await d.login(CHILD); answerN(d, 2, clock); await d.flush();
      await d.logout(); answerN(d, 2, clock);
      d.page.run("resetStatsOnly()"); answerN(d, 1, clock);
      const sid = d.ctx().guestSessionId;
      check("4-14 前提：guest の領域の世代は 1", NS.resetGenOf(d.localOf(NS.guestPrefix(sid))) === 1);
      await d.login(CHILD);
      const rem = cloud.unit(CHILD);
      check("4-15 本人の世代は 0 のまま、本人の2件は残り、guest のリセット後の1件だけ入る", rem.state.resetGen === undefined && rem.state.answerLog.length === 3, rem.state.answerLog.length);
    }
    // 複数の session が混ざらない・由来ごとの扱い・保護者では取り込まない
    {
      const { clock, cloud } = setup();
      const d = makeDevice(cloud, clock, "A");
      await d.start(); answerN(d, 2, clock);
      const s1 = d.ctx().guestSessionId;
      await d.login(CHILD);
      check("4-16 由来なしの session は子どもでログインすると確認なしで取り込む", d.confirms.length === 0 && cloud.unit(CHILD).state.answerLog.length === 2 && d.guest().sessions[s1].status === "imported");
      await d.logout(); answerN(d, 1, clock);
      const s2 = d.ctx().guestSessionId;
      check("4-17 次の未ログインは別の session・別の領域（前の session と混ざらない）", s1 !== s2 &&
        d.localOf(NS.guestPrefix(s1)).state.answerLog.length === 2 && d.localOf(NS.guestPrefix(s2)).state.answerLog.length === 1);
      const writesBefore = cloud.writes.length;
      await d.login(GUARDIAN);
      check("4-18 保護者でログイン：取り込みも確認もしない・何も書かない", d.confirms.length === 0 && cloud.writes.length === writesBefore &&
        d.guest().sessions[s2].status === "pending" && !d.localOf(up(GUARDIAN)));
      await d.logout(); answerN(d, 1, clock);
      const s3 = d.ctx().guestSessionId;
      check("4-19 保護者のログアウトから始まった session は由来が保護者", d.guest().sessions[s3].originRole === "guardian");
      await d.login(OTHER); await d.logout(); answerN(d, 1, clock);
      const s4 = d.ctx().guestSessionId;
      await d.login(CHILD);
      check("4-20 子どもでログイン：由来が子どもの s2 は取り込み、保護者由来の s3・別の本人由来の s4 は取り込まずに残す",
        d.guest().sessions[s2].status === "imported" && d.guest().sessions[s3].status === "pending" && d.guest().sessions[s4].status === "pending" &&
        cloud.unit(CHILD).state.answerLog.length === 3 && d.confirms.length === 0, cloud.unit(CHILD).state.answerLog.length);
    }
  });

  await section("[4b] 未ログインの学習の累計（弱点・ステージ・卒業数）は本人に足す・二重に足さない", async () => {
    const W = "方針切替";
    let CLK = null;
    // 本人の既存の累計を用意する（本人の local と Firestore の両方）
    const seed = async (d, cloud) => {
      await d.start(); await d.login(CHILD); answerN(d, 2, CLK); await d.flush();
      const edit = (x) => {
        x.stats.weakness = Object.assign({}, x.stats.weakness, { [W]: 10 });
        x.stats.stage = Object.assign({}, x.stats.stage, { "第1問": { t: 7, c: 4 } });
        x.stats.clearedCount = 2;
        return x;
      };
      d.store[up(CHILD) + UNIT] = J(edit(d.localOf(up(CHILD))));
      cloud.store["users/" + CHILD + "/units/" + UNIT].payload = J(edit(cloud.unit(CHILD)));
      await d.start();
    };
    // guest で学習する。卒業数 +1 は、guest の中で1問卒業した状態として guest の領域の値を +1 する
    const guestStudy = (d, n) => {
      answerN(d, n, CLK);
      const sid = d.ctx().guestSessionId, gk = NS.guestPrefix(sid) + UNIT;
      const g = JSON.parse(d.store[gk]);
      g.stats.clearedCount = (g.stats.clearedCount || 0) + 1;
      d.store[gk] = J(g);
      return { sid, gstats: g.stats };
    };
    const expectAdd = (g) => ({ w: 10 + (g.weakness[W] || 0), t: 7 + g.stage["第1問"].t, c: 4 + g.stage["第1問"].c, cl: 2 + g.clearedCount });
    const statsOf = (x) => ({ w: x.stats.weakness[W] || 0, t: x.stats.stage["第1問"].t, c: x.stats.stage["第1問"].c, cl: x.stats.clearedCount });
    {
      const { clock, cloud } = setup(); CLK = clock;
      const d = makeDevice(cloud, clock, "A");
      await seed(d, cloud);
      check("4b-0 前提：本人の累計は 弱点10・第1問 7/4・卒業2", J(statsOf(cloud.unit(CHILD))) === J({ w: 10, t: 7, c: 4, cl: 2 }), statsOf(cloud.unit(CHILD)));
      await d.logout();
      const { sid, gstats } = guestStudy(d, 4);
      const want = expectAdd(gstats);
      check("4b-1 前提：guest で弱点・ステージ・卒業数が増えている", (gstats.weakness[W] || 0) > 0 && gstats.stage["第1問"].t > 0 && gstats.clearedCount === 1, gstats);
      await d.login(CHILD);
      const rem = cloud.unit(CHILD), loc = d.localOf(up(CHILD));
      check("4b-2 取り込むと 本人の値＋guest の増分（remote と local が同じ）", J(statsOf(rem)) === J(want) && J(statsOf(loc)) === J(want), { got: statsOf(rem), want });
      check("4b-3 取り込み済みの印 guestImportDeltas に session ID とその session から足した量（remote・local とも）", J(Object.keys(rem.state.guestImportDeltas)) === J([sid]) && J(Object.keys(loc.state.guestImportDeltas)) === J([sid]) && rem.state.guestImportDeltas[sid].clearedCount === 1);
      await d.start(); await d.start();
      check("4b-4 reload・再同期を何度しても 1回分のまま", J(statsOf(cloud.unit(CHILD))) === J(want) && J(statsOf(d.localOf(up(CHILD)))) === J(want));
      const b = makeDevice(cloud, clock, "B");
      await b.start(); await b.login(CHILD);
      await d.start();
      check("4b-5 別端末との merge 後も 1回分・印も残る", J(statsOf(cloud.unit(CHILD))) === J(want) && J(Object.keys(cloud.unit(CHILD).state.guestImportDeltas)) === J([sid]) &&
        J(statsOf(b.localOf(up(CHILD)))) === J(want));
      const r = d.guest(); r.sessions[sid].status = "pending"; r.sessions[sid].units = {}; d.store[NS.GUEST_KEY] = J(r);
      await d.start();
      check("4b-6 同じ session をもう一度取り込ませても足さない（印で判定）・取り込み済みに戻る", J(statsOf(cloud.unit(CHILD))) === J(want) && d.guest().sessions[sid].status === "imported");
    }
    for (const [name, fail] of [["remote への書き込みが失敗", { op: "write", match: "/units/" + UNIT }], ["確認の読み直しが失敗", { op: "read", match: "/units/" + UNIT }]]) {
      const { clock, cloud } = setup(); CLK = clock;
      const d = makeDevice(cloud, clock, "A");
      await seed(d, cloud);
      await d.logout();
      const { sid, gstats } = guestStudy(d, 3);
      const want = expectAdd(gstats);
      cloud.failOnce = Object.assign({}, fail);
      await d.login(CHILD);
      check("4b-7 " + name + "：その回は取り込み済みにならない", d.guest().sessions[sid].status !== "imported");
      await d.start(); await d.start();
      check("4b-8 " + name + " → reload して再実行：累計は 1回分だけ・取り込み済みになる", J(statsOf(cloud.unit(CHILD))) === J(want) && J(statsOf(d.localOf(up(CHILD)))) === J(want) &&
        d.guest().sessions[sid].status === "imported", { got: statsOf(cloud.unit(CHILD)), want });
    }
    {
      const { clock, cloud } = setup(); CLK = clock;
      const d = makeDevice(cloud, clock, "A");
      await seed(d, cloud);
      await d.logout();
      answerN(d, 4, clock);
      d.page.run("resetStatsOnly()");
      const after = guestStudy(d, 2);
      const want = expectAdd(after.gstats);
      await d.login(CHILD);
      const rem = cloud.unit(CHILD);
      check("4b-9 guest 内でリセット：リセット後の累計だけが足され、リセット前の分は復活しない", J(statsOf(rem)) === J(want), { got: statsOf(rem), want, g: after.gstats });
      check("4b-10 guest の resetGen は本人へ持ち込まず、本人の resetGen も変えない・回答は本人2＋リセット後2", rem.state.resetGen === undefined && rem.state.answerLog.length === 4, rem.state.answerLog.length);
    }
  });

  await section("[4c] 別々の端末が別々の未ログイン session を取り込んだあとの merge（累計を失わない・二重に足さない）", async () => {
    const W = "方針切替";
    // 本物の取り込み処理で、baseline＋guest session 1つを取り込んだ本人の単元データを作る（端末ごとに別の Firestore）
    const importedPayload = async (base, guestAnswers, clockStart) => {
      const clock = { now: clockStart }; const cloud = makeCloud();
      const d = makeDevice(cloud, clock, "X");
      await d.start(); await d.login(CHILD);
      answerN(d, 2, clock); await d.flush();
      const edit = (x) => {
        x.stats.weakness = Object.assign({}, x.stats.weakness, { [W]: base.w });
        x.stats.stage = Object.assign({}, x.stats.stage, { "第1問": { t: base.t, c: base.c } });
        x.stats.clearedCount = base.cl;
        return x;
      };
      d.store[up(CHILD) + UNIT] = J(edit(d.localOf(up(CHILD))));
      cloud.store["users/" + CHILD + "/units/" + UNIT].payload = J(edit(cloud.unit(CHILD)));
      await d.start();
      await d.logout();
      answerN(d, guestAnswers, clock);
      const gk = NS.guestPrefix(d.ctx().guestSessionId) + UNIT;
      const g = JSON.parse(d.store[gk]); g.stats.clearedCount = (g.stats.clearedCount || 0) + 1; d.store[gk] = J(g);
      await d.login(CHILD);
      return { payload: cloud.unit(CHILD), delta: g.stats };
    };
    const statsOf = (x) => ({ w: x.stats.weakness[W] || 0, t: x.stats.stage["第1問"].t, c: x.stats.stage["第1問"].c, cl: x.stats.clearedCount });
    const sum = (b, ...ds) => ({ w: b.w + ds.reduce((s, d) => s + (d.weakness[W] || 0), 0), t: b.t + ds.reduce((s, d) => s + d.stage["第1問"].t, 0),
      c: b.c + ds.reduce((s, d) => s + d.stage["第1問"].c, 0), cl: b.cl + ds.reduce((s, d) => s + d.clearedCount, 0) });
    const merge = mergeForTest();
    const base = { w: 10, t: 7, c: 4, cl: 2 };
    const A = await importedPayload(base, 3, Date.UTC(2026, 8, 20, 1));
    const B = await importedPayload(base, 4, Date.UTC(2026, 8, 21, 1));   // A を知らない端末（別の日に別の guest session）
    check("4c-0 前提：A・B それぞれは 本人＋自分の session だけ", J(statsOf(A.payload)) === J(sum(base, A.delta)) && J(statsOf(B.payload)) === J(sum(base, B.delta)),
      { A: statsOf(A.payload), B: statsOf(B.payload) });
    const g1 = merge(C(A.payload), C(B.payload)), g1r = merge(C(B.payload), C(A.payload));
    const want1 = sum(base, A.delta, B.delta);
    check("4c-G1 baseline 10・A +3・B +4 を merge → 本人＋A＋B（弱点・ステージ t / c・卒業数のすべて）・順番に依存しない",
      J(statsOf(g1)) === J(want1) && J(statsOf(g1r)) === J(want1), { got: statsOf(g1), rev: statsOf(g1r), want: want1 });
    const g2 = merge(C(g1), C(B.payload)), g2r = merge(C(B.payload), C(g1));
    check("4c-G2 A・B 両方を知る側（合算済み）と B だけの側を merge → 合算済みのまま（二重に足さない）",
      J(statsOf(g2)) === J(want1) && J(statsOf(g2r)) === J(want1), { got: statsOf(g2), rev: statsOf(g2r), want: want1 });
    const baseB = { w: 12, t: 9, c: 5, cl: 3 };
    const B3 = await importedPayload(baseB, 4, Date.UTC(2026, 8, 21, 1));
    const g3 = merge(C(A.payload), C(B3.payload)), g3r = merge(C(B3.payload), C(A.payload));
    const want3 = sum({ w: 12, t: 9, c: 5, cl: 3 }, A.delta, B3.delta);   // 通常の累計は大きい方（max(10,12) など）＋ A ＋ B
    check("4c-G3 通常学習の baseline も違う（A 10・B 12）→ 大きい方の baseline ＋ A ＋ B",
      J(statsOf(g3)) === J(want3) && J(statsOf(g3r)) === J(want3), { got: statsOf(g3), rev: statsOf(g3r), want: want3 });
    const g4 = merge(C(A.payload), C(A.payload));
    check("4c-G4 同じ session を両側が持つ → 1回分だけ", J(statsOf(g4)) === J(sum(base, A.delta)), { got: statsOf(g4) });
    const g5 = merge(C(g1), C(g1));
    check("4c-G5 merge 結果どうしをもう一度 merge しても変わらない（冪等）", J(statsOf(g5)) === J(want1));
    // 通常の学習との共存：A は取り込み後にふつうに回答して累計が増える。B は取り込みも無い baseline のまま
    {
      const Aplus = C(A.payload);
      Aplus.stats.weakness[W] = (Aplus.stats.weakness[W] || 0) + 2;
      Aplus.stats.stage["第1問"] = { t: Aplus.stats.stage["第1問"].t + 5, c: Aplus.stats.stage["第1問"].c + 3 };
      Aplus.state.answerLog = Aplus.state.answerLog.concat([Object.assign({}, Aplus.state.answerLog[0], { timestamp: Date.UTC(2026, 8, 25) })]);
      const plain = C(A.payload);
      delete plain.state.guestImportDeltas;
      Object.assign(plain.stats, { weakness: Object.assign({}, plain.stats.weakness, { [W]: base.w }), stage: Object.assign({}, plain.stats.stage, { "第1問": { t: base.t, c: base.c } }), clearedCount: base.cl });
      const m = merge(C(Aplus), C(plain)), mr = merge(C(plain), C(Aplus));
      check("4c-G6 取り込み後の通常の回答（A）と、取り込みの無い端末の baseline（B）→ A の値のまま（delta を二重に足さず、通常の分も失わない）",
        J(statsOf(m)) === J(statsOf(Aplus)) && J(statsOf(mr)) === J(statsOf(Aplus)), { got: statsOf(m), want: statsOf(Aplus) });
    }
    // compact / save / 片側 null / リセット / 世代違い
    {
      const withD = C(g1);
      check("4c-7 compactUnitData（save と merge で通る）でも guestImportDeltas は残る", J(LA.compactUnitData(C(withD)).state.guestImportDeltas) === J(withD.state.guestImportDeltas));
      check("4c-8 片側 null の merge でも残り、正規形のまま", J(merge(C(withD), null).state.guestImportDeltas) === J(withD.state.guestImportDeltas));
      const newGen = C(B.payload); newGen.state.resetGen = 1; delete newGen.state.guestImportDeltas;
      newGen.stats.weakness = {}; newGen.stats.stage = {}; newGen.stats.clearedCount = 0; newGen.state.answerLog = [];
      const r1 = merge(C(withD), C(newGen)), r2 = merge(C(newGen), C(withD));
      check("4c-9 リセット（新しい世代）が勝つ：古い世代の取り込み分・delta は戻らない", !("guestImportDeltas" in r1.state) && J(r1) === J(r2) && (r1.stats.clearedCount || 0) === 0);
      const messy = C(withD); const k0 = Object.keys(messy.state.guestImportDeltas)[0];
      messy.state.guestImportDeltas["bad id!"] = { clearedCount: 9 }; messy.state.guestImportDeltas[k0].weakness["x"] = -3;
      check("4c-10 壊れた delta（不正な session ID・負の値）は正規化で落とす", J(Object.keys(merge(C(messy), null).state.guestImportDeltas)) === J(Object.keys(withD.state.guestImportDeltas)) &&
        !("x" in merge(C(messy), null).state.guestImportDeltas[k0].weakness));
    }
    // 7C 以前のクライアント（delta を知らない）の merge を通っても、guestImportDeltas は state の項目として残る
    {
      const { execSync } = require("child_process");
      let old = null;
      try { old = execSync("git show 81bdb7c:firebase-sync.js", { cwd: DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n"); } catch (e) { /* git 無し */ }
      if (old) {
        const a = old.indexOf("function freshness"), b = old.indexOf("/* =========================================================\n   Firestore 入出力", a);
        const mergeOld = new Function("globalThis", old.slice(a, b) + "\nreturn mergeUnitData;")({ LogArchive: LA });
        const o = mergeOld(C(g1), C(B.payload));
        check("4c-11 古いクライアントの merge を通っても delta は消えず、新しいクライアントの次の merge で合計が正しくなる",
          J(Object.keys(o.state.guestImportDeltas || {})) === J(Object.keys(g1.state.guestImportDeltas)) && J(statsOf(merge(C(o), C(A.payload)))) === J(want1),
          { keys: Object.keys(o.state.guestImportDeltas || {}), after: statsOf(merge(C(o), C(A.payload))) });
      }
    }
  });

  await section("[5] 集計ページは今の context の領域だけを読む", async () => {
    const U5 = "keiryo";
    const store = {};
    const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
      key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
    const mk = (n, base) => ({ state: { unit: U5, answerLog: Array.from({ length: n }, (_, i) => ({ questionId: "ky1-1", timestamp: base + i * 1000, isCorrect: true, outcome: "answered", mode: "normal" })) }, stats: {} });
    store[up(CHILD) + U5] = J(mk(3, Date.UTC(2026, 8, 1)));
    store[up(GUARDIAN) + U5] = J(mk(7, Date.UTC(2026, 8, 2)));
    store[NS.viewPrefix(GUARDIAN, CHILD) + U5] = J(mk(5, Date.UTC(2026, 8, 3)));
    store[NS.guestPrefix("gsess-1") + U5] = J(mk(2, Date.UTC(2026, 8, 4)));
    store["kyotsu_app_v14_" + U5] = J(mk(11, Date.UTC(2026, 8, 5)));
    const NSs = new Function("window", "globalThis", "module", fs.readFileSync(path.join(DIR, "storage-ns.js"), "utf8") + "\nreturn window.KyotsuNS;")({ localStorage: fake }, {}, undefined);
    const U5_META = { [U5]: { label: U5, questions: [{ id: "ky1-1" }] } };
    const slice = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a) + a.length));
    const reader = (f, a, b, ret) => new Function("localStorage", "window", "U5_META", "LogArchive", slice(fs.readFileSync(path.join(DIR, f), "utf8"), a, b) + "\nreturn " + ret + ";")(fake, { LogArchive: LA, KyotsuNS: NSs }, U5_META, LA);
    const counts = () => {
      const cal = reader("calendar.js", '"use strict";', "var dayMap = buildDayMap();", "buildDayMap()");
      const prog = reader("progress.js", '"use strict";', "/* ---------- 日付表示", "collectUnitProgress()");
      const str = reader("unit-strength.js", '"use strict";', "/* ---------- 描画", "collectUnitAccuracy()");
      const cctx = { console, localStorage: fake, U5_META, TAG_LABELS: {}, LogArchive: LA, KyotsuNS: NSs, document: { readyState: "loading", addEventListener() {}, getElementById: () => null } };
      cctx.window = cctx; vm.createContext(cctx); vm.runInContext(fs.readFileSync(path.join(DIR, "crossunit.js"), "utf8"), cctx);
      const rep = vm.runInContext("buildCrossUnitReport()", cctx);
      return [Object.values(cal).reduce((s, v) => s + v.attempts, 0), (prog.find((x) => x.unit === U5) || {}).attempts || 0, (str[0] || {}).attempts || 0, Number((rep.match(/総回答数: (\d+)/) || [])[1])];
    };
    const setCtx = (c) => { store[NS.CTX_KEY] = J(c); };
    setCtx({ state: "authenticated", authUid: CHILD, role: "learner", storageOwnerUid: CHILD, remoteTargetUid: CHILD });
    check("5-1 本人：calendar・progress・unit-strength・crossunit はどれも本人の3件", J(counts()) === J([3, 3, 3, 3]), counts());
    setCtx({ state: "authenticated", authUid: GUARDIAN, role: "guardian", storageOwnerUid: GUARDIAN, remoteTargetUid: CHILD });
    check("5-2 保護者：子どもの閲覧用キャッシュの5件（保護者自身の検証7件・子どもの書き込み領域は読まない）", J(counts()) === J([5, 5, 5, 5]), counts());
    setCtx({ state: "guest", guestSessionId: "gsess-1" });
    check("5-3 未ログイン：その guest session の2件", J(counts()) === J([2, 2, 2, 2]), counts());
    delete store[NS.CTX_KEY];
    check("5-4 context が無い（確認前）：何も読まない。旧キー v14 の11件も読まない", J(counts()) === J([0, 0, 0, 0]), counts());
    const src = ["storage-ns.js", "calendar.js", "progress.js", "unit-strength.js", "crossunit.js"].map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n");
    check("5-5 別タブで context が変わったら読み込み直す（storage イベント）", /addEventListener\("storage"/.test(src) && /CTX_KEY/.test(src));
  });

  await section("[6] 旧キー（v13 / v14）は移さない・消さない・新しい情報の有無だけ記録", async () => {
    const { clock, cloud } = setup();
    const d = makeDevice(cloud, clock, "A");
    await d.start(); await d.login(CHILD); answerN(d, 3, clock); await d.flush();
    const mine = d.localOf(up(CHILD));
    d.store["kyotsu_app_v14_" + UNIT] = J(mine);                                        // 本人のデータと同じ中身
    const extra = C(mine); extra.state.answerLog.push(Object.assign({}, extra.state.answerLog[0], { timestamp: clock.now - 5 * DAY }));
    d.store["kyotsu_app_v14_keiryo"] = J(Object.assign(extra, { state: Object.assign(extra.state, { unit: "keiryo" }) }));
    d.store["kyotsu_app_v13"] = J(extra);                                               // v13 も新しい情報あり
    const snapCloud = J(cloud.store);
    await d.start();
    const rec = JSON.parse(d.store.kyotsu_legacy_check_v1 || "null");
    check("6-1 新しい情報なしの v14 は no-new-info、ありの v14・v13 は has-new-info", rec && rec.result["kyotsu_app_v14_" + UNIT] === "no-new-info" &&
      rec.result.kyotsu_app_v14_keiryo === "has-new-info" && rec.result.kyotsu_app_v13 === "has-new-info", rec);
    check("6-2 旧キーの原本は残り、本人の領域にも Firestore にも移していない",
      ("kyotsu_app_v14_keiryo" in d.store) && ("kyotsu_app_v13" in d.store) && ("kyotsu_app_v14_" + UNIT in d.store) &&
      !d.localOf(up(CHILD), "keiryo") && !cloud.unit(CHILD, "keiryo") && cloud.unit(CHILD).state.answerLog.length === 3);
    const p = d.page;
    p.run('selectUnit("keiryo")');
    check("6-3 keiryo を開いても v13 を自動で引き継がない", p.run("state.answerLog.length") === 0);
  });

  await section("[7] 表示用の version・印", async () => {
    const src = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8");
    check("7-1 同期欄にクライアントの version を出す", /syncClientVersion/.test(src) && /NS\.CLIENT_VERSION/.test(src));
    check("7-2 固定の印と表示用 version は別の値", NS.WRITER_MARKER === "kyotsu-8a" && NS.CLIENT_VERSION !== NS.WRITER_MARKER);
  });

  console.log("\n結果: " + pass + " OK / " + fail + " NG");
  process.exit(fail ? 1 : 0);
})();
