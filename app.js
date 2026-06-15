const STORAGE_KEY = "kyotsu_app_v8";

let state = {
  index: 0,
  correct: 0,
  total: 0,
  wrong: [],
  mode: "normal",
  strict: false,
  timer: null,
  remaining: 0
};

const stats = {
  weakness: { "計算精度":0, "方針切替":0, "時間判断":0, "時間不足":0 },
  stage: {
    "第1問":{t:0,c:0},
    "第2問":{t:0,c:0},
    "第3問":{t:0,c:0},
    "第4問":{t:0,c:0}
  }
};

const el = id => document.getElementById(id);

/* ===== 保存 ===== */
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({state,stats}));
  el("saveStatus").innerText = "保存状態: 保存済み（" + new Date().toLocaleTimeString("ja-JP") + "）";
}
function load(){
  const d = localStorage.getItem(STORAGE_KEY);
  if(!d) return;
  try{
    const obj = JSON.parse(d);
    Object.assign(state, obj.state);
    Object.assign(stats, obj.stats);
    el("saveStatus").innerText = "保存状態: 前回データ読み込み済み";
  }catch{}
}

/* ===== 問題取得 ===== */
function list(){
  return state.mode === "review" ? state.wrong : questions;
}
function q(){
  return list()[state.index];
}

/* ===== 試験UI切替 ===== */
function enterExamMode(){
  el("examTopbar").style.display = "flex";
  el("controlPanel").style.display = "none";
}
function exitExamMode(){
  el("examTopbar").style.display = "none";
  el("controlPanel").style.display = "block";
  el("questionPanel").style.display = "none";
  el("resultBox").style.display = "none";
}

/* ===== 表示 ===== */
function show(){
  const x = q();
  if(!x){ finish(); return; }

  enterExamMode();

  el("questionPanel").style.display = "flex";
  el("resultBox").style.display = "none";

  el("questionText").innerHTML = `<b>${x.stage}</b><br>${x.q}`;
  el("qStageLabel").innerText = x.stage;
  el("qScoreLabel").innerText = "配点 " + x.score + "点";
  el("qWeakLabel").innerText = x.weakness;
  el("qModeLabel").innerText = state.mode === "review" ? "復習モード" : "本番モード";

  el("optionsBox").innerHTML = "";
  el("optionsBox").classList.add("disabled");

  x.a.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "option";
    b.innerText = String.fromCharCode(65+i) + ". " + c;
    b.onclick = () => answer(i);
    b.disabled = true;
    el("optionsBox").appendChild(b);
  });

  el("feedback").style.display = "none";
  el("nextBtn").style.display = "none";
  el("questionStartBox").style.display = "block";

  resetTimer();
  update();
}

/* ===== タイマー ===== */
function timeLimit(){ return state.strict ? 30 : 60; }

function resetTimer(){
  clearInterval(state.timer);
  state.remaining = timeLimit();
  el("timer").innerText = state.remaining + "s";
  el("timer").className = "timer";
}

function startQ(){
  el("questionStartBox").style.display = "none";
  el("optionsBox").classList.remove("disabled");

  [...document.querySelectorAll(".option")].forEach(b => b.disabled = false);

  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.remaining--;
    el("timer").innerText = state.remaining + "s";

    if(state.remaining <= 10) el("timer").className = "timer danger";
    else if(state.remaining <= 20) el("timer").className = "timer warning";

    if(state.remaining <= 0){
      clearInterval(state.timer);
      timeout();
    }
  }, 1000);
}

/* ===== 回答 ===== */
function answer(i){
  const x = q();
  clearInterval(state.timer);

  const ok = i === x.correct;

  state.total++;
  stats.stage[x.stage].t++;

  if(ok){
    state.correct++;
    stats.stage[x.stage].c++;
  }else{
    stats.weakness[x.weakness]++;
    if(!state.wrong.find(q => q.id === x.id)) state.wrong.push(x);
  }

  [...document.querySelectorAll(".option")].forEach((b, idx) => {
    b.disabled = true;
    if(idx === x.correct) b.classList.add("correct");
    if(idx === i && idx !== x.correct) b.classList.add("wrong");
  });

  el("feedback").style.display = "block";
  el("feedback").innerHTML = explain(x, ok);

  el("nextBtn").style.display = "inline-block";

  update();
  save();
}

/* ===== 解説 ===== */
function explain(q, ok){
  return `
  <b style="color:${ok ? "green" : "red"}">${ok ? "✅ 正解" : "❌ 不正解"}</b><br><br>
  <b>◆ 解き方</b><br>${q.explain.why}<br><br>
  <b>◆ ミス</b><br>${q.explain.mistake}<br><br>
  <b>◆ コツ</b><br>${q.explain.tip}
  `;
}

/* ===== タイムアウト ===== */
function timeout(){
  const x = q();
  state.total++;
  stats.stage[x.stage].t++;
  stats.weakness["時間不足"]++;

  if(!state.wrong.find(q => q.id === x.id)) state.wrong.push(x);

  el("feedback").style.display = "block";
  el("feedback").innerHTML = `<b style="color:#d97706">⏰ 時間切れ</b><br><br>` + explain(x, false).replace(/<b[^>]*>.*?<\/b><br><br>/, "");
  el("nextBtn").style.display = "inline-block";

  // 正解選択肢を表示
  [...document.querySelectorAll(".option")].forEach((b, idx) => {
    b.disabled = true;
    if(idx === x.correct) b.classList.add("correct");
  });

  update();
  save();
}

/* ===== 次 ===== */
function next(){
  state.index++;
  show();
}

/* ===== 終了 ===== */
function finish(){
  el("questionPanel").style.display = "none";
  el("examTopbar").style.display = "none";
  el("controlPanel").style.display = "none";
  el("resultBox").style.display = "block";
  el("finalScore").innerText = `${state.correct} / ${state.total}`;
  el("resultSummary").innerHTML = `正答率 ${rate()}%<br>最重要課題：${topWeak()}`;
  save();
}

/* ===== 統計 ===== */
function rate(){
  return state.total ? Math.round(state.correct / state.total * 100) : 0;
}

function topWeak(){
  const entries = Object.entries(stats.weakness).filter(([,v]) => v > 0);
  if(!entries.length) return "未判定";
  return entries.sort((a,b) => b[1]-a[1])[0][0];
}

function update(){
  el("correctCnt").innerText = state.correct;
  el("totalCnt").innerText = state.total;
  el("rateCnt").innerText = rate() + "%";

  el("wCalc").innerText = stats.weakness["計算精度"];
  el("wSwitch").innerText = stats.weakness["方針切替"];
  el("wJudge").innerText = stats.weakness["時間判断"];   // ← 追加
  el("wTime").innerText = stats.weakness["時間不足"];

  el("topWeak").innerText = topWeak();

  ["第1問","第2問","第3問","第4問"].forEach((s, i) => {
    const d = stats.stage[s];
    const r = d.t ? Math.round(d.c / d.t * 100) : 0;
    el("stageRate"+i).innerText = r + "%";
  });
}

/* ===== モード ===== */
function start(){
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.wrong = [];
  state.mode = "normal";
  show();
}

function review(){
  if(!state.wrong.length){ alert("復習問題がありません"); return; }
  state.mode = "review";
  state.index = 0;
  show();
}

function toggle(){
  state.strict = !state.strict;
  el("toggleStrictTimeBtn").innerText = state.strict ? "⏱ 厳格モード（30s）" : "⏱ 通常モード（60s）";
}

/* ===== ボタン ===== */
el("startExamBtn").onclick = start;
el("resumeExamBtn").onclick = show;
el("startWrongOnlyReviewBtn").onclick = review;
el("startWrongOnlyReviewBtn2").onclick = review;
el("startQuestionBtn").onclick = startQ;
el("nextBtn").onclick = next;
el("skipQuestionBtn").onclick = next;

el("goTopBtn").onclick   = () => { exitExamMode(); };
el("goTopBtn2").onclick  = () => { exitExamMode(); };
el("goTopBtn3").onclick  = () => { exitExamMode(); };

el("toggleStrictTimeBtn").onclick = toggle;

el("resetStatsBtn").onclick = () => {
  if(confirm("学習ログをリセットしますか？")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
};
el("clearSavedDataBtn").onclick = () => {
  if(confirm("保存データをすべて削除しますか？")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
};

/* ===== 初期 ===== */
load();
update();
