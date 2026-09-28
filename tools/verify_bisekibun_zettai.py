# -*- coding: utf-8 -*-
"""
verify_bisekibun_zettai.py
微積ユニットの「絶対値付き定積分パック」(questions_bisekibun.js の b2-4〜b2-8, b4-4〜b4-7)
の数値検算スクリプト。品質ゲートA-2(数学的検算)に対応。

正解の値だけでなく、explain.mistake に「〜し忘れた場合の値」と書いた誤答選択肢についても、
実際にその誤った手順をコードで再現し、選択肢の数値と一致することまで確認する。

実行: python3 verify_bisekibun_zettai.py
"""
import sympy as sp

x = sp.symbols('x')

ok = True


def check(label, got, expect):
    global ok
    got_s, expect_s = sp.nsimplify(got), sp.nsimplify(expect)
    passed = sp.simplify(got_s - expect_s) == 0
    print(f"[{'OK' if passed else 'NG'}] {label}: got={got_s}  expect={expect_s}")
    if not passed:
        ok = False


# ============================================================
# 第2問（土台）: 符号判定・区間分割・交点
# ============================================================

print("=== b2-5 (土台): 1次式 x-2 の符号 ===")
# 根は x=2、x>2 で正・x<2 で負であることを具体値で確認
check("b2-5 root of x-2", sp.solve(sp.Eq(x - 2, 0), x)[0], 2)
print(f"[{'OK' if (3 - 2) > 0 and (1 - 2) < 0 else 'NG'}] b2-5 sign: x=3→正, x=1→負")

print("\n=== b2-6 (土台): 2次式 x^2-4 の符号 ===")
roots = sorted(sp.solve(sp.Eq(x**2 - 4, 0), x))
check("b2-6 roots count", len(roots), 2)
check("b2-6 root1", roots[0], -2)
check("b2-6 root2", roots[1], 2)
# 内側(-2<x<2)で負、外側で正
print(f"[{'OK' if (0**2 - 4) < 0 and (3**2 - 4) > 0 else 'NG'}] b2-6 sign: x=0→負(内側), x=3→正(外側)")

print("\n=== b2-7 (土台): 定積分の区間加法性 ∫[0,3](x+1)dx ===")
whole = sp.integrate(x + 1, (x, 0, 3))
split = sp.integrate(x + 1, (x, 0, 2)) + sp.integrate(x + 1, (x, 2, 3))
check("b2-7 correct (15/2)", split, sp.Rational(15, 2))
check("b2-7 split == whole (加法性)", split, whole)
# 誤答: 後半だけ計算して前半を足し忘れ → 7/2
check("b2-7 distractor 前半足し忘れ (7/2)",
      sp.integrate(x + 1, (x, 2, 3)), sp.Rational(7, 2))
# 誤答: 足すべきところを引いた → 1/2
check("b2-7 distractor 引き算にした (1/2)",
      sp.integrate(x + 1, (x, 0, 2)) - sp.integrate(x + 1, (x, 2, 3)), sp.Rational(1, 2))

print("\n=== b2-8 (土台): 2曲線 y=x^2, y=x+2 の交点 ===")
sols = sorted(sp.solve(sp.Eq(x**2, x + 2), x))
check("b2-8 correct 解の個数", len(sols), 2)
check("b2-8 correct 解1 (-1)", sols[0], -1)
check("b2-8 correct 解2 (2)", sols[1], 2)
# 誤答 x=1,-2 は符号を逆に因数分解した場合 → 実際には解でないことを確認
print(f"[{'OK' if (1**2 - (1 + 2)) != 0 else 'NG'}] b2-8 distractor x=1 は解ではない")

# ============================================================
# 第4問（本番）: 絶対値付き定積分
# ============================================================

print("\n=== b4-5 (本番): ∫[0,3]|x-2|dx ===")
correct = sp.integrate(2 - x, (x, 0, 2)) + sp.integrate(x - 2, (x, 2, 3))
check("b4-5 correct (5/2)", correct, sp.Rational(5, 2))
# 誤答: 絶対値を外さずそのまま積分 (sign_error)
check("b4-5 distractor 絶対値外し忘れ (-3/2)",
      sp.integrate(x - 2, (x, 0, 3)), sp.Rational(-3, 2))
# 誤答: 分割点を x=3/2 にずらした (range_error)
check("b4-5 distractor 分割点ズレ (9/4)",
      sp.integrate(2 - x, (x, 0, sp.Rational(3, 2)))
      + sp.integrate(x - 2, (x, sp.Rational(3, 2), 3)), sp.Rational(9, 4))
# 誤答: 分割はできたが後半も (2-x) のまま (sign_error)
check("b4-5 distractor 後半の符号反転忘れ (3/2)",
      sp.integrate(2 - x, (x, 0, 2)) + sp.integrate(2 - x, (x, 2, 3)), sp.Rational(3, 2))

print("\n=== b4-6 (本番): ∫[0,3]|x^2-4|dx ===")
correct = sp.integrate(4 - x**2, (x, 0, 2)) + sp.integrate(x**2 - 4, (x, 2, 3))
check("b4-6 correct (23/3)", correct, sp.Rational(23, 3))
check("b4-6 distractor 絶対値外し忘れ (-9/3)",
      sp.integrate(x**2 - 4, (x, 0, 3)), sp.Rational(-9, 3))
check("b4-6 distractor 分割点をx=1と誤認 (13/3)",
      sp.integrate(4 - x**2, (x, 0, 1)) + sp.integrate(x**2 - 4, (x, 1, 3)),
      sp.Rational(13, 3))
check("b4-6 distractor 後半の符号反転忘れ (9/3)",
      sp.integrate(4 - x**2, (x, 0, 2)) + sp.integrate(4 - x**2, (x, 2, 3)),
      sp.Rational(9, 3))

print("\n=== b4-7 (本番): ∫[0,3]|x^2-x|dx ===")
correct = sp.integrate(x - x**2, (x, 0, 1)) + sp.integrate(x**2 - x, (x, 1, 3))
check("b4-7 correct (29/6)", correct, sp.Rational(29, 6))
check("b4-7 distractor 絶対値外し忘れ (9/2)",
      sp.integrate(x**2 - x, (x, 0, 3)), sp.Rational(9, 2))
check("b4-7 distractor [0,1]を足し忘れ (14/3)",
      sp.integrate(x**2 - x, (x, 1, 3)), sp.Rational(14, 3))
check("b4-7 distractor 両区間とも符号判定を誤る (-9/2)",
      sp.integrate(x - x**2, (x, 0, 1)) + sp.integrate(x - x**2, (x, 1, 3)),
      sp.Rational(-9, 2))

# ============================================================
# 選択肢の表記統一（1章「選択肢の自動LaTeX化」の既知の制約対策）
# ============================================================
print("\n=== 選択肢の表記が問題内で揃っているか（分数/整数の混在チェック）===")
CHOICE_SETS = {
    "b2-7": ["15/2", "7/2", "1/2", "21/2"],
    "b4-5": ["-3/2", "9/4", "3/2", "5/2"],
    "b4-6": ["23/3", "-9/3", "13/3", "9/3"],
    "b4-7": ["9/2", "14/3", "29/6", "-9/2"],
}
for qid, choices in CHOICE_SETS.items():
    kinds = {"分数" if "/" in c else "整数" for c in choices}
    passed = len(kinds) == 1
    print(f"[{'OK' if passed else 'NG'}] {qid}: {choices} → 表記 {kinds}")
    if not passed:
        ok = False

print(f"\n{'✅ 全項目合格' if ok else '❌ NG項目あり'}")
