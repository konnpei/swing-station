import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), "data", "latest_chart.png");

    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }

    const buf = fs.readFileSync(filePath);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).end();
  }
}
