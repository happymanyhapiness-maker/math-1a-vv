/* =========================================================
   progress-dashboard.js  —  全体の進捗管理パネル
   ---------------------------------------------------------
   ・app.js / index.html 本体は変更しない後付けスクリプト
     （crossunit.js と同じ非破壊的な後処理方式）。
   ・単元選択画面（#unitSelectScreen）の一番上に、
     全単元横断の「進捗率」「正答率」を並べたダッシュボードを注入する。
   ・データソースは crossunit.js と同じ localStorage の
     kyotsu_app_v14_<unit> キー。UNIT_META があればそれを使い、
     無ければ localStorage を走査してフォールバックする。
   ・読み込み順: app.js の後（crossunit.js の前後どちらでも可）に
     <script> で追加すること。
   ========================================================= */
(function () {
  "use strict";

  var PREFIX = "kyotsu_app_v14_";

  function meta() {
    return (typeof UNIT_META !== "undefined") ? UNIT_META : {};
  }

  function pct(c, t) { return t ? Math.round((c / t) * 100) : null; }
  function pctText(c, t) { var p = pct(c, t); return (p === null) ? "-" : p + "%"; }

  /* ---------- 単元ごとの進捗・正答率を集計 ---------- */
  function collectUnitProgress() {
    var m = meta();
    var keys = Object.keys(m);

    // UNIT_META が無い場合は localStorage を走査
    if (keys.length === 0) {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k.slice(PREFIX.length));
      }
    }

    return keys.map(function (unit) {
      var unitMeta = m[unit] || {};
      var label = unitMeta.label || unit;
      var total = Array.isArray(unitMeta.questions) ? unitMeta.questions.length : null;

      var raw = localStorage.getItem(PREFIX + unit);
      var obj = null;
      if (raw) { try { obj = JSON.parse(raw); } catch (e) { obj = null; } }

      var log = (obj && obj.state && Array.isArray(obj.state.answerLog)) ? obj.state.answerLog : [];

      // 進捗率＝そのユニットで「一度でも解答したことのある問題」の割合
      var seen = {};
      log.forEach(function (r) {
        if (r && r.questionId != null) seen[r.questionId] = true;
      });
      var answeredCount = Object.keys(seen).length;

      var correct = log.filter(function (r) { return r && r.isCorrect; }).length;

      return {
        unit: unit,
        label: label,
        total: total,
        answeredCount: answeredCount,
        progressPct: total ? pct(Math.min(answeredCount, total), total) : null,
        attempts: log.length,
        correct: correct,
        accuracyPct: pct(correct, log.length)
      };
    });
  }

  /* ---------- 描画 ---------- */
  function rowHTML(row) {
    var progress = row.progressPct === null ? 0 : row.progressPct;
    var started = row.attempts > 0;

    var progressText = row.total
      ? row.answeredCount + " / " + row.total + "問（" + pctText(Math.min(row.answeredCount, row.total), row.total) + "）"
      : "-";

    var accuracyText = started ? pctText(row.correct, row.attempts) + "（" + row.correct + "/" + row.attempts + "回）" : "まだ未挑戦";

    return (
      '<div class="progress-row' + (started ? "" : " progress-row-notstarted") + '">' +
        '<div class="progress-row-head">' +
          '<span class="progress-row-label">' + escapeHtmlSafe(row.label) + '</span>' +
          '<span class="progress-row-accuracy">' + accuracyText + '</span>' +
        '</div>' +
        '<div class="progress-bar-track">' +
          '<div class="progress-bar-fill" style="width:' + progress + '%;"></div>' +
        '</div>' +
        '<div class="progress-row-foot">' + progressText + '</div>' +
      '</div>'
    );
  }

  function escapeHtmlSafe(s) {
    if (typeof escapeHtml === "function") return escapeHtml(String(s));
    return String(s).replace(/[<>&"]/g, function (c) {
      return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c];
    });
  }

  function renderDashboard() {
    var body = document.getElementById("progressDashboardBody");
    if (!body) return;

    var rows = collectUnitProgress();
    if (!rows.length) {
      body.innerHTML = '<div class="small-text">まだ学習データがありません。単元を選んで始めましょう。</div>';
      return;
    }

    // 未着手 → 着手済みの順に、着手済みは進捗率が低い順に並べる
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
  }

  /* ---------- UI 注入 ---------- */
  function injectUI() {
    if (document.getElementById("progressDashboard")) { renderDashboard(); return true; }

    var screen = document.getElementById("unitSelectScreen");
    var anchor = document.getElementById("unitCardList");
    if (!screen || !anchor) return false;

    var panel = document.createElement("section");
    panel.id = "progressDashboard";
    panel.className = "panel-block progress-dashboard";
    panel.innerHTML =
      '<div class="progress-dashboard-heading">' +
        '<h2 style="margin:0;">全体の進捗</h2>' +
        '<button class="btn secondary" id="refreshProgressBtn" type="button">更新</button>' +
      '</div>' +
      '<div id="progressDashboardBody"></div>';

    screen.insertBefore(panel, anchor);

    var refreshBtn = document.getElementById("refreshProgressBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", renderDashboard);

    renderDashboard();
    return true;
  }

  function boot() {
    if (injectUI()) {
      // 単元選択画面に戻ってくるたびに最新化する
      document.addEventListener("click", function (e) {
        var t = e.target;
        if (t && (t.id === "goTopBtn" || t.id === "goTopBtn3" || t.id === "titleHomeBtn")) {
          setTimeout(renderDashboard, 50);
        }
      });
      return;
    }
    var obs = new MutationObserver(function () {
      if (injectUI()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.renderProgressDashboard = renderDashboard;
})();
