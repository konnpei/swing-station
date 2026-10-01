# FAMILY QUEST

家族でミッションに取り組む、保護者モード／子どもモード切り替え式のダッシュボードアプリです。
Next.js（App Router）+ TypeScript + Tailwind CSSで作られています。

## セットアップ

```bash
npm install
npm run dev
```

`http://localhost:3000` を開くと確認できます。

## Supabase接続（任意）

`.env.local.example` を `.env.local` にコピーし、SupabaseのProject URLとanonキーを設定すると、
ミッションの状態がSupabase経由で家族の全端末に共有されます。未設定の場合はブラウザの
localStorageにのみ保存されます。

テーブル作成用のSQLは `supabase/schema.sql` にあります。
