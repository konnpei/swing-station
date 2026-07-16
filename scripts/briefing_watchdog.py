"""
scripts/briefing_watchdog.py

平日7:30 JSTに、その日のMorning Briefingが実際に実行されたかを確認する。
Morning Briefingの実行予定は5:30 JSTだが、GitHub Actionsのスケジュール実行は
「best effort」でしばしば1時間近く遅れるため、実際の着地は6:30 JST前後を想定
（=5:30予定から1時間のバッファを見込んで7:30にチェック）。

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


def get_latest_data():
    url = f"https://api.github.com/repos/{REPO}/contents/data/latest.json"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_TOKEN}"})
    r.raise_for_status()
    content = base64.b64decode(r.json()["content"]).decode("utf-8")
    return json.loads(content)


def get_latest_date():
    return get_latest_data().get("date", "")


def parse_iso_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def check_freshness(latest):
    alerts = []

    if latest.get("nikkei_data_stale"):
        alerts.append("日経225データが古い可能性があります（nikkei_data_stale=true）。")

    for key, label in [
        ("market_data_refreshed_at", "市場データ"),
        ("screener_refreshed_at", "スクリーナー"),
    ]:
        refreshed_at = parse_iso_datetime(latest.get(key))
        if refreshed_at is None:
            alerts.append(f"{label}の最終更新時刻が確認できません（{key}なし）。")
            continue

        age_hours = (NOW - refreshed_at.astimezone(JST)).total_seconds() / 3600
        if age_hours >= 48:
            alerts.append(
                f"{label}が48時間以上更新されていません（最終更新: {refreshed_at.astimezone(JST).isoformat()} / 約{age_hours:.1f}時間前）。"
            )

    if not alerts:
        print("data freshness OK")
        return True

    send_discord(
        "⚠️ **データ鮮度監視アラート**\n"
        + "\n".join(f"- {alert}" for alert in alerts)
    )
    return False


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

    latest_data = get_latest_data()
    latest_date = latest_data.get("date", "")
    print(f"今日: {TODAY} / latest.jsonの日付: {latest_date}")

    check_freshness(latest_data)

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
