// =============================================================
// ModeSwitcher：保護者モードと、子ども3人のモードを切り替えるボタン群。
// STEP1では「今どのモードを見ているか」を切り替えるだけのシンプルな作り。
// =============================================================

import { Child, Mode } from "../lib/dummy-data";

type ModeSwitcherProps = {
  family: Child[];
  currentMode: Mode;
  onChangeMode: (mode: Mode) => void;
};

export default function ModeSwitcher({
  family,
  currentMode,
  onChangeMode,
}: ModeSwitcherProps) {
  return (
    <div
      className="flex w-full gap-2 overflow-x-auto px-4 pb-1 pt-3"
      role="tablist"
      aria-label="モード切り替え"
    >
      <ModeButton
        label="保護者モード"
        active={currentMode === "parent"}
        onClick={() => onChangeMode("parent")}
      />
      {family.map((child) => (
        <ModeButton
          key={child.id}
          label={`${child.name}モード`}
          active={currentMode === child.id}
          onClick={() => onChangeMode(child.id)}
        />
      ))}
    </div>
  );
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}
