"""一時調査用スクリプト。指数先物/代替銘柄の出来高データが取れるか確認するだけ。
確認後に削除する。"""
import yfinance as yf

CANDIDATES = [
    ("^N225", "日経225 スポット指数（参考・比較用）"),
    ("NIY=F", "日経225先物 CME円建て"),
    ("NKD=F", "日経225先物 CMEドル建て"),
    ("1321.T", "日経225連動型ETF(野村)"),
    ("^TPX", "TOPIX スポット指数（参考）"),
    ("1306.T", "TOPIX連動型ETF(野村)"),
    ("NQ=F", "NASDAQ100先物 CME"),
    ("ES=F", "S&P500先物 CME"),
    ("^SOX", "SOX スポット指数（参考）"),
    ("SOXX", "iShares半導体ETF"),
    ("SMH", "VanEck半導体ETF"),
    ("^KS11", "KOSPI スポット指数（参考）"),
    ("005930.KS", "Samsung Electronics"),
    ("000660.KS", "SK hynix"),
]

for symbol, label in CANDIDATES:
    print(f"\n===== {symbol} ({label}) =====")
    try:
        t = yf.Ticker(symbol)
        h = t.history(period="10d")
        if h.empty:
            print("  -> データなし（空）")
            continue
        print(h[["Close", "Volume"]].to_string())
        vols = h["Volume"].tolist()
        nonzero = [v for v in vols if v and v > 0]
        print(f"  非ゼロ出来高: {len(nonzero)}/{len(vols)}日分")
    except Exception as e:
        print(f"  -> エラー: {e}")
