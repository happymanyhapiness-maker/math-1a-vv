const ROUTE_CHOICES_SHISUU = [
  "指数法則",
  "置き換え(tの式)",
  "相加相乗平均",
  "対数の定義",
  "対数の計算法則",
  "真数条件",
  "tの範囲の確認"
];

const questions_shisuu = [

/* =========================
第1問(指数法則の基礎)
========================= */
{
id: "sh1-1",
stage: "第1問",
num: 1,
time: 20,
score: 5,
weakness: "計算精度",
route: ["指数法則"],
q: "2^x × 2^(-x) の値を求めよ。",
a: ["1", "-1", "0", "2"],
correct: 0,
tags: ["correct", "sign_error", "concept_gap", "calc_error"],
explain: {
why: "指数法則より 2^x × 2^(-x) = 2^(x+(-x)) = 2^0 = 1。",
mistake: "『xと-xで打ち消し合うからマイナス』のように、符号の感覚だけで-1と答えてしまうことがある。掛け算では指数どうしが足されて0になり、2^0=1。",
tip: "この+1か-1かの1文字は、置き換え問題の解の公式の中身(√の中)を左右する超重要ポイント。反射で1と言えるまで確認する。"
}
},
{
id: "sh1-2",
stage: "第1問",
num: 2,
time: 20,
score: 5,
weakness: "計算精度",
route: ["指数法則"],
q: "a^2 × a^5 を計算せよ。",
a: ["a^7", "a^10", "a^3", "(2a)^7"],
correct: 0,
tags: ["correct", "formula_mismatch", "calc_error", "concept_gap"],
explain: {
why: "同じ底の掛け算は指数の足し算。a^2 × a^5 = a^(2+5) = a^7。",
mistake: "指数どうしを掛けてa^10としてしまう。『掛け算→指数は足す』『累乗→指数は掛ける』を混同しやすい。",
tip: "a^2×a^5=(a×a)×(a×a×a×a×a)と書き下せば、aが7個で指数の足し算だと納得できる。"
}
},
{
id: "sh1-3",
stage: "第1問",
num: 3,
time: 30,
score: 5,
weakness: "方針切替",
route: ["指数法則"],
q: "4^x を 2^x を使って表すと、どうなるか。",
a: ["(2^x)^2", "2×2^x", "2^(x+2)", "4×2^x"],
correct: 0,
tags: ["correct", "formula_mismatch", "formula_mismatch", "concept_gap"],
explain: {
why: "4=2² なので、4^x=(2²)^x=2^(2x)=(2^x)²。つまり4^xは2^xの『2乗』。",
mistake: "4=2×2のイメージから『4^x=2×2^x(2倍)』と処理してしまうことがある。2倍と2乗は全く違う。",
tip: "置き換え問題で4^xが出てきたら、まず(2^x)²に書き直す。この一手が後の式変形の全てを決める。"
}
},
{
id: "sh1-4",
stage: "第1問",
num: 4,
time: 45,
score: 5,
weakness: "方針切替",
route: ["置き換え(tの式)"],
q: "t=2^x+2^(-x) とおくとき、4^x+4^(-x) をtで表せ。",
a: ["t²-2", "2t-2", "t²", "t²-4"],
correct: 0,
tags: ["correct", "formula_mismatch", "near_miss", "calc_error"],
explain: {
why: "t²=(2^x+2^(-x))²=4^x+2×2^x×2^(-x)+4^(-x)=4^x+2+4^(-x)。真ん中の項は2×1=2。よって 4^x+4^(-x)=t²-2。",
mistake: "『4^xは2^xの2倍』という誤解から2t-2と変形してしまう。また、展開の真ん中の項(+2)を引き忘れてt²とすることがある。",
tip: "(A+B)²=A²+2AB+B²の『2AB』を必ず書き出す。ここでは2AB=2×2^x×2^(-x)=2×1=2。"
}
},

/* =========================
第2問(値の範囲・計算)
========================= */
{
id: "sh2-1",
stage: "第2問",
num: 1,
time: 40,
score: 5,
weakness: "方針切替",
route: ["相加相乗平均"],
q: "xがすべての実数を動くとき、2^x+2^(-x) の最小値を求めよ。",
a: ["2", "0", "1", "√2"],
correct: 0,
tags: ["correct", "concept_gap", "calc_error", "calc_error"],
explain: {
why: "2^x>0, 2^(-x)>0 なので相加平均・相乗平均の関係が使えて、2^x+2^(-x)≥2√(2^x×2^(-x))=2√1=2。等号はx=0のとき成立。よって最小値2。",
mistake: "『指数はいくらでも小さくなる』という感覚で0や1と答えてしまうことがある。正の数どうしの和には下限がある。",
tip: "『正の数+その逆数』の形を見たら相加相乗。t=2^x+2^(-x)と置き換える問題では、t≥2という範囲条件がセットでついてくる。"
}
},
{
id: "sh2-2",
stage: "第2問",
num: 2,
time: 30,
score: 5,
weakness: "計算精度",
route: ["指数法則"],
q: "2^x=3 のとき、4^x の値を求めよ。",
a: ["9", "6", "12", "81"],
correct: 0,
tags: ["correct", "formula_mismatch", "calc_error", "calc_error"],
explain: {
why: "4^x=(2^x)²=3²=9。",
mistake: "4^x=2×2^xと誤解して3×2=6としてしまう。2乗と2倍の混同。",
tip: "第1問で確認した『4^x=(2^x)²』を具体的な数で使う練習。値を代入して確かめる癖をつける。"
}
},

/* =========================
第3問(対数)
========================= */
{
id: "sh3-1",
stage: "第3問",
num: 1,
time: 20,
score: 5,
weakness: "計算精度",
route: ["対数の定義"],
q: "log₂8 の値を求めよ。",
a: ["3", "4", "2", "8"],
correct: 0,
tags: ["correct", "calc_error", "concept_gap", "concept_gap"],
explain: {
why: "log₂8は『2を何乗したら8になるか』。2³=8なので、答えは3。",
mistake: "定義を思い出せず、8÷2=4のような別の計算をしてしまうことがある。",
tip: "logを見たら『(底)を何乗したら(真数)になる?』と日本語に翻訳する。この翻訳が対数の全ての基本。"
}
},
{
id: "sh3-2",
stage: "第3問",
num: 2,
time: 30,
score: 5,
weakness: "計算精度",
route: ["対数の計算法則"],
q: "log₁₀2 + log₁₀5 の値を求めよ。",
a: ["1", "log₁₀7", "7", "10"],
correct: 0,
tags: ["correct", "formula_mismatch", "concept_gap", "concept_gap"],
explain: {
why: "logの足し算は真数の掛け算。log₁₀2+log₁₀5=log₁₀(2×5)=log₁₀10=1。",
mistake: "真数どうしを足してlog₁₀7としてしまう。『logの和→真数の積』『logの差→真数の商』のルールを逆に覚えていると起きる。",
tip: "2と5、4と25のように『掛けると10の累乗になるペア』は共通テスト頻出。見た瞬間に反応できるようにする。"
}
},
{
id: "sh3-3",
stage: "第3問",
num: 3,
time: 30,
score: 5,
weakness: "方針切替",
route: ["真数条件"],
q: "log₂(x-1) が定義されるためのxの条件を求めよ。",
a: ["x>1", "x≥1", "x>0", "すべての実数"],
correct: 0,
tags: ["correct", "range_error", "condition_misread", "concept_gap"],
explain: {
why: "対数の真数は正でなければならない(真数条件)。x-1>0 より x>1。",
mistake: "等号を含めてx≥1としてしまう。x=1のとき真数は0になり、log₂0は定義されない。",
tip: "対数の方程式・不等式は『解く前にまず真数条件を書く』。最後に解と真数条件の共通部分をとるのを忘れずに。"
}
},
{
id: "sh3-4",
stage: "第3問",
num: 4,
time: 25,
score: 5,
weakness: "計算精度",
route: ["対数の定義"],
q: "2^x=5 を満たすxを対数で表せ。",
a: ["log₂5", "log₅2", "5/2", "√5"],
correct: 0,
tags: ["correct", "ratio_reverse", "concept_gap", "concept_gap"],
explain: {
why: "『2を何乗したら5になるか』がxなので、x=log₂5。",
mistake: "底と真数を逆にしてlog₅2としてしまう。指数の式 a^x=b と対数 x=log_a(b) の対応で、aとbの位置が入れ替わらないよう注意。",
tip: "a^x=b ⇔ x=log_a(b)。『底は下にいるやつ(a)がそのまま下に残る』と覚える。"
}
},

/* =========================
第4問(置き換えチェーン) 模試第2問のミニ再現
========================= */
{
id: "sh4-1",
stage: "第4問",
num: 1,
time: 50,
score: 5,
weakness: "方針切替",
route: ["置き換え(tの式)"],
group: "sh4-chain1",
groupIntro: "tを2以上の実数として t=2^x+2^(-x) とおき、xの方程式 4^x+4^(-x)-3(2^x+2^(-x))+4=0 …(*) を考える。",
q: "方程式(*)をtの方程式で表すと、どうなるか。",
a: ["t²-3t+2=0", "t²-3t+4=0", "-t+2=0", "t²+3t+2=0"],
correct: 0,
tags: ["correct", "formula_mismatch", "formula_mismatch", "sign_error"],
explain: {
why: "恒等式 4^x+4^(-x)=t²-2 を代入すると、(t²-2)-3t+4=0、整理して t²-3t+2=0。",
mistake: "4^x+4^(-x)=t²(-2を忘れる)としてt²-3t+4=0、または4^x+4^(-x)=2t-2と誤変換して-t+2=0としてしまう。この最初の変換を誤ると、以降の設問すべてが崩れる。",
tip: "大問の入口の変換こそ、1秒の検算(x=0を代入: 左辺=1+1-3×2+4=0、t=2で t²-3t+2=4-6+2=0、両方成立)を惜しまない。"
}
},
{
id: "sh4-2",
stage: "第4問",
num: 2,
time: 40,
score: 5,
weakness: "方針切替",
route: ["tの範囲の確認"],
group: "sh4-chain1",
groupIntro: "tを2以上の実数として t=2^x+2^(-x) とおき、xの方程式 4^x+4^(-x)-3(2^x+2^(-x))+4=0 …(*) を考える。",
recap: ["(1) 方程式(*)は t²-3t+2=0 と表せる"],
q: "t²-3t+2=0 を解き、条件を満たすtの値を求めよ。",
a: ["t=2", "t=1", "t=1とt=2の両方", "t=3"],
correct: 0,
tags: ["correct", "range_error", "condition_misread", "calc_error"],
explain: {
why: "(t-1)(t-2)=0 より t=1, 2。しかしtには『2以上』という条件があるので、t=1は捨てて t=2 のみが答え。",
mistake: "因数分解して出た2つの解をそのまま両方答えてしまう。置き換えた文字には範囲条件がついていることを忘れやすい。",
tip: "置き換えをしたら、解が出た瞬間に『tの範囲チェック』。t=2^x+2^(-x)なら常にt≥2(相加相乗)。"
}
},
{
id: "sh4-3",
stage: "第4問",
num: 3,
time: 45,
score: 5,
weakness: "計算精度",
route: ["置き換え(tの式)"],
group: "sh4-chain1",
groupIntro: "tを2以上の実数として t=2^x+2^(-x) とおき、xの方程式 4^x+4^(-x)-3(2^x+2^(-x))+4=0 …(*) を考える。",
recap: ["(1) 方程式(*)は t²-3t+2=0 と表せる", "(2) tの範囲(t≥2)より t=2"],
q: "2^x+2^(-x)=2 を満たすxを求めよ。",
a: ["x=0", "x=1", "解なし", "x=0とx=1の2つ"],
correct: 0,
tags: ["correct", "concept_gap", "concept_gap", "calc_error"],
explain: {
why: "u=2^xとおくと u+1/u=2、両辺u倍して u²-2u+1=0、(u-1)²=0 より u=1。2^x=1 となるのは x=0。",
mistake: "2^x+2^(-x)=2 の右辺の2を見て『2^x=2だからx=1』と部分的に処理してしまうことがある。左辺は2項の和であることに注意。",
tip: "t=2は相加相乗の等号成立の場合。等号成立条件『2^x=2^(-x)』すなわちx=0、と定石で処理する道もある。"
}
},
{
id: "sh4-4",
stage: "第4問",
num: 4,
time: 30,
score: 5,
weakness: "時間判断",
route: [],
group: "sh4-chain1",
groupIntro: "tを2以上の実数として t=2^x+2^(-x) とおき、xの方程式 4^x+4^(-x)-3(2^x+2^(-x))+4=0 …(*) を考える。",
recap: ["(1) 方程式(*)は t²-3t+2=0 と表せる", "(2) tの範囲(t≥2)より t=2", "(3) t=2のとき x=0"],
q: "方程式(*)の実数解の個数を答えよ。",
a: ["1個", "2個", "0個", "4個"],
correct: 0,
tags: ["correct", "range_error", "concept_gap", "calc_error"],
explain: {
why: "(2)(3)より、条件を満たすtはt=2の1つだけで、そのときxはx=0の1つだけ。よって実数解は1個。",
mistake: "tの解が2つ出たこと(t=1, 2)を根拠に『2個』と答えてしまう。tの個数とxの個数は別物。",
tip: "一般に、t=2^x+2^(-x)では『t>2なら1つのtにつきxは2個、t=2ならxは1個、t<2ならxは0個』。tからxへの対応個数を意識するのが解の個数問題のカギ。"
}
}

];
