import { useState, useMemo } from "react";
import Head from "next/head";

// pages/quiz.js
// 「株ぼっち 用語集・問題集」— スイングトレード用語の解説＋4択クイズページ。
//
// 設計方針:
// - 既存のdata/latest.jsonやAPIには一切依存しない、完全に独立した静的ページ。
//   既存の朝刊生成フロー・データ構造・他ページには影響を与えない。
// - 用語の説明はAIによる自動生成ではなく、サイト内で実際に使っている指標名・
//   銘柄パターン名(scripts/morning_briefing.py, scripts/market_data.py)を
//   根拠に手動で作成している(根拠不明なAI生成情報の表示を避けるため)。
// - 問題集(クイズ)は、下のTERMS配列(用語集と共通のデータ)から出題を自動生成する。
//   新しい文章をAIに作らせているわけではなく、既存の検証済みshort説明文を
//   選択肢としてそのまま使うだけなので、事実誤認・ハルシネーションのリスクはゼロ。
// - 投資助言ではないことを明示する。

const CATEGORIES = [
  { id: "all", label: "すべて" },
  { id: "market", label: "市場・指数" },
  { id: "technical", label: "テクニカル指標" },
  { id: "pattern", label: "銘柄パターン" },
  { id: "trading", label: "売買・注文" },
  { id: "fundamental", label: "決算・企業情報" },
];

const TERMS = [
  // --- 市場・指数 ---
  {
    term: "日経平均株価", kana: "にっけいへいきん", category: "market",
    short: "東証プライム上場銘柄から選ばれた225社の株価平均。日本市場全体の値動きを見る代表的な指数。",
    detail: "「日経225」とも呼ばれる。朝刊の一番上に毎日表示される数値で、前日比の%が同時に表示される。",
  },
  { term: "TOPIX", kana: "とぴっくす", category: "market",
    short: "東証プライム市場に上場する全銘柄を対象にした指数。日経平均より広い範囲の値動きを表す。",
    detail: "日経平均は225銘柄の平均、TOPIXは市場全体の時価総額を反映するため、両者の動きが食い違うこともある。",
  },
  { term: "SOX指数", kana: "そっくすしすう", category: "market",
    short: "米国の半導体関連企業で構成される指数(フィラデルフィア半導体指数)。",
    detail: "東京エレクトロンやアドバンテストなど日本の半導体関連銘柄は、前日のSOX指数の動きに連れ高・連れ安しやすい。",
  },
  { term: "NASDAQ", kana: "なすだっく", category: "market",
    short: "米国のハイテク企業が多く上場する株式市場、およびその代表的な指数。",
    detail: "AI・半導体・グロース株の動向を見る指標としてよく参照される。",
  },
  { term: "S&P500", kana: "えすあんどぴー500", category: "market",
    short: "米国の主要500社で構成される代表的な株価指数。",
    detail: "米国市場全体の地合いを見る際の基準としてNASDAQと並んでよく使われる。",
  },
  { term: "VIX指数", kana: "びっくすしすう", category: "market",
    short: "「恐怖指数」とも呼ばれる、市場が予想する今後の変動の大きさを示す指数。",
    detail: "数値が高いほど市場が神経質・不安定になっていることを示す。逆に低いと落ち着いた相場とされる。",
  },
  { term: "ドル指数(DXY)", kana: "どるしすう", category: "market",
    short: "主要通貨に対するドルの総合的な強さを示す指数。",
    detail: "DXYが上昇=ドルが全般的に買われている状態。ドル円の動きの背景を見る補助材料になる。",
  },
  { term: "米10年債利回り", kana: "べいじゅうねんさいりまわり", category: "market",
    short: "米国の10年国債の利回り(長期金利の代表的な指標)。",
    detail: "利回りが上昇すると、株式より債券の魅力が相対的に増すため、株安要因として意識されやすい。",
  },
  { term: "Fear & Greed指数", kana: "ふぃあーあんどぐりーど", category: "market",
    short: "市場参加者の心理が「恐怖」寄りか「強欲」寄りかを数値化した指数。",
    detail: "極端な「強欲」は過熱、極端な「恐怖」は行き過ぎた売りのサインとして参考にされることがある。",
  },
  { term: "ドル円(USD/JPY)", kana: "どるえん", category: "market",
    short: "1ドルが何円で交換できるかを示す為替レート。",
    detail: "円安(数字が大きくなる)は輸出企業に追い風、円高(数字が小さくなる)は輸入企業に追い風とされることが多い。",
  },

  // --- テクニカル指標 ---
  { term: "RSI", kana: "あーるえすあい", category: "technical",
    short: "「相対力指数」。株価の買われすぎ・売られすぎを0〜100の数値で示すテクニカル指標。",
    detail: "一般的に70以上は「買われすぎ」、30以下は「売られすぎ」の目安とされる。ただし強いトレンド中は高止まり/低止まりが続くこともあり、この数値だけで売買を判断するのは危険。",
  },
  { term: "MA25乖離率", kana: "えむえーにじゅうご", category: "technical",
    short: "直近25日間の平均株価(移動平均線)から、現在の株価がどれだけ離れているかを%で示す。",
    detail: "プラスなら平均より上、マイナスなら下。乖離が大きいほど、平均へ戻ろうとする反動(反発・反落)が意識されやすい。",
  },
  { term: "ボリンジャーバンド(BB)位置", kana: "ぼりんじゃーばんど", category: "technical",
    short: "統計的な値動きの範囲(バンド)の中で、現在株価が下から何%の位置にあるかを示す。",
    detail: "0%はバンド下限(下げすぎの目安)、100%は上限(上げすぎの目安)。サイトでは「BB下限/BB上限/BB中間」として表示される。",
  },
  { term: "出来高", kana: "できだか", category: "technical",
    short: "その日に売買が成立した株数。市場の関心の高さを示す。",
    detail: "普段より大きく出来高が増えている銘柄は、何らかの材料やニュースで注目が集まっているサイン。サイトでは平常時比の倍率(出来高倍率)で表示される。",
  },
  { term: "移動平均線", kana: "いどうへいきんせん", category: "technical",
    short: "一定期間(5日・25日・75日など)の株価の平均値を結んだ線。トレンドの方向を見る基本指標。",
    detail: "株価が移動平均線より上にあれば上昇トレンド寄り、下にあれば下降トレンド寄りと見なされることが多い。",
  },
  { term: "ゴールデンクロス/デッドクロス", kana: "でっどくろす", category: "technical",
    short: "短期の移動平均線が長期の移動平均線を下から上に抜けることをゴールデンクロス(買いサイン)、逆をデッドクロス(売りサイン)と呼ぶ。",
    detail: "有名なテクニカルサインだが、遅れて発生する(タイムラグがある)ため過信は禁物とされる。",
  },
  { term: "カップウィズハンドル", kana: "かっぷういずはんどる", category: "technical",
    short: "チャートの形が「カップ(お椀型の底)」と「持ち手(小さな調整)」に似た、株価上昇前によく見られるパターン。",
    detail: "成長株投資で有名な手法の一つ。サイトのスクリーナーでは検出結果が cup_handle として内部的に判定される。",
  },

  // --- 銘柄パターン(サイト独自の朝刊ロジック) ---
  { term: "イベントドリブン", kana: "いべんとどりぶん", category: "pattern",
    short: "決算・ニュース・材料など、特定の「きっかけ(イベント)」で株価が動くことを狙う考え方。",
    detail: "朝刊の「本日の注目銘柄」パターンの一つ。相場全体の地合いよりも、個別の材料の強さを重視する。",
  },
  { term: "暴落リバウンド", kana: "ぼうらくりばうんど", category: "pattern",
    short: "急落した銘柄が値を戻す動き(リバウンド)を狙う考え方。",
    detail: "下げすぎた反動を狙うパターン。下落の理由が一時的なものか構造的なものかの見極めが重要とされる。",
  },
  { term: "モメンタム", kana: "もめんたむ", category: "pattern",
    short: "既に上昇している勢い(モメンタム)がそのまま続くことを狙う考え方。",
    detail: "「強い銘柄はさらに強くなりやすい」という経験則に基づくパターン。トレンドが続く間は有効だが、転換点の見極めが難しい。",
  },
  { term: "押し目買い", kana: "おしめがい", category: "pattern",
    short: "上昇トレンドが続いている銘柄が、一時的に下がったタイミングを買う考え方。",
    detail: "「トレンドは継続する」という前提に立つパターン。下落がトレンド転換の始まりでないかの見極めが重要。",
  },
  { term: "出来高急増", kana: "できだかきゅうぞう", category: "pattern",
    short: "普段より出来高が急激に増えた銘柄に注目する考え方。",
    detail: "出来高の急増は、何らかの材料・ニュース・機関投資家の動きなどを示唆することが多いとされる。",
  },
  { term: "ギャップアップ", kana: "ぎゃっぷあっぷ", category: "pattern",
    short: "前日の終値より大きく高い株価で寄り付く(取引が始まる)ことを狙う考え方。",
    detail: "寄り付き後にそのまま上昇が続くか、逆に「窓埋め」で下がるかの見極めが重要とされる。",
  },
  { term: "セクターローテーション", kana: "せくたーろーてーしょん", category: "pattern",
    short: "市場全体の資金が、あるセクター(業種)から別のセクターへ移動する動きに注目する考え方。",
    detail: "サイトの「セクターヒートマップ」で、資金がどの業種に向かっているかを確認できる。",
  },
  { term: "清原式割安", kana: "きよはらしきわりやす", category: "pattern",
    short: "著名投資家・清原達郎氏の手法を参考にした、業績に対して株価が割安な銘柄に注目する考え方。",
    detail: "朝刊の銘柄パターンの一つとして採用されている呼称。特定の個人の手法を完全に再現するものではない。",
  },
  { term: "井村式急回復", kana: "いむらしききゅうかいふく", category: "pattern",
    short: "著名投資家・井村俊哉氏の手法を参考にした、急落から回復に向かう銘柄に注目する考え方。",
    detail: "朝刊の銘柄パターンの一つとして採用されている呼称。特定の個人の手法を完全に再現するものではない。",
  },

  // --- 売買・注文 ---
  { term: "エントリー", kana: "えんとりー", category: "trading",
    short: "新しく株を買う(ポジションを持つ)こと。",
    detail: "朝刊では「エントリー価格帯」として、参考になりそうな価格レンジが示される(断定的な価格ではない)。",
  },
  { term: "ターゲット(target)", kana: "たーげっと", category: "trading",
    short: "利益を確定させる目安として設定する価格・上昇率。",
    detail: "「+3%」のように、エントリー価格からの上昇率で示されることが多い。",
  },
  { term: "ストップ(stop)", kana: "すとっぷ", category: "trading",
    short: "損失を確定させて撤退する目安として設定する価格・下落率。",
    detail: "「-2%」のように、エントリー価格からの下落率で示されることが多い。損切りラインとも呼ばれる。",
  },
  { term: "損切り", kana: "そんぎり", category: "trading",
    short: "含み損を抱えた株を、損失を確定させてでも売却すること。",
    detail: "「もっと下がるかもしれない」という損失の拡大を防ぐための行動。あらかじめストップの水準を決めておくことが重視される。",
  },
  { term: "利益確定(利確)", kana: "りかく", category: "trading",
    short: "含み益が出ている株を売却して、利益を確定させること。",
    detail: "「まだ上がるかもしれない」という欲を抑え、あらかじめ決めたターゲットで機械的に行うことが重視されることが多い。",
  },

  // --- 決算・企業情報 ---
  { term: "決算", kana: "けっさん", category: "fundamental",
    short: "企業が一定期間(四半期・通期など)の業績をまとめて発表すること。",
    detail: "売上・利益が市場の予想と比べてどうだったかで、株価が大きく動くことがある(決算またぎ)。",
  },
  { term: "上方修正・下方修正", kana: "じょうほうしゅうせい", category: "fundamental",
    short: "企業自身が、以前発表した業績予想を上げる(上方修正)・下げる(下方修正)こと。",
    detail: "市場予想を上回る上方修正はポジティブ、下方修正はネガティブな材料として株価に影響しやすい。",
  },
  { term: "自社株買い", kana: "じしゃかぶがい", category: "fundamental",
    short: "企業が市場に出回っている自社の株式を、自ら買い戻すこと。",
    detail: "1株あたりの価値が相対的に高まるため、株主還元策としてポジティブに受け止められやすい。",
  },
  { term: "TOB(株式公開買付け)", kana: "てぃーおーびー", category: "fundamental",
    short: "買収などを目的に、市場外で不特定多数の株主から株を買い集める手法。",
    detail: "TOB価格は市場価格より高く設定されることが多く、対象銘柄の株価がTOB価格に近づいて急騰することがある。",
  },
];

// --- 問題集(4択クイズ) -------------------------------------------------
// TERMSの short 説明文をそのまま選択肢として使う。新しい文章は生成しない。

const QUIZ_LENGTH = 5; // KABU QUEST: 毎日5問

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuiz() {
  const pool = shuffleArray(TERMS).slice(0, Math.min(QUIZ_LENGTH, TERMS.length));
  return pool.map((t) => {
    const distractors = shuffleArray(TERMS.filter((o) => o.term !== t.term))
      .slice(0, 3)
      .map((o) => o.short);
    const choices = shuffleArray([t.short, ...distractors]);
    return {
      term: t.term,
      kana: t.kana,
      detail: t.detail,
      choices,
      correctIndex: choices.indexOf(t.short),
    };
  });
}

function resultComment(score, total) {
  const rate = score / total;
  if (rate === 1) return "満点です。朝刊の用語はもうバッチリ読みこなせそうです。";
  if (rate >= 0.7) return "よく理解できています。もう少しで満点です。";
  if (rate >= 0.4) return "半分以上正解。用語集を見返すとさらに定着します。";
  return "まずは用語集タブでひとつずつ確認してみましょう。";
}

const tabButtonStyle = (active) => ({
  flex: 1, fontFamily: "inherit", fontSize: 12, fontWeight: 700,
  padding: "9px 12px", borderRadius: 12, cursor: "pointer",
  color: active ? "#00120C" : "#A1A7B3",
  background: active ? "#00E0A3" : "#13161C",
  border: `1px solid ${active ? "#00E0A3" : "#1B1F26"}`,
});

const primaryButtonStyle = {
  fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
  padding: "11px 20px", borderRadius: 12, cursor: "pointer",
  color: "#00120C", background: "#00E0A3", border: "1px solid #00E0A3",
};

export default function QuizPage() {
  const [tab, setTab] = useState("glossary"); // "glossary" | "quiz"
  const [activeCategory, setActiveCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [openTerm, setOpenTerm] = useState(null);
  const [quiz, setQuiz] = useState(null); // null = 未開始

  const filtered = useMemo(() => {
    const q = query.trim();
    return TERMS.filter((t) => {
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      if (!q) return true;
      return t.term.includes(q) || (t.kana || "").includes(q) || t.short.includes(q);
    });
  }, [activeCategory, query]);

  const startQuiz = () => setQuiz({ questions: buildQuiz(), index: 0, score: 0, selected: null, finished: false });

  const selectAnswer = (idx) => {
    if (!quiz || quiz.selected !== null) return;
    const correct = idx === quiz.questions[quiz.index].correctIndex;
    setQuiz({ ...quiz, selected: idx, score: quiz.score + (correct ? 1 : 0) });
  };

  const nextQuestion = () => {
    if (!quiz) return;
    if (quiz.index + 1 >= quiz.questions.length) {
      setQuiz({ ...quiz, finished: true });
    } else {
      setQuiz({ ...quiz, index: quiz.index + 1, selected: null });
    }
  };

  const currentQuestion = quiz && !quiz.finished ? quiz.questions[quiz.index] : null;

  return (
    <>
      <Head>
        <title>用語集・問題集 | KabuBocchi</title>
        <meta name="description" content="株ぼっち(KabuBocchi)のスイングトレード用語集と4択問題集。朝刊で使っている指標・銘柄パターンの意味をやさしく解説・確認できます。" />
        <meta name="robots" content="index,follow" />
      </Head>
      <div style={{
        minHeight: "100vh", background: "#0B0F12", color: "#F5F7F8",
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        padding: "0 0 40px",
      }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "linear-gradient(180deg, #0B0F12 82%, rgba(11,15,18,0))",
          padding: "18px 16px 10px",
        }}>
          <a href="/" style={{ fontSize: 11, color: "#68747C", textDecoration: "none" }}>← KabuBocchiに戻る</a>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#00E0A3", letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 10 }}>
            KabuBocchi Glossary
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", marginTop: 4 }}>株ぼっち 用語集・問題集</div>
          <div style={{ fontSize: 11, color: "#8892A3", marginTop: 6, lineHeight: 1.6 }}>
            毎朝の朝刊で使っている指標・銘柄パターンの意味をまとめました。投資助言ではありません。
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setTab("glossary")} style={tabButtonStyle(tab === "glossary")}>用語集</button>
            <button onClick={() => setTab("quiz")} style={tabButtonStyle(tab === "quiz")}>問題集</button>
          </div>

          {tab === "glossary" && (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="用語を検索(例: RSI、出来高)"
                style={{
                  width: "100%", marginTop: 14, padding: "10px 12px", borderRadius: 12,
                  background: "#13161C", border: "1px solid #1B1F26", color: "#F5F7F8",
                  fontFamily: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box",
                }}
              />

              <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
                {CATEGORIES.map((c) => {
                  const active = activeCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      style={{
                        flex: "0 0 auto", fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                        padding: "7px 12px", borderRadius: 20, cursor: "pointer",
                        color: active ? "#00120C" : "#A1A7B3",
                        background: active ? "#00E0A3" : "#13161C",
                        border: `1px solid ${active ? "#00E0A3" : "#1B1F26"}`,
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {tab === "glossary" ? (
          <div style={{ padding: "8px 16px 0" }}>
            <div style={{ fontSize: 10, color: "#4A5568", marginBottom: 10 }}>{filtered.length}件</div>
            {filtered.length === 0 && (
              <div style={{ fontSize: 12, color: "#68747C", padding: "24px 0", textAlign: "center" }}>
                該当する用語が見つかりませんでした。
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((t) => {
                const isOpen = openTerm === t.term;
                return (
                  <div
                    key={t.term}
                    onClick={() => setOpenTerm(isOpen ? null : t.term)}
                    style={{
                      background: "#101519", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
                      padding: "12px 14px", cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>{t.term}</div>
                      <div style={{ fontSize: 14, color: "#68747C", flexShrink: 0 }}>{isOpen ? "−" : "+"}</div>
                    </div>
                    {t.kana && (
                      <div style={{ fontSize: 9.5, color: "#4A5568", marginTop: 2 }}>{t.kana}</div>
                    )}
                    <div style={{ fontSize: 12, color: "#A1A7B3", marginTop: 6, lineHeight: 1.7 }}>{t.short}</div>
                    {isOpen && (
                      <div style={{
                        fontSize: 11.5, color: "#8892A3", marginTop: 8, paddingTop: 8,
                        borderTop: "1px solid rgba(255,255,255,0.06)", lineHeight: 1.8,
                      }}>
                        {t.detail}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 16px 0" }}>
            {!quiz && (
              <div style={{
                background: "#101519", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
                padding: "24px 16px", textAlign: "center",
              }}>
                <div style={{ fontSize: 13, color: "#A1A7B3", lineHeight: 1.8, marginBottom: 18 }}>
                  用語集から{Math.min(QUIZ_LENGTH, TERMS.length)}問をランダム出題します。<br />
                  4つの選択肢から意味を選んでください。
                </div>
                <button onClick={startQuiz} style={primaryButtonStyle}>
                  {Math.min(QUIZ_LENGTH, TERMS.length)}問チャレンジ開始
                </button>
              </div>
            )}

            {currentQuestion && (
              <div>
                <div style={{ fontSize: 10, color: "#4A5568", marginBottom: 10 }}>
                  問題 {quiz.index + 1} / {quiz.questions.length} ・ 正解 {quiz.score}問
                </div>
                <div style={{
                  background: "#101519", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
                  padding: "16px 14px", marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, color: "#68747C", marginBottom: 6 }}>次の用語の意味は？</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>{currentQuestion.term}</div>
                  {currentQuestion.kana && (
                    <div style={{ fontSize: 9.5, color: "#4A5568", marginTop: 2 }}>{currentQuestion.kana}</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentQuestion.choices.map((choice, idx) => {
                    const answered = quiz.selected !== null;
                    const isCorrectChoice = idx === currentQuestion.correctIndex;
                    const isSelected = quiz.selected === idx;
                    let bg = "#13161C", border = "#1B1F26", color = "#F5F7F8";
                    if (answered && isCorrectChoice) {
                      bg = "rgba(0,224,163,0.12)"; border = "#00E0A3"; color = "#00E0A3";
                    } else if (answered && isSelected) {
                      bg = "rgba(255,107,107,0.12)"; border = "#FF6B6B"; color = "#FF6B6B";
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => selectAnswer(idx)}
                        disabled={answered}
                        style={{
                          textAlign: "left", fontFamily: "inherit", fontSize: 12.5, lineHeight: 1.6,
                          padding: "12px 14px", borderRadius: 12,
                          background: bg, border: `1px solid ${border}`, color,
                          cursor: answered ? "default" : "pointer",
                        }}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>

                {quiz.selected !== null && (
                  <div style={{
                    marginTop: 12, background: "#101519", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 16, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 11.5, color: "#8892A3", lineHeight: 1.8 }}>{currentQuestion.detail}</div>
                    <button onClick={nextQuestion} style={{ ...primaryButtonStyle, marginTop: 12, width: "100%" }}>
                      {quiz.index + 1 >= quiz.questions.length ? "結果を見る" : "次の問題へ"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {quiz && quiz.finished && (
              <div style={{
                background: "#101519", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
                padding: "28px 16px", textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: "#68747C" }}>結果</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#00E0A3", marginTop: 8 }}>
                  {quiz.score} / {quiz.questions.length}
                </div>
                <div style={{ fontSize: 12, color: "#A1A7B3", marginTop: 10, lineHeight: 1.8 }}>
                  {resultComment(quiz.score, quiz.questions.length)}
                </div>
                <button onClick={startQuiz} style={{ ...primaryButtonStyle, marginTop: 18 }}>もう一度挑戦</button>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", textAlign: "center", marginTop: 32 }}>
          KABUBOCCHI
        </div>
      </div>
    </>
  );
}
