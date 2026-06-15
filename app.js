const STORAGE_KEY = "kyotsu_exam_ipad_v1";

const defaultState = () => ({
  currentStage: 0,
  currentItem: 0,
  currentScore: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  times: [],
  weak: { "計算精度":0, "方針切替":0, "時間不足":0 },
  history: [],
  examInProgress: false,
  finished: false,
  examStartAt: null,
  questionStartAt: null,
  remaining: 0,
  wrongItems: [],
  wrongCountMap: {},
  clearedItems: {},
  reviewMode: false,
  reviewQueue: [],
  reviewIndex: 0,
  reviewAnswered: 0,
  reviewCorrect: 0,
  strictTime: false,
  realExamUi: false,
  stageStats: {
    0:{answered:0, correct:0},
    1:{answered:0, correct:0},
    2:{answered:0, correct:0},
    3:{answered:0, correct:0}
  },
  dailyReviewCountByDate: {}
});

let state = defaultState();
let timerId = null;

const $ = (id) => document.getElementById(id);

/* ---------- 保存 ---------- */
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  $("saveStatus").textContent = "保存状態: 自動保存済み";
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try{
    state = Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){
    console.error(e);
  }
}

/* ---------- utility ---------- */
function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getTodayReviewCount(){
  return state.dailyReviewCountByDate[todayKey()] || 0;
}
function addTodayReviewCount(n){
  const key = todayKey();
  state.dailyReviewCountByDate[key] = (state.dailyReviewCountByDate[key] || 0) + n;
}
function getTopWeak(){
  const entries = Object.entries(state.weak).sort((a,b)=>b[1]-a[1]);
  return entries[0][1] === 0 ? "未判定" : entries[0][0];
}
function getReviewRate(){
  if(state.reviewAnswered === 0) return 0;
  return Math.round((state.reviewCorrect / state.reviewAnswered) * 100);
}
function getStageRate(stage){
  const s = state.stageStats[stage];
  if(!s || s.answered === 0) return 0;
  return Math.round((s.correct / s.answered) * 100);
}
function wrongItemKey(stageIndex, itemIndex){
  return `s${stageIndex}_q${itemIndex}`;
}
function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- dashboard ---------- */
function refreshDashboard(){
  $("correctCnt").textContent = state.totalCorrect;
  $("totalCnt").textContent = state.totalAnswered;

  const rate = state.totalAnswered ? Math.round(state.totalCorrect / state.totalAnswered * 100) : 0;
  $("rateCnt").textContent = `${rate}%`;

  const avg = state.times.length
    ? (state.times.reduce((a,b)=>a+b,0)/state.times.length).toFixed(1)
    : 0;
  $("avgCnt").textContent = avg;

  $("wCalc").textContent = state.weak["計算精度"];
  $("wSwitch").textContent = state.weak["方針切替"];
  $("wTime").textContent = state.weak["時間不足"];
  $("topWeak").textContent = getTopWeak();

  $("todayReviewCount").textContent = getTodayReviewCount();
  $("reviewRate").textContent = `${getReviewRate()}%`;
  $("clearedCount").textContent = Object.keys(state.clearedItems).length;

  $("stageRate0").textContent = `${getStageRate(0)}%`;
  $("stageRate1").textContent = `${getStageRate(1)}%`;
  $("stageRate2").textContent = `${getStageRate(2)}%`;
  $("stageRate3").textContent = `${getStageRate(3)}%`;

  $("toggleStrictTimeBtn").textContent = `制限時間: ${state.strictTime ? "厳しめ" : "通常"}`;
  $("toggleExamUiBtn").textContent = state.realExamUi ? "通常UIに戻す" : "本番UIに切り替え";
  $("toggleMemoBtn").textContent = memo.visible ? "手書きメモを非表示" : "手書きメモを表示";
}

function renderHistory(){
  const box = $("historyBox");
  if(!state.history.length){
    box.innerHTML = `<div class="history-item">まだ履歴がありません。</div>`;
    return;
  }
  box.innerHTML = state.history.slice(0,20).map(h => `
    <div class="history-item">
      <strong>${h.time}</strong><br>
      ${h.stage} / ${h.result}<br>
      弱点軸: ${h.weakness} / 加点: ${h.score}
    </div>
  `).join("");
}

function updateProgress(){
  if(state.reviewMode){
    const total = Math.max(1, state.reviewQueue.length);
    const pct = Math.round((state.reviewIndex / total) * 100);
    $("progressInner").style.width = `${pct}%`;
    return;
  }

  const totalQuestions = exam.reduce((sum, s) => sum + s.items.length, 0);
  let answeredBeforeCurrent = 0;
  for(let i=0;i<state.currentStage;i++){
    answeredBeforeCurrent += exam[i].items.length;
  }
  answeredBeforeCurrent += state.currentItem;
  const pct = Math.round((answeredBeforeCurrent / totalQuestions) * 100);
  $("progressInner").style.width = `${pct}%`;
}

/* ---------- modes ---------- */
function setExamMode(on){
  document.body.classList.toggle("exam-mode", on);
}
function setRealExamUi(on){
  state.realExamUi = on;
  document.body.classList.toggle("real-exam-ui", on);
  refreshDashboard();
  saveState();
}
function hidePanels(){
  $("questionPanel").style.display = "none";
  $("resultBox").style.display = "none";
  for(let i=0;i<4;i++){
    const card = $(`stageCard${i}`);
    if(card) card.classList.remove("active");
  }
  $("progressInner").style.width = "0%";
}
function goTopPage(){
  clearInterval(timerId);
  setExamMode(false);
  state.examInProgress = false;
  state.reviewMode = false;
  hidePanels();
  saveState();
}

/* ---------- current question ---------- */
function getCurrentQuestion(){
  if(state.reviewMode) return state.reviewQueue[state.reviewIndex];
  return exam[state.currentStage].items[state.currentItem];
}
function getCurrentStageTitle(){
  return state.reviewMode ? "復習モード" : exam[state.currentStage].title;
}

/* ---------- wrong / cleared ---------- */
function markWrongItem(){
  if(state.reviewMode) return;
  const key = wrongItemKey(state.currentStage, state.currentItem);

  state.wrongCountMap[key] = (state.wrongCountMap[key] || 0) + 1;

  const exists = state.wrongItems.some(x => x.key === key);
  if(!exists){
    const src = exam[state.currentStage].items[state.currentItem];
    state.wrongItems.push({
      key,
      sourceStage: state.currentStage,
      sourceItem: state.currentItem,
      title: exam[state.currentStage].title,
      ...clone(src)
    });
  }
}
function clearSolvedWrongItem(question){
  if(!question || !question.key) return;
  state.wrongItems = state.wrongItems.filter(item => item.key !== question.key);
  state.clearedItems[question.key] = true;
}

/* ---------- start / resume ---------- */
function startExam(){
  clearInterval(timerId);
  setExamMode(true);

  state.reviewMode = false;
  state.finished = false;
  state.examInProgress = true;
  state.currentStage = 0;
  state.currentItem = 0;
  state.currentScore = 0;
  state.examStartAt = Date.now();

  loadQuestion(false);
  saveState();
}

function resumeExam(){
  if(!state.examInProgress && !state.reviewMode){
    alert("再開できるデータがありません。");
    return;
  }
  if(state.finished && !state.reviewMode){
    alert("前回の試験は終了しています。");
    return;
  }
  setExamMode(true);
  loadQuestion(true);
}

/* ---------- review ---------- */
function startWrongOnlyReview(){
  if(!state.wrongItems.length){
    alert("再挑戦できる間違い問題がありません。");
    return;
  }

  clearInterval(timerId);
  setExamMode(true);

  const sorted = [...state.wrongItems].sort((a,b)=>{
    const ca = state.wrongCountMap[a.key] || 0;
    const cb = state.wrongCountMap[b.key] || 0;
    return cb - ca;
  });

  state.reviewMode = true;
  state.finished = false;
  state.examInProgress = true;
  state.reviewQueue = sorted.map(x => ({...x}));
  state.reviewIndex = 0;
  state.reviewAnswered = 0;
  state.reviewCorrect = 0;

  addTodayReviewCount(state.reviewQueue.length);

  loadQuestion(false);
  saveState();
}

function finishReview(){
  clearInterval(timerId);
  state.reviewMode = false;
  state.examInProgress = false;
  setExamMode(false);

  $("questionPanel").style.display = "none";
  $("resultBox").style.display = "block";
  $("finalScore").textContent = "復習完了";
  $("resultSummary").innerHTML = `
    復習モードの正答率は <strong>${getReviewRate()}%</strong> でした。<br>
    今日の復習件数は <strong>${getTodayReviewCount()}</strong> 件です。<br>
    完全に直した問題数は <strong>${Object.keys(state.clearedItems).length}</strong> 件です。
  `;

  refreshDashboard();
  renderHistory();
  saveState();
}

/* ---------- rendering ---------- */
function loadQuestion(isResume=false){
  $("questionPanel").style.display = "block";
  $("resultBox").style.display = "none";

  const q = getCurrentQuestion();
  const stageTitle = getCurrentStageTitle();

  for(let i=0;i<4;i++){
    const card = $(`stageCard${i}`);
    if(card){
      card.classList.toggle("active", !state.reviewMode && i === state.currentStage);
    }
  }

  $("qStageLabel").textContent = stageTitle;
  $("qScoreLabel").textContent = `配点 ${q.score}点`;
  $("qWeakLabel").textContent = `弱点軸: ${q.weakness}`;
  $("qModeLabel").textContent = state.reviewMode ? "復習モード" : "本番モード";
  $("questionText").textContent = q.prompt;

  $("optionsBox").innerHTML = q.options.map((opt, idx) =>
    `<button class="option" data-index="${idx}">${String.fromCharCode(65+idx)}. ${opt}</button>`
  ).join("");

  document.querySelectorAll(".option").forEach((btn, idx) => {
    btn.addEventListener("click", () => submitAnswer(idx, btn));
  });

  const fb = $("feedback");
  fb.className = "feedback";
  fb.style.display = "none";
  fb.innerHTML = "";

  $("nextBtn").style.display = "none";

  const baseTime = state.reviewMode ? 55 : ([65,65,75,75][state.currentStage] || 70);
  const effectiveTime = state.strictTime ? Math.max(35, baseTime - 15) : baseTime;

  state.remaining = isResume && state.remaining > 0 ? state.remaining : effectiveTime;
  state.questionStartAt = Date.now();

  startTimer();
  updateProgress();
  refreshDashboard();
  saveState();
}

function startTimer(){
  clearInterval(timerId);
  $("timer").textContent = `${state.remaining}s`;
  timerId = setInterval(() => {
    state.remaining -= 1;
    $("timer").textContent = `${state.remaining}s`;
    if(state.remaining <= 0){
      clearInterval(timerId);
      timeoutQuestion();
    }
  }, 1000);
}

/* ---------- answer ---------- */
function disableOptions(){
  document.querySelectorAll(".option").forEach(btn => btn.disabled = true);
}

function flashCorrectOption(buttonEl){
  if(!buttonEl) return;
  buttonEl.classList.add("selected");
  buttonEl.classList.add("correctFlash");
  setTimeout(() => {
    buttonEl.classList.remove("correctFlash");
  }, 950);
}

function registerStageStats(ok){
  if(state.reviewMode) return;
  const s = state.stageStats[state.currentStage];
  s.answered += 1;
  if(ok) s.correct += 1;
}

function timeoutQuestion(){
  const q = getCurrentQuestion();

  state.totalAnswered += 1;
  state.weak["時間不足"] += 1;
  state.times.push(Math.max(1, Math.round((Date.now() - state.questionStartAt)/1000)));

  if(state.reviewMode){
    state.reviewAnswered += 1;
  }else{
    registerStageStats(false);
    markWrongItem();
  }

  state.history.unshift({
    time: new Date().toLocaleString("ja-JP"),
    stage: getCurrentStageTitle(),
    result: "時間切れ",
    weakness: "時間不足",
    score: 0
  });

  const fb = $("feedback");
  fb.className = "feedback ng";
  fb.style.display = "block";
  fb.innerHTML = `<strong>時間切れです。</strong><br>${q.explain}`;

  disableOptions();
  $("nextBtn").style.display = "inline-block";

  refreshDashboard();
  renderHistory();
  saveState();
}

function submitAnswer(index, buttonEl){
  clearInterval(timerId);

  const q = getCurrentQuestion();
  const ok = index === q.answer;
  const elapsed = Math.max(1, Math.round((Date.now() - state.questionStartAt)/1000));

  document.querySelectorAll(".option").forEach(btn => btn.classList.remove("selected"));
  buttonEl.classList.add("selected");

  state.totalAnswered += 1;
  state.times.push(elapsed);

  if(state.reviewMode){
    state.reviewAnswered += 1;
  }

  if(ok){
    state.totalCorrect += 1;
    state.currentScore += q.score;

    if(state.reviewMode){
      state.reviewCorrect += 1;
      clearSolvedWrongItem(q);
    }else{
      registerStageStats(true);
    }

    flashCorrectOption(buttonEl);
  }else{
    state.weak[q.weakness] += 1;
    if(!state.reviewMode){
      registerStageStats(false);
      markWrongItem();
    }
  }

  state.history.unshift({
    time: new Date().toLocaleString("ja-JP"),
    stage: getCurrentStageTitle(),
    result: ok ? "正解" : "不正解",
    weakness: ok ? "—" : q.weakness,
    score: ok ? q.score : 0
  });

  if(state.history.length > 50) state.history = state.history.slice(0,50);

  const fb = $("feedback");
  fb.className = `feedback ${ok ? "ok" : "ng"}`;
  fb.style.display = "block";
  fb.innerHTML = `
    <strong>${ok ? "正解です。" : "不正解です。"}</strong><br>
    ${q.explain}
  `;

  disableOptions();
  $("nextBtn").style.display = "inline-block";

  refreshDashboard();
  renderHistory();
  saveState();
}

function skipQuestion(){
  if(!state.examInProgress && !state.reviewMode) return;
  clearInterval(timerId);

  state.totalAnswered += 1;
  state.weak["時間不足"] += 1;
  state.times.push(Math.max(1, Math.round((Date.now() - state.questionStartAt)/1000)));

  if(state.reviewMode){
    state.reviewAnswered += 1;
  }else{
    registerStageStats(false);
    markWrongItem();
  }

  state.history.unshift({
    time: new Date().toLocaleString("ja-JP"),
    stage: getCurrentStageTitle(),
    result: "スキップ",
    weakness: "時間不足",
    score: 0
  });

  if(state.history.length > 50) state.history = state.history.slice(0,50);

  const fb = $("feedback");
  fb.className = "feedback info";
  fb.style.display = "block";
  fb.innerHTML = `
    <strong>この設問を飛ばしました。</strong><br>
    本番でも、止まり続けるより小問を回収する判断が重要です。
  `;

  disableOptions();
  $("nextBtn").style.display = "inline-block";

  refreshDashboard();
  renderHistory();
  saveState();
}

/* ---------- move ---------- */
function nextQuestion(){
  if(state.reviewMode){
    if(state.reviewIndex < state.reviewQueue.length - 1){
      state.reviewIndex += 1;
      loadQuestion();
      return;
    }
    finishReview();
    return;
  }

  const stage = exam[state.currentStage];
  if(state.currentItem < stage.items.length - 1){
    state.currentItem += 1;
    loadQuestion();
    return;
  }

  if(state.currentStage < exam.length - 1){
    state.currentStage += 1;
    state.currentItem = 0;
    loadQuestion();
    return;
  }

  finishExam();
}

function finishExam(){
  clearInterval(timerId);
  state.examInProgress = false;
  state.finished = true;
  setExamMode(false);
  saveState();

  $("questionPanel").style.display = "none";
  $("resultBox").style.display = "block";
  $("progressInner").style.width = "100%";

  const rate = state.totalAnswered ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
  const avg = state.times.length ? (state.times.reduce((a,b)=>a+b,0)/state.times.length).toFixed(1) : 0;
  const topWeak = getTopWeak();

  $("finalScore").textContent = `${state.currentScore} / 100`;
  $("resultSummary").innerHTML = `
    正答率は <strong>${rate}%</strong>、平均解答時間は <strong>${avg}秒</strong> でした。<br>
    最重要課題は <strong>${topWeak}</strong> です。<br>
    今日の復習件数は <strong>${getTodayReviewCount()}</strong> 件です。<br>
    完全に直した問題数は <strong>${Object.keys(state.clearedItems).length}</strong> 件です。
  `;

  state.history.unshift({
    time: new Date().toLocaleString("ja-JP"),
    stage: "試験全体",
    result: `終了 ${state.currentScore}/100`,
    weakness: topWeak,
    score: state.currentScore
  });

  refreshDashboard();
  renderHistory();
  saveState();
}

/* ---------- memo ---------- */
let memo = {
  canvas:null,
  ctx:null,
  drawing:false,
  lastX:0,
  lastY:0,
  visible:true
};

function setupMemo(){
  const canvas = $("memoCanvas");
  const ratio = window.devicePixelRatio || 1;
  const displayWidth = canvas.width;
  const displayHeight = canvas.height;

  canvas.width = displayWidth * ratio;
  canvas.height = displayHeight * ratio;

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2.2;

  memo.canvas = canvas;
  memo.ctx = ctx;

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    if(e.touches && e.touches[0]){
      return {
        x: e.touches[0].clientX - r.left,
        y: e.touches[0].clientY - r.top
      };
    }
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    };
  };

  const start = (e) => {
    e.preventDefault();
    memo.drawing = true;
    const p = getPos(e);
    memo.lastX = p.x;
    memo.lastY = p.y;
  };

  const move = (e) => {
    if(!memo.drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(memo.lastX, memo.lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    memo.lastX = p.x;
    memo.lastY = p.y;
  };

  const end = () => {
    memo.drawing = false;
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, {passive:false});
  canvas.addEventListener("touchmove", move, {passive:false});
  window.addEventListener("touchend", end);
}

function clearMemo(){
  if(!memo.ctx || !memo.canvas) return;
  memo.ctx.clearRect(0, 0, memo.canvas.width, memo.canvas.height);
}

function toggleMemo(){
  memo.visible = !memo.visible;
  $("memoPanel").style.display = memo.visible ? "block" : "none";
  refreshDashboard();
}

/* ---------- buttons ---------- */
function bindEvents(){
  $("startExamBtn").addEventListener("click", startExam);
  $("resumeExamBtn").addEventListener("click", resumeExam);
  $("startWrongOnlyReviewBtn").addEventListener("click", startWrongOnlyReview);
  $("startWrongOnlyReviewBtn2").addEventListener("click", startWrongOnlyReview);

  $("goTopBtn").addEventListener("click", goTopPage);
  $("goTopBtn2").addEventListener("click", goTopPage);
  $("goTopBtn3").addEventListener("click", goTopPage);

  $("nextBtn").addEventListener("click", nextQuestion);
  $("skipQuestionBtn").addEventListener("click", skipQuestion);

  $("toggleStrictTimeBtn").addEventListener("click", () => {
    state.strictTime = !state.strictTime;
    refreshDashboard();
    saveState();
  });

  $("toggleExamUiBtn").addEventListener("click", () => {
    setRealExamUi(!state.realExamUi);
  });

  $("toggleMemoBtn").addEventListener("click", toggleMemo);
  $("clearMemoBtn").addEventListener("click", clearMemo);

  $("resetStatsBtn").addEventListener("click", () => {
    if(!confirm("学習ログをリセットします。よろしいですか？")) return;
    const keepUi = state.realExamUi;
    state = defaultState();
    state.realExamUi = keepUi;
    document.body.classList.toggle("real-exam-ui", keepUi);
    setExamMode(false);
    hidePanels();
    clearMemo();
    refreshDashboard();
    renderHistory();
    saveState();
  });

  $("clearSavedDataBtn").addEventListener("click", () => {
    if(!confirm("保存済みデータを削除します。よろしいですか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    const keepUi = document.body.classList.contains("real-exam-ui");
    state = defaultState();
    state.realExamUi = keepUi;
    document.body.classList.toggle("real-exam-ui", keepUi);
    setExamMode(false);
    hidePanels();
    clearMemo();
    refreshDashboard();
    renderHistory();
    $("saveStatus").textContent = "保存状態: 削除しました";
  });
}

/* ---------- init ---------- */
function init(){
  loadState();
  document.body.classList.toggle("real-exam-ui", state.realExamUi);
  setupMemo();
  bindEvents();
  refreshDashboard();
  renderHistory();
  hidePanels();
}

window.addEventListener("DOMContentLoaded", init);
document.getElementById("svgBox").innerHTML = q.svg || "";