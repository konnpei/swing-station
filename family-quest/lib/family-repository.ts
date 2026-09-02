// =============================================================
// FAMILY QUEST - データの読み書き窓口（Supabase or ダミーデータ）
// =============================================================
// 画面側（page.tsx）は、データがSupabaseから来ているかダミーデータかを
// 気にせずに済むように、ここでまとめて吸収する。
// isSupabaseConfiguredがfalseのときは、保存系の関数は何もしない
// （＝STEP1〜2までと同じ「画面の中だけで完結する」動作になる）。
// =============================================================

import {
  Child,
  ChildId,
  initialFamily,
  Mission,
  NewMissionInput,
  ProfileUpdateInput,
} from "./dummy-data";
import { isSupabaseConfigured, supabase } from "./supabase";

// Supabase側のテーブルの列名はスネークケースにしている（DBの慣習に合わせる）
type ChildRow = {
  id: ChildId;
  name: string;
  level: number;
  level_title: string;
  xp: number;
  streak: number;
  monthly_days: number;
  best_streak: number;
  goal: string;
  exam_date: string | null;
};

type MissionRow = {
  id: string;
  child_id: ChildId;
  title: string;
  category: string;
  target_amount: number;
  unit: string;
  xp: number;
  completed: boolean;
  weekdays: number[];
};

function missionRowToMission(row: MissionRow): Mission {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    targetAmount: row.target_amount,
    unit: row.unit,
    xp: row.xp,
    completed: row.completed,
    weekdays: row.weekdays,
  };
}

/**
 * 家族全員分のデータを読み込む。
 * Supabase未設定、または取得に失敗したときはダミーデータを返す
 * （＝アプリが真っ白にならず、必ず何かしら表示される）。
 *
 * 週間記録（weeklyRecords）はSTEP3時点ではSupabaseに保存しておらず、
 * 引き続き表示用のダミー生成のままにしている（将来の拡張課題）。
 */
export async function loadFamily(): Promise<Child[]> {
  if (!isSupabaseConfigured || !supabase) {
    return initialFamily;
  }

  const [childrenResult, missionsResult] = await Promise.all([
    supabase.from("children").select("*"),
    supabase.from("missions").select("*"),
  ]);

  if (childrenResult.error || missionsResult.error || !childrenResult.data) {
    console.error(
      "Supabaseからの読み込みに失敗したため、ダミーデータを表示します。",
      childrenResult.error ?? missionsResult.error
    );
    return initialFamily;
  }

  const childRows = childrenResult.data as ChildRow[];
  const missionRows = (missionsResult.data ?? []) as MissionRow[];

  return childRows.map((row) => {
    // weeklyRecordsだけはダミーデータ側から引き継ぐ
    const dummyChild = initialFamily.find((c) => c.id === row.id);

    return {
      id: row.id,
      name: row.name,
      level: row.level,
      levelTitle: row.level_title,
      xp: row.xp,
      streak: row.streak,
      monthlyDays: row.monthly_days,
      bestStreak: row.best_streak,
      goal: row.goal,
      examDate: row.exam_date,
      missions: missionRows
        .filter((m) => m.child_id === row.id)
        .map(missionRowToMission),
      weeklyRecords: dummyChild?.weeklyRecords ?? [],
    };
  });
}

/** 子どものXP合計をSupabaseに保存する */
export async function saveChildXp(childId: ChildId, xp: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("children")
    .update({ xp })
    .eq("id", childId);
  if (error) console.error("XPの保存に失敗しました", error);
}

/** 子どものプロフィール（名前・目標・試験日）をSupabaseに保存する */
export async function saveChildProfile(
  childId: ChildId,
  input: ProfileUpdateInput
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("children")
    .update({
      name: input.name,
      goal: input.goal,
      exam_date: input.examDate,
    })
    .eq("id", childId);
  if (error) console.error("プロフィールの保存に失敗しました", error);
}

/** ミッションの完了/未完了をSupabaseに保存する */
export async function saveMissionCompleted(
  missionId: string,
  completed: boolean
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("missions")
    .update({ completed })
    .eq("id", missionId);
  if (error) console.error("ミッション状態の保存に失敗しました", error);
}

/** 新しいミッションをSupabaseに追加する */
export async function insertMission(
  childId: ChildId,
  missionId: string,
  input: NewMissionInput
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from("missions").insert({
    id: missionId,
    child_id: childId,
    title: input.title,
    category: input.category,
    target_amount: input.targetAmount,
    unit: input.unit,
    xp: input.xp,
    completed: false,
    weekdays: input.weekdays,
  });
  if (error) console.error("ミッションの追加に失敗しました", error);
}

/** ミッションの内容（タイトル・XPなど）をSupabaseで更新する */
export async function updateMissionRow(
  missionId: string,
  input: NewMissionInput
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("missions")
    .update({
      title: input.title,
      category: input.category,
      target_amount: input.targetAmount,
      unit: input.unit,
      xp: input.xp,
      weekdays: input.weekdays,
    })
    .eq("id", missionId);
  if (error) console.error("ミッションの更新に失敗しました", error);
}

/** ミッションをSupabaseから削除する */
export async function deleteMissionRow(missionId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from("missions").delete().eq("id", missionId);
  if (error) console.error("ミッションの削除に失敗しました", error);
}
