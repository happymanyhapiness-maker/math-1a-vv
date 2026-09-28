# -*- coding: utf-8 -*-
"""
verify_choice_notation.py
既存13ユニットで「LaTeX/Unicode混在」を解消するために書き換えた選択肢文字列について、
書き換え前後で数値・数式的な意味が変わっていないことを2通りの方法で独立検証する。

方法1(normalize): 今回加えた装飾(空白挿入・括弧追加・×挿入)だけを機械的に取り除けば
                   書き換え前の文字列と完全に一致することを確認する(表記だけを変えた証明)。
方法2(sympy):      √・×・π・上付き文字などをsympyの式に変換し、書き換え前後の式が
                   (自由変数を含む場合は式として、含まない場合は数値として)一致することを確認する。
"""
import re
import sympy as sp

# (file, id, old, new)
PAIRS = [
    ("questions_bisekibun.js", "b4-1", "1/4", "1 / 4"),
    ("questions_bisekibun.js", "b4-1", "1/2", "1 / 2"),
    ("questions_bisekibun.js", "b4-1", "-1/4", "-1 / 4"),
    ("questions_bisekibun.js", "b4-3", "9/2", "9 / 2"),
    ("questions_bisekibun.js", "b4-3", "27/6", "27 / 6"),
    ("questions_chugaku.js", "c2-1", "16/3", "16 / 3"),
    ("questions_chugaku.js", "c4-1", "√194", "(√194)"),
    ("questions_deta_bunseki.js", "d1-2", "10/3", "10 / 3"),
    ("questions_hojosankaku.js", "ho2-2", "√10", "(√10)"),
    ("questions_hojosankaku.js", "ho2-2", "√17", "(√17)"),
    ("questions_hojosankaku.js", "ho2-3", "10√2", "10×√2"),
    ("questions_hojosankaku.js", "ho3-1", "8√10", "8×√10"),
    ("questions_hojosankaku.js", "ho3-2", "2√5", "2×√5"),
    ("questions_hojosankaku.js", "ho3-2", "2√10", "2×√10"),
    ("questions_keiryo.js", "q1-1", "1/2", "1 / 2"),
    ("questions_keiryo.js", "q1-4", "1/2", "1 / 2"),
    ("questions_keiryo.js", "q1-4", "3/2", "3 / 2"),
    ("questions_keiryo.js", "q1-4", "√2", "(√2)"),
    ("questions_keiryo.js", "q1-5", "√2", "(√2)"),
    ("questions_keiryo.js", "k6-1", "√6", "(√6)"),
    ("questions_keiryo.js", "k6-2", "√19", "(√19)"),
    ("questions_keiryo.js", "q2-2", "x/14", "(x)/14"),
    ("questions_keiryo.js", "q3-3", "2√6/3", "(2√6)/3"),
    ("questions_keiryo.js", "q3-3", "√6/3", "(√6)/3"),
    ("questions_keiryo.js", "q3-3", "√6", "(√6)"),
    ("questions_keiryo.js", "q4-1", "√6", "(√6)"),
    ("questions_kitaichi.js", "e1-1", "7/2", "7 / 2"),
    ("questions_kitaichi.js", "e1-3", "3/2", "3 / 2"),
    ("questions_kitaichi.js", "e2-2", "17/4", "17 / 4"),
    ("questions_kitaichi.js", "e2-2", "7/2", "7 / 2"),
    ("questions_kitaichi.js", "e2-2", "15/4", "15 / 4"),
    ("questions_sankaku_1.js", "s1-3", "√3", "(√3)"),
    ("questions_sankaku_1.js", "s1-3", "-√3", "(-√3)"),
    ("questions_sankaku_2.js", "s3-2", "π/3", "(π)/3"),
    ("questions_sankaku_2.js", "s4-5", "π/2", "(π)/2"),
    ("questions_sankaku_2.js", "s4-5", "π/4", "(π)/4"),
    ("questions_seishitsu.js", "g1-3", "√69", "(√69)"),
    ("questions_seishitsu.js", "g2-5", "1/2", "1 / 2"),
    ("questions_shisuu.js", "sh2-1", "√2", "(√2)"),
    ("questions_shisuu.js", "sh3-4", "5/2", "5 / 2"),
    ("questions_shisuu.js", "sh3-4", "√5", "(√5)"),
    ("questions_toukei.js", "t2-1", "σ²/n", "(σ²)/n"),
    ("questions_toukei.js", "t2-1", "σ/n", "(σ)/n"),
    ("questions_toukei.js", "t2-2", "2/5", "2 / 5"),
    ("questions_toukei.js", "t2-2", "1/5", "1 / 5"),
    ("questions_toukei.js", "t2-2", "2/√10", "2/(√10)"),
    ("questions_toukei.js", "t4-3", "1/330", "1 / 330"),
    ("questions_toukei.js", "t4-3", "1/660", "1 / 660"),
    ("questions_toukei.js", "t4-3", "1/6", "1 / 6"),
    ("questions_vector.js", "v2-4", "3√3", "3×√3"),
    ("questions_zahyou.js", "z2-1", "√5", "(√5)"),
    ("questions_zahyou.js", "z2-1", "√3", "(√3)"),
    ("questions_zahyou.js", "z2-2", "√5", "(√5)"),
    ("questions_zahyou.js", "z2-2", "1/√5", "1/(√5)"),
    ("questions_zahyou.js", "z2-2", "5/3", "5 / 3"),
    ("questions_zahyou.js", "z3-3", "√5", "(√5)"),
    ("questions_zahyou.js", "z4-4", "2√2", "2×√2"),
    ("questions_zahyou.js", "z4-4", "√2", "(√2)"),
    ("questions_zahyou.js", "z4-5", "2√2", "2×√2"),
]


def normalize(s: str) -> str:
    """今回導入した装飾(空白/括弧/×)だけを取り除く"""
    s = s.replace(" / ", "/")
    s = s.replace("×√", "√")
    s = s.replace("(", "").replace(")", "")
    return s


SUPERSCRIPT = {"⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5",
               "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9"}


def to_sympy_expr(s: str):
    t = s.strip()
    t = t.replace("×", "*")
    t = t.replace("π", "pi")
    # 上付き文字 "σ²" -> "σ^2" のように、直前の文字とセットで **N に変換
    def sup_repl(m):
        base = m.group(1)
        exp = "".join(SUPERSCRIPT[c] for c in m.group(2))
        return f"({base}**{exp})"
    t = re.sub(r"(\w)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)", sup_repl, t)
    # "coef?√rad" -> "coef?*sqrt(rad)"
    t = re.sub(r"(\d*)√(\d+)", lambda m: (f"{m.group(1)}*" if m.group(1) else "") + f"sqrt({m.group(2)})", t)
    t = re.sub(r"√(\w+)", lambda m: f"sqrt({m.group(1)})", t)  # √n のような文字変数
    sigma, n, x = sp.symbols("sigma n x")
    return sp.sympify(t, locals={"sigma": sigma, "n": n, "x": x, "pi": sp.pi})


all_ok = True

print("=== 方法1: 装飾を除去して完全一致するか ===")
for f, qid, old, new in PAIRS:
    norm = normalize(new)
    passed = norm == old
    if not passed:
        all_ok = False
    print(f"[{'OK' if passed else 'NG'}] {f} {qid}: normalize({new!r}) = {norm!r}  vs old={old!r}")

print("\n=== 方法2: sympyで式として一致するか(独立検証) ===")
for f, qid, old, new in PAIRS:
    try:
        e_old = to_sympy_expr(old)
        e_new = to_sympy_expr(new)
        diff = sp.simplify(e_old - e_new)
        passed = diff == 0
    except Exception as e:
        passed = False
        diff = f"EXCEPTION: {e}"
    if not passed:
        all_ok = False
    print(f"[{'OK' if passed else 'NG'}] {f} {qid}: {old!r} vs {new!r}  (diff={diff})")

print(f"\n{'✅ 全ペア(方法1+方法2)で一致' if all_ok else '❌ NG項目あり'}  (件数: {len(PAIRS)})")
