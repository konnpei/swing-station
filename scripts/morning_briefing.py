"""

swing-station morning_briefing.py (kabubocchi complete v4)
Generates and sends to Discord at 6:30 AM JST:
  1. Banner image (bull/bear + 8 mode auto-detection)
  2. Nikkei 225 chart (OHLC+volume+MACD+MA)
  3. Note post body (long form with kabubocchi comments)
  4. X post text x2
"""
 
import os, io, json, re, base64
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from quality_check import run_quality_check
from datetime import datetime, timezone, timedelta
 
import requests
import anthropic
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.gridspec import GridSpec
from PIL import Image, ImageDraw, ImageFont
 
# Constants
JST     = timezone(timedelta(hours=9))
NOW     = datetime.now(JST)
TODAY   = NOW.strftime("%Y/%m/%d")
WEEKDAY = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][NOW.weekday()]
WEEKDAY_JP = ["月","火","水","木","金","土","日"][NOW.weekday()]
 
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

DISCORD_WEBHOOK   = os.environ["DISCORD_WEBHOOK_MAIN"]
FONT_PATH         = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
 
MODES = {
    "normal":       {"label":"通常モード",         "color":"#3b82f6", "bg":(13,26,46),  "quote":"方向感のない日こそ、銘柄選別の腕の見せどころ。"},
    "surge":        {"label":"爆騰モード",         "color":"#22c55e", "bg":(8,25,8),    "quote":"強い相場は強い。乗り遅れるな。"},
    "crash":        {"label":"暴落モード",         "color":"#ef4444", "bg":(28,8,8),    "quote":"嵐の日こそ、次の仕込みを考える日。"},
    "ai":           {"label":"AIバブルモード",     "color":"#a855f7", "bg":(15,8,28),   "quote":"AI祭りの熱狂に乗れ。ただし出口を常に意識して。"},
    "yen":          {"label":"円高ショックモード", "color":"#06b6d4", "bg":(8,22,28),   "quote":"円高は輸出株の敵、内需株の友。"},
    "rate_cut":     {"label":"利下げ期待モード",   "color":"#f59e0b", "bg":(28,18,0),   "quote":"金利が下がれば、グロースの春が来る。"},
    "earnings":     {"label":"決算祭りモード",     "color":"#ec4899", "bg":(28,8,18),   "quote":"決算は相場の通知表。サプライズを狙え。"},
    "geopolitical": {"label":"地政学リスクモード", "color":"#f97316", "bg":(28,12,0),   "quote":"有事の金・円・原油。リスクオフの鉄則を忘れるな。"},
}
 

# 株価影響ニュースキーワード（これに引っかかるものを優先抽出）
STOCK_KEYWORDS = [
    "決算", "増益", "減益", "上方修正", "下方修正", "増配", "減配",
    "自社株買い", "株式分割", "TOB", "買収", "合併", "業績",
    "利上げ", "利下げ", "FOMC", "日銀", "円安", "円高",
    "半導体", "AI", "チップ", "GPU", "受注", "契約",
    "日経平均", "ナスダック", "SOX", "VIX", "急騰", "急落"
]

def fetch_market_news():
    """Google News RSSから株価連動ニュースを抽出"""
    import xml.etree.ElementTree as ET
    import re

    queries = [
        "日本株+決算+業績",
        "日経平均+株価+上方修正",
        "増配+自社株買い+TOB",
    ]

    news_items = []
    for q in queries:
        try:
            url = f"https://news.google.com/rss/search?q={q}&hl=ja&gl=JP&ceid=JP:ja"
            r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
            root = ET.fromstring(r.content)
            for item in root.findall(".//item")[:5]:
                title = item.find("title").text or ""
                pub = item.find("pubDate").text or ""
                # 株価連動キーワードが含まれるものだけ抽出
                if any(kw in title for kw in STOCK_KEYWORDS):
                    news_items.append({
                        "title": title[:80],
                        "date": pub[:16]
                    })
        except Exception as e:
            print(f"News fetch error: {e}")
            continue

    # 重複除去して最大10件
    seen = set()
    unique = []
    for item in news_items:
        if item["title"] not in seen:
            seen.add(item["title"])
            unique.append(item)
    return unique[:10]


# 監視銘柄・市場データ取得ロジックはmarket_data.pyに集約（refresh_market_data.pyと共有）
from market_data import (
    WATCH_MAP, WATCH_LIST, SECTOR_MAP,
    fetch_all_watch_changes, fetch_surge_drop, build_sector_heatmap, top_movers,
    US_WATCH_MAP, US_SECTOR_MAP, US_WATCH_LIST, fetch_us_watch_changes,
    fetch_market_data, compute_ai_score,
)
 

STOCKS_JP = [
    ("7203", "トヨタ自動車"), ("9984", "ソフトバンクG"), ("6758", "ソニーグループ"),
    ("6861", "キーエンス"), ("8306", "三菱UFJ"), ("9432", "NTT"),
    ("4063", "信越化学"), ("6954", "ファナック"), ("8035", "東京エレクトロン"),
    ("6367", "ダイキン"), ("8058", "三菱商事"), ("6098", "リクルートHD"),
    ("7974", "任天堂"), ("4568", "第一三共"), ("9983", "ファーストリテイリング"),
    ("6501", "日立製作所"), ("7267", "本田技研"), ("2914", "JT"),
    ("4543", "テルモ"), ("4519", "中外製薬"),
]

def fetch_stock_technicals():
    import yfinance as yf
    results = []
    for code, name in STOCKS_JP:
        try:
            ticker = yf.Ticker(f"{code}.T")
            ticker.session.timeout = 10
            hist = ticker.history(period="60d")
            if hist.empty or len(hist) < 25:
                continue
            close = hist["Close"]
            volume = hist["Volume"]
            current = float(close.iloc[-1])
            prev = float(close.iloc[-2])
            change_pct = (current - prev) / prev * 100
            ma25 = float(close.tail(25).mean())
            ma5 = float(close.tail(5).mean())
            ma25_diff = (current - ma25) / ma25 * 100
            std25 = float(close.tail(25).std())
            bb_upper = ma25 + 2 * std25
            bb_lower = ma25 - 2 * std25
            bb_pos = (current - bb_lower) / (bb_upper - bb_lower) * 100 if bb_upper != bb_lower else 50
            delta = close.diff().tail(15)
            gain = delta.clip(lower=0).mean()
            loss = (-delta.clip(upper=0)).mean()
            rsi = round(100 - (100 / (1 + gain / loss)), 1) if loss != 0 else 50
            vol_ratio = round(float(volume.tail(5).mean()) / float(volume.tail(20).mean()), 2) if float(volume.tail(20).mean()) > 0 else 1.0
            results.append({
                "code": code, "name": name,
                "price": int(current), "change_pct": round(change_pct, 2),
                "ma25": int(ma25), "ma25_diff": round(ma25_diff, 1),
                "ma5": int(ma5), "bb_pos": round(bb_pos, 1),
                "rsi": rsi, "vol_ratio": vol_ratio,
            })
        except Exception as e:
            print(f"yfinance error {code}: {e}")
            continue
    return results

def detect_mode(data):
    pct = data["pct"]
    sox = data["sox_pct"]
    usd = data["usd_jpy"]
    vix = data["vix"]
 
    if pct <= -2.5 or vix >= 30:
        return "crash"
    if pct >= 2.0 and sox >= 3.0:
        return "ai"
    if pct >= 2.0:
        return "surge"
    if usd <= 148.0:
        return "yen"
    if sox >= 3.0:
        return "ai"
    if vix >= 25:
        return "geopolitical"
    return "normal"
 
 
def generate_content(data, mode):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    m = MODES[mode]
    sign = "▲" if data["diff"] >= 0 else "▼"
 
    surges, drops = [], []
    print("Fetching surge/drop stocks...")
    surges, drops = fetch_surge_drop()
    surge_str = ""
    for s in surges:
        surge_str += f"急騰 {s['code']}: +{s['pct']}% ({s['price']:,}円)\n"
    for d in drops:
        surge_str += f"急落 {d['code']}: {d['pct']}% ({d['price']:,}円)\n"
    if not surge_str:
        surge_str = "急騰・急落銘柄なし"
    print(f"Surge/Drop: {len(surges)}騰/{len(drops)}落")

    print("Fetching market news...")
    market_news = fetch_market_news()
    news_str = ""
    for n in market_news:
        news_str += f"- {n['title']} ({n['date']})\n"
    if not news_str:
        news_str = "ニュース取得なし"
    print(f"News fetched: {len(market_news)}件")

    print("Fetching individual stock data...")
    try:
        stocks = fetch_stock_technicals()
        print(f"Stock data fetched: {len(stocks)} stocks")
    except Exception as e:
        print(f"Stock fetch error: {e}")
        stocks = []
    stocks_str = ""
    for s in stocks:
        try:
            bb = "BB下限" if s["bb_pos"] < 20 else ("BB上限" if s["bb_pos"] > 80 else "BB中間")
            vol = f"出来高{s['vol_ratio']}倍" if s["vol_ratio"] > 1.5 else "出来高普通"
            stocks_str += f"{s['name']}({s['code']}): 現在{s['price']:,}円 {s['change_pct']:+.1f}% MA25乖離{s['ma25_diff']:+.1f}% RSI{s['rsi']} {bb} {vol}\n"
        except Exception as e:
            print(f"Stock format error: {e}")
            continue
    if not stocks_str:
        stocks_str = "株価データ取得失敗。銘柄は上記リストから選択し、価格は書かないこと。"

    prompt = f"""You are kabubocchi, a popular swing trader content creator in Japan.
You write morning briefings for Discord and note at 6:30 AM JST.

【重要】以下の実際の株価データのみを使用すること。架空の株価・銘柄コード・断定表現は絶対禁止。

本日の市場データ:
- 日付: {TODAY} ({WEEKDAY_JP})
- 日経225: {data["latest"]["close"]:,}円 ({sign}{abs(int(data["diff"])):,}円 / {data["pct"]:+.2f}%)
- USD/JPY: {data["usd_jpy"]}
- SOX指数: {data["sox_pct"]:+.1f}% 前日比
- VIX: {data["vix"]}
- 相場モード: {m["label"]}
- Quote: {m["quote"]}

実際の個別銘柄データ（エントリー価格は必ずこのデータを元に設定すること）:
{stocks_str}

禁止事項:
- 具体的な株価・価格レンジを書くこと（絶対禁止）
- 上記の実データに存在しない銘柄コードを使うこと（絶対禁止）
- 「確実」「必ず」「今週中に底」「令和最大級」など断定・誇張表現
- 「機関投資家が買っている」「出来高3倍」など未確認の事実
- 過去の統計・データの裏付けなしの断定（例：「SOXが-6%後は1ヶ月以内に反発」）
- エントリーは必ず条件ベース（「MA25付近」「RSI30以下」など）のみ
- 可能性の話は「〜との見方もある」「〜の可能性がある」など推測表現を使うこと
 
Character traits:
- Sharp and witty but insightful
- Great at metaphors and analogies
- Makes complex things simple
- Creates FOMO with writing style
- Refers to self as kabubocchi
 
Return ONLY valid JSON (no markdown, no backticks):
{{
  "market_summary": "3-4 sentences in Japanese with kabubocchi personality",
  "news": [
    {{"tag": "日本 or 米国 or 警戒 or チャンス", "headline": "catchy headline in Japanese", "body": "2-3 sentences with wit and insight"}}
  ],
  "stocks_jp": [
    {{"pattern": "pattern name", "code": "stock code", "name": "stock name", "score": 8,
      "entry": "entry price range", "target": "+3%", "stop": "-2%",
      "reason": "2-3 sentences with specific data and chart basis",
      "comment": "kabubocchi one-liner"}}
  ],
  "stock_us": {{"pattern": "バフェット式", "ticker": "$XXX", "name": "name", "score": 8,
    "entry": "price range", "target": "+3%", "stop": "-2%",
    "reason": "2-3 sentences", "comment": "kabubocchi one-liner"}},
  "consideration": {{
    "main": "400 char kabubocchi analysis with metaphors and specific advice",
    "point": "single most important thing today - punchy one-liner",
    "action": "specific action for readers"
  }},
  "strategy": ["5 specific strategies with actions and rationale"],
  "events_jp": [{{"date": "YYYY-MM-DD", "text": "日本の経済イベント（日銀会合、決算発表、経済指標等）", "importance": "high or medium or low", "urgent": true}}],
  "events_us": [{{"date": "YYYY-MM-DD", "text": "米国の経済イベント（FOMC、雇用統計、CPI等）", "importance": "high or medium or low", "urgent": true}}],
  "x_posts": [
    "X投稿1: 相場サマリー（280文字以内・絵文字・ハッシュタグ3つ・noteリンク誘導）",
    "X投稿2: 注目銘柄フォーカス（280文字以内・かぶぼっち口調）",
    "X投稿3: 問いかけ形式（200文字以内・フォロワー反応狙い）"
  ],
  "x_teaser_3line": "note記事の宣伝用にXへ投稿する短いテキスト。ちょうど3行、各行1文程度。note本文で一番おいしい部分（今日のテーマ・一番動いた銘柄等）を凝縮する。絵文字は可、ハッシュタグやリンクは含めない（別途本文に付け足すため）",
  "note_body": "note専用完全版（1500〜2500文字）。Discord要約と完全に別の文章で書く。構成：\n1. リード文（相場を一言で表す）\n2. 今日の相場ポイント（昨夜米国・為替・半導体・AI・今日のテーマ・注意点を300〜500文字）\n3. 注目銘柄（各銘柄：名前・コード・★評価・注目理由・エントリー条件・利確・損切・注意点）\n4. 今日の売買戦略（デイトレ・スイング・中長期）\n5. かぶぼっちコメント（人間味のある一言）\n6. 明日の注目ポイント3つ\n【重要】日本株・米国株・スイングトレード・日経平均・半導体・AIというキーワードを本文の文章の中に自然に登場させること。ただし「SEOキーワード：」のような見出しやラベルとして本文末尾や途中に列挙してはならない。読者に見える形でキーワードを箇条書き・タグ的に貼り付けるのは禁止。あくまで文章の一部として自然に溶け込ませること。",
  "note_cta": "毎朝の相場分析と注目銘柄は継続発信中。フォローしてお待ちください📊"
}}
 
stocks_jpは5銘柄のみ。以下のパターンから5つ選ぶ:
イベントドリブン/暴落リバウンド/モメンタム/押し目買い/出来高急増/ギャップアップ/セクターローテーション/清原式割安/井村式急回復
※本日の相場モードに最も合う5パターンを選ぶこと

events_jp/events_usのimportanceは3段階で厳密に付けること:
- high: 日銀金融政策決定会合、FOMC、米雇用統計、CPI、主要企業の決算発表など相場全体を動かしうるイベント
- medium: 個別統計や中堅企業決算など、注目はされるが相場全体への影響は限定的なイベント
- low: 参考程度の経済指標や恒例行事
urgentはimportanceが"high"の場合のみtrueにすること。
 
All text content must be in Japanese. Return ONLY the JSON object."""
 
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
 
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Raw response: {raw[:500]}")
        raise

    # 各銘柄にテクニカルベースのAIスコアを付与（LLMの主観スコアとは別軸）
    tech_by_code = {s["code"]: s for s in stocks}
    for s in parsed.get("stocks_jp", []):
        t = tech_by_code.get(str(s.get("code", "")))
        if t:
            s["ai_score"] = compute_ai_score(t)
            s["rsi"] = t.get("rsi")
            s["vol_ratio"] = t.get("vol_ratio")

    return parsed
 
 
def generate_chart(data, mode):
    fm.fontManager.addfont(FONT_PATH)
    fp = fm.FontProperties(fname=FONT_PATH)
    plt.rcParams["font.family"] = fp.get_name()
 
    m = MODES[mode]
    accent = m["color"]
    ohlcv = data["ohlcv"]
 
    dates  = [d["date"]   for d in ohlcv]
    opens  = [d["open"]   for d in ohlcv]
    highs  = [d["high"]   for d in ohlcv]
    lows   = [d["low"]    for d in ohlcv]
    closes = [d["close"]  for d in ohlcv]
    vols   = [d["volume"] for d in ohlcv]
 
    def calc_ma(arr, p):
        return [None if i < p-1 else float(np.mean(arr[i-p+1:i+1])) for i in range(len(arr))]
 
    def calc_ema(arr, p):
        k = 2/(p+1)
        ema = [arr[0]]
        for c in arr[1:]:
            ema.append(c*k + ema[-1]*(1-k))
        return ema
 
    ma5  = calc_ma(closes, 5)
    ma25 = calc_ma(closes, 25)
    e12  = calc_ema(closes, 12)
    e26  = calc_ema(closes, 26)
    macd = [a-b for a, b in zip(e12, e26)]
    sig  = calc_ema(macd, 9)
 
    BG    = "#0d1117"
    GRID  = "#1e2535"
    TEXT  = "#9ca3af"
    GREEN = "#22c55e"
    RED   = "#ef4444"
 
    fig = plt.figure(figsize=(12, 8), facecolor=BG)
    gs  = GridSpec(3, 1, figure=fig, hspace=0.06, height_ratios=[3, 1, 1.2])
    ax1 = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1], sharex=ax1)
    ax3 = fig.add_subplot(gs[2], sharex=ax1)
 
    for ax in [ax1, ax2, ax3]:
        ax.set_facecolor(BG)
        ax.tick_params(colors=TEXT, labelsize=9)
        for sp in ["top", "right"]:
            ax.spines[sp].set_visible(False)
        for sp in ["bottom", "left"]:
            ax.spines[sp].set_color(GRID)
        ax.yaxis.grid(True, color=GRID, lw=0.5, ls="--", alpha=0.6)
        ax.set_axisbelow(True)
 
    x = np.arange(len(dates))
    W = 0.4
 
    for i in x:
        c = GREEN if closes[i] >= opens[i] else RED
        ax1.plot([i, i], [lows[i], highs[i]], color=c, lw=1.2, zorder=2)
        bh = max(abs(closes[i]-opens[i]), (highs[i]-lows[i])*0.04)
        ax1.add_patch(plt.Rectangle((i-W/2, min(opens[i], closes[i])), W, bh, color=c, zorder=3))
 
    ma5_x  = [i for i, v in enumerate(ma5)  if v is not None]
    ma5_v  = [v for v in ma5  if v is not None]
    ma25_x = [i for i, v in enumerate(ma25) if v is not None]
    ma25_v = [v for v in ma25 if v is not None]
 
    ax1.plot(ma5_x,  ma5_v,  color="#3b82f6", lw=1.8, label="MA5")
    ax1.plot(ma25_x, ma25_v, color="#f59e0b", lw=1.8, label="MA25")
    ax1.set_ylim(min(lows)*0.997, max(highs)*1.003)
    ax1.tick_params(labelbottom=False)
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{int(v):,}"))
    ax1.legend(loc="upper left", fontsize=9, facecolor="#1a2030", edgecolor=GRID, labelcolor=TEXT, prop=fp)
 
    if len(closes) < 2:
        closes = [closes[0], closes[0]] if closes else [70000, 70000]
    diff2 = closes[-1] - closes[-2]
    pct2  = diff2 / closes[-2] * 100 if closes[-2] else 0.0
    sign2 = "▲" if diff2 >= 0 else "▼"
    ax1.set_title(
        f"日経平均  {closes[-1]:,}円   {sign2}{abs(int(diff2)):,}  ({pct2:+.2f}%)",
        color=TEXT, fontsize=13, pad=12, loc="left", fontproperties=fp
    )
    ax1.text(0.995, 0.97, f"[{m['label']}]",
        transform=ax1.transAxes, ha="right", va="top", fontsize=10, color=accent,
        fontproperties=fp,
        bbox=dict(boxstyle="round,pad=0.4", facecolor=BG, edgecolor=accent, alpha=0.9))
 
    vcols = [GREEN if closes[i] >= opens[i] else RED for i in range(len(x))]
    ax2.bar(x, vols, color=vcols, alpha=0.65, width=0.7)
    ax2.set_ylabel("出来高", color=TEXT, fontsize=8, fontproperties=fp)
    ax2.tick_params(labelbottom=False)
 
    mcols = [GREEN if v >= 0 else RED for v in macd]
    ax3.bar(x, macd, color=mcols, alpha=0.7, width=0.7)
    ax3.plot(x, sig, color="#f59e0b", lw=1.8, label="Signal")
    ax3.axhline(0, color=GRID, lw=0.8)
    ax3.set_ylabel("MACD", color=TEXT, fontsize=8, fontproperties=fp)
    ax3.legend(loc="upper right", fontsize=8, facecolor="#1a2030", edgecolor=GRID, labelcolor=TEXT, prop=fp)
    ax3.set_xticks(x)
    ax3.set_xticklabels(dates, rotation=0, fontsize=9, color=TEXT, fontfamily=fp.get_name())
 
    fig.text(0.99, 0.005, f"swing-station | {TODAY}  ※投資勧誘ではありません",
        ha="right", va="bottom", fontsize=7, color="#4b5563", fontproperties=fp)
 
    buf = io.BytesIO()
    plt.savefig(buf, dpi=150, bbox_inches="tight", facecolor=BG, format="png")
    plt.close()
    buf.seek(0)
    return buf
 
 

def generate_banner(data, mode):
    banner_map = {
        "normal": "public/banners/normal.png",
        "surge": "public/banners/surge.png",
        "crash": "public/banners/crash.png",
        "ai": "public/banners/ai.png",
    }
    banner_path = banner_map.get(mode)
    if banner_path and os.path.exists(banner_path):
        with open(banner_path, "rb") as f:
            buf = io.BytesIO(f.read())
        buf.seek(0)
        return buf

    m = MODES[mode]
    W, H = 1200, 400
 
    def hex2rgb(h):
        h = h.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
 
    accent = hex2rgb(m["color"])
    bg     = m["bg"]
 
    canvas = Image.new("RGB", (W, H), bg)
    draw   = ImageDraw.Draw(canvas)
 
    for i in range(6):
        a = int(220*(1-i/6))
        draw.rectangle([(0, i), (W, i+1)], fill=(*accent, a))
 
    try:
        fn_xl = ImageFont.truetype(FONT_PATH, 52)
        fn_lg = ImageFont.truetype(FONT_PATH, 28)
        fn_md = ImageFont.truetype(FONT_PATH, 20)
        fn_sm = ImageFont.truetype(FONT_PATH, 15)
        fn_xs = ImageFont.truetype(FONT_PATH, 12)
    except Exception:
        fn_xl = fn_lg = fn_md = fn_sm = fn_xs = ImageFont.load_default()
 
    headlines = {
        "normal":       ("今日の相場分析",       "ブル vs ベア 方向感を見極めろ"),
        "surge":        ("強い!! 資金集中!!",     "上昇トレンド加速中"),
        "crash":        ("危険信号 暴落警戒!!",   "リスクオフ加速中"),
        "ai":           ("AI相場 再加速!!",       "半導体・AI関連が強い"),
        "yen":          ("円高ショック!!",        "輸出株に逆風・内需に注目"),
        "rate_cut":     ("利下げ期待 再燃!!",     "グロース株に追い風"),
        "earnings":     ("決算祭り 開幕!!",       "好決算銘柄に資金集中"),
        "geopolitical": ("地政学リスク 急浮上!!","有事の金・円・原油に注目"),
    }
    hl, sub = headlines.get(mode, (m["label"], ""))
 
    draw.rounded_rectangle([(40, 26), (240, 62)], radius=18,
        fill=accent, outline=accent, width=2)
    draw.text((54, 36), f"[{m['label']}]", fill=(255, 255, 255), font=fn_sm)
 
    draw.text((40, 72),  hl,           fill=(*accent, 255),     font=fn_xl)
    draw.text((40, 140), sub,          fill=(180, 200, 200, 255), font=fn_lg)
    draw.text((40, 180), m["quote"],   fill=(*accent, 120),     font=fn_sm)
 
    diff = data["diff"]
    sign = "▲" if diff >= 0 else "▼"
    metrics = [
        ("日経平均", f"{data['latest']['close']:,}円", f"{sign}{abs(int(diff)):,}"),
        ("ドル円",   f"{data['usd_jpy']}",              "もみ合い"),
        ("SOX",      "前日比",                           f"{data['sox_pct']:+.1f}%"),
        ("VIX",      f"{data['vix']}",                  "警戒" if data["vix"] >= 25 else "安定"),
    ]
    bx = 40
    by = 230
    for label, val, chg in metrics:
        draw.rounded_rectangle([(bx, by), (bx+172, by+82)], radius=8,
            fill=(255, 255, 255, 12), outline=(255, 255, 255, 20), width=1)
        draw.text((bx+8, by+6),  label, fill=(110, 140, 140, 255), font=fn_xs)
        draw.text((bx+8, by+26), val,   fill=(220, 240, 240, 255), font=fn_md)
        chg_c = (34, 197, 94, 255) if ("▲" in chg or "+" in chg) else \
                (239, 68, 68, 255)  if ("▼" in chg or "-" in chg) else (180, 190, 210, 255)
        draw.text((bx+8, by+54), chg, fill=chg_c, font=fn_xs)
        bx += 184
 
    draw.text((W-230, 28), "swing-station", fill=(*accent, 80), font=fn_lg)
    draw.text((W-160, 60), "かぶぼっち",    fill=(*accent, 55), font=fn_sm)
 
    draw.rectangle([(0, H-28), (W, H)], fill=(0, 0, 0, 200))
    draw.text((14, H-18),
        f"swing-station | {TODAY}({WEEKDAY_JP})  ※投資勧誘ではありません",
        fill=(60, 90, 90, 255), font=fn_xs)
 
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    buf.seek(0)
    return buf
 
 
def generate_note(data, mode, c):
    m    = MODES[mode]
    diff = data["diff"]
    pct  = data["pct"]
    sign = "▲" if diff >= 0 else "▼"
    dc   = "+" if diff >= 0 else ""
 
    emoji_map = {
        "normal":"📊", "surge":"🚀", "crash":"💥", "ai":"🤖",
        "yen":"💴", "rate_cut":"💰", "earnings":"🎯", "geopolitical":"⚠️"
    }
    emoji = emoji_map.get(mode, "📊")
 
    news_lines = []
    for n in c.get("news", []):
        tag      = n.get("tag", "")
        headline = n.get("headline", "")
        body     = n.get("body", "")
        news_lines.append(f"\n**{tag}|{headline}**\n{body}\n")
    news_md = "".join(news_lines)
 
    stock_lines = []
    for i, s in enumerate(c.get("stocks_jp", [])[:4], 1):
        sc      = s.get("score", 7)
        pattern = s.get("pattern", "")
        name    = s.get("name", "")
        code    = s.get("code", "")
        entry   = s.get("entry", "")
        target  = s.get("target", "")
        stop    = s.get("stop", "")
        reason  = s.get("reason", "")
        comment = s.get("comment", "")
        stars   = "★" * sc + "☆" * (10-sc)
        line = (
            f"\n**{i}. {name}（{code}）** [{pattern}] {sc}/10\n"
            f"| 項目 | 内容 |\n"
            f"|------|------|\n"
            f"| 📌 エントリー | {entry} |\n"
            f"| 🎯 目標 | {target} |\n"
            f"| 🛡️ 損切 | {stop} |\n"
            f"| 📝 根拠 | {reason} |\n"
            f"\n> 💬 _{comment}_\n"
        )
        stock_lines.append(line)
    stocks_jp_md = "".join(stock_lines)
 
    us = c.get("stock_us", {})
    sc = us.get("score", 8)
    us_md = (
        f"\n**10. {us.get('name','')}（{us.get('ticker','')}）** [{us.get('pattern','')}] {sc}/10\n"
        f"| 項目 | 内容 |\n"
        f"|------|------|\n"
        f"| 📌 エントリー | {us.get('entry','')} |\n"
        f"| 🎯 目標 | {us.get('target','')} |\n"
        f"| 🛡️ 損切 | {us.get('stop','')} |\n"
        f"| 📝 根拠 | {us.get('reason','')} |\n"
        f"\n> 💬 _{us.get('comment','')}_\n"
    ) if us else ""
 
    earnings_lines = []
    for e in c.get("earnings", []):
        ticker  = e.get("ticker", "")
        name    = e.get("name", "")
        beat    = e.get("beat", "")
        hl      = e.get("headline", "")
        analysis = e.get("analysis", "")
        entry   = e.get("entry", "")
        t1      = e.get("target1", "")
        t2      = e.get("target2", "")
        stop    = e.get("stop", "")
        comment = e.get("comment", "")
        line = (
            f"\n### {ticker}|{name} - {beat}\n"
            f"**{hl}**\n{analysis}\n"
            f"- エントリー:{entry} | 目標1:{t1} | 目標2:{t2} | 損切:{stop}\n"
            f"> 💬 かぶぼっち:{comment}\n"
        )
        earnings_lines.append(line)
    earnings_md = "".join(earnings_lines) if earnings_lines else "本日は主要な決算発表なし。"
 
    consider = c.get("consideration", {})
    def fmt_strategy(s):
        if isinstance(s, str):
            return s
        if isinstance(s, dict):
            return s.get("name", "") + "：" + s.get("action", s.get("rationale", str(s)))
        return str(s)
    strategy_lines = ["- " + fmt_strategy(s) for s in c.get("strategy", [])]
    strategy_md = "\n".join(strategy_lines)
 
    events_lines = ["| 日時 | イベント | 重要度 |", "|------|---------|--------|"]
    for e in c.get("events", []):
        date = e.get("date", "")
        text = e.get("text", "")
        urgent = "⚠️ 超重要" if e.get("urgent") else "👀 注目"
        events_lines.append(f"| {date} | {text} | {urgent} |")
    events_md = "\n".join(events_lines)
 
    note = (
        f"{emoji} swing-station 朝刊|{TODAY}({WEEKDAY_JP})【{m['label']}】\n\n"
        f"> {m['quote']}\n\n"
        f"---\n\n"
        f"## 📊 本日の主要指標\n\n"
        f"| 指標 | 数値 | 前日比 |\n"
        f"|------|------|--------|\n"
        f"| 日経平均 | {data['latest']['close']:,}円 | {sign}{abs(int(diff)):,}円({dc}{pct:.2f}%)|\n"
        f"| ドル円 | {data['usd_jpy']}円 | - |\n"
        f"| SOX指数 | - | 前日比{data['sox_pct']:+.1f}% |\n"
        f"| VIX | {data['vix']} | {'⚠️警戒域' if data['vix'] >= 25 else '安定'} |\n\n"
        f"{c.get('market_summary', '')}\n\n"
        f"---\n\n"
        f"## 📰 主要ニュース\n{news_md}\n"
        f"---\n\n"
        f"## 🎯 本日の注目銘柄 5選\n\n"
        f"### 🇯🇵 日本株(4銘柄)\n{stocks_jp_md}\n"
        f"### 🇺🇸 米国株(1銘柄)\n{us_md}\n"
        f"---\n\n"
        f"## 🔔 決算速報\n{earnings_md}\n\n"
        f"---\n\n"
        f"## 🧠 かぶぼっちの総合考察\n\n"
        f"{consider.get('main', '')}\n\n"
        f"---\n\n"
        f"**⚡ 今日の相場で一番重要なこと**\n\n"
        f"> {consider.get('point', '')}\n\n"
        f"**📋 かぶぼっちからのアクション提案**\n\n"
        f"{consider.get('action', '')}\n\n"
        f"---\n\n"
        f"## ⚡ 今日の戦略まとめ\n\n{strategy_md}\n\n"
        f"---\n\n"
        f"## 📅 今週のイベントカレンダー\n\n{events_md}\n\n"
        f"---\n\n"
        f"{c.get('note_cta', '詳細はnoteマガジンで！')}\n\n"
        f"---\n\n"
        f"⚠️ 本記事は情報提供のみを目的としており、投資勧誘ではありません。\n"
        f"📡 swing-station|かぶぼっち|毎朝6:30自動配信\n"
    )
    return note
 
 
def send_to_discord(banner_buf, chart_buf, note_text, c, data, mode):
    m    = MODES[mode]
    diff = data["diff"]
    sign = "▲" if diff >= 0 else "▼"
    pct  = data["pct"]

    color_map = {
        "normal": 0x3498db, "surge": 0x2ecc71,
        "crash": 0xe74c3c, "ai": 0x9b59b6,
    }
    color = color_map.get(mode, 0x3498db)

    def post_json(payload):
        r = requests.post(DISCORD_WEBHOOK, json=payload)
        if r.status_code not in (200, 204):
            print(f"Discord error: {r.status_code} {r.text}")

    def post_files(text, files):
        r = requests.post(DISCORD_WEBHOOK, data={"content": text}, files=files)
        if r.status_code not in (200, 204):
            print(f"Discord error: {r.status_code} {r.text}")

    stocks_jp = c.get("stocks_jp", [])
    stock_fields = []
    for s in stocks_jp[:9]:
        name    = s.get("name", "")
        code    = s.get("code", "")
        pattern = s.get("pattern", "")
        score   = s.get("score", 7)
        entry   = s.get("entry", "")
        target  = s.get("target", "")
        stop    = s.get("stop", "")
        comment = s.get("comment", "")
        stock_fields.append({
            "name": f"**{name}（{code}）** [{pattern}] {score}/10",
            "value": f"📌 {entry}\n🎯 {target}　🛡️ {stop}\n💬 _{comment}_",
            "inline": True
        })

    us = c.get("stock_us", {})
    if us:
        stock_fields.append({
            "name": f"**{us.get('name','')}（{us.get('ticker','')}）** [{us.get('pattern','')}] {us.get('score',7)}/10",
            "value": f"📌 {us.get('entry','')}\n🎯 {us.get('target','')}　🛡️ {us.get('stop','')}\n💬 _{us.get('comment','')}_",
            "inline": True
        })

    consider = c.get("consideration", {})

    embed_main = {
        "embeds": [{
            "title": f"📡 swing-station 朝刊 | {TODAY}({WEEKDAY_JP})",
            "description": (
                f"**{m['label']}**　_{m['quote']}_\n\n"
                f"🇯🇵 日経平均　**{data['latest']['close']:,}円**　{sign}{abs(int(diff)):,}円 ({pct:+.2f}%)\n"
                f"💴 ドル円　{data['usd_jpy']}円　　"
                f"📉 SOX　{data['sox_pct']:+.1f}%　　"
                f"😱 VIX　{data['vix']}\n\n"
                f"{c.get('market_summary', '')}"
            ),
            "color": color,
            "footer": {"text": "swing-station | かぶぼっち | ※投資勧誘ではありません"}
        }]
    }
    post_json(embed_main)

    embed_stocks = {
        "embeds": [{
            "title": "🎯 本日の注目銘柄 10選",
            "color": color,
            "fields": stock_fields[:5]
        }]
    }
    post_json(embed_stocks)

    if len(stock_fields) > 6:
        embed_stocks2 = {
            "embeds": [{
                "title": "🎯 注目銘柄（続き）",
                "color": color,
                "fields": stock_fields[6:]
            }]
        }
        post_json(embed_stocks2)

    embed_strategy = {
        "embeds": [{
            "title": "🧠 かぶぼっちの総合考察",
            "description": (
                f"{consider.get('main', '')}\n\n"
                f"**⚡ 今日の一番重要なこと**\n> {consider.get('point', '')}\n\n"
                f"**📋 アクション提案**\n{consider.get('action', '')}"
            ),
            "color": color
        }]
    }
    post_json(embed_strategy)

    banner_buf.seek(0)
    chart_buf.seek(0)
    post_files("", files={
        "banner": ("banner.png", banner_buf, "image/png"),
        "chart":  ("chart.png",  chart_buf,  "image/png"),
    })

    # note専用本文をDiscordに送信（コードブロックなしの通常テキストでコピペしやすく）
    _y, _m, _d = TODAY.split("/")
    title_line = f"📰 **KABU BOCCHI 朝刊｜{_y}年{int(_m)}月{int(_d)}日**\n\n"
    note_body = c.get("note_body", note_text)
    chunks = [note_body[i:i+1900] for i in range(0, len(note_body), 1900)]
    for i, chunk in enumerate(chunks):
        prefix = "**📝 note本文(コピペして投稿)**\n\n" + title_line if i == 0 else ""
        post_json({"content": prefix + chunk})

    x_teaser = c.get("x_teaser_3line", "")
    if x_teaser:
        post_json({"content": f"**📱 X告知用（3行）**\n\n{x_teaser}"})

    x_posts = c.get("x_posts", [c.get("x_main", "")])
    x_fields = []
    for i, xp in enumerate(x_posts[:3], 1):
        x_fields.append({"name": f"投稿{i}", "value": f"```\n{xp[:450]}\n```", "inline": False})
    if x_fields:
        post_json({
            "embeds": [{
                "title": "📱 X投稿文（コピペしてそのまま投稿）",
                "color": color,
                "fields": x_fields
            }]
        })

    print("Discord send complete!")
 
 
if __name__ == "__main__":
    print(f"\nswing-station morning briefing | {TODAY}({WEEKDAY_JP})")
 
    print("Fetching market data...")
    data = fetch_market_data()
    print(f"Nikkei:{data['latest']['close']:,} / USD/JPY:{data['usd_jpy']} / SOX:{data['sox_pct']:+.1f}% / VIX:{data['vix']}")
 
    mode = detect_mode(data)
    print(f"Market mode: {MODES[mode]['label']}")
 
    print("Generating content with Claude API...")
    content = generate_content(data, mode)
    
    print("Running quality check...")
    valid_codes = [s[0] for s in STOCKS_JP]
    ok, issues = run_quality_check(content, valid_codes, ANTHROPIC_API_KEY)
    if not ok:
        print(f"Quality issues: {issues}")
        print("Regenerating...")
        content = generate_content(data, mode)
        ok2, issues2 = run_quality_check(content, valid_codes, ANTHROPIC_API_KEY)
        if not ok2:
            print(f"Still has issues after regeneration: {issues2}")
        else:
            print("Quality check passed after regeneration!")
    else:
        print("Quality check passed!")
 
    print("Generating chart...")
    chart_buf = generate_chart(data, mode)
 
    print("Generating banner...")
    banner_buf = generate_banner(data, mode)
 
    print("Generating note text...")
    note_text = generate_note(data, mode, content)
 
    print("Sending to Discord...")
    send_to_discord(banner_buf, chart_buf, note_text, content, data, mode)

    print("Saving data/latest.json...")
    diff = data["diff"]
    # surges/drops・セクターヒートマップをメインスコープで取得（1回のfetchで両方作る）
    try:
        _all_changes = fetch_all_watch_changes()
        _surges, _drops = fetch_surge_drop(_all_changes)
        _sector_heatmap = build_sector_heatmap(_all_changes)
        _jp_top_movers = top_movers(_all_changes, 10)
    except Exception as e:
        print(f"Surge/drop/heatmap fetch error: {e}")
        _all_changes, _surges, _drops, _sector_heatmap, _jp_top_movers = [], [], [], [], []
    try:
        _us_changes = fetch_us_watch_changes()
        _us_sector_heatmap = build_sector_heatmap(_us_changes)
        _us_top_movers = top_movers(_us_changes, 10)
    except Exception as e:
        print(f"US watchlist fetch error: {e}")
        _us_changes, _us_sector_heatmap, _us_top_movers = [], [], []

    # 取得が0件（レート制限等）の場合は、空データで前回の良いデータを上書きしないよう
    # ローカルの前回データにフォールバックする
    if not _all_changes or not _us_changes:
        try:
            with open("data/latest.json", "r", encoding="utf-8") as f:
                _prev_latest = json.load(f)
        except Exception:
            _prev_latest = {}
        if not _all_changes:
            print("⚠ 日本株ウォッチリスト0件のため前回データを維持")
            _surges = _prev_latest.get("surges", [])
            _drops = _prev_latest.get("drops", [])
            _sector_heatmap = _prev_latest.get("sector_heatmap", [])
            _jp_top_movers = _prev_latest.get("jp_top_movers", [])
            _all_changes = _prev_latest.get("jp_all_changes", [])
        if not _us_changes:
            print("⚠ 米国株ウォッチリスト0件のため前回データを維持")
            _us_sector_heatmap = _prev_latest.get("us_sector_heatmap", [])
            _us_top_movers = _prev_latest.get("us_top_movers", [])
            _us_changes = _prev_latest.get("us_all_changes", [])

    latest_json = {
        "date": f"{TODAY}",
        "mode": mode,
        "market_summary": content.get("market_summary", ""),
        "nikkei": data["latest"]["close"],
        "nikkei_diff": int(diff),
        "nikkei_pct": data["pct"],
        "usd_jpy": data["usd_jpy"],
        "usd_jpy_pct": data.get("usd_jpy_pct", 0.0),
        "sox_pct": data["sox_pct"],
        "sox": data.get("sox", 0.0),
        "vix": data["vix"],
        "vix_pct": data.get("vix_pct", 0.0),
        "us10y": data.get("us10y", 0.0),
        "us10y_diff": data.get("us10y_diff", 0.0),
        "fear_greed_value": data.get("fear_greed_value"),
        "fear_greed_label": data.get("fear_greed_label"),
        "fear_greed_prev": data.get("fear_greed_prev"),
        "fear_greed_diff": data.get("fear_greed_diff"),
        "btc": data.get("btc", 0.0), "btc_pct": data.get("btc_pct", 0.0),
        "dxy": data.get("dxy", 0.0), "dxy_pct": data.get("dxy_pct", 0.0),
        "gold": data.get("gold", 0.0), "gold_pct": data.get("gold_pct", 0.0),
        "topix": data.get("topix", 0.0),
        "topix_pct": data.get("topix_pct", 0.0),
        "nasdaq": data.get("nasdaq", 0.0),
        "nasdaq_pct": data.get("nasdaq_pct", 0.0),
        "sp500": data.get("sp500", 0.0),
        "sp500_pct": data.get("sp500_pct", 0.0),
        "news": content.get("news", []),
        "stocks_jp": content.get("stocks_jp", []),
        "stock_us": content.get("stock_us", {}),
        "consideration": content.get("consideration", {}),
        "surges": _surges,
        "drops": _drops,
        "sector_heatmap": _sector_heatmap,
        "jp_top_movers": _jp_top_movers,
        "jp_all_changes": _all_changes,
        "us_sector_heatmap": _us_sector_heatmap,
        "us_top_movers": _us_top_movers,
        "us_all_changes": _us_changes,
        "events_jp": content.get("events_jp", []),
        "events_us": content.get("events_us", []),
        "x_posts": content.get("x_posts", []),
        "x_teaser_3line": content.get("x_teaser_3line", ""),
        "note_body": content.get("note_body", ""),
        "note_cta": content.get("note_cta", ""),
    }

    gh_token = os.environ.get("GH_PAT", "")
    if gh_token:
        try:
            gh_url = "https://api.github.com/repos/konnpei/swing-station/contents/data/latest.json"
            r_existing = requests.get(gh_url, headers={"Authorization": f"Bearer {gh_token}"})
            sha_existing = r_existing.json().get("sha") if r_existing.status_code == 200 else None

            # 既存のlatest.jsonをベースにマージする。refresh_earnings.py/weekly_review.py/
            # weekly_preview.py等の軽量スクリプトが追加したフィールド（jp_earnings_calendar,
            # weekly_review 等）をこの完全上書き処理で消してしまわないようにするため。
            merged_json = {}
            if r_existing.status_code == 200:
                try:
                    existing_content = base64.b64decode(r_existing.json()["content"]).decode("utf-8")
                    merged_json = json.loads(existing_content)
                except Exception as merge_err:
                    print(f"既存latest.jsonの読み込みに失敗（新規として続行）: {merge_err}")
            merged_json.update(latest_json)

            content_b64 = base64.b64encode(json.dumps(merged_json, ensure_ascii=False, indent=2).encode("utf-8")).decode("ascii")
            body = {"message": f"Update latest.json {TODAY}", "content": content_b64}
            if sha_existing:
                body["sha"] = sha_existing
            r_put = requests.put(gh_url, headers={"Authorization": f"Bearer {gh_token}", "Content-Type": "application/json"}, json=body)
            print(f"data/latest.json updated: {r_put.status_code}")

            # 履歴ファイルも保存（data/history/YYYY-MM-DD.json）
            try:
                from datetime import datetime as _dt
                hist_date = _dt.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")
                hist_url = f"https://api.github.com/repos/konnpei/swing-station/contents/data/history/{hist_date}.json"
                r_hist_check = requests.get(hist_url, headers={"Authorization": f"Bearer {gh_token}"})
                hist_body = {"message": f"History: {hist_date}", "content": content_b64}
                if r_hist_check.status_code == 200:
                    hist_body["sha"] = r_hist_check.json().get("sha")
                requests.put(hist_url, headers={"Authorization": f"Bearer {gh_token}", "Content-Type": "application/json"}, json=hist_body)
                print(f"History saved: {hist_date}")
            except Exception as he:
                print(f"History save error: {he}")

            # 日経チャート画像もサイト表示用に保存（data/latest_chart.png）
            try:
                chart_buf.seek(0)
                chart_png_b64 = base64.b64encode(chart_buf.read()).decode("ascii")
                chart_url = "https://api.github.com/repos/konnpei/swing-station/contents/data/latest_chart.png"
                r_chart_check = requests.get(chart_url, headers={"Authorization": f"Bearer {gh_token}"})
                chart_body = {"message": f"Update chart {TODAY}", "content": chart_png_b64}
                if r_chart_check.status_code == 200:
                    chart_body["sha"] = r_chart_check.json().get("sha")
                r_chart_put = requests.put(chart_url, headers={"Authorization": f"Bearer {gh_token}", "Content-Type": "application/json"}, json=chart_body)
                print(f"data/latest_chart.png updated: {r_chart_put.status_code}")
            except Exception as ce:
                print(f"Chart image save error: {ce}")

            # Vercel再デプロイをトリガー
            vercel_hook = os.environ.get("VERCEL_DEPLOY_HOOK", "")
            if vercel_hook:
                try:
                    vr = requests.post(vercel_hook)
                    print(f"Vercel redeploy triggered: {vr.status_code}")
                except Exception as ve:
                    print(f"Vercel trigger error: {ve}")
        except Exception as e:
            print(f"Failed to update data/latest.json: {e}")
    else:
        print("GH_PAT not set, skipping data/latest.json update")
 
    print("\nDone! Auto-delivery at 6:30 AM JST daily.")
