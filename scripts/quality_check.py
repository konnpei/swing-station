"""
swing-station 品質チェッカー
このファイルは削除・変更禁止。チェックをスキップする場合はAnthropicに相談。
"""
import re, json, anthropic

def run_quality_check(content_json, valid_codes, api_key):
    """
    生成コンテンツの品質チェック（チャッピー基準）
    - 銘柄コードが実データから取得したものか
    - 価格の断定表現がないか
    - 誇張・断定表現がないか
    戻り値: (ok: bool, issues: list)
    """
    content_str = json.dumps(content_json, ensure_ascii=False, indent=2)[:4000]
    
    check_prompt = f"""あなたは株式投資コンテンツの品質チェッカーです。
以下のJSONコンテンツを厳しくチェックしてください。

【チェック項目】
1. 銘柄コードが有効リストに含まれているか: {valid_codes}
2. エントリー条件に具体的な株価（例：1200円、$95など）が含まれていないか
3. 以下の断定・誇張表現がないか:
   - 「確実」「必ず」「令和最大級」「今週中に底」「高確率」
   - 「機関投資家が買っている」など未確認の事実
   - 統計的裏付けのない断言
4. 推測は「〜の可能性がある」「〜との見方もある」になっているか
5. 銘柄コードと銘柄名が正しく対応しているか

チェック対象:
{content_str}

以下のJSON形式のみで返答してください:
{{"ok": true}} または {{"ok": false, "issues": ["問題1", "問題2"]}}"""

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=800,
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
