// =============================================================
// MissionEditor：保護者モード専用の「ミッション設定」画面。
// 子どものミッションを追加・編集・削除できるが、
// 完了/未完了の状態はここでは変更できない（代理チェック禁止のため）。
// =============================================================

"use client";

import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  ALL_WEEKDAYS,
  Child,
  Mission,
  NewMissionInput,
  ProfileUpdateInput,
  WEEKDAY_OPTIONS,
} from "../lib/dummy-data";
import { formatWeekdays } from "../lib/utils";

type MissionEditorProps = {
  child: Child;
  onAddMission: (input: NewMissionInput) => void;
  onUpdateMission: (missionId: string, input: NewMissionInput) => void;
  onDeleteMission: (missionId: string) => void;
  onUpdateProfile: (input: ProfileUpdateInput) => void;
  onClose: () => void;
};

// プロフィール編集フォームの入力値（試験日は文字列で持ち、空文字はnull扱いにする）
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

// フォームの入力値。数値項目も文字列で持ち、送信時に変換する
type FormValues = {
  title: string;
  category: string;
  targetAmount: string;
  unit: string;
  xp: string;
  weekdays: number[];
};

const EMPTY_FORM: FormValues = {
  title: "",
  category: "",
  targetAmount: "1",
  unit: "",
  xp: "10",
  weekdays: ALL_WEEKDAYS,
};

function missionToFormValues(mission: Mission): FormValues {
  return {
    title: mission.title,
    category: mission.category,
    targetAmount: String(mission.targetAmount),
    unit: mission.unit,
    xp: String(mission.xp),
    weekdays: mission.weekdays,
  };
}

export default function MissionEditor({
  child,
  onAddMission,
  onUpdateMission,
  onDeleteMission,
  onUpdateProfile,
  onClose,
}: MissionEditorProps) {
  // null = フォームを閉じている, "add" = 新規追加, それ以外 = 編集中のミッションID
  const [formTarget, setFormTarget] = useState<"add" | string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // プロフィール（名前・目標・試験日）編集フォームの状態
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileValues, setProfileValues] = useState<ProfileFormValues>(() =>
    childToProfileFormValues(child)
  );
  const [profileError, setProfileError] = useState<string | null>(null);

  function openProfileForm() {
    setProfileValues(childToProfileFormValues(child));
    setProfileError(null);
    setIsEditingProfile(true);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = profileValues.name.trim();
    const goal = profileValues.goal.trim();

    if (!name || !goal) {
      setProfileError("名前と目標は入力してください");
      return;
    }

    onUpdateProfile({
      name,
      goal,
      examDate: profileValues.examDate || null,
    });
    setIsEditingProfile(false);
  }

  function openAddForm() {
    setFormValues(EMPTY_FORM);
    setErrorMessage(null);
    setFormTarget("add");
  }

  function openEditForm(mission: Mission) {
    setFormValues(missionToFormValues(mission));
    setErrorMessage(null);
    setFormTarget(mission.id);
  }

  function closeForm() {
    setFormTarget(null);
    setErrorMessage(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const title = formValues.title.trim();
    const category = formValues.category.trim();
    const unit = formValues.unit.trim();
    const targetAmount = Number(formValues.targetAmount);
    const xp = Number(formValues.xp);

    if (!title || !category || !unit) {
      setErrorMessage("すべての項目を入力してください");
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setErrorMessage("目標の量は1以上の数値にしてください");
      return;
    }
    if (!Number.isFinite(xp) || xp <= 0) {
      setErrorMessage("XPは1以上の数値にしてください");
      return;
    }
    if (formValues.weekdays.length === 0) {
      setErrorMessage("曜日を1つ以上選んでください");
      return;
    }

    const input: NewMissionInput = {
      title,
      category,
      targetAmount,
      unit,
      xp,
      weekdays: formValues.weekdays,
    };

    if (formTarget === "add") {
      onAddMission(input);
    } else if (formTarget) {
      onUpdateMission(formTarget, input);
    }
    closeForm();
  }

  function handleDelete(mission: Mission) {
    const confirmed = window.confirm(
      `「${mission.title}」を削除しますか？この操作は取り消せません。`
    );
    if (confirmed) {
      onDeleteMission(mission.id);
    }
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

      <h1 className="text-lg font-bold">{child.name}のミッション設定</h1>
      <p className="mb-4 text-xs text-gray-400">
        ここでは内容の追加・編集・削除のみ行えます。完了/未完了は本人が切り替えます。
      </p>

      {/* プロフィール（名前・目標・試験日）編集 */}
      <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{child.name}</p>
            <p className="text-xs text-gray-500">
              目標：{child.goal}
              {child.examDate && ` ・試験日：${child.examDate}`}
            </p>
          </div>
          {!isEditingProfile && (
            <button
              type="button"
              aria-label="プロフィールを編集"
              onClick={openProfileForm}
              className="shrink-0 rounded-lg border border-neutral-700 p-2 text-gray-300"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>

        {isEditingProfile && (
          <form
            onSubmit={handleProfileSubmit}
            className="mt-3 flex flex-col gap-2"
          >
            <Field label="名前">
              <input
                type="text"
                value={profileValues.name}
                onChange={(e) =>
                  setProfileValues({ ...profileValues, name: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </Field>
            <Field label="目標">
              <input
                type="text"
                value={profileValues.goal}
                onChange={(e) =>
                  setProfileValues({ ...profileValues, goal: e.target.value })
                }
                placeholder="例：小山台高校"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </Field>
            <Field label="試験日（無ければ空欄のままでOK）">
              <input
                type="date"
                value={profileValues.examDate}
                onChange={(e) =>
                  setProfileValues({
                    ...profileValues,
                    examDate: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </Field>

            {profileError && (
              <p className="text-xs text-warn">{profileError}</p>
            )}

            <div className="mt-1 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
              >
                保存する
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-gray-300 active:scale-[0.99]"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {child.missions.map((mission) => (
          <li
            key={mission.id}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {mission.title}
                  {mission.completed && (
                    <span className="ml-2 rounded-full bg-good/20 px-2 py-0.5 text-[10px] font-semibold text-good">
                      完了中
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {mission.category} ・ {mission.targetAmount}
                  {mission.unit} ・ {mission.xp}XP
                </p>
                <p className="text-xs text-accent">
                  {formatWeekdays(mission.weekdays)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`${mission.title}を編集`}
                  onClick={() => openEditForm(mission)}
                  className="rounded-lg border border-neutral-700 p-2 text-gray-300"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`${mission.title}を削除`}
                  onClick={() => handleDelete(mission)}
                  className="rounded-lg border border-neutral-700 p-2 text-gray-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {formTarget === mission.id && (
              <MissionForm
                values={formValues}
                errorMessage={errorMessage}
                submitLabel="保存する"
                onChange={setFormValues}
                onSubmit={handleSubmit}
                onCancel={closeForm}
              />
            )}
          </li>
        ))}
      </ul>

      {formTarget === "add" ? (
        <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
          <MissionForm
            values={formValues}
            errorMessage={errorMessage}
            submitLabel="追加する"
            onChange={setFormValues}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={openAddForm}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 py-3 text-sm font-medium text-gray-300 active:scale-[0.99]"
        >
          <Plus size={18} />
          ミッションを追加
        </button>
      )}
    </div>
  );
}

// 追加フォームと編集フォームは同じ見た目なので、部品として切り出している
function MissionForm({
  values,
  errorMessage,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: FormValues;
  errorMessage: string | null;
  submitLabel: string;
  onChange: (values: FormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
      <Field label="ミッション名">
        <input
          type="text"
          value={values.title}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
          placeholder="例：漢字 10個"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
        />
      </Field>

      <Field label="カテゴリ">
        <input
          type="text"
          list="mission-category-options"
          value={values.category}
          onChange={(e) => onChange({ ...values, category: e.target.value })}
          placeholder="例：学習"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
        />
        <datalist id="mission-category-options">
          <option value="学校" />
          <option value="学習" />
          <option value="習い事" />
          <option value="運動" />
        </datalist>
      </Field>

      <div className="flex gap-2">
        <Field label="目標の量">
          <input
            type="number"
            min={1}
            value={values.targetAmount}
            onChange={(e) =>
              onChange({ ...values, targetAmount: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="単位">
          <input
            type="text"
            value={values.unit}
            onChange={(e) => onChange({ ...values, unit: e.target.value })}
            placeholder="例：個・分・問"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          />
        </Field>
      </div>

      <Field label="獲得XP">
        <input
          type="number"
          min={1}
          value={values.xp}
          onChange={(e) => onChange({ ...values, xp: e.target.value })}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
        />
      </Field>

      <Field label="表示する曜日">
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_OPTIONS.map((option) => {
            const selected = values.weekdays.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                aria-label={`${option.label}曜日${selected ? "を含める" : "を含めない"}`}
                onClick={() =>
                  onChange({
                    ...values,
                    weekdays: selected
                      ? values.weekdays.filter((v) => v !== option.value)
                      : [...values.weekdays, option.value],
                  })
                }
                className={`h-9 w-9 rounded-lg text-sm font-medium ${
                  selected
                    ? "bg-accent text-white"
                    : "bg-neutral-950 text-gray-400 border border-neutral-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Field>

      {errorMessage && <p className="text-xs text-warn">{errorMessage}</p>}

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99]"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-gray-300 active:scale-[0.99]"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}
