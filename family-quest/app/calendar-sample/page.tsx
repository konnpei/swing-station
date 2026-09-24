'use client';
import { useMemo, useState } from 'react';

type Item={time:string;icon:string;title:string;who:string;color:string};
const members=[['パパ','👨','#4f8df7'],['ママ','👩','#ff7f9f'],['長男','👦','#55bd83'],['長女','👧','#b26ee5'],['次男','🧒','#f2b84b']];
const initial:Item[]=[
{time:'08:00',icon:'🏫',title:'学校',who:'長男・長女・次男',color:'#55bd83'},
{time:'08:30',icon:'💻',title:'仕事',who:'パパ',color:'#4f8df7'},
{time:'16:30',icon:'🥋',title:'剣道',who:'長男',color:'#b26ee5'},
{time:'19:00',icon:'🍴',title:'夕食',who:'家族',color:'#f29b38'}];
const seedTodos=['英語プリント提出（長男）','漢字ドリル（長女）','音読（次男）','剣道の防具準備（長男）'];

export default function FamilyCalendarSample(){
 const [tab,setTab]=useState('home'); const [events,setEvents]=useState<Item[]>(initial);
 const [todos,setTodos]=useState(seedTodos); const [done,setDone]=useState<boolean[]>(seedTodos.map(()=>false));
 const [open,setOpen]=useState(false); const [kind,setKind]=useState<'予定'|'ToDo'>('予定');
 const [title,setTitle]=useState(''); const [who,setWho]=useState('家族'); const [time,setTime]=useState('18:00');
 const completed=useMemo(()=>done.filter(Boolean).length,[done]);
 function add(){if(!title.trim())return;if(kind==='予定')setEvents(v=>[...v,{time,icon:'📌',title,who,color:'#3987f6'}].sort((a,b)=>a.time.localeCompare(b.time)));else{setTodos(v=>[...v,title]);setDone(v=>[...v,false])}setTitle('');setOpen(false)}
 return <main style={{minHeight:'100vh',background:'#f5f8fc',color:'#183153',fontFamily:'system-ui,sans-serif',paddingBottom:92}}>
 <div style={{maxWidth:520,margin:'auto',padding:'18px 15px'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><small style={{color:'#718096'}}>Family Calendar · SAMPLE</small><h1 style={{margin:'4px 0 16px'}}>わが家カレンダー</h1></div><button onClick={()=>setOpen(true)} style={addBtn}>＋</button></header>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>{members.map(m=><div key={m[0]} style={{textAlign:'center',fontSize:11}}><div style={{width:46,height:46,borderRadius:99,border:'2px solid '+m[2],background:m[2]+'22',display:'grid',placeItems:'center',fontSize:25}}>{m[1]}</div>{m[0]}</div>)}</div>
  {tab==='home'&&<><section style={card}><h2 style={h2}>今日 9/24（木） ☀️</h2>{events.map((e,i)=><div key={i} style={row}><b>{e.time}</b><span style={{fontSize:22}}>{e.icon}</span><div><b>{e.title}</b><small style={{display:'block',color:e.color}}>{e.who}</small></div></div>)}</section>
  <section style={card}><h2 style={h2}>今日のミッション <small>{completed}/{todos.length}</small></h2>{todos.map((t,i)=><label key={i} style={row}><input type="checkbox" checked={done[i]} onChange={()=>setDone(d=>d.map((x,j)=>j===i?!x:x))}/><span style={{gridColumn:'2/4',textDecoration:done[i]?'line-through':'none'}}>{t}</span></label>)}</section>
  <section style={card}><h2 style={h2}>🏆 Family Quest</h2><div style={{fontSize:34,fontWeight:800}}>1,280 <small style={{fontSize:13}}>pt</small></div><p>🔥 連続達成 6日　⭐ 今週 +240pt</p><Progress value={68}/><small>次の家族ごほうびまで 320pt</small></section></>}
  {tab==='calendar'&&<section style={card}><h2 style={h2}>2026年9月</h2><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>{['月','火','水','木','金','土','日'].map(x=><b key={x} style={{textAlign:'center',fontSize:11}}>{x}</b>)}{Array.from({length:35},(_,i)=>i?i:'').map((d,i)=><div key={i} style={{height:57,padding:4,borderRadius:8,border:d===24?'2px solid #3987f6':'1px solid #edf2f7',background:d===24?'#eaf2ff':'white',fontSize:11}}>{d}{d===24&&<><div style={pill}>仕事</div><div style={{...pill,background:'#efe2ff'}}>剣道</div></>}</div>)}</div></section>}
  {tab==='todo'&&<section style={card}><h2 style={h2}>家族ToDo</h2>{todos.map((t,i)=><label key={i} style={{display:'flex',gap:12,padding:'13px 0',borderBottom:'1px solid #edf2f7'}}><input type="checkbox" checked={done[i]} onChange={()=>setDone(d=>d.map((x,j)=>j===i?!x:x))}/>{t}</label>)}</section>}
  {tab==='record'&&<section style={card}><h2 style={h2}>今週の成長</h2><p>📚 勉強 12.5時間</p><Progress value={72}/><p>🥋 運動 9回</p><Progress value={64}/><p>✅ ミッション達成率 85%</p><Progress value={85}/><h3>家族ランキング</h3><p>🥇 長男 420pt　🥈 長女 360pt　🥉 次男 310pt</p></section>}
 </div>
 {open&&<div style={shade}><div style={{...card,width:'min(88vw,420px)',margin:0}}><h2>＋ 追記する</h2><div style={{display:'flex',gap:8}}>{['予定','ToDo'].map(x=><button key={x} onClick={()=>setKind(x as any)} style={{...chip,background:kind===x?'#2878e8':'#edf2f7',color:kind===x?'white':'#183153'}}>{x}</button>)}</div><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==='予定'?'例：歯医者、剣道、学校行事':'例：プリント提出'} style={input}/>{kind==='予定'&&<><select value={who} onChange={e=>setWho(e.target.value)} style={input}>{[...members.map(m=>m[0]),'家族'].map(x=><option key={x}>{x}</option>)}</select><input type="time" value={time} onChange={e=>setTime(e.target.value)} style={input}/></>}<button onClick={add} style={{...addBtn,width:'100%',borderRadius:12}}>追加</button><button onClick={()=>setOpen(false)} style={{...chip,width:'100%',marginTop:8}}>キャンセル</button><p style={{fontSize:11,color:'#718096'}}>※現在は画面内サンプルへの追記です。再読み込みすると戻ります。Googleカレンダー保存は次段階で接続します。</p></div></div>}
 <nav style={nav}>{[['home','🏠','ホーム'],['calendar','📅','カレンダー'],['todo','☑️','ToDo'],['record','📊','記録']].map(x=><button key={x[0]} onClick={()=>setTab(x[0])} style={{border:0,background:'white',padding:9,color:tab===x[0]?'#2878e8':'#64748b',fontWeight:tab===x[0]?800:500}}><div style={{fontSize:20}}>{x[1]}</div><small>{x[2]}</small></button>)}</nav>
 </main>}
function Progress({value}:{value:number}){return <div style={{height:10,background:'#e8eef6',borderRadius:9,overflow:'hidden',marginBottom:8}}><div style={{width:value+'%',height:'100%',background:'#3987f6'}}/></div>}
const card:React.CSSProperties={background:'white',borderRadius:18,padding:17,marginBottom:15,boxShadow:'0 6px 20px rgba(20,50,90,.07)'};
const h2:React.CSSProperties={fontSize:18,margin:'0 0 10px'};
const row:React.CSSProperties={display:'grid',gridTemplateColumns:'55px 34px 1fr',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #edf2f7'};
const pill:React.CSSProperties={background:'#dbeafe',borderRadius:4,fontSize:8,padding:2,marginTop:2};
const addBtn:React.CSSProperties={border:0,background:'#2878e8',color:'white',width:45,height:45,borderRadius:99,fontSize:25,fontWeight:700};
const chip:React.CSSProperties={border:0,borderRadius:9,padding:'9px 14px',fontWeight:700};
const input:React.CSSProperties={width:'100%',boxSizing:'border-box',margin:'12px 0 0',padding:13,border:'1px solid #dbe4ee',borderRadius:10,fontSize:16};
const shade:React.CSSProperties={position:'fixed',inset:0,background:'rgba(15,23,42,.45)',display:'grid',placeItems:'center',zIndex:20};
const nav:React.CSSProperties={position:'fixed',bottom:0,left:0,right:0,background:'white',borderTop:'1px solid #dfe7f1',display:'grid',gridTemplateColumns:'repeat(4,1fr)',maxWidth:520,margin:'auto',zIndex:10};
