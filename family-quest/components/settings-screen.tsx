// =============================================================
// SettingsScreen：保護者モードの「SETTINGS」画面。
// - 3人の子どものプロフィール（名前・目標・試験日）をまとめて編集できる
// - 子ども（＝モード切替タブ）の並び順を上下ボタンで変更できる
// - 明暗テーマ・テーマカラーなど、アプリ全体の見た目の設定もここで行う
// =============================================================

"use client";

import { Check, ChevronDown, ChevronLeft, ChevronUp, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Child, ChildId, ProfileUpdateInput } from "../lib/dummy-data";
import {
  ACCENT_COLOR_OPTIONS,
  loadAccentColorId,
  loadThemeMode,
  saveAccentColor,
  saveThemeMode,
  ThemeMode,
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());

  function handleSelectColor(colorId: string) {
    saveAccentColor(colorId);
    setAccentColorId(colorId);
  }

  function handleSelectThemeMode(mode: ThemeMode) {
    saveThemeMode(mode);
    setThemeMode(mode);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="保護者ホームに戻る"
        className="mb-3 flex items-center gap-1 text-sm text-ink-muted"
      >
        <ChevronLeft size={18} />
        保護者ホームに戻る
      </button>

      <h1 className="text-lg font-bold">SETTINGS</h1>
      <p className="mb-4 text-xs text-ink-muted">
        子どものプロフィールと、モード切替の並び順をここで管理できます。
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-ink-muted">子どもの管理</h2>
        <p className="mb-2 text-xs text-ink-faint">
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
                      className="rounded border border-strong p-0.5 text-ink-muted disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${child.name}を下に移動`}
                      disabled={index === family.length - 1}
                      onClick={() => onMoveChild(child.id, "down")}
                      className="rounded border border-strong p-0.5 text-ink-muted disabled:opacity-30"
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
        <h2 className="mb-2 text-sm font-bold text-ink-muted">画面の明るさ</h2>
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <p className="mb-3 text-xs text-ink-faint">
            アプリ全体を明るい画面・暗い画面のどちらで使うか選べます（この端末だけの設定です）。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={themeMode === "light"}
              onClick={() => handleSelectThemeMode("light")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${
                themeMode === "light"
                  ? "border-accent bg-accent text-white"
                  : "border-strong text-ink-muted"
              }`}
            >
              <Sun size={16} />
              ライト
            </button>
            <button
              type="button"
              aria-pressed={themeMode === "dark"}
              onClick={() => handleSelectThemeMode("dark")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium ${
                themeMode === "dark"
                  ? "border-accent bg-accent text-white"
                  : "border-strong text-ink-muted"
              }`}
            >
              <Moon size={16} />
              ダーク
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-ink-muted">テーマカラー</h2>
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <p className="mb-3 text-xs text-ink-faint">
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
                      borderColor: isSelected ? "rgb(var(--color-ink-rgb))" : "transparent",
                    }}
                  >
                    {isSelected && <Check size={18} className="text-white" />}
                  </span>
                  <span className="text-[10px] text-ink-muted">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-muted">
          アプリ全体の設定
        </h2>
        <div className="rounded-2xl border border-subtle bg-surface p-4">
          <p className="text-xs text-ink-faint">
            通知など、その他のアプリ全体設定は今後ここに追加していく予定です。
          </p>
        </div>
      </section>
    </div>
  );
}
