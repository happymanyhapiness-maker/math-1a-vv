// questions_sankaku_2.js
// Part2（問題9〜16）
// 数Ⅱ 三角関数（後半）
//
// 問題データ形式は既存の questions_*.js に合わせて
// id / stage / num / time / score / weakness / route / q / a / correct / tags / explain を使用。

const questions_sankaku_2 = [

/* =========================
第3問（三角方程式・周期・グラフ）
========================= */
{
  id: "s3-1",
  stage: "第3問",
  num: 1,
  time: 40,
  score: 5,
  weakness: "方針切替",
  route: ["三角方程式", "単位円"],
  q: "$0\\le\\theta<2\\pi$ のとき、$\\sin\\theta=\\dfrac{1}{2}$ を満たす $\\theta$ を求めよ。",
  a: ["π/6, 5π/6", "π/6, 7π/6", "5π/6, 7π/6", "π/3, 2π/3"],
  correct: 0,
  tags: ["correct", "range_error", "range_error", "concept_gap"],
  explain: {
    aim: "$\\sin\\theta=\\dfrac{1}{2}$ の解を単位円から判断し、指定された範囲の中で2つの解を漏れなく求められるかを測る問題。",
    why: "$\\sin\\theta=\\dfrac{1}{2}$ なので基準角は $\\dfrac{\\pi}{6}$。sinが正になるのは第1象限と第2象限だから、$\\theta=\\dfrac{\\pi}{6},\\ \\dfrac{5\\pi}{6}$。",
    mistake: "第1象限の $\\dfrac{\\pi}{6}$ だけを書いてもう1つの解を落としたり、第2象限の角を $\\dfrac{7\\pi}{6}$ としてしまったりする。",
    tip: "sinは『y座標』。まず単位円で正になる象限を確認してから、基準角を配置する。"
  }
},
{
  id: "s3-2",
  stage: "第3問",
  num: 2,
  time: 35,
  score: 5,
  weakness: "計算精度",
  route: ["周期"],
  q: "$y=2\\sin\\left(x-\\dfrac{\\pi}{3}\\right)$ の周期はどれか。",
  a: ["2π", "π", "π/3", "6π"],
  correct: 0,
  tags: ["correct", "concept_gap", "condition_misread", "calc_error"],
  explain: {
    aim: "三角関数のグラフで、前後の平行移動と周期を混同せず判断できるかを測る問題。",
    why: "$y=a\\sin(bx+c)$ の周期は $\\dfrac{2\\pi}{|b|}$。この式では x の係数 b=1 なので周期は $2\\pi$。$x-\\dfrac{\\pi}{3}$ はグラフの横方向の移動を表すだけで、周期は変えない。",
    mistake: "$\\dfrac{\\pi}{3}$ をそのまま周期だと思ったり、係数2を見て周期を $\\pi$ としてしまったりする。",
    tip: "『外の2は振幅』『中のxの係数が周期』『+や-の定数は横移動』と役割を分けて見る。"
  }
},
{
  id: "s3-3",
  stage: "第3問",
  num: 3,
  time: 45,
  score: 5,
  weakness: "方針切替",
  route: ["グラフ", "最大最小"],
  q: "$0\\le x\\le2\\pi$ における $y=2\\sin x-1$ の最大値を求めよ。",
  a: ["1", "2", "-1", "3"],
  correct: 0,
  tags: ["correct", "calc_error", "near_miss", "calc_error"],
  explain: {
    aim: "sinの値の範囲から、三角関数の最大値をすばやく判断できるかを測る問題。",
    why: "$-1\\le\\sin x\\le1$ なので、$2\\sin x$ の最大値は2。したがって $2\\sin x-1$ の最大値は $2-1=1$。$x=\\dfrac{\\pi}{2}$ で実現する。",
    mistake: "sin x の最大値1だけを答えてしまったり、外側の2を足してしまったりする。",
    tip: "まず $\\sin x$ の範囲 $[-1,1]$ を書いて、係数を掛けてから定数を足し引きする。"
  }
},
{
  id: "s3-4",
  stage: "第3問",
  num: 4,
  time: 50,
  score: 5,
  weakness: "方針切替",
  route: ["三角方程式", "単位円"],
  q: "$0\\le\\theta<2\\pi$ のとき、$2\\cos\\theta-1=0$ を満たす $\\theta$ を求めよ。",
  a: ["π/3, 5π/3", "π/6, 11π/6", "2π/3, 4π/3", "π/3, 4π/3"],
  correct: 0,
  tags: ["correct", "calc_error", "range_error", "concept_gap"],
  explain: {
    aim: "三角方程式をまず基本形に直し、cosの符号から2つの解を判断できるかを測る問題。",
    why: "$2\\cos\\theta-1=0$ より $\\cos\\theta=\\dfrac{1}{2}$。基準角は $\\dfrac{\\pi}{3}$。cosが正なのは第1象限と第4象限なので、$\\theta=\\dfrac{\\pi}{3},\\ \\dfrac{5\\pi}{3}$。",
    mistake: "$2\\cos\\theta=1$ から $\\cos\\theta=1$ としてしまったり、第2・第3象限に解を置いてしまったりする。",
    tip: "三角方程式は①基本形にする、②基準角、③符号で象限、の3手順を固定する。"
  }
},
{
  id: "s3-5",
  stage: "第3問",
  num: 5,
  time: 55,
  score: 5,
  weakness: "方針切替",
  route: ["三角関数と二次方程式"],
  q: "$0\\le\\theta<2\\pi$ のとき、$2\\sin^2\\theta-\\sin\\theta-1=0$ を満たす $\\theta$ をすべて求めよ。",
  a: ["π/2, 7π/6, 11π/6", "π/2, π/6, 5π/6", "π/6, 5π/6", "π/2, 7π/6"],
  correct: 0,
  tags: ["correct", "sign_error", "range_error", "range_error"],
  explain: {
    aim: "$\\sin\\theta$を1つの文字とみて二次方程式を解き、出てきた2つの解それぞれについて$\\theta$を漏れなく求められるかを測る問題。",
    why: "$\\sin\\theta=x$とおくと $2x^{2}-x-1=0$、$(2x+1)(x-1)=0$ より $x=1, -\\dfrac{1}{2}$。$\\sin\\theta=1$ のとき $\\theta=\\dfrac{\\pi}{2}$。$\\sin\\theta=-\\dfrac{1}{2}$ のとき、基準角$\\dfrac{\\pi}{6}$でsinが負の第3・第4象限だから $\\theta=\\pi+\\dfrac{\\pi}{6}=\\dfrac{7\\pi}{6}$、$\\theta=2\\pi-\\dfrac{\\pi}{6}=\\dfrac{11\\pi}{6}$。合わせて$\\dfrac{\\pi}{2}, \\dfrac{7\\pi}{6}, \\dfrac{11\\pi}{6}$の3つ。",
    mistake: "$\\sin\\theta=-\\dfrac{1}{2}$の符号を見落として$\\sin\\theta=\\dfrac{1}{2}$の場合(第1・第2象限、$\\dfrac{\\pi}{6}, \\dfrac{5\\pi}{6}$)を答えてしまう。または2つの解のうち片方(例えば$\\sin\\theta=1$)を忘れて答えを1組しか出さないこともある。",
    tip: "三角『方程式』に二次式が混ざったら、まず$\\sin\\theta$(または$\\cos\\theta$)を1文字に置き換えて因数分解する。出てきた解の数だけ、それぞれ単位円で$\\theta$を求め直す作業が必要になる。"
  }
},

/* =========================
第4問（微積への橋渡し：式変形）
========================= */
{
  id: "s4-1",
  stage: "第4問",
  num: 1,
  time: 40,
  score: 5,
  weakness: "方針切替",
  route: ["半角公式"],
  q: "$\\sin^2x$ を、$\\cos2x$ を使って表したものはどれか。",
  a: ["(1-cos2x)/2", "(1+cos2x)/2", "1-cos2x", "2-cos2x"],
  correct: 0,
  tags: ["correct", "sign_error", "calc_error", "formula_mismatch"],
  explain: {
    aim: "積分前に必要になる半角公式を、sin²の変形に正しく利用できるかを測る問題。",
    why: "倍角公式 $\\cos2x=1-2\\sin^2x$ を変形すると、$2\\sin^2x=1-\\cos2x$。したがって $\\sin^2x=(1-\\cos2x)/2$。",
    mistake: "$\\cos^2x=(1+\\cos2x)/2$ と混同して、sin²でもプラスにしてしまう。また、2で割るのを忘れることがある。",
    tip: "sin²は『1−cos2x』、cos²は『1＋cos2x』とセットで覚える。積分ではこの変形がそのまま入口になる。"
  }
},
{
  id: "s4-2",
  stage: "第4問",
  num: 2,
  time: 40,
  score: 5,
  weakness: "方針切替",
  route: ["半角公式"],
  q: "$\\cos^2x$ を、$\\cos2x$ を使って表したものはどれか。",
  a: ["(1+cos2x)/2", "(1-cos2x)/2", "1-cos2x", "2cos2x"],
  correct: 0,
  tags: ["correct", "sign_error", "calc_error", "formula_mismatch"],
  explain: {
    aim: "sin²とcos²の半角公式を区別して使えるかを測る問題。",
    why: "倍角公式 $\\cos2x=2\\cos^2x-1$ を変形すると、$2\\cos^2x=1+\\cos2x$。よって $\\cos^2x=(1+\\cos2x)/2$。",
    mistake: "sin²の公式と混同してマイナスにしてしまう。また、分母の2を落としてしまうことがある。",
    tip: "『cos²は＋、sin²は−』をまず確認。積分前の変形では符号ミスが特に致命的なので、元の値が正になるか簡単な角で検算してもよい。"
  }
},
{
  id: "s4-3",
  stage: "第4問",
  num: 3,
  time: 45,
  score: 5,
  weakness: "方針切替",
  route: ["倍角公式"],
  q: "$2\\sin x\\cos x$ を積分しやすい形に変形するとどれか。",
  a: ["sin2x", "cos2x", "(1/2)sin2x", "2sin2x"],
  correct: 0,
  tags: ["correct", "formula_mismatch", "calc_error", "calc_error"],
  explain: {
    aim: "積分で頻出する積の形を、倍角公式によって1つの三角関数に変形できるかを測る問題。",
    why: "倍角公式 $\\sin2x=2\\sin x\\cos x$ そのものなので、$2\\sin x\\cos x=\\sin2x$。",
    mistake: "$\\sin2x=\\sin x\\cos x$ と係数2を落としたり、逆に $2\\sin2x$ としてしまったりする。",
    tip: "『sinの倍角は2sin×cos』を一塊で覚える。積分では、まず積の形を見たら $\\sin2x$ を疑う。"
  }
},
{
  id: "s4-4",
  stage: "第4問",
  num: 4,
  time: 55,
  score: 5,
  weakness: "方針切替",
  route: ["倍角公式", "半角公式"],
  q: "$\\sin^2x+\\cos^2x$ を利用して、$\\sin^2x$ を $\\cos2x$ だけを含む式に変形した。正しいものはどれか。",
  a: ["(1-cos2x)/2", "(1+cos2x)/2", "1-cos2x", "1/2-cos2x"],
  correct: 0,
  tags: ["correct", "sign_error", "calc_error", "formula_mismatch"],
  explain: {
    aim: "相互関係から倍角・半角公式につなげ、積分前の標準的な式変形を自力で選べるかを測る問題。",
    why: "$\\sin^2x+\\cos^2x=1$ と $\\cos2x=\\cos^2x-\\sin^2x$ を組み合わせると、$\\cos2x=1-2\\sin^2x$。したがって $\\sin^2x=(1-\\cos2x)/2$。",
    mistake: "$\\cos^2x$ の公式と混同してプラスにする、または $1-\\cos2x$ のまま2で割るのを忘れる。",
    tip: "この変形は『三角関数→積分』の橋。$\\sin^2x$ や $\\cos^2x$ が出たら、そのままではなく半角公式への変形を考える。"
  }
},
{
  id: "s4-5",
  stage: "第4問",
  num: 5,
  time: 50,
  score: 5,
  weakness: "共通点抽出",
  route: ["半角公式", "定積分"],
  q: "$\\displaystyle\\int_{0}^{\\pi}\\sin^2x\\,dx$ を、半角公式を使って計算せよ。",
  a: ["π/2", "π", "π/4", "0"],
  correct: 0,
  tags: ["correct", "calc_error", "calc_error", "concept_gap"],
  explain: {
    aim: "これまで学んだ半角公式による式変形($\\sin^2x=\\dfrac{1-\\cos2x}{2}$)を、実際に定積分の計算まで通しで使えるかを測る、単元のまとめとなる問題。",
    why: "$\\displaystyle\\int_{0}^{\\pi}\\sin^2x\\,dx=\\int_{0}^{\\pi}\\dfrac{1-\\cos2x}{2}\\,dx=\\left[\\dfrac{x}{2}-\\dfrac{\\sin2x}{4}\\right]_{0}^{\\pi}=\\left(\\dfrac{\\pi}{2}-0\\right)-\\left(0-0\\right)=\\dfrac{\\pi}{2}$。",
    mistake: "$\\cos2x$の項は1周期分積分すると0になるため、定数項$\\dfrac{1}{2}$の積分($\\dfrac{x}{2}$の部分)まで丸ごと忘れて0と答えてしまうことがある。または係数$\\dfrac{1}{2}$を掛け忘れて$\\pi$と答えることもある。",
    tip: "半角公式で変形すると『定数項の積分』と『$\\cos2x$の項の積分』の2つに分かれる。$\\cos2x$側が0になっても、定数項は必ず生き残るので消さないこと。"
  }
}

];
