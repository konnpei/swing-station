"""
一時調査スクリプト: ネットキャッシュ比率の計算に必要なB/S項目
(流動資産・投資有価証券・負債・時価総額) が
J-Quants / yfinance から取得できるか検証する。
調査後に削除する前提の使い捨てスクリプト。
"""
import os
import json
import requests

JQUANTS_API_KEY = os.environ.get("JQUANTS_API_KEY", "")
SAMPLE_CODES = ["72030", "80350", "99840"]  # トヨタ, 東京エレクトロン, ソフトバンクG (J-Quants形式)


def test_jquants():
    print("=" * 60)
    print("J-Quants 財務情報エンドポイント調査")
    print("=" * 60)
    if not JQUANTS_API_KEY:
        print("JQUANTS_API_KEY未設定のためスキップ")
        return

    endpoints_to_try = [
        "https://api.jquants.com/v2/fins/statements",
        "https://api.jquants.com/v2/equities/statements",
        "https://api.jquants.com/v2/fins/fs-details",
    ]
    for url in endpoints_to_try:
        try:
            resp = requests.get(
                url,
                headers={"x-api-key": JQUANTS_API_KEY},
                params={"code": SAMPLE_CODES[0]},
                timeout=15,
            )
            print(f"\nGET {url}")
            print(f"  status: {resp.status_code}")
            print(f"  body(先頭1000字): {resp.text[:1000]}")
        except Exception as e:
            print(f"\nGET {url} -> error: {e}")


def test_yfinance():
    print("\n" + "=" * 60)
    print("yfinance balance_sheet / info 調査")
    print("=" * 60)
    import yfinance as yf

    for code in ["7203.T", "8035.T", "9984.T"]:
        print(f"\n--- {code} ---")
        try:
            t = yf.Ticker(code)
            bs = t.balance_sheet
            if bs is not None and not bs.empty:
                print("balance_sheet index (項目一覧):")
                print(list(bs.index)[:40])
                print("\n直近期の値（先頭列）:")
                print(bs.iloc[:, 0].to_dict())
            else:
                print("balance_sheet: 空またはNone")
        except Exception as e:
            print(f"balance_sheet取得エラー: {e}")

        try:
            info = t.info
            keys_of_interest = [
                "marketCap", "totalCash", "totalDebt", "totalLiabilities",
                "longTermInvestments", "currentAssets", "totalCurrentAssets",
            ]
            print("\ninfo抜粋:")
            for k in keys_of_interest:
                print(f"  {k}: {info.get(k)}")
        except Exception as e:
            print(f"info取得エラー: {e}")


if __name__ == "__main__":
    test_jquants()
    test_yfinance()
