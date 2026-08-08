/* =================================================================
   三角関数(数II) Part1 — 8問
   既存の questions_keiryo.js / questions_nijikansuu.js と同じフォーマット。
================================================================= */

const ROUTE_CHOICES_SANKAKU = [
  "基準角と象限",
  "相互関係",
  "象限での符号確認",
  "加法定理",
  "倍角公式",
  "半角公式",
  "三角方程式",
  "単位円",
  "周期",
  "グラフ",
  "最大最小"
];

const questions_sankaku_1 = [

/* =========================
第1問(基準角と象限・相互関係)
========================= */
{
id: "s1-1",
stage: "第1問",
num: 1,
time: 25,
score: 5,
weakness: "計算精度",
route: ["基準角と象限"],
q: "$\\sin150°$ の値を求めよ。",
a: ["1/2", "√3/2", "-1/2", "-√3/2"],
correct: 0,
tags: ["correct", "formula_mismatch", "sign_error", "sign_error"],
explain: {
aim: "基準角(30°)と象限からsinの符号・値を正しく判断できるかを測る問題。",
why: "$150°=180°-30°$。基準角は$30°$で、$150°$は第2象限にある。第2象限ではsinは正なので、$\\sin150°=\\sin30°=\\dfrac{1}{2}$。",
mistake: "sinとcosの値を取り違えて$\\dfrac{\\sqrt3}{2}$としたり、第2象限でsinが正であることを忘れて$-\\dfrac{1}{2}$としてしまうことがある。",
tip: "『基準角の値を出す→象限で符号を決める』の2手順を必ず分けて考える。sinはy座標なので、第1・第2象限で正。"
}
},
{
id: "s1-2",
stage: "第1問",
num: 2,
time: 25,
score: 5,
weakness: "計算精度",
route: ["基準角と象限"],
q: "$\\cos120°$ の値を求めよ。",
a: ["-1/2", "1/2", "-√3/2", "√3/2"],
correct: 0,
tags: ["correct", "sign_error", "formula_mismatch", "formula_mismatch"],
explain: {
aim: "基準角(60°)と象限からcosの符号・値を正しく判断できるかを測る問題。",
why: "$120°=180°-60°$。基準角は$60°$で、$120°$は第2象限にある。cosはx座標なので、第2象限では負。したがって$\\cos120°=-\\cos60°=-\\dfrac{1}{2}$。",
mistake: "符号を付け忘れて$\\dfrac{1}{2}$としたり、基準角を$30°$と勘違いして$\\dfrac{\\sqrt3}{2}$系の値を選んでしまうことがある。",
tip: "cosはx座標。第2・第3象限（x座標が負の側）では必ず負になる。"
}
},
{
id: "s1-3",
stage: "第1問",
num: 3,
time: 25,
score: 5,
weakness: "計算精度",
route: ["基準角と象限"],
q: "$\\tan315°$ の値を求めよ。",
a: ["-1", "1", "√3", "-√3"],
correct: 0,
tags: ["correct", "sign_error", "formula_mismatch", "formula_mismatch"],
explain: {
aim: "基準角(45°)と象限からtanの符号・値を正しく判断できるかを測る問題。",
why: "$315°=360°-45°$。基準角は$45°$で、$315°$は第4象限にある。第4象限ではsinが負・cosが正なので、tan(=sin/cos)は負。したがって$\\tan315°=-\\tan45°=-1$。",
mistake: "第4象限での符号を確認せずに$1$としたり、基準角を$60°$と取り違えて$\\pm\\sqrt{3}$を選んでしまうことがある。",
tip: "tanの符号は『sinとcosの符号が同じ象限で正、違う象限で負』。第4象限はsin負・cos正なのでtanは負。"
}
},
{
id: "s1-4",
stage: "第1問",
num: 4,
time: 35,
score: 5,
weakness: "方針切替",
route: ["相互関係", "象限での符号確認"],
q: "$\\sin\\theta=\\dfrac{3}{5}$（$\\theta$は第2象限の角）のとき、$\\cos\\theta$ の値を求めよ。",
a: ["-4/5", "4/5", "-3/5", "3/5"],
correct: 0,
tags: ["correct", "condition_misread", "concept_gap", "concept_gap"],
explain: {
aim: "相互関係$\\sin^2\\theta+\\cos^2\\theta=1$で値を出したあと、象限の条件で符号を確定できるかを測る問題。",
why: "$\\cos^2\\theta=1-\\left(\\dfrac{3}{5}\\right)^2=1-\\dfrac{9}{25}=\\dfrac{16}{25}$ より $\\cos\\theta=\\pm\\dfrac{4}{5}$。$\\theta$は第2象限の角なのでcosは負。したがって$\\cos\\theta=-\\dfrac{4}{5}$。",
mistake: "公式で$\\pm\\dfrac{4}{5}$まで出したあと、問題文の『第2象限』という条件を見落として正の$\\dfrac{4}{5}$を選んでしまう。",
tip: "相互関係の公式は符号まで教えてくれない。$\\pm$が出たら必ず問題文の象限指定に戻って符号を決める。"
}
},

/* =========================
第2問(加法定理・倍角公式・半角公式)
========================= */
{
id: "s2-1",
stage: "第2問",
num: 1,
time: 40,
score: 5,
weakness: "方針切替",
route: ["加法定理"],
q: "加法定理を用いて $\\sin75°$ の値を求めよ。",
a: ["(√6+√2)/4", "(√6-√2)/4", "√2/2", "√3/2"],
correct: 0,
tags: ["correct", "sign_error", "concept_gap", "concept_gap"],
explain: {
aim: "特殊角の組合せ(45°+30°)を見つけ、加法定理を最後まで正しく計算できるかを測る問題。",
why: "$75°=45°+30°$と分けると、$\\sin75°=\\sin45°\\cos30°+\\cos45°\\sin30°=\\dfrac{\\sqrt2}{2}\\cdot\\dfrac{\\sqrt3}{2}+\\dfrac{\\sqrt2}{2}\\cdot\\dfrac{1}{2}=\\dfrac{\\sqrt6+\\sqrt2}{4}$。",
mistake: "加法定理の符号を間違えて$\\sin(a-b)$の式($\\dfrac{\\sqrt6-\\sqrt2}{4}$、これは$\\sin15°$)と混同してしまう。",
tip: "$\\sin(a+b)=\\sin a\\cos b+\\cos a\\sin b$、符号はすべて$+$。引き算になるのは$\\cos(a+b)$の方。"
}
},
{
id: "s2-2",
stage: "第2問",
num: 2,
time: 20,
score: 5,
weakness: "方針切替",
route: ["倍角公式"],
q: "$2\\sin\\theta\\cos\\theta$ と等しいものはどれか。",
a: ["sin2θ", "cos2θ", "tan2θ", "2cos2θ"],
correct: 0,
tags: ["correct", "formula_mismatch", "formula_mismatch", "formula_mismatch"],
explain: {
aim: "sinの倍角公式($2\\sin\\theta\\cos\\theta=\\sin2\\theta$)をそのまま認識できるかを測る問題。",
why: "倍角公式より$\\sin2\\theta=2\\sin\\theta\\cos\\theta$。したがって$2\\sin\\theta\\cos\\theta=\\sin2\\theta$。",
mistake: "cosの倍角公式($\\cos2\\theta=\\cos^2\\theta-\\sin^2\\theta$)やtanの式と取り違えてしまう。",
tip: "『sinの倍角は2sin×cos』を1セットで覚える。積の形→sin2θ、と反射で結びつける。"
}
},
{
id: "s2-3",
stage: "第2問",
num: 3,
time: 30,
score: 5,
weakness: "方針切替",
route: ["半角公式"],
q: "$\\cos^2\\theta$ を、$\\cos2\\theta$ を用いて表したものはどれか。",
a: ["(1+cos2θ)/2", "(1-cos2θ)/2", "1-sin²θ", "2cosθ"],
correct: 0,
tags: ["correct", "sign_error", "condition_misread", "concept_gap"],
explain: {
aim: "半角公式を、符号を間違えずに導けるかを測る問題。",
why: "倍角公式$\\cos2\\theta=2\\cos^2\\theta-1$を変形すると$2\\cos^2\\theta=1+\\cos2\\theta$。よって$\\cos^2\\theta=\\dfrac{1+\\cos2\\theta}{2}$。",
mistake: "sin²の半角公式($\\dfrac{1-\\cos2\\theta}{2}$)と混同してマイナスにしてしまう。",
tip: "『cos²は＋、sin²は−』とセットで覚える。$1-\\sin^2\\theta=\\cos^2\\theta$は正しい式だが、$\\cos2\\theta$を使った表現にはなっていない点に注意。"
}
},
{
id: "s2-4",
stage: "第2問",
num: 4,
time: 35,
score: 5,
weakness: "方針切替",
route: ["加法定理"],
q: "加法定理を用いて $\\cos75°$ の値を求めよ。",
a: ["(√6-√2)/4", "(√6+√2)/4", "√2/2", "1/2"],
correct: 0,
tags: ["correct", "sign_error", "concept_gap", "concept_gap"],
explain: {
aim: "cosの加法定理を、sinの加法定理と混同せず正しい符号で使えるかを測る問題。",
why: "$75°=45°+30°$と分けると、$\\cos75°=\\cos45°\\cos30°-\\sin45°\\sin30°=\\dfrac{\\sqrt2}{2}\\cdot\\dfrac{\\sqrt3}{2}-\\dfrac{\\sqrt2}{2}\\cdot\\dfrac{1}{2}=\\dfrac{\\sqrt6-\\sqrt2}{4}$。",
mistake: "$\\cos(a+b)$の符号を$+$にしてしまい、$\\sin75°$の値($\\dfrac{\\sqrt6+\\sqrt2}{4}$)と取り違える。",
tip: "$\\cos(a+b)=\\cos a\\cos b-\\sin a\\sin b$、符号は$-$。sinの加法定理と真逆になる点を意識する。"
}
}

];
