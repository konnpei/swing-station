"""
scripts/weekly_review.py

毎週土曜朝、直近5営業日分のdata/history/を集計し、「今週の振り返り」記事を
Claude APIで生成してDiscordに投稿する。data/weekly_review/にも保存し、
サイト表示用にlatest.jsonにも埋め込む。
"""
import os, json, glob, base64
from datetime import datetime, timezone, timedelta
import requests
from anthropic import Anthropic
from market_data import sanitize_for_json

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
DISCORD_WEBHOOK_MAIN = os.environ.get("DISCORD_WEBHOOK_MAIN", "")
GH_PAT = os.environ.get("GH_PAT", "")
REPO = "konnpei/swing-station"

client = Anthropic(api_key=ANTHROPIC_API_KEY)


def load_week_history(days=5):
    files = sorted(glob.glob("data/history/*.json"))[-days:]
    week = []
    for f in files:
        try:
            with open(f, encoding="utf-8") as fh:
                week.append(json.load(fh))
        except Exception:
            continue
    return week


def summarize_week(week):
    if not week:
        return None
    nikkei_start = week[0].get("nikkei")
    nikkei_end = week[-1].get("nikkei")
    nikkei_week_pct = None
    if nikkei_start and nikkei_end:
        nikkei_week_pct = round((nikkei_end - nikkei_start) / nikkei_start * 100, 2)

    sector_totals = {}
    for day in week:
        for h in day.get("sector_heatmap", []):
            sector_totals.setdefault(h["sector"], []).append(h["avg_pct"])
    sector_week_avg = [
        {"sector": s, "avg_pct": round(sum(v) / len(v), 2)}
        for s, v in sector_totals.items()
    ]
    sector_week_avg.sort(key=lambda x: x["avg_pct"], reverse=True)

    all_movers = []
    for day in week:
        all_movers += day.get("jp_top_movers", [])
        all_movers += day.get("us_top_movers", [])
    top_movers_week = sorted(all_movers, key=lambda m: abs(m.get("pct", 0)), reverse=True)[:8]

    modes = [day.get("mode") for day in week if day.get("mode")]

    return {
        "dates": [day.get("date") for day in week],
        "nikkei_start": nikkei_start, "nikkei_end": nikkei_end, "nikkei_week_pct": nikkei_week_pct,
        "sector_week_best": sector_week_avg[:5],
        "sector_week_worst": sector_week_avg[-3:] if len(sector_week_avg) >= 3 else [],
        "top_movers_week": top_movers_week,
        "modes": modes,
    }


def generate_review(summary):
    prompt = f"""あなたはkabubocchi、日本の株クラで人気の個人投資家系コンテンツクリエイターです。
今週の振り返り記事を書いてください。

【今週の実データ】
期間: {summary['dates'][0]} 〜 {summary['dates'][-1]}
日経平均: {summary['nikkei_start']}円 → {summary['nikkei_end']}円（週間 {summary['nikkei_week_pct']}%）
セクター週間好調Top5: {json.dumps(summary['sector_week_best'], ensure_ascii=False)}
セクター週間不調: {json.dumps(summary['sector_week_worst'], ensure_ascii=False)}
値動き上位銘柄: {json.dumps(summary['top_movers_week'], ensure_ascii=False)}
相場モード推移: {summary['modes']}

【重要】上記の実データのみを使用すること。数値・銘柄の創作は絶対禁止。
「確実」「必ず」などの断定表現、投資助言と誤解される表現は避けること。

以下のJSON形式のみで出力してください（コードブロックや説明文は不要）:
{{
  "title": "今週の振り返りタイトル（20文字程度）",
  "note_body": "note用の本文（800〜1200文字）。構成：①今週の相場総括 ②好調だったセクター ③不調だったセクター ④値動きが大きかった銘柄 ⑤来週への一言（かぶぼっちらしい名言風コメント）",
  "discord_summary": "Discord用の短い要約（300文字程度）"
}}"""
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def send_discord(text):
    if not DISCORD_WEBHOOK_MAIN:
        return
    try:
        requests.post(DISCORD_WEBHOOK_MAIN, json={"content": text})
    except Exception as e:
        print(f"Discord error: {e}")


def gh_put_json(path, obj, message):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_PAT}"})
    sha = r.json().get("sha") if r.status_code == 200 else None
    content_b64 = base64.b64encode(json.dumps(sanitize_for_json(obj), ensure_ascii=False, indent=2).encode("utf-8")).decode("ascii")
    body = {"message": message, "content": content_b64}
    if sha:
        body["sha"] = sha
    r = requests.put(url, headers={"Authorization": f"Bearer {GH_PAT}", "Content-Type": "application/json"}, json=body)
    print(f"{path}: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:500])


def main():
    week = load_week_history(5)
    summary = summarize_week(week)
    if not summary:
        print("週間データがありません。終了します。")
        return

    print("Claude APIで振り返り生成中...")
    review = generate_review(summary)

    print("Discordに投稿中...")
    discord_msg = f"📅 **今週の振り返り** {TODAY}\n\n{review['discord_summary']}\n\n---\n**note用本文**\n{review['note_body']}"
    for i in range(0, len(discord_msg), 1900):
        send_discord(discord_msg[i:i + 1900])

    print("data/weekly_review/ 保存中...")
    gh_put_json(
        f"data/weekly_review/{NOW.strftime('%Y-%m-%d')}.json",
        {"date": TODAY, "summary": summary, "review": review},
        f"Weekly review {TODAY}",
    )

    print("latest.jsonに埋め込み中...")
    try:
        url = f"https://api.github.com/repos/{REPO}/contents/data/latest.json"
        r = requests.get(url, headers={"Authorization": f"Bearer {GH_PAT}"})
        latest_data = json.loads(base64.b64decode(r.json()["content"]).decode("utf-8"))
        latest_data["weekly_review"] = {"date": TODAY, **review}
        gh_put_json("data/latest.json", latest_data, f"Add weekly review {TODAY}")
    except Exception as e:
        print(f"latest.json update error: {e}")

    print("完了")


if __name__ == "__main__":
    main()
