const ROUTE_CHOICES_VECTOR = [
  "成分計算",
  "ベクトルの大きさ",
  "内積",
  "平行条件",
  "垂直条件",
  "内分点の公式",
  "位置ベクトル",
  "球面の方程式",
  "ベクトルの分解",
  "共線条件"
];

const questions_vector = [

/* =========================
第1問(成分計算・大きさ)
========================= */
{
id: "v1-1",
stage: "第1問",
num: 1,
time: 25,
score: 5,
weakness: "計算精度",
route: ["成分計算"],
q: "$\\vec{a}=(2, -1)$, $\\vec{b}=(1, 3)$ のとき、$\\vec{a}+2\\vec{b}$ の成分を求めよ。",
a: ["(4, 5)", "(3, 2)", "(4, -5)", "(5, 4)"],
correct: 0,
tags: ["correct", "formula_mismatch", "sign_error", "calc_error"],
explain: {
aim: "係数のついたベクトルの加法を、符号ミスなく実行できるかを測る問題。",
why: "$2\\vec{b}=(2, 6)$。これを$\\vec{a}$に加えて、$(2+2, -1+6)=(4, 5)$。",
mistake: "2倍を忘れて$\\vec{a}+\\vec{b}=(3, 2)$を計算してしまう、またはy成分の$-1+6$の符号処理を誤ることがある。",
tip: "係数のついたベクトルは、先に係数倍だけを書き出してから足すと符号ミスが減る。"
}
},
{
id: "v1-2",
stage: "第1問",
num: 2,
time: 25,
score: 5,
weakness: "計算精度",
route: ["ベクトルの大きさ"],
q: "$\\vec{a}=(3, -4)$ のとき、$|\\vec{a}|$ を求めよ。",
a: ["5", "25", "7", "1"],
correct: 0,
tags: ["correct", "near_miss", "concept_gap", "calc_error"],
explain: {
aim: "ベクトルの大きさの公式(2乗して足してルート)を最後まで実行できるかを測る問題。",
why: "$|\\vec{a}|=\\sqrt{3^{2}+(-4)^{2}}=\\sqrt{9+16}=\\sqrt{25}=5$。",
mistake: "2乗の和25を出したところで満足し、最後のルートを忘れることがある。",
tip: "大きさは『2乗して、足して、ルート』の3手セット。最後のルートまでが1つの作業。"
}
},
{
id: "v1-3",
stage: "第1問",
num: 3,
time: 30,
score: 5,
weakness: "計算精度",
route: ["成分計算"],
q: "点$A(1, 2)$、点$B(4, -2)$ のとき、ベクトル$\\overrightarrow{\\mathrm{AB}}$の成分を求めよ。",
a: ["(3, -4)", "(-3, 4)", "(5, 0)", "(4, -2)"],
correct: 0,
tags: ["correct", "sign_error", "calc_error", "condition_misread"],
explain: {
aim: "$\\overrightarrow{\\mathrm{AB}}=$(終点)$-$(始点)という向きのルールを正しく扱えるかを測る問題。",
why: "AB→=(Bの座標)-(Aの座標)=$(4-1, -2-2)=(3, -4)$。『後ろから前を引く』ではなく『終点から始点を引く』。",
mistake: "$A-B$の順で引いて$(-3, 4)$としてしまう(向きが逆)。またはBの座標をそのまま答えることがある。",
tip: "$\\overrightarrow{\\mathrm{AB}}$は『AからBへ』なので、$B-A$。矢印の先(終点)から引くと覚える。"
}
},
{
id: "v1-4",
stage: "第1問",
num: 4,
time: 35,
score: 5,
weakness: "方針切替",
route: ["ベクトルの大きさ"],
q: "$\\vec{a}=(6, 8)$ と同じ向きの単位ベクトルを求めよ。",
a: ["(3/5, 4/5)", "(3/7, 4/7)", "(1/6, 1/8)", "(6, 8)"],
correct: 0,
tags: ["correct", "formula_mismatch", "concept_gap", "concept_gap"],
explain: {
aim: "単位ベクトルの定義(ベクトルをその大きさで割る)を正しく使えるかを測る問題。",
why: "$|\\vec{a}|=\\sqrt{36+64}=\\sqrt{100}=10$。単位ベクトルは$\\vec{a}$をその大きさで割って、$\\left(\\dfrac{6}{10}, \\dfrac{8}{10}\\right)=\\left(\\dfrac{3}{5}, \\dfrac{4}{5}\\right)$。",
mistake: "大きさ(10)ではなく成分の和($6+8=14$)で割ってしまい、$\\left(\\dfrac{3}{7}, \\dfrac{4}{7}\\right)$とすることがある。",
tip: "単位ベクトル=『大きさ1にそろえる』作業。割る数は必ず$|\\vec{a}|$(ルートを含む大きさ)。"
}
},
{
id: "v1-5",
stage: "第1問",
num: 5,
time: 45,
score: 5,
weakness: "方針切替",
route: ["ベクトルの分解"],
q: "$\\vec{a}=(1, 2)$, $\\vec{b}=(2, -1)$ とする。$\\vec{c}=(4, 3)$ を $s\\vec{a}+t\\vec{b}$ の形で表すとき、$s, t$ の値を求めよ。",
a: ["s=2, t=1", "s=1, t=2", "s=2, t=-1", "s=3, t=1"],
correct: 0,
tags: ["correct", "calc_error", "sign_error", "calc_error"],
explain: {
aim: "1つのベクトルを2つのベクトルの実数倍の和で表す(ベクトルの分解)問題を、連立方程式に落として正しく解けるかを測る問題。",
why: "$s\\vec{a}+t\\vec{b}=(s+2t, 2s-t)$ がこれが$(4, 3)$に等しいので、$s+2t=4$、$2s-t=3$。2式目より$t=2s-3$。1式目に代入して$s+2(2s-3)=4$、$5s=10$、$s=2$。よって$t=2\\times2-3=1$。",
mistake: "x成分の式とy成分の式を混同してsとtの役割を入れ替えてしまう、または連立方程式を解く途中の符号処理を誤ることがある。",
tip: "成分ごとに式を1本ずつ立てて連立方程式にする、というのがベクトル分解の基本手順。s, tを求めたら元の式に代入して検算する習慣をつけると安心。"
}
},

/* =========================
第2問(内積・平行と垂直)
========================= */
{
id: "v2-1",
stage: "第2問",
num: 1,
time: 25,
score: 5,
weakness: "計算精度",
route: ["内積"],
q: "$\\vec{a}=(2, 3)$, $\\vec{b}=(-1, 4)$ のとき、内積 $\\vec{a}\\cdot\\vec{b}$ を求めよ。",
a: ["10", "-14", "14", "(-2, 12)"],
correct: 0,
tags: ["correct", "sign_error", "calc_error", "concept_gap"],
explain: {
aim: "内積の定義(x成分同士・y成分同士の積の和)を符号ミスなく計算できるかを測る問題。",
why: "$\\vec{a}\\cdot\\vec{b}=2\\times(-1)+3\\times4=-2+12=10$。",
mistake: "$-2-12=-14$のように、足すところを引いてしまう符号ミス。また、内積は『数』なのに成分のペアで答えてしまうことがある。",
tip: "内積=『x成分どうしの積 + y成分どうしの積』。答えは必ず1つの数になる。"
}
},
{
id: "v2-2",
stage: "第2問",
num: 2,
time: 40,
score: 5,
weakness: "方針切替",
route: ["平行条件"],
q: "$\\vec{a}=(3, -2)$, $\\vec{b}=(x, 6)$ が平行であるとき、$x$の値を求めよ。",
a: ["-9", "9", "4", "-4"],
correct: 0,
tags: ["correct", "sign_error", "formula_mismatch", "formula_mismatch"],
explain: {
aim: "平行条件の式を、垂直条件と混同せず正しく使えるかを測る問題。",
why: "平行条件は『成分の比が等しい』こと。$3\\times6-(-2)\\times x=0$ より $18+2x=0$、$x=-9$。確認: $\\vec{b}=(-9, 6)=-3\\times(3, -2)$ で確かに$\\vec{a}$の実数倍になっている。",
mistake: "垂直条件(内積=0: $3x-12=0$で$x=4$)と混同することがある。平行と垂直は式の形がまったく違う。",
tip: "平行=『実数倍で書ける(比が等しい)』、垂直=『内積が0』。どちらの条件を使うか、式を立てる前に一度声に出して確認する。"
}
},
{
id: "v2-3",
stage: "第2問",
num: 3,
time: 40,
score: 5,
weakness: "方針切替",
route: ["垂直条件"],
q: "$\\vec{a}=(2, 1)$, $\\vec{b}=(x, -4)$ が垂直であるとき、$x$の値を求めよ。",
a: ["2", "-8", "8", "-2"],
correct: 0,
tags: ["correct", "formula_mismatch", "sign_error", "sign_error"],
explain: {
aim: "垂直条件(内積=0)を、平行条件と混同せず正しく使えるかを測る問題。",
why: "垂直条件は内積=0。$2\\times x+1\\times(-4)=0$ より $2x-4=0$、$x=2$。",
mistake: "平行条件($2\\times(-4)-1\\times x=0$で$x=-8$)と混同することがある。前問と逆パターンの引っかけ。",
tip: "『垂直と言われたら反射的に内積=0』。この1対1対応を体に入れる。"
}
},
{
id: "v2-4",
stage: "第2問",
num: 4,
time: 30,
score: 5,
weakness: "計算精度",
route: ["内積"],
q: "$|\\vec{a}|=3$, $|\\vec{b}|=2$ で、$\\vec{a}$と$\\vec{b}$のなす角が$60°$のとき、内積 $\\vec{a}\\cdot\\vec{b}$ を求めよ。",
a: ["3", "6", "3√3", "2"],
correct: 0,
tags: ["correct", "formula_mismatch", "formula_mismatch", "calc_error"],
explain: {
aim: "内積の定義『大きさ×大きさ×$\\cos$』を、$\\sin$との混同なく使えるかを測る問題。",
why: "$\\vec{a}\\cdot\\vec{b}=|\\vec{a}||\\vec{b}|\\cos60°=3\\times2\\times\\dfrac{1}{2}=3$。",
mistake: "$\\cos$を掛け忘れて6としたり、$\\cos60°$の代わりに$\\sin60°=\\dfrac{\\sqrt{3}}{2}$を使って$3\\sqrt{3}$とすることがある。",
tip: "内積の定義は『大きさ×大きさ×$\\cos$』。$\\sin$が出てくるのは面積の公式。"
}
},
{
id: "v2-5",
stage: "第2問",
num: 5,
time: 45,
score: 5,
weakness: "方針切替",
route: ["内積"],
q: "0でない2つのベクトル$\\vec{a}, \\vec{b}$が $|\\vec{a}|=|\\vec{b}|$ を満たすとき、$\\vec{a}+\\vec{b}$ と $\\vec{a}-\\vec{b}$ の関係として正しいものはどれか。",
a: ["垂直である", "平行である", "等しい", "なす角は60°である"],
correct: 0,
tags: ["correct", "formula_mismatch", "concept_gap", "concept_gap"],
explain: {
aim: "大きさが等しいという条件から、和と差のベクトルの図形的関係(垂直)を導けるかを測る問題。",
why: "$(\\vec{a}+\\vec{b})\\cdot(\\vec{a}-\\vec{b})=|\\vec{a}|^{2}-|\\vec{b}|^{2}$ で、$|\\vec{a}|=|\\vec{b}|$よりこれは0。内積が0なので垂直。図形的には、$\\vec{a}$と$\\vec{b}$が作るひし形の2本の対角線が$\\vec{a}+\\vec{b}$と$\\vec{a}-\\vec{b}$にあたり、ひし形の対角線は直交する。",
mistake: "『どちらも$\\vec{a}$と$\\vec{b}$から作ったベクトルだから平行』のように、なんとなくの印象で答えてしまうことがある。",
tip: "$|\\vec{a}|=|\\vec{b}|$のとき、$\\vec{a}+\\vec{b}$は『ひし形の対角線=角の二等分線の方向』、$\\vec{a}-\\vec{b}$は『もう1本の対角線』でそれと垂直。この図をワンセットで覚えると、平行/垂直の判断問題に強くなる。"
}
},
{
id: "v2-6",
stage: "第2問",
num: 6,
time: 40,
score: 5,
weakness: "共通点抽出",
route: ["平行条件"],
q: "ひし形ABCDにおいて、$\\overrightarrow{\\mathrm{CB}}+\\overrightarrow{\\mathrm{CD}}$ は、ひし形のどの部分と平行か。",
a: ["対角線CA", "対角線BD", "辺AB", "辺AD"],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "concept_gap"],
explain: {
aim: "『大きさの等しい2つのベクトルの和は、その2辺が作る図形の対角線方向になる』という性質を、具体的な図形のどの辺・対角線に対応するか正しく判断できるかを測る問題。",
why: "ひし形は全ての辺の長さが等しいので$|\\overrightarrow{\\mathrm{CB}}|=|\\overrightarrow{\\mathrm{CD}}|$。このとき$\\overrightarrow{\\mathrm{CB}}+\\overrightarrow{\\mathrm{CD}}$は∠BCDを2等分する方向、すなわち頂点Cを通るもう一方の頂点Aへ向かう対角線CAの方向と一致する。座標で確認すると、対角線が直交するように置いた場合($A(-p,0), B(0,q), C(p,0), D(0,-q)$)、$\\overrightarrow{\\mathrm{CB}}+\\overrightarrow{\\mathrm{CD}}=(-2p, 0)$となり、確かにx軸方向(=対角線CAの方向)に一致する。",
mistake: "『2辺のベクトルの和・差』と聞くと、もう一方の対角線(垂直な方)と反射的に結びつけてしまい、対角線BDを選んでしまうことがある。和は『同じ対角線』、差は『垂直なもう一方の対角線』という対応を逆にしないこと。",
tip: "ひし形やその他の図形で『2辺ベクトルの和・差』が出てきたら、和は角の二等分線=対角線の1本、差はそれと垂直なもう1本の対角線、とセットで思い出す。どちらの対角線かは、和・差を作っている2つのベクトルの始点(共通の頂点)から見て判断する。"
}
},

/* =========================
第3問(位置ベクトル・分点)
========================= */
{
id: "v3-1",
stage: "第3問",
num: 1,
time: 40,
score: 5,
weakness: "計算精度",
route: ["内分点の公式"],
q: "点A(1, 2)、点B(7, 5) を結ぶ線分ABを 2:1 に内分する点Pの座標を求めよ。",
a: ["(5, 4)", "(3, 3)", "(4, 7/2)", "(8, 7)"],
correct: 0,
tags: ["correct", "ratio_reverse", "formula_mismatch", "concept_gap"],
explain: {
aim: "内分点の公式を、比の数字の掛け方(たすき掛け)を間違えず使えるかを測る問題。",
why: "$m:n=2:1$の内分点は $\\dfrac{1\\times A+2\\times B}{2+1}$。x座標: $\\dfrac{1\\times1+2\\times7}{3}=\\dfrac{15}{3}=5$、y座標: $\\dfrac{1\\times2+2\\times5}{3}=\\dfrac{12}{3}=4$。よって$(5, 4)$。",
mistake: "比を逆に使って$\\dfrac{2\\times A+1\\times B}{3}=(3, 3)$としてしまう。内分点の公式は『比の数字とかける座標がたすき掛け』になるのが混乱の元。",
tip: "答えが出たら『Pは比の大きい側(2側)の端点Bに近いはず』と位置感覚で検算する。$(5,4)$はBの$(7,5)$寄りなので正しい。"
}
},
{
id: "v3-2",
stage: "第3問",
num: 2,
time: 35,
score: 5,
weakness: "計算精度",
route: ["位置ベクトル"],
q: "$\\overrightarrow{\\mathrm{OA}}=\\vec{a}, \\overrightarrow{\\mathrm{OB}}=\\vec{b}$ のとき、△OABの重心Gについて$\\overrightarrow{\\mathrm{OG}}$を$\\vec{a}, \\vec{b}$で表せ。",
a: ["(a→+b→)/3", "(a→+b→)/2", "a→+b→", "2(a→+b→)/3"],
correct: 0,
tags: ["correct", "formula_mismatch", "concept_gap", "calc_error"],
explain: {
aim: "重心の位置ベクトルの公式(3点の平均)を、中点の公式(2点の平均)と混同せず使えるかを測る問題。",
why: "重心は3頂点の位置ベクトルの平均。$\\overrightarrow{\\mathrm{OG}}=\\dfrac{\\overrightarrow{\\mathrm{OO}}+\\overrightarrow{\\mathrm{OA}}+\\overrightarrow{\\mathrm{OB}}}{3}=\\dfrac{\\vec{0}+\\vec{a}+\\vec{b}}{3}=\\dfrac{\\vec{a}+\\vec{b}}{3}$。",
mistake: "中点の公式(÷2)と混同して$\\dfrac{\\vec{a}+\\vec{b}}{2}$とすることがある。頂点Oが原点なので$\\vec{0}$を忘れずに3で割る。",
tip: "重心=『3頂点の平均(÷3)』、中点=『2点の平均(÷2)』。割る数=点の個数。"
}
},
{
id: "v3-3",
stage: "第3問",
num: 3,
time: 45,
score: 5,
weakness: "方針切替",
route: ["内分点の公式"],
q: "$\\overrightarrow{\\mathrm{OA}}=\\vec{a}, \\overrightarrow{\\mathrm{OB}}=\\vec{b}$ とする。線分AB上の点Pが AP:PB=2:1 を満たすとき、$\\overrightarrow{\\mathrm{OP}}$を$\\vec{a}, \\vec{b}$で表せ。",
a: ["(a→+2b→)/3", "(2a→+b→)/3", "(a→+2b→)/2", "(2a→+2b→)/3"],
correct: 0,
tags: ["correct", "ratio_reverse", "calc_error", "calc_error"],
explain: {
aim: "内分点公式のたすき掛けの向きを、比から正しく判断できるかを測る問題。",
why: "AP:PB=m:n=2:1の内分点の公式は $\\overrightarrow{\\mathrm{OP}}=\\dfrac{n\\times\\vec{a}+m\\times\\vec{b}}{m+n}=\\dfrac{1\\times\\vec{a}+2\\times\\vec{b}}{3}=\\dfrac{\\vec{a}+2\\vec{b}}{3}$。",
mistake: "比の2と1をそのまま$\\vec{a}$と$\\vec{b}$に掛けて$\\dfrac{2\\vec{a}+\\vec{b}}{3}$としてしまう(比の向きの逆転)。公式は『遠い側の比を掛ける』たすき掛け。",
tip: "AP:PB=2:1ならPはBに近い。だから$\\vec{b}$の係数の方が大きくなるはず、と答えの形を先に予想してから公式を使う。"
}
},
{
id: "v3-4",
stage: "第3問",
num: 4,
time: 40,
score: 5,
weakness: "方針切替",
route: ["共線条件"],
q: "$\\overrightarrow{\\mathrm{OA}}=\\vec{a}, \\overrightarrow{\\mathrm{OB}}=\\vec{b}$ とする。点Pが $\\overrightarrow{\\mathrm{OP}}=\\dfrac{2}{5}\\vec{a}+k\\vec{b}$ を満たしながら直線AB上にあるとき、$k$の値を求めよ。",
a: ["3/5", "2/5", "7/5", "-3/5"],
correct: 0,
tags: ["correct", "condition_misread", "sign_error", "sign_error"],
explain: {
aim: "『点Pが直線AB上にある ⟺ $\\overrightarrow{\\mathrm{OP}}=s\\vec{a}+t\\vec{b}$ の係数の和が$s+t=1$』という共線条件を正しく使えるかを測る問題。",
why: "直線AB上の点は$\\overrightarrow{\\mathrm{OP}}=s\\vec{a}+t\\vec{b}$ ($s+t=1$)の形で表せる。ここでは$s=\\dfrac{2}{5}$なので、$\\dfrac{2}{5}+k=1$より$k=\\dfrac{3}{5}$。",
mistake: "$s+t=1$という条件を忘れて$s$の値をそのまま$k$として答えてしまう($k=\\dfrac{2}{5}$)。または$1-\\dfrac{2}{5}$の引き算で符号を誤ることがある。",
tip: "『直線AB上』という言葉を見たら、まず頭の中で$s+t=1$を思い出す。これは位置ベクトル分野で最も出題頻度が高い条件の1つ。"
}
},

/* =========================
第4問(空間座標・球面) 模試第6問の再現
========================= */
{
id: "v4-1",
stage: "第4問",
num: 1,
time: 30,
score: 5,
weakness: "計算精度",
route: ["球面の方程式"],
q: "座標空間で、点A(0, 0, 5)を中心とする半径3の球面の方程式を求めよ。",
a: ["x²+y²+(z-5)²=9", "x²+y²+(z-5)²=3", "x²+y²+(z+5)²=9", "x²+y²+z²=9"],
correct: 0,
tags: ["correct", "near_miss", "sign_error", "condition_misread"],
explain: {
aim: "円の方程式の考え方を空間の球面の方程式に正しく拡張できるかを測る問題。",
why: "中心$(a, b, c)$、半径$r$の球面は $(x-a)^{2}+(y-b)^{2}+(z-c)^{2}=r^{2}$。中心$(0,0,5)$、$r=3$を代入して $x^{2}+y^{2}+(z-5)^{2}=9$。",
mistake: "右辺を半径そのままの3にしてしまう(2乗忘れ)、または$(z+5)^{2}$と符号を誤ることがある。",
tip: "『中心の座標は符号が反転して式に入る』『右辺は半径の2乗』。円の方程式と全く同じルール。"
}
},
{
id: "v4-2",
stage: "第4問",
num: 2,
time: 45,
score: 5,
weakness: "計算精度",
route: ["球面の方程式"],
group: "v4-chain1",
groupIntro: "座標空間に、点$A(0, 0, 5)$を中心とする半径3の球面$S: x^{2}+y^{2}+(z-5)^{2}=9$ がある。点$B(1, 2, 0)$からz軸の正の向きに出た光線が、球面S上の点Cに当たる。点Cのx座標は1、y座標は2である。",
q: "点Cのz座標を求めよ。ただし、条件を満たす点は2つあり、Cはz座標が小さい方の点である。",
a: ["3", "7", "±2", "5"],
correct: 0,
tags: ["correct", "condition_misread", "near_miss", "concept_gap"],
explain: {
aim: "2次方程式から出た複数の解を、問題文の条件で正しく選別できるかを測る問題。",
why: "$x=1, y=2$を球面の式に代入すると $1+4+(z-5)^{2}=9$、$(z-5)^{2}=4$、$z-5=\\pm2$ より $z=3, 7$。『z座標が小さい方』という条件から $z=3$。",
mistake: "$z=7$(大きい方)を選んでしまう条件の読み落とし。また$(z-5)=\\pm2$を出した段階で$\\pm2$と答えて、5を足し戻すのを忘れることがある。",
tip: "2つ解が出たら、必ず問題文に戻って『どちらを選べという条件か』を確認してから答える。"
}
},
{
id: "v4-3",
stage: "第4問",
num: 3,
time: 40,
score: 5,
weakness: "計算精度",
route: ["成分計算"],
group: "v4-chain1",
groupIntro: "座標空間に、点$A(0, 0, 5)$を中心とする半径3の球面$S: x^{2}+y^{2}+(z-5)^{2}=9$ がある。点$B(1, 2, 0)$からz軸の正の向きに出た光線が、球面S上の点Cに当たる。",
recap: ["(1) 点Cの座標は $(1, 2, 3)$"],
q: "ベクトル$\\overrightarrow{\\mathrm{CA}}$(CからAへ向かうベクトル)の成分を求めよ。",
a: ["(-1, -2, 2)", "(1, 2, -2)", "(1, 2, 3)", "(-1, -2, -2)"],
correct: 0,
tags: ["correct", "sign_error", "concept_gap", "calc_error"],
explain: {
aim: "空間ベクトルでも『終点-始点』のルールを正しく適用できるかを測る問題。",
why: "CA→=(Aの座標)-(Cの座標)=$(0-1, 0-2, 5-3)=(-1, -2, 2)$。大きさは$\\sqrt{1+4+4}=3$で、球面の半径と一致する(CはS上の点なので当然)。",
mistake: "$C-A$の順で引いて$(1, 2, -2)$としてしまう(向きが逆)。3次元でも『終点-始点』のルールは同じ。",
tip: "計算後に$|\\overrightarrow{\\mathrm{CA}}|$を出してみて、半径3と一致するか検算できる。図形の条件は検算材料になる。"
}
},
{
id: "v4-4",
stage: "第4問",
num: 4,
time: 40,
score: 5,
weakness: "計算精度",
route: ["内積", "成分計算"],
group: "v4-chain1",
groupIntro: "座標空間に、点$A(0, 0, 5)$を中心とする半径3の球面$S: x^{2}+y^{2}+(z-5)^{2}=9$ がある。点$B(1, 2, 0)$からz軸の正の向きに出た光線が、球面S上の点Cに当たる。",
recap: ["(1) 点Cの座標は $(1, 2, 3)$", "(2) $\\overrightarrow{\\mathrm{CA}}=(-1, -2, 2)$"],
q: "$\\overrightarrow{\\mathrm{CB}}$の成分を求めた上で、内積 $\\overrightarrow{\\mathrm{CA}}\\cdot\\overrightarrow{\\mathrm{CB}}$ を計算せよ。",
a: ["-6", "6", "0", "-3"],
correct: 0,
tags: ["correct", "sign_error", "near_miss", "calc_error"],
explain: {
aim: "成分に0が多いケースで、早合点せず最後まで正確に内積を計算できるかを測る問題。",
why: "CB→=(Bの座標)-(Cの座標)=$(1-1, 2-2, 0-3)=(0, 0, -3)$。内積は $\\overrightarrow{\\mathrm{CA}}\\cdot\\overrightarrow{\\mathrm{CB}}=(-1)\\times0+(-2)\\times0+2\\times(-3)=-6$。",
mistake: "$\\overrightarrow{\\mathrm{CB}}$の成分に0が2つ並ぶので『内積も0だろう』と早合点しがち。z成分の積 $2\\times(-3)=-6$ が残る。",
tip: "成分に0が多いときほど、残る項の計算に集中する。0でない成分の組が1つでもあれば内積は0とは限らない。"
}
},
{
id: "v4-5",
stage: "第4問",
num: 5,
time: 40,
score: 5,
weakness: "共通点抽出",
route: ["ベクトルの大きさ"],
group: "v4-chain1",
groupIntro: "座標空間に、点$A(0, 0, 5)$を中心とする半径3の球面$S: x^{2}+y^{2}+(z-5)^{2}=9$ がある。点$B(1, 2, 0)$からz軸の正の向きに出た光線が、球面S上の点Cに当たる。",
recap: ["(1) 点Cの座標は $(1, 2, 3)$", "(2) $\\overrightarrow{\\mathrm{CA}}=(-1, -2, 2)$", "(3) $\\overrightarrow{\\mathrm{CB}}=(0, 0, -3)$、$\\overrightarrow{\\mathrm{CA}}\\cdot\\overrightarrow{\\mathrm{CB}}=-6$"],
q: "ここまでの結果をふりかえる。$|\\overrightarrow{\\mathrm{CA}}|$と$|\\overrightarrow{\\mathrm{CB}}|$を求め、△ABCがどのような三角形かを選べ。",
a: ["CA=CBの二等辺三角形", "正三角形", "∠C=90°の直角三角形", "CA=ABの二等辺三角形"],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "calc_error"],
explain: {
aim: "これまでの設問で求めた成分から大きさを計算し、複数の結果を統合して図形の性質を判断できるか(振り返り型の総合問題)を測る問題。",
why: "$|\\overrightarrow{\\mathrm{CA}}|=\\sqrt{(-1)^{2}+(-2)^{2}+2^{2}}=\\sqrt{9}=3$、$|\\overrightarrow{\\mathrm{CB}}|=\\sqrt{0^{2}+0^{2}+(-3)^{2}}=\\sqrt{9}=3$。CAは球面Sの半径そのものなので3は当然だが、CBも同じ3になっている。CA=CB=3なので、△ABCはCA=CBの二等辺三角形。ちなみに(3)で求めた内積$-6$を使うと$\\cos C=\\dfrac{-6}{3\\times3}=-\\dfrac{2}{3}\\neq0$なので直角三角形ではない。",
mistake: "『C(点C)は球面上の点だから何か特別な直角関係があるはず』と思い込み、内積が0でないのに直角三角形を選んでしまうことがある。または正三角形と早合点することもあるが、辺ABの長さは$\\sqrt{30}$でCA・CBとは異なる。",
tip: "振り返り型の設問は、前の設問で出した数値を並べて比較するだけで答えが見えることが多い。新しい計算をする前に、まず『すでに求めた値の中に答えのヒントがないか』を確認する。"
}
}

];
