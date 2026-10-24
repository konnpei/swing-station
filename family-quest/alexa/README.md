# Alexa × Family Quest（家族専用）

Alexa標準リストは使用せず、Custom Skill → HTTPS API → Supabase → SHOPで同期します。
一般向けスキル公開は対象外です。許可したAmazonアカウントだけが同じ家族リストを使います。

## 必須の本番設定

Vercelの **family-quest** プロジェクトだけに設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`: 既存プロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 既存の公開用キー。他機能のため維持
- `SUPABASE_SERVICE_ROLE_KEY`: サーバー専用。Git・画面・ログへ出さない
- `SHOP_PASSWORD`: 家族専用の20文字以上のランダムなパスワード。他サービスと使い回さない
- `ALEXA_SKILL_ID`: 作成したスキルのApplication ID
- `ALEXA_ALLOWED_USER_IDS`: TestのリクエストJSONのcontext.System.user.userId。複数はカンマ区切り

`ALEXA_SKILL_SECRET` / 独自ヘッダーは使いません。必須設定がなければアクセスを拒否します。
SHOPのパスワードは30日間有効なHttpOnly/Secure/SameSite cookieに置き換えられます。
パスワードを変更すると既存のログインは無効になります。短いPINは使用しないでください。

## Supabase

`supabase/shopping_items.sql`をSQL Editorで適用します。既存商品は保持します。
匿名・通常ログイン利用者のテーブル直接アクセスを拒否し、サービスロールのみ許可します。
Alexaの追加はDBトランザクションでrequestIdを記録するため、再送で重複しません。
他のFamily Questテーブルや株サイトの設定は変更しません。

## Alexa Developer Console

1. 既存の作成途中スキルがあれば再利用。名称「ファミリークエスト」、Japanese (Japan)、Custom、Provision your own。
2. JSON Editorへ`alexa/interaction-model-ja-JP.json`を入力しSave/Build。
3. Invocation nameは「ファミリークエスト」。
4. EndpointはHTTPS、`https://family-quest-konpei-s-projects.vercel.app/api/alexa/shopping`。
5. 証明書はVercelのドメインを含むワイルドカード証明書か、実際の提示証明書に合った選択をする。
6. TestをDevelopmentにしてスキルを開く。表示されたリクエストJSONからSkill ID/User IDをVercelに設定して再デプロイ。
   許可ID未設定の最初の呼び出しが拒否されるのは正常です。検証を無効にして回避しない。
7. 同じAmazonアカウントのAlexa実機、日本語設定で試す。

## 検証

- 「ファミリークエストで牛乳追加」→追加応答、DBのsource=alexa、SHOPに牛乳
- 起動後「牛乳追加」「卵追加」「ティッシュ追加」→セッションを継続して追加
- 「ストップ」→終了
- 短い商品名を1回ずつ言う方式が基本。スロット値が読点区切りなら最大10品を一括追加可能。
  「と」は商品名にも含まれるため分割しません。音声の複数商品認識は実機検証が必要です。
- 同一requestIdを再送→重複なし。署名なし/改ざん/古い時刻/未来時刻/異なるSkill ID/User ID→HTTP 400
- SHOP未ログイン→HTTP 401、誤パスワード拒否、ログイン後CRUD、別オリジンからの書込拒否
- Supabaseエラー時に端末保存へ黙って切り替えない。共有リスト表示中は5秒ごとに更新

## 公式仕様

- https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html
- https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/host-web-service.html

公式ask-sdk-express-adapterによるSHA-256署名・証明書SAN・CAチェーン・証明書期限の検証を使用。
さらに正規化した証明書URL、時刻の前後150秒、Skill ID、許可User IDを確認します。
