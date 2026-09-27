# Alexa × Family Quest

Alexa標準Shopping List APIは廃止済みのため、Family Quest専用カスタムスキルで共有買い物リストへ追加します。

## Alexa Developer Console
- Skill type: Custom
- Locale: Japanese (ja-JP)
- Invocation name: ファミリークエスト
- HTTPS endpoint: https://family-quest-konpei-s-projects.vercel.app/api/alexa/shopping
- Interaction model: alexa/interaction-model-ja-JP.json

## Vercel
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を設定。
任意で SUPABASE_SERVICE_ROLE_KEY と ALEXA_SKILL_SECRET を設定。

## Supabase
supabase/shopping_items.sql をSQL Editorで1回実行。
