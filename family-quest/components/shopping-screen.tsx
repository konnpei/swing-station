"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";

type ShopItem = { id: string | number; text: string; done: boolean };
type Mode = "loading" | "local" | "shared" | "locked" | "error";

export default function ShoppingScreen({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shopping", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) { setItems([]); setMode("locked"); return; }
      if (!res.ok) throw new Error(data.error || "共有リストを読み込めませんでした。");
      if (data.configured) { setItems(data.items); setMode("shared"); }
      else {
        const saved = localStorage.getItem("family-quest-shopping");
        setItems(saved ? JSON.parse(saved) : []);
        setMode("local");
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "接続できません。更新ボタンで再試行してください。");
      setMode("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  function saveLocal(next: ShopItem[]) {
    try { localStorage.setItem("family-quest-shopping", JSON.stringify(next)); setItems(next); }
    catch { setError("この端末に保存できませんでした。"); }
  }

  async function mutate(method: string, body?: unknown, id?: ShopItem["id"]) {
    const res = await fetch("/api/shopping" + (id === undefined ? "" : "?id=" + encodeURIComponent(String(id))), {
      method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      if (res.status === 401) { setItems([]); setMode("locked"); }
      const data = await res.json();
      throw new Error(data.error || "保存できませんでした。");
    }
    await load();
  }

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : "接続できませんでした。再試行してください。"); }
    finally { setBusy(false); }
  }

  async function login() {
    await action(async () => {
      const res = await fetch("/api/shopping/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) throw new Error((await res.json()).error || "ログインできませんでした。");
      setPassword(""); await load();
    });
  }

  async function addItem() {
    const value = text.trim();
    if (!value || (mode !== "shared" && mode !== "local")) return;
    await action(async () => {
      if (mode === "shared") await mutate("POST", { text: value });
      else saveLocal([...items, { id: crypto.randomUUID(), text: value, done: false }]);
      setText("");
    });
  }

  const editable = (mode === "shared" || mode === "local") && !busy;
  return (
    <main className="mx-auto min-h-screen max-w-md bg-black px-4 pb-28 pt-5 text-white">
      <header className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onClose} className="rounded-full bg-neutral-900 p-2" aria-label="戻る"><ArrowLeft size={20} /></button>
        <div className="flex-1"><p className="text-xs text-gray-500">FAMILY QUEST</p><h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="text-accent" />買い物リスト</h1></div>
        <button type="button" onClick={() => void load()} className="p-2 text-gray-400" aria-label="更新"><RefreshCw size={19} /></button>
      </header>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="mb-3 text-xs text-gray-500">{mode === "shared" ? "家族共通リスト・自動更新中" : mode === "local" ? "この端末のリスト（Alexaとは同期していません）" : mode === "locked" ? "家族共通のパスワードで開く" : mode === "loading" ? "読み込み中…" : "共有リストに接続できません"}</p>
        {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
        {mode === "locked" ? <form onSubmit={(e) => { e.preventDefault(); void login(); }} className="space-y-3">
          <label className="block text-sm" htmlFor="shop-password">家族の買い物リスト専用パスワード</label>
          <input id="shop-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3" required maxLength={512} />
          <button disabled={busy} className="rounded-xl bg-accent px-4 py-3 text-black">{busy ? "確認中…" : "リストを開く"}</button>
          <p className="text-xs text-gray-500">この端末では30日間ログインを保持します。</p>
        </form> : <>
          <form onSubmit={(e) => { e.preventDefault(); void addItem(); }} className="mb-4 flex gap-2">
            <input aria-label="買うもの" value={text} onChange={(e) => setText(e.target.value)} maxLength={120} disabled={!editable} placeholder="例：牛乳" className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 outline-none focus:border-accent disabled:opacity-50" />
            <button disabled={!editable} className="rounded-xl bg-accent px-4 text-black disabled:opacity-50" aria-label="追加"><Plus /></button>
          </form>
          <div className="divide-y divide-neutral-800">
            {items.map((item) => <div key={item.id} className="flex items-center gap-3 py-4">
              <button type="button" disabled={!editable} onClick={() => void action(async () => {
                if (mode === "shared") await mutate("PATCH", { id: item.id, done: !item.done });
                else saveLocal(items.map(x => x.id === item.id ? { ...x, done: !x.done } : x));
              })} className={`grid h-7 w-7 place-items-center rounded-full border ${item.done ? "border-accent bg-accent text-black" : "border-neutral-600"}`} aria-label={`${item.text}の完了切替`}>{item.done && <Check size={17} />}</button>
              <span className={`flex-1 ${item.done ? "text-gray-600 line-through" : ""}`}>{item.text}</span>
              <button type="button" disabled={!editable} onClick={() => void action(async () => {
                if (mode === "shared") await mutate("DELETE", undefined, item.id);
                else saveLocal(items.filter(x => x.id !== item.id));
              })} className="p-2 text-gray-500" aria-label={`${item.text}を削除`}><Trash2 size={18} /></button>
            </div>)}
          </div>
          {editable && items.length === 0 && <p className="py-8 text-center text-sm text-gray-500">買うものはありません</p>}
        </>}
        {mode === "shared" && <button type="button" className="mt-4 text-xs text-gray-400" onClick={() => void action(async () => {
          const res = await fetch("/api/shopping/session", { method: "DELETE" });
          if (!res.ok) throw new Error("ログアウトできませんでした。");
          setItems([]); setMode("locked");
        })}>この端末をログアウト</button>}
      </section>
    </main>
  );
}
