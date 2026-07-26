import sys
sys.path.insert(0, "scripts")
from market_data import detect_cup_handle
import yfinance as yf

tickers = ["7203.T", "6758.T", "9984.T", "8035.T", "6861.T", "AAPL", "MSFT", "NVDA"]

for code in tickers:
    try:
        t = yf.Ticker(code)
        hist = t.history(period="2y")
        print(f"{code}: rows={len(hist)}")
        if hist.empty:
            continue
        result = detect_cup_handle(hist["Close"], hist["Volume"])
        print(f"  -> {result}")
    except Exception as e:
        print(f"{code}: ERROR {e}")
