# KabuBocchi note下書き自動化（段階1）

## 現状調査（2026-11-22）
- 既存 `scripts/morning_briefing.py` は朝刊を生成し、`data/latest.json` とチャート・バナー・銘柄画像を公開GitHubリポジトリに保存。
- `pages/note.js` は全文コピーと3画像の表示のみ。noteへは送信しない。
- `scripts/quality_check.py` はAIのJSON解釈失敗時に `(True, [])` を返すため、公開・有料化の安全ゲートには使えない。
- リポジトリは **public**。有料記事の全文を `data/latest.json`、`data/history`、公開APIに保存してはいけない。既存 `note_full_text` に有料本文が含まれる場合は公開漏えいの可能性があるため別途監査が必要。

## このPRで追加
`stage_kabubocchi_draft.py` が生成済み朝刊を検査し、Markdownと品質マニフェストを出力する。
手動起動の GitHub Actions は確認用アーティファクトを作るのみ。noteへの送信・公開・有料設定はしない。
不備があれば `NEEDS_REVIEW`。3画像の存在確認は行うが、キャラのデザイン一致を保証しない。

## note連携の制約
note公式ヘルプ（2026-11-11更新）によると、note API は note pro 契約法人かつ対応サービス向け。
現状の対応は StoryHubスタジオで、記事本文・本文中画像の下書き送信が可能。
見出し画像、有料記事設定、公開は非対応。
一般個人アカウントから独自Next.jsアプリで直接API連携できるとは確認されていない。
非公開APIやログインCookieの保存による自動投稿は実装しない。

## 次の段階
1. noteアカウント種別と、公式に利用可能な連携経路を確認。
2. 有料本文と画像を非公開ストレージへ移す。公開APIから切り離し、ログイン認証を追加。
3. 株価・出来高・決算・ニュースの出典/時刻と、損益比計算を機械的に検証。品質ゲートを fail-closed にする。
4. 3枚の独立したクレイ画像を生成し、デザイン一致と欠落を検査。
5. 許可されたnote下書き連携がある場合のみ実装。なければ認証付き管理画面から一括コピーと画像保存で代替。
6. note公開は常に本人承認。

### 実行
GitHub Actions > KabuBocchi Draft Staging (manual) > Run workflow。
成果物は `article.md`, `manifest.json`, `REVIEW.txt`。現時点で「全自動化完了」ではない。
