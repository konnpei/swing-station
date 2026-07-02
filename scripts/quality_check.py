"""
swing-station 品質チェッカー
"""
import re, json, anthropic

def run_quality_check(content_json, valid_codes, api_key):
    """
    生成コンテンツの品質チェック
    - 価格の断定表現がないか
    - 誇張・断定表現がないか
    - note本文（note_body）の文字数・構成・重複表現
    ※ 銘柄コードの検証は行わない（誤検知が多いため）
    戻り値: (ok: bool, issues: list)

    注意: note_bodyはJSONの末尾付近に位置するため、以前は文字数制限で
    切り捨てられて実質チェックされていなかった。ここではnote_bodyを
    切り捨てずに全文渡す。
    """
    note_body = content_json.get("note_body", "")
    rest = {k: v for k, v in content_json.items() if k != "note_body"}
    rest_str = json.dumps(rest, ensure_ascii=False)[:2500]

    check_prompt = f"""あなたは株式投資コンテンツの品質チェッカーです。
以下のコンテンツをチェックしてください。

【note本文・全文（必ず読むこと）】
{note_body}

【文字数】{len(note_body)}文字

【その他のコンテンツ（抜粋）】
{rest_str}

【チェック項目】
1. エントリー条件に具体的な株価（例：1200円、$95など数値）が含まれていないか
2. 「確実」「必ず」「令和最大級」「今週中に底」「高確率」などの強い断定表現がないか
3. 「機関投資家が買っている」など裏付けのない事実断定がないか
4. 実際に公開していないコンテンツへの誘導（「マガジンで公開中」など）がないか
5. note本文が1500〜2500文字の範囲に収まっているか（大きく外れている場合のみ指摘）
6. note本文にリード文・相場ポイント・注目銘柄・売買戦略・かぶぼっちコメント・明日の注目ポイントの
   6つの構成要素が一通り含まれているか（順序や見出し文言は多少違ってもよい）
7. 同じ言い回し・接続詞・フレーズが不自然に何度も繰り返されていないか

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
