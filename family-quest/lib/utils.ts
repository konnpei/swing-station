// =============================================================
// FAMILY QUEST - 計算用ヘルパー関数
// =============================================================
// 「完了数」「進捗率」「XP」などは、すべてミッションの状態から
// その場で計算する。どこにも二重管理の数値を持たせないのがポイント。
// =============================================================

import {
  Child,
  ChildId,
  Mission,
  WEEKDAY_OPTIONS,
  WeeklyRecord,
} from "./dummy-data";

/** そのミッションが指定した日（曜日）に表示される予定かどうかを判定する */
export function isMissionActiveOn(mission: Mission, date: Date): boolean {
  return mission.weekdays.includes(date.getDay());
}

/** ミッション一覧のうち、指定した日（省略時は今日）に表示すべきものだけを取り出す */
export function getTodayMissions(
  missions: Mission[],
  date: Date = new Date()
): Mission[] {
  return missions.filter((mission) => isMissionActiveOn(mission, date));
}

/** 曜日の配列を「毎日」「月・水・金」のような文字列に変換する */
export function formatWeekdays(weekdays: number[]): string {
  if (weekdays.length >= 7) return "毎日";
  if (weekdays.length === 0) return "曜日未設定";
  return WEEKDAY_OPTIONS.filter((option) => weekdays.includes(option.value))
    .map((option) => option.label)
    .join("・");
}

/** 完了したミッションの数を数える */
export function getCompletedCount(missions: Mission[]): number {
  return missions.filter((m) => m.completed).length;
}

/** ミッションの総数を数える */
export function getTotalCount(missions: Mission[]): number {
  return missions.length;
}

/** 進捗率（0〜100）を計算する。ミッションが0件のときは0を返す */
export function getProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * 状態メッセージを返す（保護者カード・子ども画面共通で使用）。
 * 「失敗」「未達成」のようなネガティブな表現は使わない方針。
 */
export function getStatusMessage(completed: number, total: number): string {
  if (total > 0 && completed >= total) return "TODAY CLEAR！";
  if (total - completed === 1) return "あと1つ！";
  return "今日も前進！";
}

// 未完了ミッションのタップを促す、ポジティブな言い回しのローテーション
const INCOMPLETE_MESSAGES = ["あと1つ！", "今日も前進！", "10分だけでも前進！"];

/** ミッションごとに、未完了時の応援メッセージを決める（indexで固定順に選ぶ） */
export function getIncompleteMissionMessage(index: number): string {
  return INCOMPLETE_MESSAGES[index % INCOMPLETE_MESSAGES.length];
}

/**
 * ミッションを完了/未完了に切り替えたときのXPの増減量を返す。
 * 完了 → 未完了ならマイナス、未完了 → 完了ならプラス。
 */
export function getXpDelta(mission: Mission): number {
  return mission.completed ? -mission.xp : mission.xp;
}

/**
 * ミッションのXP設定値を保護者が編集したときの、子どものXP増減量を返す。
 * すでに完了済みのミッションだけXPに反映する（未完了ならまだ加算されていないため0）。
 */
export function getXpDeltaForEdit(mission: Mission, newXp: number): number {
  return mission.completed ? newXp - mission.xp : 0;
}

/**
 * ミッションを削除したときの、子どものXP増減量を返す。
 * 完了済みミッションを削除する場合は、加算済みだった分を差し引く。
 */
export function getXpDeltaForDelete(mission: Mission): number {
  return mission.completed ? -mission.xp : 0;
}

/** 新しいミッションのIDを作る（子どものIDと現在時刻を組み合わせるだけの単純な方式） */
export function createMissionId(childId: ChildId): string {
  return `${childId}-custom-${Date.now()}`;
}

/** 今日の日付を「2026年8月31日 月曜日」の形式にする */
export function formatJapaneseDate(date: Date): string {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}曜日`;
}

/**
 * 試験日までの残り日数を計算する。
 * 試験日が設定されていない場合はnullを返す。
 * 試験日を過ぎている場合は0を返す（マイナス表示にしない）。
 */
export function getDaysUntilExam(examDate: string | null): number | null {
  if (!examDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(examDate);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 0);
}

/** 次のご褒美までのXPゲージ情報 */
export type RewardProgress = {
  current: number; // 現在の枠内XP
  threshold: number; // ご褒美までに必要なXP
  label: string; // ご褒美の内容
};

/** 1000XPごとにご褒美が発生する想定で、現在の進み具合を計算する */
export function getRewardProgress(xp: number): RewardProgress {
  const threshold = 1000;
  const current = xp % threshold;
  return {
    current,
    threshold,
    label: "ゲーム30分追加",
  };
}

/** 週の記録のうち「今日」の枠を、実際の完了数で上書きした配列を作る */
export function withTodayRecord(
  weeklyRecords: WeeklyRecord[],
  todayCompleted: number,
  todayTotal: number
): WeeklyRecord[] {
  return weeklyRecords.map((record) =>
    record.isToday
      ? { ...record, completed: todayCompleted, total: todayTotal }
      : record
  );
}

/** 家族全員分をまとめて、今日の合計達成数・合計ミッション数を計算する */
export function getFamilyTodayTotals(family: Child[]): {
  completed: number;
  total: number;
} {
  return family.reduce(
    (acc, child) => {
      const todaysMissions = getTodayMissions(child.missions);
      acc.completed += getCompletedCount(todaysMissions);
      acc.total += getTotalCount(todaysMissions);
      return acc;
    },
    { completed: 0, total: 0 }
  );
}

/** グラフ（TrendChart）1点分のデータ */
export type TrendPoint = {
  label: string; // 横軸のラベル（例："9/1"）
  percent: number; // 0〜100
  completed: number;
  total: number;
};

/**
 * 家族全員分の「今週の記録」を、曜日ごとに合算して1つの推移データにする。
 * 「今日」の枠だけは、ダミーの週間記録ではなく実際の合計値で上書きする。
 */
export function getFamilyWeeklyTrend(family: Child[]): TrendPoint[] {
  const weekLength = family[0]?.weeklyRecords.length ?? 0;
  const points: TrendPoint[] = [];

  for (let i = 0; i < weekLength; i++) {
    let completed = 0;
    let total = 0;
    let label = "";
    let isToday = false;

    for (const child of family) {
      const record = child.weeklyRecords[i];
      if (!record) continue;
      label = record.day;
      isToday = record.isToday;
      completed += record.completed;
      total += record.total;
    }

    if (isToday) {
      const liveTotals = getFamilyTodayTotals(family);
      completed = liveTotals.completed;
      total = liveTotals.total;
    }

    points.push({
      label,
      percent: getProgressPercent(completed, total),
      completed,
      total,
    });
  }

  return points;
}
