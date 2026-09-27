"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";

type ShopItem = { id: string | number; text: string; done: boolean };
const fallback: ShopItem[] = [];

export default function ShoppingScreen({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ShopItem[]>(fallback);
  const [text, setText] = useState("");
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shopping", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.configured) {
        setItems(data.items);
        setShared(true);
        return;
      }
    } catch {}
    setShared(false);
    try {
      const saved = localStorage.getItem("family-quest-shopping");
      setItems(saved ? JSON.parse(saved) : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!shared && !loading) localStorage.setItem("family-quest-shopping", JSON.stringify(items));
  }, [items, shared, loading]);

  async function addItem() {
    const value = text.trim();
    if (!value) return;
    setText("");
    if (shared) {
      const res = await fetch("/api/shopping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: value }) });
      if (res.ok) await load();
      return;
    }
    setItems((prev) => [...prev, { id: String(Date.now()), text: value, done: false }]);
  }

  async function toggle(item: ShopItem) {
    if (shared) {
      await fetch("/api/shopping", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, done: !item.done }) });
      await load();
    } else setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, done: !x.done } : x));
  }

  async function remove(item: ShopItem) {
    if (shared) {
      await fetch("/api/shopping?id=" + encodeURIComponent(String(item.id)), { method: "DELETE" });
      await load();
    } else setItems((prev) => prev.filter((x) => x.id !== item.id));
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-black px-4 pb-28 pt-5 text-white">
      <header className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onClose} className="rounded-full bg-neutral-900 p-2" aria-label="戻る"><ArrowLeft size={20} /></button>
        <div className="flex-1"><p className="text-xs text-gray-500">FAMILY QUEST</p><h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="text-accent" />買い物リスト</h1></div>
        <button type="button" onClick={load} className="p-2 text-gray-400" aria-label="更新"><RefreshCw size={19} /></button>
      </header>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="mb-3 text-xs text-gray-500">{shared ? "家族共通リスト・Alexa連携準備OK" : "この端末のリスト（共通保存の設定待ち）"}</p>
        <div className="mb-4 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder="例：牛乳・ティッシュ" className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 outline-none focus:border-accent" />
          <button type="button" onClick={addItem} className="rounded-xl bg-accent px-4 text-black" aria-label="追加"><Plus /></button>
        </div>
        <div className="divide-y divide-neutral-800">
          {items.map((item) => <div key={item.id} className="flex items-center gap-3 py-4">
            <button type="button" onClick={() => toggle(item)} className={`grid h-7 w-7 place-items-center rounded-full border ${item.done ? "border-accent bg-accent text-black" : "border-neutral-600"}`} aria-label="完了切替">{item.done && <Check size={17} />}</button>
            <span className={`flex-1 ${item.done ? "text-gray-600 line-through" : ""}`}>{item.text}</span>
            <button type="button" onClick={() => remove(item)} className="p-2 text-gray-500" aria-label="削除"><Trash2 size={18} /></button>
          </div>)}
        </div>
        {!loading && items.length === 0 && <p className="py-8 text-center text-sm text-gray-500">買うものはありません</p>}
      </section>
    </main>
  );
}
