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
    build_earnings_calendar, build_earnings_rank, sanitize_for_json,
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
        json.dumps(sanitize_for_json(obj), ensure_ascii=False, indent=2).encode("utf-8")
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

    # 日本株はJ-Quants(/equities/earnings-calendar)が「翌営業日に決算発表がある
    # 銘柄」のみを返す仕様のため、0件は「明日決算発表がある監視銘柄がない」という
    # 正常な結果であることが多い。米国株と違い、0件でも前回データは維持せず
    # 常に上書きする（前回データを維持すると、既に発表済みの古い予定日が
    # 残ってしまうため）。サプライズ%データが無いため jp_rank は常に空になる。
    jp_calendar = build_earnings_calendar(jp_earnings)
    jp_rank = build_earnings_rank(jp_earnings)
    if not jp_earnings:
        print("  本日・明日決算発表の監視銘柄なし（正常）")

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

    # 注: data/latest.json のコミット(gh_put_json)自体がVercelのGit連携による
    # 自動デプロイをトリガーするため、以前ここにあったVERCEL_DEPLOY_HOOK経由の
    # 明示的な再デプロイ呼び出しは二重デプロイの原因になっていたので削除した。

    print("完了。")


if __name__ == "__main__":
    main()

