-- =============================================================
-- FAMILY QUEST - Supabase スキーマ定義
-- =============================================================
-- Supabaseダッシュボードの「SQL Editor」でこのファイルの内容を
-- 貼り付けて実行すると、テーブル作成・初期データ投入まで完了する。
--
-- 注意（重要）：
-- このアプリはSTEP3時点でログイン機能を実装していないため、
-- 下記のRLSポリシーは「anon（未ログイン）キーからの全操作を許可」する
-- 設定にしている。家族内だけで使う前提なら実用上問題ないことが多いが、
-- URLとanonキーを知っていれば誰でも読み書きできる状態になる点は
-- 必ず理解した上で利用すること。将来ログインを追加する場合は、
-- ポリシーをauth.uid()ベースの条件に置き換える。
-- =============================================================

-- ---------------------------------------------------------------
-- テーブル作成
-- ---------------------------------------------------------------

create table if not exists children (
  id text primary key,
  name text not null,
  level integer not null default 1,
  level_title text not null default '',
  xp integer not null default 0,
  streak integer not null default 0,
  monthly_days integer not null default 0,
  best_streak integer not null default 0,
  goal text not null default '',
  exam_date date
);

create table if not exists missions (
  id text primary key,
  child_id text not null references children (id) on delete cascade,
  title text not null,
  category text not null,
  target_amount integer not null default 1,
  unit text not null default '',
  xp integer not null default 10,
  completed boolean not null default false,
  -- 0=日,1=月,2=火,3=水,4=木,5=金,6=土。7つ全部で「毎日」
  weekdays integer[] not null default '{0,1,2,3,4,5,6}'
);

-- ---------------------------------------------------------------
-- RLS（行レベルセキュリティ）
-- ログイン機能がない前提で、anonキーからの全操作を許可する
-- ---------------------------------------------------------------

alter table children enable row level security;
alter table missions enable row level security;

drop policy if exists "allow anon full access to children" on children;
create policy "allow anon full access to children"
  on children for all
  using (true)
  with check (true);

drop policy if exists "allow anon full access to missions" on missions;
create policy "allow anon full access to missions"
  on missions for all
  using (true)
  with check (true);

-- ---------------------------------------------------------------
-- 初期データ（lib/dummy-data.tsの内容と同じ）
-- 既に同じidの行がある場合は何もしない
-- ---------------------------------------------------------------

insert into children (id, name, level, level_title, xp, streak, monthly_days, best_streak, goal, exam_date)
values
  ('eldest', '長男', 5, '基礎固め', 850, 10, 18, 14, '小山台高校', '2025-12-01'),
  ('eldest-daughter', '長女', 4, '継続の達人', 620, 7, 15, 11, '英語力アップ', null),
  ('youngest', '次男', 3, '習慣化中', 410, 5, 12, 8, '毎日少しずつ挑戦', null)
on conflict (id) do nothing;

insert into missions (id, child_id, title, category, target_amount, unit, xp, completed, weekdays)
values
  ('eldest-homework', 'eldest', '学校宿題', '学校', 1, '回', 30, true, '{0,1,2,3,4,5,6}'),
  ('eldest-tablet', 'eldest', 'タブレット学習 2講座', '学習', 2, '講座', 40, true, '{0,1,2,3,4,5,6}'),
  ('eldest-kanji', 'eldest', '漢字 10個', '学習', 10, '個', 20, true, '{0,1,2,3,4,5,6}'),
  ('eldest-eitango', 'eldest', '英単語 10個', '学習', 10, '個', 20, true, '{0,1,2,3,4,5,6}'),
  ('eldest-english', 'eldest', '英語 5問', '学習', 5, '問', 25, false, '{0,1,2,3,4,5,6}'),
  ('eldest-math', 'eldest', '数学 5問', '学習', 5, '問', 25, false, '{0,1,2,3,4,5,6}'),

  ('daughter-homework', 'eldest-daughter', '学校宿題', '学校', 1, '回', 30, true, '{0,1,2,3,4,5,6}'),
  ('daughter-tablet', 'eldest-daughter', 'タブレット学習 2講座', '学習', 2, '講座', 40, true, '{0,1,2,3,4,5,6}'),
  ('daughter-english', 'eldest-daughter', '英語 10分', '学習', 10, '分', 20, true, '{0,1,2,3,4,5,6}'),
  ('daughter-piano', 'eldest-daughter', 'ピアノ 20分', '習い事', 20, '分', 20, true, '{0,1,2,3,4,5,6}'),
  ('daughter-reading', 'eldest-daughter', '読書 15分', '学習', 15, '分', 15, true, '{0,1,2,3,4,5,6}'),

  ('youngest-homework', 'youngest', '学校宿題', '学校', 1, '回', 30, true, '{0,1,2,3,4,5,6}'),
  ('youngest-tablet', 'youngest', 'タブレット学習 1講座', '学習', 1, '講座', 25, true, '{0,1,2,3,4,5,6}'),
  ('youngest-reading-aloud', 'youngest', '音読 10分', '学習', 10, '分', 15, true, '{0,1,2,3,4,5,6}'),
  ('youngest-kanji', 'youngest', '漢字 5個', '学習', 5, '個', 15, false, '{0,1,2,3,4,5,6}')
on conflict (id) do nothing;
