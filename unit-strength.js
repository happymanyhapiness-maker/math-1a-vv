/* =========================================================
   unit-strength.js  —  単元別 分析（弱い/強い単元）
   ---------------------------------------------------------
   ・app.js / index.html 本体は変更しない後付けスクリプト
     （crossunit.js / progress-dashboard.js と同じ方式）。
   ・画面右上（topbar の統計カードの隣）に「分析」ボタンを注入し、
     押すとモーダルで単元ごとの正答率を弱い順に並べて表示する。
   ・データソースは crossunit.js / progress-dashboard.js と同じ
     localStorage の kyotsu_app_v14_<unit> キー。
   ・読み込み順: app.js の後（crossunit.js / progress-dashboard.js の
     前後どちらでも可）に <script> で追加すること。
   ========================================================= */
(function () {
  "use strict";

  var PREFIX = "kyotsu_app_v14_";

  function meta() {
    return (typeof UNIT_META !== "undefined") ? UNIT_META : {};
  }

  function pct(c, t) { return t ? Math.round((c / t) * 100) : null; }

  function escapeHtmlSafe(s) {
    if (typeof escapeHtml === "function") return escapeHtml(String(s));
    return String(s).replace(/[<>&"]/g, function (c) {
      return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c];
    });
  }

  /* ---------- 単元ごとの正答率を集計（着手済みのみ） ---------- */
  function collectUnitAccuracy() {
    var m = meta();
    var keys = Object.keys(m);

    if (keys.length === 0) {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k.slice(PREFIX.length));
      }
    }

    var rows = keys.map(function (unit) {
      var unitMeta = m[unit] || {};
      var label = unitMeta.label || unit;

      var raw = localStorage.getItem(PREFIX + unit);
      var obj = null;
      if (raw) { try { obj = JSON.parse(raw); } catch (e) { obj = null; } }

      var log = (obj && obj.state && Array.isArray(obj.state.answerLog)) ? obj.state.answerLog : [];
      var correct = log.filter(function (r) { return r && r.isCorrect; }).length;

      return {
        unit: unit,
        label: label,
        attempts: log.length,
        correct: correct,
        rate: pct(correct, log.length)
      };
    });

    return rows.filter(function (r) { return r.attempts > 0; })
      .sort(function (a, b) { return a.rate - b.rate; });
  }

  /* ---------- 描画 ---------- */
  function tierClass(rate) {
    if (rate < 50) return "unit-strength-fill-weak";
    if (rate < 75) return "unit-strength-fill-mid";
    return "unit-strength-fill-strong";
  }

  function rowHTML(row) {
    return (
      '<div class="unit-strength-row">' +
        '<div class="unit-strength-row-head">' +
          '<span class="unit-strength-label">' + escapeHtmlSafe(row.label) + '</span>' +
          '<span class="unit-strength-pct">' + row.rate + '%</span>' +
        '</div>' +
        '<div class="unit-strength-bar-track">' +
          '<div class="unit-strength-bar-fill ' + tierClass(row.rate) + '" style="width:' + row.rate + '%;"></div>' +
        '</div>' +
        '<div class="unit-strength-row-foot">' + row.correct + '/' + row.attempts + '回</div>' +
      '</div>'
    );
  }

  function buildBodyHTML() {
    var rows = collectUnitAccuracy();
    if (!rows.length) {
      return '<div class="small-text">まだ回答ログがありません。数問解くと、単元ごとの正答率がここに出ます。</div>';
    }

    var weakest = rows[0];
    var strongest = rows[rows.length - 1];

    var summary = '<div class="small-text" style="margin-bottom:10px;">';
    summary += '一番弱い: <strong>' + escapeHtmlSafe(weakest.label) + '</strong>（' + weakest.rate + '%）';
    if (rows.length >= 2) {
      summary += '　/　一番強い: <strong>' + escapeHtmlSafe(strongest.label) + '</strong>（' + strongest.rate + '%）';
    }
    summary += '</div>';

    return summary + rows.map(rowHTML).join("");
  }

  /* ---------- モーダル ---------- */
  function closeModal() {
    var modal = document.getElementById("unitStrengthModal");
    if (modal) modal.remove();
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  function openModal() {
    if (document.getElementById("unitStrengthModal")) return;

    var modal = document.createElement("div");
    modal.className = "unit-strength-modal";
    modal.id = "unitStrengthModal";
    modal.innerHTML =
      '<div class="unit-strength-modal-box">' +
        '<div class="unit-strength-modal-head">' +
          '<h2>単元別 分析</h2>' +
          '<button type="button" class="unit-strength-modal-close" id="unitStrengthCloseBtn" aria-label="閉じる">×</button>' +
        '</div>' +
        '<div id="unitStrengthModalBody">' + buildBodyHTML() + '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById("unitStrengthCloseBtn").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", onKeydown);
  }

  /* ---------- UI 注入 ---------- */
  function injectUI() {
    if (document.getElementById("unitStrengthBtn")) return true;

    var topStats = document.querySelector(".top-stats");
    if (!topStats || !topStats.parentNode) return false;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "unitStrengthBtn";
    btn.className = "btn purple unit-strength-btn";
    btn.textContent = "分析";
    btn.addEventListener("click", openModal);

    topStats.parentNode.insertBefore(btn, topStats.nextSibling);

    return true;
  }

  function boot() {
    if (injectUI()) return;
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

  window.openUnitStrengthModal = openModal;
})();
