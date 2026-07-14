# 📈 スイングステーション

数日〜1週間（月〜金）のスイングトレードに特化したAI分析ツール。

## 分析手法
週足でトレンド確認 → 日足で押し目確認 → 60分足エントリーゾーン → 30分足ポイント

## 機能
- 📊 TradingView（日足/60分/30分/週足）+ RSI・MACD・BB自動表示
- 🔔 毎朝6:30 JST：日米スイング候補をDiscord各チャンネルに通知
- 🗓️ 毎週日曜7:00 JST：週間戦略・ウォッチリストを通知
- ⚡️ 決算サプライズをスイング視点で分析・通知

## Vercelデプロイ手順
1. GitHubにアップロード
2. vercel.com でプロジェクト作成
3. 環境変数を設定
4. Deploy！

## 環境変数
| Key | 使用箇所・用途 |
|-----|----------------|
| ANTHROPIC_API_KEY | GitHub ActionsのPythonスクリプトでAIコンテンツを生成するために使用 |
| DISCORD_WEBHOOK_MAIN | GitHub ActionsのPythonスクリプトからDiscordへ投稿するために使用 |
| GH_PAT | GitHub ActionsのPythonスクリプトが`data/latest.json`などをGitHub API経由で更新するために使用 |

現行実装では、`VERCEL_DEPLOY_HOOK`、`KV_REST_API_URL`、`KV_REST_API_TOKEN`、`CRON_SECRET`は使用していません。`refresh-market-data.yml`には`VERCEL_DEPLOY_HOOK`の受け渡しが残っていますが、`refresh_market_data.py`側の呼び出しは削除済みです。

## Cronスケジュール（JST）
- 毎朝6:30（月〜金）：スイング候補分析
- 毎週日曜7:00：週間戦略レポート
- 5分おき（平日）：決算アラート監視

## コスト
- Vercel：無料
- Claude API：月数百円〜（利用量次第）
- Discord：無料
