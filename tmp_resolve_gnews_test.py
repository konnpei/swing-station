import requests
import xml.etree.ElementTree as ET

url = "https://news.google.com/rss/search?q=日本経済 OR 株式市場 OR 日銀 OR 為替&hl=ja&gl=JP&ceid=JP:ja"
r = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
root = ET.fromstring(r.content)

items = root.findall(".//item")[:3]
for item in items:
    title = item.find("title").text
    link = item.find("link").text
    print("RAW LINK:", link[:120])
    try:
        resp = requests.get(link, timeout=8, allow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
        print("  -> status:", resp.status_code, "final_url:", resp.url[:150])
    except Exception as e:
        print("  -> ERROR:", e)
    print()
