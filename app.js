const STORAGE_KEY = "kyotsu_app_v12";
const HISTORY_VISIBLE = 5;

let state = {
  index: 0,
  correct: 0,
  total: 0,
  wrong: [],
  tipList: [],
  mode: "normal",
  strict: false,
  timer: null,
  remaining: 0,
  history: [],
  stopHintShown: false
};

const stats = {
  weakness: {
    "計算精度": 0,
    "方針切替": 0,
    "時間判断": 0,
    "時間不足": 0
  },
  stage: {
    "第1問": { t: 0, c: 0 },
    "第2問": { t: 0, c: 0 },
    "第3問": { t: 0, c: 0 },
    "第4問": { t: 0, c: 0 }
  }
};

const el = (id) => document.getElementById(id);

/* =========================
   問題取得
========================= */
function currentList() {
  if (state.mode === "review") return state.wrong;
  if (state.mode === "tips") return state.tipList;
  return questions;
}

function currentQuestion() {
  return currentList()[state.index];
}

/* =========================
   表示（修正版）
========================= */
function formatQuestionNumber(num) {
  const marks = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨"];
  return marks[num-1] || `(${num})`;
}

/* ✅ここ完全修正版 */
function updateProgressUI(q) {
  if (el("qStageLabel")) {
    el("qStageLabel").innerText =
      `${q.stage}${formatQuestionNumber(q.num || 1)}`;
  }

  if (el("qScoreLabel")) {
    el("qScoreLabel").innerText = `配点:${q.score}点`;
  }

  if (el("qWeakLabel")) {
    el("qWeakLabel").innerText = `弱点:${q.weakness}`;
  }

  if (el("progressLabel")) {
    el("progressLabel").innerText =
      `${state.index + 1} / ${currentList().length}`;
  }
}

/* =========================
   タイマー
========================= */
function timeLimit(q){
  return q.time || 40;
}

function resetTimer(){
  clearInterval(state.timer);
  const q = currentQuestion();
  state.remaining = timeLimit(q);

  if(el("timer")){
    el("timer").innerText = state.remaining + "s";
    el("timer").className = "timer";
  }
}

function startQuestionTimer(){
  if(el("questionStartBox")) el("questionStartBox").style.display = "none";

  document.querySelectorAll(".option").forEach(b=>{
    b.disabled = false;
  });

  clearInterval(state.timer);

  state.timer = setInterval(()=>{
    state.remaining--;

    if(el("timer")){
      el("timer").innerText = state.remaining + "s";

      if(state.remaining<=10){
        el("timer").className = "timer danger";
      } else if(state.remaining<=20){
        el("timer").className = "timer warning";
      } else {
        el("timer").className = "timer";
      }
    }

    if(state.remaining<=0){
      clearInterval(state.timer);
      timeoutQuestion();
    }
  },1000);
}

/* =========================
   問題表示
========================= */
function show(){
  const q = currentQuestion();
  if(!q) return;

  updateProgressUI(q);

  if(el("questionText")){
    el("questionText").innerHTML =
      `<div>${q.q}</div>`;
  }

  const box = el("optionsBox");
  box.innerHTML = "";

  q.a.forEach((c,i)=>{
    const b = document.createElement("button");
    b.className = "option";
    b.innerText = c;
    b.onclick = ()=>answer(i);
    b.disabled = true;
    box.appendChild(b);
  });

  resetTimer();
}

/* =========================
   回答
========================= */
function answer(i){
  const q = currentQuestion();
  clearInterval(state.timer);

  state.total++;

  if(i === q.correct){
    state.correct++;
  }

  document.querySelectorAll(".option").forEach((b,idx)=>{
    b.disabled = true;
    if(idx===q.correct) b.classList.add("correct");
    if(idx===i && idx!==q.correct) b.classList.add("wrong");
  });
}

/* =========================
   次
========================= */
function nextQuestion(){
  state.index++;
  show();
}

/* =========================
   タイムアウト
========================= */
function timeoutQuestion(){
  const q = currentQuestion();

  document.querySelectorAll(".option").forEach((b,idx)=>{
    b.disabled = true;
    if(idx===q.correct) b.classList.add("correct");
  });
}

/* =========================
   ボタン
========================= */
if(el("startExamBtn")) el("startExamBtn").onclick = ()=>{
  state.index=0;
  state.correct=0;
  state.total=0;
  show();
};

if(el("startQuestionBtn")) el("startQuestionBtn").onclick = startQuestionTimer;
if(el("nextBtn")) el("nextBtn").onclick = nextQuestion;
