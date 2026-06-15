const STORAGE_KEY = "kyotsu_math_ia_v3";

let state = {
  i: 0,
  total: 0,
  correct: 0,
  review: false,
  wrong: [],
  wrongSet: new Set(),
  solvedWrong: new Set(),
  timerId: null,
  remaining: 60,
  uiMode: "normal",   // normal / exam
  strictTime: false
};

/* =========================
   要素
========================= */
const el = {
  correctCnt: document.getElementById("correctCnt"),
  totalCnt: document.getElementById("totalCnt"),
  rateCnt: document.getElementById("rateCnt"),
  avgCnt: document.getElementById("avgCnt"),

  wCalc: document.getElementById("wCalc"),
  wSwitch: document.getElementById("wSwitch"),
  wTime: document.getElementById("wTime"),
  topWeak: document.getElementById("topWeak"),

  stageRate0: document.getElementById("stageRate0"),
  stageRate1: document.getElementById("stageRate1"),
  stageRate2: document.getElementById("stageRate2"),
  stageRate3: document.getElementById("stageRate3"),

  todayReviewCount: document.getElementById("todayReviewCount"),
  reviewRate: document.getElementById("reviewRate"),
  clearedCount: document.getElementById("clearedCount"),

  questionPanel: document.getElementById("questionPanel"),
  resultBox: document.getElementById("resultBox"),
  questionText: document.getElementById("questionText"),
  optionsBox: document.getElementById("optionsBox"),
  feedback: document.getElementById("feedback"),
  timer: document.getElementById("timer"),

  qStageLabel: document.getElementById("qStageLabel"),
  qScoreLabel: document.getElementById("qScoreLabel"),
  qWeakLabel: document.getElementById("qWeakLabel"),
  qModeLabel: document.getElementById("qModeLabel"),

  finalScore: document.getElementById("finalScore"),
  resultSummary: document.getElementById("resultSummary"),

  progressInner: document.getElementById("progressInner"),
  historyBox: document.getElementById("historyBox"),

  startExamBtn: document.getElementById("startExamBtn"),
  resumeExamBtn: document.getElementById("resumeExamBtn"),
  startWrongOnlyReviewBtn: document.getElementById("startWrongOnlyReviewBtn"),
  startWrongOnlyReviewBtn2: document.getElementById("startWrongOnlyReviewBtn2"),

  goTopBtn: document.getElementById("goTopBtn"),
  goTopBtn2: document.getElementById("goTopBtn2"),
  goTopBtn3: document.getElementById("goTopBtn3"),

  nextBtn: document.getElementById("nextBtn"),
  skipQuestionBtn: document.getElementById("skipQuestionBtn"),

  toggleExamUiBtn: document.getElementById("toggleExamUiBtn"),
  toggleStrictTimeBtn: document.getElementById("toggleStrictTimeBtn"),
  toggleMemoBtn: document.getElementById("toggleMemoBtn"),
  clearMemoBtn: document.getElementById("clearMemoBtn"),

  resetStatsBtn: document.getElementById("resetStatsBtn"),
  clearSavedDataBtn: document.getElementById("clearSavedDataBtn"),

  memoCanvas: document.getElementById("memoCanvas"),
  saveStatus: document.getElementById("saveStatus")
};

/* =========================
   統計
========================= */
const stats = {
  weakness: {
    "計算精度": 0,
    "方針切替": 0,
    "時間不足": 0
  },
  stage: {
    "第1問": { total: 0, correct: 0 },
    "第2問": { total: 0, correct: 0 },
    "第3問": { total: 0, correct: 0 },
    "第4問": { total: 0, correct: 0 }
  },
  reviewTotal: 0,
  reviewCorrect: 0,
  solvedWrongCount: 0,
  todayReviewCount: 0,
  times: [],
  history: []
};

/* =========================
   保存 / 読込
========================= */
function save() {
  const data = {
    state: {
      ...state,
      wrongSet: [...state.wrongSet],
      solvedWrong: [...state.solvedWrong]
    },
    stats
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (el.saveStatus) el.saveStatus.textContent = "保存状態: 自動保存済み";
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (data.state) {
      state = {
        ...state,
        ...data.state,
        wrongSet: new Set(data.state.wrongSet || []),
        solvedWrong: new Set(data.state.solvedWrong || [])
      };
    }
    if (data.stats) {
      Object.assign(stats, data.stats);
    }
  } catch (e) {
    console.error(e);
  }
}

function bindPress(element, handler) {
  if (!element) return;

  let touched = false;

  element.addEventListener("touchend", (e) => {
    e.preventDefault();
    touched = true;
    handler(e);
    setTimeout(() => {
      touched = false;
    }, 300);
  }, { passive: false });

  element.addEventListener("click", (e) => {
    if (touched) return;
    handler(e);
  });
}
/* =========================
   補助
========================= */
function getCurrentList() {
  return state.review ? state.wrong : questions;
}

function getCurrentQuestion() {
  return getCurrentList()[state.i];
}

function updateTopWeak() {
  const entries = Object.entries(stats.weakness).sort((a, b) => b[1] - a[1]);
  el.topWeak.textContent = entries[0][1] === 0 ? "未判定" : entries[0][0];
}

function updateStageRates() {
  const stageNames = ["第1問", "第2問", "第3問", "第4問"];
  stageNames.forEach((stageName, idx) => {
    const s = stats.stage[stageName];
    const rate = s.total === 0 ? 0 : Math.round((s.correct / s.total) * 100);
    el[`stageRate${idx}`].textContent = `${rate}%`;
  });
}

function updateHistory() {
  if (!stats.history.length) {
    el.historyBox.innerHTML = `<div class="history-item">まだ履歴がありません。</div>`;
    return;
  }

  el.historyBox.innerHTML = stats.history.slice(0, 20).map(item => `
    <div class="history-item">
      <strong>${item.time}</strong><br>
      ${item.text}
    </div>
  `).join("");
}

function addHistory(text) {
  stats.history.unshift({
    time: new Date().toLocaleString("ja-JP"),
    text
  });

  if (stats.history.length > 50) {
    stats.history = stats.history.slice(0, 50);
  }
  updateHistory();
}

function updateProgress() {
  const list = getCurrentList();
  if (!list.length) {
    el.progressInner.style.width = "0%";
    return;
  }
  const pct = Math.round((state.i / list.length) * 100);
  el.progressInner.style.width = `${pct}%`;
}

function updateDashboard() {
  el.correctCnt.textContent = state.correct;
  el.totalCnt.textContent = state.total;
  el.rateCnt.textContent =
    state.total === 0 ? "0%" : `${Math.round((state.correct / state.total) * 100)}%`;

  el.avgCnt.textContent =
    stats.times.length === 0
      ? "0"
      : (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(1);

  el.wCalc.textContent = stats.weakness["計算精度"];
  el.wSwitch.textContent = stats.weakness["方針切替"];
  el.wTime.textContent = stats.weakness["時間不足"];
  updateTopWeak();

  updateStageRates();

  el.todayReviewCount.textContent = stats.todayReviewCount;
  el.reviewRate.textContent =
    stats.reviewTotal === 0 ? "0%" : `${Math.round((stats.reviewCorrect / stats.reviewTotal) * 100)}%`;
  el.clearedCount.textContent = stats.solvedWrongCount;

  el.toggleExamUiBtn.textContent =
    state.uiMode === "normal" ? "本番UIに切り替え" : "通常UIに戻す";

  el.toggleStrictTimeBtn.textContent =
    state.strictTime ? "制限時間: 厳格" : "制限時間: 通常";
}

/* =========================
   UI切り替え
========================= */
function applyUiMode() {
  document.body.classList.toggle("real-exam-ui", state.uiMode === "exam");
}

function goTop() {
  clearInterval(state.timerId);
  document.body.classList.remove("exam-mode");
  el.questionPanel.style.display = "none";
  el.resultBox.style.display = "none";
}

/* =========================
   問題表示
========================= */
