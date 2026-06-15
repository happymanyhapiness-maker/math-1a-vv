const el = (id) => document.getElementById(id);

let index = 0;
let correct = 0;
let total = 0;

let timer = null;
let remaining = 0;

/* =========================
   問題取得
========================= */
function getQuestion(){
  return questions[index];
}

/* =========================
   表示
========================= */
function formatNum(n){
  return ["①","②","③","④","⑤","⑥","⑦","⑧","⑨"][n-1] || n;
}

function updateUI(q){
  if(el("qStageLabel")){
    el("qStageLabel").innerText = q.stage + formatNum(q.num);
  }

  if(el("qScoreLabel")){
    el("qScoreLabel").innerText = "配点:" + q.score + "点";
  }

  if(el("qWeakLabel")){
    el("qWeakLabel").innerText = "弱点:" + q.weakness;
  }

  if(el("progressLabel")){
    el("progressLabel").innerText = (index+1) + " / " + questions.length;
  }
}

/* =========================
   タイマー
========================= */
function resetTimer(){
  clearInterval(timer);
  remaining = getQuestion().time || 40;

  if(el("timer")){
    el("timer").innerText = remaining + "s";
    el("timer").className = "timer";
  }
}

function startTimer(){

  const box = el("questionStartBox");
  if(box) box.style.display = "none";

  document.querySelectorAll(".option").forEach(b=>{
    b.disabled = false;
  });

  clearInterval(timer);

  timer = setInterval(()=>{
    remaining--;

    if(el("timer")){
      el("timer").innerText = remaining + "s";

      if(remaining <= 10){
        el("timer").className = "timer danger";
      } else if(remaining <= 20){
        el("timer").className = "timer warning";
      } else {
        el("timer").className = "timer";
      }
    }

    if(remaining <= 0){
      clearInterval(timer);
      timeout();
    }

  },1000);
}

/* =========================
   問題描画
========================= */
function render(){
  const q = getQuestion();
  if(!q) return;

  updateUI(q);

  if(el("questionText")){
    el("questionText").innerHTML = q.q;
  }

  const box = el("optionsBox");
  if(!box) return;

  box.innerHTML = "";
  box.classList.add("disabled");

  q.a.forEach((c,i)=>{
    const b = document.createElement("button");
    b.className = "option";
    b.innerText = c;

    b.onclick = ()=>{
      answer(i);
    };

    b.disabled = true;
    box.appendChild(b);
  });

  resetTimer();
}

/* =========================
   回答
========================= */
function answer(i){
  clearInterval(timer);

  total++;

  const q = getQuestion();

  if(i === q.correct){
    correct++;
  }

  document.querySelectorAll(".option").forEach((b,idx)=>{
    b.disabled = true;

    if(idx === q.correct){
      b.classList.add("correct");
    }

    if(idx === i && idx !== q.correct){
      b.classList.add("wrong");
    }
  });

  if(el("nextBtn")){
    el("nextBtn").style.display = "inline-block";
  }
}

/* =========================
   次へ
========================= */
function next(){
  index++;
  render();
}

/* =========================
   時間切れ
========================= */
function timeout(){
  const q = getQuestion();

  document.querySelectorAll(".option").forEach((b,idx)=>{
    b.disabled = true;
    if(idx === q.correct){
      b.classList.add("correct");
    }
  });

  if(el("nextBtn")){
    el("nextBtn").style.display = "inline-block";
  }
}

/* =========================
   スタート
========================= */
function start(){

  index = 0;
  correct = 0;
  total = 0;

  if(el("controlPanel")) el("controlPanel").style.display = "none";
  if(el("questionPanel")) el("questionPanel").style.display = "block";
  if(el("examTopbar")) el("examTopbar").style.display = "flex";

  render();
}

/* =========================
   ボタン
========================= */
if(el("startExamBtn")) el("startExamBtn").onclick = start;
if(el("startQuestionBtn")) el("startQuestionBtn").onclick = startTimer;
if(el("nextBtn")) el("nextBtn").onclick = next;
if(el("skipQuestionBtn")) el("skipQuestionBtn").onclick = next;
