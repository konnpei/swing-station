"""
scripts/refresh_earnings.py

決算カレンダー・決算サプライズランキングだけを取得し、data/latest.jsonを更新する
軽量スクリプト。市場データ更新（refresh_market_data.py）とは別ワークフローに分離。

理由: 決算情報は銘柄ごとに追加のAPI呼び出しが必要（56銘柄分）。既存の値動き取得と
まとめると1回の実行あたりの呼び出し数が倍増し、Yahoo Finance側のレート制限に
かかりやすくなるため、独立させて影響範囲を分離している。

Claude APIは呼ばず、Discordにも投稿しない。
"""
import os, json, base64
import requests
from datetime import datetime, timezone, timedelta

from market_data import (
    fetch_jp_earnings, fetch_us_earnings,
    build_earnings_calendar, build_earnings_rank,
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
        print("GH_PAT not set. 終了します。")
        return

    _debug_log = []
    print("日本株の決算情報取得中...")
    jp_earnings = fetch_jp_earnings(debug_log=_debug_log)
    print(f"  取得件数: {len(jp_earnings)}")

    print("米国株の決算情報取得中...")
    us_earnings = fetch_us_earnings(debug_log=_debug_log)
    print(f"  取得件数: {len(us_earnings)}")

    print("data/latest.json 読み込み中...")
    latest, sha = gh_get_json("data/latest.json")

    # 取得0件の場合は前回データを維持（空データで上書きしない）
    if jp_earnings:
        jp_calendar = build_earnings_calendar(jp_earnings)
        jp_rank = build_earnings_rank(jp_earnings)
    else:
        print("⚠ 日本株決算情報0件のため前回データを維持")
        jp_calendar = latest.get("jp_earnings_calendar", [])
        jp_rank = latest.get("jp_earnings_rank", {"best": [], "worst": []})

    if us_earnings:
        us_calendar = build_earnings_calendar(us_earnings)
        us_rank = build_earnings_rank(us_earnings)
    else:
        print("⚠ 米国株決算情報0件のため前回データを維持")
        us_calendar = latest.get("us_earnings_calendar", [])
        us_rank = latest.get("us_earnings_rank", {"best": [], "worst": []})

    latest.update({
        "jp_earnings_calendar": jp_calendar,
        "jp_earnings_rank": jp_rank,
        "us_earnings_calendar": us_calendar,
        "us_earnings_rank": us_rank,
        "earnings_refreshed_at": NOW.isoformat(),
    })

    print("data/latest.json 更新中...")
    gh_put_json("data/latest.json", latest, sha, f"Refresh earnings data {TODAY} (no Discord/no LLM)")

    vercel_hook = os.environ.get("VERCEL_DEPLOY_HOOK", "")
    if vercel_hook:
        try:
            vr = requests.post(vercel_hook)
            print(f"Vercel redeploy triggered: {vr.status_code}")
        except Exception as ve:
            print(f"Vercel trigger error: {ve}")

    print("完了。")


if __name__ == "__main__":
    main()
