/* =================================================================
   図形ユニット「補助三角形の発見」(数学ⅠA) — 10問
   既存の questions_seishitsu.js などと同じフォーマット。
   単元選択UIから "hojosankaku" として読み込まれることを想定。

   出題意図（作問仕様書より）:
   共通テスト本番レベル模試 数ⅠA第3問(2)で、図に明示されている線分・直角を使う
   設問(コまで)は全問正解だったが、図に描かれていない直角三角形(AP'P'')を
   自分で切り出す設問(サ)で完全に停止した。
   このユニットは「単なる三平方ドリル」ではなく、
   「どの直角三角形に注目するか」を自分で発見する力そのものを鍛える。

   段階設計:
   第1問(A群 ho1-1〜ho1-4): 注目すべき直角三角形を選ぶだけ。計算はさせない。
   第2問(B群 ho2-1〜ho2-3): 三角形を選んだ直後に、その三角形で長さを求める(2段階)。
   第3問(C群 ho3-1〜ho3-3): 誘導なしでいきなり長さを問う。模試のサと同じ状態。

   探索手順(全問の解説冒頭で同じ言葉を繰り返す):
   1. 長さが分かっている線分に印をつける
   2. その中から、直角を挟んでいる2本の組を探す
   3. その2本を辺に持つ三角形が、注目すべき直角三角形
================================================================= */

const ROUTE_CHOICES_HOJOSANKAKU = [
  "共通接線と2円の中心",
  "直方体の空間対角線",
  "円錐の母線",
  "円の弦と中心からの垂線",
  "内接円の接点",
  "共通弦の垂直二等分線",
  "角の二等分線と外部点"
];

const SEARCH_STEPS = "まず、次の手順を毎回同じ順番でたどる。\n\n1. 長さが分かっている線分に印をつける\n\n2. その中から、直角を挟んでいる2本の組を探す\n\n3. その2本を辺に持つ三角形が、注目すべき直角三角形\n\n";

const questions_hojosankaku = [

/* =========================
第1問(A群・選ぶだけ・4問)
========================= */
{
id: "ho1-1",
stage: "第1問",
num: 1,
time: 30,
score: 5,
weakness: "方針切替",
route: ["共通接線と2円の中心"],
q: "半径4rの円Oと半径rの円O'が外接しており、共通の接線がこの2円にそれぞれ点A、点Bで接している(図)。2つの接点間の距離ABを求めたい。このとき、どの直角三角形に注目すればよいか。",
svg: `<svg viewBox="0 0 340 230" class="diagram-svg" role="img" aria-label="外接する2円と共通接線">
  <line class="thin" x1="20" y1="200" x2="320" y2="200"/>
  <circle class="shape" cx="150" cy="120" r="80"/>
  <circle class="shape" cx="230" cy="180" r="20"/>
  <line class="thin dash" x1="150" y1="120" x2="230" y2="180"/>
  <line class="thin dash" x1="150" y1="120" x2="150" y2="200"/>
  <line class="thin dash" x1="230" y1="180" x2="230" y2="200"/>
  <circle class="point" cx="150" cy="120" r="4"/>
  <circle class="point" cx="230" cy="180" r="4"/>
  <circle class="point" cx="150" cy="200" r="4"/>
  <circle class="point" cx="230" cy="200" r="4"/>
  <text class="label" x="142" y="110">O</text>
  <text class="label" x="238" y="172">O'</text>
  <text class="label" x="144" y="216">A</text>
  <text class="label" x="224" y="216">B</text>
  <text class="ratio" x="132" y="160">4r</text>
  <text class="ratio" x="238" y="190">r</text>
  <text class="ratio" x="180" y="142">OO'=5r</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 340 230" class="diagram-svg" role="img" aria-label="外接する2円と共通接線(注目すべき三角形を強調)">
  <line class="thin" x1="20" y1="200" x2="320" y2="200"/>
  <circle class="shape" cx="150" cy="120" r="80"/>
  <circle class="shape" cx="230" cy="180" r="20"/>
  <line class="thin dash" x1="150" y1="120" x2="230" y2="180"/>
  <line class="thin dash" x1="150" y1="120" x2="150" y2="200"/>
  <line class="thin dash" x1="230" y1="180" x2="230" y2="200"/>
  <circle class="point" cx="150" cy="120" r="4"/>
  <circle class="point" cx="230" cy="180" r="4"/>
  <circle class="point" cx="150" cy="200" r="4"/>
  <circle class="point" cx="230" cy="200" r="4"/>
  <text class="label" x="142" y="110">O</text>
  <text class="label" x="238" y="172">O'</text>
  <text class="label" x="144" y="216">A</text>
  <text class="label" x="224" y="216">B</text>
  <text class="ratio" x="132" y="160">4r</text>
  <text class="ratio" x="238" y="190">r</text>
  <text class="ratio" x="180" y="142">OO'=5r</text>
  <line class="reveal-line" x1="150" y1="120" x2="150" y2="180"/>
  <line class="reveal-line" x1="150" y1="180" x2="230" y2="180"/>
  <line class="reveal-line" x1="150" y1="120" x2="230" y2="180"/>
  <circle class="reveal-point" cx="150" cy="180" r="4"/>
  <text class="reveal-label" x="116" y="176">C</text>
</svg>`,
a: [
  "線分ABの中点Fによる三角形OO'F",
  "点O、点O'、点Aによる三角形OO'A",
  "半径OAの延長上にとった点Cによる三角形OO'C",
  "点O、点O'、点Bによる三角形OO'B"
],
correct: 2,
tags: ["formula_mismatch", "concept_gap", "correct", "concept_gap"],
explain: {
  aim: "外接する2円と共通接線という『何本もの既知の長さが同時に見える』場面で、実際に計算に使える直角三角形を自分で切り出せるかを測る問題。",
  why: SEARCH_STEPS + "この図で長さが分かっているのはOA=4r、O'B=r、OO'=5r(2円が外接するので中心間距離=半径の和)の3つ。\n\n直角を挟んでいるのは、OAと接線ABの交点Aでできる角(OA⊥接線)、O'Bと接線の交点Bでできる角(O'B⊥接線)だが、三角形OO'Aや三角形OO'Bには、O・O'を結ぶ辺との間に直角はできていない。\n\n一方、Oから伸びる半径OAの延長上に、O'から下ろした垂線の足Cをとると、OC=OA-O'B=4r-r=3r(すでに分かっている2つの半径の差として求まる)。\n\nO'Cは接線ABと平行(長方形の性質)なので、O'C=AB(今求めたい量)。\n\nこの直角三角形OO'Cは、脚OC=3rと斜辺OO'=5rの両方が分かっているので、三平方の定理でO'C(=AB)を計算できる。",
  mistake: "線分ABの中点Fを使う三角形OO'Fは、実はFのところにも直角ができる(気づきにくいが本当)。ところが、その直角を挟む2辺OF・O'Fはどちらも問題文の数値から直接は分からない長さで、その場では計算できない。『直角三角形に見える』ことと『計算できる』ことは別。三角形OO'A・三角形OO'Bにいたっては、そもそも直角ができていない。",
  tip: "図に何本も長さが書き込まれていると、直角三角形はいくつも『見えて』しまう。その中から実際に選ぶ基準は『直角を挟む2辺の長さが両方とも分かっているか』の1点だけ。"
}
},

{
id: "ho1-2",
stage: "第1問",
num: 2,
time: 30,
score: 5,
weakness: "方針切替",
route: ["直方体の空間対角線"],
q: "直方体ABCD-EFGHがあり、AB=3、BC=4、AC=5(すでに底面の対角線として求めてある)、CG=12である。このとき、空間対角線AGの長さを求めるには、どの直角三角形に注目すればよいか。",
svg: `<svg viewBox="0 0 220 260" class="diagram-svg" role="img" aria-label="直方体の対角線">
  <polygon class="shape" points="60,220 102,220 130.0,200.4 88.0,200.4"/>
  <line class="thin" x1="60" y1="220" x2="60" y2="52"/>
  <line class="thin" x1="102" y1="220" x2="102" y2="52"/>
  <line class="thin" x1="130.0" y1="200.4" x2="130.0" y2="32.4"/>
  <line class="thin dash" x1="88.0" y1="200.4" x2="88.0" y2="32.4"/>
  <line class="thin" x1="60" y1="52" x2="102" y2="52"/>
  <line class="thin" x1="102" y1="52" x2="130.0" y2="32.4"/>
  <line class="thin dash" x1="130.0" y1="32.4" x2="88.0" y2="32.4"/>
  <line class="thin dash" x1="60" y1="52" x2="88.0" y2="32.4"/>
  <line class="thin dash" x1="60" y1="220" x2="130.0" y2="32.4"/>
  <line class="thin dash" x1="60" y1="220" x2="130.0" y2="200.4"/>
  <circle class="point" cx="60" cy="220" r="4"/>
  <circle class="point" cx="130.0" cy="200.4" r="4"/>
  <circle class="point" cx="130.0" cy="32.4" r="4"/>
  <text class="label" x="46" y="224">A</text>
  <text class="label" x="108" y="236">B</text>
  <text class="label" x="136.0" y="204.4">C</text>
  <text class="label" x="84.0" y="194.4">D</text>
  <text class="label" x="136.0" y="26.4">G</text>
  <text class="ratio" x="75" y="236">3</text>
  <text class="ratio" x="58.0" y="212.0">4</text>
  <text class="ratio" x="36" y="136">12</text>
  <text class="small-label" x="95" y="222">AC=5</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 220 260" class="diagram-svg" role="img" aria-label="直方体の対角線(注目すべき三角形を強調)">
  <polygon class="shape" points="60,220 102,220 130.0,200.4 88.0,200.4"/>
  <line class="thin" x1="60" y1="220" x2="60" y2="52"/>
  <line class="thin" x1="102" y1="220" x2="102" y2="52"/>
  <line class="thin" x1="130.0" y1="200.4" x2="130.0" y2="32.4"/>
  <line class="thin dash" x1="88.0" y1="200.4" x2="88.0" y2="32.4"/>
  <line class="thin" x1="60" y1="52" x2="102" y2="52"/>
  <line class="thin" x1="102" y1="52" x2="130.0" y2="32.4"/>
  <line class="thin dash" x1="130.0" y1="32.4" x2="88.0" y2="32.4"/>
  <line class="thin dash" x1="60" y1="52" x2="88.0" y2="32.4"/>
  <line class="thin dash" x1="60" y1="220" x2="130.0" y2="32.4"/>
  <line class="thin dash" x1="60" y1="220" x2="130.0" y2="200.4"/>
  <circle class="point" cx="60" cy="220" r="4"/>
  <circle class="point" cx="130.0" cy="200.4" r="4"/>
  <circle class="point" cx="130.0" cy="32.4" r="4"/>
  <text class="label" x="46" y="224">A</text>
  <text class="label" x="108" y="236">B</text>
  <text class="label" x="136.0" y="204.4">C</text>
  <text class="label" x="84.0" y="194.4">D</text>
  <text class="label" x="136.0" y="26.4">G</text>
  <text class="ratio" x="75" y="236">3</text>
  <text class="ratio" x="58.0" y="212.0">4</text>
  <text class="ratio" x="36" y="136">12</text>
  <text class="small-label" x="95" y="222">AC=5</text>
  <line class="reveal-line" x1="60" y1="220" x2="130.0" y2="200.4"/>
  <line class="reveal-line" x1="130.0" y1="200.4" x2="130.0" y2="32.4"/>
  <line class="reveal-line" x1="60" y1="220" x2="130.0" y2="32.4"/>
  <polyline class="reveal-angle" points="116.52,204.17 116.52,190.17 130.0,186.4"/>
  <text class="reveal-label small-label" x="60" y="182">(実際は直角)</text>
</svg>`,
a: [
  "点A、点C、点Gでできる三角形ACG",
  "点A、点B、点Gでできる三角形ABG",
  "点B、点C、点Gでできる三角形BCG",
  "点A、点B、点Cでできる三角形ABC"
],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "near_miss"],
explain: {
  aim: "立体の中で『すでに1回三平方を使って求めた対角線』を、次の三平方の計算にそのまま使える辺として認識できるかを測る問題。",
  why: SEARCH_STEPS + "この図で長さが分かっているのはAB=3、BC=4、AC=5(底面の対角線)、CG=12の4つ。\n\n三角形ABGはBで直角になるが、AB=3は分かってもBGが分からない。三角形BCGはCで直角になるが、これはBGを求める三角形であり、AGには直接つながらない。\n\n三角形ACGに注目すると、ACは底面にありCGは底面に垂直な辺なので、Cで直角(AC⊥CG)。\n\nAC=5とCG=12がどちらもすでに分かっているので、三平方の定理でAG=$\\sqrt{5^{2}+12^{2}}=\\sqrt{25+144}=\\sqrt{169}=13$と計算できる。",
  mistake: "三角形ABCはAC=5を求めるときにすでに使った三角形。もう一度この三角形だけを見て『AB=3、BC=4しかないから計算できない』と立ち止まってしまい、AC=5がすでに求まっていることを図の中から拾い直せないことが多い。『前の設問で求めた値を、次の三角形の既知の辺としてそのまま使う』という発想の切り替えがこの問題の核心。",
  tip: "立体図形では、1つの三平方で終わらず『すでに求めた対角線』を次の三角形の1辺として使う2段階の問題が定番。図の中に途中の答え(この場合はAC=5)が書き込まれていたら、それは次の三角形の部品だと考える。"
}
},

{
id: "ho1-3",
stage: "第1問",
num: 3,
time: 30,
score: 5,
weakness: "方針切替",
route: ["円錐の母線"],
q: "底面の半径5、高さ12の円錐がある。頂点をH、底面の中心をO、底面の円周上の1点をAとする。底面の円周上にはAのほかにもう1点A'があるとする。母線HAの長さを求めるには、どの直角三角形に注目すればよいか。",
svg: `<svg viewBox="0 0 300 250" class="diagram-svg" role="img" aria-label="円錐の母線">
  <ellipse class="thin" cx="150" cy="220" rx="60" ry="14"/>
  <line class="thin" x1="90" y1="220" x2="150" y2="76"/>
  <line class="thin" x1="210" y1="220" x2="150" y2="76"/>
  <line class="thin dash" x1="150" y1="76" x2="150" y2="220"/>
  <line class="thin dash" x1="150" y1="220" x2="210" y2="220"/>
  <circle class="point" cx="150" cy="76" r="4"/>
  <circle class="point" cx="150" cy="220" r="4"/>
  <circle class="point" cx="210" cy="220" r="4"/>
  <circle class="point" cx="90" cy="220" r="4"/>
  <text class="label" x="144" y="68">H</text>
  <text class="label" x="142" y="238">O</text>
  <text class="label" x="216" y="224">A</text>
  <text class="ratio" x="126" y="148">高さ12</text>
  <text class="ratio" x="174" y="238">半径5</text>
  <text class="small-label" x="186" y="144">母線(未知)</text>
  <text class="ratio" x="172" y="204">直径10(未使用)</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 300 250" class="diagram-svg" role="img" aria-label="円錐の母線(注目すべき三角形を強調)">
  <ellipse class="thin" cx="150" cy="220" rx="60" ry="14"/>
  <line class="thin" x1="90" y1="220" x2="150" y2="76"/>
  <line class="thin" x1="210" y1="220" x2="150" y2="76"/>
  <line class="thin dash" x1="150" y1="76" x2="150" y2="220"/>
  <line class="thin dash" x1="150" y1="220" x2="210" y2="220"/>
  <circle class="point" cx="150" cy="76" r="4"/>
  <circle class="point" cx="150" cy="220" r="4"/>
  <circle class="point" cx="210" cy="220" r="4"/>
  <circle class="point" cx="90" cy="220" r="4"/>
  <text class="label" x="144" y="68">H</text>
  <text class="label" x="142" y="238">O</text>
  <text class="label" x="216" y="224">A</text>
  <text class="ratio" x="126" y="148">高さ12</text>
  <text class="ratio" x="174" y="238">半径5</text>
  <text class="small-label" x="186" y="144">母線(未知)</text>
  <text class="ratio" x="172" y="204">直径10(未使用)</text>
  <line class="reveal-line" x1="150" y1="76" x2="150" y2="220"/>
  <line class="reveal-line" x1="150" y1="220" x2="210" y2="220"/>
  <line class="reveal-line" x1="150" y1="76" x2="210" y2="220"/>
</svg>`,
a: [
  "頂点H、点A、点A'でできる三角形HAA'",
  "点O、点A、点A'でできる三角形OAA'",
  "頂点H、点O、線分HAの中点Mでできる三角形HOM",
  "頂点H、点O、点Aでできる三角形HOA"
],
correct: 3,
tags: ["concept_gap", "concept_gap", "formula_mismatch", "correct"],
explain: {
  aim: "円錐の展開図や見た目の丸みに惑わされず、高さ・半径・母線という3つの既知量を結ぶ『軸を含む断面』の直角三角形を切り出せるかを測る問題。",
  why: SEARCH_STEPS + "この図で長さが分かっているのは高さHO=12、半径OA=5の2つ。\n\n円錐の頂点から底面へ下ろした高さHOは、底面に垂直である(円錐の定義)。\n\nしたがってOでの角HOAは直角になり、直角三角形HOAでは脚HO=12と脚OA=5の両方が既知。\n\nよって母線HA=$\\sqrt{12^{2}+5^{2}}=\\sqrt{144+25}=\\sqrt{169}=13$と計算できる。",
  mistake: "三角形HAA'や三角形OAA'は、円周上の2点A、A'を結んだだけで、AA'の長さも角度も問題文からは分からないため計算できない。三角形HOMは中点Mまでの距離が与えられておらず、これも使えない。また、図中の底面の直径10(=半径5の2倍)を見て『これも使えそうな数値だ』と反応し、高さ12との組み合わせで$\\sqrt{12^{2}+10^{2}}$のように直径をそのまま脚として使ってしまう誤りもある。直径は半径OAから機械的に求まる値であり、母線の計算に必要な『高さと半径の直角三角形』には無関係。",
  tip: "円錐・角錐の母線を求めるときは、必ず『頂点・底面の中心・底面上の1点』の3点で作る直角三角形(軸を含む断面)を最初に探す。円周上の2点を結ぶ発想は基本的に使わない。"
}
},

{
id: "ho1-4",
stage: "第1問",
num: 4,
time: 30,
score: 5,
weakness: "方針切替",
route: ["円の弦と中心からの垂線"],
q: "半径10の円Oがあり、弦PQがある。中心Oから弦PQに下ろした垂線の足をHとすると、OH=6である。弦PQの長さを求めるには、どの直角三角形に注目すればよいか。",
svg: `<svg viewBox="0 0 300 250" class="diagram-svg" role="img" aria-label="円の弦">
  <circle class="shape" cx="150" cy="140" r="100"/>
  <line class="thin" x1="70" y1="200" x2="230" y2="200"/>
  <line class="thin dash" x1="150" y1="140" x2="150" y2="200"/>
  <line class="thin dash" x1="150" y1="140" x2="230" y2="200"/>
  <circle class="point" cx="150" cy="140" r="4"/>
  <circle class="point" cx="150" cy="200" r="4"/>
  <circle class="point" cx="70" cy="200" r="4"/>
  <circle class="point" cx="230" cy="200" r="4"/>
  <text class="label" x="136" y="132">O</text>
  <text class="label" x="134" y="216">H</text>
  <text class="label" x="56" y="216">P</text>
  <text class="label" x="236" y="216">Q</text>
  <text class="ratio" x="116" y="170">OH=6</text>
  <text class="ratio" x="140" y="70">半径10</text>
  <text class="ratio" x="168" y="100">直径20(未使用)</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 300 250" class="diagram-svg" role="img" aria-label="円の弦(注目すべき三角形を強調)">
  <circle class="shape" cx="150" cy="140" r="100"/>
  <line class="thin" x1="70" y1="200" x2="230" y2="200"/>
  <line class="thin dash" x1="150" y1="140" x2="150" y2="200"/>
  <line class="thin dash" x1="150" y1="140" x2="230" y2="200"/>
  <circle class="point" cx="150" cy="140" r="4"/>
  <circle class="point" cx="150" cy="200" r="4"/>
  <circle class="point" cx="70" cy="200" r="4"/>
  <circle class="point" cx="230" cy="200" r="4"/>
  <text class="label" x="136" y="132">O</text>
  <text class="label" x="134" y="216">H</text>
  <text class="label" x="56" y="216">P</text>
  <text class="label" x="236" y="216">Q</text>
  <text class="ratio" x="116" y="170">OH=6</text>
  <text class="ratio" x="140" y="70">半径10</text>
  <text class="ratio" x="168" y="100">直径20(未使用)</text>
  <line class="reveal-line" x1="150" y1="140" x2="150" y2="200"/>
  <line class="reveal-line" x1="150" y1="200" x2="70" y2="200"/>
  <line class="reveal-line" x1="150" y1="140" x2="70" y2="200"/>
</svg>`,
a: [
  "点Oと点Pだけを結んだ線分(三角形として成立しない)",
  "中心O、点H、点Pでできる三角形OHP",
  "点H、点P、点Qでできる三角形HPQ",
  "中心O、点P、点Qでできる三角形OPQ"
],
correct: 1,
tags: ["condition_misread", "correct", "diagram_reading", "concept_gap"],
explain: {
  aim: "『中心から弦に下ろした垂線は弦を2等分する』という性質を使って、半径・垂線・半弦の直角三角形を自分で作れるかを測る問題。",
  why: SEARCH_STEPS + "この図で長さが分かっているのは半径OP=10、垂線OH=6の2つ。\n\n中心から弦へ下ろした垂線は弦を2等分するので、Hは弦PQの中点であり、OH⊥PQ。\n\nしたがって直角三角形OHPでは、斜辺OP=10(半径)と脚OH=6の両方が既知。\n\nよってPH=$\\sqrt{10^{2}-6^{2}}=\\sqrt{100-36}=\\sqrt{64}=8$。PQはPHの2倍なので、PQ=16。",
  mistake: "三角形OPQは二等辺三角形だが、頂点Oでの角も底角も分かっていないため直角三角形として使えない。『点Oと点Pだけ』は三角形にすらならない(2点しかない)。点H、P、Qは一直線上にあるため、これも三角形が成立しない。また、図中の直径20(=半径10の2倍)を『これも使える数値だ』と思い込み、半径10の代わりに直径20を斜辺として使って$\\sqrt{20^{2}-6^{2}}$のように計算してしまう誤りもある。直径は半径から機械的に求まる値であり、この計算には使わない。",
  tip: "円の弦の問題では『中心からの垂線=弦の垂直二等分線』を使い、半径・垂線・半弦の直角三角形を作るのが定石。弦の両端と中心を結んだだけの二等辺三角形では、角度が分からない限り計算できない。"
}
},

/* =========================
第2問(B群・選ぶ→計算・3問)
========================= */
{
id: "ho2-1",
stage: "第2問",
num: 1,
time: 45,
score: 6,
weakness: "方針切替",
route: ["共通接線と2円の中心"],
q: "半径9の円Oと半径1の円O'が外接しており、共通の接線がこの2円にそれぞれ点A、点Bで接している。2つの接点間の距離ABを求めよ。",
svg: `<svg viewBox="0 0 320 220" class="diagram-svg" role="img" aria-label="外接する2円(半径9と1)と共通接線">
  <line class="thin" x1="20" y1="200" x2="300" y2="200"/>
  <circle class="shape" cx="140" cy="110" r="90"/>
  <circle class="shape" cx="200" cy="190" r="10"/>
  <line class="thin dash" x1="140" y1="110" x2="200" y2="190"/>
  <line class="thin dash" x1="140" y1="110" x2="140" y2="200"/>
  <line class="thin dash" x1="200" y1="190" x2="200" y2="200"/>
  <circle class="point" cx="140" cy="110" r="4"/>
  <circle class="point" cx="200" cy="190" r="4"/>
  <circle class="point" cx="140" cy="200" r="4"/>
  <circle class="point" cx="200" cy="200" r="4"/>
  <text class="label" x="132" y="96">O</text>
  <text class="label" x="208" y="182">O'</text>
  <text class="label" x="134" y="216">A</text>
  <text class="label" x="194" y="216">B</text>
  <text class="ratio" x="126" y="155">9</text>
  <text class="ratio" x="208" y="195">1</text>
  <text class="ratio" x="156" y="144">OO'=10</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 320 220" class="diagram-svg" role="img" aria-label="外接する2円(半径9と1)と共通接線(注目すべき三角形を強調)">
  <line class="thin" x1="20" y1="200" x2="300" y2="200"/>
  <circle class="shape" cx="140" cy="110" r="90"/>
  <circle class="shape" cx="200" cy="190" r="10"/>
  <line class="thin dash" x1="140" y1="110" x2="200" y2="190"/>
  <line class="thin dash" x1="140" y1="110" x2="140" y2="200"/>
  <line class="thin dash" x1="200" y1="190" x2="200" y2="200"/>
  <circle class="point" cx="140" cy="110" r="4"/>
  <circle class="point" cx="200" cy="190" r="4"/>
  <circle class="point" cx="140" cy="200" r="4"/>
  <circle class="point" cx="200" cy="200" r="4"/>
  <text class="label" x="132" y="96">O</text>
  <text class="label" x="208" y="182">O'</text>
  <text class="label" x="134" y="216">A</text>
  <text class="label" x="194" y="216">B</text>
  <text class="ratio" x="126" y="155">9</text>
  <text class="ratio" x="208" y="195">1</text>
  <text class="ratio" x="156" y="144">OO'=10</text>
  <line class="reveal-line" x1="140" y1="110" x2="140" y2="190"/>
  <line class="reveal-line" x1="140" y1="190" x2="200" y2="190"/>
  <line class="reveal-line" x1="140" y1="110" x2="200" y2="190"/>
  <circle class="reveal-point" cx="140" cy="190" r="4"/>
  <text class="reveal-label" x="106" y="186">C</text>
</svg>`,
a: ["8", "2", "6", "0"],
correct: 2,
tags: ["formula_mismatch", "concept_gap", "correct", "calc_error"],
explain: {
  aim: "『中心と接点で直角三角形を作る』手順を、実際の数値で最後の計算まで正しく行えるかを測る問題。",
  why: SEARCH_STEPS + "分かっているのはOA=9、O'B=1、OO'=9+1=10(2円が外接するので中心間距離=半径の和)の3つ。\n\n半径OAの延長上に、O'から下ろした垂線の足Cをとると、OC=OA-O'B=9-1=8(2つの半径の差)。\n\nO'Cは接線ABと平行なので、O'C=AB(求めたい量)。\n\n直角三角形OO'Cでは、脚OC=8と斜辺OO'=10の両方が既知なので、$\\mathrm{AB}=\\mathrm{O'C}=\\sqrt{10^{2}-8^{2}}=\\sqrt{100-64}=\\sqrt{36}=6$。",
  mistake: "『三平方』というキーワードだけで、脚と脚を足し算のように10-8=2としたり(そもそも三平方の定理を使っていない)、脚OC=半径の差8をそのままABの答えにしてしまったり(斜辺との関係を計算していない)、半径の和である斜辺OO'=10と脚OC=10を同じ値だと勘違いして0になってしまったりするミスが多い。三平方の定理は必ず『2乗して、引いて、ルート』の3ステップを踏む。",
  tip: "円が絡む共通接線の問題では、答えを出す前に『脚として使う2つの長さ』と『斜辺として使う長さ』を指でなぞって確認する。この問題では脚=半径の差、斜辺=半径の和、という対応を固定しておくと迷わない。"
}
},

{
id: "ho2-2",
stage: "第2問",
num: 2,
time: 50,
score: 6,
weakness: "方針切替",
route: ["内接円の接点"],
q: "△ABCの内接円の半径はr=1である。内接円と辺ABの接点をF、頂点Aから接点Fまでの接線の長さはAF=3である。また、辺CA=4である。内心をIとするとき、線分AIの長さを求めよ。",
svg: `<svg viewBox="0 0 240 260" class="diagram-svg" role="img" aria-label="内接円(3-4-5)">
  <polygon class="shape" points="60,98 144,210 60,210"/>
  <circle class="thin" cx="88.0" cy="182.0" r="28"/>
  <line class="thin dash" x1="88.0" y1="182.0" x2="88.0" y2="210"/>
  <line class="thin dash" x1="88.0" y1="182.0" x2="60" y2="182.0"/>
  <line class="thin dash" x1="88.0" y1="182.0" x2="110.4" y2="165.2"/>
  <circle class="point" cx="60" cy="98" r="4"/>
  <circle class="point" cx="144" cy="210" r="4"/>
  <circle class="point" cx="60" cy="210" r="4"/>
  <circle class="p-point" cx="88.0" cy="182.0" r="4"/>
  <circle class="point" cx="88.0" cy="210" r="3"/>
  <circle class="point" cx="60" cy="182.0" r="3"/>
  <circle class="point" cx="110.4" cy="165.2" r="3"/>
  <text class="label" x="44" y="102">A</text>
  <text class="label" x="150" y="214">B</text>
  <text class="label" x="46" y="226">C</text>
  <text class="blue-label" x="94.0" y="176.0">I</text>
  <text class="small-label" x="84.0" y="226">D</text>
  <text class="small-label" x="44" y="178.0">E</text>
  <text class="small-label" x="116.4" y="165.2">F</text>
  <text class="ratio" x="20" y="154">CA=4(未使用)</text>
  <text class="ratio" x="96" y="228">r=1</text>
  <text class="ratio" x="98" y="146">AF=3</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 240 260" class="diagram-svg" role="img" aria-label="内接円(3-4-5)(注目すべき三角形を強調)">
  <polygon class="shape" points="60,98 144,210 60,210"/>
  <circle class="thin" cx="88.0" cy="182.0" r="28"/>
  <line class="thin dash" x1="88.0" y1="182.0" x2="88.0" y2="210"/>
  <line class="thin dash" x1="88.0" y1="182.0" x2="60" y2="182.0"/>
  <line class="thin dash" x1="88.0" y1="182.0" x2="110.4" y2="165.2"/>
  <circle class="point" cx="60" cy="98" r="4"/>
  <circle class="point" cx="144" cy="210" r="4"/>
  <circle class="point" cx="60" cy="210" r="4"/>
  <circle class="p-point" cx="88.0" cy="182.0" r="4"/>
  <circle class="point" cx="88.0" cy="210" r="3"/>
  <circle class="point" cx="60" cy="182.0" r="3"/>
  <circle class="point" cx="110.4" cy="165.2" r="3"/>
  <text class="label" x="44" y="102">A</text>
  <text class="label" x="150" y="214">B</text>
  <text class="label" x="46" y="226">C</text>
  <text class="blue-label" x="94.0" y="176.0">I</text>
  <text class="small-label" x="84.0" y="226">D</text>
  <text class="small-label" x="44" y="178.0">E</text>
  <text class="small-label" x="116.4" y="165.2">F</text>
  <text class="ratio" x="20" y="154">CA=4(未使用)</text>
  <text class="ratio" x="96" y="228">r=1</text>
  <text class="ratio" x="98" y="146">AF=3</text>
  <line class="reveal-line" x1="60" y1="98" x2="110.4" y2="165.2"/>
  <line class="reveal-line" x1="110.4" y1="165.2" x2="88.0" y2="182.0"/>
  <line class="reveal-line" x1="60" y1="98" x2="88.0" y2="182.0"/>
</svg>`,
a: ["√10", "√17", "4", "3"],
correct: 0,
tags: ["correct", "formula_mismatch", "concept_gap", "concept_gap"],
explain: {
  aim: "内心の性質(内接円の半径と接線の長さで直角三角形ができる)を使って、頂点から内心までの距離を計算できるかを測る問題。",
  why: SEARCH_STEPS + "分かっているのは接線の長さAF=3、内接円の半径r=1(CA=4はこの計算には使わない)。\n\n内接円の半径IFは接線ABに垂直(半径と接線は垂直に交わる)なので、Fでの角AFIは直角。\n\n直角三角形AFIでは、脚AF=3と脚FI=r=1の両方が既知なので、$\\mathrm{AI}=\\sqrt{3^{2}+1^{2}}=\\sqrt{9+1}=\\sqrt{10}$。",
  mistake: "図中に書かれているCA=4を『使わなければいけない』と思い込み、AFの代わりにCA=4を使って$\\sqrt{4^{2}+1^{2}}=\\sqrt{17}$としてしまうことがある。すべての既知の長さを毎回使うとは限らない。また、AI=AF+r=3+1=4のように直角三角形を使わず単純に足してしまう誤り、AF=3をそのままAIの答えにしてしまう誤りも多い。",
  tip: "内心Iと頂点を結ぶ距離を求めるときは、『頂点から接点までの接線の長さ』と『内接円の半径』を2辺とする直角三角形(頂点・接点・内心)を必ず作る。図中の全ての数値を使う必要はなく、直角を挟む2辺だけを選び出す。"
}
},

{
id: "ho2-3",
stage: "第2問",
num: 3,
time: 60,
score: 6,
weakness: "方針切替",
route: ["共通弦の垂直二等分線"],
q: "半径13の円Oと半径15の円O'が2点で交わっており、中心間の距離OO'=14である。この2円の共通弦の長さを求めよ。",
svg: `<svg viewBox="0 0 320 260" class="diagram-svg" role="img" aria-label="2円の共通弦">
  <circle class="shape" cx="120" cy="150" r="78"/>
  <circle class="shape" cx="204" cy="150" r="90"/>
  <line class="thin dash" x1="120" y1="150" x2="204" y2="150"/>
  <line class="thin" x1="150" y1="78" x2="150" y2="222"/>
  <line class="thin dash" x1="120" y1="150" x2="150" y2="78"/>
  <circle class="point" cx="120" cy="150" r="4"/>
  <circle class="point" cx="204" cy="150" r="4"/>
  <circle class="point" cx="150" cy="150" r="4"/>
  <circle class="point" cx="150" cy="78" r="4"/>
  <circle class="point" cx="150" cy="222" r="4"/>
  <text class="label" x="102" y="154">O</text>
  <text class="label" x="212" y="154">O'</text>
  <text class="label" x="156" y="166">H</text>
  <text class="label" x="156" y="74">P</text>
  <text class="label" x="156" y="234">Q</text>
  <text class="ratio" x="146" y="142">OO'=14</text>
  <text class="ratio" x="110" y="110">半径13</text>
  <text class="ratio" x="200" y="94">半径15</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 320 260" class="diagram-svg" role="img" aria-label="2円の共通弦(注目すべき三角形を強調)">
  <circle class="shape" cx="120" cy="150" r="78"/>
  <circle class="shape" cx="204" cy="150" r="90"/>
  <line class="thin dash" x1="120" y1="150" x2="204" y2="150"/>
  <line class="thin" x1="150" y1="78" x2="150" y2="222"/>
  <line class="thin dash" x1="120" y1="150" x2="150" y2="78"/>
  <circle class="point" cx="120" cy="150" r="4"/>
  <circle class="point" cx="204" cy="150" r="4"/>
  <circle class="point" cx="150" cy="150" r="4"/>
  <circle class="point" cx="150" cy="78" r="4"/>
  <circle class="point" cx="150" cy="222" r="4"/>
  <text class="label" x="102" y="154">O</text>
  <text class="label" x="212" y="154">O'</text>
  <text class="label" x="156" y="166">H</text>
  <text class="label" x="156" y="74">P</text>
  <text class="label" x="156" y="234">Q</text>
  <text class="ratio" x="146" y="142">OO'=14</text>
  <text class="ratio" x="110" y="110">半径13</text>
  <text class="ratio" x="200" y="94">半径15</text>
  <line class="reveal-line" x1="120" y1="150" x2="150" y2="150"/>
  <line class="reveal-line" x1="150" y1="150" x2="150" y2="78"/>
  <line class="reveal-line" x1="120" y1="150" x2="150" y2="78"/>
</svg>`,
a: ["12", "24", "10√2", "14"],
correct: 1,
tags: ["near_miss", "correct", "formula_mismatch", "concept_gap"],
explain: {
  aim: "2円の共通弦が中心線OO'に垂直に交わることを使い、方べき・連立を経由せず直接、直角三角形の組み合わせで長さを求められるかを測る問題。",
  why: SEARCH_STEPS + "分かっているのは半径OP=13、半径O'P=15、中心間の距離OO'=14の3つ。共通弦PQは直線OO'に垂直に交わり、その交点をHとすると、HはPQの中点になる。\n\nOHの長さをxとおくと、直角三角形OHPで$\\mathrm{PH}^{2}=13^{2}-x^{2}$、直角三角形O'HPで$\\mathrm{PH}^{2}=15^{2}-(14-x)^{2}$。\n\nこの2つの式の右辺が等しいので、$13^{2}-x^{2}=15^{2}-(14-x)^{2}$を解くと$x=5$。\n\n直角三角形OHPに戻ると、$\\mathrm{PH}=\\sqrt{13^{2}-5^{2}}=\\sqrt{169-25}=\\sqrt{144}=12$。\n\nPQはPHの2倍なので、PQ=24。",
  mistake: "半弦PH=12まで正しく計算できたのに、最後にPQ=2×PHの『2倍』を忘れて12をそのまま答えてしまうミスが最も多い。また、$13+15-14=14$のような単純な足し引きで済ませてしまう誤り、Hの位置を求めずに直角三角形O'HPの方に13(逆の半径)を当てはめて$\\sqrt{15^{2}-5^{2}}$系の計算をしてしまう誤りもある。",
  tip: "共通弦の問題は『半分の長さ(半弦)を求めてから2倍する』という最後の一手を忘れやすい。答えを出したら、それが弦全体の長さなのか半分の長さなのか、図に戻って指でなぞって確認する。"
}
},

/* =========================
第3問(C群・誘導なし・3問)
========================= */
{
id: "ho3-1",
stage: "第3問",
num: 1,
time: 60,
score: 6,
weakness: "方針切替",
route: ["直方体の空間対角線"],
q: "直方体ABCD-EFGHがあり、AB=6、BC=8、CG=24である(Gは頂点Cの真上の頂点)。空間対角線AGの長さを求めよ。",
svg: `<svg viewBox="0 0 220 260" class="diagram-svg" role="img" aria-label="直方体の対角線(6,8,24)">
  <polygon class="shape" points="60,220 90,220 110.0,206.0 80.0,206.0"/>
  <line class="thin" x1="60" y1="220" x2="60" y2="100"/>
  <line class="thin" x1="90" y1="220" x2="90" y2="100"/>
  <line class="thin" x1="110.0" y1="206.0" x2="110.0" y2="86.0"/>
  <line class="thin dash" x1="80.0" y1="206.0" x2="80.0" y2="86.0"/>
  <line class="thin" x1="60" y1="100" x2="90" y2="100"/>
  <line class="thin" x1="90" y1="100" x2="110.0" y2="86.0"/>
  <line class="thin dash" x1="110.0" y1="86.0" x2="80.0" y2="86.0"/>
  <line class="thin dash" x1="60" y1="100" x2="80.0" y2="86.0"/>
  <line class="thin dash" x1="60" y1="220" x2="110.0" y2="86.0"/>
  <line class="thin dash" x1="60" y1="220" x2="110.0" y2="206.0"/>
  <circle class="point" cx="60" cy="220" r="4"/>
  <circle class="point" cx="110.0" cy="206.0" r="4"/>
  <circle class="point" cx="110.0" cy="86.0" r="4"/>
  <text class="label" x="46" y="224">A</text>
  <text class="label" x="96" y="236">B</text>
  <text class="label" x="116.0" y="210.0">C</text>
  <text class="label" x="76.0" y="200.0">D</text>
  <text class="label" x="116.0" y="80.0">G</text>
  <text class="ratio" x="69" y="236">6</text>
  <text class="ratio" x="54.0" y="215.0">8</text>
  <text class="ratio" x="36" y="160">24</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 220 260" class="diagram-svg" role="img" aria-label="直方体の対角線(6,8,24)(注目すべき三角形を強調)">
  <polygon class="shape" points="60,220 90,220 110.0,206.0 80.0,206.0"/>
  <line class="thin" x1="60" y1="220" x2="60" y2="100"/>
  <line class="thin" x1="90" y1="220" x2="90" y2="100"/>
  <line class="thin" x1="110.0" y1="206.0" x2="110.0" y2="86.0"/>
  <line class="thin dash" x1="80.0" y1="206.0" x2="80.0" y2="86.0"/>
  <line class="thin" x1="60" y1="100" x2="90" y2="100"/>
  <line class="thin" x1="90" y1="100" x2="110.0" y2="86.0"/>
  <line class="thin dash" x1="110.0" y1="86.0" x2="80.0" y2="86.0"/>
  <line class="thin dash" x1="60" y1="100" x2="80.0" y2="86.0"/>
  <line class="thin dash" x1="60" y1="220" x2="110.0" y2="86.0"/>
  <line class="thin dash" x1="60" y1="220" x2="110.0" y2="206.0"/>
  <circle class="point" cx="60" cy="220" r="4"/>
  <circle class="point" cx="110.0" cy="206.0" r="4"/>
  <circle class="point" cx="110.0" cy="86.0" r="4"/>
  <text class="label" x="46" y="224">A</text>
  <text class="label" x="96" y="236">B</text>
  <text class="label" x="116.0" y="210.0">C</text>
  <text class="label" x="76.0" y="200.0">D</text>
  <text class="label" x="116.0" y="80.0">G</text>
  <text class="ratio" x="69" y="236">6</text>
  <text class="ratio" x="54.0" y="215.0">8</text>
  <text class="ratio" x="36" y="160">24</text>
  <line class="reveal-line" x1="60" y1="220" x2="110.0" y2="206.0"/>
  <line class="reveal-line" x1="110.0" y1="206.0" x2="110.0" y2="86.0"/>
  <line class="reveal-line" x1="60" y1="220" x2="110.0" y2="86.0"/>
  <polyline class="reveal-angle" points="96.52,209.77 96.52,195.77 110.0,192.0"/>
  <text class="reveal-label small-label" x="40" y="192">(実際は直角)</text>
</svg>`,
a: ["10", "34", "8√10", "26"],
correct: 3,
tags: ["near_miss", "concept_gap", "formula_mismatch", "correct"],
explain: {
  aim: "誘導なしで、まず底面の対角線を求める三角形、次に空間対角線を求める三角形という2段階の切り出しを自力で行えるかを測る問題(模試の『サ』と同じ、図に描かれていない三角形を自分で作る場面)。",
  why: SEARCH_STEPS + "分かっているのはAB=6、BC=8、CG=24の3つ。まず、底面の対角線ACに注目する。\n\n三角形ABCはBで直角(長方形の辺どうしは垂直)なので、$\\mathrm{AC}=\\sqrt{6^{2}+8^{2}}=\\sqrt{36+64}=\\sqrt{100}=10$。\n\n次に、空間対角線AGに注目する。ACは底面にあり、CGは底面に垂直なので、三角形ACGはCで直角。\n\n$\\mathrm{AG}=\\sqrt{10^{2}+24^{2}}=\\sqrt{100+576}=\\sqrt{676}=26$。",
  mistake: "AC=10まで正しく求めたところで力尽き、これがまだ底面上の対角線であり空間対角線ではないことに気づかず、10をそのまま答えてしまうミスが最も多い(模試の『サ』の断絶と同じ構造)。また、AC+CG=10+24=34のように三平方を使わず足し算で済ませる誤り、AB=6を使わずBC=8とCG=24だけで$\\sqrt{8^{2}+24^{2}}=8\\sqrt{10}$と計算してしまう誤り(使う辺の組み合わせを間違える)もある。",
  tip: "立体の対角線は1回の三平方で終わらないことが多い。1つ目の三角形で出た答えは、そこで終わりではなく『次の三角形の部品』であることを常に疑う。答えが出たら、それが本当に問題で聞かれている対角線(この場合は空間対角線)かどうかを図に戻って確認する。"
}
},

{
id: "ho3-2",
stage: "第3問",
num: 2,
time: 65,
score: 6,
weakness: "方針切替",
route: ["内接円の接点"],
q: "△ABCにおいて、∠C=90°、BC=8、CA=6、AB=10である。△ABCの内接円と辺BC、CA、ABの接点をそれぞれD、E、Fとする。内心をIとするとき、線分BIの長さを求めよ。",
svg: `<svg viewBox="0 0 240 260" class="diagram-svg" role="img" aria-label="内接円(6-8-10)">
  <polygon class="shape" points="60,66 168,210 60,210"/>
  <circle class="thin" cx="96.0" cy="174.0" r="36"/>
  <line class="thin dash" x1="96.0" y1="174.0" x2="96.0" y2="210"/>
  <line class="thin dash" x1="96.0" y1="174.0" x2="60" y2="174.0"/>
  <line class="thin dash" x1="96.0" y1="174.0" x2="124.8" y2="152.4"/>
  <circle class="point" cx="60" cy="66" r="4"/>
  <circle class="point" cx="168" cy="210" r="4"/>
  <circle class="point" cx="60" cy="210" r="4"/>
  <circle class="p-point" cx="96.0" cy="174.0" r="4"/>
  <circle class="point" cx="96.0" cy="210" r="3"/>
  <circle class="point" cx="60" cy="174.0" r="3"/>
  <circle class="point" cx="124.8" cy="152.4" r="3"/>
  <text class="label" x="44" y="70">A</text>
  <text class="label" x="174" y="214">B</text>
  <text class="label" x="46" y="226">C</text>
  <text class="blue-label" x="102.0" y="168.0">I</text>
  <text class="small-label" x="92.0" y="226">D</text>
  <text class="small-label" x="44" y="170.0">E</text>
  <text class="small-label" x="130.8" y="152.4">F</text>
  <text class="ratio" x="36" y="138">CA=6</text>
  <text class="ratio" x="108" y="228">BC=8</text>
  <text class="ratio" x="110" y="130">AB=10</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 240 260" class="diagram-svg" role="img" aria-label="内接円(6-8-10)(注目すべき三角形を強調)">
  <polygon class="shape" points="60,66 168,210 60,210"/>
  <circle class="thin" cx="96.0" cy="174.0" r="36"/>
  <line class="thin dash" x1="96.0" y1="174.0" x2="96.0" y2="210"/>
  <line class="thin dash" x1="96.0" y1="174.0" x2="60" y2="174.0"/>
  <line class="thin dash" x1="96.0" y1="174.0" x2="124.8" y2="152.4"/>
  <circle class="point" cx="60" cy="66" r="4"/>
  <circle class="point" cx="168" cy="210" r="4"/>
  <circle class="point" cx="60" cy="210" r="4"/>
  <circle class="p-point" cx="96.0" cy="174.0" r="4"/>
  <circle class="point" cx="96.0" cy="210" r="3"/>
  <circle class="point" cx="60" cy="174.0" r="3"/>
  <circle class="point" cx="124.8" cy="152.4" r="3"/>
  <text class="label" x="44" y="70">A</text>
  <text class="label" x="174" y="214">B</text>
  <text class="label" x="46" y="226">C</text>
  <text class="blue-label" x="102.0" y="168.0">I</text>
  <text class="small-label" x="92.0" y="226">D</text>
  <text class="small-label" x="44" y="170.0">E</text>
  <text class="small-label" x="130.8" y="152.4">F</text>
  <text class="ratio" x="36" y="138">CA=6</text>
  <text class="ratio" x="108" y="228">BC=8</text>
  <text class="ratio" x="110" y="130">AB=10</text>
  <line class="reveal-line" x1="168" y1="210" x2="96.0" y2="210"/>
  <line class="reveal-line" x1="96.0" y1="210" x2="96.0" y2="174.0"/>
  <line class="reveal-line" x1="168" y1="210" x2="96.0" y2="174.0"/>
</svg>`,
a: ["4", "6", "2√5", "2√10"],
correct: 2,
tags: ["near_miss", "concept_gap", "correct", "formula_mismatch"],
explain: {
  aim: "誘導なしで、内接円の半径・接線の長さ・内心という一連の道具を自力で組み立てて、頂点から内心までの距離を出せるかを測る問題。",
  why: SEARCH_STEPS + "分かっているのはBC=8、CA=6、AB=10、∠C=90°。\n\n直角三角形の内接円の半径は$r=\\dfrac{(\\text{2辺の和})-\\text{斜辺}}{2}$で求まるので、$r=\\dfrac{8+6-10}{2}=2$。\n\n頂点Bから接点Dまでの接線の長さは、半周長$s=\\dfrac{6+8+10}{2}=12$を使って、$\\mathrm{BD}=s-\\mathrm{CA}=12-6=4$(頂点Bの対辺CAを半周長から引く)。\n\n接線BDと半径IDは接点Dで垂直なので、直角三角形BDIでは脚BD=4と脚DI=r=2の両方が既知。\n\n$\\mathrm{BI}=\\sqrt{4^{2}+2^{2}}=\\sqrt{16+4}=\\sqrt{20}=2\\sqrt{5}$。",
  mistake: "BD=4まで求めたところで満足し、半径rとの直角三角形を作らずBD=4をそのままBIの答えにしてしまうミスが多い(近道に見えて実は途中で止まっている)。また、半周長からBの対辺CA=6を引く代わりに隣の辺BC=8を引いてしまい$\\mathrm{BD}=12-8=4$…のつもりが実際にはCD側の値を混同して$\\sqrt{10}$系の値になる誤りや、BD+r=4+2=6のように直角三角形を使わず足してしまう誤りもある。",
  tip: "『半周長-対辺=その頂点からの接線の長さ』の対応(頂点Bの対辺はCA)をまず正確に当てる。その後、接線の長さと半径をセットにした直角三角形を必ず作ってから、内心までの距離を計算する。"
}
},

{
id: "ho3-3",
stage: "第3問",
num: 3,
time: 75,
score: 7,
weakness: "方針切替",
route: ["角の二等分線と外部点"],
q: "直角三角柱の底面である直角三角形ABC(∠ACB=90°)の内部に、半径rの球Pと半径r/3の球Qが、互いに外接しながら入っており、どちらも底面ABCに接している。球P、球Qの中心から底面に垂線を下ろした足をそれぞれP'、Q'とすると、2点P'、Q'はともに∠BACの二等分線上にある。計算の結果、AP'=√3r、P'Q'=(2√3/3)rであることがすでに分かっている。さらに、点P'から辺ACに垂線を下ろした足をP''とすると、P'P''=r(球Pの半径)である。このとき、線分AP''の長さを求めよ。",
svg: `<svg viewBox="0 0 340 260" class="diagram-svg" role="img" aria-label="角の二等分線上の2点と補助三角形">
  <polygon class="shape" points="70,230 280,230 280,90"/>
  <line class="thin dash" x1="70" y1="230" x2="126.57" y2="190.00"/>
  <line class="thin dash" x1="126.57" y1="190.00" x2="126.57" y2="230.00"/>
  <circle class="point" cx="70" cy="230" r="4"/>
  <circle class="point" cx="280" cy="230" r="4"/>
  <circle class="point" cx="280" cy="90" r="4"/>
  <circle class="point" cx="126.57" cy="190.00" r="4"/>
  <circle class="point" cx="88.86" cy="216.67" r="4"/>
  <circle class="ext-point" cx="126.57" cy="230.00" r="4"/>
  <text class="label" x="54" y="234">A</text>
  <text class="label" x="286" y="234">C</text>
  <text class="label" x="286" y="94">B</text>
  <text class="red-label" x="132.57" y="184.00">P'</text>
  <text class="red-label" x="82.86" y="206.67">Q'</text>
  <text class="small-label" x="118.57" y="246.00">P''</text>
  <text class="ratio" x="69.43" y="213.33">AQ'</text>
  <text class="ratio" x="93.71" y="193.33">P'Q'=(2√3/3)r</text>
  <text class="ratio" x="132.57" y="210.00">P'P''=r</text>
  <text class="note" x="80" y="216">AP'=√3r(既知)</text>
</svg>`,
svgReveal: `<svg viewBox="0 0 340 260" class="diagram-svg" role="img" aria-label="角の二等分線上の2点と補助三角形(注目すべき三角形を強調)">
  <polygon class="shape" points="70,230 280,230 280,90"/>
  <line class="thin dash" x1="70" y1="230" x2="126.57" y2="190.00"/>
  <line class="thin dash" x1="126.57" y1="190.00" x2="126.57" y2="230.00"/>
  <circle class="point" cx="70" cy="230" r="4"/>
  <circle class="point" cx="280" cy="230" r="4"/>
  <circle class="point" cx="280" cy="90" r="4"/>
  <circle class="point" cx="126.57" cy="190.00" r="4"/>
  <circle class="point" cx="88.86" cy="216.67" r="4"/>
  <circle class="ext-point" cx="126.57" cy="230.00" r="4"/>
  <text class="label" x="54" y="234">A</text>
  <text class="label" x="286" y="234">C</text>
  <text class="label" x="286" y="94">B</text>
  <text class="red-label" x="132.57" y="184.00">P'</text>
  <text class="red-label" x="82.86" y="206.67">Q'</text>
  <text class="small-label" x="118.57" y="246.00">P''</text>
  <text class="ratio" x="69.43" y="213.33">AQ'</text>
  <text class="ratio" x="93.71" y="193.33">P'Q'=(2√3/3)r</text>
  <text class="ratio" x="132.57" y="210.00">P'P''=r</text>
  <text class="note" x="80" y="216">AP'=√3r(既知)</text>
  <line class="reveal-line" x1="70" y1="230" x2="126.57" y2="190.00"/>
  <line class="reveal-line" x1="126.57" y1="190.00" x2="126.57" y2="230.00"/>
  <line class="reveal-line" x1="70" y1="230" x2="126.57" y2="230.00"/>
</svg>`,
a: ["(√3-1)r", "√2r", "2r", "(√3/3)r"],
correct: 1,
tags: ["concept_gap", "correct", "calc_error", "formula_mismatch"],
explain: {
  aim: "図に明示されていない直角三角形AP'P''を自分で切り出し、すでに分かっている2つの長さから残りの長さを求められるかを測る問題(実際の模試で完全に停止した『サ』と同じ構造)。",
  why: SEARCH_STEPS + "分かっているのはAP'=√3r、P'Q'=(2√3/3)r、P'P''=rの3つ(P'Q'は別の三角形からすでに求めた値で、この設問には使わない)。\n\n点P''は点P'から辺ACに下ろした垂線の足なので、P'P''⊥ACであり、P''での角AP''P'は直角。\n\nAとP'とP''でできる三角形AP'P''は、この時点で問題の図には線として描かれていないが、斜辺AP'=√3rと脚P'P''=rが両方すでに分かっているので、この三角形を自分で作れば計算できる。\n\n$\\mathrm{AP''}=\\sqrt{\\mathrm{AP'}^{2}-\\mathrm{P'P''}^{2}}=\\sqrt{(\\sqrt3r)^{2}-r^{2}}=\\sqrt{3r^{2}-r^{2}}=\\sqrt{2r^{2}}=\\sqrt2r$。",
  mistake: "AP'ではなく、P'Q'(すでに使い終わった別の三角形の辺)を斜辺として使ってしまい$\\sqrt{(2\\sqrt3r/3)^{2}-r^{2}}=(\\sqrt3/3)r$としてしまう誤りが多い(点Q'から辺ACへ下ろした垂線の足はP''ではなくQ''であり、三角形Q'P'P''は直角三角形になっていない)。また、三平方の定理で引き算すべきところを$\\sqrt{(\\sqrt3r)^{2}+r^{2}}=2r$と足し算してしまう誤り、そもそも三平方の定理を使わずAP'-P'P''=(√3-1)rと単純に引き算してしまう誤りもある。",
  tip: "『すでに求めた長さがいくつも図の中にある』状況では、直前の設問で使った辺(この場合はP'Q')にひっぱられやすい。今回使うべき辺は、今から作ろうとしている直角三角形(AP'P'')の頂点にちゃんとつながっている辺かどうかを、指でなぞって確認する。"
}
},

];
