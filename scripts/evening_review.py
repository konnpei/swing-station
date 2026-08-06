"""
scripts/evening_review.py

毎日21時頃(日本の決算発表がおおむね出そろう時間帯)に、その日の振り返りを
生成してdata/latest.jsonに保存する軽量スクリプト。Discordには投稿せず、
サイト表示専用。

- 「反省点」: 朝の見立て(consideration)と引け後の実際の相場を突き合わせた
  定性的な振り返り文のみ。勝率・損益などの実績数値(track_record.json)は
  現時点では非公開データのため一切使用しない(CLAUDE.mdのコンプライアンス方針)。
- 「決算振り返り」: 本日決算発表があった銘柄(days_until==0)について、
  その場でyfinanceから引け後の実際の株価反応%を取得し、実データのみで書く。
"""
import os, json, base64
from datetime import datetime, timezone, timedelta
import requests
from anthropic import Anthropic
from market_data import sanitize_for_json

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")
TODAY_ISO = NOW.strftime("%Y-%m-%d")

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GH_TOKEN = os.environ.get("GH_PAT", "")
REPO = "konnpei/swing-station"

client = Anthropic(api_key=ANTHROPIC_API_KEY)


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


def merge_updated_items(latest, label):
    items = latest.get("updated_items", []) if latest.get("updated_items_date") == TODAY else []
    if label not in items:
        items = items + [label]
    return items


def fetch_earnings_reactions(earnings_today):
    """本日決算発表があった銘柄の、引け後の実際の株価反応%をその場で取得する。
    jp_earnings_calendarのlast_earnings_reaction_pctは、発表当日〜翌日は
    グレー期間としてnext扱いのまま反応%が未計算のため、ここで直接取得する。"""
    import yfinance as yf
    results = []
    for e in earnings_today[:8]:
        code = e.get("code", "")
        try:
            hist = yf.Ticker(f"{code}.T").history(period="5d")
            hist = hist.dropna(subset=["Close"])
            if len(hist) < 2:
                continue
            latest_close = float(hist["Close"].iloc[-1])
            prev_close = float(hist["Close"].iloc[-2])
            pct = round((latest_close - prev_close) / prev_close * 100, 1)
            results.append({"code": code, "name": e.get("name", code), "sector": e.get("sector", ""), "pct": pct})
        except Exception as err:
            print(f"  {code} 株価反応取得エラー: {err}")
    return results


def generate_review(latest, earnings_reactions):
    consideration = latest.get("consideration", {}) or {}
    mode_label = {
        "normal": "通常モード", "surge": "爆騰モード", "crash": "暴落モード",
        "ai": "AIバブルモード", "yen": "円高ショックモード", "rate_cut": "利下げ期待モード",
        "earnings": "決算祭りモード", "geopolitical": "地政学リスクモード",
    }.get(latest.get("mode"), latest.get("mode", ""))

    prompt = f"""あなたはkabubocchi、日本の株クラで人気の個人投資家系コンテンツクリエイターです。
今日の取引を振り返る「夜のふりかえり」を書いてください(21時頃、サイト表示専用。Discordには投稿しません)。

【今日の朝の見立て】
モード: {mode_label}
今日のポイント: {consideration.get('point', '')}
アクション: {consideration.get('action', '')}

【今日の実際の相場】(引け後の数値)
日経平均: {latest.get('nikkei')}円 (前日比 {latest.get('nikkei_pct')}%)
USD/JPY: {latest.get('usd_jpy')}
SOX: {latest.get('sox_pct')}%
VIX: {latest.get('vix')}

【本日決算発表の銘柄と株価反応】(実データ、引け後の前日比%)
{json.dumps(earnings_reactions, ensure_ascii=False)}

【重要】
- 上記の実データのみを使用すること。データが無い項目は無理に埋めず省略すること
- 数値・銘柄・日付の創作は絶対禁止
- 「反省点」は勝率や損益などの実績数値は一切使わず、文章のみの定性的な振り返りにすること
  (今朝の相場観が当たったか外れたか、何を見落としていたか、次に活かせる視点など)
- 「決算振り返り」は上記の実データの株価反応%のみを使い、それ以外の数値は創作しないこと。
  決算銘柄が0件の場合は「本日は主要な決算発表はなかった」のような一文のみでよい

以下のJSON形式のみで出力してください(コードブロックや説明文は不要):
{{
  "reflection": "反省点の本文(300〜500文字程度)",
  "earnings_recap": "決算振り返りの本文(200〜400文字程度)"
}}"""
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


def main():
    if not GH_TOKEN:
        print("GH_PAT not set. 終了します。")
        return

    print("data/latest.json 読み込み中...")
    latest, sha = gh_get_json("data/latest.json")

    if not latest.get("is_trading_day", True):
        print("休場日のため終了します。")
        return

    print("本日決算発表の銘柄を確認中...")
    earnings_today = [e for e in latest.get("jp_earnings_calendar", []) if e.get("days_until") == 0]
    print(f"  {len(earnings_today)}件")

    print("株価反応をその場で取得中...")
    earnings_reactions = fetch_earnings_reactions(earnings_today)

    print("Claude APIで振り返り生成中...")
    review = generate_review(latest, earnings_reactions)

    latest["evening_review"] = {
        "date": TODAY,
        "generated_at": NOW.isoformat(),
        "reflection": review.get("reflection", ""),
        "earnings_recap": review.get("earnings_recap", ""),
        "earnings_today": earnings_reactions,
    }
    latest["updated_items"] = merge_updated_items(latest, "夜のふりかえり")
    latest["updated_items_date"] = TODAY

    print("data/latest.json 更新中...")
    gh_put_json("data/latest.json", latest, sha, f"Evening review {TODAY} (no Discord)")

    print("完了。")


if __name__ == "__main__":
    main()
