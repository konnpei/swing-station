import subprocess, os, sys, requests, traceback

DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_MAIN", "")

def send_discord(msg):
    if DISCORD_WEBHOOK:
        try:
            requests.post(DISCORD_WEBHOOK, json={"content": msg})
        except:
            pass

try:
    result = subprocess.run(
        [sys.executable, "scripts/morning_briefing.py"],
        capture_output=True, text=True, timeout=600
    )
    if result.returncode != 0:
        err = result.stdout[-2000:] + "\n" + result.stderr[-500:]
        send_discord(f"🚨 **swing-station エラー**\n```\n{err[:1800]}\n```")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)
    else:
        print(result.stdout)
except Exception as e:
    err = traceback.format_exc()
    send_discord(f"🚨 **swing-station 致命的エラー**\n```\n{err[:1800]}\n```")
    raise
