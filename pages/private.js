import { useState } from "react";
import Head from "next/head";
import { validSession, sessionCookie } from "../lib/privateAuth";
export async function getServerSideProps({ req, res }) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  return { props: { authenticated: validSession(req.cookies?.[sessionCookie]) } };
}
export default function PrivatePage({ authenticated }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  async function login(event) {
    event.preventDefault(); setLoading(true); setStatus("");
    try {
      const response = await fetch("/api/private/request-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      setStatus(data.message || data.error || "送信できませんでした");
    } catch { setStatus("通信エラーが発生しました"); }
    setLoading(false);
  }
  return <main style={{ background: "#0c1425", color: "#fff", minHeight: "100vh", padding: "48px 20px", fontFamily: "sans-serif" }}>
    <Head><title>KabuBocchi | Private</title><meta name="robots" content="noindex,nofollow,noarchive" /></Head>
    <div style={{ maxWidth: 760, margin: "auto" }}>
      <a href="/" style={{ color: "#8db9ff" }}>← 公開ダッシュボード</a>
      <h1>🔐 KabuBocchi PRIVATE</h1>
      {authenticated ? <>
        <p>本人確認済み。ここは非公開の投資管理画面です。</p>
        <section style={{ border: "1px solid #43536d", padding: 24, borderRadius: 12 }}>
          <h2>個人用ダッシュボード</h2>
          <p>保有銘柄・損益・売買条件・個人ウォッチリストは、今後ここに安全なデータソースを接続します。</p>
          <p>現在、個人の証券口座データは取り込んでいません。</p>
        </section>
        <form action="/api/private/logout" method="post" style={{ marginTop: 24 }}><button type="submit">ログアウト</button></form>
      </> : <>
        <p>登録済みメールアドレスに10分間有効なログインリンクを送ります。</p>
        <form onSubmit={login}>
          <label htmlFor="email">メールアドレス</label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1, padding: 12, minWidth: 0 }} />
            <button disabled={loading} type="submit">{loading ? "送信中" : "送信"}</button>
          </div>
        </form>
        <p role="status">{status}</p>
      </>}
    </div>
  </main>;
}
