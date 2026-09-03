// =============================================================
// CalendarScreen：CALENDARタブの画面。
// 月間カレンダーで、1日ごとの達成状況を表示する。
// 保護者モードでは、上部で見たい子どもを選べる。
// =============================================================

"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Child, ChildId } from "../lib/dummy-data";
import {
  CALENDAR_WEEKDAY_LABELS,
  formatYearMonth,
  getMonthlyRecords,
  toMondayFirstColumn,
} from "../lib/calendar-utils";
import { getProgressPercent, TrendPoint } from "../lib/utils";
import TrendChart from "./trend-chart";

type CalendarScreenProps = {
  family: Child[];
  /** 表示中の子どものID（子どもモードのときは、その本人固定） */
  initialChildId: ChildId;
  /** 保護者モードのときだけ、子どもを切り替えられるようにする */
  allowChildSwitch: boolean;
  onClose: () => void;
};

export default function CalendarScreen({
  family,
  initialChildId,
  allowChildSwitch,
  onClose,
}: CalendarScreenProps) {
  const [selectedId, setSelectedId] = useState<ChildId>(initialChildId);
  const child = family.find((c) => c.id === selectedId) ?? family[0];

  const today = new Date();
  const records = getMonthlyRecords(child, today);
  // カレンダーの1マス目を正しい曜日の位置に置くための空白セル数
  const leadingBlankCount = toMondayFirstColumn(
    new Date(today.getFullYear(), today.getMonth(), 1).getDay()
  );

  // 月間の達成率推移グラフ用に、データがある日（今日まで）だけを取り出す
  const trendPoints: TrendPoint[] = records
    .filter((record) => record.completed !== null)
    .map((record) => ({
      label: `${record.day}日`,
      percent: getProgressPercent(record.completed ?? 0, record.total),
      completed: record.completed ?? 0,
      total: record.total,
    }));

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="ホームに戻る"
        className="mb-3 flex items-center gap-1 text-sm text-gray-400"
      >
        <ChevronLeft size={18} />
        ホームに戻る
      </button>

      <h1 className="text-lg font-bold">CALENDAR</h1>
      <p className="mb-4 text-xs text-gray-400">
        {formatYearMonth(today)}の達成状況（{child.name}）
      </p>

      {allowChildSwitch && family.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {family.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              aria-pressed={c.id === selectedId}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                c.id === selectedId
                  ? "bg-accent text-white"
                  : "bg-neutral-800 text-gray-300"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
        {CALENDAR_WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlankCount }).map((_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {records.map((record) => {
          const cleared =
            record.completed !== null &&
            record.total > 0 &&
            record.completed >= record.total;
          const hasSome = record.completed !== null && record.completed > 0;

          return (
            <div
              key={record.day}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-[11px] ${
                record.isToday
                  ? "border-accent"
                  : "border-neutral-800"
              } ${
                record.isFuture
                  ? "bg-neutral-950 text-gray-600"
                  : cleared
                    ? "bg-good/20 text-good"
                    : hasSome
                      ? "bg-accent/10 text-gray-200"
                      : "bg-neutral-900 text-gray-500"
              }`}
            >
              <span className="font-semibold">{record.day}</span>
              {record.completed !== null && (
                <span className="text-[9px]">
                  {record.completed}/{record.total}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-good/20" />
          全達成
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-accent/10" />
          一部達成
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-neutral-900" />
          未達成
        </span>
      </div>

      {trendPoints.length > 0 && (
        <div className="mt-4">
          <TrendChart title="月間の達成率推移" points={trendPoints} />
        </div>
      )}
    </div>
  );
}
