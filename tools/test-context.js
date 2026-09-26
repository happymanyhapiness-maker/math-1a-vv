// -*- coding: utf-8 -*-
// test-context.js
// テスト用の小道具（Phase 8A）：app.js は Auth の判定が終わるまで学習データを開かないので、
// vm で動かすテストでは storage-ns.js を読み込んだあと、テスト用アカウントの context を確定させる。
//   TEST_UID … テスト用アカウント（本人＝learner）。学習データのキーは kyotsu_app_v15_u_t_{unit}
const TEST_UID = "t";
const TEST_PREFIX = "kyotsu_app_v15_u_" + TEST_UID + "_";
const TEST_CTX = { state: "authenticated", authUid: TEST_UID, role: "learner", storageOwnerUid: TEST_UID, remoteTargetUid: TEST_UID };

// vm の context で app.js を読み込んだあとに呼ぶ（kyotsuContextReady が無い旧版の app.js では何もしない）
function readyApp(runInContext) {
  runInContext(`typeof kyotsuContextReady === "function" && (localStorage.setItem("kyotsu_ctx_v1", ${JSON.stringify(JSON.stringify(TEST_CTX))}), kyotsuContextReady(${JSON.stringify(TEST_CTX)}))`);
}

// 集計ページの関数（calendar / progress / unit-strength / crossunit）に渡す window の代わり
function readerWindow(LA, prefix) {
  return { LogArchive: LA, KyotsuNS: { readPrefix: () => prefix || TEST_PREFIX } };
}

// firebase-sync.js の unitKeys / readLocal を取り出して動かすときに渡す NS と ownPrefixNow
function syncNS(store, prefix) {
  const p = prefix || TEST_PREFIX;
  return {
    ownPrefixNow: () => p,
    NS: { unitsWithPrefix: (px) => Object.keys(store).filter((k) => k.indexOf(px) === 0 && k.length > px.length).map((k) => k.slice(px.length)) }
  };
}

module.exports = { TEST_UID, TEST_PREFIX, TEST_CTX, readyApp, readerWindow, syncNS };
