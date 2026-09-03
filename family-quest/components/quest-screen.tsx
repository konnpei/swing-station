// =============================================================
// QuestScreen：子どもモードの「QUEST」タブ。
// 曜日を問わず、その子に割り当てられた全ミッションを一覧表示する。
// タップでの完了/未完了の切り替えはHOMEと同じくここでも行える
// （本人の画面なので、代理チェックの問題にはならない）。
// =============================================================

"use client";

import { ChevronLeft } from "lucide-react";
import { Child } from "../lib/dummy-data";
import MissionList from "./mission-list";

type QuestScreenProps = {
  child: Child;
  onToggleMission: (missionId: string) => void;
  onClose: () => void;
};

export default function QuestScreen({
  child,
  onToggleMission,
  onClose,
}: QuestScreenProps) {
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

      <h1 className="text-lg font-bold">QUEST</h1>
      <p className="mb-4 text-xs text-gray-400">
        {child.name}に割り当てられている、すべてのミッション一覧です。
      </p>

      {child.missions.length > 0 ? (
        <MissionList
          missions={child.missions}
          interactive
          onToggle={onToggleMission}
          showWeekday
        />
      ) : (
        <p className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-gray-400">
          まだミッションが設定されていません
        </p>
      )}
    </div>
  );
}
