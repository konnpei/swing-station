"""
scripts/track_record.py

朝刊で推奨した日本株（stocks_jp）のtarget/stop成否を、推奨から5営業日後に
自動判定し、data/track_record.jsonに記録する軽量スクリプト。
Claude APIもDiscordも使わないため、手動で何度実行してもコストや重複投稿の
心配はない（同じ推奨日+銘柄コードの組はスキップするため二重記録もされない）。

判定ルール:
- 日足の高値・安値ベースで判定する
- 同じ営業日にtarget/stopの両方に到達した場合は、保守的にstopを優先する
- 推奨から5営業日以内にどちらにも到達しなければ、5営業日目の終値で
  決済したものとみなす（タイムアウト）

このデータは非公開データとして扱う。サイト・Discordのどちらにも一切
表示・投稿しない（勝率・リターンの対外公開は投資助言業の登録要否に
関わる可能性があるため、公開判断には別途専門家確認が必要という認識）。

必要な環境変数:
  GH_PAT - data/track_record.json をGitHub API経由で更新するために必須
"""
import os, json, re, base64
import requests
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)

REPO = "konnpei/swing-station"
GH_TOKEN = os.environ.get("GH_PAT", "")

JUDGE_BUSINESS_DAYS = 5


def business_days_before(base_date, n):
    """base_dateからn営業日（土日を除く）だけ遡った日付を返す。日本の祝日は考慮しない。"""
    d = base_date
    count = 0
    while count < n:
        d -= timedelta(days=1)
        if d.weekday() < 5:
            count += 1
    return d


def gh_get_json(path):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {GH_TOKEN}"})
    if r.status_code == 404:
        return None, None
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
    body = {"message": message, "content": content_b64}
    if sha:
        body["sha"] = sha
    r = requests.put(
        url,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json"},
        json=body,
    )
    print(f"{path} updated: {r.status_code}")
    if r.status_code not in (200, 201):
        print(r.text[:500])
        raise RuntimeError(f"PUT {path} failed: {r.status_code}")


def parse_pct(s):
    """'+3%' / '-2%' のような文字列から符号付きパーセント数値を取り出す。パース失敗時はNone。"""
    if not isinstance(s, str):
        return None
    m = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", s)
    if not m:
        return None
    return float(m.group(1))


def judge_stock(code, recommend_date_str, target_pct, stop_pct):
    """
    指定銘柄について、推奨日を起点とした5営業日以内のtarget/stop成否を判定する。
    朝刊は取引開始前(6:30 JST)に生成されるため、推奨が参照する株価は
    「推奨日の前営業日終値」であり、これをエントリー価格の起点とする。
    データが不足している場合はNoneを返す。
    """
    import yfinance as yf

    recommend_date = datetime.strptime(recommend_date_str, "%Y/%m/%d").date()
    start = recommend_date - timedelta(days=10)
    end = recommend_date + timedelta(days=15)

    try:
        hist = yf.Ticker(f"{code}.T").history(start=start.isoformat(), end=end.isoformat())
    except Exception as e:
        print(f"  {code} yfinance取得エラー: {e}")
        return None
    hist = hist.dropna(subset=["Open", "High", "Low", "Close"])
    if hist.empty:
        return None

    dates = [d.date() for d in hist.index]

    prior_idx = [i for i, d in enumerate(dates) if d < recommend_date]
    if not prior_idx:
        return None
    entry_price = float(hist["Close"].iloc[prior_idx[-1]])

    target_price = entry_price * (1 + target_pct / 100)
    stop_price = entry_price * (1 + stop_pct / 100)

    judge_idx = [i for i, d in enumerate(dates) if d >= recommend_date][:JUDGE_BUSINESS_DAYS]
    if len(judge_idx) < JUDGE_BUSINESS_DAYS:
        # 判定に必要な5営業日ぶんのデータがまだ揃っていない
        return None

    for day_num, i in enumerate(judge_idx, start=1):
        high = float(hist["High"].iloc[i])
        low = float(hist["Low"].iloc[i])
        hit_target = high >= target_price
        hit_stop = low <= stop_price
        # 同日に両方到達した場合は保守的にstop優先
        if hit_stop:
            result, exit_price = "stop", stop_price
        elif hit_target:
            result, exit_price = "target", target_price
        else:
            continue
        return {
            "entry_price": round(entry_price, 2),
            "target_price": round(target_price, 2),
            "stop_price": round(stop_price, 2),
            "result": result,
            "exit_price": round(exit_price, 2),
            "exit_date": dates[i].isoformat(),
            "business_days_to_exit": day_num,
            "return_pct": round((exit_price - entry_price) / entry_price * 100, 2),
        }

    # 5営業日以内にどちらにも到達しなければ、5営業日目の終値で決済したとみなす（タイムアウト）
    last_i = judge_idx[-1]
    exit_price = float(hist["Close"].iloc[last_i])
    return {
        "entry_price": round(entry_price, 2),
        "target_price": round(target_price, 2),
        "stop_price": round(stop_price, 2),
        "result": "timeout",
        "exit_price": round(exit_price, 2),
        "exit_date": dates[last_i].isoformat(),
        "business_days_to_exit": JUDGE_BUSINESS_DAYS,
        "return_pct": round((exit_price - entry_price) / entry_price * 100, 2),
    }


def main():
    if not GH_TOKEN:
        print("GH_PAT not set. このスクリプトはGitHub API経由でのみ更新するため終了します。")
        return

    target_date = business_days_before(NOW.date(), JUDGE_BUSINESS_DAYS)
    history_path = f"data/history/{target_date.strftime('%Y-%m-%d')}.json"

    if not os.path.exists(history_path):
        print(f"{history_path} が存在しません（休場日等で朝刊が生成されなかった可能性）。終了します。")
        return

    with open(history_path, "r", encoding="utf-8") as f:
        history = json.load(f)

    recommend_date_str = history.get("date", target_date.strftime("%Y/%m/%d"))
    stocks_jp = history.get("stocks_jp", [])
    if not stocks_jp:
        print(f"{history_path} にstocks_jpが無いため終了します。")
        return

    print(f"判定対象: {recommend_date_str} 推奨の{len(stocks_jp)}銘柄")

    records, sha = gh_get_json("data/track_record.json")
    if records is None:
        records = []
    existing_keys = {(r["recommend_date"], r["code"]) for r in records}

    new_records = []
    for s in stocks_jp:
        code = str(s.get("code", ""))
        name = s.get("name", "")
        if not code:
            continue
        if (recommend_date_str, code) in existing_keys:
            print(f"  {code} {name}: 既に判定済みのためスキップ")
            continue

        target_pct = parse_pct(s.get("target", ""))
        stop_pct = parse_pct(s.get("stop", ""))
        if target_pct is None or stop_pct is None:
            print(f"  {code} {name}: target/stopをパースできずスキップ ({s.get('target')!r}, {s.get('stop')!r})")
            continue

        judged = judge_stock(code, recommend_date_str, target_pct, stop_pct)
        if judged is None:
            print(f"  {code} {name}: 判定に必要なデータが不足のためスキップ")
            continue

        record = {
            "recommend_date": recommend_date_str,
            "judge_date": NOW.strftime("%Y/%m/%d"),
            "code": code,
            "name": name,
            "pattern": s.get("pattern", ""),
            "target_pct": target_pct,
            "stop_pct": stop_pct,
            **judged,
        }
        print(f"  {code} {name}: {record['result']} ({record['return_pct']:+.2f}%, {record['business_days_to_exit']}営業日目)")
        new_records.append(record)

    if not new_records:
        print("新規記録なし。")
        return

    records.extend(new_records)
    gh_put_json(
        "data/track_record.json", records, sha,
        f"Track record: {recommend_date_str} 推奨分を判定 ({len(new_records)}件)",
    )


if __name__ == "__main__":
    main()
