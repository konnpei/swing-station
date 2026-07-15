# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際に自動で読み込む設定ファイルです。
プロジェクトの背景・現状・運用ルールをここにまとめておくので、作業前に必ず目を通してください。

## プロジェクト概要

- サービス名: SWING STATION（サイト内表示名 "KabuBocchi"）
- 内容: 株式スイングトレード情報を毎朝Discordに自動配信するNext.js + Vercelアプリ
- リポジトリ: `konnpei/swing-station`（public）
- CEO: こんぺい（最終意思決定・環境変数/Vercel/GitHub設定を担当）

## AI分業体制

このプロジェクトは複数のAIが分業している。作業する上で自分の役割を意識すること。

- **Claude（claude.ai、チャット版）**: コード分析・diff作成・ビルド検証を担当。**GitHubへの書き込み権限を持たない（読み取り専用）**ため、実際の適用はできない
- **ChatGPT / Codex**: GitHub Issueへの書き込み・ファイル作成・PR操作を担当。Codex ConnectorがGitHub App経由で書き込み権限を持つ
- **Claude Code（このセッション）**: こんぺいのローカル環境で動作し、git認証を通じて直接commit/pushが可能。実際にコードを適用する役目を担うことが多い

**引き継ぎの仕組み**: GitHub Issue #1（`AI-HANDOFF: Claude / ChatGPT 共有引き継ぎ台帳`）が3者共通の作業台帳になっている。作業を始める前にIssue #1を確認し、作業が完了したら簡潔に追記すること。他のAIが今何をしているか・何が未適用かはここに書いてある想定。

## アーキテクチャ

- Next.js（pages router） + Vercel
- Discord Webhookで朝刊・週次レビュー等を配信
- データはリポジトリ内`data/latest.json`（当日分）と`data/history/YYYY-MM-DD.json`（過去分）に保存し、GitHub API経由でコミットすることでVercelの自動デプロイをトリガーする設計
- `scripts/`配下の各Pythonスクリプトは、GitHub Actionsのcronで定期実行される

### 主要スクリプトと役割

| スクリプト | 役割 | Claude API | Discord投稿 |
|---|---|---|---|
| `morning_briefing.py` | 朝刊フル生成（文章・戦略・推奨銘柄） | 使う | 使う |
| `market_data.py` | 市場データ取得の共有モジュール（他スクリプトからimportされる） | - | - |
| `refresh_market_data.py` | 市場データ（指数・ヒートマップ）だけ再取得 | 使わない | 使わない |
| `refresh_screener.py` | 監視銘柄のスクリーニングだけ再取得 | 使わない | 使わない |
| `refresh_earnings.py` | 決算情報だけ再取得 | 使わない | 使わない |
| `track_record.py` | 過去の推奨銘柄のtarget/stop成否を自動判定・記録 | 使わない | 使わない |
| `briefing_watchdog.py` | 朝刊の実行確認＋データ鮮度の監視、異常時Discord通知 | 使わない | 通知のみ使う |
| `weekly_preview.py` / `weekly_review.py` | 週次のプレビュー・振り返り配信 | 使う | 使う |
| `quality_check.py` | 生成文章の品質チェック | 使う | - |

### 環境変数

- `ANTHROPIC_API_KEY` / `DISCORD_WEBHOOK_MAIN` / `GH_PAT` — GitHub Actions Secretsで管理
- ローカルでビルド確認する場合は、ダミー値を入れた`.env.local`が必要（`npm run build`のため）
- VercelのシークレットとGitHub Actionsのシークレットは別管理

## 現在わかっている懸案事項（2026-07-14時点）

1. **今回まとめて修正したパッチが本番に未適用の可能性がある**（下記参照）。まず現状のリポジトリと照らし合わせて、何が反映済みで何が未反映か確認すること
2. README記載のDiscord週次投稿時刻（日曜7:00 JST）と実際のcron設定（`0 11 * * 0` = 日曜20:00 JST）に不一致がある（未解消）
3. 成績記録機能（`track_record.json`）は**まだ非公開データとして扱うこと**。勝率・リターンを対外的に公開・宣伝に使う場合、日本の金融商品取引法（投資助言業の登録要否）に関わる可能性があるため、公開前に専門家確認が必要という認識で止まっている

## 直近まとめて対応した修正（要確認）

以下はClaude(claude.ai)が2026-07-14のセッションで発見・修正したもの。まだ本番に反映されていない場合は適用し、反映済みの場合はこのセクションは読み飛ばしてよい。

- `strategy_lines`の保存漏れ（`morning_briefing.py`）→ 朝刊の「3行戦略」に挨拶文が混入する原因
- `^N225`データの鮮度チェック欠如（`market_data.py`）→ 日経指数が数日古いまま表示される原因
- `refresh-market-data.yml` / `refresh-screener.yml`が`workflow_dispatch`のみで定期cronが未設定 → ヒートマップ・スクリーニング銘柄が放置され数日古くなる原因
- `track_record.py`（新規）→ 推奨銘柄のtarget/stop成否を5営業日後に自動判定する仕組み。判定ルール: 日足の高値安値ベース、同日に両方到達したら保守的にstop優先、5営業日以内未到達ならタイムアウト（5日目終値で決済とみなす）

## 開発時の注意

- ビルド確認: `.env.local`にダミー値を用意した上で`npm run build`
- コード変更は`sed -i`による一括置換や`str_replace`系ツールでの部分編集を基本とする。変更前に`grep -rn`で影響範囲を確認すること
- こんぺいは**一手ずつの指示・確認を好む**スタイル。大きな変更は分割して途中経過を共有すると喜ばれる
- 定期実行系スクリプト（Claude API・Discordを使わないもの）は、手動で何度実行してもコストや重複投稿の心配がない設計にしてある。動作確認は`workflow_dispatch`で気軽に手動実行してよい
