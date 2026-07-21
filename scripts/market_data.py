"""
scripts/market_data.py

morning_briefing.py（Claude API・Discord配信を含むフル朝刊生成）と
refresh_market_data.py（市場データのみを再取得する軽量スクリプト）の
両方から使う共有モジュール。

このファイルはAPIキーやWebhookなどの環境変数を一切必要としない
（yfinance/requestsのみに依存）。株価データの取得ロジックはここに一本化し、
morning_briefing.py側では重複定義せずここからimportする。
"""
import os, json, math
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")


def sanitize_for_json(obj):
    """
    json.dumps()はデフォルトでNaN/Infinityを許容し、`NaN`という文字列を
    そのまま出力してしまう。これはJSON仕様上不正な値で、ブラウザの
    JSON.parse()等の標準準拠パーサーではパースエラーになる（サイトの
    /api/latestが500エラーになる原因になった）。
    yfinanceが返す欠損値(NaN)がそのまま紛れ込むことがあるため、
    GitHubにコミットする直前にNaN/InfinityをJSONとして正当なnullに変換する。
    """
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    return obj

WATCH_MAP = {
    "7203.T": "トヨタ自動車",
    "9984.T": "ソフトバンクG",
    "6758.T": "ソニーG",
    "6861.T": "キーエンス",
    "8306.T": "三菱UFJ",
    "9432.T": "NTT",
    "4063.T": "信越化学",
    "6954.T": "ファナック",
    "8035.T": "東京エレクトロン",
    "6367.T": "ダイキン工業",
    "8058.T": "三菱商事",
    "6098.T": "リクルートH",
    "7974.T": "任天堂",
    "4568.T": "第一三共",
    "9983.T": "ファーストリテイリング",
    "6501.T": "日立製作所",
    "7267.T": "ホンダ",
    "2914.T": "JT",
    "4543.T": "テルモ",
    "4519.T": "中外製薬",
    "6857.T": "アドバンテスト",
    "6920.T": "レーザーテック",
    "4452.T": "花王",
    "9433.T": "KDDI",
    "8316.T": "三井住友FG",
    "7751.T": "キヤノン",
    "4901.T": "富士フイルム",
    "6702.T": "富士通",
    "9022.T": "東海旅客鉄道",
    "8802.T": "三菱地所",
    # ここから拡張分（2026/07 追加、無料のyfinanceのまま銘柄数を拡大）
    "7201.T": "日産自動車",
    "7269.T": "スズキ",
    "7270.T": "SUBARU",
    "4689.T": "LINEヤフー",
    "4307.T": "野村総合研究所",
    "6503.T": "三菱電機",
    "6752.T": "パナソニックHD",
    "7733.T": "オリンパス",
    "8411.T": "みずほFG",
    "8604.T": "野村HD",
    "8766.T": "東京海上HD",
    "5401.T": "日本製鉄",
    "4188.T": "三菱ケミカルG",
    "3407.T": "旭化成",
    "6301.T": "コマツ",
    "6273.T": "SMC",
    "6723.T": "ルネサスエレクトロニクス",
    "3436.T": "SUMCO",
    "8031.T": "三井物産",
    "8001.T": "伊藤忠商事",
    "8053.T": "住友商事",
    "4755.T": "楽天G",
    "9697.T": "カプコン",
    "7832.T": "バンダイナムコHD",
    "4502.T": "武田薬品工業",
    "4523.T": "エーザイ",
    "3382.T": "セブン&アイHD",
    "8267.T": "イオン",
    "2502.T": "アサヒグループHD",
    "2503.T": "キリンHD",
    "2801.T": "キッコーマン",
    "9020.T": "東日本旅客鉄道",
    "9101.T": "日本郵船",
    "8801.T": "三井不動産",
    "5020.T": "ENEOSホールディングス",
    "1605.T": "INPEX",
    "1801.T": "大成建設",
}
WATCH_LIST = list(WATCH_MAP.keys())

# セクター分類（ヒートマップ用）
SECTOR_MAP = {
    "7203": "自動車", "7267": "自動車", "7201": "自動車", "7269": "自動車", "7270": "自動車",
    "9984": "通信・IT", "9432": "通信・IT", "9433": "通信・IT", "6702": "通信・IT", "4689": "通信・IT", "4307": "通信・IT",
    "6758": "電機", "6501": "電機", "7751": "電機", "4901": "電機", "6503": "電機", "6752": "電機",
    "6861": "精密機器", "7733": "精密機器",
    "8306": "金融", "8316": "金融", "8411": "金融", "8604": "金融", "8766": "金融",
    "4063": "素材", "5401": "素材", "4188": "素材", "3407": "素材",
    "6954": "機械", "6367": "機械", "6301": "機械", "6273": "機械",
    "8035": "半導体", "6857": "半導体", "6920": "半導体", "6723": "半導体", "3436": "半導体",
    "8058": "商社", "8031": "商社", "8001": "商社", "8053": "商社",
    "6098": "サービス", "4755": "サービス",
    "7974": "ゲーム・娯楽", "9697": "ゲーム・娯楽", "7832": "ゲーム・娯楽",
    "4568": "医薬品", "4519": "医薬品", "4502": "医薬品", "4523": "医薬品",
    "9983": "小売", "3382": "小売", "8267": "小売",
    "2914": "生活必需品", "4452": "生活必需品", "2502": "生活必需品", "2503": "生活必需品", "2801": "生活必需品",
    "4543": "医療機器",
    "9022": "運輸", "9020": "運輸", "9101": "運輸",
    "8802": "不動産", "8801": "不動産",
    "5020": "エネルギー", "1605": "エネルギー",
    "1801": "建設",
}

def fetch_all_watch_changes():
    """監視銘柄全66社の前日比を取得（急騰急落抽出・セクターヒートマップ両方の元データ）"""
    import yfinance as yf
    import time
    results = []
    for code in WATCH_LIST:
        hist = None
        for attempt in range(2):
            try:
                hist = yf.Ticker(code).history(period="3d")
                if len(hist) >= 2:
                    break
            except:
                pass
            time.sleep(0.3)
        if hist is None or len(hist) < 2:
            continue
        try:
            prev = float(hist["Close"].iloc[-2])
            curr = float(hist["Close"].iloc[-1])
            pct = (curr - prev) / prev * 100
            name = WATCH_MAP.get(code, code.replace(".T", ""))
            code_short = code.replace(".T", "")
            results.append({
                "code": code_short, "name": name,
                "pct": round(pct, 2), "price": int(curr),
                "sector": SECTOR_MAP.get(code_short, "その他"),
            })
        except:
            continue
    return results

def fetch_surge_drop(all_changes=None):
    """前日比で急騰・急落した銘柄を抽出"""
    changes = all_changes if all_changes is not None else fetch_all_watch_changes()
    surges = [{"code": c["code"], "name": c["name"], "pct": c["pct"], "price": c["price"]}
              for c in changes if c["pct"] >= 3.0]
    drops = [{"code": c["code"], "name": c["name"], "pct": c["pct"], "price": c["price"]}
             for c in changes if c["pct"] <= -3.0]

    surges.sort(key=lambda x: x["pct"], reverse=True)
    drops.sort(key=lambda x: x["pct"])
    return surges[:5], drops[:5]

def build_sector_heatmap(all_changes=None):
    """セクター別の値動きをヒートマップ用データに集計"""
    changes = all_changes if all_changes is not None else fetch_all_watch_changes()
    grouped = {}
    for c in changes:
        sec = c["sector"]
        grouped.setdefault(sec, []).append(c)

    heatmap = []
    for sector, items in grouped.items():
        avg_pct = sum(i["pct"] for i in items) / len(items)
        top = sorted(items, key=lambda x: abs(x["pct"]), reverse=True)[0]
        heatmap.append({
            "sector": sector,
            "avg_pct": round(avg_pct, 2),
            "count": len(items),
            "up": sum(1 for i in items if i["pct"] > 0),
            "down": sum(1 for i in items if i["pct"] < 0),
            "top_mover": {"name": top["name"], "code": top["code"], "pct": top["pct"]},
        })
    heatmap.sort(key=lambda x: x["avg_pct"], reverse=True)
    return heatmap

def top_movers(all_changes, n=10):
    """値動きの絶対値が大きい順にトップN銘柄を返す"""
    return sorted(all_changes, key=lambda c: abs(c["pct"]), reverse=True)[:n]

# 米国株ウォッチリスト（セクター別ヒートマップ・値動き上位抽出用）
US_WATCH_MAP = {
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet",
    "NVDA": "NVIDIA", "AMD": "AMD", "AVGO": "Broadcom",
    "AMZN": "Amazon", "TSLA": "Tesla", "WMT": "Walmart",
    "META": "Meta Platforms", "NFLX": "Netflix", "DIS": "Disney",
    "JPM": "JPMorgan Chase", "BAC": "Bank of America", "GS": "Goldman Sachs",
    "JNJ": "Johnson & Johnson", "UNH": "UnitedHealth", "LLY": "Eli Lilly",
    "XOM": "ExxonMobil", "CVX": "Chevron",
    "KO": "Coca-Cola", "PG": "Procter & Gamble", "COST": "Costco",
    "BA": "Boeing", "CAT": "Caterpillar", "GE": "GE Aerospace",
}
US_SECTOR_MAP = {
    "AAPL": "テクノロジー", "MSFT": "テクノロジー", "GOOGL": "テクノロジー",
    "NVDA": "半導体", "AMD": "半導体", "AVGO": "半導体",
    "AMZN": "消費・EC", "TSLA": "消費・EC", "WMT": "消費・EC",
    "META": "通信・メディア", "NFLX": "通信・メディア", "DIS": "通信・メディア",
    "JPM": "金融", "BAC": "金融", "GS": "金融",
    "JNJ": "ヘルスケア", "UNH": "ヘルスケア", "LLY": "ヘルスケア",
    "XOM": "エネルギー", "CVX": "エネルギー",
    "KO": "生活必需品", "PG": "生活必需品", "COST": "生活必需品",
    "BA": "資本財", "CAT": "資本財", "GE": "資本財",
}
US_WATCH_LIST = list(US_WATCH_MAP.keys())

def fetch_us_watch_changes():
    """米国ウォッチリスト全銘柄の前日比を取得（セクターヒートマップ・値動き上位抽出用）"""
    import yfinance as yf
    import time
    results = []
    for code in US_WATCH_LIST:
        hist = None
        for attempt in range(2):
            try:
                hist = yf.Ticker(code).history(period="3d")
                if len(hist) >= 2:
                    break
            except:
                pass
            time.sleep(0.3)
        if hist is None or len(hist) < 2:
            continue
        try:
            prev = float(hist["Close"].iloc[-2])
            curr = float(hist["Close"].iloc[-1])
            pct = (curr - prev) / prev * 100
            results.append({
                "code": code, "name": US_WATCH_MAP.get(code, code),
                "pct": round(pct, 2), "price": round(curr, 2),
                "sector": US_SECTOR_MAP.get(code, "その他"),
            })
        except:
            continue
    return results

# 主要指数そのものには株式のような出来高がないため、先物または代替ETF/構成銘柄の
# 出来高で代替する。実機検証済み（2026/07時点でYahoo Financeから安定して非ゼロの
# 出来高が取得できることを確認）。TOPIX先物・SOX先物はYahoo Finance上に銘柄が
# 存在しないため、ETFで代替している。
VOLUME_TARGETS = [
    {"key": "nikkei225_futures", "label": "日経225先物", "symbol": "NKD=F"},
    {"key": "topix_etf", "label": "TOPIX連動ETF", "symbol": "1306.T"},
    {"key": "nasdaq100_futures", "label": "NASDAQ100先物", "symbol": "NQ=F"},
    {"key": "sp500_futures", "label": "S&P500先物", "symbol": "ES=F"},
    {"key": "semiconductor_etf", "label": "半導体ETF(SMH)", "symbol": "SMH"},
    {"key": "kospi", "label": "KOSPI", "symbol": "^KS11"},
]


def judge_volume(avg20d_pct):
    if avg20d_pct is None:
        return "取得不可"
    if avg20d_pct >= 130:
        return "商い活発"
    if avg20d_pct >= 80:
        return "通常"
    return "薄商い"


def fetch_volume_history():
    """主要指数の先物/代替銘柄の出来高（当日・前日比・20営業日平均比）を取得する。"""
    import yfinance as yf

    items = []
    for t in VOLUME_TARGETS:
        item = {**t, "source": "Yahoo Finance (yfinance)"}
        try:
            hist = yf.Ticker(t["symbol"]).history(period="35d")
            hist = hist[hist["Volume"] > 0]
            if hist.empty:
                item.update(volume=None, volume_prev_pct=None, avg20d=None,
                            avg20d_pct=None, judgement="取得不可")
                items.append(item)
                continue

            latest_vol = int(hist["Volume"].iloc[-1])
            prev_rows = hist.iloc[:-1]
            prev_vol = int(prev_rows["Volume"].iloc[-1]) if len(prev_rows) >= 1 else None
            avg20_series = prev_rows["Volume"].tail(20)
            # 5日未満しかない場合は「20営業日平均」として意味をなさないため出さない
            avg20d = int(avg20_series.mean()) if len(avg20_series) >= 5 else None

            volume_prev_pct = round((latest_vol - prev_vol) / prev_vol * 100, 1) if prev_vol else None
            avg20d_pct = round(latest_vol / avg20d * 100, 1) if avg20d else None

            item.update(
                volume=latest_vol, volume_prev_pct=volume_prev_pct,
                avg20d=avg20d, avg20d_pct=avg20d_pct,
                judgement=judge_volume(avg20d_pct),
            )
        except Exception as e:
            item.update(volume=None, volume_prev_pct=None, avg20d=None,
                        avg20d_pct=None, judgement="取得不可", error=str(e))
        items.append(item)
    return items


def fetch_market_data():
    try:
        import yfinance as yf
        import requests
        hist = yf.Ticker("^N225").history(period="20d")
        if hist.empty:
            raise ValueError("no data")

        # yfinanceは直近営業日のデータが未確定（NaN）で返ってくることがあり、
        # int(nan)がValueErrorになるため、OHLCが欠損している行は除外する
        hist = hist.dropna(subset=["Open", "High", "Low", "Close"])
        hist["Volume"] = hist["Volume"].fillna(0)
        if hist.empty:
            raise ValueError("no valid data after removing NaN rows")

        # 鮮度チェック: 取得できた最新データが古すぎる場合（取得失敗・キャッシュ等）は
        # 気付けずに数日古い日経指数を表示し続けてしまうため、フォールバックへ倒す。
        # 日本のゴールデンウィーク等の連休を考慮し、閾値は7日（1週間）とする。
        latest_trading_date = hist.index[-1].date()
        days_since_latest = (NOW.date() - latest_trading_date).days
        if days_since_latest > 7:
            raise ValueError(
                f"^N225 data is stale: latest trading date={latest_trading_date}, "
                f"{days_since_latest} days old"
            )

        ohlcv = []
        for date, row in hist.tail(10).iterrows():
            ohlcv.append({
                "date":   date.strftime("%m/%d"),
                "open":   int(row["Open"]),
                "high":   int(row["High"]),
                "low":    int(row["Low"]),
                "close":  int(row["Close"]),
                "volume": round(row["Volume"] / 1e8, 2),
            })
 
        latest = ohlcv[-1]
        prev   = ohlcv[-2]
        diff   = latest["close"] - prev["close"]
        pct    = diff / prev["close"] * 100

        # 追加の鮮度フラグ: 上の7日ルールは「処理を止めるべき致命的な古さ」の閾値。
        # これとは別に、もっと早い段階（2営業日ズレ）で気付けるよう、処理は止めずに
        # フラグだけ立てる軽量チェックを追加する。^N225はYahoo Finance側の反映遅延で、
        # 7日には満たないが前回実行時と同じデータを返してくることがあるため。
        # 土日に加えて日本の祝日もスキップしないと、祝日明けに「データが古い」という
        # 誤検知（偽アラート）が発生する（例: 海の日翌日に前営業日=金曜のデータを
        # 「本来は月曜のはず」と誤判定してしまう）。
        import jpholiday
        expected_date = NOW.date() - timedelta(days=1)
        while expected_date.weekday() >= 5 or jpholiday.is_holiday(expected_date):
            expected_date -= timedelta(days=1)
        nikkei_data_stale = (expected_date - latest_trading_date).days >= 2
        if nikkei_data_stale:
            print(
                f"⚠ 日経225データが古い可能性: 取得できた最新日={latest_trading_date}, "
                f"想定される最新営業日={expected_date}"
            )
 
        try:
            fx = yf.Ticker("USDJPY=X").history(period="3d")
            usd_jpy = round(float(fx["Close"].iloc[-1]), 2)
            if len(fx) >= 2:
                usd_jpy_prev = float(fx["Close"].iloc[-2])
                usd_jpy_pct = round((usd_jpy - usd_jpy_prev) / usd_jpy_prev * 100, 2)
            else:
                usd_jpy_pct = 0.0
        except:
            usd_jpy = 155.0
            usd_jpy_pct = 0.0
 
        try:
            sox_h = yf.Ticker("^SOX").history(period="3d")
            if len(sox_h) >= 2:
                sox_curr = float(sox_h["Close"].iloc[-1])
                sox_prev = float(sox_h["Close"].iloc[-2])
                sox_pct = (sox_curr - sox_prev) / sox_prev * 100
                sox = round(sox_curr, 1)
            else:
                sox_pct = 0.0
                sox = 0.0
        except:
            sox_pct = 0.0
            sox = 0.0
 
        try:
            vix_h = yf.Ticker("^VIX").history(period="3d")
            vix = round(float(vix_h["Close"].iloc[-1]), 1)
            if len(vix_h) >= 2:
                vix_prev = float(vix_h["Close"].iloc[-2])
                vix_pct = round((vix - vix_prev) / vix_prev * 100, 2)
            else:
                vix_pct = 0.0
        except:
            vix = 20.0
            vix_pct = 0.0

        try:
            us10y_h = yf.Ticker("^TNX").history(period="3d")
            us10y = round(float(us10y_h["Close"].iloc[-1]), 2)
            if len(us10y_h) >= 2:
                us10y_prev = float(us10y_h["Close"].iloc[-2])
                us10y_diff = round(us10y - us10y_prev, 2)
            else:
                us10y_diff = 0.0
        except:
            us10y = 0.0
            us10y_diff = 0.0

        try:
            fg_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            fg_r = requests.get("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", headers=fg_headers, timeout=10)
            fg_r.raise_for_status()
            fg_data = fg_r.json()["fear_and_greed"]
            fear_greed_value = round(float(fg_data["score"]), 1)
            fear_greed_label = fg_data["rating"]
            fear_greed_prev = round(float(fg_data["previous_close"]), 1)
            fear_greed_diff = round(fear_greed_value - fear_greed_prev, 1)
        except Exception:
            fear_greed_value = None
            fear_greed_label = None
            fear_greed_prev = None
            fear_greed_diff = None

        try:
            btc_h = yf.Ticker("BTC-USD").history(period="3d")
            btc = round(float(btc_h["Close"].iloc[-1]), 0)
            if len(btc_h) >= 2:
                btc_prev = float(btc_h["Close"].iloc[-2])
                btc_pct = round((btc - btc_prev) / btc_prev * 100, 2)
            else:
                btc_pct = 0.0
        except:
            btc = 0.0
            btc_pct = 0.0

        try:
            dxy_h = yf.Ticker("DX-Y.NYB").history(period="3d")
            dxy = round(float(dxy_h["Close"].iloc[-1]), 2)
            if len(dxy_h) >= 2:
                dxy_prev = float(dxy_h["Close"].iloc[-2])
                dxy_pct = round((dxy - dxy_prev) / dxy_prev * 100, 2)
            else:
                dxy_pct = 0.0
        except:
            dxy = 0.0
            dxy_pct = 0.0

        try:
            gold_h = yf.Ticker("GC=F").history(period="3d")
            gold = round(float(gold_h["Close"].iloc[-1]), 1)
            if len(gold_h) >= 2:
                gold_prev = float(gold_h["Close"].iloc[-2])
                gold_pct = round((gold - gold_prev) / gold_prev * 100, 2)
            else:
                gold_pct = 0.0
        except:
            gold = 0.0
            gold_pct = 0.0
 
        # TOPIX（998405.T優先、失敗時1308.T→1475.T）
        topix, topix_pct = 0.0, 0.0
        for topix_symbol in ["998405.T", "1308.T", "1475.T"]:
            try:
                topix_h = yf.Ticker(topix_symbol).history(period="3d")
                if not topix_h.empty and len(topix_h) >= 2:
                    topix = round(float(topix_h["Close"].iloc[-1]), 1)
                    topix_prev = round(float(topix_h["Close"].iloc[-2]), 1)
                    topix_pct = round((topix - topix_prev) / topix_prev * 100, 2)
                    print(f"TOPIX取得成功: {topix_symbol} = {topix}")
                    break
            except:
                continue

        # NASDAQ
        nasdaq, nasdaq_pct = 0.0, 0.0
        try:
            nasdaq_h = yf.Ticker("^IXIC").history(period="3d")
            if not nasdaq_h.empty and len(nasdaq_h) >= 2:
                nasdaq = round(float(nasdaq_h["Close"].iloc[-1]), 1)
                nasdaq_prev = round(float(nasdaq_h["Close"].iloc[-2]), 1)
                nasdaq_pct = round((nasdaq - nasdaq_prev) / nasdaq_prev * 100, 2)
        except:
            pass

        # S&P500
        sp500, sp500_pct = 0.0, 0.0
        try:
            sp500_h = yf.Ticker("^GSPC").history(period="3d")
            if not sp500_h.empty and len(sp500_h) >= 2:
                sp500 = round(float(sp500_h["Close"].iloc[-1]), 1)
                sp500_prev = round(float(sp500_h["Close"].iloc[-2]), 1)
                sp500_pct = round((sp500 - sp500_prev) / sp500_prev * 100, 2)
        except:
            pass

        return {"ohlcv":ohlcv, "latest":latest, "diff":diff, "pct":pct,
                "nikkei_data_stale": nikkei_data_stale,
                "usd_jpy":usd_jpy, "usd_jpy_pct":usd_jpy_pct, "sox_pct":sox_pct, "sox":sox,
                "vix":vix, "vix_pct":vix_pct, "us10y":us10y, "us10y_diff":us10y_diff,
                "fear_greed_value":fear_greed_value, "fear_greed_label":fear_greed_label,
                "fear_greed_prev":fear_greed_prev, "fear_greed_diff":fear_greed_diff,
                "btc":btc, "btc_pct":btc_pct, "dxy":dxy, "dxy_pct":dxy_pct, "gold":gold, "gold_pct":gold_pct,
                "topix":topix, "topix_pct":topix_pct,
                "nasdaq":nasdaq, "nasdaq_pct":nasdaq_pct,
                "sp500":sp500, "sp500_pct":sp500_pct}
 
    except Exception as e:
        print(f"Market data fetch FAILED: {e}")
        print("Using fallback data...")
        # フォールバック: 前回のlatest.jsonから取得を試みる
        try:
            import json as _json
            with open("data/latest.json", "r", encoding="utf-8") as f:
                prev = _json.load(f)
            print(f"Fallback: using previous data from {prev.get('date')}")
            nikkei = prev.get("nikkei", 70000)
            ohlcv = [
                {"date": TODAY, "open": nikkei*0.995, "high": nikkei*1.005,
                 "low": nikkei*0.99, "close": nikkei, "volume": 1000000},
                {"date": TODAY, "open": nikkei*0.99, "high": nikkei*1.01,
                 "low": nikkei*0.985, "close": nikkei, "volume": 1000000},
            ]
            return {
                "ohlcv": ohlcv,
                "latest": {"close": nikkei, "open": nikkei, "high": nikkei, "low": nikkei},
                "diff": 0, "pct": 0.0,
                "usd_jpy": prev.get("usd_jpy", 150.0),
                "usd_jpy_pct": prev.get("usd_jpy_pct", 0.0),
                "sox_pct": prev.get("sox_pct", 0.0),
                "sox": prev.get("sox", 0.0),
                "vix": prev.get("vix", 20.0),
                "vix_pct": prev.get("vix_pct", 0.0),
                "us10y": prev.get("us10y", 0.0),
                "us10y_diff": prev.get("us10y_diff", 0.0),
                "fear_greed_value": prev.get("fear_greed_value"),
                "fear_greed_label": prev.get("fear_greed_label"),
                "fear_greed_prev": prev.get("fear_greed_prev"),
                "fear_greed_diff": prev.get("fear_greed_diff"),
                "btc": prev.get("btc", 0.0), "btc_pct": prev.get("btc_pct", 0.0),
                "dxy": prev.get("dxy", 0.0), "dxy_pct": prev.get("dxy_pct", 0.0),
                "gold": prev.get("gold", 0.0), "gold_pct": prev.get("gold_pct", 0.0),
                "topix": prev.get("topix", 0.0),
                "topix_pct": prev.get("topix_pct", 0.0),
                "nasdaq": prev.get("nasdaq", 0.0),
                "nasdaq_pct": prev.get("nasdaq_pct", 0.0),
                "sp500": prev.get("sp500", 0.0),
                "sp500_pct": prev.get("sp500_pct", 0.0),
                "nikkei_data_stale": True,
                "is_fallback": True
            }
        except Exception as e2:
            print(f"Fallback also failed: {e2}")
            raise RuntimeError(f"市場データ取得失敗: {e}")
 

# ------------------------------------------------------------------
# 決算カレンダー・決算サプライズランキング
# ------------------------------------------------------------------

def _fetch_earnings_for_list(ticker_list, name_map, sector_map, strip_suffix=False, debug_log=None):
    """各銘柄の直近決算情報（次回決算日・前回決算のサプライズ%）を取得。
    1銘柄1回のget_earnings_dates呼び出しで、直近の過去決算と次回予定日の
    両方をまとめて取れるためAPI呼び出し数は最小限。"""
    import yfinance as yf
    import time
    from datetime import datetime as _dt, timezone as _tz, timedelta as _td

    now_utc = _dt.now(_tz.utc)
    _jst = _tz(_td(hours=9))
    today_jst = now_utc.astimezone(_jst).date()
    # 「next」判定は発表の正確な時刻ではなく、JST暦日ベースで行う。
    # 発表当日はもちろん、フロントエンドが「N日前」タグで表示するグレース期間
    # （発表翌日まで）は引き続き next_earnings_date として残す。これがないと、
    # 発表の正確なタイムスタンプ（例: 米国市場引け後 = JST未明）を実行時刻が
    # 跨いだ瞬間に next→last へ切り替わってしまい、同じ暦日の途中でも
    # カレンダーから消えるという不具合が起きる。
    EARNINGS_GRACE_DAYS = 1
    results = []
    for i, code in enumerate(ticker_list):
        code_short = code.replace(".T", "") if strip_suffix else code
        name = name_map.get(code, code_short)
        sector = sector_map.get(code_short, "その他")

        df = None
        fetch_error = None
        for attempt in range(2):
            try:
                df = yf.Ticker(code).get_earnings_dates(limit=8)
                if df is not None and len(df) > 0:
                    break
            except Exception as e:
                fetch_error = str(e)
            time.sleep(0.3)
        if df is None or len(df) == 0:
            if debug_log is not None and i < 3:
                debug_log.append({"code": code, "stage": "fetch", "error": fetch_error, "df_len": 0 if df is None else len(df)})
            continue

        if debug_log is not None and i < 3:
            debug_log.append({
                "code": code, "stage": "fetched_ok",
                "columns": [str(c) for c in df.columns],
                "index_tz": str(df.index.tz),
                "sample_index": [str(x) for x in df.index[:3]],
            })

        try:
            df = df.sort_index()  # 昇順（古い→新しい）に統一
            idx_utc = df.index.tz_convert("UTC") if df.index.tz is not None else df.index.tz_localize("UTC")

            next_date, next_days = None, None
            last_date, last_surprise = None, None

            # Surprise(%) 列を列名から安全に取得（yfinanceのバージョンで列位置が変わりうるため）
            surprise_col = None
            for c in df.columns:
                if "Surprise" in str(c):
                    surprise_col = c
                    break

            for ts in idx_utc:
                ts_dt = ts.to_pydatetime()
                ts_jst_date = ts_dt.astimezone(_jst).date()
                days_from_today = (ts_jst_date - today_jst).days
                if days_from_today >= -EARNINGS_GRACE_DAYS:
                    # 未来の予定日、または発表からグレース期間内（当日〜翌日）はnext扱い。
                    if next_date is None or days_from_today > next_days:
                        next_date = ts_dt.strftime("%Y-%m-%d")
                        next_days = days_from_today
                    if days_from_today < 0 and surprise_col is not None:
                        val = df.loc[ts, surprise_col]
                        if val is not None and val == val:  # NaN check
                            last_surprise = round(float(val), 1)
                            last_date = ts_dt.strftime("%Y-%m-%d")
                else:
                    last_date = ts_dt.strftime("%Y-%m-%d")
                    if surprise_col is not None:
                        val = df.loc[ts, surprise_col]
                        if val is not None and val == val:  # NaN check
                            last_surprise = round(float(val), 1)

            if next_date or last_surprise is not None:
                results.append({
                    "code": code_short, "name": name, "sector": sector,
                    "next_earnings_date": next_date, "days_until": next_days,
                    "last_earnings_date": last_date, "last_surprise_pct": last_surprise,
                })
        except Exception as e:
            print(f"  {code} 決算データ解析エラー: {e}")
            if debug_log is not None and i < 3:
                debug_log.append({"code": code, "stage": "parse_error", "error": str(e)})
            continue
    return results


def build_earnings_calendar(earnings_list, n=15):
    """次回決算日が近い順に並べたカレンダー"""
    upcoming = [e for e in earnings_list if e.get("next_earnings_date")]
    upcoming.sort(key=lambda e: e["next_earnings_date"])
    return upcoming[:n]


def build_earnings_rank(earnings_list, n=10):
    """直近決算のサプライズ%が大きい順（好決算）・小さい順（悪決算）にランキング"""
    with_surprise = [e for e in earnings_list if e.get("last_surprise_pct") is not None]
    best = sorted(with_surprise, key=lambda e: e["last_surprise_pct"], reverse=True)[:n]
    worst = sorted(with_surprise, key=lambda e: e["last_surprise_pct"])[:n]
    return {"best": best, "worst": worst}


def fetch_jp_earnings_jquants(debug_log=None):
    """
    J-Quants API (/equities/earnings-calendar) を使って、監視銘柄のうち
    翌営業日に決算発表予定の銘柄を取得する。

    重要な制約（JPXの仕様に起因、こちら側で変更不可）:
    - このAPIは「翌営業日に決算発表を行う銘柄」のみを返す。米国株のように
      数週間先までの決算カレンダーは取得できない。
    - 3月期・9月期決算の会社のみが対象。
    - REITは対象外。
    - サプライズ%（前回決算の良し悪し）はこのAPIには含まれないため、
      last_surprise_pct は常にNoneになる（決算ランキング機能は日本株では使えない）。

    戻り値:
    - APIキー未設定 or 取得失敗 → None（呼び出し元でyfinance版にフォールバック）
    - 取得成功（該当銘柄が0件でも） → リスト（空リストもあり得る。これは
      「明日決算発表がある監視銘柄がない」という正常な結果）
    """
    import requests

    api_key = os.environ.get("JQUANTS_API_KEY", "")
    if not api_key:
        if debug_log is not None:
            debug_log.append({"stage": "jquants_no_key"})
        return None

    # WATCH_LISTの"7203.T"形式 → J-Quantsの5桁コード"72030"形式に変換
    code_map = {}
    for code in WATCH_LIST:
        code_short = code.replace(".T", "")
        jq_code = f"{code_short}0"
        code_map[jq_code] = (code_short, WATCH_MAP.get(code, code_short), SECTOR_MAP.get(code_short, "その他"))

    try:
        resp = requests.get(
            "https://api.jquants.com/v2/equities/earnings-calendar",
            headers={"x-api-key": api_key},
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as e:
        if debug_log is not None:
            debug_log.append({"stage": "jquants_fetch_error", "error": str(e)})
        return None

    rows = payload.get("data", [])
    if debug_log is not None:
        debug_log.append({"stage": "jquants_fetched_ok", "row_count": len(rows)})

    from datetime import datetime as _dt, timezone as _tz, timedelta as _td
    jst = _tz(_td(hours=9))
    today = _dt.now(jst).date()

    results = []
    for row in rows:
        jq_code = str(row.get("Code", ""))
        if jq_code not in code_map:
            continue
        date_str = row.get("Date", "")
        if not date_str:
            continue
        try:
            ann_date = _dt.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        code_short, name, sector = code_map[jq_code]
        results.append({
            "code": code_short, "name": name, "sector": sector,
            "next_earnings_date": date_str,
            "days_until": (ann_date - today).days,
            "last_earnings_date": None, "last_surprise_pct": None,
        })
    return results


def fetch_jp_earnings(debug_log=None):
    """
    日本株の決算情報を取得する。J-Quants APIを優先し、キー未設定/取得失敗時のみ
    yfinance版（get_earnings_dates）にフォールバックする。

    注: yfinance版は日本株の決算日程データをほぼ返さないことが判明済み
    （Yahoo Financeの日本株カバレッジの限界）。J-Quants導入前はこれが原因で
    日本株の決算カレンダーが常に空になっていた。
    """
    jq_result = fetch_jp_earnings_jquants(debug_log=debug_log)
    if jq_result is not None:
        return jq_result
    return _fetch_earnings_for_list(WATCH_LIST, WATCH_MAP, SECTOR_MAP, strip_suffix=True, debug_log=debug_log)


def fetch_us_earnings(debug_log=None):
    return _fetch_earnings_for_list(US_WATCH_LIST, US_WATCH_MAP, US_SECTOR_MAP, strip_suffix=False, debug_log=debug_log)

# ------------------------------------------------------------------
# テクニカルスクリーナー（リアルタイム買い候補リストアップ用）
# Claude APIを使わず、RSI/MA25乖離/BB位置/出来高だけから機械的にスコア化する。
# ------------------------------------------------------------------

def compute_ai_score(tech):
    """
    テクニカル指標のみから機械的に算出するAIスコア（0-100）。
    LLMが生成する主観的な「総合スコア」とは独立した、再現可能な定量スコア。
    - トレンド（MA25乖離）
    - RSI（過熱/売られすぎ）
    - ボリンジャーバンド位置（逆張り妙味）
    - 出来高（関心度）
    """
    score = 50.0

    ma25_diff = tech.get("ma25_diff", 0)
    score += max(-15, min(15, ma25_diff))

    rsi = tech.get("rsi", 50)
    if 40 <= rsi <= 60:
        score += 5
    elif rsi < 30:
        score += 10  # 売られすぎ＝リバウンド期待
    elif rsi > 70:
        score -= 10  # 過熱感

    bb_pos = tech.get("bb_pos", 50)
    if bb_pos < 20:
        score += 8  # バンド下限＝反発期待
    elif bb_pos > 80:
        score -= 8  # バンド上限＝過熱

    vol_ratio = tech.get("vol_ratio", 1.0)
    if vol_ratio > 1.5:
        score += 7
    elif vol_ratio < 0.7:
        score -= 3

    # モメンタムボーナス（本日の値動きが大きいほど加点、段階的に積み上げ）
    change_pct = tech.get("change_pct", 0)
    if change_pct >= 15:
        score += 15  # +4+6+5（ストップ高接近級）
    elif change_pct >= 10:
        score += 10  # +4+6
    elif change_pct >= 5:
        score += 4

    return max(0, min(100, round(score)))


def fetch_technicals_for_list(ticker_list, name_map, sector_map, strip_suffix=False):
    """監視銘柄リストの各銘柄についてRSI/MA25乖離/BB位置/出来高比を計算し、
    compute_ai_score()でスコア化する。Claude APIは使わない純計算。"""
    import yfinance as yf
    results = []
    for code in ticker_list:
        code_short = code.replace(".T", "") if strip_suffix else code
        name = name_map.get(code, code_short)
        sector = sector_map.get(code_short, "その他")
        try:
            ticker = yf.Ticker(code)
            hist = ticker.history(period="60d")
            if hist.empty or len(hist) < 25:
                continue
            close = hist["Close"]
            volume = hist["Volume"]
            current = float(close.iloc[-1])
            prev = float(close.iloc[-2])
            change_pct = (current - prev) / prev * 100
            ma25 = float(close.tail(25).mean())
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

            tech = {
                "code": code_short, "name": name, "sector": sector,
                "price": round(current, 2), "change_pct": round(change_pct, 2),
                "ma25_diff": round(ma25_diff, 1), "bb_pos": round(bb_pos, 1),
                "rsi": rsi, "vol_ratio": vol_ratio,
            }
            tech["ai_score"] = compute_ai_score(tech)
            results.append(tech)
        except Exception:
            continue
    return results


def build_screener(technicals_list, n=10, high_conviction_threshold=90):
    """AIスコア上位・下位（＝買い候補/要警戒候補）を抽出。
    top/high_convictionは、スコアが0以下（買い根拠が実質無い）候補を除外する
    （「要警戒」bottomリストは目的が逆なのでこの除外を適用しない）。
    high_convictionは、複数の強気シグナル（MA25乖離・RSI売られすぎ・BB下限・出来高急増・
    モメンタム）がほぼ同時に揃った、極めて限定的な高確度候補のみを抽出する（該当なしの日の方が多い想定）。"""
    all_ranked = sorted(technicals_list, key=lambda t: t["ai_score"], reverse=True)
    buy_candidates = [t for t in all_ranked if t["ai_score"] > 0]
    high_conviction = [t for t in buy_candidates if t["ai_score"] >= high_conviction_threshold]
    return {
        "top": buy_candidates[:n],
        "bottom": all_ranked[-n:][::-1] if len(all_ranked) >= n else [],
        "high_conviction": high_conviction,
    }


def fetch_jp_screener():
    return fetch_technicals_for_list(WATCH_LIST, WATCH_MAP, SECTOR_MAP, strip_suffix=True)


def fetch_us_screener():
    return fetch_technicals_for_list(US_WATCH_LIST, US_WATCH_MAP, US_SECTOR_MAP, strip_suffix=False)

