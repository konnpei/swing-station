"""
scripts/market_data.py

morning_briefing.py（Claude API・Discord配信を含むフル朝刊生成）と
refresh_market_data.py（市場データのみを再取得する軽量スクリプト）の
両方から使う共有モジュール。

このファイルはAPIキーやWebhookなどの環境変数を一切必要としない
（yfinance/requestsのみに依存）。株価データの取得ロジックはここに一本化し、
morning_briefing.py側では重複定義せずここからimportする。
"""
import os, json
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")

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
}
WATCH_LIST = list(WATCH_MAP.keys())

# セクター分類（ヒートマップ用）
SECTOR_MAP = {
    "7203": "自動車", "7267": "自動車",
    "9984": "通信・IT", "9432": "通信・IT", "9433": "通信・IT", "6702": "通信・IT",
    "6758": "電機", "6501": "電機", "7751": "電機", "4901": "電機",
    "6861": "精密機器",
    "8306": "金融", "8316": "金融",
    "4063": "素材",
    "6954": "機械", "6367": "機械",
    "8035": "半導体", "6857": "半導体", "6920": "半導体",
    "8058": "商社",
    "6098": "サービス",
    "7974": "ゲーム・娯楽",
    "4568": "医薬品", "4519": "医薬品",
    "9983": "小売",
    "2914": "生活必需品", "4452": "生活必需品",
    "4543": "医療機器",
    "9022": "運輸",
    "8802": "不動産",
}

def fetch_all_watch_changes():
    """監視銘柄全30社の前日比を取得（急騰急落抽出・セクターヒートマップ両方の元データ）"""
    import yfinance as yf
    results = []
    for code in WATCH_LIST:
        try:
            hist = yf.Ticker(code).history(period="3d")
            if len(hist) < 2:
                continue
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
    results = []
    for code in US_WATCH_LIST:
        try:
            hist = yf.Ticker(code).history(period="3d")
            if len(hist) < 2:
                continue
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

def fetch_market_data():
    try:
        import yfinance as yf
        hist = yf.Ticker("^N225").history(period="20d")
        if hist.empty:
            raise ValueError("no data")
 
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
 
        latest = ohlcv[-1]
        prev   = ohlcv[-2]
        diff   = latest["close"] - prev["close"]
        pct    = diff / prev["close"] * 100
 
        try:
            fx = yf.Ticker("USDJPY=X").history(period="2d")
            usd_jpy = round(float(fx["Close"].iloc[-1]), 2)
        except:
            usd_jpy = 155.0
 
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
            vix_h = yf.Ticker("^VIX").history(period="2d")
            vix = round(float(vix_h["Close"].iloc[-1]), 1)
        except:
            vix = 20.0
 
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
                "usd_jpy":usd_jpy, "sox_pct":sox_pct, "sox":sox, "vix":vix,
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
                "sox_pct": prev.get("sox_pct", 0.0),
                "sox": prev.get("sox", 0.0),
                "vix": prev.get("vix", 20.0),
                "topix": prev.get("topix", 0.0),
                "topix_pct": prev.get("topix_pct", 0.0),
                "nasdaq": prev.get("nasdaq", 0.0),
                "nasdaq_pct": prev.get("nasdaq_pct", 0.0),
                "sp500": prev.get("sp500", 0.0),
                "sp500_pct": prev.get("sp500_pct", 0.0),
                "is_fallback": True
            }
        except Exception as e2:
            print(f"Fallback also failed: {e2}")
            raise RuntimeError(f"市場データ取得失敗: {e}")
 
