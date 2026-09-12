/* =========================================================
   progress.js  —  全体の進捗（独立ページ）
   ---------------------------------------------------------
   ・progress.html 専用スクリプト。以前は progress-dashboard.js が
     HOME画面（単元選択画面）に埋め込んでいたが、動線が分かりにくい
     という指摘を受けて専用ページに切り出した。
   ・app.js 本体には依存しない（calendar.js と同じ理由で、UNIT_META
     を丸ごと読み込むと index.html 用の初期化コードまで動いてしまう
     ため、単元ラベルと総問題数だけをここに複製して持つ）。
   ・データソースは他の後付けスクリプトと同じ localStorage の
     kyotsu_app_v14_<unit> キー。
   ========================================================= */
(function () {
  "use strict";

  var PREFIX = "kyotsu_app_v14_";
  var UNIT_KEY = "kyotsu_app_unit_v1"; // app.js が起動時にこのキーで単元を復元する

  // app.js の UNIT_META から label と総問題数だけを複製
  var UNIT_META_MINI = {
    chugaku: { label: "図形の土台", total: 8 },
    keiryo: { label: "数ⅠA 図形と計量", total: 27 },
    seishitsu: { label: "数ⅠA 図形の性質", total: 32 },
    nijikansuu: { label: "数ⅠA 二次関数", total: 28 },
    kitaichi: { label: "数ⅠA 期待値(ミニ)", total: 10 },
    vector: { label: "数ⅡBC ベクトル", total: 20 },
    shisuu: { label: "数ⅡBC 指数・対数", total: 18 },
    zahyou: { label: "数ⅡBC 図形と方程式", total: 16 },
    bisekibun: { label: "数ⅡBC 微積(グラフ判断)", total: 14 },
    suuretsu: { label: "数ⅡBC 数列(累計・再利用ミニ)", total: 10 },
    toukei: { label: "数ⅡBC 統計的な推測", total: 11 },
    sankaku: { label: "数Ⅱ 三角関数", total: 20 },
    deta_bunseki: { label: "数I データの分析", total: 16 }
  };

  function pct(c, t) { return t ? Math.round((c / t) * 100) : null; }
  function pctText(c, t) { var p = pct(c, t); return (p === null) ? "-" : p + "%"; }

  function escapeHtmlSafe(s) {
    return String(s).replace(/[<>&"]/g, function (c) {
      return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c];
    });
  }

  /* ---------- 単元ごとの進捗・正答率を集計 ---------- */
  function collectUnitProgress() {
    return Object.keys(UNIT_META_MINI).map(function (unit) {
      var unitMeta = UNIT_META_MINI[unit];
      var total = unitMeta.total;

      var raw = localStorage.getItem(PREFIX + unit);
      var obj = null;
      if (raw) { try { obj = JSON.parse(raw); } catch (e) { obj = null; } }

      var log = (obj && obj.state && Array.isArray(obj.state.answerLog)) ? obj.state.answerLog : [];

      var seen = {};
      log.forEach(function (r) {
        if (r && r.questionId != null) seen[r.questionId] = true;
      });
      var answeredCount = Object.keys(seen).length;
      var correct = log.filter(function (r) { return r && r.isCorrect; }).length;

      var lastTs = 0;
      log.forEach(function (r) {
        if (r && r.timestamp && r.timestamp > lastTs) lastTs = r.timestamp;
      });

      return {
        unit: unit,
        label: unitMeta.label,
        total: total,
        answeredCount: answeredCount,
        progressPct: total ? pct(Math.min(answeredCount, total), total) : null,
        attempts: log.length,
        correct: correct,
        accuracyPct: pct(correct, log.length),
        lastTs: lastTs
      };
    });
  }

  /* ---------- 日付表示 ---------- */
  function fmtDate(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    var today = new Date();
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    var ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();

    var diffDays = Math.round((new Date(ty, tm, td) - new Date(y, m, day)) / 86400000);
    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "きのう";
    return y + "/" + (m + 1) + "/" + day;
  }

  /* ---------- 描画 ---------- */
  function rowHTML(row) {
    var progress = row.progressPct === null ? 0 : row.progressPct;
    var accuracy = row.accuracyPct === null ? 0 : row.accuracyPct;
    var started = row.attempts > 0;

    var progressCaption = row.total
      ? row.answeredCount + " / " + row.total + "問（" + pctText(Math.min(row.answeredCount, row.total), row.total) + "）"
      : "-";
    var accuracyCaption = started ? pctText(row.correct, row.attempts) + "（" + row.correct + "/" + row.attempts + "回）" : "まだ未挑戦";
    var lastDateText = fmtDate(row.lastTs);

    return (
      '<div class="progress-row' + (started ? "" : " progress-row-notstarted") + '" data-unit="' + escapeHtmlSafe(row.unit) + '" role="button" tabindex="0" ' +
        'aria-label="' + escapeHtmlSafe(row.label) + 'を開く">' +
        '<div class="progress-row-head">' +
          '<span class="progress-row-label">' + escapeHtmlSafe(row.label) + (started ? "" : '<span class="progress-row-badge">未着手</span>') + '</span>' +
        '</div>' +
        '<div class="progress-bars">' +
          '<div class="progress-bar-col">' +
            '<div class="progress-bar-col-cap">進捗 ' + (row.total ? pctText(Math.min(row.answeredCount, row.total), row.total) : "-") + '</div>' +
            '<div class="progress-bar-track">' +
              '<div class="progress-bar-fill" style="width:' + progress + '%;"></div>' +
            '</div>' +
          '</div>' +
          '<div class="progress-bar-col">' +
            '<div class="progress-bar-col-cap">正答率 ' + (started ? pctText(row.correct, row.attempts) : "-") + '</div>' +
            '<div class="progress-bar-track">' +
              '<div class="progress-bar-fill progress-bar-fill-accuracy" style="width:' + accuracy + '%;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="progress-row-foot">' + progressCaption + '　/　' + accuracyCaption +
          (lastDateText ? '　/　最終学習: ' + lastDateText : "") +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    var body = document.getElementById("progressBody");
    if (!body) return;

    var rows = collectUnitProgress();

    var notStarted = rows.filter(function (r) { return r.attempts === 0; });
    var started = rows.filter(function (r) { return r.attempts > 0; })
      .sort(function (a, b) { return (a.progressPct || 0) - (b.progressPct || 0); });

    var totalQuestions = 0, totalAnswered = 0, totalAttempts = 0, totalCorrect = 0;
    rows.forEach(function (r) {
      if (r.total) totalQuestions += r.total;
      totalAnswered += Math.min(r.answeredCount, r.total || r.answeredCount);
      totalAttempts += r.attempts;
      totalCorrect += r.correct;
    });

    var summary =
      '<div class="progress-summary">' +
        '<div class="progress-summary-item"><span class="progress-summary-num">' +
          (totalQuestions ? pctText(totalAnswered, totalQuestions) : "-") +
          '</span><span class="progress-summary-cap">全体の進捗（着手済み問題の割合）</span></div>' +
        '<div class="progress-summary-item"><span class="progress-summary-num">' +
          (totalAttempts ? pctText(totalCorrect, totalAttempts) : "-") +
          '</span><span class="progress-summary-cap">通算正答率</span></div>' +
        '<div class="progress-summary-item"><span class="progress-summary-num">' +
          started.length + ' / ' + rows.length +
          '</span><span class="progress-summary-cap">着手した単元数</span></div>' +
      '</div>';

    body.innerHTML = summary + started.map(rowHTML).join("") + notStarted.map(rowHTML).join("");
    bindRowClicks(body);
  }

  /* ---------- 行のタップでその単元を開いてアプリに戻る ---------- */
  function goToUnit(unit) {
    if (!unit) return;
    localStorage.setItem(UNIT_KEY, unit);
    location.href = "index.html";
  }

  function bindRowClicks(body) {
    var rows = body.querySelectorAll(".progress-row[data-unit]");
    rows.forEach(function (row) {
      row.addEventListener("click", function () {
        goToUnit(row.getAttribute("data-unit"));
      });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToUnit(row.getAttribute("data-unit"));
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})();
