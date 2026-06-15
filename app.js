let state = {
  i: 0,
  total: 0,
  correct: 0,
  review: false,
  wrong: [],
  wrongSet: new Set(),
  finishedWrong: new Set(),
  timerId: null,
  remaining: 60
};
let uiMode = "normal"; // normal / exam
let strictTime = false;
/* =========================
   要素取得
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

  memoCanvas: document.getElementById("memoCanvas")
};

const STORAGE_KEY = "kyotsu_math_ia_v2";

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
   保存
========================= */
function save() {
  const data = {
    state: {
      ...state,
      wrongSet: [...state.wrongSet],
      finishedWrong: [...state.finishedWrong]
    },
    stats
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const saveStatus = document.getElementById("saveStatus");
  if (saveStatus) saveStatus.textContent = "保存状態: 自動保存済み";
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
        finishedWrong: new Set(data.state.finishedWrong || [])
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
  const map = ["第1問", "第2問", "第3問", "第4問"];
  map.forEach((stageName, idx) => {
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
}

function updateProgress() {
  const list = getCurrentList();
  if (!list.length) {
    el.progressInner.style.width = "0%";
    return;
  }
  const pct = Math.round(((state.i) / list.length) * 100);
  el.progressInner.style.width = `${pct}%`;
}

function resetFeedback() {
  el.feedback.className = "feedback";
  el.feedback.style.display = "none";
  el.feedback.innerHTML = "";
}

/* =========================
   表示
========================= */
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


if(strictTime){
  state.remaining = 30; // 厳しくする
}else{
  state.remaining = state.review ? 40 : 60;
}

  startTimer();
  updateProgress();
  updateDashboard();
  save();
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

  const elapsed = 60 - state.remaining;
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
      if (!state.finishedWrong.has(q.id)) {
        state.finishedWrong.add(q.id);
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

function skipQuestion() {
  clearInterval(state.timerId);
  const q = getCurrentQuestion();
  if (!q) return;

  state.total++;
  stats.weakness["時間不足"]++;
  stats.stage[q.stage].total++;
  stats.times.push(60 - state.remaining > 0 ? 60 - state.remaining : 1);

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

/* =========================
   終了
========================= */
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
   タイマー
========================= */
function startTimer() {
  clearInterval(state.timerId);

  const timer = el.timer;
  timer.className = "timer";
  timer.textContent = `${state.remaining}s`;

  state.timerId = setInterval(() => {
    state.remaining -= 1;
    timer.textContent = `${state.remaining}s`;

    if (state.remaining <= 10) {
      timer.className = "timer danger";
    } else if (state.remaining <= 20) {
      timer.className = "timer warning";
    } else {
      timer.className = "timer";
    }

    if (state.remaining <= 0) {
      clearInterval(state.timerId);
      timeoutQuestion();
    }
  }, 1000);
}

function timeoutQuestion() {
  const q = getCurrentQuestion();
  if (!q) return;

  state.total++;
  stats.weakness["時間不足"]++;
  stats.stage[q.stage].total++;
  stats.times.push(60);

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

/* =========================
   メモ
========================= */
const canvas = el.memoCanvas;
const ctx = canvas.getContext("2d");

ctx.strokeStyle = "#000";
ctx.lineWidth = 3;
ctx.lineCap = "round";

let drawing = false;

canvas.addEventListener("mousedown", e => {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener("mousemove", e => {
  if (!drawing) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
});

window.addEventListener("mouseup", () => {
  drawing = false;
});

/* touch */
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.touches[0].clientX - rect.left;
  const y = e.touches[0].clientY - rect.top;
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(x, y);
}, { passive:false });

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.touches[0].clientX - rect.left;
  const y = e.touches[0].clientY - rect.top;
  ctx.lineTo(x, y);
  ctx.stroke();
}, { passive:false });

window.addEventListener("touchend", () => {
  drawing = false;
});

/* =========================
   操作
========================= */
function startExam() {
  state.review = false;
  state.i = 0;
  document.body.classList.add("exam-mode");
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
  document.body.classList.add("exam-mode");
  show();
}

function resumeExam() {
  document.body.classList.add("exam-mode");
  show();
}

function goTop() {
  clearInterval(state.timerId);
  document.body.classList.remove("exam-mode");
  el.questionPanel.style.display = "none";
  el.resultBox.style.display = "none";
}

function clearMemo() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function toggleMemo() {
  canvas.style.display = canvas.style.display === "none" ? "block" : "block";
}

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
el.startExamBtn.addEventListener("click", startExam);
el.resumeExamBtn.addEventListener("click", resumeExam);
el.startWrongOnlyReviewBtn.addEventListener("click", startWrongOnlyReview);
el.startWrongOnlyReviewBtn2.addEventListener("click", startWrongOnlyReview);

el.nextBtn.addEventListener("click", nextQuestion);
el.skipQuestionBtn.addEventListener("click", skipQuestion);

el.goTopBtn.addEventListener("click", goTop);
el.goTopBtn2.addEventListener("click", goTop);
el.goTopBtn3.addEventListener("click", goTop);

el.clearMemoBtn.addEventListener("click", clearMemo);
el.toggleMemoBtn.addEventListener("click", toggleMemo);

el.resetStatsBtn.addEventListener("click", resetStats);
el.clearSavedDataBtn.addEventListener("click", clearSavedData);

el.toggleExamUiBtn.addEventListener("click", () => {
  if(uiMode === "normal"){
    document.body.classList.add("real-exam-ui");
    uiMode = "exam";
  }else{
    document.body.classList.remove("real-exam-ui");
    uiMode = "normal";
  }
});

el.toggleStrictTimeBtn.addEventListener("click", () => {
  strictTime = !strictTime;

  el.toggleStrictTimeBtn.textContent =
    strictTime ? "制限時間: 厳格" : "制限時間: 通常";
});

/* 使わないけど落ちないように */
el.toggleExamUiBtn.addEventListener("click", () => {});
el.toggleStrictTimeBtn.addEventListener("click", () => {});

/* 初期化 */
load();
updateDashboard();
updateHistory();
goTop();
