# -*- coding: utf-8 -*-
"""
verify_zettaichi.py
ミニ単元「絶対値の積分(特訓)」(questions_zettaichi.js 全15問) の数値検算スクリプト。
品質ゲートA-2(数学的検算)に対応。

正解の値だけでなく、explain.mistake に「〜し忘れた場合の値」と書いた誤答選択肢についても、
実際にその誤った手順をコードで再現し、選択肢の数値と一致することまで確認する。

実行: python3 verify_zettaichi.py
"""
import sympy as sp

x, a = sp.symbols('x a')
ok = True


def check(label, got, expect):
    global ok
    passed = sp.simplify(sp.nsimplify(got) - sp.nsimplify(expect)) == 0
    print(f"[{'OK' if passed else 'NG'}] {label}: got={sp.nsimplify(got)}  expect={sp.nsimplify(expect)}")
    if not passed:
        ok = False


print("=== 第1問(土台) ===")
check("za1-2 x-2 の根", sp.solve(sp.Eq(x - 2, 0), x)[0], 2)
roots = sorted(sp.solve(sp.Eq(x**2 - 4, 0), x))
check("za1-3 x^2-4 の根の個数", len(roots), 2)
check("za1-3 根1", roots[0], -2)
check("za1-3 根2", roots[1], 2)
whole = sp.integrate(x + 1, (x, 0, 3))
split = sp.integrate(x + 1, (x, 0, 2)) + sp.integrate(x + 1, (x, 2, 3))
check("za1-4 correct (15/2)", split, sp.Rational(15, 2))
check("za1-4 分割しても値は同じ(区間加法性)", split, whole)
check("za1-4 誤答 前半足し忘れ (7/2)", sp.integrate(x + 1, (x, 2, 3)), sp.Rational(7, 2))
check("za1-4 誤答 引き算にした (1/2)",
      sp.integrate(x + 1, (x, 0, 2)) - sp.integrate(x + 1, (x, 2, 3)), sp.Rational(1, 2))

print("\n=== 第2問(分割の判断) ===")
sols = sorted(sp.solve(sp.Eq(x**2, x + 2), x))
check("za2-1 交点 個数", len(sols), 2)
check("za2-1 交点1 (-1)", sols[0], -1)
check("za2-1 交点2 (2)", sols[1], 2)
# za2-3: ∫[-2,3]|x^2-1|dx の分割点は -1 と 1 の2つ（どちらも区間の内部）
r = sorted(sp.solve(sp.Eq(x**2 - 1, 0), x))
inside = [v for v in r if -2 < v < 3]
check("za2-3 区間内部の分割点の個数", len(inside), 2)
check("za2-3 分割点1", inside[0], -1)
check("za2-3 分割点2", inside[1], 1)
# za2-4: ∫[0,1]|x^2-4|dx は根 ±2 が区間外なので分割不要、区間内では中身が負
r4 = sp.solve(sp.Eq(x**2 - 4, 0), x)
inside4 = [v for v in r4 if 0 < v < 1]
check("za2-4 区間[0,1]内部の根の個数(=0なら分割不要)", len(inside4), 0)
print(f"[{'OK' if (0**2 - 4) < 0 and (1**2 - 4) < 0 else 'NG'}] za2-4 区間の両端で中身が負(=|x^2-4|=4-x^2)")

print("\n=== 第3問(計算実行) ===")
check("za3-1 correct (5/2)",
      sp.integrate(2 - x, (x, 0, 2)) + sp.integrate(x - 2, (x, 2, 3)), sp.Rational(5, 2))
check("za3-1 誤答 絶対値外し忘れ (-3/2)", sp.integrate(x - 2, (x, 0, 3)), sp.Rational(-3, 2))
check("za3-1 誤答 分割点ズレ (9/4)",
      sp.integrate(2 - x, (x, 0, sp.Rational(3, 2)))
      + sp.integrate(x - 2, (x, sp.Rational(3, 2), 3)), sp.Rational(9, 4))
check("za3-1 誤答 後半の符号反転忘れ (3/2)",
      sp.integrate(2 - x, (x, 0, 2)) + sp.integrate(2 - x, (x, 2, 3)), sp.Rational(3, 2))

check("za3-2 correct (23/3)",
      sp.integrate(4 - x**2, (x, 0, 2)) + sp.integrate(x**2 - 4, (x, 2, 3)), sp.Rational(23, 3))
check("za3-2 誤答 前半[0,2]だけで止めた (16/3)", sp.integrate(4 - x**2, (x, 0, 2)), sp.Rational(16, 3))
check("za3-2 誤答 後半[2,3]だけ計算した (7/3)", sp.integrate(x**2 - 4, (x, 2, 3)), sp.Rational(7, 3))
check("za3-2 誤答 分割点をx=1と誤認 (13/3)",
      sp.integrate(4 - x**2, (x, 0, 1)) + sp.integrate(x**2 - 4, (x, 1, 3)), sp.Rational(13, 3))

check("za3-3 correct (29/6)",
      sp.integrate(x - x**2, (x, 0, 1)) + sp.integrate(x**2 - x, (x, 1, 3)), sp.Rational(29, 6))
check("za3-3 誤答 絶対値外し忘れ (9/2)", sp.integrate(x**2 - x, (x, 0, 3)), sp.Rational(9, 2))
check("za3-3 誤答 [0,1]を足し忘れ (14/3)", sp.integrate(x**2 - x, (x, 1, 3)), sp.Rational(14, 3))
check("za3-3 誤答 両区間とも符号誤り (-9/2)",
      sp.integrate(x - x**2, (x, 0, 1)) + sp.integrate(x - x**2, (x, 1, 3)), sp.Rational(-9, 2))

f = x**2 - 3*x + 2
check("za3-4 根1", sorted(sp.solve(f, x))[0], 1)
check("za3-4 根2", sorted(sp.solve(f, x))[1], 2)
check("za3-4 correct 3区間 (17/3)",
      sp.integrate(f, (x, 0, 1)) + sp.integrate(-f, (x, 1, 2)) + sp.integrate(f, (x, 2, 4)),
      sp.Rational(17, 3))
check("za3-4 誤答 分割なし (16/3)", sp.integrate(f, (x, 0, 4)), sp.Rational(16, 3))
check("za3-4 誤答 根x=2を見落とし (-11/3)",
      sp.integrate(f, (x, 0, 1)) + sp.integrate(-f, (x, 1, 4)), sp.Rational(-11, 3))
check("za3-4 誤答 根x=1を見落とし (12/3)",
      sp.integrate(-f, (x, 0, 2)) + sp.integrate(f, (x, 2, 4)), sp.Rational(12, 3))

print("\n=== 第4問(応用) ===")
inter = sorted(sp.solve(sp.Eq(x**2, 2*x), x))
check("za4-1 交点1 (0)", inter[0], 0)
check("za4-1 交点2 (2)", inter[1], 2)
check("za4-1 correct 面積 (4/3)", sp.integrate(2*x - x**2, (x, 0, 2)), sp.Rational(4, 3))
check("za4-1 誤答 上下逆 (-4/3)", sp.integrate(x**2 - 2*x, (x, 0, 2)), sp.Rational(-4, 3))
check("za4-1 誤答 交点をx=1と取り違え (2/3)", sp.integrate(2*x - x**2, (x, 0, 1)), sp.Rational(2, 3))
check("za4-1 誤答 x=3まで伸ばし超過分も面積として足す (8/3)",
      sp.integrate(2*x - x**2, (x, 0, 2)) + sp.integrate(x**2 - 2*x, (x, 2, 3)),
      sp.Rational(8, 3))
# 解説の注記：素の積分は正負が打ち消し合って0になる（8/3ではない）
check("za4-1 参考 ∫[0,3](2x-x^2)dx は 0", sp.integrate(2*x - x**2, (x, 0, 3)), 0)

expr = sp.integrate(a - x, (x, 0, a)) + sp.integrate(x - a, (x, a, 2))
check("za4-2 correct (a^2-2a+2)", sp.expand(expr), a**2 - 2*a + 2)
check("za4-2 検算 a=1 のとき 1", expr.subs(a, 1), 1)
check("za4-2 検算 a=1 を直接積分しても 1",
      sp.integrate(sp.Abs(x - 1), (x, 0, 2)), 1)
check("za4-2 誤答 絶対値外し忘れ (2-2a)", sp.expand(sp.integrate(x - a, (x, 0, 2))), 2 - 2*a)
check("za4-2 誤答 後半も(a-x)のまま (2a-2)",
      sp.expand(sp.integrate(a - x, (x, 0, a)) + sp.integrate(a - x, (x, a, 2))), 2*a - 2)

# za4-3: |∫f| と ∫|f| が一致しないことを、za3-4 の題材で示す（解説で使っている根拠）
lhs = sp.Abs(sp.integrate(f, (x, 0, 4)))
rhs = sp.integrate(sp.Abs(f), (x, 0, 4))
check("za4-3 |∫f| = 16/3", lhs, sp.Rational(16, 3))
check("za4-3 ∫|f| = 17/3", rhs, sp.Rational(17, 3))
print(f"[{'OK' if sp.simplify(lhs - rhs) != 0 else 'NG'}] za4-3 両者は一致しない(解説の主張が成立)")

print("\n=== 選択肢の表記が問題内で揃っているか ===")
CHOICE_SETS = {
    "za1-4": ["15/2", "7/2", "1/2", "21/2"],
    "za3-1": ["-3/2", "9/4", "3/2", "5/2"],
    "za3-2": ["23/3", "16/3", "7/3", "13/3"],
    "za3-3": ["9/2", "14/3", "29/6", "-9/2"],
    "za3-4": ["16/3", "17/3", "-11/3", "12/3"],
    "za4-1": ["-4/3", "8/3", "2/3", "4/3"],
}
for qid, choices in CHOICE_SETS.items():
    kinds = {"分数" if "/" in c else "整数" for c in choices}
    passed = len(kinds) == 1
    print(f"[{'OK' if passed else 'NG'}] {qid}: {choices} → {kinds}")
    if not passed:
        ok = False

print(f"\n{'✅ 全項目合格' if ok else '❌ NG項目あり'}")
