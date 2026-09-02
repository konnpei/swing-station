// =============================================================
// FamilyDashboard：保護者モードのホーム画面。
// 3人の子どものカードと、家族全体の合計を表示する。
// 保護者モードではミッションの完了状態を変更できない（表示のみ）。
// =============================================================

"use client";

import {
  ChevronRight,
  Flame,
  Pencil,
  Share2,
  Star,
  Trophy,
} from "lucide-react";
import { Child, ChildId } from "../lib/dummy-data";
import {
  getCompletedCount,
  getFamilyTodayTotals,
  getProgressPercent,
  getStatusMessage,
  getTodayMissions,
  getTotalCount,
} from "../lib/utils";
import ProgressBar from "./progress-bar";

type FamilyDashboardProps = {
  family: Child[];
  onViewChild: (childId: ChildId) => void;
  onEditMissions: (childId: ChildId) => void;
  onOpenFamilyQuest: () => void;
  onShare: () => void;
};

export default function FamilyDashboard({
  family,
  onViewChild,
  onEditMissions,
  onOpenFamilyQuest,
  onShare,
}: FamilyDashboardProps) {
  const familyTotals = getFamilyTodayTotals(family);
  const familyPercent = getProgressPercent(
    familyTotals.completed,
    familyTotals.total
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-wide">FAMILY QUEST</h1>
        <p className="text-sm text-gray-400">家族ダッシュボード</p>
      </header>

      {/* 家族全体の合計 */}
      <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">今日の家族合計</p>
            <p className="text-xl font-bold">
              {familyTotals.completed}
              <span className="text-sm text-gray-400">
                {" "}
                / {familyTotals.total}
              </span>
            </p>
          </div>
          <Trophy className="text-accent" size={28} />
        </div>

        <button
          type="button"
          onClick={onOpenFamilyQuest}
          aria-label="Family Questの詳細を見る"
          className="w-full text-left"
        >
          <ProgressBar
            value={familyTotals.completed}
            max={familyTotals.total}
            colorClassName="bg-accent"
            label="Family Questの進捗（タップで詳細）"
            valueLabel={`${familyPercent}%`}
          />
        </button>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-800/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-warn" />
            <p className="text-xs text-gray-300">
              今週の家族目標：みんなでミッション達成を続けよう
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="今日の家族結果を共有"
          onClick={onShare}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white active:scale-[0.99]"
        >
          <Share2 size={18} />
          今日の家族結果を共有
        </button>
      </section>

      {/* 子どもカード一覧 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {family.map((child) => (
          <ChildCard
            key={child.id}
            child={child}
            onViewChild={onViewChild}
            onEditMissions={onEditMissions}
          />
        ))}
      </section>
    </div>
  );
}

function ChildCard({
  child,
  onViewChild,
  onEditMissions,
}: {
  child: Child;
  onViewChild: (childId: ChildId) => void;
  onEditMissions: (childId: ChildId) => void;
}) {
  const todaysMissions = getTodayMissions(child.missions);
  const completed = getCompletedCount(todaysMissions);
  const total = getTotalCount(todaysMissions);
  const percent = getProgressPercent(completed, total);
  const statusMessage = getStatusMessage(completed, total);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{child.name}</h2>
        <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-gray-300">
          Lv.{child.level}
        </span>
      </div>

      <p className="text-2xl font-bold">
        {completed}
        <span className="text-sm text-gray-400"> / {total}</span>
      </p>

      <ProgressBar
        value={completed}
        max={total}
        colorClassName={percent >= 100 ? "bg-good" : "bg-accent"}
      />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Star size={14} className="text-warn" />
          {child.xp} XP
        </span>
        <span className="flex items-center gap-1">
          <Flame size={14} className="text-accent" />
          継続 {child.streak}日
        </span>
      </div>

      <p
        className={`text-sm font-semibold ${
          percent >= 100 ? "text-good" : "text-gray-300"
        }`}
      >
        {statusMessage}
      </p>

      <button
        type="button"
        aria-label={`${child.name}の詳細を見る`}
        onClick={() => onViewChild(child.id)}
        className="mt-1 flex items-center justify-center gap-1 rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-gray-200 active:scale-[0.99]"
      >
        子どもの詳細を見る
        <ChevronRight size={16} />
      </button>

      <button
        type="button"
        aria-label={`${child.name}のミッションを編集`}
        onClick={() => onEditMissions(child.id)}
        className="flex items-center justify-center gap-1 rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-gray-200 active:scale-[0.99]"
      >
        <Pencil size={16} />
        ミッションを編集
      </button>
    </div>
  );
}
