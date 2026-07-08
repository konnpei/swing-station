"""
scripts/refresh_market_data.py

市場データ（日経225/NASDAQ/S&P500/SOX/TOPIX/セクター別ヒートマップ/値動き上位銘柄）
だけを再取得し、data/latest.json を更新する軽量スクリプト。

morning_briefing.py（フル朝刊生成）と違い、以下は一切行わない:
  - Claude APIでのコンテンツ生成（note本文・銘柄コメント・X投稿など）
  - Discordへの配信
  - data/history/ への保存（当日分のスナップショットは上書きしない）

そのため、何度手動実行してもコストや重複投稿の心配がない。
GitHub Actions（workflow_dispatch）から呼び出す想定。

必要な環境変数:
  GH_PAT             - data/latest.json をGitHub API経由で更新するために必須
  VERCEL_DEPLOY_HOOK - 任意。設定されていればVercelの再デプロイをトリガー
"""
import os, json, base64
import requests
from datetime import datetime, timezone, timedelta

from market_data import (
    fetch_market_data,
    fetch_all_watch_changes, fetch_surge_drop, build_sector_heatmap, top_movers,
    fetch_us_watch_changes,
)

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")

REPO = "konnpei/swing-station"
GH_TOKEN = os.environ.get("GH_PAT", "")


def gh_get_json(path):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_TOKEN}"})
    if r.status_code != 200:
        raise RuntimeError(f"GET {path} failed: {r.status_code} {r.text[:300]}")
    data = r.json()
    content = base64.b64decode(data["content"]).decode("utf-8")
    return json.loads(content), data["sha"]


def gh_put_json(path, obj, sha, message):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    content_b64 = base64.b64encode(
        json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
    ).decode("ascii")
    body = {"message": message, "content": content_b64, "sha": sha}
    r = requests.put(
        url,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json"},
        json=body,
    )
    print(f"{path} updated: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:500])
        raise RuntimeError(f"PUT {path} failed: {r.status_code}")


def main():
    if not GH_TOKEN:
        print("GH_PAT not set. このスクリプトはGitHub API経由でのみ更新するため終了します。")
        return

    print("市場データ取得中...")
    data = fetch_market_data()

    print("日本株ウォッチリスト取得中...")
    jp_changes = fetch_all_watch_changes()
    surges, drops = fetch_surge_drop(jp_changes)
    sector_heatmap = build_sector_heatmap(jp_changes)
    jp_top = top_movers(jp_changes, 10)

    print("米国株ウォッチリスト取得中...")
    us_changes = fetch_us_watch_changes()
    us_sector_heatmap = build_sector_heatmap(us_changes)
    us_top = top_movers(us_changes, 10)

    print("data/latest.json 読み込み中...")
    latest, sha = gh_get_json("data/latest.json")

    # 監視銘柄の取得が（レート制限等で）全滅した場合、空データで既存の良いデータを
    # 上書きしないよう、失敗時は前回値を維持する。
    if jp_changes:
        surges_out, drops_out = surges, drops
        sector_heatmap_out, jp_top_out, jp_changes_out = sector_heatmap, jp_top, jp_changes
    else:
        print("⚠ 日本株ウォッチリスト取得が0件のため、前回のsector_heatmap/jp_top_movers/jp_all_changesを維持します")
        surges_out, drops_out = latest.get("surges", []), latest.get("drops", [])
        sector_heatmap_out = latest.get("sector_heatmap", [])
        jp_top_out = latest.get("jp_top_movers", [])
        jp_changes_out = latest.get("jp_all_changes", [])

    if us_changes:
        us_sector_heatmap_out, us_top_out, us_changes_out = us_sector_heatmap, us_top, us_changes
    else:
        print("⚠ 米国株ウォッチリスト取得が0件のため、前回のus_sector_heatmap/us_top_movers/us_all_changesを維持します")
        us_sector_heatmap_out = latest.get("us_sector_heatmap", [])
        us_top_out = latest.get("us_top_movers", [])
        us_changes_out = latest.get("us_all_changes", [])

    # 市場指数・ヒートマップ・値動き上位系のみ上書き。
    # stocks_jp / stock_us / note_body / x_posts / events_jp / events_us 等の
    # Claude生成コンテンツはそのまま維持する。
    latest.update({
        "nikkei": data["latest"]["close"],
        "nikkei_diff": int(data["diff"]),
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
        "btc": data.get("btc", 0.0), "btc_pct": data.get("btc_pct", 0.0),
        "dxy": data.get("dxy", 0.0), "dxy_pct": data.get("dxy_pct", 0.0),
        "gold": data.get("gold", 0.0), "gold_pct": data.get("gold_pct", 0.0),
        "topix": data.get("topix", 0.0),
        "topix_pct": data.get("topix_pct", 0.0),
        "nasdaq": data.get("nasdaq", 0.0),
        "nasdaq_pct": data.get("nasdaq_pct", 0.0),
        "sp500": data.get("sp500", 0.0),
        "sp500_pct": data.get("sp500_pct", 0.0),
        "surges": surges_out,
        "drops": drops_out,
        "sector_heatmap": sector_heatmap_out,
        "jp_top_movers": jp_top_out,
        "jp_all_changes": jp_changes_out,
        "us_sector_heatmap": us_sector_heatmap_out,
        "us_top_movers": us_top_out,
        "us_all_changes": us_changes_out,
        "market_data_refreshed_at": NOW.isoformat(),
    })

    print("data/latest.json 更新中...")
    gh_put_json("data/latest.json", latest, sha, f"Refresh market data only {TODAY} (no Discord/no LLM)")

    vercel_hook = os.environ.get("VERCEL_DEPLOY_HOOK", "")
    if vercel_hook:
        try:
            vr = requests.post(vercel_hook)
            print(f"Vercel redeploy triggered: {vr.status_code}")
        except Exception as ve:
            print(f"Vercel trigger error: {ve}")

    print("完了。Discord投稿・note生成・Claude API呼び出しは一切行っていません。")


if __name__ == "__main__":
    main()
