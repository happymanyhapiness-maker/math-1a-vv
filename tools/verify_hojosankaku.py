# -*- coding: utf-8 -*-
"""
verify_hojosankaku.py
図形ユニット「補助三角形の発見」(questions_hojosankaku.js) の数値検算スクリプト。
品質ゲートA-2(数学的検算)に対応。全問の正解・誤答選択肢の数値をsympyで独立に再計算する。

実行: python3 verify_hojosankaku.py
"""
import sympy as sp
import math

ok = True
def check(label, got, expect, tol=1e-9):
    global ok
    diff = sp.simplify(got - expect)
    passed = sp.Abs(diff) < tol if diff.is_number else sp.simplify(diff) == 0
    print(f"[{'OK' if passed else 'NG'}] {label}: got={got}  expect={expect}")
    if not passed:
        ok = False

r = sp.symbols('r', positive=True)

print("=== A-1 (ho1-1): 外接する2円(4r, r)の共通接線 ===")
R1, R2 = 4*r, r
d = R1 + R2
L = sp.sqrt(d**2 - (R1-R2)**2)
check("A-1 tangent length", sp.simplify(L), 4*r)

print("\n=== B-1 (ho2-1): 外接する2円(9,1)の共通接線 ===")
R1b, R2b = sp.Integer(9), sp.Integer(1)
db = R1b + R2b
Lb = sp.sqrt(db**2 - (R1b-R2b)**2)
check("B-1 correct(6)", Lb, 6)
check("B-1 distractor: naive d-(R-r)", db-(R1b-R2b), 2)
check("B-1 distractor: leg itself", R1b-R2b, 8)

print("\n=== A-2 (ho1-2) / C-1 (ho3-1): 直方体の空間対角線 ===")
def box(a,b,c):
    ac = sp.sqrt(a**2+b**2)
    ag = sp.sqrt(ac**2+c**2)
    return ac, ag
ac1, ag1 = box(3,4,12)
check("A-2 base diagonal AC", ac1, 5)
check("A-2 space diagonal AG", ag1, 13)
ac2, ag2 = box(6,8,24)
check("C-1 base diagonal AC", ac2, 10)
check("C-1 correct AG(26)", ag2, 26)
check("C-1 distractor: stopped at AC", ac2, 10)
check("C-1 distractor: naive add AC+CG", ac2+24, 34)
check("C-1 distractor: wrong leg pair sqrt(BC^2+CG^2)", sp.sqrt(8**2+24**2), 8*sp.sqrt(10))

print("\n=== A-3 (ho1-3): 円錐の母線 ===")
check("A-3 slant", sp.sqrt(5**2+12**2), 13)

print("\n=== A-4 (ho1-4): 円の弦 ===")
check("A-4 half-chord", sp.sqrt(10**2-6**2), 8)
check("A-4 chord", 2*sp.sqrt(10**2-6**2), 16)

print("\n=== B-2 (ho2-2): 3-4-5三角形の内接円、AI ===")
rin = sp.Rational(3+4-5,2)
check("B-2 inradius", rin, 1)
AE = sp.Rational(3+4+5,2) - 3  # s - BC(opposite A)
check("B-2 AE(tangent len from A)", AE, 3)
AI = sp.sqrt(AE**2+rin**2)
check("B-2 correct AI = sqrt(10)", AI, sp.sqrt(10))
check("B-2 distractor: uses CA=4 instead of AE=3", sp.sqrt(4**2+1**2), sp.sqrt(17))
check("B-2 distractor: naive add AE+r", AE+rin, 4)

print("\n=== C-2 (ho3-2): 6-8-10三角形の内接円、BI ===")
rin2 = sp.Rational(6+8-10,2)
check("C-2 inradius", rin2, 2)
BD = sp.Rational(6+8+10,2) - 8  # s - CA(opposite B)
check("C-2 BD(tangent len from B)", BD, 4)
BI = sp.sqrt(BD**2+rin2**2)
check("C-2 correct BI = 2sqrt(5)", BI, 2*sp.sqrt(5))
check("C-2 distractor: naive add BD+r", BD+rin2, 6)
check("C-2 distractor: swapped side (uses BC=6 for BD calc)", sp.sqrt((sp.Rational(6+8+10,2)-6)**2+rin2**2), 2*sp.sqrt(10))

print("\n=== B-3 (ho2-3): 交わる2円(13,15,d=14)の共通弦 ===")
x = sp.symbols('x', positive=True)
sol = sp.solve(sp.Eq(13**2-x**2, 15**2-(14-x)**2), x)
xval = sol[0]
check("B-3 foot distance x", xval, 5)
half = sp.sqrt(13**2-xval**2)
check("B-3 half-chord", half, 12)
check("B-3 correct chord(24)", 2*half, 24)
check("B-3 distractor: forgot to double", half, 12)
check("B-3 distractor: naive sum", sp.Integer(13+15-14), 14)
check("B-3 distractor: wrong radius pairing", sp.sqrt(15**2-xval**2), 10*sp.sqrt(2))

print("\n=== C-3 (ho3-3): 角の二等分線 + 補助三角形AP'P'' (radii r, r/3) ===")
k = sp.Integer(3)
Rbig, Rsmall = r, r/k
PQ = Rbig+Rsmall
PH = Rbig-Rsmall
PpQp = sp.simplify(sp.sqrt(PQ**2-PH**2))
check("C-3 P'Q'", PpQp, sp.Rational(2,3)*sp.sqrt(3)*r)
AQp = sp.symbols('AQp', positive=True)
sol2 = sp.solve(sp.Eq(k*AQp, AQp+PpQp), AQp)[0]
APp = sp.simplify(k*sol2)
check("C-3 AP'", APp, sp.sqrt(3)*r)
PPpp = Rbig
correct = sp.simplify(sp.sqrt(APp**2-PPpp**2))
check("C-3 correct AP''", correct, sp.sqrt(2)*r)
check("C-3 distractor: uses P'Q' instead of AP'", sp.simplify(sp.sqrt(PpQp**2-PPpp**2)), sp.sqrt(3)*r/3)
check("C-3 distractor: + instead of -", sp.simplify(sp.sqrt(APp**2+PPpp**2)), 2*r)
check("C-3 distractor: naive subtract (no Pythagorean)", sp.simplify(APp-PPpp), (sp.sqrt(3)-1)*r)

# coordinate cross-check (numeric, confirms right angle at P'' and all distances)
rv = 3.0
alpha = math.asin(1/math.sqrt(3))
A = (70.0, 230.0)
AP_num = math.sqrt(3)*rv*13.333  # arbitrary px scale just for right-angle check, use r_px directly instead:
r_px = 40.0
AP_num = math.sqrt(3)*r_px
AQ_num = (math.sqrt(3)/3)*r_px
Pp = (A[0]+AP_num*math.cos(alpha), A[1]-AP_num*math.sin(alpha))
Ppp = (Pp[0], A[1])
v1 = (A[0]-Ppp[0], A[1]-Ppp[1])
v2 = (Pp[0]-Ppp[0], Pp[1]-Ppp[1])
dot = v1[0]*v2[0]+v1[1]*v2[1]
print(f"\n[{'OK' if abs(dot) < 1e-6 else 'NG'}] C-3 coordinate right-angle check at P'': dot={dot:.2e} (expect ~0)")
dist_check = abs(math.hypot(A[0]-Ppp[0], A[1]-Ppp[1]) - math.sqrt(2)*r_px) < 1e-6
print(f"[{'OK' if dist_check else 'NG'}] C-3 coordinate AP'' distance matches sqrt(2)*r_px")

print("\n" + ("✅ 全数値チェック合格" if ok else "❌ NG項目あり"))
