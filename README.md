# 📈 スイングステーション

数日〜1週間（月〜金）のスイングトレードに特化したAI分析ツール。

## 分析手法
週足でトレンド確認 → 日足で押し目確認 → 60分足エントリーゾーン → 30分足ポイント

## 機能
- 📊 TradingView（日足/60分/30分/週足）+ RSI・MACD・BB自動表示
- 💬 スイング特化AIチャット（Web検索でリアルタイム分析）
- 🔔 毎朝6:30 JST：日米スイング候補をDiscord各チャンネルに通知
- 🗓️ 毎週日曜7:00 JST：週間戦略・ウォッチリストを通知
- ⚡️ 決算サプライズをスイング視点で分析・通知

## Vercelデプロイ手順
1. GitHubにアップロード
2. vercel.com でプロジェクト作成
3. 環境変数を設定（.env.local.example参照）
4. Deploy！

## 環境変数（Vercelに設定）
| Key | 内容 |
|-----|------|
| ANTHROPIC_API_KEY | AnthropicのAPIキー |
| DISCORD_MARKET_WATCH | market-watchチャンネルのWebhook URL |
| DISCORD_JP_STOCKS | jp-stocksチャンネルのWebhook URL |
| DISCORD_US_STOCKS | us-stocksチャンネルのWebhook URL |
| DISCORD_EARNINGS_ALERT | earnings-alertチャンネルのWebhook URL |
| DISCORD_NOTE_CONTENT | note-contentチャンネルのWebhook URL |
| CRON_SECRET | 任意のランダム文字列 |

## Cronスケジュール（JST）
- 毎朝6:30（月〜金）：スイング候補分析
- 毎週日曜7:00：週間戦略レポート
- 5分おき（平日）：決算アラート監視

## コスト
- Vercel：無料
- Claude API：月数百円〜（利用量次第）
- Discord：無料
