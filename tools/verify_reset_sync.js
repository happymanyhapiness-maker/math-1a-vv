// -*- coding: utf-8 -*-
// verify_reset_sync.js
// 「学習データをリセット」（resetStatsOnly）が、同期で取り消されないことを確認する回帰テスト。
// 単元ごとの resetGen（リセット世代）で、古い世代のデータ（remote・別端末）が復活しないこと、
// 同じ世代同士は今までどおり merge されることを確認する。
// [14] 以降は、同期の失敗（読み取り・書き込み）で未送信の単元が dirty に残り、
// 通信の復帰（online）・次の保存・画面を隠す・次回起動で送り直されることを確認する（Phase 6）。
//
// 本物の questions_*.js / app.js / firebase-sync.js を node の vm に読み込み、
// firebase-sync.js の import（Firebase SDK）だけをメモリ上の偽 Firestore に差し替える。
// 端末ごとに vm を分け、偽 Firestore は端末間で共有する。本物の Firestore には一切アクセスしない。
//
//   node tools/verify_reset_sync.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..");
const CHILD_UID = "hjWTc7Ll0UeHv5iKbRTlTLRrY8x1";
const UNIT = "kyokusen";
const KEY = "kyotsu_app_v14_" + UNIT;
const UNIT_PATH = "users/" + CHILD_UID + "/units/" + UNIT;
const DAY = 864e5;
const J = JSON.stringify;

// ---- 偽 Firestore（端末間で共有）----
// cloud.offline = true の間は、読み書きが失敗する（オフラインの端末を再現する）
// cloud.failRead / cloud.failWrite に true か (path) => boolean を入れると、そのパスの読み取り／書き込みだけ失敗する
function makeCloud() {
  const store = {};
  const writes = [];
  const cloud = { offline: false, failRead: false, failWrite: false };
  const hit = (f, p) => (typeof f === "function" ? f(p) : !!f);
  const net = (op, p) => {
    if (cloud.offline) throw new Error("offline");
    if (op === "read" && hit(cloud.failRead, p)) throw new Error("read failed: " + p);
    if (op === "write" && hit(cloud.failWrite, p)) throw new Error("write failed: " + p);
  };
  const snap = (d) => ({ exists: () => !!d, data: () => (d ? JSON.parse(J(d)) : undefined) });
  const fb = {
    initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => ({}),
    setPersistence: async () => {}, browserLocalPersistence: {},
    signInWithEmailAndPassword: async () => {}, signOut: async () => {},
    onAuthStateChanged: () => {},                       // 端末ごとに差し替える
    doc: (_db, ...seg) => ({ path: seg.join("/") }),
    collection: (_db, ...seg) => ({ path: seg.join("/") }),
    getDoc: async (ref) => { net("read", ref.path); return snap(store[ref.path]); },
    getDocs: async (col) => {
      net("read", col.path);
      const depth = col.path.split("/").length + 1;
      const docs = Object.keys(store).filter((p) => p.startsWith(col.path + "/") && p.split("/").length === depth)
        .map((p) => ({ id: p.split("/").pop() }));
      return { forEach: (f) => docs.forEach(f) };
    },
    setDoc: async (ref, data, opts) => {
      net("write", ref.path);
      writes.push(ref.path);
      store[ref.path] = opts && opts.merge ? Object.assign({}, store[ref.path] || {}, JSON.parse(J(data))) : JSON.parse(J(data));
    },
    serverTimestamp: () => "SERVER_TS"
  };
  return Object.assign(cloud, { store, writes, fb, unit: () => (store[UNIT_PATH] ? JSON.parse(store[UNIT_PATH].payload) : null) });
}

// ---- 偽 DOM（verify_review_session.js と同じ最小構成）----
function makeElement() {
  const t = { style: {}, dataset: {}, innerHTML: "", innerText: "", value: "", disabled: false, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
  const noop = () => undefined;
  const methods = { appendChild: noop, removeChild: noop, insertBefore: noop, remove: noop, addEventListener: noop,
    removeEventListener: noop, setAttribute: noop, removeAttribute: noop, focus: noop, blur: noop, click: noop,
    scrollIntoView: noop, querySelector: () => null, closest: () => null, querySelectorAll: () => [] };
  return new Proxy(t, { get: (o, p) => (p in o ? o[p] : methods[p]), set: (o, p, v) => { o[p] = v; return true; } });
}

// 端末（＝ブラウザ1つ）。localStorage は端末ごと、cloud は共有。
// launch() で「アプリを開く」：本物のスクリプトを読み込み、ログイン済みとして起動時 syncAll を走らせる。
// 起動時 syncAll が local を書き換えると、firebase-sync.js は 0.9 秒後に location.reload() を予約する。
// それを実行して、リロードが起きたら同じタブで読み込み直す（sessionStorage は引き継ぐ＝実際のブラウザと同じ）。
// launch() は「アプリを新しく開く」（sessionStorage は空）、launch({ reload: true }) は同じタブのリロード。
function makeDevice(cloud, clock) {
  const store = {};
  const dev = { store, reloads: 0, session: {} };
  dev.launch = async (opts) => {
    if (!(opts && opts.reload)) dev.session = {};
    const session = dev.session;
    const els = {};
    dev.listeners = {};
    const timers = [];
    const ctx = {
      // オフラインや失敗を再現している間の、想定どおりの失敗ログは出さない
      console: { log() {}, warn() {}, error: (...a) => { if (!cloud.offline && !cloud.failRead && !cloud.failWrite) console.error(...a); } },
      alert: () => {}, confirm: () => true, scrollTo: () => {},
      addEventListener: (ev, fn) => { (dev.listeners[ev] = dev.listeners[ev] || []).push(fn); },
      setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
      clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; },
      setInterval: () => 0, clearInterval: () => {},
      getComputedStyle: (e) => e.style,
      navigator: { userAgent: "verify" },
      location: { reload: () => { dev.reloads++; } },
      sessionStorage: { getItem: (k) => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: (k) => { delete session[k]; } },
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        key: (i) => Object.keys(store)[i],
        get length() { return Object.keys(store).length; }
      },
      document: {
        getElementById: (id) => (els[id] || (els[id] = makeElement())),
        querySelector: () => null, querySelectorAll: () => [], createElement: () => makeElement(),
        addEventListener: () => {}, body: makeElement(), readyState: "complete"
      },
      __fb: Object.assign({}, cloud.fb, { onAuthStateChanged: (_auth, cb) => { dev.authCb = cb; } }),
      __NOW: clock.now
    };
    ctx.window = ctx;
    ctx.document.getElementById("saveStatus").parentNode = makeElement();
    vm.createContext(ctx);
    vm.runInContext("Date.now = () => __NOW;", ctx);
    const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
    html.match(/questions_[a-z_0-9]+\.js|app\.js(?=\?)/g)
      .forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), ctx, { filename: f }));
    // firebase-sync.js：import 文だけを偽 Firestore に差し替え、あとはそのまま実行
    const sync = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8")
      .replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]+";/g, "const {$1} = __fb;");
    vm.runInContext(sync, ctx, { filename: "firebase-sync.js" });
    dev.ctx = ctx;
    dev.timers = timers;
    dev.run = (code) => { ctx.__NOW = clock.now; return vm.runInContext(code, ctx); };
    dev.run(`selectUnit(${J(UNIT)})`);
    dev.authCb({ uid: CHILD_UID, email: "child@example.com" });      // ログイン → 起動時 syncAll
    await settle();
    // 起動時 syncAll が予約したリロード（0.9 秒後）を実行し、起きたら同じタブで読み込み直す
    const reloadTimer = timers.find((t) => t.fn && t.ms === 900);
    if (reloadTimer) {
      const before = dev.reloads;
      reloadTimer.fn(); reloadTimer.fn = null;
      if (dev.reloads > before) return dev.launch({ reload: true });
    }
    return dev;
  };
  // 4秒後に予約された pushDirty など、たまっているタイマーを実行する（リロード予約は reloads で数える）
  dev.flush = async () => {
    for (let i = 0; i < 5; i++) {
      const due = dev.timers.splice(0);
      if (!due.length) break;
      for (const t of due) if (t.fn) { dev.ctx.__NOW = clock.now; t.fn(); }
      await settle();
    }
  };
  dev.local = () => (store[KEY] ? JSON.parse(store[KEY]) : null);
  // window のイベント（online / visibilitychange）を発火して、非同期処理が落ち着くまで待つ
  dev.fire = async (ev, visibility) => {
    if (visibility) dev.ctx.document.visibilityState = visibility;
    (dev.listeners[ev] || []).forEach((fn) => { dev.ctx.__NOW = clock.now; fn(); });
    await settle();
  };
  dev.dirty = () => dev.run("Array.from(dirtyUnits).sort()");
  dev.status = () => dev.run("document.getElementById('syncStatus').innerText");
  return dev;
}
async function settle() { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); }

// ---- 学習操作（本物の app.js の関数を UI と同じ順で呼ぶ）----
function exam(dev, wrongIds) {
  dev.run("startExam()");
  for (;;) {
    const q = dev.run("currentQuestion()");
    if (!q) break;
    dev.run(wrongIds.includes(q.id) ? "answer((currentQuestion().correct + 1) % currentQuestion().a.length)" : "answer(currentQuestion().correct)");
    dev.run("nextQuestion()");
  }
  dev.run("exitExamMode()");
}
function graduate(dev, id, clock) {
  for (let i = 0; i < 4; i++) {
    clock.now += 31 * DAY;
    dev.run(`reviewSessionIds = [${J(id)}]; state.mode = "review"; state.index = 0; answer(currentQuestion().correct); finish(); exitExamMode();`);
  }
}
const view = (d) => d && {
  gen: d.state.resetGen === undefined ? "(無し)" : d.state.resetGen,
  wrong: d.state.wrong.map((q) => q.id), meta: Object.keys(d.state.reviewMeta), log: d.state.answerLog.length,
  hist: d.state.history.length, ga: Object.keys(d.state.graduatedAt || {}), qh: Object.keys(d.stats.questionHistory || {}).length,
  cleared: d.stats.clearedCount, stageT: (d.stats.stage["第1問"] || {}).t || 0
};

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  NG   " + name + (detail !== undefined ? "  → " + J(detail) : "")); }
}

(async () => {
  const src = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8");
  const mergeUnitData = new Function(src.slice(src.indexOf("function freshness"),
    src.indexOf("/* =========================================================\n   Firestore 入出力")) + ";return mergeUnitData;")();

  // 共通の出発点：端末Aで学習（A・B 誤答、D は卒業）して、remote に同期済み（gen 0 相当＝resetGen 無し）
  async function studiedWorld() {
    const clock = { now: Date.UTC(2026, 9, 1) };
    const cloud = makeCloud();
    const A = makeDevice(cloud, clock);
    await A.launch();
    const ids = A.run(`UNIT_META.${UNIT}.questions.map((q) => q.id)`);
    exam(A, [ids[0], ids[1], ids[3]]);
    graduate(A, ids[3], clock);
    await A.flush();                                               // pushDirty で remote へ
    return { clock, cloud, A, ids };
  }

  console.log("[1] リセットで消えるもの・残るもの（resetStatsOnly）");
  {
    const { A } = await studiedWorld();
    A.run("state.strict = true; save();");
    const before = view(A.local());
    A.run("reviewSessionIds = ['x']; reviewSessionFromExam = true; examWrongIds = ['y'];");
    A.run("resetStatsOnly()");
    const after = A.local();
    check("1-1 前提: リセット前は学習データあり、resetGen 無し", before.log > 0 && before.wrong.length === 2 && before.gen === "(無し)", before);
    check("1-2 リセット後は resetGen 1 の空の状態", J(view(after)) === J({ gen: 1, wrong: [], meta: [], log: 0, hist: 0, ga: [], qh: 0, cleared: 0, stageT: 0 }), view(after));
    check("1-3 strict は保持", after.state.strict === true);
    check("1-4 tipList・lastShuffle・unansweredSnapshot・mode も初期化", after.state.tipList.length === 0 &&
      Object.keys(after.state.lastShuffle).length === 0 && after.state.unansweredSnapshot.length === 0 && after.state.mode === "normal");
    check("1-5 メモリ上のセッション変数も破棄", A.run("reviewSessionIds === null && reviewSessionFromExam === false && examWrongIds === null"));
    check("1-6 resetGen 以外の state のキーは defaultState と同じ（resetGen は最後に付く）",
      J(Object.keys(after.state)) === J(A.run("Object.keys(defaultState('x'))").concat(["resetGen"])), Object.keys(after.state));
    A.run("resetStatsOnly()");
    check("1-7 連続リセットで resetGen 2", A.local().state.resetGen === 2);
  }

  console.log("\n[2] 同じ端末：リセット → 保存の横取り → pushDirty → fetchRemote → merge → writeRemote → 次回起動");
  {
    const { cloud, A } = await studiedWorld();
    const remoteBefore = view(cloud.unit());
    A.run("resetStatsOnly()");
    check("2-1 前提: リセット前の remote は学習データあり・resetGen 無し", remoteBefore.log > 0 && remoteBefore.gen === "(無し)");
    check("2-2 リセットで pushDirty が予約される（保存の横取り）", A.timers.some((t) => t.fn && t.ms === 4000));
    const w0 = cloud.writes.length;
    await A.flush();
    check("2-3 pushDirty で remote の単元ドキュメントに書き込まれる", cloud.writes.slice(w0).includes(UNIT_PATH));
    check("2-4 remote はリセット後の状態（resetGen 1・空）", J(view(cloud.unit())) === J(view(A.local())) && cloud.unit().state.resetGen === 1, view(cloud.unit()));
    const reloadsBefore = A.reloads;
    await A.launch();                                              // 次回起動（起動時 syncAll）
    check("2-5 次回起動でも local は空のまま（古い状態に戻らない）", view(A.local()).log === 0 && A.local().state.resetGen === 1, view(A.local()));
    check("2-6 次回起動で変更なし → リロードしない", A.reloads === reloadsBefore);
    check("2-7 mergeUnitData(リセット後, 古い remote) でも古いデータは戻らない",
      view(mergeUnitData(A.local(), JSON.parse(J(Object.assign({}, cloud.unit(), { state: Object.assign({}, cloud.unit().state) }))))).log === 0);
  }

  console.log("\n[3] 別端末：A でリセット、B は古いまま（A sync → B sync → A sync）");
  {
    const { clock, cloud, A } = await studiedWorld();
    const B = makeDevice(cloud, clock);
    await B.launch();                                              // B は古いデータを取り込んだ状態（gen 0）
    check("3-0 前提: B は古い学習データを持っている", view(B.local()).log > 0 && view(B.local()).gen === "(無し)");
    A.run("resetStatsOnly()"); await A.flush();                    // A sync
    await B.launch();                                              // B sync（起動）
    check("3-1 B の起動で B の local もリセット後の状態になる", J(view(B.local())) === J(view(A.local())), view(B.local()));
    check("3-2 B の同期後も remote は resetGen 1 の空の状態", cloud.unit().state.resetGen === 1 && view(cloud.unit()).log === 0);
    await A.launch();                                              // A sync
    check("3-3 A を開き直しても空のまま", view(A.local()).log === 0 && A.local().state.resetGen === 1);
  }

  console.log("\n[4] 古い世代の端末で、リセット後に学習した分は破棄される（仕様）");
  {
    const { clock, cloud, A, ids } = await studiedWorld();
    const B = makeDevice(cloud, clock);
    await B.launch();
    A.run("resetStatsOnly()"); await A.flush();                    // A: gen 1
    clock.now += DAY;
    exam(B, [ids[2]]);                                             // B: まだ gen 0 のまま X（ids[2]）を学習
    check("4-0 前提: B の local は gen 0 で X を含む", view(B.local()).gen === "(無し)" && view(B.local()).wrong.includes(ids[2]));
    await B.flush();                                               // B の pushDirty
    check("4-1 B の push 後も remote は gen 1 の空の状態（B の gen 0 の学習は merge されない）",
      cloud.unit().state.resetGen === 1 && view(cloud.unit()).log === 0 && view(cloud.unit()).wrong.length === 0, view(cloud.unit()));
    await B.launch();
    check("4-2 B を開き直すと gen 1 の状態になり、X は破棄される", view(B.local()).log === 0 && B.local().state.resetGen === 1);
  }

  console.log("\n[5] リセット後の新しい学習だけが残る");
  {
    const { clock, cloud, A, ids } = await studiedWorld();
    const B = makeDevice(cloud, clock);
    await B.launch();                                              // B は古い A・B・D を持つ gen 0
    A.run("resetStatsOnly()");
    clock.now += DAY;
    exam(A, [ids[2]]);                                             // リセット後に C だけ誤答
    await A.flush();
    const onlyC = (d) => J(view(d).wrong) === J([ids[2]]) && J(view(d).meta) === J([ids[2]]) && view(d).ga.length === 0 && view(d).cleared === 0;
    check("5-1 remote は gen 1 で C だけ（A・B・卒業済み D は戻らない）", onlyC(cloud.unit()) && cloud.unit().state.resetGen === 1, view(cloud.unit()));
    await B.flush(); await B.launch();                             // 古い端末 B が同期
    check("5-2 古い端末 B の同期後も C だけ", onlyC(cloud.unit()) && onlyC(B.local()), { remote: view(cloud.unit()), B: view(B.local()) });
    await A.launch();
    check("5-3 A を開き直しても C だけ", onlyC(A.local()));
    // 同じ gen 1 になった後は通常の merge：B で D を誤答 → A にも届く
    clock.now += DAY;
    exam(B, [ids[3]]);
    await B.flush(); await A.launch();
    check("5-4 同じ世代になった後は通常どおり merge（B の D の誤答が A に届く）",
      J(view(A.local()).wrong.slice().sort()) === J([ids[2], ids[3]].sort()) && A.local().state.resetGen === 1, view(A.local()));
  }

  console.log("\n[6] 同じ世代同士の merge は今までどおり（Phase 1〜4）");
  {
    const { clock, cloud, A, ids } = await studiedWorld();
    A.run("resetStatsOnly()"); await A.flush();
    const B = makeDevice(cloud, clock);
    await B.launch();                                              // B も gen 1
    clock.now += DAY; exam(A, [ids[0]]);                          // A: ids0 誤答
    clock.now += DAY; exam(B, [ids[1]]);                          // B: ids1 誤答
    graduate(A, ids[0], clock);                                    // A で ids0 卒業
    const la = A.local(), lb = B.local();
    const m1 = mergeUnitData(JSON.parse(J(la)), JSON.parse(J(lb))), m2 = mergeUnitData(JSON.parse(J(lb)), JSON.parse(J(la)));
    check("6-1 gen 1 同士: answerLog は和集合", view(m1).log === view(la).log + view(lb).log - 0 || view(m1).log >= Math.max(view(la).log, view(lb).log));
    check("6-2 gen 1 同士: A で卒業した ids0 は戻らない（graduatedAt）／B の ids1 は残る",
      !view(m1).wrong.includes(ids[0]) && view(m1).wrong.includes(ids[1]) && view(m1).ga.includes(ids[0]), view(m1));
    check("6-3 gen 1 同士: questionHistory も両方の問題が残る", view(m1).qh === 4);
    check("6-4 gen 1 同士: 引数順に依存しない", J(view(m1)) === J(Object.assign(view(m2), { wrong: view(m2).wrong })) ||
      (J(view(m1).wrong.slice().sort()) === J(view(m2).wrong.slice().sort()) && view(m1).log === view(m2).log && view(m1).cleared === view(m2).cleared));
    check("6-5 gen 1 同士: resetGen 1 のまま", m1.state.resetGen === 1 && m2.state.resetGen === 1);
    check("6-6 冪等", J(mergeUnitData(JSON.parse(J(m1)), JSON.parse(J(m1)))) === J(m1));
  }

  console.log("\n[7] resetGen の無い既存データ（gen 0 同士）");
  {
    const { cloud, A } = await studiedWorld();
    const l = A.local(), r = cloud.unit();
    check("7-1 通常利用では resetGen は付かない（local も remote も）", !("resetGen" in l.state) && !("resetGen" in r.state));
    const m = mergeUnitData(JSON.parse(J(l)), JSON.parse(J(r)));
    check("7-2 gen 0 同士の merge 結果にも resetGen キーは作られない", !("resetGen" in m.state));
    check("7-3 同期済みの local と remote の merge は local と完全一致（不要な差分なし）", J(m) === J(l));
    const writes0 = cloud.writes.filter((p) => p === UNIT_PATH).length;
    const reloads0 = A.reloads;
    await A.launch();
    check("7-4 既存データのまま開き直しても単元の書き込み・リロードは起きない",
      cloud.writes.filter((p) => p === UNIT_PATH).length === writes0 && A.reloads === reloads0);
    const z = JSON.parse(J(l)); z.state.resetGen = 0;
    check("7-5 resetGen:0 と resetGen 無しは同じ世代として通常 merge", view(mergeUnitData(z, JSON.parse(J(r)))).log === view(l).log);
  }

  console.log("\n[8] 連続リセット（gen 0 → 1 → 2）");
  {
    const { clock, cloud, A, ids } = await studiedWorld();
    A.run("resetStatsOnly()");
    clock.now += DAY; exam(A, [ids[0]]);
    const gen1 = A.local();
    A.run("resetStatsOnly()");
    const gen2 = A.local();
    check("8-1 2回目のリセットで resetGen 2", gen1.state.resetGen === 1 && gen2.state.resetGen === 2);
    check("8-2 merge(gen2, gen1) は gen2（空）", view(mergeUnitData(JSON.parse(J(gen2)), JSON.parse(J(gen1)))).log === 0 &&
      mergeUnitData(JSON.parse(J(gen2)), JSON.parse(J(gen1))).state.resetGen === 2);
    check("8-3 merge(gen1, gen2) も gen2（引数順に依存しない）", mergeUnitData(JSON.parse(J(gen1)), JSON.parse(J(gen2))).state.resetGen === 2 &&
      view(mergeUnitData(JSON.parse(J(gen1)), JSON.parse(J(gen2)))).log === 0);
    await A.flush();
    check("8-4 push 後の remote も gen 2", cloud.unit().state.resetGen === 2);
  }

  console.log("\n[9] サマリー（kyotsu-math-summary）");
  {
    const { cloud, A } = await studiedWorld();
    const sumPath = "kyotsu-math-summary/" + CHILD_UID;
    const before = cloud.store[sumPath];
    A.run("resetStatsOnly()"); await A.flush();                   // pushDirty → pushSummary
    const after = cloud.store[sumPath];
    check("9-1 リセット前のサマリーには件数がある", before && before.totalCount > 0, before);
    check("9-2 リセット後のサマリーはこの単元ぶん減る（この単元しか学習していないので 0）", after.totalCount === 0 && after.todayCount === 0, after);
    await A.launch();
    check("9-3 次回起動後もサマリーは古い値に戻らない", cloud.store[sumPath].totalCount === 0, cloud.store[sumPath]);
  }

  console.log("\n[10] dailyquest はリセットで変更しない（既存の今日のラベル更新だけ）");
  {
    const { clock, cloud, A } = await studiedWorld();
    const dqPath = "dailyquest-logs/" + CHILD_UID;
    const today = new Date(clock.now + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const past = "2026-09-01";
    cloud.store[dqPath] = { data: J({ days: { [past]: { quests: [{ label: "kyotsu-math（自動記録）（5問）", done: true, tag: "数学", autoSource: "kyotsu-math" }] },
      [today]: { quests: [{ label: "kyotsu-math（自動記録）（本日8問）", done: true, tag: "数学", autoSource: "kyotsu-math" }] } } }) };
    A.run("resetStatsOnly()"); await A.flush();
    const dq = JSON.parse(cloud.store[dqPath].data);
    check("10-1 dailyquest のドキュメントは残る（削除しない）", !!cloud.store[dqPath]);
    check("10-2 過去の日の記録は変わらない", J(dq.days[past]) === J({ quests: [{ label: "kyotsu-math（自動記録）（5問）", done: true, tag: "数学", autoSource: "kyotsu-math" }] }));
    check("10-3 今日の記録は done のまま（既存の pushDailyQuestToday がラベルだけ更新）", dq.days[today].quests[0].done === true, dq.days[today]);
  }

  console.log("\n[11] 同じタブですでにリロード済み（画面のメモリが古い世代のまま）でも、古いデータは復活しない");
  {
    const { clock, cloud, A, ids } = await studiedWorld();
    const B = makeDevice(cloud, clock);
    await B.launch();
    clock.now += DAY; exam(A, [ids[2]]); await A.flush();           // A で追加学習 → B の次の起動でリロードが1回起きる
    await B.launch({ reload: true }); await B.launch({ reload: true });
    check("11-0 前提: B のタブでは「このセッションはリロード済み」の印が立っている", B.session["kyotsu_sync_reloaded"] === "1");
    A.run("resetStatsOnly()"); await A.flush();                    // A でリセット（gen 1）
    const reloads0 = B.reloads;
    await B.launch({ reload: true });                              // B を同じタブで開き直す → syncAll で gen 1 を取り込むが、印があるのでリロードしない
    check("11-1 B の local（保存データ）は gen 1 の空の状態になる", B.local().state.resetGen === 1 && view(B.local()).log === 0);
    check("11-2 B はリロードしない（既存仕様：1セッション1回）ので、画面のメモリは古い世代のまま",
      B.reloads === reloads0 && B.run("state.resetGen") === undefined && B.run("state.answerLog.length") > 0);
    clock.now += DAY; exam(B, [ids[3]]); await B.flush();           // 古い世代のメモリのまま回答・保存・push
    check("11-3 remote は gen 1 の空の状態のまま（古いデータも、古い世代での回答も復活しない）",
      cloud.unit().state.resetGen === 1 && view(cloud.unit()).log === 0, view(cloud.unit()));
    await B.launch();                                              // 新しく開き直す
    check("11-4 B を新しく開き直すと gen 1 の状態に戻る", B.local().state.resetGen === 1 && view(B.local()).log === 0);
    await A.launch();
    check("11-5 A も gen 1 の空の状態のまま", A.local().state.resetGen === 1 && view(A.local()).log === 0);
  }

  // [12] [13] 共通：A・B とも同じ古い gen0（ids0・ids1 を誤答）を持っている状態
  async function twoOldDevices() {
    const clock = { now: Date.UTC(2026, 9, 1) };
    const cloud = makeCloud();
    const A = makeDevice(cloud, clock);
    await A.launch();
    const ids = A.run(`UNIT_META.${UNIT}.questions.map((q) => q.id)`);
    exam(A, [ids[0], ids[1]]); await A.flush();
    const B = makeDevice(cloud, clock);
    await B.launch();
    return { clock, cloud, A, B, ids };
  }
  // A: リセット（gen1）→ 同期 → C（ids2）だけ学習 → 同期
  async function aResetsThenLearnsC(w) {
    w.A.run("resetStatsOnly()"); await w.A.flush();
    w.clock.now += DAY; exam(w.A, [w.ids[2]]); await w.A.flush();
  }

  console.log("\n[12] 画面のメモリが古い世代のまま（保存データは新しい世代）でリセットしても、同じ世代を作らない（S2）");
  {
    const w = await twoOldDevices();
    w.clock.now += DAY; exam(w.A, [w.ids[3]]); await w.A.flush();  // B の次の起動でリロードが1回起きるように
    await w.B.launch({ reload: true }); await w.B.launch({ reload: true });   // 「このセッションはリロード済み」
    await aResetsThenLearnsC(w);
    await w.B.launch({ reload: true });                            // 保存データは gen1（C あり）を取り込むが、リロードしない
    check("12-0 前提: B の画面のメモリは gen0、保存データは gen1（C あり）",
      w.B.run("state.resetGen") === undefined && w.B.local().state.resetGen === 1 && view(w.B.local()).wrong.includes(w.ids[2]));
    const writes0 = w.cloud.writes.length;
    w.B.run("resetStatsOnly()");
    check("12-1 リセットは同期関数のまま（呼んだ直後に保存済み）で、通信しない", w.B.local().state.resetGen === 2 && w.cloud.writes.length === writes0);
    check("12-2 B のリセットは gen2（メモリ gen0 と保存 gen1 の大きい方 +1）", w.B.local().state.resetGen === 2 && view(w.B.local()).log === 0);
    await w.B.flush();
    check("12-3 push 後の remote は gen2 の空の状態（C は戻らない）",
      w.cloud.unit().state.resetGen === 2 && view(w.cloud.unit()).log === 0 && !view(w.cloud.unit()).wrong.includes(w.ids[2]), view(w.cloud.unit()));
    await w.B.launch(); await w.A.launch();
    check("12-4 B・A を開き直しても gen2 の空の状態", view(w.B.local()).log === 0 && view(w.A.local()).log === 0 &&
      w.B.local().state.resetGen === 2 && w.A.local().state.resetGen === 2);
  }

  console.log("\n[13] 既知の制約（S1・S3）：B が A のリセットを知らないまま同じ単元をリセットすると、同じ世代（gen1）になる");
  console.log("     保証すること：A のリセットより前の古い gen0 のデータは戻らない。");
  console.log("     制約：A がリセットした後に学習した同じ世代のデータ（C）は merge されることがある（完全な解決には時刻かサーバー側の順序付けが必要）。");
  const knownLimit = (tag, w) => {
    const r = view(w.cloud.unit()), b = view(w.B.local()), a = view(w.A.local());
    check(tag + " A のリセットより前の gen0 のデータ（ids0・ids1）は、remote・A・B のどれにも戻らない",
      [r, a, b].every((x) => !x.wrong.includes(w.ids[0]) && !x.wrong.includes(w.ids[1])), { r, a, b });
    check(tag + " 3つとも gen1 にそろう", [w.cloud.unit(), w.A.local(), w.B.local()].every((d) => d.state.resetGen === 1));
    console.log("  情報 " + tag + " A のリセット後に学習した C が B のリセット後にも残っている: " + r.wrong.includes(w.ids[2]) + "（既知の制約）");
  };
  {
    // S1: B は A のリセット前から起動したまま（同期は起動時だけ）
    const w = await twoOldDevices();
    await aResetsThenLearnsC(w);
    check("13-S1-0 前提: B はメモリも保存データも gen0 のまま", w.B.run("state.resetGen") === undefined && w.B.local().state.resetGen === undefined);
    w.B.run("resetStatsOnly()"); await w.B.flush();
    await w.B.launch(); await w.A.launch();
    knownLimit("13-S1", w);
  }
  {
    // S3: B はオフラインのまま A のリセットを知らずにリセット → 復帰して起動
    const w = await twoOldDevices();
    await aResetsThenLearnsC(w);
    w.cloud.offline = true;
    w.B.run("resetStatsOnly()"); await w.B.flush();                 // オフラインなので push は失敗する
    w.cloud.offline = false;
    check("13-S3-0 前提: B のリセットはオフライン中に gen1 で保存された", w.B.local().state.resetGen === 1 && view(w.B.local()).log === 0);
    await w.B.launch(); await w.A.launch();
    knownLimit("13-S3", w);
  }

  // ---------------------------------------------------------------
  // Phase 6：同期の失敗と再送
  const OK_RE = /^同期済み（/;
  const UNSENT = "未送信のデータがあります。通信が戻ると自動で再送します。";
  const OTHER = "keiryo";
  const OTHER_PATH = "users/" + CHILD_UID + "/units/" + OTHER;
  const SUMMARY_PATH = "kyotsu-math-summary/" + CHILD_UID;
  const remoteLog = (cloud, p) => (cloud.store[p || UNIT_PATH] ? JSON.parse(cloud.store[p || UNIT_PATH].payload).state.answerLog.length : 0);
  const localLog = (dev, unit) => { const raw = dev.store["kyotsu_app_v14_" + (unit || UNIT)]; return raw ? JSON.parse(raw).state.answerLog.length : 0; };
  // 1問だけ回答して保存する（本物の startExam / answer）
  function answerOne(dev, ok, unit) {
    if (unit) dev.run(`selectUnit(${J(unit)})`);
    dev.run(`startExam(); answer(${ok ? "currentQuestion().correct" : "(currentQuestion().correct + 1) % currentQuestion().a.length"}); exitExamMode();`);
  }
  async function synced() {
    const clock = { now: Date.UTC(2026, 9, 1) };
    const cloud = makeCloud();
    const A = makeDevice(cloud, clock);
    await A.launch();
    answerOne(A, false); await A.flush();
    clock.now += 1000;
    return { clock, cloud, A };
  }
  const unitWrites = (p) => (path) => path === (p || UNIT_PATH);

  console.log("\n[14] A: 正常な push");
  {
    const { cloud, A } = await synced();
    answerOne(A, true);
    check("14-1 回答すると dirty になり、4秒後の push が予約される", J(A.dirty()) === J([UNIT]) && A.timers.some((t) => t.fn && t.ms === 4000));
    await A.flush();
    check("14-2 remote に届く", remoteLog(cloud) === localLog(A) && localLog(A) === 2);
    check("14-3 dirty は空、表示は「同期済み」", A.dirty().length === 0 && OK_RE.test(A.status()), A.status());
  }

  console.log("\n[15] B: remote の読み取りが失敗");
  {
    const { cloud, A } = await synced();
    answerOne(A, true);
    cloud.failRead = unitWrites(); await A.flush(); cloud.failRead = false;
    check("15-1 remote は古いまま、local には残る", remoteLog(cloud) === 1 && localLog(A) === 2);
    check("15-2 dirty に残る", J(A.dirty()) === J([UNIT]));
    check("15-3 「同期済み」にならず、未送信の表示", A.status() === UNSENT, A.status());
    await A.flush();
    check("15-4 失敗しただけなら、短い間隔で再試行し続けない（予約タイマーなし）", !A.timers.some((t) => t.fn) && remoteLog(cloud) === 1);
  }

  console.log("\n[16] C: 読み取りは成功、書き込みが失敗");
  {
    const { cloud, A } = await synced();
    answerOne(A, true);
    cloud.failWrite = unitWrites(); await A.flush(); cloud.failWrite = false;
    check("16-1 remote は古いまま、local には残る", remoteLog(cloud) === 1 && localLog(A) === 2);
    check("16-2 dirty に残る", J(A.dirty()) === J([UNIT]));
    check("16-3 未送信の表示", A.status() === UNSENT, A.status());
  }

  console.log("\n[17] D: 失敗 → 通信が戻る（online）→ 新しい操作なしで送られる");
  {
    const { cloud, A } = await synced();
    answerOne(A, true);
    cloud.offline = true; await A.flush(); cloud.offline = false;
    check("17-0 前提: オフラインで失敗して未送信", J(A.dirty()) === J([UNIT]) && remoteLog(cloud) === 1 && A.status() === UNSENT);
    await A.fire("online");
    check("17-1 online で送られる", remoteLog(cloud) === 2);
    check("17-2 dirty は空、表示は「同期済み」", A.dirty().length === 0 && OK_RE.test(A.status()), A.status());
    await A.fire("online");
    check("17-3 未送信が無ければ online でも何もしない", remoteLog(cloud) === 2 && A.dirty().length === 0);
  }

  console.log("\n[18] E: 失敗 → 次の回答");
  {
    const { clock, cloud, A } = await synced();
    answerOne(A, true);
    cloud.failWrite = true; await A.flush(); cloud.failWrite = false;
    clock.now += 1000; answerOne(A, false); await A.flush();
    check("18-1 同じ単元: 次の push で、失敗した分も新しい分も届く", remoteLog(cloud) === 3 && localLog(A) === 3 && A.dirty().length === 0);
    clock.now += 1000; answerOne(A, true);
    cloud.failWrite = unitWrites();                                // kyokusen の書き込みだけ失敗し続ける
    await A.flush();
    clock.now += 1000; answerOne(A, false, OTHER); await A.flush();
    check("18-2 別の単元を回答: その単元は届く", remoteLog(cloud, OTHER_PATH) === 1);
    check("18-3 失敗が続いている単元は dirty に残ったまま（remote は古い）", J(A.dirty()) === J([UNIT]) && remoteLog(cloud) === 3 && localLog(A) === 4, A.dirty());
    cloud.failWrite = false;
    clock.now += 1000; answerOne(A, true, OTHER); await A.flush();
    check("18-4 失敗が解けた後、別の単元の保存で dirty の単元もまとめて届く", remoteLog(cloud) === 4 && remoteLog(cloud, OTHER_PATH) === 2 && A.dirty().length === 0);
  }

  console.log("\n[19] F: 未送信がある状態で画面を隠す");
  {
    const { cloud, A } = await synced();
    answerOne(A, true);
    cloud.failWrite = true; await A.fire("visibilitychange", "hidden"); cloud.failWrite = false;
    check("19-1 hidden で push を試し、失敗したら dirty に残る", J(A.dirty()) === J([UNIT]) && remoteLog(cloud) === 1 && A.status() === UNSENT);
    await A.fire("visibilitychange", "visible");
    check("19-2 visible に戻っただけでは送らない", remoteLog(cloud) === 1);
    await A.fire("visibilitychange", "hidden");
    check("19-3 次に hidden になったら送られる", remoteLog(cloud) === 2 && A.dirty().length === 0 && OK_RE.test(A.status()));
  }

  console.log("\n[20] G: 失敗したまま閉じる → 次回起動");
  {
    const { clock, cloud, A } = await synced();
    answerOne(A, true);
    cloud.failWrite = true; await A.flush(); cloud.failWrite = false;
    check("20-0 前提: 未送信", remoteLog(cloud) === 1 && localLog(A) === 2);
    await A.launch();
    check("20-1 次回起動の syncAll で local の未送信ぶんが届く", remoteLog(cloud) === 2 && OK_RE.test(A.status()), A.status());
    // 起動時の syncAll でも失敗した場合は「同期済み」にせず、dirty に残して online で送る
    clock.now += 1000; answerOne(A, true);
    cloud.failWrite = true; await A.flush();
    await A.launch();
    check("20-2 起動時の syncAll でも書き込みに失敗 → 「同期済み」にしない", A.status() === UNSENT, A.status());
    check("20-3 失敗した単元は dirty に残る", J(A.dirty()) === J([UNIT]));
    cloud.failWrite = false;
    await A.fire("online");
    check("20-4 online で届く", remoteLog(cloud) === 3 && OK_RE.test(A.status()));
    cloud.failRead = (p) => p.endsWith("/units");               // 単元一覧の取得だけ失敗
    await A.launch();
    cloud.failRead = false;
    check("20-5 単元一覧の取得に失敗 → 「同期済み」で上書きしない", !OK_RE.test(A.status()) && A.status().includes("単元一覧の取得に失敗"), A.status());
  }

  console.log("\n[21] H: push 中に同じ単元へ保存");
  {
    const { clock, cloud, A } = await synced();
    answerOne(A, true);                                            // 1回目の保存（local 2件）
    const t = A.timers.find((x) => x.fn && x.ms === 4000);
    const fn = t.fn; t.fn = null;
    A.ctx.__NOW = clock.now; fn();                                  // pushDirty 開始（local を読み、remote の読み取りを待っている）
    check("21-0 前提: push 中（busy）", A.run("busy") === true);
    clock.now += 1000; answerOne(A, false);                         // push 中に2回目の保存（local 3件）
    check("21-1 push 中の保存も dirty に積まれる", J(A.dirty()) === J([UNIT]));
    await settle();
    check("21-2 進行中の push では2回目の保存より前の分だけが届き、dirty に残る", remoteLog(cloud) === 2 && J(A.dirty()) === J([UNIT]) && localLog(A) === 3);
    check("21-3 push が終わったら、もう一度送る予約が入る", A.timers.some((x) => x.fn && x.ms === 4000));
    await A.flush();
    check("21-4 次の push で2回目の保存も届き、dirty は空", remoteLog(cloud) === 3 && A.dirty().length === 0 && OK_RE.test(A.status()));
  }

  console.log("\n[22] I: 複数の単元で一部だけ失敗");
  {
    const { clock, cloud, A } = await synced();
    answerOne(A, true);                                            // kyokusen
    clock.now += 1000; answerOne(A, false, OTHER);                 // keiryo
    check("22-0 前提: 2単元とも dirty", J(A.dirty()) === J([UNIT, OTHER].sort()));
    cloud.failWrite = unitWrites(OTHER_PATH); await A.flush(); cloud.failWrite = false;
    check("22-1 成功した kyokusen は dirty から外れ、remote に届く", !A.dirty().includes(UNIT) && remoteLog(cloud) === 2);
    check("22-2 失敗した keiryo だけ dirty に残る", J(A.dirty()) === J([OTHER]) && remoteLog(cloud, OTHER_PATH) === 0);
    check("22-3 表示は「同期済み」ではない", A.status() === UNSENT, A.status());
    await A.fire("online");
    check("22-4 online で keiryo も届く", remoteLog(cloud, OTHER_PATH) === 1 && A.dirty().length === 0);
  }

  console.log("\n[23] サマリーだけ失敗（単元本体は成功）");
  {
    const { clock, cloud, A } = await synced();
    const before = cloud.store[SUMMARY_PATH].totalCount;
    answerOne(A, true);
    cloud.failWrite = (p) => p === SUMMARY_PATH; await A.flush(); cloud.failWrite = false;
    check("23-1 単元本体は届き、dirty は空、表示は「同期済み」（未送信扱いにしない）",
      remoteLog(cloud) === 2 && A.dirty().length === 0 && OK_RE.test(A.status()), A.status());
    check("23-2 サマリーは古いまま", cloud.store[SUMMARY_PATH].totalCount === before);
    clock.now += 1000; answerOne(A, true); await A.flush();
    check("23-3 次の push でサマリーは local から計算し直される", cloud.store[SUMMARY_PATH].totalCount === localLog(A));
  }

  console.log("\n[24] J: リセットの push が失敗");
  {
    const { cloud, A } = await synced();
    A.run("resetStatsOnly()");
    cloud.failWrite = true; await A.flush(); cloud.failWrite = false;
    check("24-1 dirty に残り、remote は gen0 のまま", J(A.dirty()) === J([UNIT]) && cloud.unit().state.resetGen === undefined && remoteLog(cloud) === 1);
    await A.fire("online");
    check("24-2 online で gen1 の空の状態が届く", cloud.unit().state.resetGen === 1 && remoteLog(cloud) === 0);
    // 次回起動でも同じ
    const w = await synced();
    w.A.run("resetStatsOnly()");
    w.cloud.failWrite = true; await w.A.flush(); w.cloud.failWrite = false;
    await w.A.launch();
    check("24-3 失敗したまま次回起動しても gen1 が届き、gen0 は戻らない",
      w.cloud.unit().state.resetGen === 1 && remoteLog(w.cloud) === 0 && view(w.A.local()).log === 0);
  }

  console.log("\n[25] K: 卒業の push が失敗");
  {
    const { clock, cloud, A } = await synced();
    const id = A.run(`UNIT_META.${UNIT}.questions[0].id`);
    const review = () => A.run(`reviewSessionIds = [${J(id)}]; state.mode = "review"; state.index = 0; answer(currentQuestion().correct); finish(); exitExamMode();`);
    for (let i = 0; i < 3; i++) { clock.now += 31 * DAY; review(); await A.flush(); }
    clock.now += 31 * DAY; review();                               // 4回目で卒業
    cloud.failWrite = true; await A.flush(); cloud.failWrite = false;
    const inRemoteWrong = () => cloud.unit().state.wrong.some((q) => q.id === id);
    check("25-1 dirty に残り、remote は卒業前（wrong にあり）", J(A.dirty()) === J([UNIT]) && inRemoteWrong());
    await A.fire("online");
    check("25-2 online で卒業が届く（remote の wrong から外れ、graduatedAt あり）",
      !inRemoteWrong() && !!(cloud.unit().state.graduatedAt || {})[id]);
    await A.launch();
    check("25-3 次回起動しても wrong に戻らない", !A.local().state.wrong.some((q) => q.id === id) && !inRemoteWrong());
  }

  console.log("\n結果: " + pass + " OK / " + fail + " NG");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
