// scripts/briefing_watchdog.py と同じ「今日分が届いているか」チェック＋
// 未達なら workflow_dispatch で自動再実行、を行うフェイルセーフ。
//
// briefing_watchdog.py との違いはただ一つ、実行基盤: これはVercel Cronから
// 呼ばれる。GitHub Actionsのscheduled cronは同一プラットフォーム内の障害・
// 遅延で「本体(morning-briefing.yml)」と「監視役(briefing-watchdog.yml)」が
// 揃って発火しないことがあり(2026-08-27, 08-28, 09-01と複数回確認済み)、
// 監視役が同じ土俵にいるとセーフティネットとして機能しない。GitHub Actionsとは
// 独立した実行基盤(Vercel Cron)から叩くことで、この相関障害を切り分ける。
//
// 必要なVercel環境変数(GitHub Actions Secretsとは別管理・ここで新規に追加):
//   CRON_SECRET       … Vercel Cronがこのルートを呼ぶ際の認証に使う共有シークレット。
//                        Vercelはcrons設定時、このENV名と同じ値を
//                        `Authorization: Bearer <値>` として自動付与する。
//   GH_ACTIONS_TOKEN  … repo:swing-station への workflow_dispatch権限を持つPAT。
//                        GitHub Actions Secretsの GH_PAT と同じ値を流用してよい。
//   DISCORD_WEBHOOK_MAIN … (任意) 設定しておくと自動再実行時にDiscordへ通知する。
//                        未設定でも動作する(通知だけ省略)。

const REPO = "konnpei/swing-station";
const RAW_LATEST_URL = `https://raw.githubusercontent.com/${REPO}/main/data/latest.json`;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function todayJst() {
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { dateStr: `${y}/${m}/${d}`, weekday: now.getUTCDay() }; // 0=日,6=土
}

async function fetchLatestDate() {
  const r = await fetch(`${RAW_LATEST_URL}?t=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!r.ok) throw new Error(`data/latest.json取得失敗: ${r.status}`);
  const data = await r.json();
  return data.date || "";
}

async function hasRunInFlight(token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/morning-briefing.yml/runs?status=in_progress&per_page=1`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!r.ok) return false; // 判定できない場合は「無し」扱いにして先へ進む(fail-open)
  const j = await r.json();
  if ((j.total_count || 0) > 0) return true;

  const r2 = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/morning-briefing.yml/runs?status=queued&per_page=1`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!r2.ok) return false;
  const j2 = await r2.json();
  return (j2.total_count || 0) > 0;
}

async function triggerMorningBriefing(token) {
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/morning-briefing.yml/dispatches`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  return r.status === 204;
}

async function notifyDiscord(text) {
  const webhook = process.env.DISCORD_WEBHOOK_MAIN;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
  } catch (e) {
    // 通知の成否はフェイルセーフ本体の動作に影響させない
  }
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: "CRON_SECRET未設定のため fail-closed で拒否" });
  }
  if (req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const ghToken = process.env.GH_ACTIONS_TOKEN;
  if (!ghToken) {
    return res.status(500).json({ error: "GH_ACTIONS_TOKEN未設定" });
  }

  const { dateStr, weekday } = todayJst();
  if (weekday === 0 || weekday === 6) {
    return res.status(200).json({ skipped: "weekend", today: dateStr });
  }

  let latestDate;
  try {
    latestDate = await fetchLatestDate();
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }

  if (latestDate === dateStr) {
    return res.status(200).json({ status: "up-to-date", today: dateStr });
  }

  if (await hasRunInFlight(ghToken)) {
    return res.status(200).json({ status: "already-running", today: dateStr, latestDate });
  }

  const ok = await triggerMorningBriefing(ghToken);
  if (ok) {
    await notifyDiscord(
      `⏰ **Morning Briefing 遅延検知(Vercel Cronフェイルセーフ)**\n` +
        `本日(${dateStr})分の配信が確認できなかったため、Vercel側から自動的に再実行をトリガーしました。数分後に配信されるはずです。`
    );
  }
  return res.status(ok ? 200 : 502).json({
    status: ok ? "triggered" : "trigger-failed",
    today: dateStr,
    latestDate,
  });
}
