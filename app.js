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
  svgBox: document.getElementById("svgBox"),
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
      if (data.stats.weakness) stats.weakness = data.stats.weakness;
      if (data.stats.stage) stats.stage = data.stats.stage;
      if (typeof data.stats.reviewTotal === "number") stats.reviewTotal = data.stats.reviewTotal;
      if (typeof data.stats.reviewCorrect === "number") stats.reviewCorrect = data.stats.reviewCorrect;
      if (typeof data.stats.solvedWrongCount === "number") stats.solvedWrongCount = data.stats.solvedWrongCount;
      if (typeof data.stats.todayReviewCount === "number") stats.todayReviewCount = data.stats.todayReviewCount;
      if (Array.isArray(data.stats.times)) stats.times = data.stats.times;
      if (Array.isArray(data.stats.history)) stats.history = data.stats.history;
    }
  } catch (e) {
    console.error(e);
  }
}

/* =========================
   iPad / touch 対応
========================= */
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
    const target = el[`stageRate${idx}`];
    if (target) target.textContent = `${rate}%`;
  });
}

function updateHistory() {
  if (!el.historyBox) return;

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
  if (!el.progressInner) return;

  if (!list.length) {
    el.progressInner.style.width = "0%";
    return;
  }

  const pct = Math.round((state.i / list.length) * 100);
  el.progressInner.style.width = `${pct}%`;
}

function updateDashboard() {
  if (el.correctCnt) el.correctCnt.textContent = state.correct;
  if (el.totalCnt) el.totalCnt.textContent = state.total;
  if (el.rateCnt) {
    el.rateCnt.textContent =
      state.total === 0 ? "0%" : `${Math.round((state.correct / state.total) * 100)}%`;
  }

  if (el.avgCnt) {
    el.avgCnt.textContent =
      stats.times.length === 0
        ? "0"
        : (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(1);
  }

  if (el.wCalc) el.wCalc.textContent = stats.weakness["計算精度"];
  if (el.wSwitch) el.wSwitch.textContent = stats.weakness["方針切替"];
  if (el.wTime) el.wTime.textContent = stats.weakness["時間不足"];

  updateTopWeak();
  updateStageRates();

  if (el.todayReviewCount) el.todayReviewCount.textContent = stats.todayReviewCount;
  if (el.reviewRate) {
    el.reviewRate.textContent =
      stats.reviewTotal === 0 ? "0%" : `${Math.round((stats.reviewCorrect / stats.reviewTotal) * 100)}%`;
  }
  if (el.clearedCount) el.clearedCount.textContent = stats.solvedWrongCount;

  if (el.toggleExamUiBtn) {
    el.toggleExamUiBtn.textContent =
      state.uiMode === "normal" ? "本番UIに切り替え" : "通常UIに戻す";
  }

  if (el.toggleStrictTimeBtn) {
    el.toggleStrictTimeBtn.textContent =
      state.strictTime ? "制限時間: 厳格" : "制限時間: 通常";
  }

  if (el.toggleMemoBtn && el.memoCanvas) {
    el.toggleMemoBtn.textContent =
      el.memoCanvas.style.display === "none" ? "手書きメモを表示" : "手書きメモを非表示";
  }
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
  if (el.questionPanel) el.questionPanel.style.display = "none";
  if (el.resultBox) el.resultBox.style.display = "none";
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
  if (el.svgBox) el.svgBox.innerHTML = q.svg || "";

  el.optionsBox.innerHTML = q.a.map((choice, idx) => `
    <button class="option" data-index="${idx}">
      ${String.fromCharCode(65 + idx)}. ${choice}
    </button>
  `).join("");

  document.querySelectorAll(".option").forEach((btn, idx) => {
    bindPress(btn, () => answer(idx, btn));
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
  el.feedback.innerHTML = `<strong>時間切れです。</strong><br>${q.explain}`;

  document.querySelectorAll(".option").forEach(btn => btn.disabled = true);
  el.nextBtn.style.display = "inline-block";

  addHistory(`${q.stage} / 時間切れ / 弱点軸: 時間不足`);
  updateDashboard();
  save();
}

function skipQuestion() {
  clearInterval(state.timerId);

  const q = getCurrentQuestion();
  if (!q) return;

  state.total++;
  stats.weakness["時間不足"]++;
  stats.stage[q.stage].total++;
  stats.times.push(getBaseTime() - state.remaining > 0 ? getBaseTime() - state.remaining : 1);

  if (!state.review && !state.wrongSet.has(q.id)) {
    state.wrong.push(q);
    state.wrongSet.add(q.id);
  }

  el.feedback.className = "feedback ng";
  el.feedback.style.display = "block";
  el.feedback.innerHTML = `<strong>この設問を飛ばしました。</strong><br>${q.explain}`;

  document.querySelectorAll(".option").forEach(btn => btn.disabled = true);
  el.nextBtn.style.display = "inline-block";

  addHistory(`${q.stage} / スキップ / 弱点軸: 時間不足`);
  updateDashboard();
  save();
}

function nextQuestion() {
  state.i++;

  if (state.review) {
    if (state.i >= state.wrong.length) {
      finishReview();
      return;
    }
  } else {
    if (state.i >= questions.length) {
      finishExam();
      return;
    }
  }

  show();
}

/* =========================
   開始 / 終了
========================= */
function startExam() {
  state.review = false;
  state.i = 0;
  show();
}

function resumeExam() {
  if (state.i >= getCurrentList().length) {
    state.i = 0;
  }
  show();
}

function startWrongOnlyReview() {
  if (state.wrong.length === 0) {
    alert("再挑戦できる間違い問題がありません。");
    return;
  }

  state.review = true;
  state.i = 0;
  stats.todayReviewCount += state.wrong.length;
  show();
}

function finishExam() {
  clearInterval(state.timerId);
  document.body.classList.remove("exam-mode");

  el.questionPanel.style.display = "none";
  el.resultBox.style.display = "block";
  el.finalScore.textContent = `${state.correct} / ${questions.length}`;
  el.resultSummary.innerHTML = `
    正答率は <strong>${state.total === 0 ? 0 : Math.round((state.correct / state.total) * 100)}%</strong> でした。<br>
    最重要課題は <strong>${el.topWeak.textContent}</strong> です。
  `;
  addHistory(`試験終了 / 正答 ${state.correct} / ${questions.length}`);
  save();
}

function finishReview() {
  clearInterval(state.timerId);
  document.body.classList.remove("exam-mode");

  el.questionPanel.style.display = "none";
  el.resultBox.style.display = "block";
  el.finalScore.textContent = "復習完了";
  el.resultSummary.innerHTML = `
    復習モード正答率は <strong>${stats.reviewTotal === 0 ? 0 : Math.round((stats.reviewCorrect / stats.reviewTotal) * 100)}%</strong> でした。<br>
    完全に直した問題数は <strong>${stats.solvedWrongCount}</strong> 件です。
  `;
  addHistory(`復習終了 / 正答率 ${stats.reviewTotal === 0 ? 0 : Math.round((stats.reviewCorrect / stats.reviewTotal) * 100)}%`);
  save();
}

/* =========================
   メモ
========================= */
const canvas = el.memoCanvas;
const ctx = canvas.getContext("2d");

ctx.strokeStyle = "#000";
ctx.lineWidth = 3;
ctx.lineCap = "round";

let drawing = false;

function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.touches[0].clientX - rect.left,
    y: e.touches[0].clientY - rect.top
  };
}

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
});

window.addEventListener("mouseup", () => {
  drawing = false;
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const pos = getTouchPos(e);
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!drawing) return;
  const pos = getTouchPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}, { passive: false });

window.addEventListener("touchend", () => {
  drawing = false;
});

function clearMemo() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function toggleMemo() {
  canvas.style.display = canvas.style.display === "none" ? "block" : "none";
  updateDashboard();
}

/* =========================
   その他
========================= */
function resetStats() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function clearSavedData() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* =========================
   イベント
========================= */
bindPress(el.startExamBtn, startExam);
bindPress(el.resumeExamBtn, resumeExam);
bindPress(el.startWrongOnlyReviewBtn, startWrongOnlyReview);
bindPress(el.startWrongOnlyReviewBtn2, startWrongOnlyReview);

bindPress(el.nextBtn, nextQuestion);
bindPress(el.skipQuestionBtn, skipQuestion);

bindPress(el.goTopBtn, goTop);
bindPress(el.goTopBtn2, goTop);
bindPress(el.goTopBtn3, goTop);

bindPress(el.clearMemoBtn, clearMemo);
bindPress(el.toggleMemoBtn, toggleMemo);

bindPress(el.resetStatsBtn, resetStats);
bindPress(el.clearSavedDataBtn, clearSavedData);

bindPress(el.toggleExamUiBtn, () => {
  if (state.uiMode === "normal") {
    state.uiMode = "exam";
  } else {
    state.uiMode = "normal";
  }
  applyUiMode();
  updateDashboard();
  save();
});

bindPress(el.toggleStrictTimeBtn, () => {
  state.strictTime = !state.strictTime;
  updateDashboard();
  save();
});

/* =========================
   初期化
========================= */
load();
applyUiMode();
updateDashboard();
updateHistory();
goTop();
