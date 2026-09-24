'use client';

import { useMemo, useState } from 'react';

const members = [
  { name: 'パパ', icon: '👨', color: '#4f8df7' },
  { name: 'ママ', icon: '👩', color: '#ff7f9f' },
  { name: '長男', icon: '👦', color: '#55bd83' },
  { name: '長女', icon: '👧', color: '#b26ee5' },
  { name: '次男', icon: '🧒', color: '#f2b84b' },
];

const events = [
  ['08:00','🏫','学校','長男・長女・次男','#55bd83'],
  ['08:30','💻','仕事','パパ','#4f8df7'],
  ['10:00','💻','仕事','ママ','#ff7f9f'],
  ['16:30','🥋','剣道','長男','#b26ee5'],
  ['17:00','🎵','習い事','長女','#ff7f9f'],
  ['19:00','🍴','夕食','家族','#f29b38'],
  ['21:00','🏠','明日の準備','家族','#64748b'],
];

const todos = ['英語プリント提出（長男）','漢字ドリル（長女）','音読（次男）','剣道の防具準備（長男）','明日の持ち物チェック'];

export default function FamilyCalendarSample() {
  const [tab,setTab] = useState<'home'|'calendar'|'todo'|'record'>('home');
  const [done,setDone] = useState<boolean[]>(todos.map(()=>false));
  const completed = useMemo(()=>done.filter(Boolean).length,[done]);

  return <main style={{minHeight:'100vh',background:'#f5f8fc',color:'#183153',fontFamily:'system-ui, sans-serif',paddingBottom:90}}>
    <div style={{maxWidth:520,margin:'0 auto',padding:'20px 16px'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div><div style={{fontSize:13,color:'#718096'}}>Family Calendar · SAMPLE</div><h1 style={{margin:'3px 0',fontSize:25}}>わが家カレンダー</h1></div>
        <div style={{fontSize:28}}>☀️</div>
      </header>

      <div style={{display:'flex',gap:12,justifyContent:'space-between',marginBottom:18}}>
        {members.map(m=><div key={m.name} style={{textAlign:'center',fontSize:12}}><div style={{width:48,height:48,borderRadius:'50%',background:m.color+'22',display:'grid',placeItems:'center',fontSize:27,border:'2px solid '+m.color}}>{m.icon}</div>{m.name}</div>)}
      </div>

      {tab==='home' && <>
        <section style={card}><h2 style={h2}>9月24日（木） <span style={{fontSize:14,fontWeight:500}}>晴れ 28℃</span></h2>
          {events.map(e=><div key={e[0]} style={{display:'grid',gridTemplateColumns:'54px 34px 1fr',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #edf2f7'}}>
            <b>{e[0]}</b><span style={{fontSize:22}}>{e[1]}</span><div><b>{e[2]}</b><div style={{fontSize:12,color:e[4]}}>{e[3]}</div></div>
          </div>)}
        </section>
        <section style={card}><h2 style={h2}>今日のやること <span style={{fontSize:13,color:'#718096'}}>{completed}/{todos.length} 完了</span></h2>
          {todos.map((t,i)=><label key={t} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid #edf2f7',alignItems:'center'}}>
            <input type="checkbox" checked={done[i]} onChange={()=>setDone(d=>d.map((v,j)=>j===i?!v:v))}/><span style={{textDecoration:done[i]?'line-through':'none'}}>{t}</span>
          </label>)}
        </section>
      </>}

      {tab==='calendar' && <section style={card}><h2 style={h2}>2026年9月</h2><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,textAlign:'center'}}>
        {['月','火','水','木','金','土','日'].map(x=><b key={x} style={{fontSize:12}}>{x}</b>)}
        {Array.from({length:35},(_,i)=>i<1?'':i).map((d,i)=><div key={i} style={{minHeight:58,borderRadius:9,padding:5,background:d===24?'#e6f0ff':'#f8fafc',border:d===24?'2px solid #3987f6':'1px solid #edf2f7',fontSize:12}}>{d}{d===24&&<><div style={pill}>仕事</div><div style={{...pill,background:'#efe2ff'}}>剣道</div></>}</div>)}
      </div></section>}

      {tab==='todo' && <section style={card}><h2 style={h2}>家族ToDo</h2>{todos.map((t,i)=><label key={t} style={{display:'flex',gap:12,padding:14,borderBottom:'1px solid #edf2f7'}}><input type="checkbox" checked={done[i]} onChange={()=>setDone(d=>d.map((v,j)=>j===i?!v:v))}/>{t}</label>)}</section>}

      {tab==='record' && <section style={card}><h2 style={h2}>今週の記録</h2>
        <p>📚 勉強　12.5時間</p><Progress value={72}/><p>🏃 運動　9回</p><Progress value={64}/><p>✅ 宿題完了率　85%</p><Progress value={85}/>
        <p style={{fontSize:13,color:'#718096',marginTop:22}}>次段階でGoogleカレンダー同期・Alexa連携・家族別記録を接続します。</p>
      </section>}
    </div>
    <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'white',borderTop:'1px solid #dfe7f1',display:'flex',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:520,display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
        {[['home','🏠','ホーム'],['calendar','📅','カレンダー'],['todo','☑️','ToDo'],['record','📊','記録']].map(([id,ic,label])=><button key={id} onClick={()=>setTab(id as any)} style={{border:0,background:'white',padding:'11px 3px',color:tab===id?'#2878e8':'#64748b',fontWeight:tab===id?700:500,fontSize:12}}><div style={{fontSize:21}}>{ic}</div>{label}</button>)}
      </div>
    </nav>
  </main>
}
function Progress({value}:{value:number}){return <div style={{height:10,background:'#e8eef6',borderRadius:9,overflow:'hidden'}}><div style={{width:value+'%',height:'100%',background:'#3987f6'}}/></div>}
const card: React.CSSProperties={background:'white',borderRadius:18,padding:18,marginBottom:16,boxShadow:'0 6px 20px rgba(20,50,90,.07)'};
const h2: React.CSSProperties={fontSize:19,margin:'0 0 12px'};
const pill: React.CSSProperties={background:'#dbeafe',borderRadius:4,fontSize:9,padding:'2px',marginTop:3};
