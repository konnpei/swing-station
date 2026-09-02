// =============================================================
// SettingsScreen：保護者モードの「SETTINGS」画面。
// - 3人の子どものプロフィール（名前・目標・試験日）をまとめて編集できる
// - 子ども（＝モード切替タブ）の並び順を上下ボタンで変更できる
// - アプリ全体の設定（テーマ・通知など）は、将来ここに追加していく想定の土台
// =============================================================

"use client";

import { Check, ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Child, ChildId, ProfileUpdateInput } from "../lib/dummy-data";
import {
  ACCENT_COLOR_OPTIONS,
  loadAccentColorId,
  saveAccentColor,
} from "../lib/theme";
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
  const [accentColorId, setAccentColorId] = useState(() => loadAccentColorId());

  function handleSelectColor(colorId: string) {
    saveAccentColor(colorId);
    setAccentColorId(colorId);
  }

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

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-gray-300">テーマカラー</h2>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-3 text-xs text-gray-500">
            アプリ全体のアクセントカラーを選べます（この端末だけの設定です）。
          </p>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLOR_OPTIONS.map((option) => {
              const isSelected = option.id === accentColorId;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectColor(option.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                    style={{
                      backgroundColor: option.previewHex,
                      borderColor: isSelected ? "#ffffff" : "transparent",
                    }}
                  >
                    {isSelected && <Check size={18} className="text-white" />}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-300">
          アプリ全体の設定
        </h2>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs text-gray-500">
            通知など、その他のアプリ全体設定は今後ここに追加していく予定です。
          </p>
        </div>
      </section>
    </div>
  );
}
