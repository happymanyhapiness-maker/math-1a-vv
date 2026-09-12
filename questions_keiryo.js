const ROUTE_CHOICES_KEIRYO = [
  "接線の長さ",
  "角の二等分線",
  "三平方",
  "面積",
  "面積→半径",
  "方べき",
  "正弦定理",
  "余弦定理",
  "平方完成",
  "文字をそろえる",
  "同じ量を2通りで表す",
  "共通点の抽出"
];
const questions_keiryo = [

/* =========================
第1問（三角比・式変形）
========================= */
{
id: "q1-1",
stage: "第1問",
num: 1,
time: 30,
score: 5,
weakness: "計算精度",
route: ["文字をそろえる"],
q: "$0\\le\\theta\\le\\dfrac{\\pi}{2}$ のとき、$\\sin\\theta+\\cos\\theta=1$。$1+2\\sin\\theta\\cos\\theta$ の値は？",
a: ["1", "0", "2", "1/2"],
correct: 0,
tags: ["correct", "near_miss", "calc_error", "calc_error"],
explain: {
aim: "(sinθ+cosθ)の2乗展開からsin²θ+cos²θ=1につなげて、和の情報を積の情報に変換できるかを測る問題。",
why: "$(\\sin\\theta+\\cos\\theta)^{2}$ を展開すると、$\\sin^{2}\\theta+2\\sin\\theta\\cos\\theta+\\cos^{2}\\theta$ となる。\n\nここで $\\sin^{2}\\theta+\\cos^{2}\\theta=1$ より、$(\\sin\\theta+\\cos\\theta)^{2}=1+2\\sin\\theta\\cos\\theta$。\n\n条件より $\\sin\\theta+\\cos\\theta=1$ なので、左辺は $1^{2}=1$。\n\nしたがって $1+2\\sin\\theta\\cos\\theta=1$。\n\nよって求める値は 1。",
mistake: "$(a+b)^{2}$ を $a^{2}+b^{2}$ としてしまい、真ん中の $2ab$ を落とすミスが多い。",
tip: "和や差が出たら、まず2乗して $\\sin^{2}\\theta+\\cos^{2}\\theta=1$ につなげる。"
}
},
{
id: "q1-2",
stage: "第1問",
num: 2,
time: 35,
score: 5,
weakness: "計算精度",
route: ["文字をそろえる"],
q: "$0\\le\\theta\\le\\dfrac{\\pi}{2}$ のとき、$\\sin\\theta+\\cos\\theta=a$。$\\sin2\\theta$ を $a$ を用いて表せ。",
a: ["a^2-1", "1-a^2", "a^2+1", "2a"],
correct: 0,
tags: ["correct", "sign_error", "calc_error", "concept_gap"],
explain: {
aim: "同じ変形(2乗して1を引く)を、文字aを使った一般的な式に応用できるかを測る問題。",
why: "条件より $\\sin\\theta+\\cos\\theta=a$ なので、両辺を2乗すると $(\\sin\\theta+\\cos\\theta)^{2}=a^{2}$。\n\n一方で、$(\\sin\\theta+\\cos\\theta)^{2}=\\sin^{2}\\theta+2\\sin\\theta\\cos\\theta+\\cos^{2}\\theta=1+2\\sin\\theta\\cos\\theta$。\n\nしたがって $1+2\\sin\\theta\\cos\\theta=a^{2}$。\n\n両辺から1を引くと、$2\\sin\\theta\\cos\\theta=a^{2}-1$。\n\nここで $\\sin2\\theta=2\\sin\\theta\\cos\\theta$ より、$\\sin2\\theta=a^{2}-1$。",
mistake: "$1+2\\sin\\theta\\cos\\theta=a^{2}$ から移項するとき、符号を逆にして $1-a^{2}$ としてしまうことがある。",
tip: "$a^{2}-1$ か $1-a^{2}$ か迷ったら、$\\theta=0$($a=1, \\sin2\\theta=0$)を代入して検算する。"
}
},
{
id: "q1-3",
stage: "第1問",
num: 3,
time: 40,
score: 5,
weakness: "方針切替",
route: ["文字をそろえる"],
q: "$0\\le\\theta\\le\\dfrac{\\pi}{2}$ のとき、$\\sin\\theta=\\cos2\\theta$ を満たす $\\theta$ は？",
a: ["π/6", "π/4", "π/3", "π/2"],
correct: 0,
tags: ["correct", "concept_gap", "calc_error", "range_error"],
explain: {
aim: "三角方程式で、異なる関数(sinとcos2θ)の混在を1種類の文字にそろえてから解けるかを測る問題。",
why: "$\\sin\\theta=\\cos2\\theta$ では、$\\sin$ と $\\cos2\\theta$ が混ざっているので、そのままだと扱いにくい。\n\nそこで $\\cos2\\theta=1-2\\sin^{2}\\theta$ として、$\\sin$ だけの式にそろえる。\n\n$\\sin\\theta=1-2\\sin^{2}\\theta$ となるので、$s=\\sin\\theta$ とおくと $s=1-2s^{2}$。\n\n整理すると $2s^{2}+s-1=0$。\n\n因数分解すると $(2s-1)(s+1)=0$ なので、$s=\\dfrac{1}{2}, -1$。\n\n$0\\le\\theta\\le\\dfrac{\\pi}{2}$ なので $\\sin\\theta$ は0以上。したがって $\\sin\\theta=\\dfrac{1}{2}$。\n\nよって $\\theta=\\dfrac{\\pi}{6}$。",
mistake: "$\\cos2\\theta$ を $\\cos^{2}\\theta-\\sin^{2}\\theta$ にして文字種を増やし、処理を重くして止まることが多い。",
tip: "三角方程式では『文字種をそろえる』のが最初の一手。今回は $\\sin$ にそろえる。"
}
},
{
id: "q1-4",
stage: "第1問",
num: 4,
time: 35,
score: 5,
weakness: "計算精度",
route: ["文字をそろえる"],
q: "$0\\le\\theta\\le\\dfrac{\\pi}{2}$ のとき、$\\sin\\theta+\\cos\\theta=\\sqrt{2}$。$\\sin\\theta\\cos\\theta$ は？",
a: ["1/2", "1", "3/2", "√2"],
correct: 0,
tags: ["correct", "near_miss", "calc_error", "concept_gap"],
explain: {
aim: "平方の展開から積の値を求める際、割り算まで含めて最後まで計算できるかを測る問題。",
why: "$(\\sin\\theta+\\cos\\theta)^{2}$ を展開すると、$\\sin^{2}\\theta+2\\sin\\theta\\cos\\theta+\\cos^{2}\\theta$ となる。\n\nここで $\\sin^{2}\\theta+\\cos^{2}\\theta=1$ より、$(\\sin\\theta+\\cos\\theta)^{2}=1+2\\sin\\theta\\cos\\theta$。\n\n条件より $\\sin\\theta+\\cos\\theta=\\sqrt{2}$ なので、左辺は $(\\sqrt{2})^{2}=2$。\n\nしたがって $1+2\\sin\\theta\\cos\\theta=2$。\n\n両辺から1を引くと、$2\\sin\\theta\\cos\\theta=1$。\n\n最後に2で割って、$\\sin\\theta\\cos\\theta=\\dfrac{1}{2}$。",
mistake: "$2\\sin\\theta\\cos\\theta=1$ のあと、2で割るのを忘れるミスが多い。",
tip: "途中式を1行飛ばさず、『$2\\sin\\theta\\cos\\theta=1$』を書いてから割る。"
}
},
{
id: "q1-5",
stage: "第1問",
num: 5,
time: 35,
score: 5,
weakness: "方針切替",
route: ["文字をそろえる"],
q: "$0\\le\\theta\\le\\dfrac{\\pi}{2}$ のとき、$\\sin\\theta+\\cos\\theta=\\sqrt{2}$。$\\sin\\theta-\\cos\\theta$ は？",
a: ["0", "1", "-1", "√2"],
correct: 0,
tags: ["correct", "concept_gap", "sign_error", "concept_gap"],
explain: {
aim: "差の2乗を使って、既知の積の値から差の値を求められるかを測る問題。",
why: "問4より $\\sin\\theta\\cos\\theta=\\dfrac{1}{2}$。\n\n差を求めたいので、$(\\sin\\theta-\\cos\\theta)^{2}$ を考える。\n\n$(\\sin\\theta-\\cos\\theta)^{2}=\\sin^{2}\\theta-2\\sin\\theta\\cos\\theta+\\cos^{2}\\theta$。\n\n$\\sin^{2}\\theta+\\cos^{2}\\theta=1$ なので、$(\\sin\\theta-\\cos\\theta)^{2}=1-2\\sin\\theta\\cos\\theta$。\n\n$\\sin\\theta\\cos\\theta=\\dfrac{1}{2}$ を代入すると、$1-2\\times\\dfrac{1}{2}=0$。\n\nしたがって $(\\sin\\theta-\\cos\\theta)^{2}=0$ なので、$\\sin\\theta-\\cos\\theta=0$。",
mistake: "2乗して0になったあと、±を付けて迷うことがある。",
tip: "2乗して0なら元の値も0。"
}
},
{
id: "q1-6",
stage: "第1問",
num: 6,
time: 45,
score: 5,
weakness: "計算精度",
route: ["文字をそろえる"],
q: "$0\\le\\theta\\le\\dfrac{\\pi}{2}$ のとき、$\\sin\\theta+\\cos\\theta=\\sqrt{2}$。$\\sin^{3}\\theta+\\cos^{3}\\theta$ は？",
a: ["√2/2", "√2", "3√2/2", "1/√2"],
correct: 0,
tags: ["correct", "near_miss", "sign_error", "calc_error"],
explain: {
aim: "高次の対称式を、因数分解の公式と既知の和・積の値を使って求められるかを測る問題。",
why: "$a=\\sin\\theta, b=\\cos\\theta$ とおくと、求めたい式は $a^{3}+b^{3}$。\n\n三乗和の公式より、$a^{3}+b^{3}=(a+b)(a^{2}-ab+b^{2})$。\n\nここで $a+b=\\sin\\theta+\\cos\\theta=\\sqrt{2}$。\n\nまた問4より $ab=\\sin\\theta\\cos\\theta=\\dfrac{1}{2}$、さらに $a^{2}+b^{2}=\\sin^{2}\\theta+\\cos^{2}\\theta=1$。\n\nしたがって $a^{2}-ab+b^{2}=1-\\dfrac{1}{2}=\\dfrac{1}{2}$。\n\nよって $\\sin^{3}\\theta+\\cos^{3}\\theta=\\sqrt{2}\\times\\dfrac{1}{2}=\\dfrac{\\sqrt{2}}{2}$。",
mistake: "$a^{3}+b^{3}$ の公式を思い出しても、$a^{2}+b^{2}=1$ や $ab=\\dfrac{1}{2}$ の代入で止まることがある。",
tip: "高次式は『まず因数分解できるか』を見る。"
}
},

/* =========================
第1問追加(正弦定理・余弦定理)
========================= */
{
id: "k6-1",
stage: "第1問",
num: 7,
time: 40,
score: 5,
weakness: "計算精度",
route: ["正弦定理"],
q: "△ABCにおいて、∠A=45°、∠B=60°、BC=a=$\\sqrt{6}$のとき、正弦定理を用いて辺AC=bの長さを求めよ。",
a: ["3", "2", "√6", "9"],
correct: 0,
tags: ["correct", "ratio_reverse", "concept_gap", "calc_error"],
explain: {
aim: "正弦定理$\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}$を、どちらの辺にどちらの角のsinを対応させるか間違えずに使えるかを測る問題。",
why: "正弦定理より$\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}$なので、$b=a\\times\\dfrac{\\sin B}{\\sin A}$。\n\n$\\sin A=\\sin45°=\\dfrac{\\sqrt{2}}{2}$、$\\sin B=\\sin60°=\\dfrac{\\sqrt{3}}{2}$を代入すると、$b=\\sqrt{6}\\times\\dfrac{\\sqrt{3}/2}{\\sqrt{2}/2}=\\sqrt{6}\\times\\dfrac{\\sqrt{3}}{\\sqrt{2}}=\\sqrt{9}=3$。",
mistake: "分数を逆にして$b=a\\times\\dfrac{\\sin A}{\\sin B}$と計算すると、$\\sqrt{6}\\times\\dfrac{\\sqrt{2}/2}{\\sqrt{3}/2}=\\sqrt{4}=2$になってしまう。『求めたい辺の対角のsinを分子に』という対応を逆にしやすい。",
tip: "正弦定理は『辺とその対角』が必ずペアで動く。$b$がほしいなら分子は$\\sin B$、と辺と角を指でなぞって確認する。"
}
},
{
id: "k6-2",
stage: "第1問",
num: 8,
time: 45,
score: 6,
weakness: "計算精度",
route: ["余弦定理"],
q: "△ABCにおいて、AB=c=5、AC=b=3、∠A=120°のとき、余弦定理を用いて辺BC=aの長さを求めよ。",
a: ["7", "√19", "8", "49"],
correct: 0,
tags: ["correct", "sign_error", "calc_error", "concept_gap"],
explain: {
aim: "余弦定理$a^{2}=b^{2}+c^{2}-2bc\\cos A$を、∠Aが鈍角(cosAが負)の場合でも符号を正しく扱えるかを測る問題。",
why: "$\\cos120°=-\\dfrac{1}{2}$なので、$a^{2}=b^{2}+c^{2}-2bc\\cos A=3^{2}+5^{2}-2\\times3\\times5\\times\\left(-\\dfrac{1}{2}\\right)=9+25+15=49$。\n\nよって$a=\\sqrt{49}=7$。",
mistake: "∠Aが鈍角であることを見落とし、$\\cos120°$を$+\\dfrac{1}{2}$のまま計算すると、$a^{2}=34-15=19$、$a=\\sqrt{19}$になってしまう(符号ミス)。また$\\cos120°$を$-1$と勘違いすると$a^{2}=34+30=64$、$a=8$になる(120°と180°の混同)。",
tip: "鈍角のcosは必ず負の値。$-2bc\\cos A$の中に負の数を代入すると、全体は$+$になる。符号は先に『鈍角だから最後はプラスに転じるはず』と見積もってから計算すると事故らない。"
}
},
{
id: "k6-3",
stage: "第1問",
num: 9,
time: 50,
score: 6,
weakness: "方針切替",
route: ["余弦定理"],
q: "△ABCにおいて、AB=c=7、BC=a=8、CA=b=5であることが分かっている。余弦定理を用いて$\\cos B$の値を求めよ。",
a: ["11/14", "1/2", "69/56", "11/7"],
correct: 0,
tags: ["correct", "formula_mismatch", "sign_error", "calc_error"],
explain: {
aim: "余弦定理を『角から見て対辺がどれか』を正しく整理して使えるかを測る問題(3辺既知から角度を求めるパターン)。",
why: "∠Bの対辺はb(=CA=5)なので、$\\cos B=\\dfrac{a^{2}+c^{2}-b^{2}}{2ac}=\\dfrac{8^{2}+7^{2}-5^{2}}{2\\times8\\times7}=\\dfrac{64+49-25}{112}=\\dfrac{88}{112}=\\dfrac{11}{14}$。",
mistake: "対辺の対応を間違え、∠Aの式$\\dfrac{a^{2}+b^{2}-c^{2}}{2ab}$を使ってしまうと、$\\dfrac{64+25-49}{80}=\\dfrac{40}{80}=\\dfrac{1}{2}$という別の角の値を答えてしまう。『∠Bの式には∠Bの対辺bを引く』という対応を、公式を覚えるときにセットで確認する必要がある。",
tip: "余弦定理の分子はいつも『求めたい角を挟む2辺の2乗の和 − その角の対辺の2乗』。角の記号(B)と、引き算される辺の記号(b)が対応していることを、書く前に指差し確認する。"
}
},
{
id: "k6-4",
stage: "第1問",
num: 10,
time: 30,
score: 4,
weakness: "方針切替",
route: ["正弦定理", "余弦定理"],
q: "三角形の辺や角を求める場面のうち、余弦定理(2辺の長さとその間の角から残りの辺を求める、または3辺の長さから角を求める)を使うのが適切なのはどれか。",
a: ["2辺の長さと、その間の角が分かっていて、残りの1辺を求めたいとき", "1辺の長さと、その両端の角(2つの角)が分かっていて、他の辺を求めたいとき", "1つの角の大きさだけが分かっていて、外接円の半径を求めたいとき", "3つの角の大きさだけが分かっていて、辺の比を求めたいとき"],
correct: 0,
tags: ["correct", "formula_mismatch", "concept_gap", "concept_gap"],
explain: {
aim: "与えられている情報(何が分かっていて何を求めたいか)から、正弦定理と余弦定理のどちらを選ぶべきかを判断できるかを測る問題。",
why: "余弦定理が向いているのは『2辺+間の角→残りの辺』または『3辺→角』のパターン。2辺の長さとその間の角が分かっている場合はこれに当てはまるので、余弦定理を使う。",
mistake: "『1辺+両端の2角→他の辺』は、実際には角の比から辺の比が決まる正弦定理の場面。また『1つの角から外接円の半径』も、$\\dfrac{a}{\\sin A}=2R$という正弦定理そのものの形なので、余弦定理は不要。この2つを『角が絡む＝余弦定理』と早合点して選んでしまうことがある。",
tip: "見分け方はシンプル：『間の角(2辺に挟まれた角)』か『3辺すべて』が絡むなら余弦定理。それ以外(角と、その角の対辺のペアが絡む形)は正弦定理、とセットで覚える。"
}
},

/* =========================
第2問（高さ・面積）
========================= */
{
id: "q2-1",
stage: "第2問",
num: 1,
time: 55,
score: 5,
weakness: "計算精度",
route:["三平方"],
q: "三角形ABCで BC=14, CA=13, AB=15。Aから辺BCに下ろした垂線の足をHとする。CH=x のとき $\\mathrm{AH}^{2}$ は？",
a: ["169-x^2", "13-x^2", "169+x^2", "13^2-x"],
correct: 0,
tags: ["correct", "calc_error", "sign_error", "calc_error"],
explain: {
aim: "どの直角三角形に着目するかを決めた上で、三平方の定理を正しく適用できるかを測る問題。",
why: "AからBCに下ろした垂線の足がHなので、三角形AHCは直角三角形になる。\n\nこの直角三角形で、斜辺は AC=13、もう一つの辺は CH=x。\n\n三平方の定理より、$\\mathrm{AH}^{2}+\\mathrm{CH}^{2}=\\mathrm{AC}^{2}$。\n\nしたがって $\\mathrm{AH}^{2}=\\mathrm{AC}^{2}-\\mathrm{CH}^{2}=13^{2}-x^{2}=169-x^{2}$。",
mistake: "$13^{2}$ を26としてしまう、または CH をそのまま引いてしまうことがある。",
tip: "高さを出すときは、どの直角三角形を見るかを先に固定する。"
}
},
{
id: "q2-2",
stage: "第2問",
num: 2,
time: 45,
score: 5,
weakness: "方針切替",
route:["同じ量を2通りで表す"],
q: "三角形ABCで BC=14, CH=x。Aから辺BCに下ろした垂線の足をHとする。BH は？",
a: ["14-x", "x-14", "14+x", "x/14"],
correct: 0,
tags: ["correct", "sign_error", "calc_error", "concept_gap"],
explain: {
aim: "1本の辺が2つに分けられているとき、和の関係を使って残りの長さを求められるかを測る問題。",
why: "点Hは辺BC上にあるので、BC は BH と CH に分かれている。\n\nつまり BC=BH+CH。\n\nBC=14、CH=x だから、14=BH+x。\n\nしたがって BH=14-x。",
mistake: "CH=x を使っているのに、BH を x のまま書いたり符号を逆にすることがある。",
tip: "1本の辺を2つに分けたら、『和で元に戻せるか』を見る。"
}
},
{
id: "q2-3",
stage: "第2問",
num: 3,
time: 65,
score: 5,
weakness: "計算精度",
route:["三平方", "同じ量を2通りで表す"],
q: "三角形ABCで BC=14, CA=13, AB=15。Aから辺BCに下ろした垂線の足をHとし、CH=x とする。x の値は？",
a: ["5", "6", "7", "8"],
correct: 0,
tags: ["correct", "calc_error", "near_miss", "calc_error"],
explain: {
aim: "同じ量(高さの2乗)を2通りの式で表し、方程式として解けるかを測る問題。",
why: "まず直角三角形AHCを見ると、$\\mathrm{AH}^{2}=13^{2}-x^{2}=169-x^{2}$。\n\n次に、BH=14-x なので、直角三角形ABHを見ると、$\\mathrm{AH}^{2}=15^{2}-(14-x)^{2}=225-(14-x)^{2}$。\n\nどちらも同じ $\\mathrm{AH}^{2}$ を表しているので、$169-x^{2}=225-(14-x)^{2}$ とおける。\n\n右辺を展開すると、$225-(196-28x+x^{2})=29+28x-x^{2}$。\n\nしたがって $169-x^{2}=29+28x-x^{2}$。\n\n両辺から $-x^{2}$ を消すと、$169=29+28x$。\n\nよって $140=28x$、$x=5$。",
mistake: "$225-(14-x)^{2}$ の展開で、カッコ前のマイナスを配り忘れるミスが多い。",
tip: "『同じ量を2通りで表した』ら、その2つを等しいとおく。"
}
},
{
id: "q2-4",
stage: "第2問",
num: 4,
time: 45,
score: 5,
weakness: "計算精度",
route:["三平方"],
q: "三角形ABCで BC=14, CA=13, AB=15。Aから辺BCに下ろした垂線の長さ AH は？",
a: ["12", "10", "9", "8"],
correct: 0,
tags: ["correct", "calc_error", "calc_error", "calc_error"],
explain: {
aim: "2乗で求まった値を、最後にルートを取って長さに戻せるかを測る問題。",
why: "問3より CH=x=5。\n\n直角三角形AHCで、AC=13、CH=5。\n\n三平方の定理より、$\\mathrm{AH}^{2}=13^{2}-5^{2}=169-25=144$。\n\n求めるのは $\\mathrm{AH}^{2}$ ではなく AH なので、$\\mathrm{AH}=\\sqrt{144}=12$。",
mistake: "$\\mathrm{AH}^{2}=144$ で止まり、$\\mathrm{AH}=144$ としてしまうことがある。",
tip: "平方で求まった値は最後に長さへ戻す。"
}
},
{
id: "q2-5",
stage: "第2問",
num: 5,
time: 40,
score: 5,
weakness: "計算精度",
route:["面積"],
q: "三角形ABCで BC=14、高さ AH=12。面積は？",
a: ["84", "72", "60", "48"],
correct: 0,
tags: ["correct", "calc_error", "calc_error", "formula_mismatch"],
explain: {
aim: "底辺と高さの対応を正しく取って、三角形の面積公式を使えるかを測る問題。",
why: "三角形の面積は、$\\dfrac{1}{2}$×底辺×高さ。\n\nここでは底辺を BC=14 と見ると、その底辺に対する高さは AH=12。\n\nしたがって 面積$=\\dfrac{1}{2}\\times14\\times12=84$。",
mistake: "$\\dfrac{1}{2}$ を忘れたり、底辺と高さの対応を取り違えることがある。",
tip: "面積は『どの底辺に対する高さか』をセットで確認する。"
}
},
{
id: "q2-6",
stage: "第2問",
num: 6,
time: 55,
score: 5,
weakness: "方針切替",
route:["同じ量を2通りで表す"],
q: "三角形ABCで Aから辺BCに下ろした垂線の長さが 12。辺BC上に点Xを取り CX=t とする。△ACX の面積は？",
a: ["6t", "12t", "3t", "7t"],
correct: 0,
tags: ["correct", "formula_mismatch", "calc_error", "condition_misread"],
explain: {
aim: "底辺が同一直線上にあるとき、高さが共通することを理解して面積を表せるかを測る問題。",
why: "X は辺BC上にあるので、CX も BC と同じ直線上にある。\n\n△ACX の底辺を CX=t と見ると、Aからその直線への高さは、AからBCへの高さと同じ 12。\n\nしたがって △ACX の面積は $\\dfrac{1}{2}\\times t\\times12=6t$。",
mistake: "底辺が CX に変わったことで、高さも変わると勘違いすることがある。",
tip: "底辺が同一直線上なら、高さが共通になることが多い。"
}
},
{
id: "q2-7",
stage: "第2問",
num: 7,
time: 45,
score: 5,
weakness: "計算精度",
route:["同じ量を2通りで表す"],
q: "△ABC の面積が 84。辺BC上の点Xに対して CX=t とし、△ACX の面積が 6t とする。△ACX の面積が △ABC の半分のとき CX は？",
a: ["7", "6", "8", "5"],
correct: 0,
tags: ["correct", "calc_error", "calc_error", "calc_error"],
explain: {
aim: "面積の比の条件を、式に立てて方程式として解けるかを測る問題。",
why: "△ABC の面積は 84 なので、その半分は 42。\n\n△ACX の面積は 6t と表されている。\n\n『△ACX の面積が △ABC の半分』なので、$6t=42$。\n\nしたがって $t=7$。\n\nCX=t だから、CX=7。",
mistake: "84 の半分を取り違えたり、$6t=84$ としてしまうことがある。",
tip: "比の問題は、まず『何と何が等しいか』を式にする。"
}
},

/* =========================
第3問（内接円）
========================= */
{
id: "q3-1",
stage: "第3問",
num: 1,
time: 45,
score: 5,
weakness: "計算精度",
route: ["接線の長さ"],   // ←これ追加
q: "三角形ABCの内接円と辺BC, CA, ABとの接点をそれぞれ P, Q, R とする。BP=4, CQ=2, AR=3 のとき、AB, AC, BC は？",
a: ["7,5,6", "6,7,5", "5,6,7", "7,6,5"],
correct: 0,
tags: ["correct", "diagram_reading", "diagram_reading", "diagram_reading"],
explain: {
aim: "内接円の接線の長さが等しいという性質を使って、各辺の長さを求められるかを測る問題。",
why: "同じ点から円に引いた2本の接線の長さは等しい。\n\n点Bからの接線なので、BR=BP=4。\n\n点Cからの接線なので、CP=CQ=2。\n\n点Aからの接線なので、AQ=AR=3。\n\nしたがって AB=AR+BR=3+4=7、AC=AQ+CQ=3+2=5、BC=BP+CP=4+2=6。",
mistake: "どの線分どうしが等しいかを取り違えることが多い。",
tip: "まず等しい長さを書く→そのあと各辺を足し算で出す。"
}
},
{
id: "q3-2",
stage: "第3問",
num: 2,
time: 55,
score: 5,
weakness: "方針切替",
route: ["角の二等分線"],   // ←これ追加
q: "三角形ABCの内心をIとし、AIとBCの交点をDとする。AB=7, AC=5 のとき BD:DC は？",
a: ["7:5", "5:7", "6:6", "3:2"],
correct: 0,
tags: ["correct", "ratio_reverse", "concept_gap", "formula_mismatch"],
explain: {
aim: "角の二等分線の定理を使って、対辺を分ける比を正しく求められるかを測る問題。",
why: "I は内心なので、AI は ∠A の二等分線になる。\n\n角の二等分線の定理より、二等分線が対辺 BC を分ける比は、隣り合う辺の比に等しい。\n\nしたがって BD:DC=AB:AC。\n\nAB=7、AC=5 なので、BD:DC=7:5。",
mistake: "BD:DC=AB:AC を思い出せず、5:7 と逆にしてしまうことがある。",
tip: "内心が出たら『角の二等分線』、比を聞かれたら『角の二等分線の定理』を疑う。"
}
},
{
id: "q3-3",
stage: "第3問",
num: 3,
time: 70,
score: 5,
weakness: "計算精度",
route: ["面積→半径"],   // ←これ追加
q: "三角形ABCで AB=7, AC=5, BC=6 のとき、内接円の半径 r は？",
a: ["2√6/3", "√6/3", "2", "√6"],
correct: 0,
tags: ["correct", "calc_error", "concept_gap", "calc_error"],
explain: {
aim: "ヘロンの公式と内接円の半径の公式を組み合わせて使えるかを測る問題。",
why: "内接円の半径 $r$ は、三角形の面積 $S$ と半周長 $s$ を使って $r=\\dfrac{S}{s}$ で求められる。\n\n(内心と3頂点を結ぶと高さ r の三角形が3つでき、S=(1/2)×r×(周の長さ)=rs となるため。)\n\nまず半周長は $s=\\dfrac{7+5+6}{2}=9$。\n\n辺の長さが3本すべて分かっているので、ヘロンの公式(3辺の長さ$a,b,c$と半周長$s$を用いて、面積$S=\\sqrt{s(s-a)(s-b)(s-c)}$で求める公式)で面積を求める。\n\n$S=\\sqrt{s(s-7)(s-5)(s-6)}=\\sqrt{9\\times2\\times4\\times3}=\\sqrt{216}=6\\sqrt{6}$。\n\nしたがって $r=\\dfrac{S}{s}=\\dfrac{6\\sqrt{6}}{9}=\\dfrac{2\\sqrt{6}}{3}$。",
mistake: "半周長ではなく周長を使ったり、ヘロンの公式の平方根を落とすことがある。",
tip: "辺が3本出たら『ヘロン→面積→内接円半径』の流れを疑う。"
}
},
{
id: "q3-4",
stage: "第3問",
num: 4,
time: 60,
score: 5,
weakness: "方針切替",
route: ["方べき"],   // ←これ追加
q: "三角形ABCの内接円と辺ABの接点をRとし、AR=3 とする。Aから円に引いた任意の直線が円と交わる2点を、Aに近い方から Y, Z とするとき、AY×AZ は？",
a: ["9", "16", "4", "25"],
correct: 0,
tags: ["correct", "diagram_reading", "concept_gap", "diagram_reading"],
explain: {
aim: "方べきの定理を使って、割線の積を接線の長さから求められるかを測る問題。",
why: "Aから円に引いた直線が円と2点Y,Zで交わっているので、AY×AZ は A の方べきで表せる。\n\nまた、Aから同じ円に引いた接線の長さは AR=3。\n\n方べきの定理より、割線の積 AY×AZ は接線の長さの2乗に等しい。\n\nしたがって $\\mathrm{AY}\\times\\mathrm{AZ}=\\mathrm{AR}^{2}=3^{2}=9$。",
mistake: "Y,Z を個別に求めようとして重くしてしまうことがある。",
tip: "円と直線の2交点が出たら、『積』は方べきで一気に処理できないか確認する。"
}
},

/* =========================
第4問（誘導・最大値）
========================= */
{
id: "q4-1",
stage: "第4問",
num: 1,
time: 25,
score: 5,
weakness: "時間判断",
route: [],   // ←これ追加
q: "中心B、半径6の円上に点Pがある。BP の長さは？",
a: ["6", "5", "√6", "3"],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "time_pressure"],
explain: {
aim: "図形の定義から即座に答えが出る問題を、余計な計算をせず見抜けるかを測る問題。",
why: "P は中心B、半径6の円上にある。\n\n円上の点と中心を結んだ線分は、必ず半径になる。\n\nしたがって BP は半径そのものなので、BP=6。",
mistake: "BPが半径そのものだと気づかず、余弦定理など別の道具を探して時間を使ってしまうことがある。",
tip: "図形情報だけで終わる問題は、式を立てる前に終われるか確認する。"
}
},
{
id: "q4-2",
stage: "第4問",
num: 2,
time: 45,
score: 5,
weakness: "方針切替",
route: ["平方完成"],   // ←これ追加
q: "$36-(x-6)^{2}$ を整理した式はどれ？",
a: ["12x-x^2", "36-x^2", "x^2-12x", "12-x^2"],
correct: 0,
tags: ["correct", "concept_gap", "sign_error", "calc_error"],
explain: {
aim: "展開と、かっこの前の符号の配分を正確に行えるかを測る問題。",
why: "まず $(x-6)^{2}$ を展開すると、$x^{2}-12x+36$。\n\nしたがって $36-(x-6)^{2}=36-(x^{2}-12x+36)$。\n\nカッコの前にマイナスがあるので、中の符号をすべて変える。\n\n$36-x^{2}+12x-36$ となり、36 と -36 が消える。\n\nよって $12x-x^{2}$。",
mistake: "前のマイナスを全体に配れず、符号を落とすことがある。",
tip: "『カッコの前のマイナス』は全体に配る。"
}
},
{
id: "q4-3",
stage: "第4問",
num: 3,
time: 60,
score: 5,
weakness: "方針切替",
route: ["平方完成"],   // ←これ追加
q: "$S\\gt0$ とする。$S^{2}=12x-x^{2}$ のとき、$S$ が最大となる$x$は？",
a: ["6", "3", "0", "12"],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "range_error"],
explain: {
aim: "平方根を含む式の最大値問題を、2乗して2次式に直して解けるかを測る問題。",
why: "$S^{2}=12x-x^{2}$ を平方完成すると、$S^{2}=-(x-6)^{2}+36$。\n\nこれは下に開く2次式なので、頂点で最大になる。\n\n頂点の x 座標は 6 だから、$S^{2}$ は $x=6$ のとき最大。\n\nまた条件より $S\\gt0$。$S\\gt0$ のときは、2乗しても大小関係が変わらないので、$S^{2}$ が最大になるとき $S$ も最大になる。\n\nしたがって $S$ が最大となる $x$ は6。",
mistake: "S をそのまま扱って止まったり、平方してよいことを見落とすことがある。",
tip: "平方根を含む最大最小は、まず2乗して2次式に直せるかを見る。"
}
},
{
id: "q4-4",
stage: "第4問",
num: 4,
time: 25,
score: 5,
weakness: "時間判断",
route: [],   // ←これ追加
q: "S が最大となる点は？",
a: ["x=6", "x=3", "x=0", "一定"],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "concept_gap"],
explain: {
aim: "前の設問の結論をそのまま確認する設問だと気づき、無駄な計算をせず答えられるかを測る問題。",
why: "問3で、$S$ が最大となるのは $x=6$ のときだと分かった。\n\nこの問題は新しく計算する問題ではなく、前問の結論を確認する問題。\n\nしたがって $S$ が最大となる点は $x=6$。",
mistake: "最後の確認問題なのに前の結果を見返さず、中央の$x=3$を選ぶことがある。",
tip: "最終問題は『新しく解く』より『前問の結論確認』で終わることが多い。"
}
},

/* =========================
第4問(共通点の抽出)
========================= */
{
id: "k5-1",
stage: "第4問",
num: 5,
time: 50,
score: 5,
weakness: "共通点抽出",
route: ["共通点の抽出"],
q: "半径5の円に内接する3つの三角形P、Q、Rについて、1辺の長さ$a$と、その辺の対角のsinの値を調べたところ、次のようになった。\n三角形P: $a=6$, 対角のsin$=\\dfrac{3}{5}$\n三角形Q: $a=8$, 対角のsin$=\\dfrac{4}{5}$\n三角形R: $a=5$, 対角のsin$=\\dfrac{1}{2}$\nこの3つすべてに共通して成り立つことはどれか。",
a: ["a÷(対角のsin)の値がすべて10になる", "対角のsinの値がすべて等しい", "辺aの長さがすべて偶数である", "3つの三角形の面積がすべて等しい"],
correct: 0,
tags: ["correct", "condition_misread", "partial_match", "concept_gap"],
explain: {
aim: "複数の三角形に共通する性質を、個々の数値の見た目ではなく関係式(正弦定理)から見抜けるかを測る問題。",
why: "正弦定理より、a÷(対角のsin)=2R(外接円の直径)が成り立つ。\n\n3つとも同じ半径5の円に内接しているので、この値は必ず$2\\times5=10$で一致する。\n\n実際に計算しても、$6\\div\\dfrac{3}{5}=10$、$8\\div\\dfrac{4}{5}=10$、$5\\div\\dfrac{1}{2}=10$で、すべて10になる。",
mistake: "辺aの値(6、8、5)のうち6と8が偶数であることに注目し、『すべて偶数』を共通点と誤認することがある。5は奇数なので、3つのうち2つだけに成り立つ性質。",
tip: "個別の数値の見た目(偶数・奇数など)ではなく、『同じ円に内接する』という条件が保証する関係式(正弦定理)に注目すると、計算しなくても共通点が見抜ける。"
}
},
{
id: "k5-2",
stage: "第4問",
num: 6,
time: 55,
score: 5,
weakness: "共通点抽出",
route: ["共通点の抽出", "面積"],
q: "次の3つの三角形について、2辺の長さと、その間の角のsinの値が分かっている。\n三角形P: 2辺が4と5、間の角のsin$=\\dfrac{1}{2}$\n三角形Q: 2辺が2と10、間の角のsin$=\\dfrac{1}{2}$\n三角形R: 2辺が5と8、間の角のsin$=\\dfrac{1}{4}$\nこの3つすべてに共通して成り立つことはどれか。",
a: ["面積がすべて5で等しい", "間の角のsinの値がすべて等しい", "2辺の積がすべて20である", "3つの三角形はすべて互いに合同である"],
correct: 0,
tags: ["correct", "partial_match", "partial_match", "concept_gap"],
explain: {
aim: "複数の事例で一部だけ一致する値に惑わされず、共通する性質(面積)を正しく見抜けるかを測る問題。",
why: "三角形の面積は S=(1/2)×(2辺の積)×(間の角のsin) で求められる。\n\nP: $\\dfrac{1}{2}\\times4\\times5\\times\\dfrac{1}{2}=5$\nQ: $\\dfrac{1}{2}\\times2\\times10\\times\\dfrac{1}{2}=5$\nR: $\\dfrac{1}{2}\\times5\\times8\\times\\dfrac{1}{4}=5$\n\nすべて面積5で一致する。",
mistake: "PとQを見ると、sinがどちらも$\\dfrac{1}{2}$、2辺の積がどちらも20なので、②や③を共通点と誤認しやすい。しかしRはsin$=\\dfrac{1}{4}$、積$=40$で、どちらも崩れる。最初の2つが一致すると、3つ目の確認を省略しがちになる。",
tip: "個別の数値(sinや辺の積)はバラバラでも、公式に代入した結果(面積)は一致することがある。共通点は『値そのもの』だけでなく『計算した結果』にも隠れている。"
}
},

];
