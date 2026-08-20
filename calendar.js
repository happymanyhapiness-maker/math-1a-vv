/* =========================================================
   calendar.js  —  学習日カレンダー（独立ページ）
   ---------------------------------------------------------
   ・calendar.html 専用スクリプト。app.js 本体には依存しない
     （UNIT_META を丸ごと読み込むと index.html 用の初期化コードまで
     動いてしまうため、単元ラベルだけをここに複製して持つ）。
   ・データソースは他の後付けスクリプト（crossunit.js /
     progress-dashboard.js / unit-strength.js）と同じ localStorage の
     kyotsu_app_v14_<unit> キー。
   ========================================================= */
(function () {
  "use strict";

  var PREFIX = "kyotsu_app_v14_";

  // app.js の UNIT_META のラベルだけを複製（questions等の重いデータは持たない）
  var UNIT_LABELS = {
    chugaku: "図形の土台",
    keiryo: "数ⅠA 図形と計量",
    seishitsu: "数ⅠA 図形の性質",
    nijikansuu: "数ⅠA 二次関数",
    kitaichi: "数ⅠA 期待値(ミニ)",
    vector: "数ⅡBC ベクトル",
    shisuu: "数ⅡBC 指数・対数",
    zahyou: "数ⅡBC 図形と方程式",
    bisekibun: "数ⅡBC 微積(グラフ判断)",
    suuretsu: "数ⅡBC 数列(累計・再利用ミニ)",
    toukei: "数ⅡBC 統計的な推測",
    sankaku: "数Ⅱ 三角関数",
    deta_bunseki: "数I データの分析"
  };

  function unitLabel(unit) { return UNIT_LABELS[unit] || unit; }

  function pct(c, t) { return t ? Math.round((c / t) * 100) : null; }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function escapeHtml(s) {
    return String(s).replace(/[<>&"]/g, function (c) {
      return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c];
    });
  }

  function dateKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /* ---------- 全単元のログを日付ごとに集計 ---------- */
  function buildDayMap() {
    var keys = Object.keys(UNIT_LABELS);
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        var unit = k.slice(PREFIX.length);
        if (keys.indexOf(unit) === -1) keys.push(unit);
      }
    }

    var days = {};

    keys.forEach(function (unit) {
      var raw = localStorage.getItem(PREFIX + unit);
      if (!raw) return;
      var obj;
      try { obj = JSON.parse(raw); } catch (e) { return; }
      var log = (obj && obj.state && Array.isArray(obj.state.answerLog)) ? obj.state.answerLog : [];

      log.forEach(function (r) {
        if (!r || !r.timestamp) return;
        var key = dateKey(r.timestamp);
        if (!days[key]) days[key] = { attempts: 0, correct: 0, byUnit: {} };

        days[key].attempts++;
        if (r.isCorrect) days[key].correct++;

        if (!days[key].byUnit[unit]) {
          days[key].byUnit[unit] = { label: unitLabel(unit), attempts: 0, correct: 0 };
        }
        days[key].byUnit[unit].attempts++;
        if (r.isCorrect) days[key].byUnit[unit].correct++;
      });
    });

    return days;
  }

  var dayMap = buildDayMap();

  var today = new Date();
  var view = { year: today.getFullYear(), month: today.getMonth() }; // month: 0-11

  function tierClass(rate) {
    if (rate < 50) return "cal-day-weak";
    if (rate < 75) return "cal-day-mid";
    return "cal-day-strong";
  }

  /* ---------- カレンダー描画 ---------- */
  function renderCalendar() {
    var label = document.getElementById("calMonthLabel");
    var grid = document.getElementById("calGrid");
    if (!label || !grid) return;

    label.textContent = view.year + "年" + (view.month + 1) + "月";

    var firstWeekday = new Date(view.year, view.month, 1).getDay();
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var todayKey = dateKey(today.getTime());

    var html = "";
    for (var i = 0; i < firstWeekday; i++) {
      html += '<div class="cal-day cal-day-empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var cellDate = new Date(view.year, view.month, d);
      var key = dateKey(cellDate.getTime());
      var info = dayMap[key];
      var classes = "cal-day";
      if (key === todayKey) classes += " cal-day-today";

      var inner = '<span class="cal-day-num">' + d + '</span>';
      if (info) {
        var rate = pct(info.correct, info.attempts);
        classes += " cal-day-active " + tierClass(rate);
        inner += '<span class="cal-day-count">' + info.attempts + '問</span>';
      }

      html += '<button type="button" class="' + classes + '" data-date="' + key + '">' + inner + '</button>';
    }

    grid.innerHTML = html;

    grid.querySelectorAll(".cal-day[data-date]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        grid.querySelectorAll(".cal-day-selected").forEach(function (b) { b.classList.remove("cal-day-selected"); });
        btn.classList.add("cal-day-selected");
        renderDetail(btn.getAttribute("data-date"));
      });
    });

    var nextBtn = document.getElementById("calNextBtn");
    if (nextBtn) {
      var isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();
      nextBtn.disabled = isCurrentMonth;
      nextBtn.classList.toggle("btn-disabled", isCurrentMonth);
    }
  }

  /* ---------- 選択した日の詳細 ---------- */
  function renderDetail(key) {
    var box = document.getElementById("calDetail");
    if (!box) return;

    var info = dayMap[key];
    var parts = key.split("-");
    var dateLabel = parts[0] + "年" + parts[1] + "月" + parts[2] + "日";

    if (!info) {
      box.innerHTML =
        '<div class="cal-detail-date">' + dateLabel + '</div>' +
        '<div class="small-text">この日は学習していません。</div>';
      return;
    }

    var totalRate = pct(info.correct, info.attempts);
    var units = Object.keys(info.byUnit).map(function (u) { return info.byUnit[u]; })
      .sort(function (a, b) { return b.attempts - a.attempts; });

    var rows = units.map(function (u) {
      var r = pct(u.correct, u.attempts);
      return (
        '<div class="cal-detail-row">' +
          '<span class="cal-detail-row-label">' + escapeHtml(u.label) + '</span>' +
          '<span class="cal-detail-row-stat">' + u.correct + '/' + u.attempts + '問（' + r + '%）</span>' +
        '</div>'
      );
    }).join("");

    box.innerHTML =
      '<div class="cal-detail-date">' + dateLabel + '</div>' +
      '<div class="small-text" style="margin-bottom:8px;">合計 ' + info.attempts + '問 / 正答率 ' + totalRate + '%</div>' +
      rows;
  }

  /* ---------- 月移動 ---------- */
  function changeMonth(delta) {
    view.month += delta;
    if (view.month < 0) { view.month = 11; view.year--; }
    if (view.month > 11) { view.month = 0; view.year++; }

    // 未来の月には進めない
    if (view.year > today.getFullYear() || (view.year === today.getFullYear() && view.month > today.getMonth())) {
      view.year = today.getFullYear();
      view.month = today.getMonth();
    }

    renderCalendar();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var prevBtn = document.getElementById("calPrevBtn");
    var nextBtn = document.getElementById("calNextBtn");
    if (prevBtn) prevBtn.addEventListener("click", function () { changeMonth(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { changeMonth(1); });

    renderCalendar();
  });
})();
