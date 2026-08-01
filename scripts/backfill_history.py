"""
scripts/backfill_history.py

GH_PAT失効(2026-07-28夜〜)により data/history/ への書き込みが失敗し続け、
2026-07-29・07-30・07-31の3営業日分の履歴ファイルが存在しない状態になった。
weekly_review.py は data/history/ の直近5ファイルを機械的に集計するため、
このままでは「7/27週の振り返り」が前週分と混ざった不正確な内容になる。

このスクリプトはyfinanceの過去データから、上記3日分の
「weekly_review.pyの集計に必要な最小限のフィールド」（date, nikkei,
sector_heatmap, jp_top_movers, us_top_movers, mode 等）だけを機械的に
再構築し、data/history/{date}.jsonとしてGitHubに保存する。

【重要な制約】
- Claude APIは呼ばない（過去日の市場サマリー文章・銘柄コメントを後から
  捏造することはできないため、market_summary/news/stocks_jp等のAI生成
  フィールドは含めない＝空のまま）
- 既存の同名ファイルがある場合は上書きしない（安全のため）
- GH_PATが有効でないと書き込めない（このスクリプト自体はGH_PAT失効問題を
  解決するものではない）
"""
import sys, os, json, base64
from datetime import datetime, timezone, timedelta
import requests
import yfinance as yf

from market_data import (
    WATCH_LIST, WATCH_MAP, SECTOR_MAP,
    US_WATCH_LIST, US_WATCH_MAP, US_SECTOR_MAP,
    sanitize_for_json,
)

JST = timezone(timedelta(hours=9))
REPO = "konnpei/swing-station"
GH_TOKEN = os.environ.get("GH_PAT", "")

TARGET_DATES = ["2026-07-29", "2026-07-30", "2026-07-31"]


def detect_mode(pct, sox_pct, usd_jpy, vix):
    if pct <= -2.5 or vix >= 30:
        return "crash"
    if pct >= 2.0 and sox_pct >= 3.0:
        return "ai"
    if pct >= 2.0:
        return "surge"
    if usd_jpy <= 148.0:
        return "yen"
    if sox_pct >= 3.0:
        return "ai"
    if vix >= 25:
        return "geopolitical"
    return "normal"


def pct_change_on(hist, date_str):
    """histのindexは日付昇順。date_strの終値と直前営業日の終値からpct変化を返す。
    データがなければNoneを返す。"""
    idx = hist.index.strftime("%Y-%m-%d")
    if date_str not in list(idx):
        return None, None
    pos = list(idx).index(date_str)
    if pos == 0:
        return float(hist["Close"].iloc[pos]), None
    close = float(hist["Close"].iloc[pos])
    prev = float(hist["Close"].iloc[pos - 1])
    pct = (close - prev) / prev * 100 if prev else None
    return close, pct


def fetch_series(symbol, start, end):
    t = yf.Ticker(symbol)
    return t.history(start=start, end=end)


def build_movers(ticker_list, name_map, sector_map, date_str, start, end, strip_suffix):
    movers = []
    sector_pcts = {}
    for code in ticker_list:
        code_short = code.replace(".T", "") if strip_suffix else code
        try:
            hist = fetch_series(code, start, end)
            if hist.empty:
                continue
            close, pct = pct_change_on(hist, date_str)
            if pct is None:
                continue
            name = name_map.get(code, code_short)
            movers.append({"code": code_short, "name": name, "pct": round(pct, 2)})
            sector = sector_map.get(code_short)
            if sector:
                sector_pcts.setdefault(sector, []).append(pct)
        except Exception:
            continue
    movers.sort(key=lambda m: abs(m["pct"]), reverse=True)
    sector_heatmap = [
        {"sector": s, "avg_pct": round(sum(v) / len(v), 2)}
        for s, v in sector_pcts.items()
    ]
    sector_heatmap.sort(key=lambda x: x["avg_pct"], reverse=True)
    return movers[:8], sector_heatmap


def gh_get(path):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    return requests.get(url, headers={"Authorization": f"Bearer {GH_TOKEN}"})


def gh_put_json(path, obj, message):
    content_b64 = base64.b64encode(
        json.dumps(sanitize_for_json(obj), ensure_ascii=False, indent=2).encode("utf-8")
    ).decode("ascii")
    body = {"message": message, "content": content_b64}
    r = requests.put(
        f"https://api.github.com/repos/{REPO}/contents/{path}",
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json"},
        json=body,
    )
    print(f"{path}: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:300])
        return False
    return True


def build_day(date_str):
    start = (datetime.fromisoformat(date_str) - timedelta(days=10)).strftime("%Y-%m-%d")
    end = (datetime.fromisoformat(date_str) + timedelta(days=1)).strftime("%Y-%m-%d")

    nikkei_hist = fetch_series("^N225", start, end)
    nikkei, nikkei_pct = pct_change_on(nikkei_hist, date_str)
    if nikkei is None:
        print(f"{date_str}: ^N225データなし。休場日の可能性があるためスキップ。")
        return None

    sox_hist = fetch_series("^SOX", start, end)
    _, sox_pct = pct_change_on(sox_hist, date_str)
    fx_hist = fetch_series("USDJPY=X", start, end)
    usd_jpy, _ = pct_change_on(fx_hist, date_str)
    vix_hist = fetch_series("^VIX", start, end)
    vix, _ = pct_change_on(vix_hist, date_str)

    jp_top_movers, sector_heatmap = build_movers(
        WATCH_LIST, WATCH_MAP, SECTOR_MAP, date_str, start, end, strip_suffix=True
    )
    us_top_movers, us_sector_heatmap = build_movers(
        US_WATCH_LIST, US_WATCH_MAP, US_SECTOR_MAP, date_str, start, end, strip_suffix=False
    )

    mode = detect_mode(nikkei_pct or 0, sox_pct or 0, usd_jpy or 999, vix or 0)
    dt = datetime.fromisoformat(date_str)

    return {
        "date": dt.strftime("%Y/%m/%d"),
        "is_trading_day": True,
        "nikkei": round(nikkei, 1),
        "nikkei_pct": round(nikkei_pct, 2) if nikkei_pct is not None else None,
        "sox_pct": round(sox_pct, 2) if sox_pct is not None else None,
        "usd_jpy": round(usd_jpy, 2) if usd_jpy is not None else None,
        "vix": round(vix, 2) if vix is not None else None,
        "mode": mode,
        "jp_top_movers": jp_top_movers,
        "us_top_movers": us_top_movers,
        "sector_heatmap": sector_heatmap,
        "us_sector_heatmap": us_sector_heatmap,
        "stocks_jp": [],
        "backfilled": True,
        "backfilled_note": "GH_PAT失効による欠損分を後日yfinance過去データから機械的に再構築。市場サマリー文章・銘柄コメント等のAI生成コンテンツは含まない。",
        "backfilled_at": datetime.now(JST).isoformat(),
    }


def main():
    dry_run = "--dry-run" in sys.argv
    for date_str in TARGET_DATES:
        path = f"data/history/{date_str}.json"

        if not dry_run:
            existing = gh_get(path)
            if existing.status_code == 200:
                print(f"{path}: 既に存在するためスキップ")
                continue

        print(f"{date_str} を再構築中...")
        day = build_day(date_str)
        if day is None:
            continue

        if dry_run:
            print(json.dumps(day, ensure_ascii=False, indent=2)[:2000])
            continue

        gh_put_json(path, day, f"Backfill history {date_str} (GH_PAT outage recovery)")

    print("完了")


if __name__ == "__main__":
    main()
