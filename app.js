const STORAGE_KEY = "kyotsu_app_v13";
const HISTORY_VISIBLE = 5;

let state = {
  index: 0,
  correct: 0,
  total: 0,
  wrong: [],
  tipList: [],
  mode: "normal", // normal / review / tips
  strict: false,
  timer: null,
  remaining: 0,
  history: [],
lastShuffle: {},   // ✅ ここ追加
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
   保存 / 読み込み
========================= */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, stats }));
  if (el("saveStatus")) {
    const now = new Date().toLocaleTimeString("ja-JP");
    el("saveStatus").innerText = `保存状態: 保存済み（${now}）`;
  }
}
function shuffleArray(array){
  const arr = array.map((v,i)=>({value:v, index:i}));

  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }

  return arr;
}
function shuffleWithHistory(q){
  let shuffled;

  const prev = state.lastShuffle[q.id];

  do {
    shuffled = shuffleArray(q.a).map(x=>x.index);
  } while (
    prev && JSON.stringify(prev) === JSON.stringify(shuffled)
  );

  // 保存
  state.lastShuffle[q.id] = shuffled;

  return shuffled.map(i=>({
    value: q.a[i],
    index: i
  }));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (obj.state) Object.assign(state, obj.state);
    if (obj.stats) Object.assign(stats, obj.stats);

    if (!Array.isArray(state.history)) state.history = [];
    if (!Array.isArray(state.wrong)) state.wrong = [];
    if (!Array.isArray(state.tipList)) state.tipList = [];
  } catch (e) {
    console.error(e);
  }
}

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
   画面モード
========================= */
function enterExamMode() {
  document.body.classList.add("exam-mode");

  if (el("examTopbar")) el("examTopbar").style.display = "flex";
  if (el("controlPanel")) el("controlPanel").style.display = "none";
  if (el("questionPanel")) el("questionPanel").style.display = "flex";
  if (el("resultBox")) el("resultBox").style.display = "none";
}

function exitExamMode() {
  clearInterval(state.timer);
  document.body.classList.remove("exam-mode");

  if (el("examTopbar")) el("examTopbar").style.display = "none";
  if (el("controlPanel")) el("controlPanel").style.display = "block";
  if (el("questionPanel")) el("questionPanel").style.display = "none";
  if (el("resultBox")) el("resultBox").style.display = "none";
  if (el("stopGuide")) el("stopGuide").style.display = "none";
}

/* =========================
   補助
========================= */
function formatQuestionNumber(num) {
  const marks = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨"];
  return marks[num - 1] || `(${num})`;
}

function rate() {
  return state.total ? Math.round((state.correct / state.total) * 100) : 0;
}

function topWeak() {
  const entries = Object.entries(stats.weakness).filter(([, v]) => v > 0);
  if (!entries.length) return "未判定";
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

/* =========================
   ヘッダー表示
========================= */
function updateProgressUI(q) {
  if (el("qStageLabel")) {
    el("qStageLabel").innerText = `${q.stage}${formatQuestionNumber(q.num || 1)}`;
  }

  if (el("qScoreLabel")) {
    el("qScoreLabel").innerText = `配点:${q.score}点`;
  }

  if (el("qWeakLabel")) {
    el("qWeakLabel").innerText = `弱点:${q.weakness}`;
  }

  if (el("progressLabel")) {
    el("progressLabel").innerText = `${state.index + 1} / ${currentList().length}`;
  }
}

/* =========================
   総合表示更新
========================= */
function update() {
  if (el("correctCnt")) el("correctCnt").innerText = state.correct;
  if (el("totalCnt")) el("totalCnt").innerText = state.total;
  if (el("rateCnt")) el("rateCnt").innerText = rate() + "%";
  if (el("avgCnt")) el("avgCnt").innerText = "0";

  if (el("wCalc")) el("wCalc").innerText = stats.weakness["計算精度"] || 0;
  if (el("wSwitch")) el("wSwitch").innerText = stats.weakness["方針切替"] || 0;
  if (el("wTime")) el("wTime").innerText = stats.weakness["時間不足"] || 0;
  if (el("wJudge")) el("wJudge").innerText = stats.weakness["時間判断"] || 0;
  if (el("topWeak")) el("topWeak").innerText = topWeak();

  ["第1問", "第2問", "第3問", "第4問"].forEach((stage, i) => {
    const s = stats.stage[stage];
    const r = s.t ? Math.round((s.c / s.t) * 100) : 0;
    if (el("stageRate" + i)) el("stageRate" + i).innerText = r + "%";
  });

  if (el("todayReviewCount")) el("todayReviewCount").innerText = state.wrong.length;
  if (el("reviewRate")) el("reviewRate").innerText = "0%";
  if (el("clearedCount")) el("clearedCount").innerText = "0";
}

/* =========================
   履歴
========================= */
function addHistory() {
  if (state.total === 0) return;

  state.history.unshift({
    date: new Date().toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }),
    correct: state.correct,
    total: state.total,
    rate: rate(),
    topWeak: topWeak(),
    mode:
      state.mode === "review"
        ? "復習"
        : state.mode === "tips"
        ? "TIPS"
        : "通常"
  });

  state.history = state.history.slice(0, HISTORY_VISIBLE);
  renderHistory();
}

function renderHistory() {
  if (!el("historyBox")) return;

  if (!state.history.length) {
    el("historyBox").innerHTML = `<div class="history-item">まだ履歴がありません。</div>`;
    return;
  }

  el("historyBox").innerHTML = state.history
    .map(
      (e) => `
      <div class="history-item">
        <strong>${e.date}（${e.mode}）</strong><br>
        ${e.correct}/${e.total}（${e.rate}%） / ⚠ ${e.topWeak}
      </div>
    `
    )
    .join("");
}

/* =========================
   タイマー
========================= */
function timeLimit(q) {
  return q.time || 40;
}

function resetTimer() {
  clearInterval(state.timer);
  const q = currentQuestion();
  state.remaining = timeLimit(q);

  if (el("timer")) {
    el("timer").innerText = state.remaining + "s";
    el("timer").className = "timer";
  }
}

function startQuestionTimer() {
  if (el("questionStartBox")) el("questionStartBox").style.display = "none";
  if (el("optionsBox")) el("optionsBox").classList.remove("disabled");

  document.querySelectorAll(".option").forEach((b) => {
    b.disabled = false;
  });

  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.remaining--;

    if (el("timer")) {
      el("timer").innerText = state.remaining + "s";

      if (state.remaining <= 10) {
        el("timer").className = "timer danger";
      } else if (state.remaining <= 20) {
        el("timer").className = "timer warning";
      } else {
        el("timer").className = "timer";
      }
    }

    if (state.remaining <= 0) {
      clearInterval(state.timer);
      timeoutQuestion();
    }
  }, 1000);
}

/* =========================
   解説表示
========================= */
function explainHTML(q, ok) {
  if (state.mode === "tips") {
    return `
      <div style="font-weight:bold; font-size:18px; color:#1d4ed8;">🧠 TIPSだけ復習</div>
      <div style="margin-top:10px;"><strong>◆ コツ</strong><br>${q.explain.tip}</div>
    `;
  }

  return `
    <div style="font-weight:bold; font-size:18px; color:${ok ? "#166534" : "#991b1b"};">
      ${ok ? "正解！" : "不正解"}
    </div>
    <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${q.explain.why}</div>
    <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${q.explain.mistake}</div>
    <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${q.explain.tip}</div>
  `;
}

/* =========================
   休憩ガイド
========================= */
function maybeShowStopGuide() {
  if (state.total >= 10 && !state.stopHintShown && el("stopGuide")) {
    state.stopHintShown = true;
    el("stopGuide").style.display = "block";
    el("stopGuide").innerHTML = "ここで一度休憩がおすすめです。今日は10問到達しました。";
  }
}

/* =========================
   問題表示
========================= */
function show() {
  const q = currentQuestion();
  if (!q) {
    finish();
    return;
  }

  // ✅ 通常・復習・TIPS すべてでサイドバーを隠す
  enterExamMode();
  updateProgressUI(q);

  if (el("questionText")) {
    el("questionText").innerHTML = `
      <div>
        ${state.mode === "tips" ? q.q : q.q}
      </div>
    `;
  }

  if (el("svgBox")) el("svgBox").innerHTML = q.svg || "";

const box = el("optionsBox");
if (box) {
  box.innerHTML = "";
  box.classList.add("disabled");

  if (state.mode !== "tips") {

    // ✅ シャッフル
    const shuffled = shuffleWithHistory(q);

    shuffled.forEach((item, i) => {
      const b = document.createElement("button");
      b.className = "option";
      b.innerText = item.value;

      // ✅ 元の正解indexで判定
      b.onclick = () => answer(item.index);

      b.disabled = true;

      box.appendChild(b);
    });
  }
}  // ← ✅ ここでしっかり閉じる

// 👇 ここからは外側

  if (el("feedback")) {
    el("feedback").style.display = "none";
    el("feedback").innerHTML = "";
  }

  if (el("nextBtn")) el("nextBtn").style.display = "none";

  if (el("skipQuestionBtn")) {
    el("skipQuestionBtn").style.display = state.mode === "tips" ? "none" : "inline-block";
  }

  if (el("questionStartBox")) {
    el("questionStartBox").style.display = state.mode === "tips" ? "none" : "block";
  }

  if (el("stopGuide") && !state.stopHintShown) {
    el("stopGuide").style.display = "none";
  }

  resetTimer();
  update();

  if (state.mode === "tips") {
    if (el("feedback")) {
      el("feedback").style.display = "block";
      el("feedback").innerHTML = explainHTML(q, true);
    }
    if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  }
}

/* =========================
   回答
========================= */
function answer(i) {
  const q = currentQuestion();
  clearInterval(state.timer);

  const ok = i === q.correct;

  state.total++;
  stats.stage[q.stage].t++;

  if (ok) {
    state.correct++;
    stats.stage[q.stage].c++;
  } else {
    stats.weakness[q.weakness] = (stats.weakness[q.weakness] || 0) + 1;

    if (!state.wrong.find((qq) => qq.id === q.id)) {
      state.wrong.push(q);
    }
    if (!state.tipList.find((qq) => qq.id === q.id)) {
      state.tipList.push(q);
    }
  }

  document.querySelectorAll(".option").forEach((b, idx) => {
    b.disabled = true;
    if (idx === q.correct) b.classList.add("correct");
    if (idx === i && idx !== q.correct) b.classList.add("wrong");
  });

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = explainHTML(q, ok);
  }

  if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  if (el("skipQuestionBtn")) el("skipQuestionBtn").style.display = "none";

  maybeShowStopGuide();
  update();
  save();
}

/* =========================
   時間切れ
========================= */
function timeoutQuestion() {
  const q = currentQuestion();

  state.total++;
  stats.stage[q.stage].t++;
  stats.weakness["時間不足"] = (stats.weakness["時間不足"] || 0) + 1;

  if (!state.wrong.find((qq) => qq.id === q.id)) state.wrong.push(q);
  if (!state.tipList.find((qq) => qq.id === q.id)) state.tipList.push(q);

  document.querySelectorAll(".option").forEach((b, idx) => {
    b.disabled = true;
    if (idx === q.correct) b.classList.add("correct");
  });

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = `
      <div style="font-weight:bold; font-size:18px; color:#991b1b;">時間切れ</div>
      <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${q.explain.why}</div>
      <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${q.explain.mistake}</div>
      <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${q.explain.tip}</div>
    `;
  }

  if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  if (el("skipQuestionBtn")) el("skipQuestionBtn").style.display = "none";

  maybeShowStopGuide();
  update();
  save();
}

/* =========================
   スキップ
========================= */
function skipQuestion() {
  const q = currentQuestion();
  clearInterval(state.timer);

  state.total++;
  stats.stage[q.stage].t++;
  stats.weakness["時間判断"] = (stats.weakness["時間判断"] || 0) + 1;

  if (!state.wrong.find((qq) => qq.id === q.id)) state.wrong.push(q);
  if (!state.tipList.find((qq) => qq.id === q.id)) state.tipList.push(q);

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = `
      <div style="font-weight:bold; font-size:18px; color:#92400e;">この設問を飛ばしました</div>
      <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${q.explain.why}</div>
      <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${q.explain.mistake}</div>
      <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${q.explain.tip}</div>
    `;
  }

  if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  if (el("skipQuestionBtn")) el("skipQuestionBtn").style.display = "none";

  maybeShowStopGuide();
  update();
  save();
}

/* =========================
   次へ
========================= */
function nextQuestion() {
  state.index++;
  show();
}

/* =========================
   終了
========================= */
function finish() {
  clearInterval(state.timer);

  if (el("questionPanel")) el("questionPanel").style.display = "none";
  if (el("examTopbar")) el("examTopbar").style.display = "none";
  if (el("resultBox")) el("resultBox").style.display = "block";

  if (el("finalScore")) el("finalScore").innerText = `${state.correct}/${state.total}`;
  if (el("resultSummary")) {
    el("resultSummary").innerHTML = `正答率 ${rate()}%<br>最重要課題：${topWeak()}`;
  }

  addHistory();
  save();
}

/* =========================
   モード開始
========================= */
function startExam() {
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.wrong = [];
  state.tipList = [];
  state.mode = "normal";
  state.stopHintShown = false;
  if (el("stopGuide")) el("stopGuide").style.display = "none";
  show();
}

function resumeExam() {
  state.mode = "normal";
  show();
}

function startWrongOnlyReview() {
  if (!state.wrong.length) {
    alert("復習問題がありません");
    return;
  }
  state.mode = "review";
  state.index = 0;
  state.stopHintShown = false;
  if (el("stopGuide")) el("stopGuide").style.display = "none";
  show();
}

function startTipReview() {
  if (!state.tipList.length) {
    alert("復習するTIPSがありません");
    return;
  }
  state.mode = "tips";
  state.index = 0;
  state.stopHintShown = false;
  if (el("stopGuide")) el("stopGuide").style.display = "none";
  show();
}

function toggleStrictTime() {
  state.strict = !state.strict;
  if (el("toggleStrictTimeBtn")) {
    el("toggleStrictTimeBtn").innerText =
      state.strict ? "時間制限: 厳格" : "時間制限: 通常";
  }
}

/* =========================
   ボタン
========================= */
if (el("startExamBtn")) el("startExamBtn").onclick = startExam;
if (el("resumeExamBtn")) el("resumeExamBtn").onclick = resumeExam;
if (el("startWrongOnlyReviewBtn")) el("startWrongOnlyReviewBtn").onclick = startWrongOnlyReview;
if (el("startWrongOnlyReviewBtn2")) el("startWrongOnlyReviewBtn2").onclick = startWrongOnlyReview;
if (el("startTipReviewBtn")) el("startTipReviewBtn").onclick = startTipReview;

if (el("startQuestionBtn")) el("startQuestionBtn").onclick = startQuestionTimer;
if (el("nextBtn")) el("nextBtn").onclick = nextQuestion;
if (el("skipQuestionBtn")) el("skipQuestionBtn").onclick = skipQuestion;

if (el("goTopBtn")) el("goTopBtn").onclick = exitExamMode;
if (el("goTopBtn2")) el("goTopBtn2").onclick = exitExamMode;
if (el("goTopBtn3")) el("goTopBtn3").onclick = exitExamMode;

if (el("toggleStrictTimeBtn")) el("toggleStrictTimeBtn").onclick = toggleStrictTime;

/* 初期化 */
load();
update();
renderHistory();
exitExamMode();
