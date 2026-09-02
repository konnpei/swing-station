// =============================================================
// SettingsScreen：保護者モードの「SETTINGS」画面。
// - 3人の子どものプロフィール（名前・目標・試験日）をまとめて編集できる
// - 子ども（＝モード切替タブ）の並び順を上下ボタンで変更できる
// - アプリ全体の設定（テーマ・通知など）は、将来ここに追加していく想定の土台
// =============================================================

"use client";

import { ChevronDown, ChevronLeft, ChevronUp, Settings } from "lucide-react";
import { Child, ChildId, ProfileUpdateInput } from "../lib/dummy-data";
import ChildProfileCard from "./child-profile-card";

type SettingsScreenProps = {
  family: Child[];
  onUpdateProfile: (childId: ChildId, input: ProfileUpdateInput) => void;
  onMoveChild: (childId: ChildId, direction: "up" | "down") => void;
  onClose: () => void;
};

export default function SettingsScreen({
  family,
  onUpdateProfile,
  onMoveChild,
  onClose,
}: SettingsScreenProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="保護者ホームに戻る"
        className="mb-3 flex items-center gap-1 text-sm text-gray-400"
      >
        <ChevronLeft size={18} />
        保護者ホームに戻る
      </button>

      <h1 className="text-lg font-bold">SETTINGS</h1>
      <p className="mb-4 text-xs text-gray-400">
        子どものプロフィールと、モード切替の並び順をここで管理できます。
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-gray-300">子どもの管理</h2>
        <p className="mb-2 text-xs text-gray-500">
          上下の矢印で、モード切替タブの並び順を変更できます。
        </p>
        <ul className="flex flex-col gap-2">
          {family.map((child, index) => (
            <li key={child.id}>
              <ChildProfileCard
                child={child}
                onUpdateProfile={(input) => onUpdateProfile(child.id, input)}
                extraActions={
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label={`${child.name}を上に移動`}
                      disabled={index === 0}
                      onClick={() => onMoveChild(child.id, "up")}
                      className="rounded border border-neutral-700 p-0.5 text-gray-300 disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${child.name}を下に移動`}
                      disabled={index === family.length - 1}
                      onClick={() => onMoveChild(child.id, "down")}
                      className="rounded border border-neutral-700 p-0.5 text-gray-300 disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-300">
          アプリ全体の設定
        </h2>
        <div className="flex items-start gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <Settings size={18} className="mt-0.5 shrink-0 text-gray-500" />
          <p className="text-xs text-gray-500">
            テーマ色や通知など、アプリ全体に関わる設定は今後ここに追加していく予定です。
          </p>
        </div>
      </section>
    </div>
  );
}
