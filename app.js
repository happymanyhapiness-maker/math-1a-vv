const STORAGE_PREFIX = "kyotsu_app_v14_";
const LEGACY_STORAGE_KEY = "kyotsu_app_v13"; // 単元分離前の旧キー。図形と計量のデータとして1回だけ引き継ぐ
const UNIT_KEY = "kyotsu_app_unit_v1";
const HISTORY_VISIBLE = 5;

const UNIT_META = {
  keiryo: {
    label: "数ⅠA 図形と計量",
    description: "三角比 / 三平方 / 面積",
    note: "",
    mission: `
      第1問：三角比・式変形での計算精度
      第2問：図形と計量での高さ・面積・方針切替
      第3問：内接円・接線の長さ・半径
      第4問：誘導の読み方・時間配分
    `,
    questions: questions_keiryo,
    routeChoices: ROUTE_CHOICES_KEIRYO,
    primaryRoutes: ["三平方", "面積", "接線の長さ", "角の二等分線", "同じ量を2通りで表す", "面積→半径"]
  },

  seishitsu: {
    label: "数ⅠA 図形の性質",
    description: "重心 / チェバ / 円周角 / 2円",
    note: "",
    mission: `
      第1問：重心・外心・垂心の性質
      第2問：チェバの定理・メネラウスの定理
      第3問：円周角・接弦角・内接四角形
      第4問：2円の位置関係・共通接線
    `,
    questions: questions_seishitsu,
    routeChoices: ROUTE_CHOICES_SEISHITSU,
    primaryRoutes: ["三平方", "二等辺三角形の性質", "外心の性質", "チェバの定理", "メネラウスの定理", "円周角の定理"]
  },

  nijikansuu: {
    label: "数ⅠA 二次関数",
    description: "グラフ / 判別式 / 最大最小",
    note: "",
    mission: `
      第1問：グラフの基本(頂点・平行移動・対称移動・式の決定)
      第2問：2次方程式・2次不等式・判別式
      第3問：最大値・最小値の基礎(区間と軸の位置関係)
      第4問：最大最小の応用+大問形式(具体値→一般化→振り返り)
    `,
    questions: questions_nijikansuu,
    routeChoices: ROUTE_CHOICES_NIJIKANSUU,
    primaryRoutes: ["頂点の座標", "判別式", "2次不等式", "最大最小(区間)", "式の決定(頂点)", "平行移動"]
  },

  kitaichi: {
    label: "数ⅠA 期待値(ミニ)",
    description: "値×確率 / 分布表 / 意味の理解",
    note: "",
    mission: `
      第1問：期待値の定義と基本計算(さいころの7/2)
      第2問：確率が均等でない分布表からの期待値(合計=1の検算込み)
    `,
    questions: questions_kitaichi,
    routeChoices: ROUTE_CHOICES_KITAICHI,
    primaryRoutes: ["値×確率の合計", "確率の合計=1の確認", "分布表の作成"],
    reviewClearStreak: 6 // 問題数が薄い単元(2問)なので、卒業条件を厳しめに(デフォルト4→6)
  },

  vector: {
    label: "数ⅡBC ベクトル",
    description: "成分 / 内積 / 平行と垂直 / 球面",
    note: "",
    mission: `
      第1問：成分計算・大きさ・単位ベクトル
      第2問：内積と平行・垂直の判定(混同しやすい2条件の区別)
      第3問：内分点・重心・位置ベクトル
      第4問：空間座標と球面(大問チェーン形式)
    `,
    questions: questions_vector,
    routeChoices: ROUTE_CHOICES_VECTOR,
    primaryRoutes: ["成分計算", "内積", "平行条件", "垂直条件", "内分点の公式", "位置ベクトル"]
  },

  shisuu: {
    label: "数ⅡBC 指数・対数",
    description: "指数法則 / 置き換え / 対数の基礎",
    note: "",
    mission: `
      第1問：指数法則の基礎(2^x×2^(-x)=1、4^x=(2^x)²)
      第2問：相加相乗とtの範囲
      第3問：対数の定義・計算法則・真数条件
      第4問：置き換え方程式の大問チェーン(序盤検算の練習)
    `,
    questions: questions_shisuu,
    routeChoices: ROUTE_CHOICES_SHISUU,
    primaryRoutes: ["指数法則", "置き換え(tの式)", "対数の定義", "対数の計算法則", "真数条件", "tの範囲の確認"]
  },

  zahyou: {
    label: "数ⅡBC 図形と方程式",
    description: "直線 / 円 / 距離 / 領域",
    note: "",
    mission: `
      第1問：直線の方程式と交点(検算習慣)
      第2問：距離の公式(2点間・点と直線・円と直線)
      第3問：円の方程式と平方完成
      第4問：領域の判定と最小値(大問チェーン形式)
    `,
    questions: questions_zahyou,
    routeChoices: ROUTE_CHOICES_ZAHYOU,
    primaryRoutes: ["直線の方程式", "連立方程式(交点)", "2点間の距離", "円の方程式", "代表点の代入(領域)", "点と直線の距離"]
  },

  bisekibun: {
    label: "数ⅡBC 微積(グラフ判断)",
    description: "極値判定 / 解の動き / 面積",
    note: "",
    mission: `
      第1問：極値の判定(f'の符号変化)と代入計算
      第2問：グラフ概形の言語化
      第3問：水平線y=kを動かしたときの解の動き(チェーン)
      第4問：定積分と面積の立式
    `,
    questions: questions_bisekibun,
    routeChoices: ROUTE_CHOICES_BISEKIBUN,
    primaryRoutes: ["f'の符号と増減", "極値の判定", "具体値で試す", "定積分の計算", "上-下の確認"]
  },

  suuretsu: {
    label: "数ⅡBC 数列(累計・再利用ミニ)",
    description: "累計の3列表 / 特性方程式の再利用",
    note: "",
    mission: `
      第1問：累計Sₙを表で追うトレーニング
      第2問：特性方程式と「前問の結果の再利用」
    `,
    questions: questions_suuretsu,
    routeChoices: ROUTE_CHOICES_SUURETSU,
    primaryRoutes: ["3列表(n・項・累計)", "特性方程式", "前問の結果の再利用", "具体値で試す"],
    reviewClearStreak: 6 // 問題数が薄い単元(2問)なので、卒業条件を厳しめに(デフォルト4→6)
  },

  toukei: {
    label: "数ⅡBC 統計的な推測",
    description: "標準化 / 検定 / 確率密度関数",
    note: "",
    mission: `
      第1問：標準化と正規分布表の読み方
      第2問：標本平均の分散
      第3問：仮説検定の考え方(帰無仮説・棄却域)
      第4問：確率密度関数(全区間の積分=1からkを決める)
    `,
    questions: questions_toukei,
    routeChoices: ROUTE_CHOICES_TOUKEI,
    primaryRoutes: ["標準化", "正規分布表の読み方", "標本平均の分散", "帰無仮説の設定", "棄却域との比較"]
  }
};

function defaultState(unit) {
  return {
    unit: unit,
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
    lastShuffle: {},
    stopHintShown: false,
    routeMiss: 0,
    routeTry: 0,
    finished: false,
    stageFilter: null,
    answerLog: [],
    questionStartTs: null,
    candidateIndex: null, // 早合点防止：確定前の「仮選択」状態
    reviewMeta: {}, // questionId -> {streak, dueAt, lastSeenAt} 間隔復習(スペースドリピティション)用
  };
}

function defaultStats() {
  return {
    weakness: {
      "計算精度": 0,
      "方針切替": 0,
      "時間判断": 0,
      "時間不足": 0,
      "共通点抽出": 0
    },
    stage: {
      "第1問": { t: 0, c: 0 },
      "第2問": { t: 0, c: 0 },
      "第3問": { t: 0, c: 0 },
      "第4問": { t: 0, c: 0 }
    },
    clearedCount: 0 // 間隔復習を完走して「完全に直した」と判定された問題数
  };
}

let state = defaultState(null);
let stats = defaultStats();

const el = (id) => document.getElementById(id);

/* =========================
   表示用ヘルパー
   問題文・解説・recapなどに含まれる < > は、
   そのまま innerHTML に入れるとHTMLタグの開始と誤認識されるため、
   先にエスケープしてから \n を <br> に変換する。
========================= */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatText(str) {
  if (str === undefined || str === null) return "";
  return escapeHtml(str).replace(/\n/g, "<br>");
}

/* =========================
   穴埋め式(fillin)問題用：解答の正規化
   全角数字・全角マイナス・空白の違いだけで誤答扱いにならないようにする。
   （選択式と違い、自由入力なので表記ゆれの吸収が必須）
========================= */
function normalizeAnswer(v) {
  if (v === undefined || v === null) return "";
  let s = String(v).trim();
  s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)); // 全角数字→半角
  s = s.replace(/－/g, "-").replace(/ー/g, "-").replace(/／/g, "/");
  s = s.replace(/\s+/g, "");
  return s;
}

/* =========================
   保存 / 読み込み（単元ごと）
========================= */
function save() {
  if (!state.unit) return;

  localStorage.setItem(STORAGE_PREFIX + state.unit, JSON.stringify({ state, stats }));
  localStorage.setItem(UNIT_KEY, state.unit);

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

function loadUnit(unit) {
  state = defaultState(unit);
  stats = defaultStats();

  // 旧バージョン(単元分離前)のデータを、図形と計量のデータとして1回だけ引き継ぐ
  if (unit === "keiryo" && !localStorage.getItem(STORAGE_PREFIX + unit)) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) localStorage.setItem(STORAGE_PREFIX + unit, legacy);
  }

  const raw = localStorage.getItem(STORAGE_PREFIX + unit);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj.state) Object.assign(state, obj.state);

      // stats.weakness / stats.stage は丸ごと上書きせず、サブオブジェクト単位でマージする
      // (古い/不完全な保存データに欠けているキーがあっても、デフォルト値で補える)
      if (obj.stats && obj.stats.weakness) Object.assign(stats.weakness, obj.stats.weakness);
      if (obj.stats && obj.stats.stage) Object.assign(stats.stage, obj.stats.stage);
      if (obj.stats && typeof obj.stats.clearedCount === "number") stats.clearedCount = obj.stats.clearedCount;
    } catch (e) {
      console.error(e);
    }
  }

  state.unit = unit; // 念のため固定

  if (!Array.isArray(state.history)) state.history = [];
  if (!Array.isArray(state.wrong)) state.wrong = [];
  if (!Array.isArray(state.tipList)) state.tipList = [];
  if (!Array.isArray(state.answerLog)) state.answerLog = [];
  if (typeof state.finished !== "boolean") state.finished = false;

  // v14以前のデータにはreviewMetaが無いので、既存のwrong[]から「今すぐ復習対象」として補完する
  if (!state.reviewMeta || typeof state.reviewMeta !== "object") state.reviewMeta = {};
  state.wrong.forEach((q) => {
    if (q && q.id && !state.reviewMeta[q.id]) {
      state.reviewMeta[q.id] = { streak: 0, dueAt: Date.now(), lastSeenAt: null };
    }
  });
}

/* =========================
   問題取得
========================= */
function currentList() {
  if (state.mode === "review") return state.wrong;
  if (state.mode === "dueReview") return dueReviewList();
  if (state.mode === "tips") return state.tipList;
  if (state.mode === "stage") {
    return UNIT_META[state.unit].questions.filter((q) => q.stage === state.stageFilter);
  }
  return UNIT_META[state.unit].questions;
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
   ログ集計エンジン（第2段階）
   state.answerLog を食べて、分析用の集計オブジェクトを返す。
   ダッシュボードもAI診断も、この関数の出力を共通の入力に使う。
========================= */

// 誤答タグの日本語ラベル（表示・AI入力の両方で使う）
const TAG_LABELS = {
  correct: "正解",
  calc_error: "計算ミス",
  sign_error: "符号ミス",
  condition_misread: "条件読み落とし",
  formula_mismatch: "公式選択ミス",
  diagram_reading: "図の読み違い",
  ratio_reverse: "比の向き逆",
  range_error: "範囲・場合分けミス",
  concept_gap: "どこから手をつけるか思いつかなかった",
  near_miss: "考え方は合ってたけど最後で計算/確認をミスった",
  partial_match: "一部にしか当てはまらないものを「全部共通」と勘違いした",
  time_pressure: "時間切れ",
  skipped: "スキップ"
};

/* =========================
   図形問題用SVG図
   - 必要な問題だけ、問題IDごとに表示する
   - 図は位置関係確認用の模式図。長さ・角度を図から測らせる目的ではない
========================= */

const DIAGRAM_NOTICE = "※図は位置関係を確認するための模式図です。長さや角度を図から測って解くものではありません。";

const DIAGRAMS = {
  "g2-3": `
    <svg viewBox="0 0 660 250" class="diagram-svg" role="img" aria-label="g2-3 メネラウス図">
      <polygon class="shape" points="70,190 250,190 160,40"/>
      <line class="thin dash" x1="50" y1="190" x2="630" y2="190"/>
      <line class="thin" x1="100" y1="140" x2="610" y2="190"/>
      <circle class="point" cx="70" cy="190" r="4"/>
      <circle class="point" cx="250" cy="190" r="4"/>
      <circle class="point" cx="160" cy="40" r="4"/>
      <circle class="point" cx="100" cy="140" r="4"/>
      <circle class="point" cx="227.5" cy="152.5" r="4"/>
      <circle class="ext-point" cx="610" cy="190" r="5"/>
      <text class="label" x="55" y="212">B</text>
      <text class="label" x="253" y="212">C</text>
      <text class="label" x="154" y="31">A</text>
      <text class="label" x="84" y="139">R</text>
      <text class="label" x="233" y="151">Q</text>
      <text class="red-label" x="616" y="189">P</text>
      <text class="small-label" x="565" y="214">Cの外側</text>
      <text class="ratio" x="88" y="84">AR:RB=2:1</text>
      <text class="ratio" x="238" y="117">CQ:QA=1:3</text>
      <text class="note" x="360" y="174">※Pは実際かなり遠い</text>
    </svg>
  `,

  "g2-4": `
    <svg viewBox="0 0 450 280" class="diagram-svg" role="img" aria-label="g2-4 メネラウス図">
      <polygon class="shape" points="70,180 240,180 160,50"/>
      <line class="thin dash" x1="45" y1="180" x2="425" y2="180"/>
      <line class="thin dash" x1="160" y1="50" x2="25" y2="245"/>
      <line class="thin dash" x1="160" y1="50" x2="270" y2="226"/>
      <line class="thin" x1="25" y1="245" x2="410" y2="180"/>
      <circle class="point" cx="70" cy="180" r="4"/>
      <circle class="point" cx="240" cy="180" r="4"/>
      <circle class="point" cx="160" cy="50" r="4"/>
      <circle class="ext-point" cx="25" cy="245" r="5"/>
      <circle class="ext-point" cx="410" cy="180" r="5"/>
      <circle class="ext-point" cx="256" cy="206" r="5"/>
      <text class="label" x="55" y="201">B</text>
      <text class="label" x="244" y="201">C</text>
      <text class="label" x="154" y="41">A</text>
      <text class="red-label" x="11" y="244">R</text>
      <text class="red-label" x="416" y="179">P</text>
      <text class="red-label" x="262" y="209">Q</text>
      <text class="small-label" x="28" y="226">Bの外側</text>
      <text class="small-label" x="367" y="204">Cの外側</text>
      <text class="small-label" x="268" y="232">Cの外側</text>
      <text class="ratio" x="52" y="122">AR:RB=3:1</text>
      <text class="ratio" x="252" y="166">BP:PC=2:1</text>
    </svg>
  `,

  "g2-6": `
    <svg viewBox="0 0 540 260" class="diagram-svg" role="img" aria-label="g2-6 チェバとメネラウス連続図">
      <g transform="translate(150,0)">
        <polygon class="shape" points="70,195 270,195 165,40"/>
        <line class="thin dash" x1="-140" y1="195" x2="295" y2="195"/>
        <line class="thin" x1="165" y1="40" x2="136.7" y2="195"/>
        <line class="thin" x1="70" y1="195" x2="217.5" y2="117.5"/>
        <line class="thin" x1="270" y1="195" x2="101.7" y2="143.3"/>
        <line class="thin" x1="-130" y1="195" x2="217.5" y2="117.5"/>
        <circle class="point" cx="70" cy="195" r="4"/>
        <circle class="point" cx="270" cy="195" r="4"/>
        <circle class="point" cx="165" cy="40" r="4"/>
        <circle class="point" cx="136.7" cy="195" r="4"/>
        <circle class="point" cx="217.5" cy="117.5" r="4"/>
        <circle class="point" cx="101.7" cy="143.3" r="4"/>
        <circle class="p-point" cx="143.8" cy="156.2" r="5"/>
        <circle class="ext-point" cx="-130" cy="195" r="5"/>
        <text class="label" x="55" y="216">B</text>
        <text class="label" x="274" y="216">C</text>
        <text class="label" x="159" y="31">A</text>
        <text class="label" x="134" y="216">D</text>
        <text class="label" x="222" y="114">E</text>
        <text class="label" x="86" y="143">F</text>
        <text class="blue-label" x="150" y="152">P</text>
        <text class="red-label" x="-148" y="193">Q</text>
        <text class="small-label" x="-120" y="218">Bの外側</text>
        <text class="ratio" x="82" y="187">BD:DC=1:2</text>
        <text class="ratio" x="212" y="82">CE:EA=1:1</text>
        <text class="note" x="-42" y="175">※QはB側に遠く出る</text>
      </g>
    </svg>
  `,

  "g4-3": `
    <svg viewBox="0 0 360 250" class="diagram-svg" role="img" aria-label="2円の共通外接線">
      <circle class="shape" cx="95" cy="150" r="52"/>
      <circle class="shape" cx="260" cy="150" r="24"/>
      <line class="thin" x1="95" y1="150" x2="260" y2="150"/>
      <line class="shape" x1="103.8" y1="98.8" x2="264.1" y2="126.3"/>
      <line class="thin" x1="95" y1="150" x2="103.8" y2="98.8"/>
      <line class="thin" x1="260" y1="150" x2="264.1" y2="126.3"/>
      <line class="thin dash" x1="95" y1="150" x2="264.1" y2="126.3"/>
      <circle class="point" cx="95" cy="150" r="4"/>
      <circle class="point" cx="260" cy="150" r="4"/>
      <circle class="point" cx="103.8" cy="98.8" r="4"/>
      <circle class="point" cx="264.1" cy="126.3" r="4"/>
      <text class="label" x="78" y="171">O₁</text>
      <text class="label" x="263" y="171">O₂</text>
      <text class="label" x="91" y="92">A</text>
      <text class="label" x="269" y="126">B</text>
      <text class="ratio" x="157" y="145">中心間距離</text>
      <text class="ratio" x="146" y="102">共通外接線</text>
      <text class="small-label" x="112" y="122">r₁</text>
      <text class="small-label" x="268" y="141">r₂</text>
      <path class="angle" d="M259 126 L264 138 L276 135"/>
      <text class="note" x="122" y="221">半径差と接線長で直角三角形を見る</text>
    </svg>
  `,

  "g4-4": `
    <svg viewBox="0 0 300 260" class="diagram-svg" role="img" aria-label="外接する2円と、接点を通らない共通外接線">
      <circle class="shape" cx="90" cy="150" r="70"/>
      <circle class="shape" cx="185" cy="150" r="25"/>
      <line class="thin dash" x1="90" y1="150" x2="185" y2="150"/>
      <line class="shape" x1="123.2" y1="88.3" x2="196.8" y2="128.0"/>
      <line class="thin" x1="90" y1="150" x2="123.2" y2="88.3"/>
      <line class="thin" x1="185" y1="150" x2="196.8" y2="128.0"/>
      <circle class="point" cx="90" cy="150" r="4"/>
      <circle class="point" cx="185" cy="150" r="4"/>
      <circle class="point" cx="123.2" cy="88.3" r="4"/>
      <circle class="point" cx="196.8" cy="128.0" r="4"/>
      <circle class="ext-point" cx="160" cy="150" r="5"/>
      <text class="label" x="73" y="171">O</text>
      <text class="label" x="188" y="171">O'</text>
      <text class="label" x="115" y="80">A</text>
      <text class="label" x="203" y="122">B</text>
      <text class="red-label" x="163" y="143">接点</text>
      <text class="small-label" x="107" y="122">r=4</text>
      <text class="small-label" x="200" y="141">r=1</text>
      <text class="ratio" x="118" y="160">d=OO'=5（外接：d=R+r）</text>
      <text class="note" x="98" y="238">円は接点で接しているが、共通外接線(AB)は接点を通らない</text>
    </svg>
  `
};

function tagLabel(tag) {
  if (!tag) return "分類なし";
  return TAG_LABELS[tag] || tag;
}

// 割り算の安全ラッパ（0件のとき NaN を返さず null に）
function safeRate(correct, total) {
  if (!total) return null;
  return Math.round((correct / total) * 100);
}

function analyzeLog(log) {
  log = Array.isArray(log) ? log : [];

  const result = {
    totalAnswered: log.length,
    totalCorrect: 0,
    overallRate: null,

    tagCounts: {},          // 誤答タグ別の回数
    tagRanking: [],         // [{tag, label, count}] 多い順

    byWeakness: {},         // weakness別 {total, correct, rate}
    byStage: {},            // stage別   {total, correct, rate}
    byRoute: {},            // route別   {total, correct, rate}

    time: {
      avgAll: null,
      avgCorrect: null,
      avgWrong: null,
      slowCorrect: [],      // 正解したが時間がかかった問題
    },

    repeatMistakes: [],     // 同じ問題で複数回ミス [{questionId, count}]
    repeatTags: [],         // 繰り返している誤答タグ [{tag, label, count}]（2回以上）

    unseen: true,           // まだ1問も解いていないか
  };

  if (!log.length) return result;
  result.unseen = false;

  let timeSum = 0, timeCount = 0;
  let timeCorrectSum = 0, timeCorrectCount = 0;
  let timeWrongSum = 0, timeWrongCount = 0;

  const perQuestionWrong = {};   // questionId -> 誤答回数

  log.forEach((r) => {
    if (r.isCorrect) result.totalCorrect++;

    // --- タグ集計（誤答タグのみカウント。correctは除外） ---
    if (r.selectedTag && r.selectedTag !== "correct") {
      result.tagCounts[r.selectedTag] = (result.tagCounts[r.selectedTag] || 0) + 1;
    }

    // --- weakness別 ---
    if (r.weakness) {
      const w = result.byWeakness[r.weakness] || { total: 0, correct: 0, rate: null };
      w.total++; if (r.isCorrect) w.correct++;
      result.byWeakness[r.weakness] = w;
    }

    // --- stage別 ---
    if (r.stage) {
      const s = result.byStage[r.stage] || { total: 0, correct: 0, rate: null };
      s.total++; if (r.isCorrect) s.correct++;
      result.byStage[r.stage] = s;
    }

    // --- route別（1問が複数routeを持つので、それぞれに加算） ---
    (r.route && r.route.length ? r.route : ["(routeなし)"]).forEach((rt) => {
      const o = result.byRoute[rt] || { total: 0, correct: 0, rate: null };
      o.total++; if (r.isCorrect) o.correct++;
      result.byRoute[rt] = o;
    });

    // --- 時間 ---
    if (typeof r.elapsedTime === "number" && r.elapsedTime >= 0) {
      timeSum += r.elapsedTime; timeCount++;
      if (r.isCorrect) {
        timeCorrectSum += r.elapsedTime; timeCorrectCount++;
      } else {
        timeWrongSum += r.elapsedTime; timeWrongCount++;
      }
    }

    // --- 繰り返しミス（問題単位） ---
    if (!r.isCorrect) {
      perQuestionWrong[r.questionId] = (perQuestionWrong[r.questionId] || 0) + 1;
    }
  });

  // 正答率
  result.overallRate = safeRate(result.totalCorrect, result.totalAnswered);

  // タグランキング
  result.tagRanking = Object.entries(result.tagCounts)
    .map(([tag, count]) => ({ tag, label: tagLabel(tag), count }))
    .sort((a, b) => b.count - a.count);

  // 各カテゴリの rate を埋める
  [result.byWeakness, result.byStage, result.byRoute].forEach((obj) => {
    Object.keys(obj).forEach((k) => {
      obj[k].rate = safeRate(obj[k].correct, obj[k].total);
    });
  });

  // 時間
  result.time.avgAll = timeCount ? Math.round(timeSum / timeCount) : null;
  result.time.avgCorrect = timeCorrectCount ? Math.round(timeCorrectSum / timeCorrectCount) : null;
  result.time.avgWrong = timeWrongCount ? Math.round(timeWrongSum / timeWrongCount) : null;

  // 正解したが時間がかかった問題（平均正解時間の1.5倍以上）
  if (result.time.avgCorrect) {
    const threshold = result.time.avgCorrect * 1.5;
    result.time.slowCorrect = log
      .filter((r) => r.isCorrect && typeof r.elapsedTime === "number" && r.elapsedTime >= threshold)
      .map((r) => ({ questionId: r.questionId, stage: r.stage, num: r.num, elapsedTime: r.elapsedTime }));
  }

  // 繰り返しミス（2回以上）
  result.repeatMistakes = Object.entries(perQuestionWrong)
    .filter(([, c]) => c >= 2)
    .map(([questionId, count]) => ({ questionId, count }))
    .sort((a, b) => b.count - a.count);

  // 繰り返している誤答タグ（2回以上）
  result.repeatTags = result.tagRanking.filter((t) => t.count >= 2);

  return result;
}

/* =========================
   アプリ内ミニ分析（第3段階）
   analyzeLog()の結果を、コピペしてClaudeに渡さなくても
   その場で気づけるよう、サイドバーに直接表示する。
   「コピー→貼り付け→分析」のラグを埋めるための即時フィードバック。
========================= */
function renderInsightsPanel() {
  const box = el("insightsBox");
  if (!box) return;

  const a = analyzeLog(state.answerLog);

  if (a.unseen) {
    box.innerHTML = `<div class="small-text">まだ回答ログがありません。数問解くと、ここにその場でミス傾向が出ます。</div>`;
    return;
  }

  const topTags = a.tagRanking.slice(0, 3);
  const maxCount = topTags.length ? topTags[0].count : 0;

  const tagBars = topTags.length
    ? topTags
        .map(
          (t) => `
        <div class="insight-bar-row">
          <span class="insight-bar-label">${t.label}</span>
          <div class="insight-bar-track">
            <div class="insight-bar-fill" style="width:${maxCount ? Math.round((t.count / maxCount) * 100) : 0}%;"></div>
          </div>
          <span class="insight-bar-count">${t.count}</span>
        </div>
      `
        )
        .join("")
    : `<div class="small-text">誤答なし。今のところ完璧！</div>`;

  const stageEntries = Object.entries(a.byStage).filter(([, v]) => v.total > 0);
  let weakestStageHtml = "";
  if (stageEntries.length >= 2) {
    // 比較できるステージが2つ以上あるときだけ「弱い」と言う（1ステージしか解いていないのに
    // 「一番弱い」と決めつけるのはデータ不足による誤診断なので避ける）
    const weakest = stageEntries.sort((x, y) => (x[1].rate ?? 100) - (y[1].rate ?? 100))[0];
    if (weakest[1].rate < 100) {
      weakestStageHtml = `<div class="pill" style="margin-top:8px;">今一番弱いステージ: ${weakest[0]}（${weakest[1].rate}%）</div>`;
    } else {
      weakestStageHtml = `<div class="small-text" style="margin-top:8px; color:#166534;">全ステージ100%、今のところ死角なし！</div>`;
    }
  }

  let repeatHtml = "";
  if (a.repeatMistakes.length) {
    repeatHtml = `<div class="small-text" style="margin-top:8px; color:#991b1b;">同じ問題を${a.repeatMistakes.length}問、2回以上ミスしています。「今日の復習」から解き直すのがおすすめ。</div>`;
  }

  box.innerHTML = `
    <div class="small-text">直近 ${a.totalAnswered}問 / 正答率 ${a.overallRate}%</div>
    <div class="insight-bars" style="margin-top:8px;">${tagBars}</div>
    ${weakestStageHtml}
    ${repeatHtml}
  `;
}

// コンソールで人間が読める形に整形して出す（開発・確認用）
function debugPrintAnalysis(log) {
  const a = analyzeLog(log || state.answerLog);
  if (a.unseen) {
    console.log("%cまだ回答ログがありません。数問解くと集計されます。", "color:#888");
    return a;
  }
  console.log("%c===== 学習ログ分析 =====", "font-weight:bold;font-size:14px;color:#2563eb");
  console.log(`総回答 ${a.totalAnswered}問 / 正解 ${a.totalCorrect}問 / 正答率 ${a.overallRate}%`);

  console.log("%c▼ ミス傾向トップ（誤答タグ）", "font-weight:bold");
  if (a.tagRanking.length) {
    console.table(a.tagRanking.map(t => ({ 傾向: t.label, 回数: t.count })));
  } else {
    console.log("  誤答なし（すばらしい）");
  }

  console.log("%c▼ weakness軸 別 正答率", "font-weight:bold");
  console.table(Object.fromEntries(Object.entries(a.byWeakness).map(([k, v]) => [k, `${v.correct}/${v.total} (${v.rate}%)`])));

  console.log("%c▼ ステージ別 正答率", "font-weight:bold");
  console.table(Object.fromEntries(Object.entries(a.byStage).map(([k, v]) => [k, `${v.correct}/${v.total} (${v.rate}%)`])));

  console.log("%c▼ 解法ルート別 正答率", "font-weight:bold");
  console.table(Object.fromEntries(Object.entries(a.byRoute).map(([k, v]) => [k, `${v.correct}/${v.total} (${v.rate}%)`])));

  console.log("%c▼ 時間プロファイル", "font-weight:bold");
  console.log(`  平均 ${a.time.avgAll}秒 / 正解時 ${a.time.avgCorrect}秒 / 誤答時 ${a.time.avgWrong}秒`);
  if (a.time.avgCorrect && a.time.avgWrong) {
    if (a.time.avgWrong < a.time.avgCorrect) {
      console.log("  → 誤答の方が速い＝『早とちり・見切り発車』の傾向");
    } else {
      console.log("  → 誤答の方が遅い＝『悩んだ末に外す』傾向");
    }
  }

  if (a.repeatMistakes.length) {
    console.log("%c▼ 繰り返しミスしている問題", "font-weight:bold;color:#b91c1c");
    console.table(a.repeatMistakes.map(m => ({ 問題ID: m.questionId, ミス回数: m.count })));
  }
  if (a.repeatTags.length) {
    console.log("%c▼ 繰り返している思考のクセ", "font-weight:bold;color:#b91c1c");
    console.table(a.repeatTags.map(t => ({ クセ: t.label, 回数: t.count })));
  }
  console.log("%c========================", "color:#2563eb");
  return a;
}

/* =========================
   分析レポート生成（Claudeに貼り付ける用テキスト）
   analyzeLog の結果を、人にもClaudeにも読みやすいプレーンテキストに整形する。
   このテキストをコピーしてClaudeに渡すと、弱点診断・復習メニュー・
   プリント作成などにそのまま使える。
========================= */
function buildAnalysisReport() {
  const unit = state.unit;
  const unitLabel = unit && UNIT_META[unit] ? UNIT_META[unit].label : "(単元未選択)";
  const a = analyzeLog(state.answerLog);

  const lines = [];
  lines.push("==== 数学アプリ 学習ログ（Claude分析用） ====");
  lines.push(`単元: ${unitLabel}`);
  lines.push(`出力日時: ${new Date().toLocaleString("ja-JP")}`);
  lines.push("");

  if (a.unseen) {
    lines.push("まだ回答ログがありません。数問解いてから再度コピーしてください。");
    return lines.join("\n");
  }

  lines.push(`総回答 ${a.totalAnswered}問 / 正解 ${a.totalCorrect}問 / 正答率 ${a.overallRate}%`);
  lines.push("");

  // ミス傾向（誤答タグ）
  lines.push("【ミス傾向（多い順）】");
  if (a.tagRanking.length) {
    a.tagRanking.forEach((t) => lines.push(`  ・${t.label}（${t.tag}）: ${t.count}回`));
  } else {
    lines.push("  誤答なし");
  }
  lines.push("");

  // ステージ別
  lines.push("【ステージ別 正答率】");
  Object.entries(a.byStage).forEach(([k, v]) => {
    lines.push(`  ${k}: ${v.correct}/${v.total}（${v.rate}%）`);
  });
  lines.push("");

  // 解法ルート別
  lines.push("【解法ルート別 正答率】");
  Object.entries(a.byRoute)
    .sort((x, y) => (x[1].rate ?? 999) - (y[1].rate ?? 999))
    .forEach(([k, v]) => {
      lines.push(`  ${k}: ${v.correct}/${v.total}（${v.rate}%）`);
    });
  lines.push("");

  // weakness別
  lines.push("【弱点軸別 正答率】");
  Object.entries(a.byWeakness).forEach(([k, v]) => {
    lines.push(`  ${k}: ${v.correct}/${v.total}（${v.rate}%）`);
  });
  lines.push("");

  // 時間
  lines.push("【時間プロファイル】");
  lines.push(`  平均 ${a.time.avgAll}秒 / 正解時 ${a.time.avgCorrect}秒 / 誤答時 ${a.time.avgWrong}秒`);
  if (a.time.avgCorrect && a.time.avgWrong) {
    lines.push(a.time.avgWrong < a.time.avgCorrect
      ? "  傾向: 誤答の方が速い→早とちり・見切り発車ぎみ"
      : "  傾向: 誤答の方が遅い→悩んだ末に外している");
  }
  if (a.time.slowCorrect.length) {
    lines.push("  正解したが時間がかかった問題: " + a.time.slowCorrect.map(s => `${s.stage}${s.num}(${s.elapsedTime}秒)`).join(", "));
  }
  lines.push("");

  // 繰り返し
  if (a.repeatTags.length) {
    lines.push("【繰り返している思考のクセ（2回以上）】");
    a.repeatTags.forEach((t) => lines.push(`  ・${t.label}: ${t.count}回`));
    lines.push("");
  }
  if (a.repeatMistakes.length) {
    lines.push("【同じ問題で複数回ミス】");
    a.repeatMistakes.forEach((m) => lines.push(`  ・${m.questionId}: ${m.count}回`));
    lines.push("");
  }

  // 誤答の具体リスト（Claudeが個別に見られるよう、直近の誤答を列挙）
  lines.push("【誤答の詳細（直近20件）】");
  const wrongs = state.answerLog.filter(r => !r.isCorrect).slice(-20);
  if (wrongs.length) {
    wrongs.forEach((r) => {
      const sel = r.selectedText !== null ? `「${r.selectedText}」` : "(無回答)";
      const tag = r.selectedTag ? tagLabel(r.selectedTag) : "分類なし";
      lines.push(`  ${r.stage}${r.num}(${r.questionId}): 選択${sel} → 正解「${r.correctText}」 / ${tag} / ${r.elapsedTime ?? "?"}秒`);
    });
  } else {
    lines.push("  なし");
  }
  lines.push("");
  lines.push("==== ここまで ====");
  lines.push("↑このログをもとに、弱点診断・優先して復習すべき単元・復習プリント案を出してください。");

  return lines.join("\n");
}

/* クリップボードにコピー（フォールバック付き） */
function copyAnalysisToClipboard() {
  const text = buildAnalysisReport();
  const statusEl = el("analysisCopyStatus");

  const done = (msg, color) => {
    if (statusEl) { statusEl.innerText = msg; statusEl.style.color = color || "#166534"; }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => done("コピーしました！Claudeのチャットに貼り付けてください。"),
      () => fallbackCopy(text, done)
    );
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    done("コピーしました！Claudeのチャットに貼り付けてください。");
  } catch (e) {
    done("コピーに失敗しました。プレビューから手動でコピーしてください。", "#991b1b");
  }
}

function toggleAnalysisPreview() {
  const pre = el("analysisPreview");
  if (!pre) return;
  if (pre.style.display === "none" || !pre.style.display) {
    pre.innerText = buildAnalysisReport();
    pre.style.display = "block";
  } else {
    pre.style.display = "none";
  }
}

/* =========================
   回答ログ記録（選択肢タグ）
   1回の回答ごとに、選んだ選択肢の情報を state.answerLog に残す。
   outcome: "answered" | "timeout" | "skip"
========================= */
function logAnswer(q, selectedIndex, outcome) {
  if (!q) return;

  // 経過秒（開始時刻が取れていれば実測、無ければ制限時間から逆算）
  let elapsed = null;
  if (state.questionStartTs) {
    elapsed = Math.round((Date.now() - state.questionStartTs) / 1000);
  } else if (typeof state.remaining === "number") {
    elapsed = timeLimit(q) - state.remaining;
  }

  const hasSel = selectedIndex !== null && selectedIndex !== undefined;
  const isCorrect = hasSel && selectedIndex === q.correct;

  // 選択肢タグ（未タグの単元でも安全に動くよう ?? null）
  let selectedTag = null;
  if (outcome === "timeout") {
    selectedTag = "time_pressure";
  } else if (outcome === "skip") {
    selectedTag = "skipped";
  } else if (hasSel && Array.isArray(q.tags)) {
    selectedTag = q.tags[selectedIndex] ?? null;
  }

  state.answerLog.push({
    questionId: q.id,
    stage: q.stage,
    num: q.num,
    weakness: q.weakness,
    route: Array.isArray(q.route) ? q.route.slice() : [],
    selectedIndex: hasSel ? selectedIndex : null,
    selectedText: hasSel ? q.a[selectedIndex] : null,
    selectedTag: selectedTag,
    correctIndex: q.correct,
    correctText: q.a[q.correct],
    correctTag: Array.isArray(q.tags) ? (q.tags[q.correct] ?? null) : null,
    isCorrect: isCorrect,
    outcome: outcome,
    mode: state.mode,
    timestamp: Date.now(),
    elapsedTime: elapsed
  });
}

/* =========================
   穴埋め式(fillin)問題のログ記録
   選択式のlogAnswer()と違い、selectedIndexという概念がないため別関数にする。
   ただし analyzeLog() / buildAnalysisReport() が読むフィールド形状は
   選択式とまったく同じにして、分析ロジック側は一切変更しないで済むようにしてある。
========================= */
function logFillinAnswer(q, results, overallTag, isCorrect, outcome) {
  let elapsed = null;
  if (state.questionStartTs) {
    elapsed = Math.round((Date.now() - state.questionStartTs) / 1000);
  } else if (typeof state.remaining === "number") {
    elapsed = timeLimit(q) - state.remaining;
  }

  const userAnswerText = results.map((r) => `${r.label}=${r.userRaw || "(空欄)"}`).join(", ");
  const correctAnswerText = results.map((r) => `${r.label}=${r.correctDisplay}`).join(", ");

  state.answerLog.push({
    questionId: q.id,
    stage: q.stage,
    num: q.num,
    weakness: q.weakness,
    route: Array.isArray(q.route) ? q.route.slice() : [],
    selectedIndex: null,
    selectedText: userAnswerText,
    selectedTag: overallTag,
    correctIndex: null,
    correctText: correctAnswerText,
    correctTag: "correct",
    isCorrect: isCorrect,
    outcome: outcome,
    mode: state.mode,
    timestamp: Date.now(),
    elapsedTime: elapsed
  });
}

function addReviewTarget(q) {
  if (!q) return;

  if (!state.wrong.find((qq) => qq.id === q.id)) {
    state.wrong.push(q);
  }

  if (!state.tipList.find((qq) => qq.id === q.id)) {
    state.tipList.push(q);
  }

  // 間隔復習用メタ情報：初めて間違えた問題は「今すぐ復習対象」として登録する
  if (!state.reviewMeta[q.id]) {
    state.reviewMeta[q.id] = { streak: 0, dueAt: Date.now(), lastSeenAt: null };
  }
}

/* =========================
   間隔復習（スペースドリピティション・簡易版）
   「途中結果を確定させずに次へ進む」癖の矯正には、間違えた問題を
   本人任せにせず「今日はこれだけ」と機械的に提示することが必要。
   正解が続くほど間隔を空け、一定回数連続正解したら「完全に直した」
   として復習リストから卒業させる。
========================= */
const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]; // streak(連続正解数)ごとの次回間隔(日)
const REVIEW_CLEAR_STREAK_DEFAULT = 4; // これに到達したら卒業（デフォルト）

// 単元ごとに卒業条件を上書きできるようにする。
// 問題数が薄い単元(期待値・数列など)は「たまたま覚えた」と「本当に理解した」の
// 区別がつきにくいので、卒業までの連続正解数を厳しめにする。
function reviewClearStreakFor(unit) {
  const meta = UNIT_META[unit];
  return (meta && meta.reviewClearStreak) || REVIEW_CLEAR_STREAK_DEFAULT;
}

function dueReviewList() {
  const now = Date.now();
  return state.wrong.filter((q) => {
    const meta = state.reviewMeta[q.id];
    if (!meta) return true; // メタ情報がない古いデータは、念のため復習対象に含める
    return meta.dueAt <= now;
  });
}

function dueReviewCount() {
  return dueReviewList().length;
}

// 復習モード中の1問について、正誤に応じてreviewMetaを更新する。
// 卒業条件を満たしたらwrong[]/reviewMetaから外し、stats.clearedCountを加算する。
function markReviewResult(q, isCorrect) {
  if (!q || !q.id) return;

  const meta = state.reviewMeta[q.id] || { streak: 0, dueAt: Date.now(), lastSeenAt: null };
  meta.lastSeenAt = Date.now();

  if (isCorrect) {
    meta.streak++;

    if (meta.streak >= reviewClearStreakFor(state.unit)) {
      // 卒業：復習リストから完全に除去
      state.wrong = state.wrong.filter((qq) => qq.id !== q.id);
      delete state.reviewMeta[q.id];
      stats.clearedCount = (stats.clearedCount || 0) + 1;
      return;
    }

    const days = REVIEW_INTERVAL_DAYS[meta.streak] ?? REVIEW_INTERVAL_DAYS[REVIEW_INTERVAL_DAYS.length - 1];
    meta.dueAt = Date.now() + days * 24 * 60 * 60 * 1000;
  } else {
    // 間違えたら振り出しに戻し、次回すぐ復習対象にする
    meta.streak = 0;
    meta.dueAt = Date.now();
  }

  state.reviewMeta[q.id] = meta;
}

function lockOptionsAndMark(correctIndex, selectedIndex = null) {
  removeConfirmBar();
  document.querySelectorAll(".option").forEach((b) => {
    b.disabled = true;

    const originalIndex = Number(b.dataset.index);

    if (originalIndex === correctIndex) {
      b.classList.add("correct");
    }

    if (
      selectedIndex !== null &&
      originalIndex === selectedIndex &&
      originalIndex !== correctIndex
    ) {
      b.classList.add("wrong");
    }
  });

  if (el("optionsBox")) {
    el("optionsBox").classList.add("disabled");
  }
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
  if (el("wPattern")) el("wPattern").innerText = stats.weakness["共通点抽出"] || 0;
  if (el("topWeak")) el("topWeak").innerText = topWeak();

  ["第1問", "第2問", "第3問", "第4問"].forEach((stage, i) => {
    const s = stats.stage[stage];
    const r = s.t ? Math.round((s.c / s.t) * 100) : 0;
    if (el("stageRate" + i)) el("stageRate" + i).innerText = r + "%";
  });

  if (el("todayReviewCount")) el("todayReviewCount").innerText = dueReviewCount();
  if (el("reviewRate")) {
    const reviewLogs = state.answerLog.filter((r) => r.mode === "review" || r.mode === "dueReview");
    const reviewCorrect = reviewLogs.filter((r) => r.isCorrect).length;
    const rr = safeRate(reviewCorrect, reviewLogs.length);
    el("reviewRate").innerText = rr === null ? "―" : rr + "%";
  }
  if (el("clearedCount")) el("clearedCount").innerText = stats.clearedCount || 0;

  renderInsightsPanel();
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
        : state.mode === "dueReview"
        ? "今日の復習"
        : state.mode === "tips"
        ? "TIPS"
        : state.mode === "stage"
        ? `${state.stageFilter}のみ`
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
  const base = q.time || 40;

  // 厳格モード: 問題データの秒数そのまま
  if (state.strict) return base;

  // 通常モード: 図形が苦手な子向けに少し余裕を持たせる
  return Math.ceil(base * 1.5);
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
  const q = currentQuestion();

  const quizBox = el("routeQuizBox");
  const routeOptions = el("routeOptions");
  const routeFeedback = el("routeFeedback");

  // route がない問題は、そのまま開始
  if (!q.route || q.route.length === 0) {
    if (el("questionStartBox")) el("questionStartBox").style.display = "none";
    if (el("optionsBox")) el("optionsBox").classList.remove("disabled");

    document.querySelectorAll(".option").forEach((b) => {
      b.disabled = false;
    });
    enableFillinInputs();

    clearInterval(state.timer);
    state.questionStartTs = Date.now();
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

    return;
  }

  // route がある問題は、開始せずに方針選択UIだけ出す
state.routeTry = 0;
  if (quizBox) quizBox.style.display = "block";
  if (routeOptions) routeOptions.innerHTML = "";
  if (routeFeedback) {
    routeFeedback.style.display = "none";
    routeFeedback.innerHTML = "";
  }
if (routeOptions) routeOptions.style.display = "block";
if (el("submitRouteBtn")) el("submitRouteBtn").style.display = "inline-block";

if (routeOptions) {
  const guide = document.createElement("div");
  guide.style.fontSize = "14px";
  guide.style.color = "#555";
  guide.style.marginBottom = "10px";
  guide.innerText = `解き方を選んでください（${q.route.length}つ選択）`;
  routeOptions.appendChild(guide);
}
const choices = UNIT_META[state.unit].routeChoices;

choices.forEach((label) => {
  const wrap = document.createElement("label");
  wrap.style.display = "block";
  wrap.style.margin = "6px 0";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = label;
  checkbox.style.marginRight = "8px";

  wrap.appendChild(checkbox);
  wrap.appendChild(document.createTextNode(label));

  if (routeOptions) routeOptions.appendChild(wrap);
});

if (el("submitRouteBtn")) {
  el("submitRouteBtn").onclick = checkRouteAndStart;
}

function checkRouteAndStart() {
  const checked = Array.from(
    document.querySelectorAll('#routeOptions input[type="checkbox"]:checked')
  ).map((x) => x.value);

  const isCorrect =
    checked.length === q.route.length &&
    checked.every((x) => q.route.includes(x));

  // 不正解
  if (!isCorrect) {
    state.routeMiss++;
    state.routeTry++;

    // 1回目ミス → チェックを外して再選択
    if (state.routeTry === 1) {
      document
        .querySelectorAll('#routeOptions input[type="checkbox"]')
        .forEach((x) => {
          x.checked = false;
        });

      if (routeFeedback) {
        routeFeedback.style.display = "block";
        routeFeedback.innerHTML = `
          <div style="color:#991b1b; font-weight:bold;">
            方針ミス！
          </div>
          <div style="margin-top:8px;">
            もう一度考えて選んでください。
          </div>
        `;
      }
      return;
    }

    // 2回目ミス → 選択肢一覧と「方針を確定」だけ消す
    if (routeOptions) routeOptions.style.display = "none";
    if (el("submitRouteBtn")) el("submitRouteBtn").style.display = "none";

    // 下の「方針を確認」ボックスも消す
    if (el("questionStartBox")) {
      el("questionStartBox").style.display = "none";
    }

    if (routeFeedback) {
      routeFeedback.style.display = "block";
      routeFeedback.innerHTML = `
        <div style="color:#991b1b; font-weight:bold;">
          方針ミス！
        </div>
        <div style="margin-top:8px;">
          正解ルート：${q.route.join(" → ")}
        </div>
        <div style="margin-top:12px;">
          <button class="btn primary" id="forceStartBtn">問題開始</button>
        </div>
      `;
    }

    const forceBtn = document.getElementById("forceStartBtn");
    if (forceBtn) {
      forceBtn.onclick = () => {
        if (quizBox) quizBox.style.display = "none";
        if (el("questionStartBox")) el("questionStartBox").style.display = "none";
        if (el("optionsBox")) el("optionsBox").classList.remove("disabled");

        document.querySelectorAll(".option").forEach((b) => {
          b.disabled = false;
        });
        enableFillinInputs();

        clearInterval(state.timer);
        state.questionStartTs = Date.now();
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
      };
    }

    return;
  }

  // 正解
if (routeFeedback) {
  routeFeedback.style.display = "block";
  routeFeedback.innerHTML = `
    <div style="color:#166534; font-weight:bold;">
      方針OK！
    </div>
    <div style="margin-top:12px;">
      <button class="btn primary" id="forceStartBtn">問題開始</button>
    </div>
  `;
}

// ✅ 下の「方針確認ボックス」は消す
if (el("questionStartBox")) {
  el("questionStartBox").style.display = "none";
}

// ✅ ここではまだ開始しない

const forceBtn = document.getElementById("forceStartBtn");
if (forceBtn) {
  forceBtn.onclick = () => {
    if (quizBox) quizBox.style.display = "none";

    if (el("optionsBox")) el("optionsBox").classList.remove("disabled");

    document.querySelectorAll(".option").forEach((b) => {
      b.disabled = false;
    });
    enableFillinInputs();

    clearInterval(state.timer);
    state.questionStartTs = Date.now();
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
  };
}
}
}
/* =========================
   解説表示
========================= */
function explainHTML(q, ok) {
  if (state.mode === "tips") {
    return `
      <div style="font-weight:bold; font-size:18px; color:#1d4ed8;">🧠 TIPSだけ復習</div>
      <div style="margin-top:10px;"><strong>◆ コツ</strong><br>${formatText(q.explain.tip)}</div>
    `;
  }

  return `
    <div style="font-weight:bold; font-size:18px; color:${ok ? "#166534" : "#991b1b"};">
      ${ok ? "正解！" : "不正解"}
    </div>
    <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${formatText(q.explain.why)}</div>
    <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${formatText(q.explain.mistake)}</div>
    <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${formatText(q.explain.tip)}</div>
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

  // ✅ 大問の設定パネル(groupIntro / recap)
  if (el("groupPanel")) {
    const hasGroupInfo = !!(q.groupIntro || (q.recap && q.recap.length));
    if (hasGroupInfo) {
      let html = "";
      if (q.groupIntro) html += `<div class="group-intro">${formatText(q.groupIntro)}</div>`;
      if (q.recap && q.recap.length) {
        html += `<div class="group-recap"><strong>これまでの結果</strong><ul>`;
        html += q.recap.map((r) => `<li>${formatText(r)}</li>`).join("");
        html += `</ul></div>`;
      }
      el("groupPanel").innerHTML = html;
      el("groupPanel").style.display = "block";
    } else {
      el("groupPanel").innerHTML = "";
      el("groupPanel").style.display = "none";
    }
  }

  if (el("questionText")) {
    el("questionText").innerHTML = `
      <div>
        ${formatText(q.q)}
      </div>
    `;
  }

  if (el("svgBox")) {
    const diagramHtml = q.svg || DIAGRAMS[q.id] || "";

    if (diagramHtml) {
      el("svgBox").innerHTML = `
        <div class="diagram-box">
          ${diagramHtml}
          <div class="diagram-notice">${DIAGRAM_NOTICE}</div>
        </div>
      `;
      el("svgBox").style.display = "block";
    } else {
      el("svgBox").innerHTML = "";
      el("svgBox").style.display = "none";
    }
  }

const box = el("optionsBox");
if (q.type === "fillin") {
  if (box) {
    box.innerHTML = "";
    box.style.display = "none";
  }
  state.candidateIndex = null;
  removeConfirmBar();
  renderFillinBlanks(q);
} else {
  if (el("fillinBox")) {
    el("fillinBox").innerHTML = "";
    el("fillinBox").style.display = "none";
  }

if (box) {
  box.style.display = "";
  box.innerHTML = "";
  box.classList.add("disabled");
  state.candidateIndex = null;
  removeConfirmBar();

  if (state.mode !== "tips") {

    // ✅ シャッフル
    const shuffled = shuffleWithHistory(q);

shuffled.forEach((item, i) => {
  const b = document.createElement("button");
  b.className = "option";
  b.innerText = item.value;

  // ✅ 元の位置を保存
  b.dataset.index = item.index;

  // ✅ 早合点防止：即答ではなく、まず「仮選択」にする
  b.onclick = () => selectCandidate(item.index, b);

  b.disabled = true;

  box.appendChild(b);
});
  }
}  // ← ✅ ここでしっかり閉じる
}

// 👇 ここからは外側

  if (el("feedback")) {
    el("feedback").style.display = "none";
    el("feedback").innerHTML = "";
  }
if (el("routeFeedback")) {
  el("routeFeedback").style.display = "none";
  el("routeFeedback").innerHTML = "";
}
if (el("routeQuizBox")) {
  el("routeQuizBox").style.display = "none";
}

  if (el("nextBtn")) el("nextBtn").style.display = "none";

  if (el("skipQuestionBtn")) {
    el("skipQuestionBtn").style.display = state.mode === "tips" ? "none" : "inline-block";
  }

if (el("questionStartBox")) {
  el("questionStartBox").style.display = state.mode === "tips" ? "none" : "block";

  if (q.route && q.route.length > 0) {
    el("questionStartBox").innerHTML = `
      <p class="start-text">
        まずはこの問題の解き方（方針）を選んでください。<br>
        方針が正しければ問題が開始されます。
      </p>
      <button class="btn primary" id="startQuestionBtn">方針を確認</button>
    `;
  } else {
    el("questionStartBox").innerHTML = `
      <p class="start-text">
        準備ができたら「この問題を開始」を押してください。<br>
        問題ごとに制限時間は変わります。
      </p>
      <button class="btn primary" id="startQuestionBtn">この問題を開始</button>
    `;
  }
}

if (el("startQuestionBtn")) {
  el("startQuestionBtn").onclick = startQuestionTimer;
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
   早合点防止：仮選択→確定の2段階クリック
   選んだ瞬間に即採点せず、一度立ち止まって他の選択肢も
   見てから確定させることで「早合点」による誤答を減らす。
   他の選択肢をタップすると「消去済み」トグル（取り消し線）になり、
   自分の判断過程を可視化できる（採点には影響しない）。
========================= */
function selectCandidate(index, btnEl) {
  const box = el("optionsBox");
  if (!box || box.classList.contains("disabled")) return;

  // すでに仮選択がある状態で「別の」選択肢をタップした場合は
  // 消去法メモ（取り消し線）のトグルとして扱う
  if (state.candidateIndex !== null && state.candidateIndex !== index) {
    btnEl.classList.toggle("eliminated");
    return;
  }

  // 消去済みにしていた選択肢を仮選択には戻さない（一貫性のため解除してから選ばせる）
  if (btnEl.classList.contains("eliminated")) {
    btnEl.classList.remove("eliminated");
    return;
  }

  state.candidateIndex = index;

  Array.from(box.children).forEach((child) => {
    child.classList.remove("candidate");
  });
  btnEl.classList.add("candidate");

  showConfirmBar(index);
}

function showConfirmBar(index) {
  removeConfirmBar();
  const box = el("optionsBox");
  if (!box) return;

  const bar = document.createElement("div");
  bar.id = "confirmBar";
  bar.className = "confirm-bar";
  bar.innerHTML = `
    <div class="confirm-hint">その答えで確定する前に、他の選択肢も一度見てみよう。違うと思うものはタップすると消せます。</div>
    <button class="btn primary" id="confirmAnswerBtn">この答えで確定する</button>
  `;
  box.insertAdjacentElement("afterend", bar);

  const confirmBtn = el("confirmAnswerBtn");
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      removeConfirmBar();
      answer(index);
    };
  }
}

function removeConfirmBar() {
  const bar = el("confirmBar");
  if (bar) bar.remove();
}

/* =========================
   穴埋め式(fillin)問題：入力欄の描画・有効化・採点
   選択式(4択)とは別の描画パスを持つ。既存の選択式の描画・採点は一切触らない。
========================= */
function renderFillinBlanks(q) {
  const box = el("fillinBox");
  if (!box) return;

  box.innerHTML = "";
  box.style.display = "block";

  q.blanks.forEach((b) => {
    const row = document.createElement("div");
    row.className = "fillin-row";

    const label = document.createElement("span");
    label.className = "fillin-label";
    label.innerText = b.label;
    row.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "fillin-input";
    input.dataset.blankId = b.id;
    input.disabled = true;
    input.autocomplete = "off";
    row.appendChild(input);

    const answerNote = document.createElement("span");
    answerNote.className = "fillin-answer";
    answerNote.dataset.blankId = b.id;
    row.appendChild(answerNote);

    box.appendChild(row);
  });

  const btnWrap = document.createElement("div");
  btnWrap.className = "toolbar q-toolbar";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn primary";
  submitBtn.id = "submitFillinBtn";
  submitBtn.innerText = "採点する";
  submitBtn.disabled = true;
  submitBtn.onclick = submitFillin;
  btnWrap.appendChild(submitBtn);

  box.appendChild(btnWrap);
}

// 「この問題を開始」「方針確定」などのタイミングで、選択肢ボタンと同じように呼ぶ。
// fillin問題でなければ何もしない（呼び出し側で型を気にしなくていいようにするため）。
function enableFillinInputs() {
  document.querySelectorAll("#fillinBox input").forEach((inp) => {
    inp.disabled = false;
  });
  const submitBtn = el("submitFillinBtn");
  if (submitBtn) submitBtn.disabled = false;
}

function lockFillinAndMark(results) {
  document.querySelectorAll("#fillinBox input").forEach((inp) => {
    inp.disabled = true;
  });
  const submitBtn = el("submitFillinBtn");
  if (submitBtn) submitBtn.disabled = true;

  results.forEach((r) => {
    const inp = document.querySelector(`#fillinBox input[data-blank-id="${r.id}"]`);
    if (inp) inp.classList.add(r.isCorrect ? "correct" : "wrong");

    if (!r.isCorrect) {
      const noteEl = document.querySelector(`#fillinBox .fillin-answer[data-blank-id="${r.id}"]`);
      if (noteEl) noteEl.innerText = `正解: ${r.correctDisplay}`;
    }
  });
}

// 各blankを採点し、{id, label, isCorrect, tag, userRaw, correctDisplay} の配列を返す
function gradeFillinBlanks(q) {
  return q.blanks.map((b) => {
    const inp = document.querySelector(`#fillinBox input[data-blank-id="${b.id}"]`);
    const raw = inp ? inp.value : "";
    const userNorm = normalizeAnswer(raw);
    const answerNorm = normalizeAnswer(b.answer);
    const altNorms = (b.altAnswers || []).map(normalizeAnswer);
    const isCorrect = userNorm !== "" && (userNorm === answerNorm || altNorms.includes(userNorm));

    let tag = "correct";
    if (!isCorrect) {
      if (userNorm === "") {
        tag = "skipped";
      } else {
        const miss = (b.commonMistakes || []).find((m) => normalizeAnswer(m.value) === userNorm);
        tag = miss ? miss.tag : "calc_error";
      }
    }

    return { id: b.id, label: b.label, isCorrect, tag, userRaw: raw, correctDisplay: b.answer };
  });
}

function submitFillin() {
  const q = currentQuestion();
  if (!q || q.type !== "fillin") return;

  clearInterval(state.timer);

  const results = gradeFillinBlanks(q);
  const overallCorrect = results.every((r) => r.isCorrect);
  // 最初に間違えたblankのタグを代表タグとして記録する（近似。複数blank同時ミスの詳細はresults自体に残っている）
  const overallTag = overallCorrect ? "correct" : (results.find((r) => !r.isCorrect) || {}).tag || "calc_error";

  logFillinAnswer(q, results, overallTag, overallCorrect, "answered");

  state.total++;
  stats.stage[q.stage].t++;

  if (overallCorrect) {
    state.correct++;
    stats.stage[q.stage].c++;
  } else {
    stats.weakness[q.weakness] = (stats.weakness[q.weakness] || 0) + 1;
    addReviewTarget(q);
  }

  if (state.mode === "review" || state.mode === "dueReview") {
    markReviewResult(q, overallCorrect);
  }

  lockFillinAndMark(results);

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = explainHTML(q, overallCorrect);
  }

  if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  if (el("skipQuestionBtn")) el("skipQuestionBtn").style.display = "none";

  maybeShowStopGuide();
  update();
  save();
}

function skipFillin(q) {
  const results = q.blanks.map((b) => ({
    id: b.id, label: b.label, isCorrect: false, tag: "skipped", userRaw: "", correctDisplay: b.answer
  }));

  logFillinAnswer(q, results, "skipped", false, "skip");

  state.total++;
  stats.stage[q.stage].t++;
  stats.weakness["時間判断"] = (stats.weakness["時間判断"] || 0) + 1;
  addReviewTarget(q);

  if (state.mode === "review" || state.mode === "dueReview") {
    markReviewResult(q, false);
  }

  lockFillinAndMark(results);

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = `
      <div style="font-weight:bold; font-size:18px; color:#92400e;">この設問を飛ばしました</div>
      <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${formatText(q.explain.why)}</div>
      <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${formatText(q.explain.mistake)}</div>
      <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${formatText(q.explain.tip)}</div>
    `;
  }

  if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  if (el("skipQuestionBtn")) el("skipQuestionBtn").style.display = "none";

  maybeShowStopGuide();
  update();
  save();
}

function timeoutFillin(q) {
  const results = q.blanks.map((b) => {
    const graded = gradeFillinBlanks(q).find((r) => r.id === b.id);
    return graded || { id: b.id, label: b.label, isCorrect: false, tag: "time_pressure", userRaw: "", correctDisplay: b.answer };
  });
  // 時間切れ時点の入力内容も採点対象にするが、正解でも代表タグは time_pressure 寄りにしておく
  const overallCorrect = results.every((r) => r.isCorrect);

  logFillinAnswer(q, results, overallCorrect ? "correct" : "time_pressure", overallCorrect, "timeout");

  state.total++;
  stats.stage[q.stage].t++;
  stats.weakness["時間不足"] = (stats.weakness["時間不足"] || 0) + 1;
  addReviewTarget(q);

  if (state.mode === "review" || state.mode === "dueReview") {
    markReviewResult(q, overallCorrect);
  }

  lockFillinAndMark(results);

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = `
      <div style="font-weight:bold; font-size:18px; color:#991b1b;">時間切れ</div>
      <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${formatText(q.explain.why)}</div>
      <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${formatText(q.explain.mistake)}</div>
      <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${formatText(q.explain.tip)}</div>
    `;
  }

  if (el("nextBtn")) el("nextBtn").style.display = "inline-block";
  if (el("skipQuestionBtn")) el("skipQuestionBtn").style.display = "none";

  maybeShowStopGuide();
  update();
  save();
}

/* =========================
   回答
========================= */
function answer(i) {
  const q = currentQuestion();
  if (!q) return;

  clearInterval(state.timer);

  const ok = i === q.correct;

  logAnswer(q, i, "answered");

  state.total++;
  stats.stage[q.stage].t++;

  if (ok) {
    state.correct++;
    stats.stage[q.stage].c++;
  } else {
    stats.weakness[q.weakness] = (stats.weakness[q.weakness] || 0) + 1;

    // 通常の不正解も復習/TIPS対象に入れる
    addReviewTarget(q);
  }

  if (state.mode === "review" || state.mode === "dueReview") {
    markReviewResult(q, ok);
  }

  lockOptionsAndMark(q.correct, i);

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
  if (!q) return;

  if (q.type === "fillin") {
    timeoutFillin(q);
    return;
  }

  clearInterval(state.timer);

  logAnswer(q, null, "timeout");

  state.total++;
  stats.stage[q.stage].t++;
  stats.weakness["時間不足"] = (stats.weakness["時間不足"] || 0) + 1;

  addReviewTarget(q);

  if (state.mode === "review" || state.mode === "dueReview") {
    markReviewResult(q, false);
  }

  // シャッフル後も正しい選択肢を緑にする
  lockOptionsAndMark(q.correct);

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = `
      <div style="font-weight:bold; font-size:18px; color:#991b1b;">時間切れ</div>
      <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${formatText(q.explain.why)}</div>
      <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${formatText(q.explain.mistake)}</div>
      <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${formatText(q.explain.tip)}</div>
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
  if (!q) return;

  if (q.type === "fillin") {
    skipFillin(q);
    return;
  }

  clearInterval(state.timer);

  logAnswer(q, null, "skip");

  state.total++;
  stats.stage[q.stage].t++;
  stats.weakness["時間判断"] = (stats.weakness["時間判断"] || 0) + 1;

  addReviewTarget(q);

  if (state.mode === "review" || state.mode === "dueReview") {
    markReviewResult(q, false);
  }

  // スキップ後に選択肢を押せないようにする
  lockOptionsAndMark(q.correct);

  if (el("feedback")) {
    el("feedback").style.display = "block";
    el("feedback").innerHTML = `
      <div style="font-weight:bold; font-size:18px; color:#92400e;">この設問を飛ばしました</div>
      <div style="margin-top:10px;"><strong>◆ 解き方</strong><br>${formatText(q.explain.why)}</div>
      <div style="margin-top:10px;"><strong>◆ ミスしやすい点</strong><br>${formatText(q.explain.mistake)}</div>
      <div style="margin-top:10px;"><strong>◆ 次へのコツ</strong><br>${formatText(q.explain.tip)}</div>
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

  // すでに終了済みなら、履歴を二重追加しない
  if (!state.finished) {
    addHistory();
    state.finished = true;
  }

  if (el("questionPanel")) el("questionPanel").style.display = "none";
  if (el("examTopbar")) el("examTopbar").style.display = "none";
  if (el("resultBox")) el("resultBox").style.display = "block";

  if (el("finalScore")) {
    el("finalScore").innerText = `${state.correct}/${state.total}`;
  }

  if (el("resultSummary")) {
    el("resultSummary").innerHTML = `
      正答率 ${rate()}%<br>
      最重要課題：${topWeak()}<br>
      方針ミス回数：${state.routeMiss}
    `;
  }

  update();
  save();
}

/* =========================
   単元選択
========================= */
function buildUnitSelectCards() {
  const box = el("unitCardList");
  if (!box) return;

  box.innerHTML = "";

  Object.keys(UNIT_META).forEach((key) => {
    const meta = UNIT_META[key];

    const card = document.createElement("div");
    card.className = "unit-card";

    card.innerHTML = `
      <h3>${meta.label}</h3>
      <p>${meta.description || ""}</p>
      <button class="btn primary">開始</button>
    `;

    const startBtn = card.querySelector("button");
    if (startBtn) {
      startBtn.onclick = () => selectUnit(key);
    }

    box.appendChild(card);
  });
}

function applyUnitUI(unit) {
  const meta = UNIT_META[unit];
  if (el("currentUnitLabel")) el("currentUnitLabel").innerText = meta.label;
  if (el("panelNote")) el("panelNote").innerText = meta.note;
  if (el("missionBoxContent")) el("missionBoxContent").innerHTML = meta.mission;
  buildStageOnlyButtons(unit);
}

function buildStageOnlyButtons(unit) {
  const box = el("stageOnlyButtons");
  if (!box) return;
  box.innerHTML = "";

  // 問題データに登場する順番でステージ名を重複なく取り出す
  const stages = [];
  UNIT_META[unit].questions.forEach((q) => {
    if (!stages.includes(q.stage)) stages.push(q.stage);
  });

  stages.forEach((stageName) => {
    const btn = document.createElement("button");
    btn.className = "btn secondary";
    btn.innerText = `${stageName}だけ`;
    btn.onclick = () => startStageOnly(stageName);
    box.appendChild(btn);
  });
}

function selectUnit(unit) {
  if (!UNIT_META[unit]) return;

  loadUnit(unit);
  applyUnitUI(unit);

  if (el("unitSelectScreen")) el("unitSelectScreen").style.display = "none";
  exitExamMode(); // controlPanelを表示し、他の画面を隠す

  update();
  renderHistory();
}

function showUnitSelect() {
  clearInterval(state.timer);

  if (el("unitSelectScreen")) el("unitSelectScreen").style.display = "block";
  if (el("controlPanel")) el("controlPanel").style.display = "none";
  if (el("examTopbar")) el("examTopbar").style.display = "none";
  if (el("questionPanel")) el("questionPanel").style.display = "none";
  if (el("resultBox")) el("resultBox").style.display = "none";

  // 画面を先頭に戻す
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* =========================
   モード開始
========================= */
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
  state.routeMiss = 0;
  state.routeTry = 0;
  state.finished = false;

  if (el("stopGuide")) el("stopGuide").style.display = "none";

  show();
  save();
}

function resumeExam() {
  const list = UNIT_META[state.unit]?.questions || [];

  if (state.finished || state.index >= list.length) {
    alert("前回の試験は終了済みです。新しく始める場合は「試験開始」を押してください。");
    return;
  }

  state.mode = "normal";
  show();
}

function startStageOnly(stageName) {
  const list = UNIT_META[state.unit].questions.filter((q) => q.stage === stageName);
  if (!list.length) {
    alert("このステージには問題がありません");
    return;
  }

  state.mode = "stage";
  state.stageFilter = stageName;
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.stopHintShown = false;
  state.routeMiss = 0;
  state.routeTry = 0;
  state.finished = false;

  if (el("stopGuide")) el("stopGuide").style.display = "none";

  show();
  save();
}

function startWrongOnlyReview() {
  if (!state.wrong.length) {
    alert("復習問題がありません");
    return;
  }

  state.mode = "review";
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.stopHintShown = false;
  state.routeMiss = 0;
  state.routeTry = 0;
  state.finished = false;

  if (el("stopGuide")) el("stopGuide").style.display = "none";

  show();
  save();
}

function startDueReview() {
  const due = dueReviewList();
  if (!due.length) {
    alert(
      state.wrong.length
        ? "今復習すべき問題はまだありません。間隔をあけて出題する仕組みなので、少し時間を置いてから来てください。"
        : "復習対象の問題がありません。"
    );
    return;
  }

  state.mode = "dueReview";
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.stopHintShown = false;
  state.routeMiss = 0;
  state.routeTry = 0;
  state.finished = false;

  if (el("stopGuide")) el("stopGuide").style.display = "none";

  show();
  save();
}

function startTipReview() {
  if (!state.tipList.length) {
    alert("復習するTIPSがありません");
    return;
  }

  state.mode = "tips";
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.stopHintShown = false;
  state.routeMiss = 0;
  state.routeTry = 0;
  state.finished = false;

  if (el("stopGuide")) el("stopGuide").style.display = "none";

  show();
  save();
}

function toggleStrictTime() {
  state.strict = !state.strict;
  if (el("toggleStrictTimeBtn")) {
    el("toggleStrictTimeBtn").innerText =
      state.strict ? "時間制限: 厳格" : "時間制限: 通常";
  }
}
function resetStatsOnly() {
  if (!state.unit) return;

  const unit = state.unit;
  const strict = state.strict;

  const ok = confirm(
    "この単元の成績・履歴・復習リストをリセットします。\nよろしいですか？"
  );

  if (!ok) return;

  state = defaultState(unit);
  stats = defaultStats();

  // 時間制限の設定は学習データではないので維持する
  state.strict = strict;

  applyUnitUI(unit);
  update();
  renderHistory();
  save();

  if (el("toggleStrictTimeBtn")) {
    el("toggleStrictTimeBtn").innerText =
      state.strict ? "時間制限: 厳格" : "時間制限: 通常";
  }

  if (el("saveStatus")) {
    el("saveStatus").innerText = "保存状態: 学習データをリセットしました";
  }

  alert("学習データをリセットしました");
}

/* =========================
   ボタン
========================= */
if (el("startExamBtn")) el("startExamBtn").onclick = startExam;
if (el("resumeExamBtn")) el("resumeExamBtn").onclick = resumeExam;
if (el("startWrongOnlyReviewBtn")) el("startWrongOnlyReviewBtn").onclick = startWrongOnlyReview;
if (el("startWrongOnlyReviewBtn2")) el("startWrongOnlyReviewBtn2").onclick = startWrongOnlyReview;
if (el("startDueReviewBtn")) el("startDueReviewBtn").onclick = startDueReview;
if (el("startTipReviewBtn")) el("startTipReviewBtn").onclick = startTipReview;
if (el("startQuestionBtn")) el("startQuestionBtn").onclick = startQuestionTimer;
if (el("nextBtn")) el("nextBtn").onclick = nextQuestion;
if (el("skipQuestionBtn")) el("skipQuestionBtn").onclick = skipQuestion;
if (el("goTopBtn")) el("goTopBtn").onclick = exitExamMode;
if (el("goTopBtn2")) el("goTopBtn2").onclick = exitExamMode;
if (el("goTopBtn3")) el("goTopBtn3").onclick = exitExamMode;
if (el("toggleStrictTimeBtn")) el("toggleStrictTimeBtn").onclick = toggleStrictTime;
if (el("resetStatsBtn")) el("resetStatsBtn").onclick = resetStatsOnly;
if (el("copyAnalysisBtn")) el("copyAnalysisBtn").onclick = copyAnalysisToClipboard;
if (el("previewAnalysisBtn")) el("previewAnalysisBtn").onclick = toggleAnalysisPreview;
function openUnitModal() {
  const current = state.unit
    ? UNIT_META[state.unit].label
    : "未選択";

  if (el("modalText")) {
    el("modalText").innerText =
      `現在の単元：${current}\n単元選択画面に戻りますか？`;
  }

  if (el("unitModal")) {
    el("unitModal").style.display = "flex";
  }
}

if (el("titleHomeBtn")) {
  el("titleHomeBtn").onclick = showUnitSelect;
}

if (el("unitCardClickable")) {
  el("unitCardClickable").onclick = openUnitModal;
}

if (el("modalCancel")) {
  el("modalCancel").onclick = () => {
    if (el("unitModal")) el("unitModal").style.display = "none";
  };
}

if (el("modalGo")) {
  el("modalGo").onclick = () => {
    if (el("unitModal")) el("unitModal").style.display = "none";
    showUnitSelect();
  };
}
/* 初期化 */
buildUnitSelectCards();

const savedUnit = localStorage.getItem(UNIT_KEY);
if (savedUnit && UNIT_META[savedUnit]) {
  selectUnit(savedUnit);
} else {
  showUnitSelect();
}
