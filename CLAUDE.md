# CLAUDE.md

> Version: 1.5
> Last Updated: 2026-07-17

このファイルは、Claude Code / Claude / ChatGPT / Codex がこのリポジトリで作業するときに読む運用ルールです。
作業前に必ず確認し、迷った場合は新機能よりも安定運用を優先してください。

---

## プロジェクト概要

- サービス名: SWING STATION
- サイト表示名: KabuBocchi
- リポジトリ: `konnpei/swing-station`
- 用途: 株式スイングトレード情報を毎朝Discordとサイトへ配信するNext.js + Vercelアプリ
- CEO: こんぺい。最終判断、優先順位、リリース可否、環境変数、Vercel、GitHub設定を担当

---

## 最優先目標

SWING STATIONは「毎朝安心して見られる株サイト」を最優先にする。

優先順位:

1. 安定運用
2. データ鮮度
3. 自動配信
4. エラーゼロ
5. 表示速度
6. UI改善
7. 新機能

迷った場合は、新機能ではなく安定性を優先する。

---

## AI分業体制

### Claude

担当:

- コード分析
- diff作成
- ビルド検証
- バグ調査
- 実装案とレビュー材料の作成

制限:

- 通常のClaudeチャットはGitHubへ直接書き込まない。読み取り、分析、提案を中心とする。
- 実装、commit、pushは、明示的に許可されたClaude Code環境でのみ行う。

### ChatGPT / Codex

担当:

- GitHub Issue更新
- PRレビュー
- ドキュメント更新
- コードレビュー
- 設計レビュー
- セキュリティレビュー
- 必要に応じた実装、commit、push

禁止:

- 指示されていないファイル変更
- 大規模リファクタ
- 勝手な設計変更

### Claude Code

担当:

- 実装
- Build
- Commit
- 専用ブランチへのPush
- Pull Request作成

必須ルール:

- `main` へ直接pushしない
- 作業ごとに専用ブランチを作成する
- 自動マージしない
- 最終レビューとマージは、CEOまたは別のAIレビュー担当が行う
- 指定された範囲以外のファイルを変更しない
- 変更前後に `git status`、変更ファイル一覧、`git diff` を確認する
- 複数目的を1コミットにまとめない
- Build・テスト結果をPR本文に記載する
- トークン、Secrets、環境変数の値をチャット、ログ、コミット、PR本文へ記載しない

GitHub権限:

- Fine-grained PATまたはGitHub Appを優先する
- 対象は原則として `konnpei/swing-station` のみに限定する
- 必要最小限の権限と有効期限を設定する
- Actions、Administration、Secrets、Workflowsなど、作業に不要な権限は付与しない
- 作業終了後、不要になったPATは失効または削除する

---

## 引き継ぎ

GitHub Issue #1を共通台帳として使う。

作業開始前:

- Issue #1を確認する

作業完了後:

- Issue #1に簡潔に追記する

参照順:

1. Issue #1
2. CLAUDE.md
3. README.md
4. HANDOVER.md

注意:

- `HANDOVER_CONTEXT.md` のような類似名ファイルは存在しない前提で扱わない。
- 参照するのは実在する `HANDOVER.md` のみ。
- 引き継ぎメモが必要な場合は、新規ファイルを作らずIssue #1に追記する。

---

## アーキテクチャ

- Next.js pages router + Vercel
- Discord Webhookで朝刊、週次レビューなどを配信
- データは `data/latest.json` と `data/history/YYYY-MM-DD.json` に保存
- GitHub API経由でJSONや画像をコミットし、VercelのGit連携で自動デプロイする
- `scripts/` 配下のPythonスクリプトはGitHub Actions cronで定期実行される

---

## 主要スクリプト

| Script | Role | Claude API | Discord |
|---|---|---|---|
| `morning_briefing.py` | 朝刊生成 | yes | yes |
| `market_data.py` | 市場データ取得共通モジュール | no | no |
| `refresh_market_data.py` | 市場データだけ更新 | no | no |
| `refresh_screener.py` | スクリーナー更新 | no | no |
| `refresh_earnings.py` | 決算情報更新 | no | no |
| `track_record.py` | 推奨銘柄の成績判定 | no | no |
| `briefing_watchdog.py` | 朝刊とデータ鮮度監視 | no | notify only |
| `weekly_preview.py` | 週次プレビュー | yes | yes |
| `weekly_review.py` | 週次レビュー | yes | yes |
| `quality_check.py` | 生成文章の品質チェック | yes | no |

`morning_briefing.py` は `x_posts` と `x_teaser_3line` も生成する。
X投稿文は一人称の意見を1文含め、問いかけでフォロワーの反応を促す。
noteへの誘導リンクは本文に含めず、投稿後のセルフリプライで追加する運用とする。

---

## AIスクリーニング改善方針

先行実装の優先順位:

1. 銘柄入れ替えdiff反映
2. 状態変化表示
3. 採用理由表示
4. セクター温度表示
5. AIスコア表示

実現コストと既存資産:

- AIスコア表示: `compute_ai_score` が実装済み。フロント表示が中心。
- セクター温度: `build_sector_heatmap` の平均騰落率を閾値で分類する。
- 状態変化表示: 新規、継続、条件外、急落警戒に加えて復帰を扱う。
- 採用理由表示: RSI、MA25乖離、BB位置、出来高比、当日騰落率などからルールベースで生成する。
- 決算接近は `refresh_earnings.py`、セクター理由はセクター温度との連携で導出する。

実装原則:

- LLMを追加利用せず、既存指標から機械的に生成する
- `refresh_screener.py` のClaude API不使用・再実行安全という設計を維持する
- AIスコアとセクター温度は低コストのため、小さなPRとして先行または並行実装してよい
- 1コミット1目的、専用ブランチ、PR経由を守る

判断待ち:

- J-Quants Light対応: 月額費用のCEO判断待ち。承認前に契約や有料前提の実装を進めない。
- 実績トラッキング公開: 公開可否、コンプライアンス、法的確認、CEO承認待ち。内部保存と外部公開を分けて扱う。

---

## track_record.py 判定ルール

- 判定期間: 推奨日の翌営業日から5営業日
- 判定基準: 日足の高値、安値ベース
- target到達: その日の高値がtarget価格以上
- stop到達: その日の安値がstop価格以下
- 同日にtargetとstopの両方へ到達した場合は、保守的にstop優先
- 5営業日以内にどちらにも未到達ならタイムアウト
- タイムアウト時は5営業日目の終値で決済したものとみなす
- entry_priceが保存されていない過去分は対象外
- 結果は `data/track_record.json` に保存する

---

## 環境変数

GitHub Actions Secrets:

- `ANTHROPIC_API_KEY`
- `DISCORD_WEBHOOK_MAIN`
- `GH_PAT`

ローカル:

- `.env.local` はダミー値でもよい

VercelとGitHub ActionsのSecretsは別管理。

---

## 現在の懸念事項

1. 未適用パッチがないか確認すること
2. READMEとcron設定の不一致を確認すること
3. `track_record.json` は非公開データとして扱うこと
4. J-Quants Lightは費用判断前に有料前提で進めないこと
5. 実績トラッキングは公開承認が出るまで外部表示しないこと

---

## 直近対応済みの修正

- `strategy_lines` 保存漏れ修正
- `^N225` 鮮度チェック追加
- `refresh-market-data.yml` へcron追加
- `refresh-screener.yml` へcron追加
- `track_record.py` 追加
- X投稿文プロンプト改善
- `briefing_watchdog.py` 拡張
- `nikkei_data_stale` フラグ追加
- `market_data_refreshed_at` / `screener_refreshed_at` の鮮度監視追加

---

## 作業前チェック

作業前に必ず確認すること:

- GitHub Issue #1
- CLAUDE.md
- README.md
- HANDOVER.md
- 現在のブランチ
- 未コミット変更
- 対象ファイル
- 関連Issue

---

## 変更ポリシー

- 指示された範囲以外のファイルは変更しない
- リファクタ目的の変更は禁止
- ライブラリ更新は依頼時のみ
- import整理だけの変更は禁止
- フォーマット変更だけの変更は禁止
- コメントの理由なき削除は禁止
- 最小差分で修正する

---

## 変更禁止事項

以下は禁止:

- 無関係なファイル変更
- 不要な `pages/_document.js` 変更
- 依頼なしの `package.json` 更新
- 依頼なしの `package-lock.json` 更新
- 依頼なしの `.github/workflows` 変更
- 環境変数変更
- Secretsのコミット

---

## コンプライアンス

- `track_record.json` は現時点では非公開の内部データとして扱う
- サイト、X、noteなどで勝率や成績を宣伝利用する場合は、法的確認が済むまで行わない
- AI単独で外部公開判断をしてはならない
- `track_record` データを公開する依頼があった場合は作業を止め、CEOへ確認する

---

## 開発時の注意

- Build確認: `npm run build`
- `.env.local` にはダミー値を入れてよい
- 編集前に影響範囲を確認する
- Build後に差分を確認する
- 大きな変更は分割する
- 定期実行系でClaude APIやDiscord投稿を使わないものは `workflow_dispatch` で手動確認してよい
- Claude APIまたはDiscord投稿を使うスクリプトは、コスト、重複投稿、本番データ更新への影響を確認してから実行する
- `main` への直接pushは禁止し、専用ブランチとPull Requestを使用する
- Pull Request作成前に、意図しないファイル変更が含まれていないことを確認する
- 作業完了後はIssue #1に実施内容、未対応事項、注意点を簡潔に追記する

---

## コミット方針

1コミット = 1目的。

例:

- `fix:`
- `feat:`
- `docs:`

複数目的を1コミットにまとめない。

---

## 完了条件

作業完了とは、以下を満たした状態を指す。

- Build成功
- エラーなし
- 既存機能が壊れていない
- 差分確認済み
- 必要なIssue更新済み
- Pull Request作成済み
- CEOまたは別のレビュー担当による確認待ちの状態である

ドキュメントのみの変更でBuildが不要な場合は、PR本文にその理由を記載する。

---

## AI共通ルール

迷った場合は以下を優先する。

1. システムを止めない
2. データを壊さない
3. 最小差分で修正する
4. 推測で仕様変更しない
5. 不明点はCEOへ確認する

新機能よりも、安定性、保守性、可読性を優先する。
