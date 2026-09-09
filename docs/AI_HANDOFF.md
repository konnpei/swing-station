# AI_HANDOFF — KabuBocchi 3者体制 運用ルール

> このファイルは「取扱説明書」です。更新頻度は低い想定。
> 時系列の作業ログは Issue #1、機能ごとの「今の状態」は `docs/DEVELOPMENT_LEDGER.md` を見る。
> 3つの置き場所の役割が重ならないようにしているので、迷ったらこの表を見る。

| 置き場所 | 役割 | 更新頻度|
|---|---|---|
| Issue #1 | 時系列の活動ログ(誰が何をしたか) | 高い(作業ごと) |
| `docs/DEVELOPMENT_LEDGER.md` | 機能ごとの「今の状態」索引 | 中程度(状態が変わるたび) |
| このファイル | 役割分担・運用ルールそのもの | 低い(ルールが変わった時だけ) |
| 個別Issue(`[L-0XX]`) | 1機能の詳細(概要・判断・実装ファイル等) | 状態遷移ごと |

---

## 役割分担

### CEO(こんぺい) — Product Owner / Founder
- 最終決定、方向性決定、実際の使用感判断、公開判断、課金判断
- GO/HOLDの最終判断

### ChatGPT — Product Strategy / PM / Monetization
- 機能優先順位、収益化設計、無料/有料境界、UXレビュー
- note/X/Discordとの導線、KPI設計、ロードマップ
- Claude実装結果のレビュー

### Claude / Claude Code — Lead Engineer / Implementation
- コード実装、既存コード調査、技術設計、リファクタリング、テスト
- 重複実装防止、技術的負債の監査、実装可否/工数評価

役割分担は固定ではなく、非効率と感じた場合はどちらのAIからも変更提案してよい。

---

## 新機能の意思決定フロー

```
① IDEA
   ↓ ChatGPTが収益性・ユーザー価値・優先順位を評価(status:idea → labelでpriority付与)
② 優先度評価
   ↓ Claudeが既存実装を検索・重複確認
③ 重複チェック
   ↓ 重複が無ければClaudeが技術難易度・工数を評価(status:planned)
④ 工数評価
   ↓ CEOがGO/HOLDを決定
⑤ GO/HOLD判断
   ↓ GOならClaudeが実装(status:in-progress)、ブランチにpush後PR作成
⑥ 実装
   ↓ ChatGPT/CEOがPRをレビュー(status:review)
⑦ レビュー
   ↓ CEO承認・mainマージ
⑧ DONE
```

**重複実装の防止が最優先事項の一つ**。既に存在する機能を別コンポーネントとして
再実装することを避ける。Claudeは③の工数を、②でChatGPTが付けた優先度に応じて
調整してよい(優先度が低い案に重い調査コストをかけない)。

---

## Issue運用

- 1機能 = 1 Issue。タイトルは `[L-0XX] 機能名` で固定し、状態が変わっても書き換えない
- 状態はラベルで管理する(タイトル書き換えは履歴が汚れるため避ける)
- **状態ラベル(`status:*`)は同時に1つだけ付ける。** 状態を変える時は旧ラベルを外してから
  新ラベルを付ける(付けっぱなしで新ラベルを足すと矛盾した状態になる)
- **`owner:*`は「次に手を動かす役」を表す。** 判断待ちは`owner:ceo`、企画待ちは
  `owner:chatgpt`、実装待ちは`owner:claude`。役が変わるたびに更新する
- ラベル一覧・状態の定義は `docs/DEVELOPMENT_LEDGER.md` を参照
- Issue本文には概要/収益化との関係/ChatGPT判断/Claude判断/オーナー最終判断/実装ファイル/
  関連Issue-PR/最終更新日を書く(テンプレは`DEVELOPMENT_LEDGER.md`参照)
- **Issue #1は個別機能の詳細置き場ではなく、時系列の短い索引専用とする。**
  書いてよいのは「Issue番号・状態変更・次の担当・日時」程度の1〜2行だけ。
  判断内容・提案・質問・回答などの長文は、必ず対応する個別Issueへ書く
- **完了(DONE)条件は機能の性質で区別する:**
  - 企画・レビュー系Issue(ChatGPTの評価等)→ 評価/提案が出た時点で「提案完了」とし、
    それをもって`status:done`にできる
  - 実装系Issue(Claudeのコード変更)→ PR作成・テスト(`npm run build`等)・
    mainへの反映まで完了して初めて`status:done`にする。レビュー待ちの段階では
    `status:review`のまま止める

## PR運用

- GO判断が出た機能は、作業ブランチへpush後、**Pull Requestを作成**する
  (Closes #L-0XX番号 をPR本文に記載し、Issueと自動リンクさせる)
- PR本文には変更内容・理由・検証内容を書く(既存の運用と同様)
- ChatGPT/CEOはPRの差分を見てレビューコメントを付ける
- CEOの承認後にmainへマージする
- 従来の「作業ブランチに直push→CEOが直接main反映を承認」という運用から変更。
  緊急のホットフィックス等、PRを介さない方が早い場合はCEOの判断でその都度決める

## ClaudeとChatGPTの情報受け渡し

- 両者ともGitHubへの読み書きが可能(Issue閲覧・コメント・ファイル編集)
- 制約: Claudeは現状、Issueコメントの自動通知を受け取れない(PRイベントのみ購読可能)。
  そのため定期チェックインTrigger(Claude Codeの仕組み)で、一定間隔でIssue #1と
  未クローズの `[L-0XX]` Issueの新着コメントを確認し、対応が必要なら着手する運用にする
- ChatGPT側の自動ポーリング可否は本ファイルの管轄外(ChatGPT/CEO側で別途確認)

---

## 旧ファイルからの移行

- `AI_HANDOFF_CHATGPT.md`(2026-07-11作成、ChatGPT側の接続テスト記録)は本ファイルに
  統合し、削除した。GitHub読み書きが可能であることは既に実証済みのため、テスト記録
  としての役目は終えている
- Claude Artifact「KabuBocchi 開発台帳」はスナップショット表示用として残るが、
  正本(Single Source of Truth)はGitHub側(このファイル + DEVELOPMENT_LEDGER.md +
  個別Issue)とする
