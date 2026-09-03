// =============================================================
// ChildSettingsView：子どもモードの「SETTINGS」タブ。
// 自分のプロフィールを見るだけの画面（保護者のような編集権限は無い）。
// =============================================================

"use client";

import { ChevronLeft, Star } from "lucide-react";
import { Child } from "../lib/dummy-data";
import ChildProfileCard from "./child-profile-card";

type ChildSettingsViewProps = {
  child: Child;
  onClose: () => void;
};

export default function ChildSettingsView({
  child,
  onClose,
}: ChildSettingsViewProps) {
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

      <h1 className="text-lg font-bold">SETTINGS</h1>
      <p className="mb-4 text-xs text-gray-400">
        自分のプロフィールです（内容の変更は保護者にお願いしてください）。
      </p>

      <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">Lv.{child.level}</p>
            <p className="text-xs text-gray-400">{child.levelTitle}</p>
          </div>
          <div className="flex items-center gap-1 text-warn">
            <Star size={18} />
            <span className="text-lg font-bold text-white">{child.xp}</span>
            <span className="text-xs text-gray-400">XP</span>
          </div>
        </div>
      </div>

      <ChildProfileCard child={child} readOnly />
    </div>
  );
}
