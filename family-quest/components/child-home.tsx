// =============================================================
// ChildHome：子どもモードのホーム画面。
// 選択中の子ども1人分の情報だけを表示する。
// ミッションのタップはここから onToggleMission 経由で親(page.tsx)に伝える。
// =============================================================

"use client";

import { Flame, Gift, Star, Target } from "lucide-react";
import { Child } from "../lib/dummy-data";
import {
  formatJapaneseDate,
  getCompletedCount,
  getDaysUntilExam,
  getProgressPercent,
  getRewardProgress,
  getTodayMissions,
  getTotalCount,
  withTodayRecord,
} from "../lib/utils";
import MissionList from "./mission-list";
import ProgressBar from "./progress-bar";

type ChildHomeProps = {
  child: Child;
  onToggleMission: (missionId: string) => void;
};

export default function ChildHome({ child, onToggleMission }: ChildHomeProps) {
  // 今日が対象曜日のミッションだけを表示・集計する
  const todaysMissions = getTodayMissions(child.missions);
  const completed = getCompletedCount(todaysMissions);
  const total = getTotalCount(todaysMissions);
  const percent = getProgressPercent(completed, total);
  const isAllClear = total > 0 && completed >= total;
  const daysUntilExam = getDaysUntilExam(child.examDate);
  const reward = getRewardProgress(child.xp);
  const weeklyRecords = withTodayRecord(child.weeklyRecords, completed, total);

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      {/* 5-1 今日の日付 */}
      <p className="text-xs text-gray-400">{formatJapaneseDate(new Date())}</p>

      {/* 5-2 個人目標 */}
      <div className="mt-1 flex items-center gap-2 text-sm text-gray-200">
        <Target size={16} className="shrink-0 text-accent" />
        <p>
          {child.goal}
          {daysUntilExam !== null && (
            <span className="text-gray-400">
              {" "}
              入試まで あと{daysUntilExam}日
            </span>
          )}
        </p>
      </div>

      {/* 5-3 レベルとXP */}
      <section className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">Lv.{child.level}</p>
            <p className="text-xs text-gray-400">{child.levelTitle}</p>
          </div>
          <div className="flex items-center gap-1 text-warn">
            <Star size={18} />
            <span className="text-lg font-bold text-white">{child.xp}</span>
            <span className="text-xs text-gray-400">XP</span>
          </div>
        </div>
      </section>

      {/* 5-4 今日のミッション */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-gray-300">
          今日のミッション
        </h2>
        {todaysMissions.length > 0 ? (
          <MissionList
            missions={todaysMissions}
            interactive
            onToggle={onToggleMission}
          />
        ) : (
          <p className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-gray-400">
            今日は予定されているミッションがありません
          </p>
        )}
      </section>

      {/* 5-5 TODAY PROGRESS */}
      <section className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-300">TODAY PROGRESS</h2>
          <p className="text-sm font-bold">
            {completed}
            <span className="text-xs text-gray-400"> / {total}</span>
          </p>
        </div>
        <ProgressBar
          value={completed}
          max={total}
          colorClassName={isAllClear ? "bg-good" : "bg-accent"}
        />
        {isAllClear && (
          <p className="mt-2 text-center text-sm font-bold text-good">
            TODAY CLEAR！
          </p>
        )}
      </section>

      {/* 5-6 継続記録 */}
      <section className="mt-5 grid grid-cols-3 gap-2">
        <StatCard icon={Flame} label="学習継続" value={`${child.streak}日`} />
        <StatCard icon={Star} label="今月実施" value={`${child.monthlyDays}日`} />
        <StatCard icon={Star} label="自己ベスト" value={`${child.bestStreak}日`} />
      </section>

      {/* 5-7 次のご褒美 */}
      <section className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-300">
          <Gift size={16} className="text-accent" />
          次のご褒美
        </div>
        <ProgressBar
          value={reward.current}
          max={reward.threshold}
          colorClassName="bg-accent"
          valueLabel={`${reward.current} / ${reward.threshold} XP`}
        />
        <p className="mt-2 text-xs text-gray-400">次のご褒美：{reward.label}</p>
      </section>

      {/* 5-8 今週の記録 */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-gray-300">今週の記録</h2>
        <div className="grid grid-cols-7 gap-1">
          {weeklyRecords.map((record) => {
            const cleared = record.total > 0 && record.completed >= record.total;
            return (
              <div
                key={record.day}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 ${
                  record.isToday
                    ? "border-accent bg-accent/10"
                    : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <span className="text-[11px] text-gray-400">{record.day}</span>
                <span
                  className={`text-xs font-bold ${
                    cleared ? "text-good" : "text-gray-200"
                  }`}
                >
                  {record.completed}/{record.total}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-800 bg-neutral-900 py-3">
      <Icon size={16} className="text-accent" />
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
