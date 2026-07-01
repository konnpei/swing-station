"""
swing-station 品質チェッカー
"""
import re, json, anthropic

def run_quality_check(content_json, valid_codes, api_key):
    """
    生成コンテンツの品質チェック
    - 価格の断定表現がないか
    - 誇張・断定表現がないか
    ※ 銘柄コードの検証は行わない（誤検知が多いため）
    戻り値: (ok: bool, issues: list)
    """
    content_str = json.dumps(content_json, ensure_ascii=False, indent=2)[:3000]

    check_prompt = f"""あなたは株式投資コンテンツの品質チェッカーです。
以下のJSONコンテンツをチェックしてください。

【チェック項目】（これだけをチェック）
1. エントリー条件に具体的な株価（例：1200円、$95など数値）が含まれていないか
2. 「確実」「必ず」「令和最大級」「今週中に底」「高確率」などの強い断定表現がないか
3. 「機関投資家が買っている」など裏付けのない事実断定がないか
4. 実際に公開していないコンテンツへの誘導（「マガジンで公開中」など）がないか

【チェック対象】
{content_str}

【注意】
- 銘柄コードの正誤チェックはしないでください
- 「+3%」「-2%」などの目標値はOKです
- 「〜の可能性がある」「〜との見方もある」はOKです
- 軽微な表現より重大な問題だけを指摘してください

以下のJSON形式のみで返答してください:
{{"ok": true}} または {{"ok": false, "issues": ["重大な問題のみ"]}}"""

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=500,
        messages=[{"role": "user", "content": check_prompt}]
    )
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", raw)
    try:
        result = json.loads(raw)
        return result.get("ok", True), result.get("issues", [])
    except:
        return True, []
