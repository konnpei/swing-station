"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, ShoppingCart, Trash2 } from "lucide-react";

type ShopItem = { id: string; text: string; done: boolean };

const initialItems: ShopItem[] = [
  { id: "milk", text: "牛乳", done: false },
  { id: "eggs", text: "卵", done: false },
];

export default function ShoppingScreen({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ShopItem[]>(initialItems);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("family-quest-shopping");
      if (saved) setItems(JSON.parse(saved) as ShopItem[]);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("family-quest-shopping", JSON.stringify(items));
  }, [items]);

  function addItem() {
    const value = text.trim();
    if (!value) return;
    setItems((prev) => [...prev, { id: String(Date.now()), text: value, done: false }]);
    setText("");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-black px-4 pb-28 pt-5 text-white">
      <header className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onClose} className="rounded-full bg-neutral-900 p-2" aria-label="戻る">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-xs text-gray-500">FAMILY QUEST</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="text-accent" />買い物リスト</h1>
        </div>
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
            placeholder="例：牛乳・ティッシュ"
            className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 outline-none focus:border-accent"
          />
          <button type="button" onClick={addItem} className="rounded-xl bg-accent px-4 text-black" aria-label="追加">
            <Plus />
          </button>
        </div>

        <div className="divide-y divide-neutral-800">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-4">
              <button
                type="button"
                onClick={() => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, done: !x.done } : x))}
                className={`grid h-7 w-7 place-items-center rounded-full border ${item.done ? "border-accent bg-accent text-black" : "border-neutral-600"}`}
                aria-label="完了切替"
              >
                {item.done && <Check size={17} />}
              </button>
              <span className={`flex-1 ${item.done ? "text-gray-600 line-through" : ""}`}>{item.text}</span>
              <button type="button" onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} className="p-2 text-gray-500" aria-label="削除">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        {items.length === 0 && <p className="py-8 text-center text-sm text-gray-500">買うものはありません</p>}
        <p className="mt-3 text-xs text-gray-600">この端末に自動保存されます。</p>
      </section>
    </main>
  );
}
