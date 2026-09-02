// =============================================================
// ChildProfileCard：子どものプロフィール（名前・目標・試験日）を
// 表示・編集するカード。ミッション設定画面と設定画面の両方から使う。
// =============================================================

"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Child, ProfileUpdateInput } from "../lib/dummy-data";

type ProfileFormValues = {
  name: string;
  goal: string;
  examDate: string;
};

function childToProfileFormValues(child: Child): ProfileFormValues {
  return {
    name: child.name,
    goal: child.goal,
    examDate: child.examDate ?? "",
  };
}

type ChildProfileCardProps = {
  child: Child;
  onUpdateProfile: (input: ProfileUpdateInput) => void;
  /** カード右上、編集ボタンの左に追加で表示したいボタン（並び替えなど） */
  extraActions?: React.ReactNode;
};

export default function ChildProfileCard({
  child,
  onUpdateProfile,
  extraActions,
}: ChildProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<ProfileFormValues>(() =>
    childToProfileFormValues(child)
  );
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setValues(childToProfileFormValues(child));
    setError(null);
    setIsEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    const goal = values.goal.trim();

    if (!name || !goal) {
      setError("名前と目標は入力してください");
      return;
    }

    onUpdateProfile({ name, goal, examDate: values.examDate || null });
    setIsEditing(false);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{child.name}</p>
          <p className="text-xs text-gray-500">
            目標：{child.goal}
            {child.examDate && ` ・試験日：${child.examDate}`}
          </p>
        </div>
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1">
            {extraActions}
            <button
              type="button"
              aria-label={`${child.name}のプロフィールを編集`}
              onClick={openForm}
              className="rounded-lg border border-neutral-700 p-2 text-gray-300"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          <Field label="名前">
            <input
              type="text"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="目標">
            <input
              type="text"
              value={values.goal}
              onChange={(e) => setValues({ ...values, goal: e.target.value })}
              placeholder="例：小山台高校"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </Field>
          <Field label="試験日（無ければ空欄のままでOK）">
            <input
              type="date"
              value={values.examDate}
              onChange={(e) =>
                setValues({ ...values, examDate: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </Field>

          {error && <p className="text-xs text-warn">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
            >
              保存する
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-gray-300 active:scale-[0.99]"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}
