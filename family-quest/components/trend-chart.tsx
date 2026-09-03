// =============================================================
// TrendChart：達成率の推移を表す、シンプルな棒グラフ。
// 単一系列（達成率）のみを扱うため、凡例は置かず、タイトルで系列名を示す。
// バーをタップすると、その日の内訳がキャプションに表示される。
// =============================================================

"use client";

import { useState } from "react";
import { TrendPoint } from "../lib/utils";

type TrendChartProps = {
  title: string;
  points: TrendPoint[];
};

export default function TrendChart({ title, points }: TrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex !== null ? points[selectedIndex] : null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="mb-3 text-sm font-bold text-gray-300">{title}</p>

      <div className="flex h-24 items-end gap-1">
        {points.map((point, index) => {
          const heightPercent = Math.max(4, Math.min(100, point.percent));
          const isSelected = index === selectedIndex;
          return (
            <button
              key={`${point.label}-${index}`}
              type="button"
              aria-label={`${point.label} ${point.completed}/${point.total}（${point.percent}%）`}
              onClick={() =>
                setSelectedIndex((current) =>
                  current === index ? null : index
                )
              }
              className="flex h-full flex-1 flex-col items-center justify-end"
            >
              <span
                className={`w-full rounded-t-sm transition-all ${
                  isSelected ? "bg-accent" : "bg-accent/50"
                }`}
                style={{ height: `${heightPercent}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1 text-[9px] text-gray-500">
        {points.map((point, index) => (
          <span key={index} className="flex-1 text-center">
            {index % Math.max(1, Math.ceil(points.length / 8)) === 0
              ? point.label
              : ""}
          </span>
        ))}
      </div>

      <p className="mt-2 min-h-[1rem] text-xs text-gray-400">
        {selected
          ? `${selected.label}：${selected.completed} / ${selected.total}（${selected.percent}%）`
          : "バーをタップすると、その日の内訳が表示されます"}
      </p>
    </div>
  );
}
