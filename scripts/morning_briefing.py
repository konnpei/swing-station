
swing-station: morning_briefing.py（かぶぼっち完全版 v3）
毎朝6:30に以下を生成してDiscordに一括送信：
  1. 地合いバナー画像（ブルベア画像＋8モード自動判定）
  2. 日経225チャート画像（OHLC+出来高+MACD+MA）
  3. note投稿用本文（長文・かぶぼっちコメント入り）
  4. X投稿文2種（メイン＋エンゲージメント狙い）
"""
 
import os, sys, io, json, re, base64
from datetime import datetime, timezone, timedelta
from pathlib import Path
 
import requests
import anthropic
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.gridspec import GridSpec
from PIL import Image, ImageDraw, ImageFont
 
# ══════════════════════════════════════════════
# 定数
# ══════════════════════════════════════════════
JST     = timezone(timedelta(hours=9))
NOW     = datetime.now(JST)
TODAY   = NOW.strftime("%Y/%m/%d")
TODAY_S = NOW.strftime("%m/%d")
WEEKDAY = ["月","火","水","木","金","土","日"][NOW.weekday()]
 
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
DISCORD_WEBHOOK   = os.environ["DISCORD_WEBHOOK_MAIN"]
FONT_PATH         = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
 
# ブルベア画像パス（リポジトリのimagesフォルダに配置）
BB_IMAGE_DIR = Path(__file__).parent.parent / "images"
 
MODES = {
    "normal":       {"label":"通常モード",         "color":"#3b82f6", "bg":(13,26,46),  "bb":"normal.png",  "quote":"「方向感のない日こそ、銘柄選別の腕の見せどころ。」"},
    "surge":        {"label":"爆騰モード",         "color":"#22c55e", "bg":(8,25,8),    "bb":"surge.png",   "quote":"「強い相場は強い。乗り遅れるな。」"},
    "crash":        {"label":"暴落モード",         "color":"#ef4444", "bg":(28,8,8),    "bb":"crash.png",   "quote":"「嵐の日こそ、次の仕込みを考える日。」"},
    "ai":           {"label":"AIバブルモード",     "color":"#a855f7", "bg":(15,8,28),   "bb":"ai.png",      "quote":"「AI祭りの熱狂に乗れ。ただし出口を常に意識して。」"},
    "yen":          {"label":"円高ショックモード", "color":"#06b6d4", "bg":(8,22,28),   "bb":"normal.png",  "quote":"「円高は輸出株の敵、内需株の友。」"},
    "rate_cut":     {"label":"利下げ期待モード",   "color":"#f59e0b", "bg":(28,18,0),   "bb":"surge.png",   "quote":"「金利が下がれば、グロースの春が来る。」"},
    "earnings":     {"label":"決算祭りモード",     "color":"#ec4899", "bg":(28,8,18),   "bb":"normal.png",  "quote":"「決算は相場の通知表。サプライズを狙え。」"},
    "geopolitical": {"label":"地政学リスクモード", "color":"#f97316", "bg":(28,12,0),   "bb":"crash.png",   "quote":"「有事の金・円・原油。リスクオフの鉄則を忘れるな。」"},
}
 
# ══════════════════════════════════════════════
# 1. 相場データ取得
# ══════════════════════════════════════════════
def fetch_market_data():
    try:
        import yfinance as yf
 
        hist = yf.Ticker("^N225").history(period="20d")
        if hist.empty: raise ValueError("日経データなし")
 
        ohlcv = []
        for date, row in hist.tail(10).iterrows():
            ohlcv.append({
                "date":   date.strftime("%m/%d"),
                "open":   int(row["Open"]),
                "high":   int(row["High"]),
                "low":    int(row["Low"]),
                "close":  int(row["Close"]),
                "volume": max(1, int(row["Volume"] / 1e8)),
            })
 
        latest = ohlcv[-1]; prev = ohlcv[-2]
        diff = latest["close"] - prev["close"]
        pct  = diff / prev["close"] * 100
 
        try:
            fx = yf.Ticker("USDJPY=X").history(period="2d")
            usd_jpy = round(float(fx["Close"].iloc[-1]), 2)
        except: usd_jpy = 155.0
 
        try:
            sox_h = yf.Ticker("^SOX").history(period="8d")
            sox_pct = (float(sox_h["Close"].iloc[-1]) - float(sox_h["Close"].iloc[-6])) / float(sox_h["Close"].iloc[-6]) * 100 if len(sox_h) >= 6 else 0.0
        except: sox_pct = 0.0
 
        try:
            vix_h = yf.Ticker("^VIX").history(period="2d")
            vix = round(float(vix_h["Close"].iloc[-1]), 1)
        except: vix = 20.0
 
        return {"ohlcv":ohlcv, "latest":latest, "diff":diff, "pct":pct,
                "usd_jpy":usd_jpy, "sox_pct":sox_pct, "vix":vix}
 
    except Exception as e:
        print(f"市場データ取得エラー（フォールバック使用）: {e}")
        ohlcv = [
            {"date":"6/11","open":64100,"high":64500,"low":63800,"close":64217,"volume":24},
            {"date":"6/12","open":64200,"high":66500,"low":64100,"close":66020,"volume":42},
            {"date":"6/13","open":66000,"high":66800,"low":65500,"close":66400,"volume":31},
            {"date":"6/16","open":66100,"high":69500,"low":65900,"close":69317,"volume":48},
            {"date":"6/17","open":69200,"high":69600,"low":68900,"close":69404,"volume":28},
            {"date":"6/18","open":69300,"high":70100,"low":69100,"close":69750,"volume":33},
            {"date":"6/19","open":69600,"high":70200,"low":69400,"close":69902,"volume":35},
        ]
        return {"ohlcv":ohlcv, "latest":ohlcv[-1], "diff":498, "pct":0.72,
                "usd_jpy":155.0, "sox_pct":3.2, "vix":16.5}
 
# ══════════════════════════════════════════════
# 2. 地合いモード自動判定
# ══════════════════════════════════════════════
def detect_mode(data):
    pct = data["pct"]; sox = data["sox_pct"]
    usd = data["usd_jpy"]; vix = data["vix"]
 
    if pct <= -2.5 or vix >= 30:    return "crash"
    if pct >= 2.0 and sox >= 3.0:   return "ai"
    if pct >= 2.0:                   return "surge"
    if usd <= 148.0:                 return "yen"
    if sox >= 3.0:                   return "ai"
    if vix >= 25:                    return "geopolitical"
    return "normal"
 
# ══════════════════════════════════════════════
# 3. Claude APIでコンテンツ生成
# ══════════════════════════════════════════════
def generate_content(data, mode):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    m = MODES[mode]
    sign = "▲" if data["diff"] >= 0 else "▼"
 
    prompt = f"""あなたはスイングトレーダー向けの人気コンテンツクリエイター「かぶぼっち」です。
毎朝6:30にDiscordとnoteに朝刊を配信しています。
 
【本日の相場データ】
- 日付：{TODAY}（{WEEKDAY}）
- 日経平均：{data["latest"]["close"]:,}円（{sign}{abs(int(data["diff"])):,}円 / {data["pct"]:+.2f}%）
- ドル円：{data["usd_jpy"]}円
- SOX指数：先週比{data["sox_pct"]:+.1f}%
- VIX：{data["vix"]}
- 地合いモード：{m["label"]}
- 名言：{m["quote"]}
 
【かぶぼっちキャラ設定】
- 毒舌だけど本質をつく
- 面白い比喩・たとえ話が得意
- 難しいことをわかりやすく説明
- 読者が「買いたい！続きを読みたい！」と思う文章
- 一人称は「かぶぼっち」
 
以下のJSON形式で返してください（JSONのみ、```不要）：
{{
  "market_summary": "相場概況（3-4文、かぶぼっちらしい表現）",
  "news": [
    {{"tag":"日本|米国|警戒|チャンス", "headline":"思わずクリックしたくなる見出し", "body":"2-3文（毒舌・ユーモア・本質の3要素）"}}
  ],
  "stocks_jp": [
    {{"pattern":"パターン名", "code":"証券コード", "name":"銘柄名", "score":8,
      "entry":"エントリー価格帯", "target":"+3%", "stop":"-2%",
      "reason":"選定理由（具体的な数字・チャート根拠含む2-3文）",
      "kabubocchi_comment":"かぶぼっちからの一言（ユーモアと本質）"}}
  ],
  "stock_us": {{"pattern":"バフェット式", "ticker":"$XXX", "name":"銘柄名", "score":8,
    "entry":"エントリー価格帯", "target":"+3%", "stop":"-2%",
    "reason":"選定理由（2-3文）", "kabubocchi_comment":"かぶぼっちからの一言"}},
  "earnings": [
    {{"ticker":"AAPL", "name":"Apple", "beat":"EPS+X%ビート",
      "headline":"決算を面白く表現した見出し",
      "analysis":"詳細分析（4-5文、数字・強気材料・懸念材料・スイングシナリオ含む）",
      "entry":"$XXX-XXX", "target1":"$XXX", "target2":"$XXX（強気）", "stop":"$XXX",
      "kabubocchi_comment":"かぶぼっちからの一言"}}
  ],
  "consideration": {{
    "main": "かぶぼっちの総合考察（400文字程度・面白い比喩・毒舌・本質・具体的アドバイス）",
    "point": "今日の相場で一番重要なポイント（1文・強烈なインパクト）",
    "action": "読者へのアクション提案（具体的に何をすべきか）"
  }},
  "strategy": ["具体的な戦略5件（アクションと根拠含む）"],
  "events": [{{"date":"日時", "text":"イベント内容", "urgent":true}}],
  "x_main": "メインX投稿（280文字以内・絵文字多め・ハッシュタグ3個・note誘導）",
  "x_engage": "エンゲージメント狙い投稿（200文字以内・問いかけ型・株クラが反応したくなる内容）",
  "note_cta": "noteへの誘導文（読者が思わずクリックしたくなる1文）"
}}
銘柄は実在する日本株9件＋米国株1件を選んでください。
パターン：イベントドリブン/暴落リバウンド/モメンタム/押し目買い/出来高急増/ギャップアップ/セクターローテーション/清原式割安/井村式急回復"""
 
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=5000,
        messages=[{"role":"user","content":prompt}]
    )
 
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"JSONパースエラー: {e}")
        raise
 
# ══════════════════════════════════════════════
# 4. チャート生成
# ══════════════════════════════════════════════
def generate_chart(data, mode):
    fm.fontManager.addfont(FONT_PATH)
    fp = fm.FontProperties(fname=FONT_PATH)
    plt.rcParams["font.family"] = fp.get_name()
 
    m = MODES[mode]; accent = m["color"]
    ohlcv = data["ohlcv"]
    dates  = [d["date"]   for d in ohlcv]
    opens  = [d["open"]   for d in ohlcv]
    highs  = [d["high"]   for d in ohlcv]
    lows   = [d["low"]    for d in ohlcv]
    closes = [d["close"]  for d in ohlcv]
    vols   = [d["volume"] for d in ohlcv]
 
    def ma(arr, p): return [None if i<p-1 else float(np.mean(arr[i-p+1:i+1])) for i in range(len(arr))]
    def ema(arr, p):
        k=2/(p+1); e=[arr[0]]
        for c in arr[1:]: e.append(c*k+e[-1]*(1-k))
        return e
 
    ma5=ma(closes,5); ma25=ma(closes,25)
    e12=ema(closes,12); e26=ema(closes,26)
    macd=[a-b for a,b in zip(e12,e26)]; sig=ema(macd,9)
 
    BG="#0d1117"; GRID="#1e2535"; TEXT="#9ca3af"; GREEN="#22c55e"; RED="#ef4444"
 
    fig=plt.figure(figsize=(12,8),facecolor=BG)
    gs=GridSpec(3,1,figure=fig,hspace=0.06,height_ratios=[3,1,1.2])
    ax1=fig.add_subplot(gs[0]); ax2=fig.add_subplot(gs[1],sharex=ax1); ax3=fig.add_subplot(gs[2],sharex=ax1)
 
    for ax in [ax1,ax2,ax3]:
        ax.set_facecolor(BG); ax.tick_params(colors=TEXT,labelsize=9)
        for sp in ["top","right"]: ax.spines[sp].set_visible(False)
        for sp in ["bottom","left"]: ax.spines[sp].set_color(GRID)
        ax.yaxis.grid(True,color=GRID,lw=0.5,ls="--",alpha=0.6); ax.set_axisbelow(True)
 
    x=np.arange(len(dates)); W=0.4
    for i in x:
        c=GREEN if closes[i]>=opens[i] else RED
        ax1.plot([i,i],[lows[i],highs[i]],color=c,lw=1.2,zorder=2)
        bh=max(abs(closes[i]-opens[i]),(highs[i]-lows[i])*0.04)
        ax1.add_patch(plt.Rectangle((i-W/2,min(opens[i],closes[i])),W,bh,color=c,zorder=3))
 
    ma5_x=[i for i,v in enumerate(ma5) if v]; ma5_v=[v for v in ma5 if v]
    ma25_x=[i for i,v in enumerate(ma25) if v]; ma25_v=[v for v in ma25 if v]
    ax1.plot(ma5_x,ma5_v,color="#3b82f6",lw=1.8,label="MA5")
    ax1.plot(ma25_x,ma25_v,color="#f59e0b",lw=1.8,label="MA25")
    ax1.set_ylim(min(lows)*0.997,max(highs)*1.003)
    ax1.tick_params(labelbottom=False)
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda v,_: f"{int(v):,}"))
    ax1.legend(loc="upper left",fontsize=9,facecolor="#1a2030",edgecolor=GRID,labelcolor=TEXT,prop=fp)
 
    diff=closes[-1]-closes[-2]; pct2=diff/closes[-2]*100; sign="▲" if diff>=0 else "▼"
    ax1.set_title(f"日経平均  {closes[-1]:,}円   {sign}{abs(int(diff)):,}  ({pct2:+.2f}%)",
        color=TEXT,fontsize=13,pad=12,loc="left",fontproperties=fp)
    ax1.text(0.995,0.97,f"[{m['label']}]",transform=ax1.transAxes,ha="right",va="top",
        fontsize=10,color=accent,fontproperties=fp,
        bbox=dict(boxstyle="round,pad=0.4",facecolor=BG,edgecolor=accent,alpha=0.9))
 
    vcols=[GREEN if closes[i]>=opens[i] else RED for i in range(len(x))]
    ax2.bar(x,vols,color=vcols,alpha=0.65,width=0.7)
    ax2.set_ylabel("出来高",color=TEXT,fontsize=8,fontproperties=fp)
    ax2.tick_params(labelbottom=False)
 
    mcols=[GREEN if v>=0 else RED for v in macd]
    ax3.bar(x,macd,color=mcols,alpha=0.7,width=0.7)
    ax3.plot(x,sig,color="#f59e0b",lw=1.8,label="Signal")
    ax3.axhline(0,color=GRID,lw=0.8)
    ax3.set_ylabel("MACD",color=TEXT,fontsize=8,fontproperties=fp)
    ax3.legend(loc="upper right",fontsize=8,facecolor="#1a2030",edgecolor=GRID,labelcolor=TEXT,prop=fp)
    ax3.set_xticks(x); ax3.set_xticklabels(dates,rotation=0,fontsize=9,color=TEXT,fontfamily=fp.get_name())
    fig.text(0.99,0.005,f"swing-station | {TODAY}  ※投資勧誘ではありません",
        ha="right",va="bottom",fontsize=7,color="#4b5563",fontproperties=fp)
 
    buf=io.BytesIO()
    plt.savefig(buf,dpi=150,bbox_inches="tight",facecolor=BG,format="png")
    plt.close(); buf.seek(0)
    return buf
 
# ══════════════════════════════════════════════
# 5. バナー生成（ブルベア画像付き）
# ══════════════════════════════════════════════
def generate_banner(data, mode):
    m = MODES[mode]; W, H = 1200, 500
 
    def hex2rgb(h):
        h=h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))
    accent = hex2rgb(m["color"]); bg = m["bg"]
 
    canvas = Image.new("RGB", (W,H), bg)
 
    # ブルベア画像を左側に配置
    bb_path = BB_IMAGE_DIR / m["bb"]
    if bb_path.exists():
        bb = Image.open(bb_path).convert("RGBA")
        bb_w = 580; bb_h = int(bb.height * bb_w / bb.width)
        bb = bb.resize((bb_w, bb_h), Image.LANCZOS)
        paste_y = (H - bb_h) // 2
        temp = Image.new("RGBA", (W,H), (0,0,0,0))
        temp.paste(bb, (0, paste_y), bb)
 
        # 右側フェードオーバーレイ
        ov = Image.new("RGBA", (W,H), (0,0,0,0))
        od = ImageDraw.Draw(ov)
        for px in range(440, W):
            a = min(255, int((px-440)/(W-440)*245))
            od.line([(px,0),(px,H)], fill=(*bg,a))
 
        canvas = canvas.convert("RGBA")
        canvas.alpha_composite(temp)
        canvas.alpha_composite(ov)
        canvas = canvas.convert("RGB")
 
    draw = ImageDraw.Draw(canvas)
 
    # アクセントライン
    for i in range(6):
        a = int(220*(1-i/6))
        draw.rectangle([(0,i),(W,i+1)], fill=(*accent,a))
 
    try:
        fn_xl=ImageFont.truetype(FONT_PATH,56); fn_lg=ImageFont.truetype(FONT_PATH,30)
        fn_md=ImageFont.truetype(FONT_PATH,22); fn_sm=ImageFont.truetype(FONT_PATH,16)
        fn_xs=ImageFont.truetype(FONT_PATH,13)
    except: fn_xl=fn_lg=fn_md=fn_sm=fn_xs=ImageFont.load_default()
 
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
    tx = 500
 
    # バッジ
    draw.rounded_rectangle([(tx,28),(tx+210,66)],radius=20,fill=(*accent,40),outline=(*accent,200),width=2)
    draw.text((tx+14,38), f"[{m['label']}]", fill=(*accent,255), font=fn_sm)
 
    # ヘッドライン
    draw.text((tx,76),  hl,         fill=(*accent,255),     font=fn_xl)
    draw.text((tx,150), sub,        fill=(180,200,180,255), font=fn_lg)
    draw.text((tx,194), m["quote"], fill=(*accent,130),     font=fn_sm)
 
    # 指標ボックス
    diff=data["diff"]; sign="▲" if diff>=0 else "▼"
    metrics = [
        ("日経平均", f"{data['latest']['close']:,}円", f"{sign}{abs(int(diff)):,}({data['pct']:+.2f}%)"),
        ("ドル円",   f"{data['usd_jpy']}",              "円安" if data["usd_jpy"]>=150 else "円高"),
        ("SOX",      "先週比",                           f"{data['sox_pct']:+.1f}%"),
        ("VIX",      f"{data['vix']}",                  "警戒" if data["vix"]>=25 else "安定"),
    ]
    bx=tx; by=248
    for label, val, chg in metrics:
        draw.rounded_rectangle([(bx,by),(bx+162,by+86)],radius=10,
            fill=(255,255,255,12),outline=(255,255,255,20),width=1)
        draw.text((bx+8,by+6),  label, fill=(120,140,120,255), font=fn_xs)
        draw.text((bx+8,by+28), val,   fill=(220,240,220,255), font=fn_md)
        chg_c=(34,197,94,255) if ("▲" in chg or "+" in chg) else (239,68,68,255) if ("▼" in chg or "-" in chg) else (180,190,210,255)
        draw.text((bx+8,by+58), chg,   fill=chg_c, font=fn_xs)
        bx += 174
 
    # ロゴ
    draw.text((W-240,30), "swing-station", fill=(*accent,90), font=fn_lg)
    draw.text((W-168,64), "かぶぼっち",    fill=(*accent,60), font=fn_sm)
    draw.text((W-210,84), "毎朝6:30配信",  fill=(50,80,50,255), font=fn_xs)
 
    # フッター
    draw.rectangle([(0,H-30),(W,H)], fill=(0,0,0,200))
    draw.text((16,H-20),
        f"swing-station | {TODAY}({WEEKDAY})  ※本コンテンツは情報提供のみを目的としており投資勧誘ではありません",
        fill=(60,90,60,255), font=fn_xs)
 
    buf=io.BytesIO(); canvas.save(buf,format="PNG"); buf.seek(0)
    return buf
 
# ══════════════════════════════════════════════
# 6. note本文生成（完全版）
# ══════════════════════════════════════════════
def generate_note(data, mode, c):
    m=MODES[mode]; diff=data["diff"]; pct=data["pct"]
    sign="▲" if diff>=0 else "▼"; dc="+" if diff>=0 else ""
    emoji={"normal":"📊","surge":"🚀","crash":"💥","ai":"🤖","yen":"💴","rate_cut":"💰","earnings":"🎯","geopolitical":"⚠️"}.get(mode,"📊")
 
    news_md="".join([f"
**{n.get('tag','')}｜{n.get('headline','')}**
{n.get('body','')}
" for n in c.get("news",[])])
 
    stocks_jp_md=""
    for i,s in enumerate(c.get("stocks_jp",[]),1):
        sc=s.get("score",7)
        stocks_jp_md+=f"""
**{i}. {s.get("pattern","")}｜{s.get("name","")}（{s.get("code","")}）{"★"*sc}{"☆"*(10-sc)} {sc}/10**
- エントリー：{s.get("entry","")} ｜ 目標：{s.get("target","")} ｜ 損切：{s.get("stop","")}
- {s.get("reason","")}
> 💬 **かぶぼっち：**{s.get("kabubocchi_comment","")}
 
"""
 
    us=c.get("stock_us",{}); sc=us.get("score",8)
    us_md=f"""
**10. {us.get("pattern","")}｜{us.get("name","")}（{us.get("ticker","")}）{"★"*sc}{"☆"*(10-sc)} {sc}/10**
- エントリー：{us.get("entry","")} ｜ 目標：{us.get("target","")} ｜ 損切：{us.get("stop","")}
- {us.get("reason","")}
> 💬 **かぶぼっち：**{us.get("kabubocchi_comment","")}
""" if us else ""
 
    earnings_md=""
    for e in c.get("earnings",[]):
        earnings_md+=f"""
### {e.get("ticker","")}｜{e.get("name","")} — {e.get("beat","")}
**{e.get("headline","")}**
{e.get("analysis","")}
| | 価格 |
|--|--|
| エントリー | {e.get("entry","")} |
| 目標1 | {e.get("target1","")} |
| 目標2 | {e.get("target2","")} |
| 損切 | {e.get("stop","")} |
> 💬 **かぶぼっち：**{e.get("kabubocchi_comment","")}
"""
 
    consider=c.get("consideration",{})
    strategy_md="\n".join([f"- {s}" for s in c.get("strategy",[])])
    events_md="| 日時 | イベント | 重要度 |\n|------|---------|--------|\n"+"".join([f"| {e.get('date','')} | {e.get('text','')} | {'⚠️ 超重要' if e.get('urgent') else '👀 注目'} |\n" for e in c.get("events",[])])
 
    return f"""{emoji} swing-station 朝刊｜{TODAY}({WEEKDAY})【{m["label"]}】
 
> {m["quote"]}
 
---
 
## 📊 本日の主要指標
 
| 指標 | 数値 | 前日比 |
|------|------|--------|
| 日経平均 | {data["latest"]["close"]:,}円 | {sign}{abs(int(diff)):,}円({dc}{pct:.2f}%)|
| ドル円 | {data["usd_jpy"]}円 | — |
| SOX指数 | — | 先週比{data["sox_pct"]:+.1f}% |
| VIX | {data["vix"]} | {"⚠️警戒域" if data["vix"]>=25 else "落ち着いている"} |
 
{c.get("market_summary","")}
 
---
 
## 📰 主要ニュース
{news_md}
 
---
 
## 🎯 本日の注目銘柄 10選
 
### 🇯🇵 日本株（9銘柄）
{stocks_jp_md}
 
### 🇺🇸 米国株（1銘柄）
{us_md}
 
---
 
## 🔔 決算速報
{earnings_md if earnings_md else "本日は主要な決算発表なし。"}
 
---
 
## 🧠 かぶぼっちの総合考察
 
{consider.get("main","")}
 
---
 
**⚡ 今日の相場で一番重要なこと**
 
> {consider.get("point","")}
 
**📋 かぶぼっちからのアクション提案**
 
{consider.get("action","")}
 
---
 
## ⚡ 今日の戦略まとめ
 
{strategy_md}
 
---
 
## 📅 今週のイベントカレンダー
 
{events_md}
 
---
 
{c.get("note_cta","詳細はnoteマガジンで！")}
 
---
 
⚠️ 本記事は情報提供のみを目的としており、投資勧誘ではありません。投資はご自身の判断と責任で行ってください。
📡 swing-station｜かぶぼっち｜毎朝6:30自動配信
"""
 
# ══════════════════════════════════════════════
# 7. Discord送信
# ══════════════════════════════════════════════
def send_to_discord(banner_buf, chart_buf, note_text, c, data, mode):
    m=MODES[mode]; diff=data["diff"]; sign="▲" if diff>=0 else "▼"
 
    def post(text, files=None):
        if files: r=requests.post(DISCORD_WEBHOOK,data={"content":text},files=files)
        else:     r=requests.post(DISCORD_WEBHOOK,json={"content":text})
        if r.status_code not in (200,204): print(f"Discord送信エラー: {r.status_code}")
 
    summary=(
        f"**📡 swing-station 朝刊 | {TODAY}({WEEKDAY})**\n"
        f"**{m['label']}**  {m['quote']}\n\n"
        f"🇯🇵 日経平均：**{data['latest']['close']:,}円** {sign}{abs(int(diff)):,}円({data['pct']:+.2f}%)\n"
        f"💴 ドル円：{data['usd_jpy']}円　📉 SOX：{data['sox_pct']:+.1f}%　😱 VIX：{data['vix']}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━"
    )
    banner_buf.seek(0); chart_buf.seek(0)
    post(summary, files={"banner":("banner.png",banner_buf,"image/png"),"chart":("chart.png",chart_buf,"image/png")})
 
    chunks=[note_text[i:i+1900] for i in range(0,len(note_text),1900)]
    for i,chunk in enumerate(chunks):
        prefix="**📝 note本文（コピペして投稿）**\n```\n" if i==0 else "```\n"
        suffix="\n```" if i==len(chunks)-1 else "\n```（続く）"
        post(prefix+chunk+suffix)
 
    post(f"**📱 X投稿文**\n\n**【メイン投稿】**\n```\n{c.get('x_main','')}\n```\n\n**【エンゲージメント狙い】**\n```\n{c.get('x_engage','')}\n```")
    print("✅ Discord送信完了")
 
# ══════════════════════════════════════════════
# メイン
# ══════════════════════════════════════════════
if __name__ == "__main__":
    print(f"\n🚀 swing-station 朝刊生成開始 | {TODAY}({WEEKDAY})")
    print("📊 相場データ取得中...")
    data = fetch_market_data()
    print(f"   日経：{data['latest']['close']:,}円 / ドル円：{data['usd_jpy']} / SOX：{data['sox_pct']:+.1f}% / VIX：{data['vix']}")
 
    mode = detect_mode(data)
    print(f"🎯 地合いモード：{MODES[mode]['label']}")
 
    print("🤖 Claude APIでコンテンツ生成中...")
    content = generate_content(data, mode)
 
    print("📈 チャート生成中...")
    chart_buf = generate_chart(data, mode)
 
    print("🖼  バナー生成中...")
    banner_buf = generate_banner(data, mode)
 
    print("📝 note本文生成中...")
    note_text = generate_note(data, mode, content)
 
    print("📡 Discord送信中...")
    send_to_discord(banner_buf, chart_buf, note_text, content, data, mode)
 
    print("\n✨ 完了！毎朝6:30に自動配信されます。")
