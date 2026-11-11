import Head from "next/head";

const cards = [
  { icon:"🌅", title:"KabuBocchi 朝刊", time:"毎日 06:00", tag:"投資", text:"米国市場・日本株への波及・警戒度・注目材料を朝に集約", href:"/" },
  { icon:"💹", title:"毎朝マーケット完全版", time:"毎日 06:30", tag:"投資", text:"指数・イベント・上昇候補・安定成長候補をまとめて確認", href:"/" },
  { icon:"💰", title:"1億円進捗確認", time:"毎月1日 09:00", tag:"資産", text:"1億円目標への進捗、目標との差、翌月アクションを確認", href:"#asset" },
  { icon:"📊", title:"日本株 引け後調査", time:"平日 15:30", tag:"投資", text:"大引け後の市場、決算、出来高、翌営業日の候補を整理", href:"/" },
  { icon:"🧳", title:"週末おでかけ＆英検3級", time:"毎週日曜 08:00", tag:"家族", text:"大田区から行きやすい週末案と英検学習を両立", href:"#family" },
];

export default function Dashboard(){
 return <><Head><title>My Dashboard | KabuBocchi</title><meta name="viewport" content="width=device-width, initial-scale=1"/></Head>
 <main className="wrap">
  <header><a href="/" className="brand">KabuBocchi</a><span className="pill">MY DASHBOARD</span></header>
  <section className="hero"><p className="eyebrow">TODAY</p><h1>今日やることを、ここだけで。</h1><p>投資・資産・家族・副業の自動まとめを1画面に集約するテスト版です。</p></section>
  <nav>{["今日","投資","資産","家族","副業","履歴"].map((x,i)=><a key={x} href={i===0?"#today":i===2?"#asset":i===3?"#family":"#today"}>{x}</a>)}</nav>
  <section id="today"><div className="sectionHead"><h2>今日のまとめ</h2><span>自動更新コンテンツ</span></div>
   <div className="grid">{cards.map(c=><a className="card" href={c.href} key={c.title}><div className="top"><span className="icon">{c.icon}</span><span className="tag">{c.tag}</span></div><h3>{c.title}</h3><p>{c.text}</p><div className="time">{c.time}<b>詳細を見る →</b></div></a>)}</div>
  </section>
  <section className="two"><div id="asset" className="panel"><span>💰 ASSET</span><h2>1億円ロードマップ</h2><div className="progress"><i/></div><p>月次レポートをここに蓄積し、資産推移を見える化する予定です。</p></div>
  <div id="family" className="panel"><span>🏠 FAMILY</span><h2>家族・学習・週末</h2><p>英検、学校予定、週末のおでかけ候補をまとめる入口です。</p></div></section>
  <footer>Dashboard test · KabuBocchi</footer>
 </main>
 <style jsx>{`
 *{box-sizing:border-box} body{margin:0} .wrap{min-height:100vh;background:#071014;color:#e9f1f3;font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif;padding:0 5vw 50px}
 header{height:72px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #1c292e}.brand{font-size:22px;font-weight:800;letter-spacing:2px;color:white;text-decoration:none}.pill,.tag{font-size:11px;border:1px solid #274047;border-radius:999px;padding:5px 9px;color:#8cebd5}.hero{padding:54px 0 30px}.eyebrow{color:#18e2b5;font-weight:800;letter-spacing:3px}.hero h1{font-size:clamp(30px,5vw,54px);margin:8px 0}.hero>p:last-child{color:#91a5ab} nav{display:flex;gap:8px;overflow:auto;padding:12px 0 28px}nav a{white-space:nowrap;color:#b7c5c9;text-decoration:none;background:#0e191d;border:1px solid #1c2b30;padding:10px 18px;border-radius:12px}nav a:first-child{color:#071014;background:#18e2b5;font-weight:700}.sectionHead{display:flex;justify-content:space-between;align-items:end}.sectionHead span{color:#71878d;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.card,.panel{background:#0e171b;border:1px solid #1b2a2f;border-radius:18px;padding:20px}.card{text-decoration:none;color:inherit;transition:.2s}.card:hover{transform:translateY(-2px);border-color:#18e2b5}.top,.time{display:flex;justify-content:space-between;align-items:center}.icon{font-size:25px}.card h3{margin:18px 0 8px}.card p,.panel p{color:#8fa3a9;line-height:1.7;font-size:14px;min-height:48px}.time{font-size:12px;color:#71878d;margin-top:20px}.time b{color:#18e2b5}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:24px}.panel>span{font-size:12px;color:#18e2b5}.progress{height:10px;background:#1a282d;border-radius:20px;overflow:hidden}.progress i{display:block;width:45%;height:100%;background:#18e2b5}footer{text-align:center;color:#53666c;padding-top:45px;font-size:12px}@media(max-width:700px){.two{grid-template-columns:1fr}.wrap{padding-left:18px;padding-right:18px}.hero{padding-top:35px}}
 `}</style></>
}