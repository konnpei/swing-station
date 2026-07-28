import requests

candidates = [
    ("Bloomberg markets", "https://feeds.bloomberg.com/markets/news.rss"),
    ("Bloomberg japan?", "https://www.bloomberg.co.jp/feed"),
    ("Nikkei rss root", "https://www.nikkei.com/rss/"),
    ("Nikkei markets", "https://www.nikkei.com/rss/feed/nikkei/rss.xml"),
    ("Yahoo finance japan top", "https://news.yahoo.co.jp/rss/topics/business.xml"),
    ("Reuters japan biz", "https://assets.wor.jp/rss/rdf/reuters/business.rdf"),
]

for name, url in candidates:
    print(f"=== {name}: {url} ===")
    try:
        r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        print("status:", r.status_code, "content-type:", r.headers.get("content-type"), "len:", len(r.content))
        if r.status_code == 200 and ("xml" in r.headers.get("content-type", "") or r.content.strip().startswith(b"<?xml") or b"<rss" in r.content[:500] or b"<feed" in r.content[:500]):
            import xml.etree.ElementTree as ET
            try:
                root = ET.fromstring(r.content)
                items = root.findall(".//item")[:2] or root.findall(".//{http://www.w3.org/2005/Atom}entry")[:2]
                for item in items:
                    title_el = item.find("title") if item.find("title") is not None else item.find("{http://www.w3.org/2005/Atom}title")
                    link_el = item.find("link") if item.find("link") is not None else item.find("{http://www.w3.org/2005/Atom}link")
                    link_text = link_el.text if link_el is not None and link_el.text else (link_el.get("href") if link_el is not None else None)
                    print("  title:", title_el.text if title_el is not None else None)
                    print("  link:", link_text)
            except Exception as pe:
                print("  parse error:", pe)
                print("  preview:", r.content[:300])
    except Exception as e:
        print("ERROR:", e)
    print()
