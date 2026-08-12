/* =========================================================
   crossunit.js  —  単元横断ログ集計アドオン
   ---------------------------------------------------------
   ・app.js / index.html は一切変更しない後付けスクリプト。
   ・localStorage の各単元データ (kyotsu_app_v14_<unit>) を
     直接読んで、全単元をまとめた分析レポートを生成する。
   ・「AI分析」パネルにボタンを2つ自己注入する。
   ・読み込み順: app.js の後に <script> で追加すること。
   ========================================================= */
(function () {
  "use strict";

  var PREFIX = "kyotsu_app_v14_";

  /* app.js 側の定数を参照（無ければ安全にフォールバック） */
  function meta() {
    return (typeof UNIT_META !== "undefined") ? UNIT_META : {};
  }
  function tagName(tag) {
    if (!tag) return "分類なし";
    if (typeof TAG_LABELS !== "undefined" && TAG_LABELS[tag]) return TAG_LABELS[tag];
    return tag;
  }
  function unitLabel(key) {
    var m = meta()[key];
    return (m && m.label) ? m.label : key;
  }

  /* ---------- localStorage から全単元を読む ---------- */
  function readAllUnits() {
    var out = [];
    var keys = Object.keys(meta());

    // UNIT_META が取れない場合は localStorage を走査して単元キーを拾う
    if (keys.length === 0) {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k.slice(PREFIX.length));
      }
    }

    keys.forEach(function (unit) {
      var raw = localStorage.getItem(PREFIX + unit);
      if (!raw) {
        out.push({ unit: unit, label: unitLabel(unit), exists: false, log: [], stats: null });
        return;
      }
      var obj = null;
      try { obj = JSON.parse(raw); } catch (e) { obj = null; }
      if (!obj) {
        out.push({ unit: unit, label: unitLabel(unit), exists: false, log: [], stats: null });
        return;
      }
      var st = obj.state || {};
      var log = Array.isArray(st.answerLog) ? st.answerLog : [];

      out.push({
        unit: unit,
        label: unitLabel(unit),
        exists: true,
        log: log,
        history: Array.isArray(st.history) ? st.history : [],
        wrongCount: Array.isArray(st.wrong) ? st.wrong.length : 0,
        tipCount: Array.isArray(st.tipList) ? st.tipList.length : 0,
        stats: obj.stats || null,
        totalQuestions: (meta()[unit] && Array.isArray(meta()[unit].questions))
          ? meta()[unit].questions.length : null
      });
    });

    return out;
  }

  /* ---------- 小道具 ---------- */
  function pct(c, t) { return t ? Math.round((c / t) * 100) : null; }
  function pctText(c, t) { var p = pct(c, t); return (p === null) ? "-" : p + "%"; }
  function pad(s, n) {
    s = String(s);
    // 全角を2幅として概算し、等幅っぽく揃える
    var w = 0;
    for (var i = 0; i < s.length; i++) w += (s.charCodeAt(i) > 0x7f) ? 2 : 1;
    while (w < n) { s += " "; w++; }
    return s;
  }
  function fmtDate(ts) {
    if (!ts) return "?";
    var d = new Date(ts);
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
  }
  function sortDesc(obj) {
    return Object.keys(obj)
      .map(function (k) { return { key: k, n: obj[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  /* ---------- レポート本体 ---------- */
  function buildCrossUnitReport() {
    var units = readAllUnits();
    var L = [];
    var now = new Date();

    L.push("==== 共通テスト対策アプリ 全単元まとめレポート ====");
    L.push("出力日時: " + now.toLocaleString("ja-JP"));
    L.push("");

    /* --- 全体サマリ --- */
    var all = [];
    units.forEach(function (u) {
      u.log.forEach(function (r) {
        var c = {};
        for (var k in r) c[k] = r[k];
        c._unit = u.label;
        all.push(c);
      });
    });

    var played = units.filter(function (u) { return u.log.length > 0; });
    var allCorrect = all.filter(function (r) { return r.isCorrect; }).length;

    L.push("【全体サマリ】");
    L.push("  取り組んだ単元: " + played.length + " / " + units.length);
    L.push("  総回答数: " + all.length + " 回");
    L.push("  通算正答率: " + pctText(allCorrect, all.length));
    if (all.length === 0) {
      L.push("");
      L.push("  ※まだ回答ログがありません。");
      L.push("==== ここまで ====");
      return L.join("\n");
    }
    var lastTs = Math.max.apply(null, all.map(function (r) { return r.timestamp || 0; }));
    L.push("  最終学習日: " + fmtDate(lastTs));
    L.push("");

    /* --- 単元別ランキング --- */
    L.push("【単元別の状況（正答率が低い順）】");
    var rows = units.map(function (u) {
      var c = u.log.filter(function (r) { return r.isCorrect; }).length;
      return {
        label: u.label,
        n: u.log.length,
        c: c,
        rate: pct(c, u.log.length),
        total: u.totalQuestions,
        wrong: u.wrongCount || 0
      };
    });
    var doneRows = rows.filter(function (r) { return r.n > 0; })
      .sort(function (a, b) { return a.rate - b.rate; });
    var todoRows = rows.filter(function (r) { return r.n === 0; });

    doneRows.forEach(function (r, i) {
      L.push("  " + (i + 1) + ". " + pad(r.label, 22) +
        " 正答率 " + pad(r.rate + "%", 5) +
        " (" + r.c + "/" + r.n + "回)" +
        (r.wrong ? " / 誤答リスト " + r.wrong + "問" : ""));
    });
    if (todoRows.length) {
      L.push("");
      L.push("  ◆まだ手をつけていない単元:");
      todoRows.forEach(function (r) {
        L.push("    - " + r.label + (r.total ? "（全" + r.total + "問）" : ""));
      });
    }
    L.push("");

    /* --- 横断タグ頻度 --- */
    var tagCnt = {};
    all.forEach(function (r) {
      if (r.isCorrect) return;
      var t = r.selectedTag || "unknown";
      tagCnt[t] = (tagCnt[t] || 0) + 1;
    });
    var wrongTotal = all.length - allCorrect;
    L.push("【ミスの傾向（全単元・誤答 " + wrongTotal + " 回の内訳）】");
    if (wrongTotal === 0) {
      L.push("  誤答なし。");
    } else {
      sortDesc(tagCnt).forEach(function (t) {
        L.push("  " + pad(tagName(t.key), 34) + t.n + "回 (" + pctText(t.n, wrongTotal) + ")");
      });
    }
    L.push("");

    /* --- 弱点軸 --- */
    var wk = {};
    all.forEach(function (r) {
      var w = r.weakness || "未分類";
      if (!wk[w]) wk[w] = { c: 0, t: 0 };
      wk[w].t++;
      if (r.isCorrect) wk[w].c++;
    });
    L.push("【弱点軸別の正答率（全単元横断）】");
    Object.keys(wk)
      .sort(function (a, b) { return pct(wk[a].c, wk[a].t) - pct(wk[b].c, wk[b].t); })
      .forEach(function (w) {
        L.push("  " + pad(w, 14) + pad(pctText(wk[w].c, wk[w].t), 6) + "(" + wk[w].c + "/" + wk[w].t + ")");
      });
    L.push("");

    /* --- ステージ別 --- */
    var stg = {};
    all.forEach(function (r) {
      var s = r.stage || "不明";
      if (!stg[s]) stg[s] = { c: 0, t: 0 };
      stg[s].t++;
      if (r.isCorrect) stg[s].c++;
    });
    L.push("【ステージ別の正答率（全単元横断）】");
    ["第1問", "第2問", "第3問", "第4問"].forEach(function (s) {
      if (!stg[s]) return;
      L.push("  " + s + ": " + pctText(stg[s].c, stg[s].t) + " (" + stg[s].c + "/" + stg[s].t + ")");
    });
    L.push("");

    /* --- 方針(route)別 --- */
    var rt = {};
    all.forEach(function (r) {
      (Array.isArray(r.route) ? r.route : []).forEach(function (x) {
        if (!rt[x]) rt[x] = { c: 0, t: 0 };
        rt[x].t++;
        if (r.isCorrect) rt[x].c++;
      });
    });
    var rtKeys = Object.keys(rt).filter(function (k) { return rt[k].t >= 2; })
      .sort(function (a, b) { return pct(rt[a].c, rt[a].t) - pct(rt[b].c, rt[b].t); });
    if (rtKeys.length) {
      L.push("【方針タグ別の正答率（2回以上出たものだけ・低い順トップ10）】");
      rtKeys.slice(0, 10).forEach(function (k) {
        L.push("  " + pad(k, 26) + pad(pctText(rt[k].c, rt[k].t), 6) + "(" + rt[k].c + "/" + rt[k].t + ")");
      });
      L.push("");
    }

    /* --- 時間プロファイル --- */
    var tCorrect = [], tWrong = [];
    all.forEach(function (r) {
      if (typeof r.elapsedTime !== "number") return;
      (r.isCorrect ? tCorrect : tWrong).push(r.elapsedTime);
    });
    function avg(a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : null; }
    if (tCorrect.length || tWrong.length) {
      L.push("【時間の使い方（全単元横断）】");
      L.push("  正解した問題の平均: " + (avg(tCorrect) === null ? "-" : avg(tCorrect) + "秒"));
      L.push("  間違えた問題の平均: " + (avg(tWrong) === null ? "-" : avg(tWrong) + "秒"));
      if (avg(tCorrect) !== null && avg(tWrong) !== null) {
        L.push("  ※誤答のほうが短ければ早とちり型、長ければ悩んで外す型の可能性。");
      }
      L.push("");
    }

    /* --- 繰り返しミス --- */
    var rep = {};
    all.forEach(function (r) {
      if (r.isCorrect) return;
      var k = r._unit + "|" + r.stage + r.num + "|" + r.questionId;
      if (!rep[k]) rep[k] = { n: 0, tags: {} };
      rep[k].n++;
      var t = r.selectedTag || "unknown";
      rep[k].tags[t] = (rep[k].tags[t] || 0) + 1;
    });
    var repList = Object.keys(rep).filter(function (k) { return rep[k].n >= 2; })
      .sort(function (a, b) { return rep[b].n - rep[a].n; });
    L.push("【何度も間違えている問題（2回以上）】");
    if (!repList.length) {
      L.push("  なし");
    } else {
      repList.slice(0, 15).forEach(function (k) {
        var p = k.split("|");
        var top = sortDesc(rep[k].tags)[0];
        L.push("  " + p[0] + " " + p[1] + " … " + rep[k].n + "回ミス / 主な原因: " + tagName(top.key));
      });
    }
    L.push("");

    /* --- 直近の誤答 --- */
    var recentWrong = all.filter(function (r) { return !r.isCorrect; })
      .sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); })
      .slice(0, 25);
    L.push("【直近の誤答（新しい順・最大25件）】");
    if (!recentWrong.length) {
      L.push("  なし");
    } else {
      recentWrong.forEach(function (r) {
        var sel = r.selectedText ? "「" + r.selectedText + "」" : "(無回答)";
        L.push("  " + fmtDate(r.timestamp) + " " + r._unit + " " + r.stage + r.num +
          "(" + r.questionId + "): 選択" + sel +
          " → 正解「" + r.correctText + "」 / " + tagName(r.selectedTag) +
          " / " + (r.elapsedTime != null ? r.elapsedTime + "秒" : "?秒"));
      });
    }
    L.push("");
    L.push("==== ここまで ====");
    L.push("↑この全単元ログをもとに、(1)いま最優先で潰すべき弱点、(2)単元をまたいで共通している悪いクセ、");
    L.push("  (3)次の1週間の具体的な復習メニュー、を出してください。");

    return L.join("\n");
  }

  /* ---------- コピー処理 ---------- */
  function setStatus(msg, color) {
    var s = document.getElementById("crossCopyStatus");
    if (s) { s.innerText = msg; s.style.color = color || "#166534"; }
  }

  function copyCross() {
    var text = buildCrossUnitReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setStatus("全単元ぶんをコピーしました！Claudeに貼り付けてください。"); },
        function () { fallback(text); }
      );
    } else {
      fallback(text);
    }
  }

  function fallback(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setStatus("全単元ぶんをコピーしました！Claudeに貼り付けてください。");
    } catch (e) {
      setStatus("コピーに失敗しました。プレビューから手動でコピーしてください。", "#991b1b");
    }
  }

  function togglePreview() {
    var pre = document.getElementById("crossPreview");
    if (!pre) return;
    if (pre.style.display === "none" || !pre.style.display) {
      pre.innerText = buildCrossUnitReport();
      pre.style.display = "block";
    } else {
      pre.style.display = "none";
    }
  }

  /* ---------- UI 注入 ---------- */
  function injectUI() {
    if (document.getElementById("copyCrossBtn")) return true;

    var anchor = document.getElementById("analysisCopyStatus");
    if (!anchor) return false;

    // 「この単元」セクションとは別に、独立した見出し付きセクションを追加する
    // （以前は同じ見出しの下に追記していたため、ボタンが4つ縦に並んでごちゃついていた）
    var singleUnitSection = anchor.closest ? anchor.closest("section.panel-block") : anchor.parentNode.parentNode;

    var section = document.createElement("section");
    section.className = "panel-block";
    section.id = "crossUnitSection";
    section.innerHTML =
      '<h2>AI分析（全単元）</h2>' +
      '<div class="small-text" style="margin-bottom:6px;">' +
      '全単元のログをまとめて出力します（今ひらいている単元以外も含む）。</div>' +
      '<div class="stack-buttons">' +
      '<button class="btn primary" id="copyCrossBtn">全単元まとめてコピー</button>' +
      '<button class="btn secondary" id="previewCrossBtn">全単元の中身をプレビュー</button>' +
      '</div>' +
      '<div class="small-text" id="crossCopyStatus" style="margin-top:6px;"></div>' +
      '<pre id="crossPreview" class="analysis-preview" style="display:none;"></pre>';

    if (singleUnitSection && singleUnitSection.parentNode) {
      singleUnitSection.parentNode.insertBefore(section, singleUnitSection.nextSibling);
    } else {
      anchor.parentNode.parentNode.appendChild(section);
    }

    document.getElementById("copyCrossBtn").addEventListener("click", copyCross);
    document.getElementById("previewCrossBtn").addEventListener("click", togglePreview);
    return true;
  }

  function boot() {
    if (injectUI()) return;
    // パネルが後から描画される場合に備えて監視
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

  // デバッグ用に外から呼べるようにしておく
  window.buildCrossUnitReport = buildCrossUnitReport;
})();
