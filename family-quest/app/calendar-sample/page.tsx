'use client';

import { useEffect, useState } from 'react';

type Tab = 'home' | 'calendar' | 'todo' | 'shop' | 'record';
type ShopItem = { text: string; done: boolean };
type Todo = { text: string; done: boolean };

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  padding: 18,
  marginBottom: 14,
  boxShadow: '0 7px 24px rgba(20,50,90,.07)',
};
const button: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: '11px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};
const input: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 12,
  border: '1px solid #dbe4ee',
  borderRadius: 12,
  fontSize: 16,
};
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 0',
  borderBottom: '1px solid #edf2f7',
};

export default function Page() {
  const [tab, setTab] = useState<Tab>('home');
  const [shopText, setShopText] = useState('');
  const [shop, setShop] = useState<ShopItem[]>([
    { text: '牛乳', done: false },
    { text: '卵', done: false },
  ]);
  const [todos, setTodos] = useState<Todo[]>([
    { text: '英語プリント提出', done: false },
    { text: '漢字ドリル', done: false },
    { text: '剣道の防具準備', done: false },
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fq-shop');
      if (saved) setShop(JSON.parse(saved) as ShopItem[]);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('fq-shop', JSON.stringify(shop));
  }, [shop]);

  function addShop() {
    const text = shopText.trim();
    if (!text) return;
    setShop((items) => [...items, { text, done: false }]);
    setShopText('');
  }

  const tabs: Array<[Tab, string, string]> = [
    ['home', '🏠', 'ホーム'],
    ['calendar', '📅', '予定'],
    ['todo', '🎯', 'ミッション'],
    ['shop', '🛒', '買い物'],
    ['record', '📊', '成長'],
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f6fb', color: '#183153', fontFamily: 'system-ui,sans-serif', paddingBottom: 90 }}>
      <div style={{ maxWidth: 520, margin: 'auto', padding: '18px 14px' }}>
        <header style={{ marginBottom: 18 }}>
          <small>FAMILY OS · β</small>
          <h1 style={{ margin: '4px 0' }}>わが家クエスト</h1>
          <p style={{ margin: 0, color: '#64748b' }}>予定・宿題・買い物・成長をひとつに</p>
          <a href="/api/google/auth" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 700 }}>Googleカレンダーを接続</a>
        </header>

        {tab === 'home' && (
          <>
            <section style={card}>
              <h2>☀️ 今日の作戦</h2>
              <p>🏫 学校　08:00</p>
              <p>💻 仕事　08:30</p>
              <p>🥋 剣道　16:30</p>
              <p>🍴 夕食　19:00</p>
            </section>
            <section style={card}>
              <h2>🏆 Family Quest</h2>
              <div style={{ fontSize: 34, fontWeight: 900 }}>1280 pt</div>
              <p>🔥 6日連続　⭐ 今日 +0pt</p>
            </section>
            <section style={card}>
              <h2>📣 家族掲示板</h2>
              <p>🎒 明日の持ち物を21時までに確認</p>
              <p>🥛 牛乳が少ないです</p>
              <p>🥋 剣道：防具を乾燥</p>
            </section>
          </>
        )}

        {tab === 'calendar' && (
          <section style={card}>
            <h2>📅 家族の予定</h2>
            <p>Googleカレンダー連携用の予定画面です。</p>
          </section>
        )}

        {tab === 'todo' && (
          <section style={card}>
            <h2>🎯 ミッション</h2>
            {todos.map((item, index) => (
              <div key={index} style={row} onClick={() => setTodos((items) => items.map((x, i) => i === index ? { ...x, done: !x.done } : x))}>
                <span>{item.done ? '✅' : '⬜️'}</span>
                <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
              </div>
            ))}
          </section>
        )}

        {tab === 'shop' && (
          <section style={card}>
            <h2>🛒 家族の買い物リスト</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                style={input}
                value={shopText}
                onChange={(e) => setShopText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addShop(); }}
                placeholder="例：牛乳・ティッシュ"
              />
              <button style={{ ...button, background: '#2878e8', color: '#fff' }} onClick={addShop}>＋</button>
            </div>
            {shop.map((item, index) => (
              <div key={index} style={{ ...row, opacity: item.done ? 0.55 : 1 }}>
                <button
                  aria-label="完了切替"
                  style={{ border: 0, background: 'transparent', fontSize: 20 }}
                  onClick={() => setShop((items) => items.map((x, i) => i === index ? { ...x, done: !x.done } : x))}
                >
                  {item.done ? '✅' : '⬜️'}
                </button>
                <b style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</b>
                <button
                  aria-label="削除"
                  style={{ border: 0, background: 'transparent', fontSize: 20 }}
                  onClick={() => setShop((items) => items.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            {shop.length === 0 && <p style={{ color: '#64748b' }}>買うものはありません。</p>}
            <small style={{ color: '#64748b' }}>この端末に自動保存されます。</small>
          </section>
        )}

        {tab === 'record' && (
          <section style={card}>
            <h2>📊 今週の成長</h2>
            <p>📚 勉強 12.5時間</p>
            <p>🥋 運動 9回</p>
            <p>✅ ミッション達成 85%</p>
          </section>
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 520, margin: 'auto', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: '#fff', borderTop: '1px solid #dfe7f1' }}>
        {tabs.map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ border: 0, background: '#fff', padding: 9, color: tab === id ? '#2878e8' : '#64748b', fontWeight: 700 }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </main>
  );
}
