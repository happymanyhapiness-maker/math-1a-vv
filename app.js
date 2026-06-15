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
function resetFeedback() {
  el.feedback.className = "feedback";
  el.feedback.style.display = "none";
  el.feedback.innerHTML = "";
}

function show() {
  const q = getCurrentQuestion();
  if (!q) return;

  el.questionPanel.style.display = "block";
  el.resultBox.style.display = "none";

  el.qStageLabel.textContent = q.stage;
  el.qScoreLabel.textContent = `配点 ${q.score}点`;
  el.qWeakLabel.textContent = `弱点軸: ${q.weakness}`;
  el.qModeLabel.textContent = state.review ? "復習モード" : "本番モード";

  el.questionText.innerHTML = q.q;
  document.getElementById("svgBox").innerHTML = q.svg || "";

  el.optionsBox.innerHTML = q.a.map((choice, idx) => `
    <button class="option" data-index="${idx}">
      ${String.fromCharCode(65 + idx)}. ${choice}
    </button>
  `).join("");

  document.querySelectorAll(".option").forEach((btn, idx) => {
    btn.addEventListener("click", () => answer(idx, btn));
  });

  resetFeedback();
  el.nextBtn.style.display = "none";

  startTimer();
  updateProgress();
  updateDashboard();
  save();

  if (!state.review) {
    document.body.classList.add("exam-mode");
  }
}

/* =========================
   タイマー
========================= */
function getBaseTime() {
  if (state.strictTime) return 30;
  return state.review ? 40 : 60;
}

function startTimer() {
  clearInterval(state.timerId);

  state.remaining = getBaseTime();
  el.timer.className = "timer";
  el.timer.textContent = `${state.remaining}s`;

  state.timerId = setInterval(() => {
    state.remaining -= 1;
    el.timer.textContent = `${state.remaining}s`;

    if (state.remaining <= 10) {
      el.timer.className = "timer danger";
    } else if (state.remaining <= 20) {
      el.timer.className = "timer warning";
    } else {
      el.timer.className = "timer";
    }

    if (state.remaining <= 0) {
      clearInterval(state.timerId);
      timeoutQuestion();
    }
  }, 1000);
}

/* =========================
   回答
========================= */
function answer(index, buttonEl) {
  clearInterval(state.timerId);
  const q = getCurrentQuestion();
  if (!q) return;

  document.querySelectorAll(".option").forEach(btn => btn.classList.remove("selected"));
  buttonEl.classList.add("selected");

  state.total++;
  stats.stage[q.stage].total++;

  const elapsed = getBaseTime() - state.remaining;
  stats.times.push(elapsed > 0 ? elapsed : 1);

  const ok = index === q.correct;

  if (state.review) {
    stats.reviewTotal++;
  }

  if (ok) {
    state.correct++;
    stats.stage[q.stage].correct++;

    if (state.review) {
      stats.reviewCorrect++;
      if (!state.solvedWrong.has(q.id)) {
        state.solvedWrong.add(q.id);
        stats.solvedWrongCount++;
      }
      state.wrong = state.wrong.filter(item => item.id !== q.id);
    }

    buttonEl.classList.add("correctFlash");
    el.feedback.className = "feedback ok";
    el.feedback.style.display = "block";
    el.feedback.innerHTML = `<strong>正解です。</strong><br>${q.explain}`;
    addHistory(`${q.stage} / 正解 / 加点: ${q.score}`);
  } else {
    stats.weakness[q.weakness]++;

    if (!state.review && !state.wrongSet.has(q.id)) {
      state.wrong.push(q);
      state.wrongSet.add(q.id);
    }

    el.feedback.className = "feedback ng";
    el.feedback.style.display = "block";
    el.feedback.innerHTML = `<strong>不正解です。</strong><br>${q.explain}`;
    addHistory(`${q.stage} / 不正解 / 弱点軸: ${q.weakness}`);
  }

  document.querySelectorAll(".option").forEach(btn => btn.disabled = true);
  el.nextBtn.style.display = "inline-block";

  updateDashboard();
  save();
}

function timeoutQuestion() {
  const q = getCurrentQuestion();
  if (!q) return;

  state.total++;
  stats.weakness["時間不足"]++;
  stats.stage[q.stage].total++;
  stats.times.push(getBaseTime());

  if (state.review) {
    stats.reviewTotal++;
  } else if (!state.wrongSet.has(q.id)) {
    state.wrong.push(q);
    state.wrongSet.add(q.id);
  }

  el.feedback.className = "feedback ng";
  el.feedback.style.display = "block";
