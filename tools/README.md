# tools/ — 検証スクリプト置き場

このフォルダは**品質ゲートを機械化したスクリプト**を置く場所。
問題を追加・修正したら、下の表の「いつ走らせるか」に従って実行する。

> 品質ゲートの全体像・チェックリスト本体は、claude.aiプロジェクト「数学アプリ」の
> **`claude/開発ルール・品質ゲート統合版.md`** にある。このフォルダはその実行手段。
> ゲートの番号（A-2 / A-4 など）はそのドキュメントの節番号に対応している。

---

## 中身一覧

| ファイル | 対応ゲート | 何をするか | いつ走らせるか |
|---|---|---|---|
| `verify_sync_merge.js` | — | `firebase-sync.js`の`mergeUnitData`をソースから抜き出して実行し、`stats.questionHistory`が同期マージで消えないこと（2026-09監査④-1）、既存フィールドのマージ規則、起動時`syncAll`の`changedLocal`判定を検査。Firestoreには触らない | **`firebase-sync.js`のマージ処理を触ったとき** |
| `verify_choice_math.js` | A-4 / C-2 | 全ユニット横断。`app.js`から`choiceSqrtToLatex`〜`convertChoiceMath`をそのまま読み込んで全選択肢の表示（TEX / INT / PLAIN）を判定する（読み込み失敗・自己テスト失敗ならexit 2で停止）。**NG**：TEXとPLAINの混在／正解だけ表示が違う（TEXが絡む）。**警告**：TEXと裸の数値(INT)の混在／正解だけINT・PLAINが違う。併せて`tags`の長さ・`tags[correct]==="correct"`・`correct`の範囲も確認 | **選択肢を1つでも追加・変更したら毎回** |
| `verify_choice_notation.py` | A-2 | 2026-08に選択肢の表記を一括書き換えしたとき、**書き換え前後で数式の意味が変わっていない**ことを2通り（装飾除去での文字列一致／sympyでの式の一致）で検証したもの。`PAIRS`に当時の全ペアが残っているので、再実行すれば回帰テストになる | 選択肢の表記ルールを変更したとき |
| `verify_hojosankaku.py` | A-2 | `questions_hojosankaku.js`（補助三角形の発見）の全問の正解・誤答の数値をsympyで独立再計算 | このユニットを触ったとき |
| `verify_houteishiki.py` | A-2 | `questions_houteishiki.js`（方程式へのモード切替）の全問の数値をsympyで独立再計算 | このユニットを触ったとき |
| `verify_bisekibun_zettai.py` | A-2 | `questions_bisekibun.js`の絶対値付き定積分パック（b2-4〜b2-8, b4-4〜b4-7）の数値検算。正解だけでなく**誤答選択肢も「その誤り方を実際に再現して」値が一致するか**まで確認。選択肢の分数/整数の混在チェックも含む | この問題群を触ったとき |
| `verify_zettaichi.py` | A-2 | `questions_zettaichi.js`（絶対値の積分・特訓）全15問の数値検算。誤答選択肢も`explain.mistake`の誤り方を再現して一致を確認 | このユニットを触ったとき |
| `verify_compact.js` | — | 生ログ（answerLog）の削減（`log-archive.js`の`compactUnitData`）の回帰テスト（Phase 7B-2） | **`log-archive.js`・同期の保存処理を触ったとき** |
| `verify_log_archive.js` | — | 古い回答の compact event archive（`log-archive.js`, schema v1）の回帰テスト（Phase 7B-1） | 同上 |
| `verify_rescue_log.js` | — | Phase 2 救済用の失敗時刻 rescueLog の読み込み・merge・救済の回帰テスト（Phase 7B-1.5） | 同上 |
| `verify_qh_backfill.js` | — | 生ログから欠けている questionHistory を補完する処理の回帰テスト（Phase 7C） | 同上 |
| `verify_reset_sync.js` | — | 「学習データをリセット」が同期で取り消されないこと（単元ごとの resetGen）の回帰テスト | **リセット・`firebase-sync.js`を触ったとき** |
| `verify_review_session.js` | — | 「今日の復習」「間違えた問題だけ」の出題リストがセッション中に縮まない・固定されることの回帰テスト（Phase 3） | **復習モード（`app.js`）を触ったとき** |
| `verify_wrong_id.js` | — | 復習対象 `state.wrong` を `[{id}]` だけで持つ変更の回帰テスト（Phase 7A-2b） | 同上 |
| `verify_unanswered_session.js` | — | 「未挑戦の問題だけ」の対象リストをメモリだけで持つ変更の回帰テスト（Phase 7A-2c） | 同上 |
| `verify_uid_context.js` | — | 学習データのアカウント分離（`storage-ns.js`）と context の世代管理、保護者表示の判定（`isGuardianCtx`）の回帰テスト（Phase 8A） | **`storage-ns.js`・`firebase-sync.js`・ログイン周りを触ったとき** |
| `verify_kyotsu_math_auto.js` | — | 数学アプリ → デイリークエスト連携（kyotsuMathAuto 方式）の最小回帰テスト | **summary・デイリークエスト連携を触ったとき** |
| `verify_reco.js` | — | お知らせ（ベル）`reco.js` の回帰テスト。「純粋な関数」の BEGIN/END の間だけを抜き出して、文字の掃除（制御文字・改行・U+2028/2029）、文字数/バイト数の数え方（絵文字含む）、日本時間の日付の境界、payload の読み書き、入力の検証（3000/1500文字）、最大入力が 19000 バイトに収まること、未読の印・更新日の表示を検査。あわせて静的チェック（innerHTML・eval 等が無い／回答履歴をコメント以外で読まない／index.html の script の順番と `?v=`／SDK の版が `firebase-sync.js` と同じ）。Firestore・DOM には触らない | **`reco.js`・お知らせ周りの `style.css`・`index.html` の script 行を触ったとき** |
| `test-context.js` | — | テスト用の小道具（Auth 判定前は学習データを開かない app.js を、テストから context 確定済みにする） | 単体では走らせない（各 verify から使う） |

※ 高難度タスクの進め方（SKILLS.md）の正本は mdファイル/SKILLS.md（private repo kyotsu-math-docs）と high-effort-workflow スキル。public には置かない。

## まとめて走らせる

```bash
# public フォルダで実行
for f in tools/verify_*.js; do echo "== $f"; node "$f" | tail -1; done
for f in tools/verify_*.py; do echo "== $f"; python3 "$f" | tail -1; done
```

`verify_choice_math.js`は**NG 0件・構造エラーゼロで合格**。警告（TEXと裸の数値の混在）は、作業の前後で**件数が増えていなければOK**。

---

## 新しいユニット/問題群を追加したときの流儀

**ユニット（または問題パック）ごとに数値検算スクリプトを1本、このフォルダに残す。**
その場限りのワンライナーで検算して捨てると、次に誰かがその問題を修正したとき、
再検算する手段がなくなる（＝リグレッションに気づけない）。

`verify_bisekibun_zettai.py` が最新の書き方の見本。押さえるところ：

1. **正解の値**を問題文の条件から独立に再計算する
2. **誤答の値も**、`explain.mistake`に書いた誤り方をそのままコードで再現し、選択肢の数値と一致することを確認する（一致しないなら、解説が嘘をついているか、誤答が「ありえない間違い方」になっている）
3. 最後に`✅ 全項目合格` / `❌ NG項目あり`を出し、**終了コードではなく目で見て分かる形**にする（既存スクリプトに合わせた）
4. ファイル冒頭のdocstringに「どのユニットの・どのゲートに対応するか」を書く

命名は `verify_<unit>.py`、問題パック単位なら `verify_<unit>_<パック名>.py`。
