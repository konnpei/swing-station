// =============================================================
// FAMILY QUEST - 月間カレンダー用のヘルパー関数
// =============================================================
// STEP4時点では過去日の達成記録をDBに保存していないため、
// 「今日」だけは実データ、それより前の日はダミーの疑似ランダム値、
// 未来の日はまだデータなし（null）として表示する。
// 将来Supabaseに履歴テーブルを追加すれば、ここを実データ取得に
// 差し替えるだけで良いようにしている。
// =============================================================

import { Child, WEEKDAY_OPTIONS } from "./dummy-data";
import { getCompletedCount, getTodayMissions, getTotalCount } from "./utils";

/** カレンダー1マス分のデータ */
export type DayRecord = {
  day: number; // 何日か（1〜31）
  weekday: number; // 0=日,1=月,...6=土
  isToday: boolean;
  isFuture: boolean; // 今日より後の日（まだデータがない）
  total: number; // その日に予定されていたミッション数
  completed: number | null; // 達成数。isFutureのときはnull
};

/** 子どものIDと日付から、毎回同じ値になる疑似ランダムな達成数を作る */
function pseudoRandomCompleted(seed: string, total: number): number {
  if (total <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  const fraction = Math.abs(Math.sin(hash)) % 1;
  return Math.max(0, Math.min(total, Math.round(fraction * total)));
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 指定した子ども・指定した月（省略時は今月）の、1日ごとの記録一覧を作る。
 */
export function getMonthlyRecords(
  child: Child,
  referenceDate: Date = new Date()
): DayRecord[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const records: DayRecord[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayMissions = getTodayMissions(child.missions, date);
    const total = getTotalCount(dayMissions);
    const isToday = isSameDate(date, referenceDate);
    const isFuture = date.getTime() > today.getTime();

    let completed: number | null;
    if (isFuture) {
      completed = null;
    } else if (isToday) {
      completed = getCompletedCount(dayMissions);
    } else {
      completed = pseudoRandomCompleted(`${child.id}-${day}`, total);
    }

    records.push({
      day,
      weekday: date.getDay(),
      isToday,
      isFuture,
      total,
      completed,
    });
  }
  return records;
}

/** カレンダーの月見出し用（例：「2026年9月」） */
export function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/** 月始まり（月〜日）の曜日ラベル一覧。カレンダーの見出し行に使う */
export const CALENDAR_WEEKDAY_LABELS = WEEKDAY_OPTIONS.map((o) => o.label);

/**
 * 1日の曜日（0=日,...6=土）から、月曜はじまりの列位置（0〜6）を返す。
 * カレンダーの1日目を正しい曜日の列に配置するために使う。
 */
export function toMondayFirstColumn(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}
