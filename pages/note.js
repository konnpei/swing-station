import { useEffect, useState } from "react";
import Head from "next/head";

/* Issue #28([L-009]) note投稿セットMVP(Slice 1)。
   毎朝生成済みのnote本文(note_full_text)と画像3枚(チャート/バナー/注目株)を
   1画面にまとめ、「全文コピー→note本文へ貼付→画像を長押し保存して挿入→公開」
   を数分で終えられるようにする。生成ロジック(scripts/morning_briefing.py)や
   Discord送信には一切手を入れず、既存の/api/latest・/api/chartに、新設の
   /api/banner-image・/api/stock-charts-imageを足しただけの表示専用ページ。 */

const BG = "#080D10";
const SURFACE = "#13161C";
const BORDER = "#1B1F26";
const TEXT = "#FFFFFF";
const SUB = "#A1A7B3";
const DIM = "#6B7280";
const ACCENT = "#FFB020";
const POSITIVE = "#00E0A3";

function CopyBlock({ label, text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // クリップボードAPIが使えない環境向けのフォールバックは行わない
      // (対象は自分のスマホ/PCのみのため、失敗時は手動選択コピーを促す)
    }
  };
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}>{label}</div>
        <button
          onClick={copy}
          style={{
            fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer",
            padding: "5px 12px", borderRadius: 8, border: `1px solid ${copied ? POSITIVE + "66" : BORDER}`,
            background: copied ? POSITIVE + "18" : BG, color: copied ? POSITIVE : TEXT,
          }}
        >
          {copied ? "コピーしました" : "全文コピー"}
        </button>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.8, color: SUB, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>
        {text}
      </div>
    </div>
  );
}

function ImageCard({ label, src }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 10, marginBottom: 12 }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: DIM, marginBottom: 8 }}>{label}</div>
      {failed ? (
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 11, color: DIM }}>まだ生成されていません</div>
      ) : (
        <img
          src={src}
          alt={label}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }}
          onError={() => setFailed(true)}
        />
      )}
      <div style={{ fontSize: 10, color: DIM, marginTop: 6, textAlign: "center" }}>画像を長押しして保存</div>
    </div>
  );
}

export default function NotePage() {
  const [briefing, setBriefing] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/latest")
      .then((r) => r.json())
      .then((d) => setBriefing(d))
      .catch(() => setError(true));
  }, []);

  // note_full_text(今回追加)がまだ無い日(=このMVP以前に生成された過去データ)は、
  // note_body/note_cta(既存フィールド)から簡易的に組み立てて表示だけは崩さない。
  const noteText = briefing?.note_full_text
    || [briefing?.note_body, briefing?.note_cta].filter(Boolean).join("\n\n---\n");

  return (
    <>
      <Head>
        <title>note投稿セット｜KabuBocchi</title>
      </Head>
      <div style={{ minHeight: "100vh", background: BG, color: SUB, fontFamily: "'JetBrains Mono','Courier New',monospace", padding: "16px 14px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, marginBottom: 2 }}>📝 note投稿セット</div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 18 }}>
            {briefing?.date ? `${briefing.date} 分` : "読み込み中…"} ・ 全文コピー→貼付→画像を順番に挿入→公開
          </div>

          {error && (
            <div style={{ color: ACCENT, fontSize: 12, marginBottom: 14 }}>データの取得に失敗しました。時間をおいて再読み込みしてください。</div>
          )}

          <CopyBlock label="NOTE本文" text={noteText} />
          <CopyBlock label="X告知用(3行)" text={briefing?.x_teaser_3line} />

          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: DIM, margin: "18px 0 8px" }}>
            挿入する画像(本文の好きな位置に貼ってください)
          </div>
          <ImageCard label="日経225チャート" src="/api/chart" />
          <ImageCard label="バナー" src="/api/banner-image" />
          <ImageCard label="注目株チャート" src="/api/stock-charts-image" />
        </div>
      </div>
    </>
  );
}
