// -*- coding: utf-8 -*-
// verify_reco.js
// お知らせ（ベル）reco.js の回帰テスト。
//  ・reco.js の「純粋な関数」（BEGIN / END の間）だけを抜き出して vm で試す。DOM・Firebase・localStorage には触らない。
//      cleanText / cleanUnit / cpLen / utf8Len / jstDateKey / parsePayload / validateInput / buildPayload /
//      versionKey / displayDate / savedAtMs / shouldShowCard
//    おすすめ単元（payload.unit・任意・30文字まで）と、旧データ（unit 無し）との互換もここで見る。
//  ・静的チェック：reco.js に innerHTML / insertAdjacentHTML / eval / document.write 等が無いこと、
//    回答履歴（answerLog / questionHistory）をコメント以外で読んでいないこと、
//    index.html の script の順番（firebase-sync.js → reco.js）と ?v=、SDK の版が firebase-sync.js と同じこと。
//  ・テストデータはダミー文だけ（実際の学習内容は書かない）。
//
//   node tools/verify_reco.js

const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const cp = require("child_process");

const DIR = path.join(__dirname, "..");
const RECO = fs.readFileSync(path.join(DIR, "reco.js"), "utf8");
const INDEX = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const SYNC = fs.readFileSync(path.join(DIR, "firebase-sync.js"), "utf8");

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log("  ❌ " + name + (detail !== undefined ? "  → " + detail : ""));
}
function eq(actual, expected, name) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), name, "actual=" + JSON.stringify(actual) + " expected=" + JSON.stringify(expected));
}
function section(title) { console.log("== " + title); }

// 制御文字・行区切りは、このファイル自体に生の文字を書かないよう fromCharCode で作る
const ch = (n) => String.fromCharCode(n);
const emoji = (n) => String.fromCodePoint(n);
const LS = ch(0x2028), PS = ch(0x2029);

/* ---------- 純粋な関数を抜き出す ---------- */
const BEGIN = "/* ---- 純粋な関数（BEGIN";
const END = "/* ---- 純粋な関数（END";
const b = RECO.indexOf(BEGIN), e = RECO.indexOf(END);
if (b < 0 || e < 0 || e < b) {
  console.log("❌ reco.js に 純粋な関数の BEGIN / END の目印が見つからない");
  process.exit(1);
}
const pureBlock = RECO.slice(b, e);
function constLine(name) {
  const m = RECO.match(new RegExp("^const " + name + " = [^;]+;", "m"));
  if (!m) { console.log("❌ reco.js に const " + name + " が見つからない"); process.exit(1); }
  return m[0];
}
const consts = ["PAYLOAD_VERSION", "MAX_REVIEW", "MAX_NEXT", "MAX_UNIT", "MAX_PAYLOAD_BYTES"].map(constLine).join("\n");
const sandbox = { TextEncoder };
const R = vm.runInNewContext(
  consts + "\n" + pureBlock + "\n({ cleanText, cleanUnit, cpLen, utf8Len, jstDateKey, formatDateLabel, parsePayload, validateInput, buildPayload, versionKey, displayDate, savedAtMs, shouldShowCard, PAYLOAD_VERSION, MAX_REVIEW, MAX_NEXT, MAX_UNIT, MAX_PAYLOAD_BYTES });",
  sandbox
);

section("抜き出した範囲は純粋（DOM・Firebase・保存領域に触れない）");
ok(!/\b(document|window|localStorage|sessionStorage|getDoc|setDoc|doc\(|fetch|getAuth|getApp)\b/.test(pureBlock.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")),
  "純粋な関数の範囲に document / window / localStorage / Firebase 呼び出しが無い");
eq([R.PAYLOAD_VERSION, R.MAX_REVIEW, R.MAX_NEXT, R.MAX_UNIT, R.MAX_PAYLOAD_BYTES], [2, 3000, 1500, 30, 19000], "定数: version 2 / 3000 / 1500 / unit 30 / 19000");

/* ---------- cleanText ---------- */
section("cleanText");
eq(R.cleanText("a" + ch(0) + "b" + ch(7) + "c" + ch(0x1b) + "d"), "abcd", "C0 制御文字（NUL・BEL・ESC）を除去");
eq(R.cleanText("a" + ch(8) + "b" + ch(0x0b) + "c" + ch(0x0c) + "d" + ch(0x0e) + "e" + ch(0x1f) + "f"), "abcdef", "BS・VT・FF・SO・US も除去");
eq(R.cleanText("a" + ch(0x7f) + "b" + ch(0x80) + "c" + ch(0x9f) + "d"), "abcd", "DEL と C1 制御文字（0x80〜0x9F）を除去");
eq(R.cleanText("a\tb"), "a\tb", "タブは残す");
eq(R.cleanText("a\nb\n\nc"), "a\nb\n\nc", "改行（空行も）は残す");
eq(R.cleanText("a\r\nb"), "a\nb", "\\r\\n を \\n にそろえる");
eq(R.cleanText("a\rb"), "a\nb", "単独の \\r も \\n にする");
eq(R.cleanText("a\r\n\r\nb\rc\nd"), "a\n\nb\nc\nd", "\\r\\n・\\r・\\n の混在を \\n にそろえる");
eq(R.cleanText("a" + LS + "b" + PS + "c"), "abc", "U+2028 / U+2029 を除去");
eq(R.cleanText("  \n x \n  "), "x", "前後の空白・改行を落とす");
eq(R.cleanText("あ　い"), "あ　い", "途中の全角スペースは残す");
eq(R.cleanText("<b>x</b>&amp;"), "<b>x</b>&amp;", "HTML っぽい文字は加工しない（描画側が textContent）");
eq(R.cleanText("ダミー" + emoji(0x1f600) + "文"), "ダミー" + emoji(0x1f600) + "文", "日本語・絵文字はそのまま");
eq([R.cleanText(null), R.cleanText(undefined), R.cleanText(5), R.cleanText({})], ["", "", "", ""], "文字列でなければ空文字");

/* ---------- cpLen / utf8Len ---------- */
section("cpLen / utf8Len");
eq([R.cpLen(""), R.utf8Len("")], [0, 0], "空文字");
eq([R.cpLen("abc"), R.utf8Len("abc")], [3, 3], "ASCII: 3文字 / 3バイト");
eq([R.cpLen("あいう"), R.utf8Len("あいう")], [3, 9], "日本語: 3文字 / 9バイト");
eq([R.cpLen(emoji(0x1f600)), R.utf8Len(emoji(0x1f600))], [1, 4], "絵文字1つ: 1文字（UTF-16 では2）/ 4バイト");
ok(emoji(0x1f600).length === 2, "（前提）絵文字の String.length は2");
eq([R.cpLen("é"), R.utf8Len("é")], [1, 2], "é（合成済み）: 1文字 / 2バイト");
eq([R.cpLen("e" + ch(0x301)), R.utf8Len("e" + ch(0x301))], [2, 3], "e + 結合アクセント: 2文字 / 3バイト");
const family = emoji(0x1f468) + ch(0x200d) + emoji(0x1f469) + ch(0x200d) + emoji(0x1f467);
eq([R.cpLen(family), R.utf8Len(family)], [5, 18], "家族の絵文字（ZWJ連結）: 5コードポイント / 18バイト");
eq(R.cpLen("あ".repeat(3000) + emoji(0x1f600).repeat(10)), 3010, "日本語3000＋絵文字10 = 3010コードポイント");

/* ---------- jstDateKey ---------- */
section("jstDateKey（日本時間の日付）");
const U = Date.UTC;
eq(R.jstDateKey(U(2026, 9, 7, 14, 59, 59, 999)), "2026-10-07", "UTC 14:59:59.999 はまだ前日（JST 23:59）");
eq(R.jstDateKey(U(2026, 9, 7, 15, 0, 0, 0)), "2026-10-08", "UTC 15:00:00 は翌日（JST 0:00）");
eq(R.jstDateKey(U(2026, 9, 8, 0, 0, 0)), "2026-10-08", "UTC 0:00 は同日（JST 9:00）");
eq(R.jstDateKey(U(2026, 11, 31, 14, 59, 59, 999)), "2026-12-31", "年またぎ手前: 12/31");
eq(R.jstDateKey(U(2026, 11, 31, 15, 0, 0)), "2027-01-01", "年またぎ: UTC 12/31 15:00 は JST 1/1");
eq(R.jstDateKey(U(2027, 0, 1, 0, 0, 0)), "2027-01-01", "年明け UTC 1/1 0:00 は JST 1/1");
eq(R.jstDateKey(U(2026, 9, 31, 15, 0, 0)), "2026-11-01", "月またぎ: 10/31 15:00 UTC は JST 11/1");
eq(R.jstDateKey(U(2028, 1, 28, 15, 0, 0)), "2028-02-29", "うるう日: 2028-02-29");
eq(R.jstDateKey(U(2028, 1, 29, 15, 0, 0)), "2028-03-01", "うるう日の翌日: 2028-03-01");
eq(R.jstDateKey(U(2026, 2, 1, 15, 0, 0)), "2026-03-02", "月初ゼロ埋め: 2026-03-02");
eq(R.jstDateKey(0), "1970-01-01", "エポック（JST 9:00）");

/* ---------- parsePayload ---------- */
section("parsePayload");
const NOW = U(2026, 9, 7, 16, 0, 0);   // JST 2026-10-08
const rt = R.parsePayload(R.buildPayload("ダミー文A\nダミー文B", "ダミー文C", NOW));
eq(rt, { review: "ダミー文A\nダミー文B", next: "ダミー文C", updatedAt: "2026-10-08", unit: "" }, "往復: buildPayload → parsePayload で同じ内容（改行も保持）");
const mk = (o) => JSON.stringify(o);
eq(R.parsePayload(mk({ version: 1, review: "x", next: "y" })), null, "version 1 は未登録扱い");
eq(R.parsePayload(mk({ version: 3, review: "x", next: "y" })), null, "version 3 は未登録扱い");
eq(R.parsePayload(mk({ version: "2", review: "x", next: "y" })), null, "version が文字列 \"2\" は未登録扱い");
eq(R.parsePayload(mk({ review: "x", next: "y" })), null, "version 無しは未登録扱い");
eq(R.parsePayload(mk({ version: 2, review: "", next: "" })), null, "両方空は未登録扱い");
eq(R.parsePayload(mk({ version: 2, review: " \n\t ", next: "  " })), null, "両方空白だけも未登録扱い");
eq(R.parsePayload(mk({ version: 2, review: "x" })), { review: "x", next: "", updatedAt: "", unit: "" }, "片方だけ（review のみ）は読める");
eq(R.parsePayload(mk({ version: 2, next: "y" })), { review: "", next: "y", updatedAt: "", unit: "" }, "片方だけ（next のみ）は読める");
eq(R.parsePayload(mk({ version: 2, review: 5, next: "ok" })), { review: "", next: "ok", updatedAt: "", unit: "" }, "文字列でない review は空扱い");
eq(R.parsePayload(mk({ version: 2, review: "x", next: "y", updatedAt: "2026-10-8" })).updatedAt, "", "updatedAt の形が違えば空");
eq(R.parsePayload(mk({ version: 2, review: "x", next: "y", updatedAt: "2026-10-08" })).updatedAt, "2026-10-08", "updatedAt が YYYY-MM-DD なら保持");
eq(R.parsePayload(mk({ version: 2, review: "a" + ch(7) + "b", next: "c" + LS + "d" })), { review: "ab", next: "cd", updatedAt: "", unit: "" }, "読むときにも制御文字を除去");
eq(R.parsePayload(mk({ version: 2, review: "<img src=x onerror=alert(1)>", next: "y" })).review, "<img src=x onerror=alert(1)>", "HTML っぽい文は加工せずそのまま（描画側が textContent）");
["{bad", "", "null", "[]", "123", "\"str\"", "true", "{\"version\":2"].forEach((s) => {
  eq(R.parsePayload(s), null, "壊れた/想定外のJSON " + JSON.stringify(s) + " は null");
});
eq([R.parsePayload(null), R.parsePayload(undefined), R.parsePayload(5), R.parsePayload({ version: 2 })], [null, null, null, null], "文字列でない入力は null");

/* ---------- validateInput ---------- */
section("validateInput");
const A = "あ";
ok(R.validateInput("", "x") !== null, "review が空ならエラー");
ok(R.validateInput("x", "") !== null, "next が空ならエラー");
ok(R.validateInput("", "") !== null, "両方空ならエラー");
eq(R.validateInput("x", "y"), null, "両方あれば通る");
eq(R.validateInput(A.repeat(3000), A.repeat(1500)), null, "ちょうど 3000 / 1500 文字は通る");
ok(R.validateInput(A.repeat(3001), A.repeat(1500)) !== null, "review が 3001 文字はエラー");
ok(R.validateInput(A.repeat(3000), A.repeat(1501)) !== null, "next が 1501 文字はエラー");
ok(/3000/.test(R.validateInput(A.repeat(3001), "y")), "review 超過のメッセージに上限 3000 が入る");
ok(/1500/.test(R.validateInput("x", A.repeat(1501))), "next 超過のメッセージに上限 1500 が入る");
ok(/3000/.test(R.validateInput(A.repeat(3001), A.repeat(1501))), "両方超過なら review のメッセージを先に出す");
eq(R.validateInput(emoji(0x1f600).repeat(3000), emoji(0x1f600).repeat(1500)), null, "絵文字ちょうど 3000 / 1500 個は通る（UTF-16 ではなくコードポイントで数える）");
ok(R.validateInput(emoji(0x1f600).repeat(3001), "y") !== null, "絵文字 3001 個はエラー");
ok(R.validateInput("x", emoji(0x1f600).repeat(1501)) !== null, "絵文字 1501 個（next）はエラー");

/* ---------- buildPayload（最大入力が上限に収まるか） ---------- */
section("buildPayload（最大入力と 19000 バイト）");
const LIMIT = R.MAX_PAYLOAD_BYTES;
const E = emoji(0x1f600);
const maxCases = [
  ["日本語のみ", A.repeat(3000), "い".repeat(1500)],
  ["絵文字のみ（1文字4バイト＝最悪）", E.repeat(3000), E.repeat(1500)],
  ["日本語＋絵文字の混在", ("ダミー文" + E).repeat(600), ("ダミー" + E).repeat(375)],   // 5文字×600=3000 / 4文字×375=1500
  ["改行だらけ（\\n は JSON で2バイト）", "\n".repeat(0) + ("あ\n").repeat(1500), ("い\n").repeat(750)],
  ["ダブルクォート・バックスラッシュだらけ（JSON でエスケープされる）", "\"\\".repeat(1500), "\"\\".repeat(750)]
];
maxCases.forEach(function (c) {
  const review = R.cleanText(c[1]), next = R.cleanText(c[2]);
  const inRange = R.cpLen(review) <= R.MAX_REVIEW && R.cpLen(next) <= R.MAX_NEXT;
  ok(inRange, c[0] + ": テスト入力が上限内（3000/1500）", R.cpLen(review) + "/" + R.cpLen(next));
  ok(R.validateInput(review, next) === null, c[0] + ": validateInput を通る");
  const p = R.buildPayload(review, next, NOW);
  const bytes = R.utf8Len(p);
  ok(bytes <= LIMIT, c[0] + ": payload が " + LIMIT + " バイト以下", bytes + "バイト");
  ok(bytes < 20000, c[0] + ": Rules の size() < 20000 にバイト数でも収まる", bytes + "バイト");
  ok(p.length < 20000, c[0] + ": Rules の size() < 20000 に UTF-16 長でも収まる", p.length);
  eq(R.parsePayload(p), { review, next, updatedAt: "2026-10-08", unit: "" }, c[0] + ": 往復で同じ内容");
});
const bp = JSON.parse(R.buildPayload("r", "n", NOW));
eq(Object.keys(bp).sort(), ["next", "review", "updatedAt", "version"], "payload のキーは version / updatedAt / review / next の4つだけ");
eq([bp.version, bp.updatedAt], [2, "2026-10-08"], "version は 2、updatedAt は日本時間の日付");
const worstBytes = R.utf8Len(R.buildPayload(E.repeat(3000), E.repeat(1500), NOW));
console.log("  （参考）最悪ケースの実サイズ: " + worstBytes + " バイト / 上限 " + LIMIT + "・余裕 " + (LIMIT - worstBytes));

/* ---------- versionKey / displayDate / savedAtMs ---------- */
section("versionKey");
eq(R.versionKey(123456, "x"), "t123456", "savedAt あり: t + ミリ秒");
eq(R.versionKey(0, "x"), "t0", "savedAt が 0 でも有効な値として扱う");
eq(R.versionKey(5, "a") === R.versionKey(5, "b"), true, "savedAt ありなら payload の中身は見ない");
eq(R.versionKey(5, "a") !== R.versionKey(6, "a"), true, "savedAt が変われば印も変わる");
const pk = R.versionKey(null, "payload-1");
ok(/^p\d+:[0-9a-z]+$/.test(pk), "savedAt なし: p + 長さ + : + ハッシュ", pk);
eq(R.versionKey(null, "payload-1"), pk, "同じ payload なら同じ印");
ok(R.versionKey(null, "payload-2") !== pk, "payload が1文字違えば印も変わる（Console 手入力の差し替えで未読になる）");
ok(R.versionKey(null, "ab") !== R.versionKey(null, "ba"), "同じ長さで並びだけ違っても印が変わる");
ok(R.versionKey(null, "x") !== R.versionKey(1, "x"), "savedAt あり・なしで印の形が違う");
["123", NaN, Infinity, undefined, {}].forEach((v) => {
  ok(/^p/.test(R.versionKey(v, "x")), "savedAt が数値でない/有限でない（" + String(v) + "）なら payload から作る");
});
ok(/^p0:/.test(R.versionKey(null, undefined)), "payload が undefined でも落ちない");

section("displayDate");
eq(R.displayDate(U(2026, 9, 7, 15, 0, 0), "2020-01-01"), "2026/10/08", "savedAt あり: 日本時間の日付が第一候補（payload.updatedAt は無視）");
eq(R.displayDate(U(2026, 9, 7, 14, 59, 59, 999), "2026-10-08"), "2026/10/07", "savedAt の日本時間の境界（14:59:59.999）");
eq(R.displayDate(U(2026, 11, 31, 15, 0, 0), ""), "2027/01/01", "savedAt あり: 年またぎ");
eq(R.displayDate(null, "2026-10-08"), "2026/10/08", "savedAt なし: payload.updatedAt を使う");
eq(R.displayDate(null, ""), "", "savedAt なし・updatedAt も無し: 空");
eq(R.displayDate(null, undefined), "", "updatedAt が undefined でも空");
eq(R.displayDate(null, "2026/10/08"), "", "updatedAt の形が違えば空");
eq(R.displayDate(null, "2026-1-8"), "", "ゼロ埋め無しは空");
eq(R.displayDate("1700000000000", "2026-10-08"), "2026/10/08", "savedAt が文字列（timestamp 型でない）なら payload.updatedAt");
eq(R.displayDate(NaN, "2026-10-08"), "2026/10/08", "savedAt が NaN なら payload.updatedAt");

section("savedAtMs");
eq(R.savedAtMs({ toMillis: function () { return 42; } }), 42, "Timestamp（toMillis あり）→ ミリ秒");
eq(R.savedAtMs({ toMillis: function () { return 0; } }), 0, "toMillis() が 0 でも 0");
eq([R.savedAtMs(null), R.savedAtMs(undefined)], [null, null], "null / undefined は null（Console で savedAt 無し）");
eq([R.savedAtMs({}), R.savedAtMs("2026-10-08"), R.savedAtMs(5), R.savedAtMs({ toMillis: "x" })], [null, null, null, null], "timestamp 型でないもの（空 object・文字列・数値・toMillis が関数でない）は null");
eq(R.savedAtMs(new Date(0)), null, "Date は toMillis を持たないので null");

/* ---------- おすすめ単元（unit） ---------- */
// テストデータはダミー名だけ（実際の単元名・学習内容は書かない）
const UA = "ダミー単元A";
section("cleanUnit");
eq(R.cleanUnit(UA), UA, "ふつうの単元名はそのまま");
eq(R.cleanUnit("  " + UA + "  "), UA, "前後の空白を落とす");
eq(R.cleanUnit("ダミー\n単元"), "ダミー 単元", "改行は空白にする（1行にする）");
eq(R.cleanUnit("ダミー\r\n単元\r別"), "ダミー 単元 別", "\\r\\n・\\r も空白にする");
eq(R.cleanUnit("ダミー\t単元"), "ダミー 単元", "タブは空白にする");
eq(R.cleanUnit("ダミー" + LS + "単元" + PS + "別"), "ダミー 単元 別", "U+2028 / U+2029 は空白にする");
eq(R.cleanUnit("a   b \n\n c"), "a b c", "続く空白・改行は空白1つにまとめる");
eq(R.cleanUnit("a" + ch(0) + "b" + ch(7) + "c" + ch(0x1b) + "d" + ch(0x7f) + "e" + ch(0x80) + "f" + ch(0x9f) + "g"), "abcdefg", "制御文字（C0・DEL・C1）を除去");
eq(R.cleanUnit("a" + ch(0x0b) + "b" + ch(0x0c) + "c" + ch(0x0e) + "d" + ch(0x1f) + "e"), "abcde", "VT・FF・SO・US も除去");
eq(R.cleanUnit("ダミー　単元"), "ダミー　単元", "全角スペースはそのまま");
eq(R.cleanUnit("<b>x</b>&amp;"), "<b>x</b>&amp;", "HTML っぽい文字は加工しない（描画側が textContent）");
eq(R.cleanUnit("⭐" + UA), "⭐" + UA, "絵文字はそのまま");
eq([R.cleanUnit(null), R.cleanUnit(undefined), R.cleanUnit(5), R.cleanUnit({}), R.cleanUnit(["x"])], ["", "", "", "", ""], "文字列でなければ空文字");
eq(R.cleanUnit(" \n\t "), "", "空白だけなら空文字");

section("validateInput（unit は任意・30文字）");
eq(R.validateInput("x", "y"), null, "unit を渡さなくても通る（今までの呼び方）");
eq(R.validateInput("x", "y", ""), null, "unit が空でも通る（任意）");
eq(R.validateInput("x", "y", UA), null, "unit ありでも通る");
eq(R.validateInput("x", "y", A.repeat(30)), null, "ちょうど 30 文字は通る");
ok(R.validateInput("x", "y", A.repeat(31)) !== null, "31 文字はエラー");
ok(/30/.test(R.validateInput("x", "y", A.repeat(31))), "超過のメッセージに上限 30 が入る");
ok(/おすすめ単元/.test(R.validateInput("x", "y", A.repeat(31))), "超過のメッセージに項目名が入る");
eq(R.validateInput(emoji(0x1f600).repeat(30), "y", emoji(0x1f600).repeat(30)), null, "絵文字ちょうど 30 個は通る（コードポイントで数える）");
ok(R.validateInput("x", "y", emoji(0x1f600).repeat(31)) !== null, "絵文字 31 個はエラー");
ok(R.validateInput("", "y", UA) !== null && R.validateInput("x", "", UA) !== null, "unit があっても review / next が空ならエラー（今までどおり両方必須）");
ok(/3000/.test(R.validateInput(A.repeat(3001), "y", A.repeat(31))), "review 超過があれば review のメッセージを先に出す");

section("buildPayload / parsePayload（unit）");
// 過去に登録された形（unit が無い）。このまま読めて、unit 無しで組み立てても同じ文字列になること
const LEGACY = "{\"version\":2,\"updatedAt\":\"2026-10-08\",\"review\":\"ダミー文A\",\"next\":\"ダミー文B\"}";
eq(R.parsePayload(LEGACY), { review: "ダミー文A", next: "ダミー文B", updatedAt: "2026-10-08", unit: "" }, "旧データ（unit 無し）: review / next / updatedAt は今までどおり、unit は空");
eq(R.buildPayload("ダミー文A", "ダミー文B", NOW), LEGACY, "unit 無しで組み立てると、旧データと全く同じ文字列（キーも順番も同じ）");
eq(R.buildPayload("ダミー文A", "ダミー文B", NOW, ""), LEGACY, "unit が空文字でもキーを入れない");
eq(R.buildPayload("ダミー文A", "ダミー文B", NOW, " \n "), LEGACY, "unit が空白だけでもキーを入れない");
eq(R.buildPayload("ダミー文A", "ダミー文B", NOW, undefined), LEGACY, "unit が undefined でもキーを入れない");
const withUnit = R.buildPayload("ダミー文A", "ダミー文B", NOW, UA);
eq(JSON.parse(withUnit), { version: 2, updatedAt: "2026-10-08", review: "ダミー文A", next: "ダミー文B", unit: UA }, "unit ありの payload: 5つのキー、version は 2 のまま");
eq(Object.keys(JSON.parse(withUnit)).sort(), ["next", "review", "unit", "updatedAt", "version"], "unit ありのキーは version / updatedAt / review / next / unit");
eq(R.parsePayload(withUnit), { review: "ダミー文A", next: "ダミー文B", updatedAt: "2026-10-08", unit: UA }, "往復: unit を保存して読める");
eq(JSON.parse(R.buildPayload("r", "n", NOW, "  ダミー\n単元  ")).unit, "ダミー 単元", "組み立てるときにも cleanUnit を通す");
eq(R.parsePayload(R.buildPayload("r", "n", NOW, A.repeat(30))).unit, A.repeat(30), "ちょうど 30 文字は読める");
eq(R.parsePayload(R.buildPayload("r", "n", NOW, E.repeat(30))).unit, E.repeat(30), "絵文字 30 個も読める");
const mkU = (u) => mk({ version: 2, review: "x", next: "y", unit: u });
eq(R.parsePayload(mkU(A.repeat(31))).unit, "", "31 文字（Console 手入力など）は空扱い＝カードを出さない");
eq(R.parsePayload(mkU(E.repeat(31))).unit, "", "絵文字 31 個も空扱い");
eq(R.parsePayload(mkU(A.repeat(31))), { review: "x", next: "y", updatedAt: "", unit: "" }, "unit が長すぎても、他の項目は今までどおり読める");
[5, null, true, [], {}, ["x"], { a: 1 }].forEach(function (v) {
  eq(R.parsePayload(mkU(v)).unit, "", "unit が文字列でない（" + JSON.stringify(v) + "）なら空");
});
eq(R.parsePayload(mkU("a" + ch(7) + "b" + ch(0x1b) + "c")).unit, "abc", "読むときにも制御文字を除去");
eq(R.parsePayload(mkU("ダミー\n単元")).unit, "ダミー 単元", "読むときにも改行を空白にする");
eq(R.parsePayload(mkU("  ")).unit, "", "空白だけの unit は空");
eq(R.parsePayload(mkU("<img src=x onerror=alert(1)>")).unit, "<img src=x onerror=alert(1)>", "HTML っぽい unit は加工せずそのまま（描画側が textContent）");
eq(R.parsePayload(mk({ version: 1, review: "x", next: "y", unit: UA })), null, "version 1 は unit があっても未登録扱い");
eq(R.parsePayload(mk({ version: 3, review: "x", next: "y", unit: UA })), null, "version 3 は unit があっても未登録扱い");
eq(R.parsePayload(mk({ version: 2, review: "", next: "", unit: UA })), null, "unit だけで review / next が空なら未登録扱い（カードもベルも出さない）");
eq(R.parsePayload(mk({ version: 2, review: "x", next: "y", unit: UA, extra: "z" })), { review: "x", next: "y", updatedAt: "", unit: UA }, "知らないキーが混ざっていても無視して読める");

// 最悪ケース（本文が上限いっぱい＋unit が 30 文字）でも 19000 バイトに収まる
[
  ["日本語", A.repeat(3000), "い".repeat(1500), "う".repeat(30)],
  ["絵文字（1文字4バイト＝最悪）", E.repeat(3000), E.repeat(1500), E.repeat(30)],
  ["エスケープされる文字（\\ と \"）", "\"\\".repeat(1500), "\"\\".repeat(750), "\"\\".repeat(15)]
].forEach(function (c) {
  const r = R.cleanText(c[1]), n = R.cleanText(c[2]), u = R.cleanUnit(c[3]);
  ok(R.validateInput(r, n, u) === null, "unit 付き最大入力（" + c[0] + "）: validateInput を通る");
  const p = R.buildPayload(r, n, NOW, u);
  const bytes = R.utf8Len(p);
  ok(bytes <= R.MAX_PAYLOAD_BYTES, "unit 付き最大入力（" + c[0] + "）: " + R.MAX_PAYLOAD_BYTES + " バイト以下", bytes + "バイト");
  ok(bytes < 20000 && p.length < 20000, "unit 付き最大入力（" + c[0] + "）: Rules の size() < 20000 に収まる", bytes + "バイト / " + p.length);
  eq(R.parsePayload(p), { review: r, next: n, updatedAt: "2026-10-08", unit: u }, "unit 付き最大入力（" + c[0] + "）: 往復で同じ内容");
});
console.log("  （参考）unit 付き最悪ケースの実サイズ: " + R.utf8Len(R.buildPayload(E.repeat(3000), E.repeat(1500), NOW, E.repeat(30))) + " バイト / 上限 " + LIMIT);

section("shouldShowCard（次のおすすめカードを出す条件）");
const dataOf = (unit) => ({ review: "ダミー文A", next: "ダミー文B", updatedAt: "", unit, savedMs: null, payload: "", key: "" });
const stOf = (role, readOk, data) => ({ role, authUid: "u1", target: "t1", readOk, data });
eq(R.shouldShowCard(stOf("learner", true, dataOf(UA))), true, "学習者・読めた・unit あり → 出す");
eq(R.shouldShowCard(stOf("guardian", true, dataOf(UA))), true, "保護者・読めた・unit あり → 出す");
eq(R.shouldShowCard(null), false, "st が無い（ゲスト・unauthorized・ログアウト）→ 出さない");
eq(R.shouldShowCard(undefined), false, "st が undefined → 出さない");
eq(R.shouldShowCard(stOf("learner", false, null)), false, "読み込み失敗・permission-denied（readOk=false, data=null）→ 出さない");
eq(R.shouldShowCard(stOf("guardian", false, null)), false, "保護者でも読めていなければ出さない");
eq(R.shouldShowCard(stOf("learner", true, null)), false, "未登録（読めたが data=null）→ 出さない");
eq(R.shouldShowCard(stOf("guardian", true, null)), false, "保護者でも未登録なら出さない（ベルとは違う）");
eq(R.shouldShowCard(stOf("learner", true, dataOf(""))), false, "旧データ（unit が空）→ 出さない");
eq(R.shouldShowCard(stOf("guardian", true, dataOf(""))), false, "保護者でも unit が空なら出さない");
eq(R.shouldShowCard(stOf("learner", false, dataOf(UA))), false, "readOk=false なら data があっても出さない（念のため）");
eq(R.shouldShowCard(stOf("learner", true, { review: "x", next: "y" })), false, "unit のキーが無い data でも落ちずに出さない");
eq(R.shouldShowCard(stOf("learner", true, dataOf(5))), false, "unit が文字列でなければ出さない");
eq(R.shouldShowCard(stOf("learner", true, dataOf(null))), false, "unit が null なら出さない");
// 実際の流れ：payload 文字列 → parsePayload → 出す／出さない
eq(R.shouldShowCard(stOf("learner", true, R.parsePayload(LEGACY))), false, "旧データを読んだ結果 → カードを出さない");
eq(R.shouldShowCard(stOf("learner", true, R.parsePayload(withUnit))), true, "unit ありのデータを読んだ結果 → カードを出す");
eq(R.shouldShowCard(stOf("learner", true, R.parsePayload(mkU(A.repeat(31))))), false, "31 文字の unit を読んだ結果 → カードを出さない");

/* ---------- 静的チェック: reco.js ---------- */
section("静的チェック: reco.js");
// コメントを除いたコード（文字列の中の // や /* は消さない）
function stripComments(src) {
  let out = "", i = 0, mode = null;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode) {
      out += c;
      if (c === "\\") { out += d || ""; i += 2; continue; }
      if (c === mode) mode = null;
      i++;
      continue;
    }
    if (c === "\"" || c === "'" || c === "`") { mode = c; out += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const k = src.indexOf("*/", i + 2); i = k < 0 ? n : k + 2; continue; }
    out += c;
    i++;
  }
  return out;
}
const code = stripComments(RECO);
const tmp = path.join(os.tmpdir(), "verify_reco_stripped_" + process.pid + ".mjs");
fs.writeFileSync(tmp, code);
const chk = cp.spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
try { fs.unlinkSync(tmp); } catch (x) { /* 何もしない */ }
ok(chk.status === 0, "コメント除去後のコードが構文として通る（除去が文字列を壊していない）", (chk.stderr || "").split("\n")[0]);
const rawCheck = cp.spawnSync(process.execPath, ["--check", (function () { const t = path.join(os.tmpdir(), "verify_reco_raw_" + process.pid + ".mjs"); fs.writeFileSync(t, RECO); return t; })()], { encoding: "utf8" });
ok(rawCheck.status === 0, "reco.js 本体が ES module として構文を通る", (rawCheck.stderr || "").split("\n")[0]);
ok(RECO.indexOf(LS) < 0 && RECO.indexOf(PS) < 0, "reco.js に生の U+2028 / U+2029 が入っていない（正規表現が壊れる）");

const FORBIDDEN = [
  [/\.innerHTML\b/, "innerHTML"],
  [/\.outerHTML\b/, "outerHTML"],
  [/insertAdjacentHTML/, "insertAdjacentHTML"],
  [/\beval\s*\(/, "eval("],
  [/new\s+Function\b/, "new Function"],
  [/document\s*\.\s*write(ln)?\s*\(/, "document.write"],
  [/\bsetTimeout\s*\(\s*["'`]/, "setTimeout(文字列)"],
  [/\bsetInterval\s*\(\s*["'`]/, "setInterval(文字列)"],
  [/\.srcdoc\b|\.createContextualFragment\b|DOMParser/, "srcdoc / createContextualFragment / DOMParser"]
];
FORBIDDEN.forEach(function (f) { ok(!f[0].test(code), "reco.js に " + f[1] + " が無い"); });
ok(/\.textContent\s*=/.test(code), "文章は textContent で入れている");

["answerLog", "questionHistory", "logArchive", "kyotsu_app_v", "kyotsu_view_v1_", "readPrefix"].forEach(function (w) {
  ok(code.indexOf(w) < 0, "reco.js のコード部分に " + w + " が無い（回答履歴・学習データを読まない）");
});
ok(!/collection\s*\(|getDocs\s*\(/.test(code), "reco.js は collection / getDocs を使わない（読むのは自分の1ドキュメントだけ）");
ok((code.match(/doc\s*\(\s*db\s*,\s*COLLECTION\s*,/g) || []).length === 2, "Firestore のドキュメント参照は kyotsu-math-reco の2か所（読み・保存）だけ");
ok(/const COLLECTION = "kyotsu-math-reco";/.test(code), "コレクション名は kyotsu-math-reco");
ok(/serverTimestamp\(\)/.test(code), "savedAt は serverTimestamp() で書く");
ok(!/Date\.now\(\)\s*[<>]=?\s*|savedAt\s*[:=]\s*Date/.test(code), "savedAt に端末時刻を入れていない・端末時刻と比べていない");
ok(/role\s*===\s*"guardian"/.test(code), "保護者の判定（role === \"guardian\"）がある");
ok(!/\bsignOut\b|signInWith|createUser|setPersistence/.test(code), "reco.js は認証状態を変更しない（読むだけ）");

// 保護者の入力欄は、保護者のときだけ作る
const openIdx = code.indexOf("function openModal");
const editorCall = code.indexOf("buildEditor(viewBox)", openIdx);
ok(editorCall > 0 && /if\s*\(\s*st\.role\s*===\s*"guardian"\s*\)\s*box\.appendChild\(buildEditor\(viewBox\)\)/.test(code), "登録欄は role===\"guardian\" のときだけ DOM を作る");
ok(/st\.role\s*!==\s*"guardian"/.test(code), "保存処理でも role を確かめている");

// 読み込み失敗の扱い
ok(/DENIED_CODES\s*=\s*\[\s*"permission-denied"\s*,\s*"unauthenticated"\s*\]/.test(code), "permission-denied / unauthenticated を権限エラーとして扱う");
ok(/getApp\(\)/.test(code) && /try\s*\{\s*app\s*=\s*getApp\(\)/.test(code), "getApp() は try で包んでいる（firebase-sync.js より先でも落ちない）");
ok(/onAuthStateChanged\(/.test(code), "認証は onAuthStateChanged 経由");
ok(/console\.warn/.test(code) && !/console\.error|throw\s/.test(code), "失敗は console.warn だけ（error・throw を使わない）");

// 「次のおすすめ」カード（コメントを除いたコードで見る）
function fnBody(name) {
  const i = code.indexOf("function " + name + "(");
  if (i < 0) return "";
  const j = code.indexOf("\nfunction ", i + 1);
  return code.slice(i, j < 0 ? code.length : j);
}
const cardFns = ["ensureCard", "updateCard", "removeCard"];
cardFns.forEach(function (n) { ok(fnBody(n) !== "", "reco.js に " + n + " がある"); });
const cardCode = cardFns.map(fnBody).join("\n");
["markSeen", "seenKey", "isUnread", "reco-bell-dot", "lsSet", "lsGet", "writeCache", "localStorage"].forEach(function (w) {
  ok(cardCode.indexOf(w) < 0, "カードの関数に " + w + " が無い（既読の扱い・赤い点なし）");
});
const ec = fnBody("ensureCard");
ok(/getElementById\("unitCardList"\)/.test(ec), "カードは #unitCardList を基準に置く");
ok(/parent\.insertBefore\(c,\s*list\)/.test(ec) && /list\.parentNode/.test(ec), "カードは #unitCardList の親に insertBefore で入れる（#unitCardList の外・直前）");
ok(!/list\.(appendChild|insertBefore|prepend|append|replaceChildren)\b/.test(cardCode) && !/list\.(innerHTML|textContent)/.test(cardCode), "#unitCardList の中身には触らない（buildUnitSelectCards が作り直す領域）");
ok(/c\.type\s*=\s*"button"/.test(ec) && /createElement\("button"\)/.test(ec), "カードは <button type=\"button\">");
ok(/addEventListener\("click",\s*openModal\)/.test(ec), "カードの click は openModal（ベルと同じお知らせモーダル）");
ok(!/selectUnit|UNIT_META|showUnitSelect|loadUnit|location/.test(cardCode), "カードは単元を開かない（selectUnit などを呼ばない）");
const uc = fnBody("updateCard");
ok(/shouldShowCard\(st\)/.test(uc), "updateCard は shouldShowCard(st) で出す／消すを決める");
ok(/\.textContent\s*=\s*unit/.test(uc) && !/innerText|innerHTML/.test(uc), "単元名は textContent で入れる");
ok(/c\.hidden\s*=\s*examActive\(\)/.test(uc), "出題中（examActive）はカードを隠す");
ok(/function updateBell\(\)\s*\{\s*updateCard\(\);/.test(code), "updateBell の冒頭で updateCard() を呼ぶ（ベルの早期 return より前）");
ok(/function onUser[\s\S]*?removeCard\(\);[\s\S]*?\n\}/.test(code), "onUser（ログイン状態の変化）でカードを消す");
ok(/function removeCard\(\)/.test(code) && /removeChild\(c\)/.test(fnBody("removeCard")), "removeCard はカードを DOM から外す");

// 登録欄の「おすすめ単元」
ok(/"おすすめ単元（任意）"/.test(code), "登録欄に「おすすめ単元（任意）」がある");
ok(/inp\.type\s*=\s*"text"/.test(code), "おすすめ単元は input type=\"text\"");
ok(!/maxlength/i.test(code), "maxlength は付けない（cpLen で数える）");
ok(/cpLen\(cleanUnit\(inp\.value\)\)/.test(code) && /n\s*\+\s*" \/ "\s*\+\s*MAX_UNIT/.test(code), "カウンタは n / MAX_UNIT をコードポイントで数える");
ok(/cleanUnit\(fUnit\.inp\.value\)/.test(code) && /validateInput\(review,\s*next,\s*unit\)/.test(code) && /buildPayload\(review,\s*next,\s*Date\.now\(\),\s*unit\)/.test(code), "保存は登録欄の値（cleanUnit を通した値）で検証・組み立てる");
ok(!/st\.data\s*\?\s*st\.data\.unit\s*:/.test(code), "保存済みの unit を引き継ぐ暫定処理は外れている（登録欄の値が正）");
ok(/inp\.value\s*=\s*d\s*\?\s*d\.unit\s*:\s*""/.test(code), "保存済みの unit を登録欄に読み込む");

// 保存・キャッシュのキー
ok(/CACHE_PREFIX\s*\+\s*st\.authUid\s*\+\s*"_"\s*\+\s*st\.target/.test(code), "キャッシュのキーは authUid と対象uidで分ける");
ok(/SEEN_PREFIX\s*\+\s*st\.authUid\s*\+\s*"_"\s*\+\s*st\.target/.test(code), "未読（最後に見た値）のキーも authUid と対象uidで分ける");
ok(/ctx\.role\s*!==\s*"learner"\s*&&\s*ctx\.role\s*!==\s*"guardian"/.test(code), "unauthorized（learner・guardian 以外）は対象外");
ok(/ctx\.state\s*!==\s*"authenticated"/.test(code), "guest（authenticated 以外）は対象外");

// SDK の版・URL が firebase-sync.js と同じ（別インスタンスが出来ない）
function sdkUrls(s) {
  const m = s.match(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(app|auth|firestore)\.js/g) || [];
  return Array.from(new Set(m)).sort();
}
const urlsReco = sdkUrls(RECO), urlsSync = sdkUrls(SYNC);
ok(urlsReco.length === 3, "reco.js が読む SDK は app / auth / firestore の3つ", JSON.stringify(urlsReco));
ok(urlsReco.every(function (u) { return urlsSync.indexOf(u) >= 0; }), "reco.js の SDK URL が firebase-sync.js のものと完全一致（同じインスタンスを使う）", JSON.stringify({ urlsReco, urlsSync }));

/* ---------- 静的チェック: index.html / style.css ---------- */
section("静的チェック: index.html");
const tagRe = (name) => new RegExp("<script\\b[^>]*\\bsrc=\"" + name.replace(/\./g, "\\.") + "\\?v=([^\"]+)\"[^>]*>", "g");
function scriptTags(name) {
  const out = [];
  let m;
  const re = tagRe(name);
  while ((m = re.exec(INDEX))) out.push({ index: m.index, tag: m[0], v: m[1] });
  return out;
}
const syncTags = scriptTags("firebase-sync.js"), recoTags = scriptTags("reco.js");
ok(syncTags.length === 1, "firebase-sync.js の script は1つ", syncTags.length);
ok(recoTags.length === 1, "reco.js の script は1つ", recoTags.length);
if (syncTags.length === 1 && recoTags.length === 1) {
  ok(syncTags[0].index < recoTags[0].index, "script の順番: firebase-sync.js → reco.js");
  ok(/\btype="module"/.test(recoTags[0].tag), "reco.js は type=\"module\"");
  ok(/^\d{8}-[\w-]+$/.test(recoTags[0].v) || /^\d+$/.test(recoTags[0].v), "reco.js の ?v= がある（" + recoTags[0].v + "）");
  ok(!/\bdefer\b|\basync\b/.test(recoTags[0].tag), "reco.js に defer / async を付けていない（module の順序実行に任せる）");
  // firebase-sync.js の ?v= は変えていない（HEAD と同じ）。git が使えなければ飛ばす
  let headSync = null;
  try {
    const headIndex = cp.execSync("git show HEAD:index.html", { cwd: DIR, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = headIndex.match(/<script\b[^>]*\bsrc="firebase-sync\.js\?v=([^"]+)"/);
    headSync = m ? m[1] : null;
  } catch (x) { headSync = null; }
  if (headSync) ok(syncTags[0].v === headSync, "firebase-sync.js の ?v= は HEAD から変えていない", syncTags[0].v + " vs HEAD " + headSync);
  else console.log("  （git から HEAD の index.html を読めなかったので firebase-sync.js の ?v= 比較は省略）");
}
const cssV = INDEX.match(/<link[^>]*href="style\.css\?v=(\d+)"/);
ok(!!cssV && Number(cssV[1]) >= 25, "style.css の ?v= が 25 以上（カードのスタイル追加で 24 から更新）", cssV && cssV[1]);
if (recoTags.length === 1) ok(Number(recoTags[0].v.slice(0, 8)) >= 20261009 && recoTags[0].v !== "20261008-1", "reco.js の ?v= が 20261008-1 から更新されている（" + recoTags[0].v + "）");
ok(/^\s*<script[^>]*src="unit-strength\.js\?v=/m.test(INDEX), "unit-strength.js（分析ボタン）の script が残っている");
// reco.js が app.js / questions を変えていないこと（読み込み順は firebase-sync.js の後）
const appIdx = INDEX.indexOf("app.js?v="), recoIdx = INDEX.indexOf("reco.js?v=");
ok(appIdx > 0 && recoIdx > appIdx, "reco.js は app.js より後ろで読み込まれる");

section("静的チェック: style.css");
const CSS = fs.readFileSync(path.join(DIR, "style.css"), "utf8");
["reco-bell", "reco-bell-dot", "reco-text", "reco-editor", "reco-textarea", "reco-status", "reco-save"].forEach(function (cls) {
  ok(new RegExp("\\." + cls + "\\b").test(CSS), "style.css に ." + cls + " がある");
});
ok(/\.reco-text\s*\{[^}]*white-space:\s*pre-wrap/.test(CSS), ".reco-text は white-space: pre-wrap");
ok(/\.reco-bell\[hidden\]\s*\{\s*display:\s*none/.test(CSS), ".reco-bell[hidden] が効く（display 指定に負けない）");
ok(/\.reco-textarea\s*\{[^}]*font-size:\s*16px/.test(CSS), "入力欄は 16px（iOS で拡大されない）");
ok(/@media\s*\(max-width:\s*900px\)\s*\{\s*\.topbar\.has-reco-bell/.test(CSS), "スマホ幅のベル配置（.topbar.has-reco-bell）がある");
ok(/\.reco-next-card\s*\{[^}]*min-height:\s*44px/.test(CSS), ".reco-next-card は min-height: 44px");
ok(/\.reco-next-unit\s*\{[^}]*overflow-wrap:\s*anywhere/.test(CSS), ".reco-next-unit は overflow-wrap: anywhere（長い単元名が折り返す）");
ok(/\.reco-next-card\[hidden\]\s*\{\s*display:\s*none/.test(CSS), ".reco-next-card[hidden] が効く（display 指定に負けない）");
ok(/\.reco-next-card\s*\{[^}]*background:\s*#eff6ff[^}]*\}/.test(CSS) && /\.reco-next-card\s*\{[^}]*border:\s*1px solid #bfdbfe/.test(CSS), ".reco-next-card は青系（.badge と同じ #eff6ff / #bfdbfe）");
ok(/\.reco-input\s*\{[^}]*font-size:\s*16px/.test(CSS), "おすすめ単元の入力欄は 16px（iOS で拡大されない）");
ok(!/\.reco-next-card[^{]*\{[^}]*(position:\s*absolute|reco-bell)/.test(CSS), "カードのスタイルはベルと独立（ベルのスタイルを流用・変更していない）");

// 実データが紛れていないこと（このテストと reco.js / CSS にダミー以外の学習内容を書かない運用の確認用：UID・メールが入っていない）
section("静的チェック: 機微な値が入っていない");
[["reco.js", RECO], ["verify_reco.js（このファイル）", fs.readFileSync(__filename, "utf8")]].forEach(function (p) {
  // UID・トークンは英字と数字が混ざった長い並び（数字を含まない長い単語＝ createContextualFragment などは対象外）
  ok(!/(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{20,}/.test(p[1].replace(/https?:\/\/\S+/g, "")), p[0] + " に UID やトークンのような長い英数字が無い");
  ok(!/@[A-Za-z0-9-]+\.(com|jp|net)/.test(p[1]), p[0] + " にメールアドレスが無い");
});

console.log("");
console.log("通った: " + pass + " / 落ちた: " + fail);
console.log(fail === 0 ? "✅ 全項目合格" : "❌ NG項目あり");
process.exitCode = fail === 0 ? 0 : 1;
