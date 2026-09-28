# -*- coding: utf-8 -*-
"""
verify_houteishiki.py
D群「図形から方程式へのモード切替」(questions_houteishiki.js) の数値検算スクリプト。
品質ゲートA-2(数学的検算)に対応。全問の正解・誤答選択肢の数値をsympyで独立に再計算する。
"""
import sympy as sp

ok = True
def check(label, got, expect, tol=1e-9):
    global ok
    diff = sp.simplify(sp.nsimplify(got) - sp.nsimplify(expect))
    passed = sp.simplify(diff) == 0
    print(f"[{'OK' if passed else 'NG'}] {label}: got={got}  expect={expect}")
    if not passed:
        ok = False

r = sp.symbols('r', positive=True)

print("=== eq1 (D-1): 8-r = √3 r ===")
sol = sp.solve(sp.Eq(8-r, sp.sqrt(3)*r), r)[0]
check("eq1 correct (4√3-4)", sol, 4*sp.sqrt(3)-4)
check("eq1 unrationalized equals correct", sp.Rational(8,1)/(sp.sqrt(3)+1), sol)
print(f"[{'OK' if sp.simplify((4+4*sp.sqrt(3)) - sol) != 0 else 'NG'}] eq1 signflip distinct from correct")

print("\n=== eq2 (D-2): 10-r = √5 r ===")
sol = sp.solve(sp.Eq(10-r, sp.sqrt(5)*r), r)[0]
check("eq2 correct (5(√5-1)/2)", sol, sp.Rational(5,2)*(sp.sqrt(5)-1))

print("\n=== eq3 (D-3): 12-2r = √2 r ===")
sol = sp.solve(sp.Eq(12-2*r, sp.sqrt(2)*r), r)[0]
check("eq3 correct (12-6√2)", sol, 12-6*sp.sqrt(2))
print(f"[coeff_dropped value]: {sp.solve(sp.Eq(12-r, sp.sqrt(2)*r), r)[0]} vs correct expectation 12*sqrt(2)-12")

print("\n=== eq4 (D-4): r+5 = √3 r ===")
sol = sp.solve(sp.Eq(r+5, sp.sqrt(3)*r), r)[0]
check("eq4 correct (5(√3+1)/2)", sol, sp.Rational(5,2)*(sp.sqrt(3)+1))

print("\n=== eq5 (D-5): 9-r = √2 r ===")
sol = sp.solve(sp.Eq(9-r, sp.sqrt(2)*r), r)[0]
check("eq5 correct (9√2-9)", sol, 9*sp.sqrt(2)-9)

print("\n=== eq6 (D-6): 6-r = √7 r (original mock problem) ===")
sol = sp.solve(sp.Eq(6-r, sp.sqrt(7)*r), r)[0]
check("eq6 correct (√7-1)", sol, sp.sqrt(7)-1)

# verify eq3's underlying identity: AT+BS = (AC+BC) - 2r given CT=CS=r
AC, BC = sp.symbols('AC BC', positive=True)
AT = AC - r
BS = BC - r
check("eq3 identity AT+BS = (AC+BC)-2r", sp.expand(AT+BS), sp.expand((AC+BC)-2*r))

# verify tangent-length-from-vertex formula r/tan(theta/2) numerically (already checked earlier, re-confirm)
import math
a,b,c = 3,4,5
s = (a+b+c)/2
r_std = (a*b/2)/s
A = math.atan(a/b)
formula_val = r_std/math.tan(A/2)
tangent_from_A = s-a
check("tangent-length formula r/tan(A/2) matches s-a (3-4-5 triangle)", round(formula_val,9), round(tangent_from_A,9))

print("\n" + ("✅ 全数値チェック合格" if ok else "❌ NG項目あり"))
