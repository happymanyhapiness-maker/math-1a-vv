// -*- coding: utf-8 -*-
// verify_choice_math.js
// app.js の選択肢変換（choiceSqrtToLatex 〜 convertChoiceMath）をそのまま読み込んで、
// questions_*.js の全ユニット・全問題の選択肢配列(a)がどう表示されるかを判定する。
// 目的: 同一問題内で「1つだけ浮く」選択肢（MathJax描画とプレーン表示の混在）を検出する。
// 併せて、tags[correct]==="correct" などの構造的な対応も壊れていないかを確認する。
//
// 選択肢の表示の種類:
//   TEX   … "$" を含む、または convertChoiceMath で LaTeX 化される（MathJax で描画）
//   INT   … 裸の数値（"12" "-1" "2.5"）。プレーン表示
//   PLAIN … それ以外（文字式・π・文章など）。プレーン表示
// 判定:
//   NG   … TEX と PLAIN の混在（文字式・π と縦分数などが並んで1つだけ浮く）
//   NG   … 正解だけ表示の種類が違い、ほかの選択肢が全部同じ種類（TEX が絡むもの。正解バレ）
//   警告 … TEX と INT の混在（裸の数値はプレーンのままにする app.js の設計どおり。見た目の差は小さい）
//   警告 … 正解だけ INT / PLAIN が違う（どちらもプレーン表示。直すかは人が判断する）

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..");

// ---- app.js から選択肢変換の関数群をそのまま切り出す（app.js 側は一切変更しない） ----
// 読み込めなければ、全部 PLAIN 扱いで素通りさせずにエラーで終了する
function fail(msg) {
  console.error("❌ app.js の選択肢変換を読み込めませんでした: " + msg);
  process.exit(2);
}
function loadConvertChoiceMath() {
  const src = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
  const start = src.indexOf("function choiceSqrtToLatex(");
  const endFn = src.indexOf("function convertChoiceMath(");
  if (start < 0) fail("function choiceSqrtToLatex が見つからない");
  if (endFn < 0 || endFn < start) fail("function convertChoiceMath が見つからない");
  // convertChoiceMath の本体の閉じ括弧まで（文字列中の括弧は無い前提。下の自己テストで確かめる）
  const open = src.indexOf("{", endFn);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (open < 0 || end < 0) fail("convertChoiceMath の終わりが見つからない");
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    vm.runInContext(src.slice(start, end) + "\nthis.convertChoiceMath = convertChoiceMath;", sandbox, { filename: "app.js(choice)" });
  } catch (e) {
    fail("評価エラー " + e.message);
  }
  const f = sandbox.convertChoiceMath;
  if (typeof f !== "function") fail("convertChoiceMath が関数ではない");
  // 自己テスト：LaTeX 化されるもの・されないものの代表で、期待どおりに動くか
  const probes = [["1/2", true], ["√3", true], ["8/(√3+1)", true], ["12", false], ["2π", false], ["はい", false]];
  for (const [s, conv] of probes) {
    let r;
    try { r = f(s); } catch (e) { fail(`convertChoiceMath(${JSON.stringify(s)}) が例外 ${e.message}`); }
    if ((r !== s) !== conv) fail(`自己テスト失敗: convertChoiceMath(${JSON.stringify(s)}) = ${JSON.stringify(r)}`);
  }
  return f;
}
const convertChoiceMath = loadConvertChoiceMath();

function choiceKind(choice) {
  const s = String(choice);
  if (s.indexOf("$") >= 0 || convertChoiceMath(s) !== s) return "TEX";
  if (/^-?\d+(?:\.\d+)?$/.test(s.trim())) return "INT";
  return "PLAIN";
}

// ---- questions_*.js を vm でロードして実データを取得 ----
// トップレベル const/let は sandbox オブジェクトのプロパティにはならないため、
// 同じ context に対して変数名を直接評価する2段階の実行で取り出す。
function loadQuestionsFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const nameMatch = code.match(/const\s+(questions_\w+)\s*=\s*\[/);
  if (!nameMatch) return { error: "questions_* array declaration not found" };
  const arrName = nameMatch[1];

  const sandbox = { console };
  vm.createContext(sandbox);
  try {
    vm.runInContext(code, sandbox, { filename: filePath });
    const data = vm.runInContext(arrName, sandbox, { filename: filePath });
    if (!Array.isArray(data)) return { error: `${arrName} is not an array` };
    return { data, arrName };
  } catch (e) {
    return { error: `parse/eval error: ${e.message}` };
  }
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => /^questions_.*\.js$/.test(f))
  .sort();

let totalQuestions = 0;
const mixedNG = [];        // TEX と PLAIN の混在
const correctOddNG = [];   // 正解だけ浮く（TEX が絡む）
const mixedWarn = [];      // TEX と INT の混在
const correctOddWarn = []; // 正解だけ INT / PLAIN が違う
const structuralErrors = [];
const fileErrors = [];

for (const f of files) {
  const full = path.join(DIR, f);
  const { data, error } = loadQuestionsFile(full);
  if (error) {
    fileErrors.push(`${f}: ${error}`);
    continue;
  }
  for (const q of data) {
    if (!q || typeof q !== "object" || !Array.isArray(q.a)) continue; // group intro等a無しは対象外
    totalQuestions++;
    const id = q.id || "(no id)";
    const kinds = q.a.map(choiceKind);
    const uniq = new Set(kinds);
    const shown = q.a.map((c, i) => `${c}(${kinds[i]})`);
    const entry = { file: f, id, shown };

    // --- 表示の混在チェック ---
    if (uniq.has("TEX") && uniq.has("PLAIN")) mixedNG.push(entry);
    else if (uniq.has("TEX") && uniq.has("INT")) mixedWarn.push(entry);

    // --- 正解だけ浮くチェック ---
    if (typeof q.correct === "number" && q.correct >= 0 && q.correct < q.a.length && q.a.length >= 3) {
      const ck = kinds[q.correct];
      const others = kinds.filter((_, i) => i !== q.correct);
      if (others.every((k) => k === others[0]) && others[0] !== ck) {
        const e = { ...entry, correct: `${q.a[q.correct]}(${ck})` };
        if (ck === "TEX" || others[0] === "TEX") correctOddNG.push(e);
        else correctOddWarn.push(e);
      }
    }

    // --- 構造チェック(tags/correct対応) ---
    if (Array.isArray(q.tags)) {
      if (q.tags.length !== q.a.length) {
        structuralErrors.push(
          `${f} ${id}: a.length(${q.a.length}) !== tags.length(${q.tags.length})`
        );
      }
      if (typeof q.correct === "number") {
        if (q.correct < 0 || q.correct >= q.a.length) {
          structuralErrors.push(
            `${f} ${id}: correct index ${q.correct} out of range (a.length=${q.a.length})`
          );
        } else if (q.tags[q.correct] !== "correct") {
          structuralErrors.push(
            `${f} ${id}: tags[correct] !== "correct" (got "${q.tags[q.correct]}")`
          );
        }
      }
    }
  }
}

function list(title, arr, mark) {
  console.log(`\n=== ${title} ===`);
  if (arr.length === 0) { console.log(`✅ 0 件`); return; }
  console.log(`${mark} ${arr.length} 件:`);
  for (const m of arr) console.log(`  ${m.file} ${m.id}${m.correct ? " 正解=" + m.correct : ""} -> ${JSON.stringify(m.shown)}`);
}

console.log(`対象ファイル数: ${files.length}`);
console.log(`ロード失敗: ${fileErrors.length}`);
fileErrors.forEach((e) => console.log("  [FILE ERROR] " + e));

console.log(`\n選択肢(a配列)を持つ問題の総数: ${totalQuestions}`);

list("[NG] TEX と PLAIN（文字式・π・文章）の混在", mixedNG, "❌");
list("[NG] 正解だけ表示が違う（TEX が絡む）", correctOddNG, "❌");
list("[警告] TEX と裸の数値(INT)の混在", mixedWarn, "⚠️");
list("[警告] 正解だけ INT / PLAIN が違う（要判断）", correctOddWarn, "⚠️");

console.log(`\n=== 構造チェック(tags[correct]対応など) ===`);
if (structuralErrors.length === 0) {
  console.log("✅ 構造エラーゼロ");
} else {
  console.log(`❌ ${structuralErrors.length} 件の構造エラー:`);
  structuralErrors.forEach((e) => console.log("  " + e));
}

const ok = fileErrors.length === 0 && mixedNG.length === 0 && correctOddNG.length === 0 && structuralErrors.length === 0;
console.log(`\n警告: ${mixedWarn.length + correctOddWarn.length} 件（NG ではない）`);
console.log(`${ok ? "✅ 全ゲート合格" : "❌ NG項目あり"}`);
process.exit(ok ? 0 : 1);
