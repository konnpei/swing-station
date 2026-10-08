// =============================================================
// SubjectGoalEditor：保護者が「教科別ゴール（受験対策）」を設定するフォーム。
// 「試験日までにやり切りたい残りの総量」を教科ごとに入力すると、
// 子どものホーム画面に1日あたりの必要ペースが表示される。
// 残りの総量が0（未入力）の教科は、ペース表示の対象から外れるだけで
// エラーにはしない（＝すべての教科を設定する必要はない）。
// =============================================================

"use client";

import { useState } from "react";
import { SubjectGoal, SubjectId, SUBJECT_OPTIONS } from "../lib/dummy-data";
import { Field } from "./child-profile-card";

type SubjectGoalEditorProps = {
  subjectGoals: SubjectGoal[];
  onSave: (goals: SubjectGoal[]) => void;
};

type RowValues = { remainingTotal: string; unit: string };

// 「その他」は集計対象がぼやけるため、ゴール設定の対象からは外す
const TRACKABLE_SUBJECTS = SUBJECT_OPTIONS.filter(
  (option) => option.id !== "other"
);

function buildInitialValues(
  subjectGoals: SubjectGoal[]
): Record<SubjectId, RowValues> {
  const values = {} as Record<SubjectId, RowValues>;
  for (const option of TRACKABLE_SUBJECTS) {
    const existing = subjectGoals.find((goal) => goal.subject === option.id);
    values[option.id] = {
      remainingTotal: existing ? String(existing.remainingTotal) : "0",
      unit: existing?.unit ?? "",
    };
  }
  return values;
}

export default function SubjectGoalEditor({
  subjectGoals,
  onSave,
}: SubjectGoalEditorProps) {
  const [values, setValues] = useState(() => buildInitialValues(subjectGoals));
  const [saved, setSaved] = useState(false);

  function handleChange(subject: SubjectId, next: Partial<RowValues>) {
    setValues((prev) => ({ ...prev, [subject]: { ...prev[subject], ...next } }));
    setSaved(false);
  }

  function handleSave() {
    const goals: SubjectGoal[] = TRACKABLE_SUBJECTS.map((option) => {
      const row = values[option.id];
      return {
        subject: option.id,
        remainingTotal: Number(row.remainingTotal) || 0,
        unit: row.unit.trim(),
      };
    }).filter((goal) => goal.remainingTotal > 0 && goal.unit);

    onSave(goals);
    setSaved(true);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-bold text-gray-300">
        教科別ゴール設定（受験対策）
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        試験日までにやり切りたい「残りの総量」を入力すると、ホーム画面に
        1日あたりの必要ペースと実施量のグラフが表示されます。
      </p>

      <div className="flex flex-col gap-3">
        {TRACKABLE_SUBJECTS.map((option) => (
          <div key={option.id} className="flex items-end gap-2">
            <span className="w-16 shrink-0 pb-2 text-xs text-gray-400">
              {option.label}
            </span>
            <Field label="残りの総量">
              <input
                type="number"
                min={0}
                value={values[option.id].remainingTotal}
                onChange={(e) =>
                  handleChange(option.id, { remainingTotal: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </Field>
            <Field label="単位">
              <input
                type="text"
                placeholder="例：個・問"
                value={values[option.id].unit}
                onChange={(e) =>
                  handleChange(option.id, { unit: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </Field>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
      >
        保存する
      </button>
      {saved && <p className="mt-2 text-xs text-good">保存しました</p>}
    </div>
  );
}
