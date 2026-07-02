import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const histDir = path.join(process.cwd(), "data", "history");
    const { date } = req.query;

    if (!fs.existsSync(histDir)) {
      return res.status(200).json({ history: [] });
    }

    // 特定日の朝刊フル詳細を返す(日付ピッカー用)
    if (date) {
      const filePath = path.join(histDir, `${date}.json`);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `${date} のデータが見つかりません` });
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      return res.status(200).json({ date, data });
    }

    // 既存: 履歴タブの統計表示用(直近30日分の要約)
    const files = fs.readdirSync(histDir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 30);

    const history = files.map(file => {
      try {
        const rawFile = fs.readFileSync(path.join(histDir, file), "utf-8");
        const d = JSON.parse(rawFile);
        return {
          date: d.date,
          fileDate: file.replace(".json", ""),
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
