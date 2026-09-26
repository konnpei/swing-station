// =============================================================
// SubjectPaceChart：教科別「必要ペース vs 実施量」チャート。
// 1教科=1行のバー。バーの長さが今日の実施量、白い目盛りが1日の必要量を示す
// （＝目盛りより長ければペース達成、短ければ不足）。
// 目盛りとの前後関係だけで判定できる状態表示のため、色は identity ではなく
// 「ペースを満たしているか」の状態色（good/warn）として使う。
// =============================================================

"use client";

import { SubjectPace } from "../lib/utils";

type SubjectPaceChartProps = {
  paces: SubjectPace[];
};

export default function SubjectPaceChart({ paces }: SubjectPaceChartProps) {
  if (paces.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {paces.map((pace) => {
        // 目盛り(必要ペース)と実施量、どちらか大きい方を100%として、
        // もう片方の位置をその比率で表現する（バレットチャートの考え方）
        const scaleMax = Math.max(pace.requiredPerDay, pace.actualToday, 0.0001);
        const fillPercent = Math.min((pace.actualToday / scaleMax) * 100, 100);
        const targetPercent = Math.min((pace.requiredPerDay / scaleMax) * 100, 100);
        const gapLabel =
          pace.gap >= 0
            ? `+${pace.gap}${pace.unit} 余裕`
            : `あと${Math.abs(pace.gap)}${pace.unit} 足りません`;

        return (
          <li key={pace.subject}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-white">{pace.label}</span>
              <span className="text-xs text-gray-400">
                今日 {pace.actualToday}
                {pace.unit} / 必要 {pace.requiredPerDay}
                {pace.unit}
              </span>
            </div>

            <div className="relative h-2.5 w-full rounded-full bg-neutral-800">
              <div
                className={`h-2.5 rounded-full ${
                  pace.isOnPace ? "bg-good" : "bg-warn"
                }`}
                style={{ width: `${fillPercent}%` }}
              />
              {/* 1日の必要量の位置を示す目盛り */}
              <div
                aria-hidden
                className="absolute top-0 h-2.5 w-0.5 bg-white/70"
                style={{ left: `${targetPercent}%` }}
              />
            </div>

            <p
              className={`mt-1 text-xs font-semibold ${
                pace.isOnPace ? "text-good" : "text-warn"
              }`}
            >
              {gapLabel}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
