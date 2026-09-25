/* =========================================================
   log-archive.js  —  古い回答ログの compact event archive（schema v1）
   ---------------------------------------------------------
   ・state.logArchive = { "YYYY-MM-DD"(JST): "<18文字token><18文字token>..." }
   ・1 token = 18文字固定
       6文字 : JST 0時からのミリ秒（base36, 0埋め）
      11文字 : answerLog の重複判定キーの cyrb53（53bit, base36, 0埋め）
       1文字 : flag（bit0 = 正解 / bit1 = review・dueReview）"0"〜"3"
     先頭17文字が event ID（日付キーと合わせて一意）。
   ・この形式と cyrb53 の実装は「保存データの schema」なので変えないこと
     （archive 済みの event と、端末に残っている生ログを同一判定するのに使う）。
     tools/verify_log_archive.js のテストベクタが変わったら schema 変更になる。
   ・Phase 7B-1 では読む・merge する・集計するだけで、archive は作らない。
   ・index.html（app.js / crossunit.js / firebase-sync.js）、calendar.html、progress.html で、
     それぞれのスクリプトより前に読み込む。
   ========================================================= */
(function (root) {
  "use strict";

  var TOKEN_LEN = 18;
  var ID_LEN = 17;
  var TIME_LEN = 6;
  var HASH_LEN = 11;
  var DAY_MS = 86400000;
  var JST_MS = 9 * 3600000;
  var DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var TIME_RE = /^[0-9a-z]{6}$/;
  var HASH_RE = /^[0-9a-z]{11}$/;
  var FLAG_RE = /^[0-3]$/;
  // 同じ event ID で flag だけ違う異常データのときの優先順（前ほど優先）：
  //  誤答を正解より優先し、正誤が同じなら review でない方を優先する（数値の大小ではない）
  //  "0"=誤答・通常 > "2"=誤答・review > "1"=正解・通常 > "3"=正解・review
  var FLAG_PRIORITY = "0213";
  function preferFlag(a, b) {
    return FLAG_PRIORITY.indexOf(a) <= FLAG_PRIORITY.indexOf(b) ? a : b;
  }

  // cyrb53（53bit）。schema の一部なので実装を変えないこと
  function cyrb53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function pad36(n, len) {
    var s = n.toString(36);
    while (s.length < len) s = "0" + s;
    return s;
  }

  // firebase-sync.js の answerLog 重複判定キーと同じ（テストで一致を確認している）
  function dedupeKey(r) {
    return [r.questionId, r.timestamp, r.outcome, r.selectedIndex, r.selectedText].join("|");
  }

  function validTs(ts) {
    return typeof ts === "number" && isFinite(ts) && ts > 0;
  }

  // JST の日付キー（端末のタイムゾーンに依存しない）
  function jstDayKey(ts) {
    return new Date(ts + JST_MS).toISOString().slice(0, 10);
  }
  function jstOffset(ts) {
    return ((ts + JST_MS) % DAY_MS + DAY_MS) % DAY_MS;
  }
  // 日付キー + 時刻部分 → 元の timestamp
  function tsFromDayOffset(dayKey, offset) {
    return Date.parse(dayKey + "T00:00:00Z") - JST_MS + offset;
  }

  function isReviewMode(mode) {
    return mode === "review" || mode === "dueReview";
  }
  function flagOf(r) {
    return String((r.isCorrect ? 1 : 0) + (isReviewMode(r.mode) ? 2 : 0));
  }

  // 生ログ1件の event ID（17文字）。timestamp が無効なら null
  function eventId(r) {
    if (!r || !validTs(r.timestamp)) return null;
    return pad36(jstOffset(r.timestamp), TIME_LEN) + pad36(cyrb53(dedupeKey(r)), HASH_LEN);
  }
  function tokenOf(r) {
    var id = eventId(r);
    return id === null ? null : id + flagOf(r);
  }

  // 1日分の文字列 → Map(event ID → flag)。壊れた token は読み飛ばす（throw しない）
  //  ・文字列でない → 空
  //  ・18の倍数でない末尾の端数 → 無視
  //  ・時刻が6桁の base36 でない / 1日の範囲外、hash が11桁の base36 でない、flag が 0〜3 でない → その token を無視
  //  ・同じ ID で flag が違う → preferFlag（誤答優先、次に review でない方を優先）
  function parseDay(s, into) {
    var m = into || new Map();
    if (typeof s !== "string") return m;
    for (var i = 0; i + TOKEN_LEN <= s.length; i += TOKEN_LEN) {
      var t = s.slice(i, i + TOKEN_LEN);
      var time = t.slice(0, TIME_LEN), hash = t.slice(TIME_LEN, ID_LEN), f = t.charAt(ID_LEN);
      if (!TIME_RE.test(time) || !HASH_RE.test(hash) || !FLAG_RE.test(f)) continue;
      if (parseInt(time, 36) >= DAY_MS) continue;
      var id = time + hash;
      var cur = m.get(id);
      m.set(id, cur === undefined ? f : preferFlag(cur, f));
    }
    return m;
  }

  // Map → 正規形の文字列（ID 順・区切りなし）
  function canonicalDay(m) {
    return Array.from(m.keys()).sort().map(function (id) { return id + m.get(id); }).join("");
  }

  // 複数の archive を1つの正規形にまとめる（和集合）。入力は変更しない。
  // 日付キーが YYYY-MM-DD でないもの・中身が空になった日は捨てる。
  function unionArchives() {
    var days = {};
    for (var a = 0; a < arguments.length; a++) {
      var arc = arguments[a];
      if (!arc || typeof arc !== "object" || Array.isArray(arc)) continue;
      Object.keys(arc).forEach(function (k) {
        if (!DAY_KEY_RE.test(k)) return;
        days[k] = parseDay(arc[k], days[k]);
      });
    }
    var out = {};
    Object.keys(days).sort().forEach(function (k) {
      var s = canonicalDay(days[k]);
      if (s) out[k] = s;
    });
    return out;
  }
  function normalizeArchive(arc) {
    return unionArchives(arc);
  }
  function hasArchive(arc) {
    return Object.keys(normalizeArchive(arc)).length > 0;
  }

  // archive の event を1件ずつ { timestamp, isCorrect, mode } にして返す（集計用）
  function archiveEvents(arc) {
    var norm = normalizeArchive(arc);
    var out = [];
    Object.keys(norm).forEach(function (k) {
      var s = norm[k];
      for (var i = 0; i < s.length; i += TOKEN_LEN) {
        var f = Number(s.charAt(i + ID_LEN));
        out.push({
          timestamp: tsFromDayOffset(k, parseInt(s.slice(i, i + TIME_LEN), 36)),
          isCorrect: (f & 1) === 1,
          mode: (f & 2) ? "review" : "normal",
          archived: true
        });
      }
    });
    return out;
  }

  // 集計用のログ：archive の event ＋ archive に無い生ログ。
  // 同じ event が両方にあれば archive 側を正とし、生ログは数えない。
  // archive が無ければ生ログの配列そのもの（今までと完全に同じ）を返す。
  // AI分析・Phase 2 rescue などは、これではなく生の answerLog を使うこと。
  function countableLog(state) {
    var raw = state && Array.isArray(state.answerLog) ? state.answerLog : [];
    var arc = state ? state.logArchive : null;
    if (!arc || typeof arc !== "object") return raw;
    var events = archiveEvents(arc);
    if (!events.length) return raw;
    var ids = new Set();
    var norm = normalizeArchive(arc);
    Object.keys(norm).forEach(function (k) {
      var s = norm[k];
      for (var i = 0; i < s.length; i += TOKEN_LEN) ids.add(k + s.slice(i, i + ID_LEN));
    });
    var rest = raw.filter(function (r) {
      var id = eventId(r);
      return !(id !== null && ids.has(jstDayKey(r.timestamp) + id));
    });
    return events.concat(rest);
  }

  /* ---------- rescueLog（Phase 2 救済用の失敗時刻）schema v1 ----------
     state.rescueLog = { "<questionId>": "<9文字><9文字>..." }
     ・各9文字は epoch ミリ秒の base36（0埋め固定長。36^9 未満＝西暦5000年代まで）
     ・入っているのは「卒業後に addReviewTarget が呼ばれる失敗」（誤答・timeout・skip）の時刻だけ
     ・問題ごとに重複除去・昇順・区切りなしで連結したものが正規形。空になった問題はキーごと消す */
  var RESCUE_TS_LEN = 9;
  var RESCUE_TS_MAX = Math.pow(36, RESCUE_TS_LEN); // これ未満だけ表せる（Number の安全な整数範囲内）
  var RESCUE_TS_RE = /^[0-9a-z]{9}$/;

  function rescueTsToken(ts) {
    if (typeof ts !== "number" || !isFinite(ts) || ts <= 0 || Math.floor(ts) !== ts || ts >= RESCUE_TS_MAX) return null;
    return pad36(ts, RESCUE_TS_LEN);
  }
  // 1問ぶんの文字列 → 時刻の配列（重複なし・昇順）。壊れた token は読み飛ばす
  function parseRescueTimes(s, into) {
    var set = into || new Set();
    if (typeof s !== "string") return set;
    for (var i = 0; i + RESCUE_TS_LEN <= s.length; i += RESCUE_TS_LEN) {
      var t = s.slice(i, i + RESCUE_TS_LEN);
      if (!RESCUE_TS_RE.test(t)) continue;
      var n = parseInt(t, 36);
      if (!(n > 0) || n >= RESCUE_TS_MAX || !Number.isSafeInteger(n)) continue;
      set.add(n);
    }
    return set;
  }
  function canonicalRescueTimes(set) {
    return Array.from(set).sort(function (a, b) { return a - b; }).map(function (n) { return pad36(n, RESCUE_TS_LEN); }).join("");
  }
  // 複数の rescueLog を問題ごとの時刻の和集合にして正規形で返す（入力は変更しない）
  function unionRescueLogs() {
    var byId = {};
    for (var a = 0; a < arguments.length; a++) {
      var log = arguments[a];
      if (!log || typeof log !== "object" || Array.isArray(log)) continue;
      Object.keys(log).forEach(function (id) {
        if (!id) return;
        byId[id] = parseRescueTimes(log[id], byId[id]);
      });
    }
    var out = {};
    Object.keys(byId).sort().forEach(function (id) {
      var s = canonicalRescueTimes(byId[id]);
      if (s) out[id] = s;
    });
    return out;
  }
  function normalizeRescueLog(log) {
    return unionRescueLogs(log);
  }
  // 卒業時刻以前の失敗を消す（T <= graduatedAt[問題] のものだけ。reviewMeta は根拠にしない）
  function pruneRescueLog(log, graduatedAt) {
    var norm = normalizeRescueLog(log);
    var ga = graduatedAt && typeof graduatedAt === "object" ? graduatedAt : {};
    var out = {};
    Object.keys(norm).forEach(function (id) {
      var g = typeof ga[id] === "number" ? ga[id] : null;
      var times = Array.from(parseRescueTimes(norm[id])).filter(function (t) { return g === null || t > g; });
      var s = canonicalRescueTimes(new Set(times));
      if (s) out[id] = s;
    });
    return out;
  }
  // 問題の失敗時刻（昇順）
  function rescueTimes(log, id) {
    if (!log || typeof log !== "object" || typeof log[id] !== "string") return [];
    return Array.from(parseRescueTimes(log[id])).sort(function (a, b) { return a - b; });
  }

  /* ---------- 生ログの削減（Phase 7B-2） ----------
     1単元の生ログ（answerLog）に残すのは、生ログと archive を合わせた重複なしの全 event を
     「timestamp の新しい順 → 同じなら event ID（日付キー＋17文字）の大きい順」に並べて、
       ・上から RAW_KEEP_MAX 件以内
       ・かつ、その集合の最新 timestamp から RAW_KEEP_DAYS 日以内（ちょうど180日前は残す、1ms でも古ければ archive）
     の両方を満たすものだけ。基準は端末の時計ではなく集合内の最新 timestamp。
     次の生ログは archive へ移す（移す前に questionHistory の補完と rescueLog への回収をする）：
       ・同じ event がすでに archive にある（stale 端末から戻ってきた生ログ）
       ・上の保持条件から外れた
     timestamp が無効な古い生ログは event ID を作れないので、そのまま生ログに残す。
     local の save と firebase-sync の merge の両方から、この1つの関数で同じ変換をする。 */
  var RAW_KEEP_MAX = 300;
  var RAW_KEEP_DAYS = 180;

  // Phase 2 救済の対象になる失敗（app.js で addReviewTarget が呼ばれる回答。firebase-sync.js の判定と同じ）
  function isRescueFailure(r) {
    return !!r && (r.outcome === "timeout" || r.outcome === "skip" || (r.outcome === "answered" && r.isCorrect === false));
  }
  // questionHistory の補完（Phase 1 と同じ：新しい時刻を採用、同じ時刻なら誤答を優先）
  function historyWins(ts, isCorrect, e) {
    if (!e || typeof e.date !== "number") return true;
    if (ts > e.date) return true;
    return ts === e.date && isCorrect === false && e.isCorrect !== false;
  }

  // {state, stats} を受け取り、削減後の新しいオブジェクトを返す（入力は変更しない）。
  // 移す生ログが無ければ入力をそのまま返す。
  function compactUnitData(d) {
    if (!d || !d.state || typeof d.state !== "object") return d;
    var st = d.state;
    var raw = Array.isArray(st.answerLog) ? st.answerLog : [];
    if (!raw.length) return d;
    var arc = normalizeArchive(st.logArchive);

    // 重複なしの全 event（archive ＋ 生ログ）
    var archKeys = new Set();
    var events = [];
    Object.keys(arc).forEach(function (k) {
      var s = arc[k];
      for (var i = 0; i < s.length; i += TOKEN_LEN) {
        var key = k + s.slice(i, i + ID_LEN);
        archKeys.add(key);
        events.push({ ts: tsFromDayOffset(k, parseInt(s.slice(i, i + TIME_LEN), 36)), key: key });
      }
    });
    var seen = new Set(archKeys);
    var rawKeys = raw.map(function (r) {
      var id = eventId(r);
      if (id === null) return null;
      var key = jstDayKey(r.timestamp) + id;
      if (!seen.has(key)) { seen.add(key); events.push({ ts: r.timestamp, key: key }); }
      return key;
    });
    if (!events.length) return d;
    events.sort(function (a, b) { return b.ts - a.ts || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0); });
    var oldest = events[0].ts - RAW_KEEP_DAYS * DAY_MS;
    var keep = new Set();
    for (var i = 0; i < events.length && keep.size < RAW_KEEP_MAX; i++) {
      if (events[i].ts < oldest) break;
      keep.add(events[i].key);
    }

    var kept = [], moved = [], keptKeys = new Set();
    raw.forEach(function (r, idx) {
      var key = rawKeys[idx];
      if (key === null) { kept.push(r); return; }
      if (archKeys.has(key) || !keep.has(key) || keptKeys.has(key)) { moved.push(r); return; }
      keptKeys.add(key);
      kept.push(r);
    });
    if (!moved.length) return d;

    // 移す生ログ → rescueLog への回収・questionHistory の補完・archive への追加
    var qhIn = d.stats && d.stats.questionHistory && typeof d.stats.questionHistory === "object" ? d.stats.questionHistory : {};
    var qh = Object.assign({}, qhIn);
    var addArc = {}, addRescue = {};
    moved.forEach(function (r) {
      var qid = r.questionId;
      var hasQid = (typeof qid === "string" && qid !== "") || typeof qid === "number";
      if (hasQid) {
        qid = String(qid);
        if (isRescueFailure(r)) {
          var rt = rescueTsToken(r.timestamp);
          if (rt) addRescue[qid] = (addRescue[qid] || "") + rt;
        }
        var ok = r.isCorrect === true;
        if (historyWins(r.timestamp, ok, qh[qid])) qh[qid] = { date: r.timestamp, isCorrect: ok };
      }
      var t = tokenOf(r);
      var k = jstDayKey(r.timestamp);
      addArc[k] = (addArc[k] || "") + t;
    });

    var state = Object.assign({}, st, { answerLog: kept });
    var newArc = unionArchives(arc, addArc);
    if (Object.keys(newArc).length) state.logArchive = newArc; else delete state.logArchive;
    var newRescue = pruneRescueLog(unionRescueLogs(st.rescueLog, addRescue), st.graduatedAt);
    if (Object.keys(newRescue).length) state.rescueLog = newRescue; else delete state.rescueLog;
    var stats = Object.assign({}, d.stats || {}, { questionHistory: qh });
    return Object.assign({}, d, { state: state, stats: stats });
  }

  var api = {
    TOKEN_LEN: TOKEN_LEN,
    ID_LEN: ID_LEN,
    cyrb53: cyrb53,
    dedupeKey: dedupeKey,
    jstDayKey: jstDayKey,
    jstOffset: jstOffset,
    tsFromDayOffset: tsFromDayOffset,
    flagOf: flagOf,
    preferFlag: preferFlag,
    eventId: eventId,
    tokenOf: tokenOf,
    parseDay: parseDay,
    canonicalDay: canonicalDay,
    unionArchives: unionArchives,
    normalizeArchive: normalizeArchive,
    hasArchive: hasArchive,
    archiveEvents: archiveEvents,
    countableLog: countableLog,
    RESCUE_TS_LEN: RESCUE_TS_LEN,
    rescueTsToken: rescueTsToken,
    parseRescueTimes: parseRescueTimes,
    unionRescueLogs: unionRescueLogs,
    normalizeRescueLog: normalizeRescueLog,
    pruneRescueLog: pruneRescueLog,
    rescueTimes: rescueTimes,
    RAW_KEEP_MAX: RAW_KEEP_MAX,
    RAW_KEEP_DAYS: RAW_KEEP_DAYS,
    isRescueFailure: isRescueFailure,
    compactUnitData: compactUnitData
  };
  root.LogArchive = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
