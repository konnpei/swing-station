// =============================================================
// GoogleCalendarPanel：CALENDAR画面に表示するGoogle予定パネル。
// TimeTreeのような「横スクロールの日付帯＋日付ごとにまとめた予定一覧」の
// 見た目に寄せている（データ取得・接続の仕組み自体は変更していない）。
// このパネルだけ、本物のTimeTreeに近い明るい配色にしている
// （アプリ全体はダークテーマのままなので、ここだけ意図的に浮いて見える）。
// =============================================================

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Event = {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  htmlLink?: string;
};
type Status = "loading" | "ready" | "login" | "setup" | "error";

const DATE_STRIP_DAYS = 14;

/** Asia/Tokyo基準の「YYYY-MM-DD」を返す（終日予定の日付文字列ともそのまま比較できる） */
function tokyoDateKey(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

function eventDateKey(e: Event): string {
  // 終日予定はもともと「YYYY-MM-DD」なのでそのまま使う
  return e.allDay ? e.start : tokyoDateKey(new Date(e.start));
}

export default function GoogleCalendarPanel() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [callbackError, setCallbackError] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLLIElement | null>>({});

  async function refresh() {
    setStatus("loading");
    try {
      const r = await fetch("/api/google/events", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) {
        setEvents([]);
        setStatus(
          data.error === "setup_required"
            ? "setup"
            : data.error === "login_required"
              ? "login"
              : "error"
        );
        return;
      }
      setEvents(data.events);
      setHasMore(data.hasMore);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    setCallbackError(new URLSearchParams(window.location.search).get("google") === "error");
    void refresh();
  }, []);

  async function disconnect() {
    const r = await fetch("/api/google/disconnect", { method: "POST" });
    if (r.ok) {
      setEvents([]);
      setStatus("login");
    } else setStatus("error");
  }

  // 今日から2週間ぶんの日付帯（TimeTreeの横スクロール日付帯に相当）
  const dateStrip = useMemo(() => {
    const today = new Date();
    const todayKey = tokyoDateKey(today);
    return Array.from({ length: DATE_STRIP_DAYS }).map((_, index) => {
      const date = new Date(today.getTime() + index * 86_400_000);
      const key = tokyoDateKey(date);
      return {
        key,
        isToday: key === todayKey,
        weekdayLabel: new Intl.DateTimeFormat("ja-JP", {
          timeZone: "Asia/Tokyo",
          weekday: "short",
        }).format(date),
        dayNumber: new Intl.DateTimeFormat("ja-JP", {
          timeZone: "Asia/Tokyo",
          day: "numeric",
        }).format(date),
      };
    });
  }, []);

  // 予定を日付ごとにまとめる（TimeTreeの「日付見出し＋その日の予定」表示に相当）
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, Event[]>();
    for (const event of events) {
      const key = eventDateKey(event);
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
  }, [events]);

  const eventDateKeys = useMemo(() => new Set(groupedEvents.map((g) => g.key)), [groupedEvents]);

  function dateHeaderLabel(key: string) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", weekday: "short" }).format(date);
    return `${month}/${day}（${weekday}）`;
  }

  function timeLabel(e: Event) {
    if (e.allDay) return "終日";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(e.start));
  }

  function handleDateChipClick(key: string) {
    setSelectedDateKey(key);
    groupRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <section
      className="my-4 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm"
      aria-label="Googleカレンダーの予定"
    >
      <h2 className="font-bold">Googleカレンダーの予定</h2>
      <p className="mt-1 text-xs text-gray-500">今日から2週間・日本時間</p>

      {status === "ready" && (
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {dateStrip.map((day) => {
            const hasEvents = eventDateKeys.has(day.key);
            const isSelected = selectedDateKey === day.key;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => handleDateChipClick(day.key)}
                disabled={!hasEvents}
                aria-current={day.isToday ? "date" : undefined}
                aria-pressed={isSelected}
                aria-label={`${day.weekdayLabel}曜日 ${day.dayNumber}日${hasEvents ? "・予定あり" : ""}`}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-center ${
                  isSelected
                    ? "bg-accent text-white"
                    : day.isToday
                      ? "border border-accent text-accent"
                      : "border border-gray-200 text-gray-600"
                } ${!hasEvents ? "opacity-40" : ""}`}
              >
                <span className="text-[10px] leading-none">{day.weekdayLabel}</span>
                <span className="text-sm font-semibold leading-none">{day.dayNumber}</span>
                <span
                  className={`mt-0.5 h-1 w-1 rounded-full ${
                    hasEvents ? (isSelected ? "bg-white" : "bg-accent") : "bg-transparent"
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      )}

      <div role="status" className="my-3 text-sm text-gray-600">
        {status === "loading" && "予定を確認中…"}
        {status === "setup" && "Google連携の設定を準備中です。設定完了後に接続できます。"}
        {status === "login" && "Googleアカウントを接続すると予定が表示されます。"}
        {status === "error" && "予定を取得できませんでした。再読み込み、またはGoogleアカウントを再接続してください。"}
        {callbackError && status !== "ready" && <p className="mt-2">接続を完了できませんでした。もう一度接続してください。</p>}
        {status === "ready" && events.length === 0 && "この期間の予定はありません。"}
      </div>

      {status === "ready" && groupedEvents.length > 0 && (
        <ul className="flex flex-col gap-3">
          {groupedEvents.map((group) => (
            <li
              key={group.key}
              ref={(el) => {
                groupRefs.current[group.key] = el;
              }}
              className={`rounded-xl px-1 ${
                selectedDateKey === group.key ? "bg-accent/10" : ""
              }`}
            >
              <p className="px-2 pb-1.5 pt-2 text-xs font-semibold text-gray-500">
                {dateHeaderLabel(group.key)}
              </p>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((e) => (
                  <li
                    key={e.id}
                    className="flex gap-2 rounded-lg border-l-2 border-accent bg-gray-50 px-2.5 py-2"
                  >
                    <span className="shrink-0 text-xs text-gray-500">{timeLabel(e)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{e.title}</span>
                    {e.htmlLink?.startsWith("https://www.google.com/calendar/") && (
                      <a
                        className="shrink-0 text-xs text-accent underline"
                        href={e.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Googleで開く
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {status === "ready" && hasMore && (
        <p className="my-2 text-xs text-gray-500">先頭250件を表示しています。残りはGoogleカレンダーで確認できます。</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {status !== "setup" && status !== "ready" && status !== "loading" && (
          <a href="/api/google/auth" className="rounded-xl bg-accent px-3 py-2 font-medium text-white">
            Googleカレンダーを接続
          </a>
        )}
        <button
          type="button"
          disabled={status === "loading"}
          className="rounded-xl border border-gray-300 px-3 py-2 text-gray-700 disabled:opacity-50"
          onClick={() => void refresh()}
        >
          再読み込み
        </button>
        {status === "ready" && (
          <button
            type="button"
            className="rounded-xl border border-gray-300 px-3 py-2 text-gray-700"
            onClick={() => void disconnect()}
          >
            この端末の接続を解除
          </button>
        )}
      </div>

      <details className="mt-4 text-xs text-gray-500">
        <summary className="cursor-pointer">TimeTreeにも表示するには</summary>
        <p className="mt-2 leading-relaxed">
          スマホの標準カレンダーに同じGoogleアカウントを追加し、TimeTreeのカレンダー画面右上のフィルター設定から「表示するフィルターを選択」を開き、Googleカレンダーをオンにして保存してください。表示は自分の端末のみです。家族の共有カレンダーへのコピーは別操作で、変更は自動同期されません。
        </p>
        <a
          href="https://support.timetreeapp.com/hc/ja/articles/360000639682"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-accent underline"
        >
          TimeTree公式の設定方法
        </a>
      </details>
    </section>
  );
}
