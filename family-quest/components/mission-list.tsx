// =============================================================
// MissionList：今日のミッション一覧。
// interactiveがtrueのとき（子どもモード）だけタップで完了/未完了を切り替えられる。
// 保護者モードではinteractive=falseにして、代理でチェックできないようにする。
// =============================================================

"use client";

import { Check } from "lucide-react";
import { Mission } from "../lib/dummy-data";
import { getIncompleteMissionMessage } from "../lib/utils";

type MissionListProps = {
  missions: Mission[];
  interactive: boolean;
  onToggle?: (missionId: string) => void;
};

export default function MissionList({
  missions,
  interactive,
  onToggle,
}: MissionListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {missions.map((mission, index) => (
        <li key={mission.id}>
          <button
            type="button"
            disabled={!interactive}
            aria-label={`${mission.title} ${
              mission.completed ? "完了済み" : "未完了"
            }`}
            onClick={() => interactive && onToggle?.(mission.id)}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
              mission.completed
                ? "border-good/40 bg-good/10"
                : "border-neutral-800 bg-neutral-900"
            } ${interactive ? "active:scale-[0.99]" : "cursor-default"}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  mission.completed
                    ? "border-good bg-good text-black"
                    : "border-neutral-600 text-transparent"
                }`}
              >
                <Check size={16} strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${
                    mission.completed
                      ? "text-gray-400 line-through"
                      : "text-white"
                  }`}
                >
                  {mission.title}
                </p>
                <p className="text-xs text-gray-500">
                  {mission.completed
                    ? `+${mission.xp} XP 獲得`
                    : getIncompleteMissionMessage(index)}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 text-xs font-semibold ${
                mission.completed ? "text-good" : "text-gray-500"
              }`}
            >
              {mission.xp}XP
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
