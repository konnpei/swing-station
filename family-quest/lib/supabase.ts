// =============================================================
// FAMILY QUEST - Supabaseクライアント
// =============================================================
// 環境変数（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）が
// 設定されていないときは、Supabaseに繋がずダミーデータのまま動く。
// これにより「.env.localを用意していない人」もSTEP1〜2と同じ体験で
// アプリを起動できる。
// =============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** SupabaseのURLとanonキーが両方設定されているかどうか */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** 設定されていないときはnull。使う側は必ずisSupabaseConfiguredを先に確認する */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
