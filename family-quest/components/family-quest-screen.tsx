// =============================================================
// FamilyQuestScreen：保護者HOME画面の「Family Questの進捗」カードから
// 開く、家族全体の達成状況を大きく見せる専用画面。
// =============================================================

"use client";

import { ChevronLeft, Trophy } from "lucide-react";
import { Child } from "../lib/dummy-data";
import {
  getFamilyTodayTotals,
  getFamilyWeeklyTrend,
  getProgressPercent,
} from "../lib/utils";
import ProgressBar from "./progress-bar";
import TrendChart from "./trend-chart";

type FamilyQuestScreenProps = {
  family: Child[];
  onClose: () => void;
};

export default function FamilyQuestScreen({
  family,
  onClose,
}: FamilyQuestScreenProps) {
  const totals = getFamilyTodayTotals(family);
  const percent = getProgressPercent(totals.completed, totals.total);
  const weeklyTrend = getFamilyWeeklyTrend(family);

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

      <h1 className="text-lg font-bold">FAMILY QUEST</h1>
      <p className="mb-4 text-xs text-gray-400">
        家族全体の、今日の達成状況です。
      </p>

      <div className="mb-6 flex flex-col items-center rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <Trophy size={32} className="mb-2 text-accent" />
        <p className="text-4xl font-bold text-white">{percent}%</p>
        <p className="mb-4 text-sm text-gray-400">
          {totals.completed} / {totals.total} 達成
        </p>
        <ProgressBar value={totals.completed} max={totals.total} colorClassName="bg-accent" />
      </div>

      <TrendChart title="今週の家族全体の達成率" points={weeklyTrend} />
    </div>
  );
}
