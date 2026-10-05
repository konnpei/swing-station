"use client";

import { useEffect, useState } from "react";

type Event = { id: string; title: string; start: string; allDay: boolean; htmlLink?: string };
type Status = "loading" | "ready" | "login" | "setup" | "error";

export default function GoogleCalendarPanel() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [callbackError, setCallbackError] = useState(false);

  async function refresh() {
    setStatus("loading");
    try {
      const r = await fetch("/api/google/events", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) { setEvents([]); setStatus(data.error === "setup_required" ? "setup" : data.error === "login_required" ? "login" : "error"); return; }
      setEvents(data.events);
      setHasMore(data.hasMore);
      setStatus("ready");
    } catch { setStatus("error"); }
  }

  useEffect(() => {
    setCallbackError(new URLSearchParams(window.location.search).get("google") === "error");
    void refresh();
  }, []);

  async function disconnect() {
    const r = await fetch("/api/google/disconnect", { method: "POST" });
    if (r.ok) { setEvents([]); setStatus("login"); } else setStatus("error");
  }

  function dateLabel(e: Event) {
    if (e.allDay) return `${e.start.replace(/-/g, "/")} 終日`;
    return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(e.start));
  }

  return (
    <section className="my-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4" aria-label="Googleカレンダーの予定">
      <h2 className="font-bold">Googleカレンダーの予定</h2>
      <p className="mt-1 text-xs text-gray-400">今日から2週間・日本時間</p>
      <div role="status" className="my-3 text-sm text-gray-300">
        {status === "loading" && "予定を確認中…"}
        {status === "setup" && "Google連携の設定を準備中です。設定完了後に接続できます。"}
        {status === "login" && "Googleアカウントを接続すると予定が表示されます。"}
        {status === "error" && "予定を取得できませんでした。再読み込み、またはGoogleアカウントを再接続してください。"}
        {callbackError && status !== "ready" && <p className="mt-2">接続を完了できませんでした。もう一度接続してください。</p>}
        {status === "ready" && events.length === 0 && "この期間の予定はありません。"}
      </div>
      {status === "ready" && <ul className="divide-y divide-neutral-800">{events.map(e => <li key={e.id} className="py-3"><p className="text-xs text-gray-400">{dateLabel(e)}</p><p className="mt-1 font-medium">{e.title}</p>{e.htmlLink?.startsWith("https://www.google.com/calendar/") && <a className="text-xs text-accent underline" href={e.htmlLink} target="_blank" rel="noopener noreferrer">Googleで開く</a>}</li>)}</ul>}
      {status === "ready" && hasMore && <p className="my-2 text-xs text-gray-400">先頭250件を表示しています。残りはGoogleカレンダーで確認できます。</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        {status !== "setup" && status !== "ready" && status !== "loading" && <a href="/api/google/auth" className="rounded-xl bg-accent px-3 py-2 font-medium text-white">Googleカレンダーを接続</a>}
        <button type="button" disabled={status === "loading"} className="rounded-xl border border-neutral-700 px-3 py-2 disabled:opacity-50" onClick={() => void refresh()}>再読み込み</button>
        {status === "ready" && <button type="button" className="rounded-xl border border-neutral-700 px-3 py-2" onClick={() => void disconnect()}>この端末の接続を解除</button>}
      </div>
      <details className="mt-4 text-xs text-gray-400">
        <summary className="cursor-pointer">TimeTreeにも表示するには</summary>
        <p className="mt-2 leading-relaxed">スマホの標準カレンダーに同じGoogleアカウントを追加し、TimeTreeのカレンダー画面右上のフィルター設定から「表示するフィルターを選択」を開き、Googleカレンダーをオンにして保存してください。表示は自分の端末のみです。家族の共有カレンダーへのコピーは別操作で、変更は自動同期されません。</p>
        <a href="https://support.timetreeapp.com/hc/ja/articles/360000639682" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-accent underline">TimeTree公式の設定方法</a>
      </details>
    </section>
  );
}
