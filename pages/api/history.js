import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const histDir = path.join(process.cwd(), "data", "history");
    
    if (!fs.existsSync(histDir)) {
      return res.status(200).json({ history: [] });
    }

    const files = fs.readdirSync(histDir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 30); // 直近30日

    const history = files.map(file => {
      try {
        const raw = fs.readFileSync(path.join(histDir, file), "utf-8");
        const d = JSON.parse(raw);
        return {
          date: d.date,
          mode: d.mode,
          nikkei: d.nikkei,
          nikkei_pct: d.nikkei_pct,
          usd_jpy: d.usd_jpy,
          sox_pct: d.sox_pct,
          vix: d.vix,
          stocks_jp: (d.stocks_jp || []).map(s => ({ name: s.name, code: s.code, score: s.score })),
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    res.status(200).json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message, history: [] });
  }
}
