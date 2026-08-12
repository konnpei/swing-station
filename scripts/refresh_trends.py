"""
scripts/refresh_trends.py

固定テーマ辞書 × Google News RSS を使って、当日のニュース言及量から
「今日の注目テーマ」を検出する軽量スクリプト（AI情報収集・テーマ検出 Phase 1）。

設計方針（CLAUDE.md の安定運用最優先に準拠）:
- Claude APIを一切呼ばない（コストゼロ・幻覚ゼロ）。テーマ名・要約文は
  すべて固定テンプレートで生成する。
- 関連銘柄は、market_data.py の既存監視銘柄リスト（WATCH_MAP/SECTOR_MAP）
  とテーマの静的対応表からのみ抽出する。AIによる自由生成は行わない
  （幻覚防止）。対応する監視銘柄がないテーマは related_stocks が
  空配列になる。これは不具合ではなく、根拠のない銘柄を出さないための
  意図した挙動。
- スコア計算式は compute_score() 内で完結し、外部モデルの判断を挟まない。
- data/latest.json は他の refresh_*.py と同じマージ方式で更新し、
  既存キーは一切変更しない（trend_themes / trend_themes_refreshed_at を
  追加するのみ）。
- data/trend_history.json に前日比計算用の日次件数スナップショットを
  保存する（直近 HISTORY_KEEP_DAYS 日分のみ保持）。

【重要】これは投資助言ではない。ニュース言及量という一次的な指標を
機械的に集計したものであり、市場への影響やテーマの重要度を保証するものではない。
"""
import os, json, base64
import requests
from datetime import datetime, timezone, timedelta
import xml.etree.ElementTree as ET

from market_data import WATCH_MAP, SECTOR_MAP, sanitize_for_json

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
TODAY = NOW.strftime("%Y/%m/%d")
TODAY_KEY = NOW.strftime("%Y-%m-%d")

REPO = "konnpei/swing-station"
GH_TOKEN = os.environ.get("GH_PAT", "")

HISTORY_KEEP_DAYS = 30

# ------------------------------------------------------------------
# テーマ辞書（Phase 1固定・16テーマ）
# keywords: Google News RSS検索クエリに使うキーワード（複数ある場合は
#           それぞれ個別に検索してマージする）
# stocks:   関連銘柄コード。market_data.WATCH_MAP に実在するコードのみを
#           手動で対応付けている。裏付けのある組み合わせがないテーマは
#           空配列のままにする（幻覚防止を優先）。
# ------------------------------------------------------------------
THEMES = [
    {"id": "ai", "name": "AI", "keywords": ["生成AI", "人工知能"], "stocks": ["9984", "6702", "4307"]},
    {"id": "semiconductor", "name": "半導体", "keywords": ["半導体"], "stocks": ["8035", "6857", "6920", "6723", "3436"]},
    {"id": "memory", "name": "メモリ", "keywords": ["メモリ半導体", "DRAM"], "stocks": []},
    {"id": "datacenter", "name": "データセンター", "keywords": ["データセンター"], "stocks": ["9432", "8035"]},
    {"id": "defense", "name": "防衛", "keywords": ["防衛費", "防衛産業"], "stocks": []},
    {"id": "shipbuilding", "name": "造船", "keywords": ["造船"], "stocks": []},
    {"id": "rare_earth", "name": "レアアース", "keywords": ["レアアース", "希土類"], "stocks": []},
    {"id": "power", "name": "電力", "keywords": ["電力料金", "再生可能エネルギー"], "stocks": []},
    {"id": "nuclear", "name": "原発", "keywords": ["原発再稼働", "原子力発電"], "stocks": []},
    {"id": "robot", "name": "ロボット", "keywords": ["産業用ロボット"], "stocks": ["6954", "6273"]},
    {"id": "drug_discovery", "name": "創薬", "keywords": ["新薬承認", "治験"], "stocks": ["4568", "4519", "4502", "4523"]},
    {"id": "regenerative", "name": "再生医療", "keywords": ["再生医療", "iPS細胞"], "stocks": []},
    {"id": "finance", "name": "金融", "keywords": ["日銀金融政策"], "stocks": ["8306", "8316", "8411", "8604", "8766"]},
    {"id": "crypto", "name": "暗号資産", "keywords": ["ビットコイン", "暗号資産"], "stocks": []},
    {"id": "yen_strong", "name": "円高", "keywords": ["円高"], "stocks": []},
    {"id": "yen_weak", "name": "円安", "keywords": ["円安"], "stocks": []},
]


def gh_get_json(path, default=None):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_TOKEN}"})
    if r.status_code == 404:
        return (default if default is not None else {}), None
    if r.status_code != 200:
        raise RuntimeError(f"GET {path} failed: {r.status_code} {r.text[:300]}")
    data = r.json()
    return json.loads(base64.b64decode(data["content"]).decode("utf-8")), data["sha"]


def gh_put_json(path, obj, sha, message):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    content_b64 = base64.b64encode(
        json.dumps(sanitize_for_json(obj), ensure_ascii=False, indent=2).encode("utf-8")
    ).decode("ascii")
    body = {"message": message, "content": content_b64}
    if sha:
        body["sha"] = sha
    r = requests.put(
        url,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json"},
        json=body,
    )
    print(f"{path}: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:500])
        raise RuntimeError(f"PUT {path} failed: {r.status_code}")


def fetch_theme_news(keywords):
    """
    テーマのキーワードでGoogle News RSSを検索し、記事一覧を返す。
    既存の morning_briefing.fetch_market_news() と同じ取得方式を踏襲。

    重複除去について（Phase 1の簡易実装）:
    同一イベントを複数媒体が報じても、記事タイトルは媒体ごとに表現が
    異なることが多く、Phase 1では厳密な「同一イベント判定」は行わない。
    ここではタイトル完全一致のみ重複除去する。真のイベント単位での
    クラスタリング（同一イベント1件＋複数ソース）はPhase 2で検討する。
    """
    items = []
    for kw in keywords:
        try:
            url = f"https://news.google.com/rss/search?q={kw}&hl=ja&gl=JP&ceid=JP:ja"
            r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            root = ET.fromstring(r.content)
        except Exception as e:
            print(f"  news fetch error ({kw}): {e}")
            continue
        for item in root.findall(".//item")[:15]:
            title_el = item.find("title")
            source_el = item.find("source")
            title = title_el.text if title_el is not None and title_el.text else ""
            source = source_el.text if source_el is not None and source_el.text else ""
            if title:
                items.append({"title": title[:100], "source": source})

    seen_titles = set()
    unique = []
    for it in items:
        if it["title"] not in seen_titles:
            seen_titles.add(it["title"])
            unique.append(it)
    return unique


def compute_score(news_count, yesterday_count, source_count):
    """
    Phase 1のスコア計算式（すべてコード上で完結・AIの判断を挟まない）:
      base      = news_count（記事数） × 8点
      diversity = source_count（distinct情報源数） × 6点
                  （複数媒体で報じられているテーマほど加点）
      momentum  = 前日比で増えていれば+20、減っていれば-10、同数なら0
      score = base + diversity + momentum を 0〜100 にクリップ
    """
    base = news_count * 8
    diversity = source_count * 6
    if yesterday_count == 0:
        momentum = 20 if news_count > 0 else 0
    elif news_count > yesterday_count:
        momentum = 20
    elif news_count < yesterday_count:
        momentum = -10
    else:
        momentum = 0
    score = base + diversity + momentum
    return max(0, min(100, score))


def direction_from(news_count, yesterday_count):
    if news_count > yesterday_count:
        return "up"
    if news_count < yesterday_count:
        return "down"
    return "flat"


def build_related_stocks(codes):
    out = []
    for code in codes:
        name = WATCH_MAP.get(f"{code}.T")
        if not name:
            continue
        out.append({"code": code, "name": name, "sector": SECTOR_MAP.get(code, "その他")})
    return out


def merge_updated_items(latest, label):
    items = latest.get("updated_items", []) if latest.get("updated_items_date") == TODAY else []
    if label not in items:
        items = items + [label]
    return items


def main():
    if not GH_TOKEN:
        print("GH_PAT not set. 終了します。")
        return

    print("data/latest.json 読み込み中...")
    latest, latest_sha = gh_get_json("data/latest.json")

    print("data/trend_history.json 読み込み中...")
    history, history_sha = gh_get_json("data/trend_history.json", default={})

    past_dates = sorted(d for d in history.keys() if d < TODAY_KEY)
    yesterday_counts = history[past_dates[-1]] if past_dates else {}

    trend_themes = []
    today_counts = {}

    for theme in THEMES:
        print(f"収集中: {theme['name']}")
        items = fetch_theme_news(theme["keywords"])
        news_count = len(items)
        source_count = len({it["source"] for it in items if it["source"]})
        y_count = yesterday_counts.get(theme["id"], 0)

        score = compute_score(news_count, y_count, source_count)
        direction = direction_from(news_count, y_count)
        today_counts[theme["id"]] = news_count

        direction_text = {"up": "増加", "down": "減少", "flat": "横ばい"}[direction]
        trend_themes.append({
            "id": theme["id"],
            "name": theme["name"],
            "score": score,
            "direction": direction,
            "news_count": news_count,
            "source_count": source_count,
            "prev_news_count": y_count,
            "summary": f"{theme['name']}関連のニュースが{direction_text}（{news_count}件・{source_count}媒体）",
            "related_stocks": build_related_stocks(theme["stocks"]),
            "sample_headlines": [it["title"] for it in items[:3]],
        })

    trend_themes.sort(key=lambda t: t["score"], reverse=True)

    latest["trend_themes"] = trend_themes
    latest["trend_themes_refreshed_at"] = NOW.isoformat()
    latest["updated_items"] = merge_updated_items(latest, "注目テーマ更新")
    latest["updated_items_date"] = TODAY

    print("data/latest.json 更新中...")
    gh_put_json("data/latest.json", latest, latest_sha, f"Refresh trend themes {TODAY} (no Discord/no LLM)")

    history[TODAY_KEY] = today_counts
    keep_dates = sorted(history.keys())[-HISTORY_KEEP_DAYS:]
    history = {d: history[d] for d in keep_dates}

    print("data/trend_history.json 更新中...")
    gh_put_json("data/trend_history.json", history, history_sha, f"Update trend history {TODAY}")

    print("完了。")


if __name__ == "__main__":
    main()
