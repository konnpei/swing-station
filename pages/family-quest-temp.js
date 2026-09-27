import { useEffect, useState } from 'react';
import Head from 'next/head';

const people=['全員','パパ','ママ','長男','長女','次男'];
const themes={全員:['#d59b16','#fff8df'],パパ:['#2878e8','#eaf3ff'],ママ:['#e36b9d','#fff0f6'],長男:['#2e9b66','#eaf8f0'],長女:['#8b5fd3','#f3edff'],次男:['#e88932','#fff2e5']};

export default function FamilyQuestTemp(){
 const [tab,setTab]=useState('home'),[filter,setFilter]=useState('全員'),[shop,setShop]=useState([]),[text,setText]=useState('');
 useEffect(()=>{try{setShop(JSON.parse(localStorage.getItem('fq-shop-temp'))||[{text:'牛乳',who:'全員',done:false},{text:'卵',who:'全員',done:false}])}catch{setShop([])}},[]);
 useEffect(()=>{if(shop.length)localStorage.setItem('fq-shop-temp',JSON.stringify(shop))},[shop]);
 const add=()=>{if(!text.trim())return;setShop(v=>[...v,{text:text.trim(),who:filter,done:false}]);setText('')};
 const [accent,soft]=themes[filter]||themes['全員'];
 return <main style={{minHeight:'100vh',background:soft,color:'#183153',fontFamily:'system-ui,sans-serif',paddingBottom:85}}>
  <Head><title>わが家クエスト</title></Head>
  <div style={{maxWidth:520,margin:'auto',padding:'18px 14px'}}>
   <header><small>FAMILY OS · 臨時版</small><h1 style={{margin:'3px 0'}}>わが家クエスト</h1><p style={{color:'#64748b',marginTop:4}}>予定・宿題・買い物・成長をひとつに</p></header>
   <div style={{display:'flex',gap:7,overflowX:'auto',padding:'8px 0 14px'}}>{people.map(p=><button key={p} onClick={()=>setFilter(p)} style={{border:0,borderRadius:99,padding:'9px 12px',fontWeight:700,whiteSpace:'nowrap',background:filter===p?(themes[p]||themes['全員'])[0]:'white',color:filter===p?'white':(themes[p]||themes['全員'])[0]}}>{p}</button>)}</div>
   {tab==='home'&&<section style={card}><h2>☀️ 今日の作戦</h2><p>📅 家族の予定は本来版でGoogleカレンダー連携予定です。</p><h2>🛒 買い物</h2>{shop.filter(x=>!x.done).slice(0,4).map((x,i)=><p key={i}>⬜️ {x.text} <small>({x.who})</small></p>)}</section>}
   {tab==='calendar'&&<section style={card}><h2>📅 予定</h2><p>Google「家族共有」との同期機能は本来版へ統合します。</p></section>}
   {tab==='todo'&&<section style={card}><h2>🎯 ミッション</h2><p>英語プリント提出</p><p>漢字ドリル</p><p>剣道の防具準備</p></section>}
   {tab==='shop'&&<section style={card}><h2>🛒 家族の買い物リスト</h2><div style={{display:'flex',gap:8}}><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="例：牛乳・ティッシュ" style={{flex:1,padding:13,border:'1px solid #dbe4ee',borderRadius:11,fontSize:16}}/><button onClick={add} style={{border:0,borderRadius:12,width:48,background:accent,color:'white',fontSize:24}}>＋</button></div>{shop.map((x,i)=><div key={i} onClick={()=>setShop(v=>v.map((a,j)=>j===i?{...a,done:!a.done}:a))} style={{display:'flex',gap:10,alignItems:'center',padding:'13px 0',borderBottom:'1px solid #edf2f7',opacity:x.done?0.55:1}}><span>{x.done?'✅':'⬜️'}</span><div style={{flex:1,textDecoration:x.done?'line-through':'none'}}><b>{x.text}</b><small style={{display:'block'}}>{x.who}</small></div><button onClick={e=>{e.stopPropagation();setShop(v=>v.filter((_,j)=>j!==i))}} style={{border:0,background:'transparent',fontSize:20}}>×</button></div>)}</section>}
   {tab==='record'&&<section style={card}><h2>📊 成長</h2><p>家族の学習・運動・ミッション記録をここにまとめます。</p></section>}
  </div>
  <nav style={{position:'fixed',bottom:0,left:0,right:0,maxWidth:520,margin:'auto',display:'grid',gridTemplateColumns:'repeat(5,1fr)',background:'white',borderTop:'1px solid #dfe7f1'}}>{[['home','🏠','ホーム'],['calendar','📅','予定'],['todo','🎯','ミッション'],['shop','🛒','買い物'],['record','📊','成長']].map(x=><button key={x[0]} onClick={()=>setTab(x[0])} style={{border:0,background:'white',padding:9,color:tab===x[0]?accent:'#64748b',fontWeight:700}}><div style={{fontSize:20}}>{x[1]}</div><small>{x[2]}</small></button>)}</nav>
 </main>
}
const card={background:'white',borderRadius:20,padding:17,marginBottom:14,boxShadow:'0 7px 24px rgba(20,50,90,.07)'};
