import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { BANK } from '../data/questBank';

/* ══════════════════════════════════════════════════════════════
   THEME ── サイトの世界観に合わせる唯一の場所
   既存の pages/index.js で使っている値をここに写せば全体が揃う
   ══════════════════════════════════════════════════════════════ */
const T = {
  bg:      '#080D10',   // ページ背景（styles/globals.css body / pages/index.js の背景と一致）
  panel:   '#13161C',   // カード背景（pages/index.js の実際のパネル色）
  panel2:  '#171B22',   // ホバー・選択肢（panelとlineの中間で算出。実サイトに同用途の直接サンプルなし）
  line:    '#1B1F26',   // 罫線（pages/index.js の実際のボーダー色）
  text:    '#FFFFFF',   // 本文（pages/index.js の実際の主文字色）
  sub:     '#A1A7B3',   // 補助テキスト（pages/index.js の実際の補助文字色）
  up:      '#FF4D4D',   // 陽線・正解（日本式の赤・変更なし）
  down:    '#3B82F6',   // 陰線・不正解（日本式の青・変更なし）
  accent:  '#FFB020',   // 連続日数・アクセント（pages/index.js のアンバー色と一致・変更なし）
  mono:    "'JetBrains Mono','Courier New',monospace",
};

const PER_DAY = 5;
const KEY = 'kabuquest.v1';

/* ── 日替わり出題：日付シードで全問一巡してから重複 ───────── */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function shuffled(seed) {
  const a = BANK.map((_, i) => i), r = rng(seed + 12345);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function jstNow() {
  const d = new Date();
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
}
function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function pickQuestions(dayIndex) {
  const start = dayIndex * PER_DAY, n = BANK.length, out = [];
  for (let k = 0; k < PER_DAY; k++) {
    const p = start + k;
    out.push(BANK[shuffled(Math.floor(p / n))[p % n]]);
  }
  return out;
}

/* ── ローソク足（正誤リアクション／結果チャート） ───────── */
function Candle({ up, h = 46, w = 26 }) {
  const c = up ? T.up : T.down;
  const y = up ? 70 - h : 20;
  return (
    <svg width={w} height="92" viewBox="0 0 26 92" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <line className="wick" x1="13" y1={y - 12} x2="13" y2={y + h + 12} stroke={c} strokeWidth="1.5" />
      <rect className="body" x="4" y={y} width="18" height={h} fill={up ? c : 'transparent'} stroke={c} strokeWidth="2" rx="1" />
      <style jsx>{`
        .body { transform-origin: center; animation: pop .38s cubic-bezier(.2,1.4,.4,1) both; }
        .wick { animation: fade .3s ease .18s both; }
        @keyframes pop { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .body, .wick { animation: none } }
      `}</style>
    </svg>
  );
}

export default function Quest() {
  const [day, setDay] = useState(null);          // { key, index, label }
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ streak: 0, total: 0, hit: 0 });
  const [view, setView] = useState('quiz');      // quiz | result | review
  const [copied, setCopied] = useState(false);

  /* 初期化はクライアントのみ（SSRとの不一致を避ける） */
  useEffect(() => {
    const d = jstNow();
    const k = keyOf(d);
    const index = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const label = `${k.replace(/-/g, '.')} (${'日月火水木金土'[d.getDay()]})`;
    setDay({ key: k, index, label });
    setQs(pickQuestions(index));

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    setStats({ streak: saved.streak || 0, total: saved.total || 0, hit: saved.hit || 0 });
    if (saved.doneDay === k && Array.isArray(saved.log)) {
      setResults(saved.log); setIdx(PER_DAY); setView('result');
    }
  }, []);

  const answer = (i) => {
    if (picked !== null) return;
    setPicked(i);
    setResults((r) => { const n = [...r]; n[idx] = i === qs[idx].a; return n; });
  };

  const next = () => {
    setPicked(null);
    if (idx < PER_DAY - 1) { setIdx(idx + 1); return; }
    setIdx(PER_DAY);
    // 記録は1日1回だけ
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    if (saved.doneDay !== day.key) {
      const yest = keyOf(new Date(jstNow().getTime() - 86400000));
      const hit = results.filter(Boolean).length;
      const nextStats = {
        streak: saved.lastDay === yest ? (saved.streak || 0) + 1 : 1,
        total: (saved.total || 0) + PER_DAY,
        hit: (saved.hit || 0) + hit,
      };
      setStats(nextStats);
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...nextStats, lastDay: day.key, doneDay: day.key, log: results }));
      } catch (e) {}
    }
    setView('result');
  };

  const share = useCallback(() => {
    const hit = results.filter(Boolean).length;
    const bar = results.map((o) => (o ? '🟥' : '🟦')).join('');
    const txt = `株クエスト ${day.key.replace(/-/g, '/')}\n${bar} ${hit}/5・${stats.streak}日連続\nhttps://swing-station-app.vercel.app/quest`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
    }
  }, [results, stats, day]);

  if (!day) return <div style={{ background: T.bg, minHeight: '100vh' }} />;

  const hit = results.filter(Boolean).length;
  const rate = stats.total ? Math.round((stats.hit / stats.total) * 100) : 0;
  const q = qs[Math.min(idx, PER_DAY - 1)];
  const wrong = qs.map((qq, i) => ({ qq, ok: results[i] })).filter((x) => x.ok === false);
  const line = hit === 5 ? '全勝。ノーミスで引けた。'
    : hit >= 4 ? '上出来。取りこぼしは1問だけ。'
    : hit >= 3 ? '及第点。落とした2問が本日の課題。'
    : hit >= 1 ? '負け越し。復習リストが本命。'
    : '全敗。ここが一番伸びる日。';

  return (
    <div className="page">
      <Head>
        <title>株クエスト｜毎日5問 - swing station</title>
        <meta name="description" content="日本株スイングトレードの判断力を毎日5問で鍛えるデイリークイズ。制度・需給・チャート・決算・マクロを全50問収録。" />
        <meta property="og:title" content="株クエスト｜毎日5問" />
        <meta property="og:description" content="日本株の判断力を毎日5問。連続記録に挑戦できます。" />
      </Head>

      <div className="wrap">
        <nav className="crumb">
          <Link href="/"><a>← 朝刊に戻る</a></Link>
        </nav>

        <header>
          <div>
            <h1>株クエスト</h1>
            <div className="tick">{day.label}　／　全{BANK.length}問収録</div>
          </div>
          <div className={`streak ${stats.streak >= 3 ? 'hot' : ''}`}>
            <b>{stats.streak}</b><span>日連続</span>
          </div>
        </header>

        <div className="ticks">
          {Array.from({ length: PER_DAY }).map((_, i) => (
            <i key={i} className={results[i] === undefined ? (i === idx ? 'now' : '') : (results[i] ? 'up' : 'down')} />
          ))}
        </div>

        {view === 'quiz' && q && (
          <div className="card">
            <div className="meta"><span className="tag">{q.cat}</span><span>Q{idx + 1} / {PER_DAY}</span></div>
            <p className="q">{q.q}</p>
            <div className="opts">
              {q.o.map((t, i) => {
                let cls = 'opt';
                if (picked !== null) {
                  if (i === q.a) cls += ' correct';
                  else if (i === picked) cls += ' wrong';
                  else cls += ' dim';
                }
                return (
                  <button key={i} className={cls} onClick={() => answer(i)} disabled={picked !== null}>
                    <span className="k">{'ABCD'[i]}</span><span>{t}</span>
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <>
                <div className="verdict">
                  <Candle up={picked === q.a} h={picked === q.a ? 46 : 34} />
                  <div className="vtext">
                    <div className={`vhead ${picked === q.a ? 'u' : 'd'}`}>
                      {picked === q.a ? '正解' : '不正解'}
                      <span className="pl">正解は {'ABCD'[q.a]}　／　本日 {results.filter(Boolean).length}/{idx + 1}</span>
                    </div>
                    <p className="expl" dangerouslySetInnerHTML={{ __html: q.e }} />
                  </div>
                </div>
                <button className="next" onClick={next} autoFocus>
                  {idx === PER_DAY - 1 ? '今日の結果を見る' : '次の問題へ'}
                </button>
              </>
            )}
          </div>
        )}

        {view === 'result' && (
          <div className="card">
            <h2>本日の成績</h2>
            <p className="lead">{day.key.replace(/-/g, '.')} ／ {line}</p>

            <div className="chart">
              {results.map((ok, i) => (
                <div className="col" key={i}><Candle up={ok} h={ok ? 58 : 38} /></div>
              ))}
            </div>

            <div className="stats">
              <div className="stat"><b className={hit >= 3 ? 'u' : 'd'}>{hit}/5</b><span>本日</span></div>
              <div className="stat"><b>{rate}%</b><span>通算勝率</span></div>
              <div className="stat"><b>{stats.streak}</b><span>連続日数</span></div>
            </div>

            {wrong.length > 0 && (
              <ul className="review">
                {wrong.map((x, i) => (
                  <li key={i}><b>{x.qq.q}</b><span dangerouslySetInnerHTML={{ __html: x.qq.e }} /></li>
                ))}
              </ul>
            )}

            <div className="rowbtn">
              <button className="primary" onClick={share}>{copied ? 'コピーしました' : '結果をコピー'}</button>
              <button onClick={() => setView('review')}>全5問を見直す</button>
            </div>
            <p className="done">次の5問は明日 0:00（JST）に入れ替わる</p>
            <Link href="/"><a className="back">朝刊で今日の相場を確認する →</a></Link>
          </div>
        )}

        {view === 'review' && (
          <div className="card">
            <h2>本日の5問</h2>
            <p className="lead">{day.key.replace(/-/g, '.')}</p>
            <ul className="review">
              {qs.map((qq, i) => (
                <li key={i} style={{ borderLeftColor: results[i] ? T.up : T.down }}>
                  <b>{qq.q}</b>
                  <span className="ans">正解：{qq.o[qq.a]}</span>
                  <span dangerouslySetInnerHTML={{ __html: qq.e }} />
                </li>
              ))}
            </ul>
            <div className="rowbtn"><button className="primary" onClick={() => setView('result')}>成績に戻る</button></div>
          </div>
        )}

        <footer>投資判断は自己責任で。本ページは学習用であり、特定銘柄の売買を推奨しません。</footer>
      </div>

      <style jsx>{`
        .page { background:${T.bg}; color:${T.text}; min-height:100vh;
          font-family:${T.mono};
          line-height:1.7; }
        .wrap { max-width:560px; margin:0 auto; padding:0 16px 64px; }
        .crumb { padding:18px 0 4px; font-family:${T.mono}; font-size:12px; }
        .crumb a { color:${T.sub}; text-decoration:none; }
        .crumb a:hover { color:${T.text}; }
        header { display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
          border-bottom:1px solid ${T.line}; padding:10px 0 14px; margin-bottom:20px; }
        h1 { margin:0; font-size:23px; font-weight:900; letter-spacing:-.04em; }
        .tick { font-family:${T.mono}; font-size:11px; color:${T.sub}; letter-spacing:.06em; margin-top:3px; }
        .streak { font-family:${T.mono}; text-align:right; line-height:1.2; }
        .streak b { font-size:27px; font-weight:700; letter-spacing:-.03em; }
        .streak span { display:block; font-size:10px; color:${T.sub}; letter-spacing:.12em; }
        .streak.hot b { color:${T.accent}; }

        .ticks { display:flex; gap:5px; margin-bottom:22px; }
        .ticks i { flex:1; height:4px; background:${T.line}; border-radius:1px; transition:background .25s ease; }
        .ticks i.up { background:${T.up}; }
        .ticks i.down { background:${T.down}; }
        .ticks i.now { background:${T.text}; }

        .card { background:${T.panel}; border:1px solid ${T.line}; border-radius:12px; padding:20px 18px; }
        h2 { margin:0 0 4px; font-size:20px; font-weight:900; letter-spacing:-.03em; }
        .lead { margin:0 0 20px; font-size:13px; color:${T.sub}; font-family:${T.mono}; }
        .meta { display:flex; align-items:center; gap:8px; margin-bottom:14px;
          font-family:${T.mono}; font-size:11px; color:${T.sub}; letter-spacing:.06em; }
        .tag { border:1px solid ${T.line}; border-radius:3px; padding:2px 7px; color:${T.text}; font-weight:600; }
        .q { font-size:19px; font-weight:700; line-height:1.55; letter-spacing:-.01em; margin:0 0 18px; }

        .opts { display:flex; flex-direction:column; gap:9px; }
        .opt { width:100%; text-align:left; font:inherit; color:inherit; cursor:pointer;
          background:${T.panel2}; border:1px solid ${T.line}; border-radius:8px; padding:13px 14px;
          display:flex; gap:11px; align-items:flex-start;
          transition:border-color .15s ease, transform .08s ease; }
        .opt:hover:enabled { border-color:#3A4557; }
        .opt:active:enabled { transform:scale(.995); }
        .opt:focus-visible { outline:2px solid ${T.text}; outline-offset:2px; }
        .opt:disabled { cursor:default; }
        .opt .k { font-family:${T.mono}; font-size:12px; color:${T.sub}; border:1px solid ${T.line};
          border-radius:3px; min-width:20px; height:20px; display:grid; place-items:center; flex:none; margin-top:2px; }
        .opt.correct { border-color:${T.up}; background:rgba(255,77,77,.08); }
        .opt.wrong { border-color:${T.down}; background:rgba(59,130,246,.08); }
        .opt.dim { opacity:.4; }

        .verdict { margin-top:18px; border-top:1px solid ${T.line}; padding-top:16px; display:flex; gap:14px; }
        .vtext { flex:1; min-width:0; }
        .vhead { font-family:${T.mono}; font-size:13px; font-weight:700; letter-spacing:.06em;
          display:flex; align-items:baseline; gap:10px; margin-bottom:6px; flex-wrap:wrap; }
        .vhead .pl { font-size:11px; font-weight:400; color:${T.sub}; }
        .u { color:${T.up}; } .d { color:${T.down}; }
        .expl { font-size:14.5px; line-height:1.75; color:#C3CAD6; margin:0; }

        .next { margin-top:18px; width:100%; font:inherit; font-weight:700; cursor:pointer;
          background:${T.text}; color:${T.bg}; border:0; border-radius:8px; padding:14px; letter-spacing:.02em; }
        .next:active { opacity:.85; }
        .next:focus-visible { outline:2px solid ${T.accent}; outline-offset:2px; }

        .chart { display:flex; align-items:flex-end; justify-content:center; gap:14px; height:120px;
          border-bottom:1px solid ${T.line}; margin-bottom:18px; padding-bottom:2px; }
        .col { display:flex; flex-direction:column; justify-content:flex-end; height:100%; }
        .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:${T.line};
          border:1px solid ${T.line}; border-radius:8px; overflow:hidden; margin-bottom:18px; }
        .stat { background:${T.panel}; padding:12px 8px; text-align:center; }
        .stat b { display:block; font-family:${T.mono}; font-size:20px; font-weight:700; letter-spacing:-.03em; }
        .stat span { font-size:10px; color:${T.sub}; letter-spacing:.1em; }

        .review { margin:0 0 18px; padding:0; list-style:none; }
        .review li { border-left:2px solid ${T.down}; padding:2px 0 2px 12px; margin-bottom:14px;
          font-size:13.5px; color:#C3CAD6; }
        .review li b { display:block; font-weight:700; color:${T.text}; margin-bottom:2px; }
        .review .ans { display:block; font-family:${T.mono}; font-size:12px; color:${T.sub}; margin-bottom:4px; }

        .rowbtn { display:flex; gap:9px; }
        .rowbtn button { flex:1; font:inherit; font-size:14px; font-weight:700; cursor:pointer; padding:12px;
          border-radius:8px; border:1px solid ${T.line}; background:${T.panel2}; color:${T.text}; }
        .rowbtn button.primary { background:${T.text}; color:${T.bg}; border-color:${T.text}; }
        .rowbtn button:focus-visible { outline:2px solid ${T.accent}; outline-offset:2px; }
        .done { text-align:center; color:${T.sub}; font-size:12px; margin:16px 0 0; font-family:${T.mono}; }
        .back { display:block; text-align:center; margin-top:14px; font-size:13px; color:${T.accent}; text-decoration:none; }
        footer { margin-top:26px; font-family:${T.mono}; font-size:10.5px; color:${T.sub};
          letter-spacing:.05em; text-align:center; line-height:1.9; }
      `}</style>
      <style jsx global>{`
        .expl b, .review span b {
          color:${T.text};
          background:linear-gradient(transparent 62%, rgba(255,77,77,.25) 62%);
          font-weight:700;
        }
        /* globals.cssのhtml,body,#__nextはoverflow:hiddenだが、
           それは朝刊(index.js)が内部スクロール領域を持つ前提の設定。
           /questはページ全体スクロールが前提のため、この画面にいる間だけ
           overflowを解除する(styled-jsxのglobalはページ離脱時に自動で外れる)。 */
        html, body, #__next {
          height: auto;
          min-height: 100%;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
