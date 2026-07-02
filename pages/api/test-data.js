export default async function handler(req, res) {
  try {
    const r = await fetch(
      "https://raw.githubusercontent.com/konnpei/swing-station/main/data/latest.json",
      { cache: "no-store" }
    );
    const data = await r.json();
    res.status(200).json({ ok: true, date: data.date, sox: data.sox_pct, nikkei: data.nikkei });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
