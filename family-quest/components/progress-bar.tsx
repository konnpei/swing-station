// =============================================================
// ProgressBar：達成率などを表す横棒のゲージ。
// どの画面でも使い回せるように、色とラベルだけを外から渡す。
// =============================================================

type ProgressBarProps = {
  /** 現在値 */
  value: number;
  /** 最大値 */
  max: number;
  /** バーの色（Tailwindの背景色クラス） */
  colorClassName?: string;
  /** バーの上に出すラベル（省略可） */
  label?: string;
  /** バーの右側に出す数値表示（省略可） */
  valueLabel?: string;
};

export default function ProgressBar({
  value,
  max,
  colorClassName = "bg-accent",
  label,
  valueLabel,
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="w-full">
      {(label || valueLabel) && (
        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
          {label && <span>{label}</span>}
          {valueLabel && <span>{valueLabel}</span>}
        </div>
      )}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${colorClassName} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
