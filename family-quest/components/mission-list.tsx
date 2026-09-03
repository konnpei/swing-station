// =============================================================
// MissionList：今日のミッション一覧。
// interactiveがtrueのとき（子どもモード）だけタップで完了/未完了を切り替えられる。
// 保護者モードではinteractive=falseにして、代理でチェックできないようにする。
// =============================================================

"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Mission } from "../lib/dummy-data";
import { formatWeekdays, getIncompleteMissionMessage } from "../lib/utils";

type MissionListProps = {
  missions: Mission[];
  interactive: boolean;
  onToggle?: (missionId: string) => void;
  /** trueのとき、各ミッションに「毎日」「月・水・金」などの曜日タグを表示する */
  showWeekday?: boolean;
};

export default function MissionList({
  missions,
  interactive,
  onToggle,
  showWeekday = false,
}: MissionListProps) {
  // 完了にした直後だけ、控えめなアニメーションを付けるためのミッションID
  const [poppedId, setPoppedId] = useState<string | null>(null);

  function handleClick(mission: Mission) {
    if (!interactive) return;
    if (!mission.completed) {
      // 未完了→完了への切り替えのときだけアニメーションさせる
      setPoppedId(mission.id);
      window.setTimeout(() => {
        setPoppedId((current) => (current === mission.id ? null : current));
      }, 320);
    }
    onToggle?.(mission.id);
  }

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
            onClick={() => handleClick(mission)}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
              mission.completed
                ? "border-good/40 bg-good/10"
                : "border-neutral-800 bg-neutral-900"
            } ${interactive ? "active:scale-[0.99]" : "cursor-default"} ${
              poppedId === mission.id ? "animate-mission-pop" : ""
            }`}
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
                {showWeekday && (
                  <p className="text-xs text-accent">
                    {formatWeekdays(mission.weekdays)}
                  </p>
                )}
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
