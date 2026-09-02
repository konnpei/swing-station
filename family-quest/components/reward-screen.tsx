// =============================================================
// RewardScreen：REWARDタブの画面。
// 子どもモードでは自分の「次のご褒美」ゲージを大きく表示する。
// 保護者モードでは、3人分の「次のご褒美」ゲージをまとめて表示する。
// =============================================================

"use client";

import { ChevronLeft, Gift, Star } from "lucide-react";
import { Child } from "../lib/dummy-data";
import { getRewardProgress } from "../lib/utils";
import ProgressBar from "./progress-bar";

type RewardScreenProps = {
  /** 表示する子ども（保護者モードのときは複数、子どもモードのときは1人だけ渡す） */
  family: Child[];
  onClose: () => void;
};

export default function RewardScreen({ family, onClose }: RewardScreenProps) {
  const isSingleChild = family.length === 1;

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

      <h1 className="text-lg font-bold">REWARD</h1>
      <p className="mb-4 text-xs text-gray-400">
        {isSingleChild
          ? "次のご褒美までの道のりです。"
          : "3人それぞれの、次のご褒美までの道のりです。"}
      </p>

      <div className="flex flex-col gap-4">
        {family.map((child) => {
          const reward = getRewardProgress(child.xp);
          return (
            <div
              key={child.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-white">{child.name}</p>
                <span className="flex items-center gap-1 text-xs text-warn">
                  <Star size={14} />
                  {child.xp} XP
                </span>
              </div>

              <ProgressBar
                value={reward.current}
                max={reward.threshold}
                colorClassName="bg-accent"
                valueLabel={`${reward.current} / ${reward.threshold} XP`}
              />

              <div className="mt-3 flex items-center gap-2 text-sm text-gray-300">
                <Gift size={16} className="text-accent" />
                次のご褒美：{reward.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
