import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '@vercel/analytics';

/* 朝刊（pages/index.js）の一番下に置く導線。
   色は pages/quest.js の T と揃えてある。サイト側の値に合わせて調整可。

   「株クエスト」という名称だけでは初見の人に何ができるか伝わりにくいため、
   ユーザーに見える文言は「株の問題集」を前面に出し、「KabuBocchi 株クエスト」を
   ブランド名として小さく添える(コンポーネント名はQuestのまま)。

   pages/quest.js が localStorage(kabuquest.v1)に保存する進捗を読んで、
   未プレイ / 続きから / 本日クリア の3状態を出し分ける。 */

const KEY = 'kabuquest.v1';
const PER_DAY = 5;

function jstToday() {
  const d = new Date();
  const jst = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`;
}

export default function QuestCTA() {
  // 初回描画はサーバー/クライアントで一致させるため常に「未プレイ」扱いにし、
  // マウント後にlocalStorageの実データで上書きする(pages/quest.js と同じ方針)。
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    const today = jstToday();
    if (saved.doneDay === today) {
      setProgress({ mode: 'done', streak: saved.streak || 0 });
    } else if (saved.inProgressDay === today && saved.inProgressIdx > 0 && saved.inProgressIdx < PER_DAY) {
      setProgress({ mode: 'progress', idx: saved.inProgressIdx, streak: saved.streak || 0 });
    } else if ((saved.total || 0) > 0) {
      setProgress({ mode: 'start', streak: saved.streak || 0 });
    } else {
      setProgress({ mode: 'first' });
    }
  }, []);

  const p = progress || { mode: 'first' };

  let sub, cta;
  if (p.mode === 'done') {
    sub = '✅ 今日の5問クリア！';
    cta = '他の問題にも挑戦 →';
  } else if (p.mode === 'progress') {
    sub = `今日の問題 ${p.idx}/${PER_DAY} まで回答済み`;
    cta = '続きからやる →';
  } else if (p.mode === 'start') {
    sub = '1日5問で株に強くなる・約3分';
    cta = '今日の5問を続ける →';
  } else {
    sub = 'はじめての方はこちら・まずは5問だけ挑戦';
    cta = '今日の5問を始める →';
  }

  return (
    <Link href="/quest">
      <a className="cta" onClick={() => track('click_quest_cta')}>
        <span className="candles" aria-hidden="true">
          <i className="up" /><i className="up" /><i className="down" /><i className="up" /><i className="up" />
        </span>
        <span className="body">
          <b>📘 株の問題集</b>
          <span className="sub">{sub}</span>
          <span className="brand">KabuBocchi 株クエスト{p.mode !== 'first' && p.streak >= 1 ? ` ・ 🔥${p.streak}日連続` : ''}</span>
        </span>
        <span className="arrow">{cta}</span>
        <style jsx>{`
          .cta {
            display:flex; align-items:center; gap:14px; text-decoration:none;
            background:#13161C; border:1px solid #1B1F26; border-radius:12px;
            padding:16px 18px; margin:28px 0 0; color:#FFFFFF;
            transition:border-color .18s ease, transform .12s ease;
          }
          .cta:hover { border-color:#3A4557; transform:translateY(-1px); }
          .cta:focus-visible { outline:2px solid #FFB020; outline-offset:2px; }
          .candles { display:flex; align-items:flex-end; gap:3px; height:26px; flex:none; }
          .candles i { width:5px; border-radius:1px; display:block; }
          .candles .up { background:#FF4D4D; height:20px; }
          .candles .down { background:transparent; border:1.5px solid #3B82F6; height:12px; }
          .body { display:flex; flex-direction:column; flex:1; min-width:0; line-height:1.45; }
          .body b { font-size:15px; font-weight:800; letter-spacing:-.02em; }
          .sub { font-size:12.5px; color:#A1A7B3; }
          .brand { font-size:10.5px; color:#FFB020; opacity:.8; margin-top:2px; letter-spacing:.02em; }
          .arrow {
            font-family:'JetBrains Mono','Courier New',monospace;
            font-size:13px; color:#A1A7B3; flex:none; text-align:right; max-width:120px;
          }
        `}</style>
      </a>
    </Link>
  );
}
