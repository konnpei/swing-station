# KabuBocchi 開発台帳(DEVELOPMENT_LEDGER)

> 3者体制(CEO / ChatGPT / Claude)の「今どこまで出来ているか」を一目で確認するための索引。
> 使い方や役割分担のルールは `docs/AI_HANDOFF.md` を参照。

このファイルは**薄い索引**です。各機能の詳細(概要・収益化との関係・ChatGPT判断・
Claude判断・オーナー最終判断・実装ファイル)は、対応するGitHub Issue本文に書きます。
このファイルには機能ごとに1行だけ置き、状態が変わったらこの表の該当行だけを
更新してください(Issue本文の全文をここに複製しない)。

時系列の作業ログ(誰が何をしたか)は引き続き **Issue #1** に書きます。このファイルは
「今の状態」のスナップショットであり、ログではありません。

## 状態(status)の定義

| 状態 | 意味 |
|---|---|
| IDEA | 案が出た段階。ChatGPTの優先度評価待ち |
| PLANNED | 優先度評価済み、Claudeの技術調査待ち/完了 |
| IN_PROGRESS | CEOのGOが出て実装中 |
| REVIEW | 実装完了、ChatGPT/CEOレビュー待ち |
| DONE | レビュー完了・反映済み |
| HOLD | 保留(理由はIssue本文に明記) |
| REJECTED | 却下(理由はIssue本文に明記) |

状態ラベル(`status:*`)は同時に1つだけ付ける。詳しい運用ルールは `docs/AI_HANDOFF.md` を参照。

## 索引

| ID | 機能名 | 状態 | 優先度 | Phase | 担当 | Issue |
|----|--------|------|--------|-------|------|-------|
| L-001 | Sector Ranking ★評価 | DONE | - | 2 | Claude | [#20](https://github.com/konnpei/swing-station/issues/20) |
| L-002 | FearGreedGauge/MarketDashboard デザイン統一 | DONE | - | 1 | Claude | [#21](https://github.com/konnpei/swing-station/issues/21) |
| L-003 | Vercel Cronフェイルセーフの環境変数設定 | HOLD | - | 1 | CEO | [#22](https://github.com/konnpei/swing-station/issues/22) |
| L-004 | 情報源監視機能(実在個人SNS監視) | HOLD | - | backlog | CEO | [#23](https://github.com/konnpei/swing-station/issues/23) |
| L-005 | KabuBocchi SCORE(100点満点) | HOLD | - | backlog | CEO | [#24](https://github.com/konnpei/swing-station/issues/24) |
| L-006 | Phase2新機能開発(最小実装: 表示順+計測イベント) | REVIEW | - | 2 | CEO | [#25](https://github.com/konnpei/swing-station/issues/25) |
| L-007 | 開発フローのGitHub SSOT化(3者体制) | DONE | - | 1 | Claude | [#26](https://github.com/konnpei/swing-station/issues/26) |

## ラベル一覧

- `status:idea` / `status:planned` / `status:in-progress` / `status:review` / `status:done` / `status:hold` / `status:rejected`
- `priority:p0` / `priority:p1` / `priority:p2`
- `phase:1` / `phase:2` / `phase:backlog`
- `owner:ceo` / `owner:chatgpt` / `owner:claude` (今ボールが誰にあるか)

## 新しい機能案の追加手順

1. GitHub Issueを新規作成。タイトルは `[L-0XX] 機能名`(このファイルの次の番号を使う)
2. ラベル `status:idea` を付与
3. Issue本文に以下のテンプレを貼って埋める:

```markdown
## 概要
## 収益化との関係
## ChatGPT判断
## Claude判断
## オーナー最終判断
## 実装ファイル
## 関連Issue/PR
## 最終更新日
```

4. このファイルの索引に1行追加
5. 状態が変わるたびに、Issueのラベル更新 + このファイルの該当行を更新
