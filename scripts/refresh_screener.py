"""
scripts/refresh_screener.py

監視銘柄（日本株66社・米国株26社）全体をRSI/MA25乖離/BB位置/出来高で
機械的にスコア化し、スコア上位（買い候補）・下位（要警戒）を抽出する
軽量スクリーナー。

Claude APIは一切呼ばない（純粋な計算のみ）ので、何度実行してもAPIコストは
かからない。Discordにも投稿しない。

【重要】これは投資助言ではない。RSI・移動平均・ボリンジャーバンドという
一般的なテクニカル指標だけを機械的に組み合わせたスコアであり、
「買い時」を保証するものではない。あくまで一次スクリーニングの参考情報。
"""
import os, json, base64
import requests
from datetime import datetime, timezone, timedelta

from market_data import fetch_jp_screener, fetch_us_screener, build_screener

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
    return json.loads(base64.b64decode(data["content"]).decode("utf-8")), data["sha"]


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
    print(f"{path}: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:500])
        raise RuntimeError(f"PUT {path} failed: {r.status_code}")


def main():
    if not GH_TOKEN:
        print("GH_PAT not set. 終了します。")
        return

    print("日本株スクリーニング中...")
    jp_tech = fetch_jp_screener()
    print(f"  取得件数: {len(jp_tech)}")

    print("米国株スクリーニング中...")
    us_tech = fetch_us_screener()
    print(f"  取得件数: {len(us_tech)}")

    print("data/latest.json 読み込み中...")
    latest, sha = gh_get_json("data/latest.json")

    if jp_tech:
        jp_screener = build_screener(jp_tech, 10)
    else:
        print("⚠ 日本株スクリーニング0件のため前回データを維持")
        jp_screener = latest.get("jp_screener", {"top": [], "bottom": []})

    if us_tech:
        us_screener = build_screener(us_tech, 10)
    else:
        print("⚠ 米国株スクリーニング0件のため前回データを維持")
        us_screener = latest.get("us_screener", {"top": [], "bottom": []})

    latest.update({
        "jp_screener": jp_screener,
        "us_screener": us_screener,
        "screener_refreshed_at": NOW.isoformat(),
    })

    print("data/latest.json 更新中...")
    gh_put_json("data/latest.json", latest, sha, f"Refresh screener {TODAY} (no Discord/no LLM)")

    print("完了。")


if __name__ == "__main__":
    main()
