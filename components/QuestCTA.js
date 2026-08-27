import Link from 'next/link';

/* 朝刊（pages/index.js）の一番下に置く導線。
   色は pages/quest.js の T と揃えてある。サイト側の値に合わせて調整可。 */
export default function QuestCTA() {
  return (
    <Link href="/quest">
      <a className="cta">
        <span className="candles" aria-hidden="true">
          <i className="up" /><i className="up" /><i className="down" /><i className="up" /><i className="up" />
        </span>
        <span className="body">
          <b>株クエスト</b>
          <span className="sub">今日の5問で相場観を点検する</span>
        </span>
        <span className="arrow">→</span>
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
          .arrow {
            font-family:'JetBrains Mono','Courier New',monospace;
            font-size:15px; color:#A1A7B3; flex:none;
          }
        `}</style>
      </a>
    </Link>
  );
}
