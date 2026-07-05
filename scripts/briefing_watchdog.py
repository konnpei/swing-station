"""
scripts/briefing_watchdog.py

平日朝7:00 JST（想定実行時刻6:30の30分後）に、その日のMorning Briefingが
実際に実行されたかを確認する。GitHub Actionsのスケジュール実行は
「best effort」でしばしば数分〜数十分遅れる/稀に発火しないことがあるため、
その保険として動く。

- data/latest.json の "date" が今日の日付でなければ、Morning Briefingが
  まだ実行されていないと判断し、workflow_dispatchで自動的に再実行をトリガーする
- 併せてDiscordに状況を通知する（無音の遅延・失敗に気づけるように）

Claude APIは呼ばない（GitHub API呼び出しのみ）。
"""
import os, base64, json
import requests
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")

REPO = "konnpei/swing-station"
GH_TOKEN = os.environ.get("GH_PAT", "")
DISCORD_WEBHOOK_MAIN = os.environ.get("DISCORD_WEBHOOK_MAIN", "")


def send_discord(text):
    if not DISCORD_WEBHOOK_MAIN:
        return
    try:
        requests.post(DISCORD_WEBHOOK_MAIN, json={"content": text})
    except Exception as e:
        print(f"Discord error: {e}")


def get_latest_date():
    url = f"https://api.github.com/repos/{REPO}/contents/data/latest.json"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_TOKEN}"})
    r.raise_for_status()
    content = base64.b64decode(r.json()["content"]).decode("utf-8")
    return json.loads(content).get("date", "")


def trigger_morning_briefing():
    url = f"https://api.github.com/repos/{REPO}/actions/workflows/morning-briefing.yml/dispatches"
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json"},
        json={"ref": "main"},
    )
    print(f"workflow_dispatch: {r.status_code}")
    return r.status_code == 204


def main():
    if NOW.weekday() >= 5:  # 5=土, 6=日
        print("週末のためチェックをスキップします。")
        return

    if not GH_TOKEN:
        print("GH_PAT not set. 終了します。")
        return

    latest_date = get_latest_date()
    print(f"今日: {TODAY} / latest.jsonの日付: {latest_date}")

    if latest_date == TODAY:
        print("本日分は正常に配信済みです。")
        return

    print("⚠ 本日分がまだ配信されていません。自動的に再実行をトリガーします。")
    ok = trigger_morning_briefing()
    if ok:
        send_discord(
            f"⏰ **Morning Briefing 遅延検知**\n"
            f"予定時刻（6:30 JST）を過ぎても本日（{TODAY}）分の配信が確認できなかったため、"
            f"自動的に再実行をトリガーしました。数分後に配信されるはずです。"
        )
    else:
        send_discord(
            f"🚨 **Morning Briefing 遅延検知（自動再実行にも失敗）**\n"
            f"本日（{TODAY}）分の配信が確認できず、自動再実行のトリガーにも失敗しました。"
            f"手動での確認をお願いします。"
        )


if __name__ == "__main__":
    main()
