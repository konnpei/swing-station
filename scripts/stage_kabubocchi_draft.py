#!/usr/bin/env python3
"""KabuBocchi draft staging: fail closed, never posts to note."""
import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
REQUIRED_IMAGES = [
    ("market-risk", "data/latest_chart.png"),
    ("trading-plan", "data/latest_banner.png"),
    ("long-term", "data/latest_stock_charts.png"),
]

def stage(source, outdir, today=None):
    data = json.loads(Path(source).read_text(encoding="utf-8"))
    today = today or datetime.now(JST).date().isoformat()
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    issues = []
    raw_date = str(data.get("date", "")).replace("/", "-")
    if raw_date != today:
        issues.append(f"日付不一致: latest={raw_date or '未確認'}, JST={today}")
    body = data.get("note_full_text")
    if not isinstance(body, str) or len(body.strip()) < 800:
        issues.append("note_full_text が未生成または短すぎます（800文字未満）")
        body = body if isinstance(body, str) else ""
    if not ("無料" in body and "有料" in body):
        issues.append("無料・有料境界が未確認")
    if "出典" not in body and "情報源" not in body:
        issues.append("情報源の記載が未確認")
    if not ("損切" in body or "撤退" in body):
        issues.append("撤退条件が未確認")
    assets = []
    for label, filename in REQUIRED_IMAGES:
        path = Path(filename)
        exists = path.is_file() and path.stat().st_size > 1000
        assets.append({"role": label, "file": filename, "exists": exists})
        if not exists:
            issues.append(f"画像不足: {filename}")
    # Existing assets are charts/banner, NOT verified original mascot images.
    issues.append("既存3画像は統一クレイキャラの独立3構図として未検証")
    (out / "article.md").write_text(body, encoding="utf-8")
    manifest = {
        "date": today, "status": "NEEDS_REVIEW" if issues else "READY",
        "note_published": False, "note_draft_saved": False,
        "price_setting": "manual", "issues": issues, "assets": assets,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "REVIEW.txt").write_text(
        "KabuBocchi 下書き検査\n状態: " + manifest["status"] +
        "\nNOTEへの自動送信・公開はしていません。\n" +
        "\n".join("- " + i for i in issues) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", default="data/latest.json")
    p.add_argument("--out", default="draft-output")
    p.add_argument("--date", default=None)
    args = p.parse_args()
    stage(args.source, args.out, args.date)
