// =============================================================
// ChildrenScreen：保護者モードの「CHILDREN」タブ。
// 3人の子どもを、シンプルな一覧として表示する。
// 家族全体の合計やミッション編集はHOME側の役割なので、ここには置かない。
// =============================================================

"use client";

import { ChevronLeft, ChevronRight, Flame, Star } from "lucide-react";
import { Child, ChildId } from "../lib/dummy-data";
import {
  getCompletedCount,
  getProgressPercent,
  getTodayMissions,
  getTotalCount,
} from "../lib/utils";
import ProgressBar from "./progress-bar";

type ChildrenScreenProps = {
  family: Child[];
  onViewChild: (childId: ChildId) => void;
  onClose: () => void;
};

export default function ChildrenScreen({
  family,
  onViewChild,
  onClose,
}: ChildrenScreenProps) {
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

      <h1 className="text-lg font-bold">CHILDREN</h1>
      <p className="mb-4 text-xs text-gray-400">3人の子ども一覧です。</p>

      <ul className="flex flex-col gap-3">
        {family.map((child) => {
          const todaysMissions = getTodayMissions(child.missions);
          const completed = getCompletedCount(todaysMissions);
          const total = getTotalCount(todaysMissions);
          const percent = getProgressPercent(completed, total);

          return (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onViewChild(child.id)}
                aria-label={`${child.name}の詳細を見る`}
                className="flex w-full flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-left active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-white">
                    {child.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-gray-300">
                      Lv.{child.level}
                    </span>
                    <ChevronRight size={16} className="text-gray-500" />
                  </div>
                </div>

                <ProgressBar
                  value={completed}
                  max={total}
                  colorClassName={percent >= 100 ? "bg-good" : "bg-accent"}
                  valueLabel={`${completed} / ${total}`}
                />

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Star size={14} className="text-warn" />
                    {child.xp} XP
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame size={14} className="text-accent" />
                    継続 {child.streak}日
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
