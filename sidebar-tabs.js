/* =========================================================
   sidebar-tabs.js  —  サイドバーの「成績を見る／操作する」タブ切替
   ---------------------------------------------------------
   ・app.js は変更しない。純粋にタブの表示切替だけを行う。
   ・選択中のタブは localStorage に覚えておき、次に開いたときも
     同じタブから始まるようにする（学習中の途中で見失わないため）。
   ========================================================= */
(function () {
  "use strict";

  var TAB_KEY = "kyotsu_sidebar_tab";

  function applyTab(tab) {
    document.querySelectorAll(".sidebar-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-sidebar-tab") === tab);
    });
    document.querySelectorAll(".sidebar-page").forEach(function (page) {
      page.classList.toggle("active", page.getAttribute("data-sidebar-page") === tab);
    });
  }

  function boot() {
    var tabs = document.getElementById("sidebarTabs");
    if (!tabs) return;

    var saved = localStorage.getItem(TAB_KEY);
    if (saved === "stats" || saved === "actions") applyTab(saved);

    tabs.querySelectorAll(".sidebar-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-sidebar-tab");
        applyTab(tab);
        localStorage.setItem(TAB_KEY, tab);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
