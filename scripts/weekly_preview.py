"""
scripts/weekly_preview.py

毎週日曜夜、来週の決算カレンダー・経済指標イベントをもとに「来週の注目ポイント」
プレビュー記事を生成してDiscordに投稿する。決算タブ用に既に取得済みの
jp_earnings_calendar / us_earnings_calendar と、直近のevents_jp / events_usを再利用する。
"""
import os, json, base64
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


def gh_get_json(path):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_PAT}"})
    r.raise_for_status()
    data = r.json()
    return json.loads(base64.b64decode(data["content"]).decode("utf-8")), data["sha"]


def gh_put_json(path, obj, message, sha=None):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    if sha is None:
        rr = requests.get(url, headers={"Authorization": f"Bearer {GH_PAT}"})
        sha = rr.json().get("sha") if rr.status_code == 200 else None
    content_b64 = base64.b64encode(json.dumps(sanitize_for_json(obj), ensure_ascii=False, indent=2).encode("utf-8")).decode("ascii")
    body = {"message": message, "content": content_b64}
    if sha:
        body["sha"] = sha
    r = requests.put(url, headers={"Authorization": f"Bearer {GH_PAT}", "Content-Type": "application/json"}, json=body)
    print(f"{path}: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:500])


def within_next_week(date_str):
    if not date_str:
        return False
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return False
    today = NOW.date()
    return today <= d <= today + timedelta(days=7)


def build_next_week_summary(latest):
    jp_earn = [e for e in latest.get("jp_earnings_calendar", []) if within_next_week(e.get("next_earnings_date"))]
    us_earn = [e for e in latest.get("us_earnings_calendar", []) if within_next_week(e.get("next_earnings_date"))]

    def event_next_week(e):
        d = e.get("date", "")
        try:
            dt = datetime.strptime(d, "%Y-%m-%d").date()
        except ValueError:
            return False
        today = NOW.date()
        return today <= dt <= today + timedelta(days=7)

    events_jp = [e for e in latest.get("events_jp", []) if event_next_week(e)]
    events_us = [e for e in latest.get("events_us", []) if event_next_week(e)]

    return {
        "jp_earnings": jp_earn[:10],
        "us_earnings": us_earn[:10],
        "events_jp": events_jp[:10],
        "events_us": events_us[:10],
        "last_nikkei": latest.get("nikkei"),
        "last_nikkei_pct": latest.get("nikkei_pct"),
    }


def generate_preview(summary):
    prompt = f"""あなたはkabubocchi、日本の株クラで人気の個人投資家系コンテンツクリエイターです。
「来週の注目ポイント」というプレビュー記事を書いてください（日曜夜配信、月曜の相場に備える内容）。

【来週の実データ】
金曜終値時点の日経平均: {summary['last_nikkei']}円（前日比 {summary['last_nikkei_pct']}%）
来週の日本株決算予定: {json.dumps(summary['jp_earnings'], ensure_ascii=False)}
来週の米国株決算予定: {json.dumps(summary['us_earnings'], ensure_ascii=False)}
来週の日本の経済イベント: {json.dumps(summary['events_jp'], ensure_ascii=False)}
来週の米国の経済イベント: {json.dumps(summary['events_us'], ensure_ascii=False)}

【重要】上記の実データのみを使用すること。データが空の項目は無理に埋めず省略すること。
数値・銘柄・日付の創作は絶対禁止。「確実」「必ず」などの断定表現は避けること。

以下のJSON形式のみで出力してください（コードブロックや説明文は不要）:
{{
  "title": "来週の注目ポイントタイトル（20文字程度）",
  "note_body": "note用の本文（600〜1000文字）。構成：①来週の重要イベント ②注目決算 ③想定される値動きシナリオ（断定は避ける） ④かぶぼっちらしい一言",
  "discord_summary": "Discord用の短い要約（300文字程度）"
}}"""
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1800,
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


def main():
    print("latest.json 読み込み中...")
    latest, sha = gh_get_json("data/latest.json")

    summary = build_next_week_summary(latest)
    if not (summary["jp_earnings"] or summary["us_earnings"] or summary["events_jp"] or summary["events_us"]):
        print("来週のデータが何もありません。終了します。")
        return

    print("Claude APIでプレビュー生成中...")
    preview = generate_preview(summary)

    print("Discordに投稿中...")
    discord_msg = f"🔭 **来週の注目ポイント** {TODAY}\n\n{preview['discord_summary']}\n\n---\n**note用本文**\n{preview['note_body']}"
    for i in range(0, len(discord_msg), 1900):
        send_discord(discord_msg[i:i + 1900])

    print("data/weekly_preview/ 保存中...")
    gh_put_json(
        f"data/weekly_preview/{NOW.strftime('%Y-%m-%d')}.json",
        {"date": TODAY, "summary": summary, "preview": preview},
        f"Weekly preview {TODAY}",
    )

    print("latest.jsonに埋め込み中...")
    latest["weekly_preview"] = {"date": TODAY, **preview}
    gh_put_json("data/latest.json", latest, f"Add weekly preview {TODAY}", sha=sha)

    print("完了")


if __name__ == "__main__":
    main()
