import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const fmt = (n) => `R ${Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const MONTHS = ['Nov-24','Dec-24','Jan-25','Feb-25','Mar-25','Apr-25','May-25','Jun-25','Jul-25','Aug-25','Sept-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26','Aug-26','Sept-26','Oct-26','Nov-26','Dec-26','Jan-27','Feb-27','Mar-27','Apr-27','May-27','Jun-27']
const getP2Month = (p1) => { const i = MONTHS.indexOf(p1); return i !== -1 && MONTHS[i+6] ? MONTHS[i+6] : '' }
const COMPANY_COLORS = { xactco: '#6366f1', bloodhound: '#ef4444' }
const LUKE_ID = 'f3b67113-e524-403e-9191-f3b0621e46a3'
const BERNARD_ID = 'bc508a11-e937-46a6-acc2-fd7c8e575767'
const ROMAINE_ID = '294f7939-a6c5-40ce-ad6e-1631f243ecd5'
const APPROVERS = [
  { id: LUKE_ID,    name: 'Luke',    key: 'approved_luke'    },
  { id: BERNARD_ID, name: 'Bernard', key: 'approved_bernard' },
  { id: ROMAINE_ID, name: 'Romaine', key: 'approved_romaine' },
]
const getReferralBonus = (mrr) => Math.round(mrr * 0.25)
const calcBHTotalLic = (d) => (d.patrol_qty||0)*(d.patrol_rate||0)+(d.inspect_qty||0)*(d.inspect_rate||0)+(d.vm_qty||0)*(d.vm_rate||0)+(d.ilog_qty||0)*(d.ilog_rate||0)
const calcBHComm = (total, type) => type === 'upsell' ? Math.round(total*12*0.04) : Math.round(total*12*0.08)
const isExistingClient = (inception, month) => {
  if (!inception || !month) return false
  const ii = MONTHS.indexOf(inception), di = MONTHS.indexOf(month)
  return ii !== -1 && di !== -1 && (di - ii) >= 12
}
const calcCancelledComm = (deal, company) => {
  const m = parseInt(deal.active_months)||0; if (!m) return 0
  return company === 'bloodhound' ? Math.round(calcBHTotalLic(deal)*m*0.08) : Math.round((deal.total||0)*m*0.08)
}

const BLANK_X = { month:'Jan-26', client:'', once_off:0, app_users:0, lite_users:0, a_user_cost:950, l_user_cost:0, admin:1, free_admin:0, admin_cost:1000, dashboards:0, dash_cost:0, billing_date:'', p1_date:'', notes:'', first_payment_received:'TBC', inception_date:'', quote_no:'' }
const BLANK_BH = { month:'Jan-26', client:'', patrol_qty:0, patrol_rate:0, inspect_qty:0, inspect_rate:0, vm_qty:0, vm_rate:0, ilog_qty:0, ilog_rate:0, invoice_total:0, quote_no:'', inception_date:'', p1_date:'', billing_date:'', notes:'', first_payment_received:'TBC', deal_type:'new' }
const BLANK_REF = { referred_by:'', client:'', mrr:0, date:'', paid:false }

const exportToExcel = async (deals, referrals, name, isLukeView, company) => {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
  const N = (n) => Number(n||0)
  const isBH = company === 'bloodhound'
  const ph = isBH ? ['Client','Month','Deal Type','Monthly Deal','ARR','Total Comm','Payout 1','Payout 2','Comm Pay Date','Status','Client 1st Payment','Quote No','Inception','Cancelled','Notes']
    : ['Client','Monthly Deal','ARR','Commission','Payout 1','P1 Date','P1 Status','1st Payment',...(!isLukeView?['Payout 2','P2 Date','P2 Status']:[]),'Cancelled']
  const pr = deals.map(d => isBH ? [d.client, d.month, d.deal_type==='upsell'?'Existing 4%':'New 8%', N(calcBHTotalLic(d)), N(d.arr), N(d.comm), N(d.p1), N(d.p2||0), d.p1_date||'', d.p1_paid?'PAID':'PENDING', d.first_payment_received||'TBC', d.quote_no||'', d.inception_date||'', d.cancelled?'Yes':'No', d.notes||'']
    : [d.client, N(d.total), N(d.arr), N(d.comm), N(d.p1), d.p1_date||'', d.p1_paid?'PAID':'PENDING', d.first_payment_received||'TBC', ...(!isLukeView?[N(d.p2), d.p2_date||'', d.p2_paid?'PAID':'PENDING']:[]), d.cancelled?'Yes':'No'])
  const rh = ['Referred By','Client','Monthly Fee','25% Bonus','Date','Status']
  const rr = referrals.map(r => [r.referred_by, r.client, N(r.mrr), N(r.bonus), r.date||'', r.paid?'PAID':'PENDING'])
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.aoa_to_sheet([ph,...pr]); ws1['!cols'] = ph.map(h=>({wch:Math.max(h.length+2,12)}))
  XLSX.utils.book_append_sheet(wb, ws1, 'Payout Summary')
  const ws2 = XLSX.utils.aoa_to_sheet([rh,...rr]); ws2['!cols'] = rh.map(h=>({wch:Math.max(h.length+2,14)}))
  XLSX.utils.book_append_sheet(wb, ws2, 'Referrals')
  XLSX.writeFile(wb, `${name}_Commission_${new Date().toLocaleDateString('en-ZA').replace(/\//g,'-')}.xlsx`)
}

const Badge = ({ paid, voided }) => {
  if (voided) return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>VOIDED</span>
  return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:paid?'#d1fae5':'#fef3c7', color:paid?'#065f46':'#92400e' }}>{paid?'PAID':'PENDING'}</span>
}
const PBadge = ({ val }) => {
  const c = { Yes:['#d1fae5','#065f46'], No:['#fee2e2','#991b1b'], TBC:['#fef3c7','#92400e'] }
  const [bg,col] = c[val]||c.TBC
  return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:bg, color:col }}>{val||'TBC'}</span>
}

const CancelCell = ({ deal, isAdmin, onUpdate }) => {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(deal.cancellation_date||'')
  const [months, setMonths] = useState(deal.active_months||'')
  if (deal.cancelled) return (
    <div>
      <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>Cancelled</span>
      <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{deal.cancellation_date} · {deal.active_months}m</div>
      <div style={{ fontSize:10, color:'#ef4444', fontWeight:700 }}>Revised: {fmt(deal.recalculated_comm)}</div>
      {isAdmin && <button onClick={()=>onUpdate(deal.id,false,'',0)} style={{ marginTop:4, padding:'2px 8px', fontSize:10, borderRadius:6, border:'none', cursor:'pointer', background:'#e2e8f0', color:'#475569' }}>↩ Undo</button>}
    </div>
  )
  if (!isAdmin) return <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>
  if (open) return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:150 }}>
      <select value={date} onChange={e=>setDate(e.target.value)} style={{ padding:'3px 6px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:11 }}>
        <option value=''>— select month —</option>
        {MONTHS.map(m=><option key={m}>{m}</option>)}
      </select>
      <input type="number" placeholder="Active months" value={months} onChange={e=>setMonths(e.target.value)} style={{ padding:'3px 6px', borderRadius:5, border:'1px solid #cbd5e1', fontSize:11 }} />
      <div style={{ display:'flex', gap:4 }}>
        <button onClick={()=>{onUpdate(deal.id,true,date,parseInt(months)||0);setOpen(false)}} style={{ padding:'3px 8px', fontSize:11, borderRadius:5, border:'none', cursor:'pointer', background:'#ef4444', color:'#fff', fontWeight:700 }}>Save</button>
        <button onClick={()=>setOpen(false)} style={{ padding:'3px 8px', fontSize:11, borderRadius:5, border:'none', cursor:'pointer', background:'#e2e8f0', color:'#475569' }}>✕</button>
      </div>
    </div>
  )
  return <button onClick={()=>setOpen(true)} style={{ padding:'4px 10px', fontSize:11, borderRadius:6, border:'none', cursor:'pointer', fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>Mark Cancelled</button>
}

function Login() {
  const [email,setEmail]=useState('');const [pw,setPw]=useState('');const [err,setErr]=useState('');const [load,setLoad]=useState(false)
  const go = async () => { setLoad(true);setErr('');const{error}=await supabase.auth.signInWithPassword({email,password:pw});if(error)setErr(error.message);setLoad(false) }
  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:'#fff',borderRadius:16,padding:40,width:360,boxShadow:'0 4px 24px #0001' }}>
        <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:800,color:'#1e293b' }}>💼 Commission Tracker</h1>
        <p style={{ margin:'0 0 28px',color:'#64748b',fontSize:13 }}>Sign in to your account</p>
        <div style={{ marginBottom:14 }}><div style={{ fontSize:12,fontWeight:600,color:'#475569',marginBottom:4 }}>Email</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,boxSizing:'border-box' }} /></div>
        <div style={{ marginBottom:20 }}><div style={{ fontSize:12,fontWeight:600,color:'#475569',marginBottom:4 }}>Password</div><input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} style={{ width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,boxSizing:'border-box' }} /></div>
        {err&&<div style={{ color:'#ef4444',fontSize:13,marginBottom:14 }}>{err}</div>}
        <button onClick={go} disabled={load} style={{ width:'100%',padding:'11px',background:'#6366f1',color:'#fff',border:'none',borderRadius:8,fontWeight:700,fontSize:15,cursor:'pointer' }}>{load?'Signing in...':'Sign In'}</button>
      </div>
    </div>
  )
}

export default function App() {
  const [session,setSess]=useState(null);const [profile,setProf]=useState(null);const [deals,setDeals]=useState([]);const [profiles,setProfiles]=useState([]);const [refs,setRefs]=useState([]);const [company,setCo]=useState('xactco');const [selSP,setSelSP]=useState(null);const [tab,setTab]=useState('summary');const [showAdd,setShowAdd]=useState(false);const [showAddRef,setShowAddRef]=useState(false);const [newDeal,setNewDeal]=useState(BLANK_X);const [newRef,setNewRef]=useState(BLANK_REF);const [editDate,setEditDate]=useState(null);const [editDeal,setEditDeal]=useState(null);const [loading,setLoading]=useState(true)
  const isBH = company==='bloodhound'

  useEffect(()=>{ supabase.auth.getSession().then(({data:{session}})=>setSess(session));supabase.auth.onAuthStateChange((_,s)=>setSess(s)) },[])
  useEffect(()=>{ if(!session){setLoading(false);return};loadProfile() },[session])
  useEffect(()=>{ if(!profile)return;if(isAdmin)loadAllProfiles();else loadDeals(profile.id) },[profile,company])
  useEffect(()=>{ if(selSP)loadDeals(selSP.id) },[selSP])

  const isAdmin = profile?.role==='admin'||profile?.role==='manager'

  const loadProfile = async () => { const{data}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();setProf(data);setLoading(false) }
  const loadAllProfiles = async () => { const{data}=await supabase.from('profiles').select('*').eq('company',company);const sps=(data||[]).filter(p=>p.role==='salesperson'||p.role==='admin');setProfiles(sps);if(sps.length)setSelSP(sps[0]) }
  const loadDeals = async (id) => { const{data}=await supabase.from('deals').select('*').eq('salesperson_id',id).eq('company',company).order('created_at');const s=(data||[]).sort((a,b)=>MONTHS.indexOf(a.p1_date)-MONTHS.indexOf(b.p1_date));setDeals(s);loadRefs(id) }
  const loadRefs = async (id) => { const{data}=await supabase.from('referrals').select('*').eq('salesperson_id',id).eq('company',company).order('created_at');setRefs(data||[]) }

  const toggleP1 = async (d) => { const np=!d.p1_paid;const upd={p1_paid:np,p1_paid_date:np?new Date().toLocaleDateString('en-ZA'):null,p2_date:np?getP2Month(d.p1_date):d.p2_date};await supabase.from('deals').update(upd).eq('id',d.id);setDeals(p=>p.map(x=>x.id===d.id?{...x,...upd}:x)) }
  const toggleP2 = async (d) => { const upd={p2_paid:!d.p2_paid};await supabase.from('deals').update(upd).eq('id',d.id);setDeals(p=>p.map(x=>x.id===d.id?{...x,...upd}:x)) }
  const updDate = async (d,w,v) => { const upd={[w]:v};if(w==='p1_date'&&!d.p2_paid)upd.p2_date=getP2Month(v);await supabase.from('deals').update(upd).eq('id',d.id);setDeals(p=>p.map(x=>x.id===d.id?{...x,...upd}:x));setEditDate(null) }
  const updPay = async (id,v) => { await supabase.from('deals').update({first_payment_received:v}).eq('id',id);setDeals(p=>p.map(d=>d.id===id?{...d,first_payment_received:v}:d)) }
  const toggleAppr = async (id,key,tbl,setter) => { const item=tbl==='deals'?deals.find(d=>d.id===id):refs.find(r=>r.id===id);const upd={[key]:!item[key]};await supabase.from(tbl).update(upd).eq('id',id);setter(p=>p.map(x=>x.id===id?{...x,...upd}:x)) }

  const updDealType = async (id,dt) => {
    const d=deals.find(x=>x.id===id);const lic=calcBHTotalLic(d);const isU=dt==='upsell'
    const comm=calcBHComm(lic,dt);const p1=isU?comm:Math.round(comm/2);const p2=isU?0:Math.round(comm/2)
    const upd={deal_type:dt,arr:lic*12,comm,p1,p2,p2_date:isU?'':getP2Month(d.p1_date),p2_voided:isU}
    await supabase.from('deals').update(upd).eq('id',id);setDeals(p=>p.map(x=>x.id===id?{...x,...upd}:x))
  }

  const updCancel = async (id,cancelled,cancellation_date,active_months) => {
    const d=deals.find(x=>x.id===id)
    const rc=cancelled?calcCancelledComm({...d,active_months},company):0
    const upd={cancelled,cancellation_date,active_months,recalculated_comm:rc,p2_voided:cancelled&&!d.p2_paid}
    await supabase.from('deals').update(upd).eq('id',id);setDeals(p=>p.map(x=>x.id===id?{...x,...upd}:x))
  }

  const addDeal = async () => {
    if(!newDeal.client||!newDeal.p1_date)return
    const spId=isAdmin?selSP?.id:profile.id
    let total,arr,comm,p1,p2,p2_date,deal_type='new'
    if(isBH){
      total=calcBHTotalLic(newDeal)
      deal_type=newDeal.deal_type||(isExistingClient(newDeal.inception_date,newDeal.month)?'upsell':'new')
      const isU=deal_type==='upsell'
      arr=total*12;comm=calcBHComm(total,deal_type);p1=isU?comm:Math.round(comm/2);p2=isU?0:Math.round(comm/2);p2_date=isU?'':getP2Month(newDeal.p1_date)
    } else {
      total=(newDeal.app_users*newDeal.a_user_cost)+(newDeal.lite_users*(newDeal.l_user_cost||0))+Math.max(0,newDeal.admin-newDeal.free_admin)*newDeal.admin_cost+(newDeal.dashboards*newDeal.dash_cost)
      arr=total*12;const iL=spId===LUKE_ID;comm=iL?total:arr*0.08;p1=iL?total:comm/2;p2=iL?0:comm/2;p2_date=iL?'':getP2Month(newDeal.p1_date)
    }
    await supabase.from('deals').insert([{...newDeal,salesperson_id:spId,company,total,arr,comm,p1,p2,p2_date,deal_type,p1_paid:false,p2_paid:false,approved_luke:false,approved_bernard:false,approved_romaine:false,cancelled:false,p2_voided:deal_type==='upsell'}])
    setShowAdd(false);setNewDeal(isBH?BLANK_BH:BLANK_X);loadDeals(spId)
  }

  const delDeal = async (id) => { if(!window.confirm('Delete this deal?'))return;await supabase.from('deals').delete().eq('id',id);setDeals(p=>p.filter(d=>d.id!==id)) }

  const saveEdit = async () => {
    if(!editDeal)return
    let total,arr,comm,p1,p2
    if(isBH){ total=calcBHTotalLic(editDeal);const isU=editDeal.deal_type==='upsell';arr=total*12;comm=calcBHComm(total,editDeal.deal_type);p1=isU?comm:Math.round(comm/2);p2=isU?0:Math.round(comm/2) }
    else { total=(editDeal.app_users*editDeal.a_user_cost)+(editDeal.lite_users*(editDeal.l_user_cost||0))+Math.max(0,editDeal.admin-editDeal.free_admin)*editDeal.admin_cost+(editDeal.dashboards*editDeal.dash_cost);arr=total*12;const iL=editDeal.salesperson_id===LUKE_ID;comm=iL?total:arr*0.08;p1=iL?total:comm/2;p2=iL?0:comm/2 }
    await supabase.from('deals').update({...editDeal,total,arr,comm,p1,p2}).eq('id',editDeal.id)
    setEditDeal(null);loadDeals(selSP?.id||profile.id)
  }

  const addRef = async () => { if(!newRef.referred_by||!newRef.client||!newRef.mrr)return;const bonus=getReferralBonus(newRef.mrr);const spId=isAdmin?selSP?.id:profile.id;await supabase.from('referrals').insert([{...newRef,salesperson_id:spId,company,bonus,paid:false,approved_luke:false,approved_bernard:false,approved_romaine:false}]);setShowAddRef(false);setNewRef(BLANK_REF);loadRefs(spId) }
  const togRefPaid = async (r) => { const upd={paid:!r.paid};await supabase.from('referrals').update(upd).eq('id',r.id);setRefs(p=>p.map(x=>x.id===r.id?{...x,...upd}:x)) }
  const delRef = async (id) => { if(!window.confirm('Delete?'))return;await supabase.from('referrals').delete().eq('id',id);setRefs(p=>p.filter(r=>r.id!==id)) }
  const signOut = () => supabase.auth.signOut()

  if(!session)return <Login />
  if(loading)return <div style={{ padding:40,textAlign:'center',color:'#64748b',fontFamily:"'Segoe UI',sans-serif" }}>Loading...</div>

  const isLukeView=!isBH&&(selSP?.id===LUKE_ID||(!isAdmin&&profile?.id===LUKE_ID))
  const accent=isBH?'#ef4444':(selSP?.color||profile?.color||'#6366f1')
  const dName=isAdmin?selSP?.name:profile?.name
  const commLabel=isLukeView?'Commission':'8% Comm'
  const newBH=deals.filter(d=>(d.deal_type||'new')==='new')
  const upBH=deals.filter(d=>d.deal_type==='upsell')
  const totalComm=deals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
  const totalPaid=deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)

  const css={fontFamily:"'Segoe UI',sans-serif",background:'#f8fafc',minHeight:'100vh',padding:20}
  const card={background:'#fff',borderRadius:12,padding:20,marginBottom:16,boxShadow:'0 1px 4px #0001'}
  const th={padding:'9px 12px',background:'#f1f5f9',fontSize:11,fontWeight:700,color:'#475569',textAlign:'left',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}
  const td={padding:'9px 12px',fontSize:12,color:'#1e293b',borderBottom:'1px solid #f1f5f9',verticalAlign:'middle'}
  const tBtn=(t)=>({padding:'8px 20px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,background:tab===t?accent:'#e2e8f0',color:tab===t?'#fff':'#475569'})
  const aBtn=(c,bg)=>({padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:bg,color:c,whiteSpace:'nowrap'})
  const p2Bg='rgba(99,102,241,0.04)'

  const PaySel = ({ deal }) => (
    isAdmin ? <select value={deal.first_payment_received||'TBC'} onChange={e=>updPay(deal.id,e.target.value)} style={{ padding:'3px 7px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:11,fontWeight:700,cursor:'pointer',background:deal.first_payment_received==='Yes'?'#d1fae5':deal.first_payment_received==='No'?'#fee2e2':'#fef3c7',color:deal.first_payment_received==='Yes'?'#065f46':deal.first_payment_received==='No'?'#991b1b':'#92400e' }}><option>TBC</option><option>Yes</option><option>No</option></select>
    : <PBadge val={deal.first_payment_received} />
  )

  const DateCell = ({ deal,which,disabled }) => {
    const isEd=editDate?.id===deal.id&&editDate?.which===which;const val=deal[which]
    if(disabled)return <span style={{ color:'#94a3b8',fontSize:11 }}>Set when P1 paid</span>
    if(isEd)return(<div style={{ display:'flex',alignItems:'center',gap:4 }}><select autoFocus defaultValue={val} onChange={e=>updDate(deal,which,e.target.value)} style={{ padding:'3px 6px',borderRadius:5,border:`1px solid ${accent}`,fontSize:11 }}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select><button onClick={()=>setEditDate(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'#94a3b8' }}>✕</button></div>)
    const canEd=isAdmin&&!deal[which==='p1_date'?'p1_paid':'p2_paid']
    return(<div style={{ display:'flex',alignItems:'center',gap:4 }}><span>{val||'—'}</span>{canEd&&<button onClick={()=>setEditDate({id:deal.id,which})} style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,color:accent,padding:0 }}>✏️</button>}{which==='p1_date'&&deal.p1_paid&&deal.p1_paid_date&&<span style={{ fontSize:10,color:'#10b981',display:'block' }}>paid {deal.p1_paid_date}</span>}</div>)
  }

  const ApprCell = ({ item,tbl,setter }) => (
    <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
      {APPROVERS.map(a=>{ const ap=item[a.key];const can=profile?.id===a.id;return(<button key={a.id} onClick={can?()=>toggleAppr(item.id,a.key,tbl,setter):undefined} style={{ padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:700,border:'none',cursor:can?'pointer':'default',background:ap?'#d1fae5':'#f1f5f9',color:ap?'#065f46':'#94a3b8' }}>{ap?'✅':'⬜'} {a.name}</button>)})}
    </div>
  )

  const EditModal = () => {
    if(!editDeal)return null
    const fields=isBH?[['Month','month','msel'],['Client','client','text'],['Deal Type','deal_type','dtsel'],['Patrol Qty','patrol_qty','number'],['Patrol Rate','patrol_rate','number'],['Inspect Qty','inspect_qty','number'],['Inspect Rate','inspect_rate','number'],['VM Qty','vm_qty','number'],['VM Rate','vm_rate','number'],['iLog Qty','ilog_qty','number'],['iLog Rate','ilog_rate','number'],['Invoice Total','invoice_total','number'],['Quote No','quote_no','text'],['Inception Date','inception_date','msel'],['P1 Date','p1_date','msel'],['Notes','notes','text']]:
    [['Month','month','msel'],['Client','client','text'],['Once Off','once_off','number'],['App Users','app_users','number'],['Lite Users','lite_users','number'],['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],['Dashboards','dashboards','number'],['Dash Cost','dash_cost','number'],['P1 Date','p1_date','msel'],['Quote No','quote_no','text'],['Inception Date','inception_date','msel'],['Notes','notes','text']]
    return(
      <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0008',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div style={{ background:'#fff',borderRadius:16,padding:28,width:740,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 8px 32px #0003' }}>
          <h3 style={{ margin:'0 0 16px',color:accent,fontSize:15 }}>Edit Deal — {editDeal.client}</h3>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
            {fields.map(([label,key,type])=>(<div key={key}><div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3 }}>{label}</div>
              {type==='msel'?<select value={editDeal[key]||''} onChange={e=>setEditDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}><option value=''>— select —</option>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>
              :type==='dtsel'?<select value={editDeal[key]||'new'} onChange={e=>setEditDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}><option value='new'>New Business (8%)</option><option value='upsell'>Existing Client (4%)</option></select>
              :<input type={type} value={editDeal[key]||''} onChange={e=>setEditDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box' }} />}
            </div>))}
          </div>
          <div style={{ marginTop:16,display:'flex',gap:10 }}><button onClick={saveEdit} style={{ padding:'8px 18px',background:accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Save Changes</button><button onClick={()=>setEditDeal(null)} style={{ padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Cancel</button></div>
        </div>
      </div>
    )
  }

  // ── BH SECTION (New Business or Upsell) ──────────────────────────────────
  const BHSection = ({ sDeals, type }) => {
    if(!sDeals.length)return null
    const isU=type==='upsell'
    const color=isU?'#f59e0b':'#0ea5e9'
    const bgCol=isU?'rgba(245,158,11,0.06)':'rgba(14,165,233,0.06)'
    const bdCol=isU?'rgba(245,158,11,0.25)':'rgba(14,165,233,0.25)'
    const txtCol=isU?'#92400e':'#0369a1'
    const sComm=sDeals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
    const sPaid=sDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(!isU&&d.p2_paid?d.p2:0),0)

    // NEW BUSINESS columns (matches Xactco / Image 1):
    // Client | Month | Monthly Deal | ×12 ARR | 8% Comm | Payout 1 | Comm Pay Date | P1 Status | Client 1st Payment | Finance Action | Payout 2 | P2 Date | P2 Status | Finance Action | Cancellation | Approvals
    //
    // UPSELL columns:
    // Client | Month | Monthly Deal | ×12 ARR | Commission | Payout | Comm Pay Date | P1 Status | Client 1st Payment | Finance Action | Cancellation | Approvals

    const newHdrs=['Client','Month','Monthly Deal','× 12 (ARR)','8% Comm','Payout 1','Comm Pay Date','P1 Status','Client 1st Payment','Finance Action','Payout 2','P2 Date','P2 Status','Finance Action','Cancellation','Approvals']
    const upHdrs=['Client','Month','Monthly Deal','× 12 (ARR)','Commission','Payout','Comm Pay Date','P1 Status','Client 1st Payment','Finance Action','Cancellation','Approvals']
    const hdrs=isU?upHdrs:newHdrs

    return(
      <div style={{ marginBottom:24,borderRadius:10,overflow:'hidden',border:`0.5px solid ${bdCol}`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding:'10px 16px',background:bgCol,borderBottom:`0.5px solid ${bdCol}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:10,height:10,borderRadius:'50%',background:color }}></div>
            <span style={{ color:txtCol,fontSize:14,fontWeight:700 }}>{isU?'Existing Client Upsell':'New Business'}</span>
            <span style={{ fontSize:11,color:'#64748b',fontWeight:400 }}>{isU?'4% of ARR · Once-off · No clawback':'8% of ARR · Split 50/50 · P1 month 2, P2 month 7'}</span>
          </div>
          <div style={{ fontSize:13,color:txtCol,fontWeight:700 }}>Commission: {fmt(sComm)} · Paid: {fmt(sPaid)}</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',background:'#fff' }}>
            <thead>
              <tr>
                {hdrs.map((h,i)=>(
                  <th key={i} style={{ ...th, background: !isU&&i>=10&&i<=13 ? 'rgba(99,102,241,0.07)' : th.background }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sDeals.map(d=>{
                const lic=calcBHTotalLic(d)
                const arr=lic*12
                const comm=d.cancelled?(d.recalculated_comm||0):d.comm
                return(
                  <tr key={d.id} style={{ opacity:d.cancelled?0.75:1,background:d.cancelled?'#fff5f5':'#fff' }}>

                    {/* Client */}
                    <td style={{ ...td,fontWeight:700 }}>
                      {d.client}
                      {d.cancelled&&<span style={{ marginLeft:6,padding:'1px 6px',borderRadius:4,fontSize:10,background:'#fee2e2',color:'#991b1b' }}>Cancelled</span>}
                    </td>

                    {/* Month */}
                    <td style={td}>{d.month}</td>

                    {/* Monthly Deal */}
                    <td style={{ ...td,fontWeight:700,color:'#0ea5e9' }}>{fmt(lic)}</td>

                    {/* × 12 ARR */}
                    <td style={{ ...td,color:'#475569' }}>{fmt(arr)}</td>

                    {/* 8% Comm / Commission */}
                    <td style={{ ...td,color,fontWeight:700 }}>{fmt(comm)}</td>

                    {/* Payout 1 / Payout (upsell) */}
                    <td style={td}>{fmt(d.p1)}</td>

                    {/* Comm Pay Date */}
                    <td style={td}><DateCell deal={d} which='p1_date' disabled={false} /></td>

                    {/* P1 Status */}
                    <td style={td}><Badge paid={d.p1_paid} /></td>

                    {/* Client 1st Payment */}
                    <td style={td}><PaySel deal={d} /></td>

                    {/* Finance Action — P1 */}
                    <td style={td}>
                      {isAdmin&&(
                        <button onClick={()=>toggleP1(d)} style={aBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5')}>
                          {d.p1_paid?'↩ Unpaid':'✓ Mark Paid'}
                        </button>
                      )}
                    </td>

                    {/* NEW BUSINESS ONLY — P2 block */}
                    {!isU&&<>
                      {/* Payout 2 */}
                      <td style={{ ...td,background:p2Bg }}>{fmt(d.p2)}</td>

                      {/* P2 Date */}
                      <td style={{ ...td,background:p2Bg }}>
                        <DateCell deal={d} which='p2_date' disabled={!d.p1_paid} />
                      </td>

                      {/* P2 Status */}
                      <td style={{ ...td,background:p2Bg }}>
                        <Badge paid={d.p2_paid} voided={d.p2_voided} />
                      </td>

                      {/* Finance Action — P2 */}
                      <td style={{ ...td,background:p2Bg }}>
                        {isAdmin&&(
                          d.p2_voided
                            ?<span style={{ fontSize:11,color:'#ef4444',fontWeight:700 }}>P2 Voided</span>
                            :d.p1_paid
                              ?<button onClick={()=>toggleP2(d)} style={aBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5')}>
                                  {d.p2_paid?'↩ Unpaid':'✓ Mark Paid'}
                                </button>
                              :<span style={{ fontSize:11,color:'#94a3b8' }}>Locked</span>
                        )}
                      </td>
                    </>}

                    {/* Cancellation */}
                    <td style={td}><CancelCell deal={d} isAdmin={isAdmin} onUpdate={updCancel} /></td>

                    {/* Approvals */}
                    <td style={td}><ApprCell item={d} tbl='deals' setter={setDeals} /></td>

                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f8fafc' }}>
                <td style={{ ...td,fontWeight:800 }} colSpan={2}>TOTALS</td>
                <td style={{ ...td,fontWeight:800,color:'#0ea5e9' }}>{fmt(sDeals.reduce((s,d)=>s+calcBHTotalLic(d),0))}</td>
                <td style={{ ...td,fontWeight:800,color:'#475569' }}>{fmt(sDeals.reduce((s,d)=>s+calcBHTotalLic(d)*12,0))}</td>
                <td style={{ ...td,fontWeight:800,color }}>{fmt(sComm)}</td>
                <td style={{ ...td,fontWeight:700 }}>{fmt(sDeals.reduce((s,d)=>s+(d.p1||0),0))}</td>
                <td style={td}></td>
                <td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700 }}>{fmt(sDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                <td style={td}></td>
                <td style={td}></td>
                {!isU&&<>
                  <td style={{ ...td,fontWeight:700,background:p2Bg }}>{fmt(sDeals.reduce((s,d)=>s+(d.p2||0),0))}</td>
                  <td style={{ background:p2Bg }}></td>
                  <td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700,background:p2Bg }}>{fmt(sDeals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
                  <td style={{ background:p2Bg }}></td>
                </>}
                <td style={td}></td>
                <td style={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return(
    <div style={css}>
      <EditModal />
      <div style={{ maxWidth:1400,margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <div>
            <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:'#1e293b' }}><span style={{ color:COMPANY_COLORS[company] }}>{company.charAt(0).toUpperCase()+company.slice(1)}</span> Commission Tracker</h1>
            <p style={{ margin:'4px 0 0',color:'#64748b',fontSize:13 }}>FY 2025 / 2026 · {isAdmin?'👑 Admin':`👤 ${profile?.name}`}</p>
          </div>
          <div style={{ display:'flex',gap:10,alignItems:'center' }}>
            {isAdmin&&<button onClick={()=>setShowAdd(!showAdd)} style={{ padding:'8px 16px',background:accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13 }}>+ Add Deal</button>}
            <button onClick={()=>exportToExcel(deals,refs,dName||'Export',isLukeView,company)} style={{ padding:'8px 16px',background:'#10b981',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13 }}>⬇ Export</button>
            <button onClick={signOut} style={{ padding:'8px 14px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:13,color:'#475569' }}>Sign Out</button>
          </div>
        </div>

        {/* Company toggle */}
        {isAdmin&&(<div style={{ display:'flex',justifyContent:'center',marginBottom:20 }}><div style={{ background:'#fff',borderRadius:12,padding:4,display:'inline-flex',gap:4,boxShadow:'0 1px 4px #0001' }}>{['xactco','bloodhound'].map(c=>(<button key={c} onClick={()=>{setCo(c);setSelSP(null);setDeals([]);setNewDeal(c==='bloodhound'?BLANK_BH:BLANK_X)}} style={{ padding:'8px 28px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:14,background:company===c?COMPANY_COLORS[c]:'transparent',color:company===c?'#fff':'#94a3b8' }}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>))}</div></div>)}

        {/* SP tabs */}
        {isAdmin&&profiles.length>0&&(<div style={{ display:'flex',gap:8,marginBottom:20,flexWrap:'wrap' }}>{profiles.map(sp=>(<button key={sp.id} onClick={()=>setSelSP(sp)} style={{ padding:'7px 20px',borderRadius:20,border:`2px solid ${sp.color}`,cursor:'pointer',fontWeight:700,fontSize:13,background:selSP?.id===sp.id?sp.color:'#fff',color:selSP?.id===sp.id?'#fff':sp.color }}>{sp.name}</button>))}</div>)}

        {/* KPIs */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20 }}>
          {[{label:`${dName||'...'} — Total Commission`,value:fmt(totalComm),color:accent},{label:'Total Paid Out',value:fmt(totalPaid),color:'#10b981'},{label:'Outstanding',value:fmt(totalComm-totalPaid),color:'#f59e0b'}].map(k=>(<div key={k.label} style={{ ...card,borderTop:`4px solid ${k.color}`,marginBottom:0 }}><div style={{ fontSize:12,color:'#64748b',fontWeight:600,marginBottom:4 }}>{k.label}</div><div style={{ fontSize:22,fontWeight:800,color:k.color }}>{k.value}</div></div>))}
        </div>

        {/* Add Deal */}
        {showAdd&&isAdmin&&(
          <div style={{ ...card,border:`2px solid ${accent}` }}>
            <h3 style={{ margin:'0 0 14px',color:accent,fontSize:15 }}>New Deal — {dName}{isBH&&<span style={{ fontSize:11,color:'#64748b',fontWeight:400 }}> · SLA licence revenue only</span>}</h3>
            {isBH&&(
              <div style={{ marginBottom:14,display:'flex',gap:10,alignItems:'center' }}>
                <span style={{ fontSize:12,fontWeight:600,color:'#475569' }}>Deal Type:</span>
                <button onClick={()=>setNewDeal(p=>({...p,deal_type:'new'}))} style={{ padding:'6px 16px',borderRadius:20,border:'2px solid #0ea5e9',cursor:'pointer',fontWeight:700,fontSize:13,background:newDeal.deal_type==='new'?'#0ea5e9':'#fff',color:newDeal.deal_type==='new'?'#fff':'#0ea5e9' }}>New Business (8%)</button>
                <button onClick={()=>setNewDeal(p=>({...p,deal_type:'upsell'}))} style={{ padding:'6px 16px',borderRadius:20,border:'2px solid #f59e0b',cursor:'pointer',fontWeight:700,fontSize:13,background:newDeal.deal_type==='upsell'?'#f59e0b':'#fff',color:newDeal.deal_type==='upsell'?'#fff':'#f59e0b' }}>Existing Client (4%)</button>
                {newDeal.inception_date&&newDeal.month&&<span style={{ fontSize:11,fontWeight:600,color:isExistingClient(newDeal.inception_date,newDeal.month)?'#92400e':'#0369a1' }}>{isExistingClient(newDeal.inception_date,newDeal.month)?'⚠️ Auto: Existing':'✅ Auto: New client'}</span>}
              </div>
            )}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
              {(isBH?[['Month','month','msel'],['Client','client','text'],['Quote No','quote_no','text'],['Inception Date','inception_date','msel'],['Patrol Qty','patrol_qty','number'],['Patrol Rate','patrol_rate','number'],['Inspect Qty','inspect_qty','number'],['Inspect Rate','inspect_rate','number'],['VM Qty','vm_qty','number'],['VM Rate','vm_rate','number'],['iLog Qty','ilog_qty','number'],['iLog Rate','ilog_rate','number'],['Invoice Total','invoice_total','number'],['P1 Date','p1_date','msel'],['Billing Date','billing_date','text'],['Notes','notes','text']]:
              [['Month','month','msel'],['Client','client','text'],['Once Off','once_off','number'],['App Users','app_users','number'],['Lite Users','lite_users','number'],['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],['Dashboards','dashboards','number'],['Dash Cost','dash_cost','number'],['P1 Date','p1_date','msel'],['Quote No','quote_no','text'],['Inception Date','inception_date','msel'],['Notes','notes','text']]).map(([label,key,type])=>(<div key={key}><div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3 }}>{label}</div>
                {type==='msel'?<select value={newDeal[key]||''} onChange={e=>setNewDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}><option value=''>— select —</option>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>
                :<input type={type} value={newDeal[key]||''} onChange={e=>setNewDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box' }} />}
              </div>))}
            </div>
            {isBH&&calcBHTotalLic(newDeal)>0&&(<div style={{ marginTop:10,padding:'8px 14px',borderRadius:8,background:newDeal.deal_type==='upsell'?'rgba(245,158,11,0.1)':'rgba(14,165,233,0.1)',fontSize:12,fontWeight:600,color:newDeal.deal_type==='upsell'?'#92400e':'#0369a1' }}>Monthly Deal: <strong>{fmt(calcBHTotalLic(newDeal))}</strong> → ARR: <strong>{fmt(calcBHTotalLic(newDeal)*12)}</strong> → Commission: <strong>{fmt(calcBHComm(calcBHTotalLic(newDeal),newDeal.deal_type))}</strong></div>)}
            {!isBH&&newDeal.p1_date&&!isLukeView&&<div style={{ marginTop:10,fontSize:12,color:accent,fontWeight:600 }}>📅 P2 auto-set: <strong>{getP2Month(newDeal.p1_date)||'—'}</strong></div>}
            <div style={{ marginTop:14,display:'flex',gap:10 }}><button onClick={addDeal} style={{ padding:'8px 18px',background:accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Save Deal</button><button onClick={()=>setShowAdd(false)} style={{ padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Cancel</button></div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex',gap:8,marginBottom:16 }}>
          <button style={tBtn('summary')} onClick={()=>setTab('summary')}>Payout Summary</button>
          <button style={tBtn('detail')} onClick={()=>setTab('detail')}>Deal Detail</button>
          {isAdmin&&<button style={tBtn('referrals')} onClick={()=>setTab('referrals')}>Referrals</button>}
        </div>

        {deals.length===0&&tab!=='referrals'&&<div style={{ ...card,textAlign:'center',color:'#94a3b8',padding:40 }}>No deals yet.{isAdmin&&<> Click <strong>+ Add Deal</strong> to get started.</>}</div>}

        {/* PAYOUT SUMMARY */}
        {tab==='summary'&&deals.length>0&&(
          isBH ? (
            <div><BHSection sDeals={newBH} type='new' /><BHSection sDeals={upBH} type='upsell' /></div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001' }}>
                <thead><tr>{['Client','Monthly Deal','× 12 (ARR)',commLabel,'Payout 1','Comm Pay Date','P1 Status','Client 1st Payment',...(isAdmin?['Finance Action']:[]),...(!isLukeView?['Payout 2','P2 Date','P2 Status',...(isAdmin?['Finance Action']:[])]:[]),'Cancellation','Approvals'].map((h,i)=>(<th key={i} style={{ ...th,background:i>=8?'#ede9fe':th.background }}>{h}</th>))}</tr></thead>
                <tbody>
                  {deals.map(d=>{
                    const comm=d.cancelled?(d.recalculated_comm||0):d.comm
                    return(<tr key={d.id} style={{ opacity:d.cancelled?0.75:1,background:d.cancelled?'#fff5f5':'#fff' }}>
                      <td style={{ ...td,fontWeight:700 }}>{d.client}{d.cancelled&&<span style={{ marginLeft:6,padding:'1px 6px',borderRadius:4,fontSize:10,background:'#fee2e2',color:'#991b1b' }}>Cancelled</span>}</td>
                      <td style={{ ...td,fontWeight:700,color:'#0ea5e9' }}>{fmt(d.total)}</td>
                      <td style={{ ...td,color:'#475569' }}>{fmt(d.arr)}</td>
                      <td style={{ ...td,color:accent,fontWeight:700 }}>{fmt(comm)}</td>
                      <td style={td}>{fmt(d.p1)}</td>
                      <td style={td}><DateCell deal={d} which='p1_date' disabled={false} /></td>
                      <td style={td}><Badge paid={d.p1_paid} /></td>
                      <td style={td}><PaySel deal={d} /></td>
                      {isAdmin&&<td style={td}><button onClick={()=>toggleP1(d)} style={aBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5')}>{d.p1_paid?'↩ Unpaid':'✓ Mark Paid'}</button></td>}
                      {!isLukeView&&<>
                        <td style={{ ...td,background:'#faf5ff' }}>{fmt(d.p2)}</td>
                        <td style={{ ...td,background:'#faf5ff' }}><DateCell deal={d} which='p2_date' disabled={!d.p1_paid} /></td>
                        <td style={{ ...td,background:'#faf5ff' }}><Badge paid={d.p2_paid} voided={d.p2_voided} /></td>
                        {isAdmin&&<td style={{ ...td,background:'#faf5ff' }}>{d.p2_voided?<span style={{ fontSize:11,color:'#ef4444',fontWeight:700 }}>Voided</span>:d.p1_paid?<button onClick={()=>toggleP2(d)} style={aBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5')}>{d.p2_paid?'↩ Unpaid':'✓ Mark Paid'}</button>:<span style={{ fontSize:11,color:'#94a3b8' }}>Locked</span>}</td>}
                      </>}
                      <td style={td}><CancelCell deal={d} isAdmin={isAdmin} onUpdate={updCancel} /></td>
                      <td style={td}><ApprCell item={d} tbl='deals' setter={setDeals} /></td>
                    </tr>)
                  })}
                </tbody>
                <tfoot><tr style={{ background:'#f8fafc' }}>
                  <td style={{ ...td,fontWeight:800 }}>TOTALS</td>
                  <td style={{ ...td,fontWeight:800,color:'#0ea5e9' }}>{fmt(deals.reduce((s,d)=>s+(d.total||0),0))}</td>
                  <td style={{ ...td,fontWeight:800 }}>{fmt(deals.reduce((s,d)=>s+(d.arr||0),0))}</td>
                  <td style={{ ...td,fontWeight:800,color:accent }}>{fmt(totalComm)}</td>
                  <td style={{ ...td,fontWeight:700 }}>{fmt(deals.reduce((s,d)=>s+(d.p1||0),0))}</td>
                  <td style={td}></td>
                  <td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700 }}>{fmt(deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                  <td style={td}></td>{isAdmin&&<td style={td}></td>}
                  {!isLukeView&&<><td style={{ ...td,fontWeight:700,background:'#faf5ff' }}>{fmt(deals.reduce((s,d)=>s+(d.p2||0),0))}</td><td style={{ background:'#faf5ff' }}></td><td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700,background:'#faf5ff' }}>{fmt(deals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>{isAdmin&&<td style={{ background:'#faf5ff' }}></td>}</>}
                  <td style={td}></td><td style={td}></td>
                </tr></tfoot>
              </table>
            </div>
          )
        )}

        {/* DEAL DETAIL */}
        {tab==='detail'&&deals.length>0&&(
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001' }}>
              <thead>
                {isBH&&(<tr><th colSpan={6} style={th}></th><th colSpan={2} style={{ ...th,background:'rgba(14,165,233,0.1)',color:'#0ea5e9',textAlign:'center' }}>Patrol</th><th colSpan={2} style={{ ...th,background:'rgba(139,92,246,0.1)',color:'#8b5cf6',textAlign:'center' }}>Inspect</th><th colSpan={2} style={{ ...th,background:'rgba(245,158,11,0.1)',color:'#f59e0b',textAlign:'center' }}>VM</th><th colSpan={2} style={{ ...th,background:'rgba(16,185,129,0.1)',color:'#10b981',textAlign:'center' }}>iLog</th><th colSpan={6} style={th}></th></tr>)}
                <tr>{isBH?['Month','Client','Type','Quote','Inception','Invoice','Qty','Rate','Qty','Rate','Qty','Rate','Qty','Rate','Monthly Deal','Total Comm','1st Payment','Notes','Cancelled',...(isAdmin?['Actions']:[])].map((h,i)=><th key={i} style={th}>{h}</th>):['Month','Client','Once Off','App Users','Lite Users','Admins','Dashboards','Monthly Total','ARR',commLabel,'Billing Date','Client 1st Payment','Notes','Cancelled',...(isAdmin?['Actions']:[])].map(h=><th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {deals.map(d=>(<tr key={d.id} style={{ background:d.cancelled?'#fff5f5':'#fff' }}>
                  {isBH?<>
                    <td style={td}>{d.month}</td>
                    <td style={{ ...td,fontWeight:700 }}>{d.client}</td>
                    <td style={td}><span style={{ padding:'2px 7px',borderRadius:8,fontSize:10,fontWeight:700,background:d.deal_type==='upsell'?'rgba(245,158,11,0.15)':'rgba(14,165,233,0.15)',color:d.deal_type==='upsell'?'#92400e':'#0369a1' }}>{d.deal_type==='upsell'?'Existing 4%':'New 8%'}</span></td>
                    <td style={{ ...td,color:'#64748b',fontSize:11 }}>{d.quote_no||'—'}</td>
                    <td style={{ ...td,color:'#64748b',fontSize:11 }}>{d.inception_date||'—'}</td>
                    <td style={td}>{fmt(d.invoice_total)}</td>
                    <td style={{ ...td,background:'rgba(14,165,233,0.04)' }}>{d.patrol_qty||0}</td><td style={{ ...td,background:'rgba(14,165,233,0.04)' }}>R{d.patrol_rate||0}</td>
                    <td style={{ ...td,background:'rgba(139,92,246,0.04)' }}>{d.inspect_qty||0}</td><td style={{ ...td,background:'rgba(139,92,246,0.04)' }}>R{d.inspect_rate||0}</td>
                    <td style={{ ...td,background:'rgba(245,158,11,0.04)' }}>{d.vm_qty||0}</td><td style={{ ...td,background:'rgba(245,158,11,0.04)' }}>R{d.vm_rate||0}</td>
                    <td style={{ ...td,background:'rgba(16,185,129,0.04)' }}>{d.ilog_qty||0}</td><td style={{ ...td,background:'rgba(16,185,129,0.04)' }}>R{d.ilog_rate||0}</td>
                    <td style={{ ...td,fontWeight:700,color:'#0ea5e9' }}>{fmt(calcBHTotalLic(d))}</td>
                    <td style={{ ...td,color:accent,fontWeight:700 }}>{fmt(d.cancelled?d.recalculated_comm:d.comm)}</td>
                    <td style={td}><PaySel deal={d} /></td>
                    <td style={{ ...td,color:'#64748b',fontSize:11 }}>{d.notes||'—'}</td>
                    <td style={td}><CancelCell deal={d} isAdmin={isAdmin} onUpdate={updCancel} /></td>
                    {isAdmin&&<td style={td}><div style={{ display:'flex',gap:4 }}><button onClick={()=>setEditDeal(d)} style={aBtn('#1e293b','#e2e8f0')}>✏️</button><button onClick={()=>delDeal(d.id)} style={aBtn('#991b1b','#fee2e2')}>🗑</button></div></td>}
                  </>:<>
                    <td style={td}>{d.month}</td>
                    <td style={{ ...td,fontWeight:700 }}>{d.client}</td>
                    <td style={td}>{fmt(d.once_off)}</td>
                    <td style={td}>{d.app_users}</td><td style={td}>{d.lite_users}</td>
                    <td style={td}>{d.admin} ({d.free_admin} free)</td>
                    <td style={td}>{d.dashboards}</td>
                    <td style={td}>{fmt(d.total)}</td>
                    <td style={td}>{fmt(d.arr)}</td>
                    <td style={{ ...td,fontWeight:700,color:accent }}>{fmt(d.cancelled?d.recalculated_comm:d.comm)}</td>
                    <td style={td}>{d.billing_date}</td>
                    <td style={td}><PaySel deal={d} /></td>
                    <td style={{ ...td,color:'#64748b',fontSize:11 }}>{d.notes}</td>
                    <td style={td}><CancelCell deal={d} isAdmin={isAdmin} onUpdate={updCancel} /></td>
                    {isAdmin&&<td style={td}><div style={{ display:'flex',gap:4 }}><button onClick={()=>setEditDeal(d)} style={aBtn('#1e293b','#e2e8f0')}>✏️ Edit</button><button onClick={()=>delDeal(d.id)} style={aBtn('#991b1b','#fee2e2')}>🗑</button></div></td>}
                  </>}
                </tr>))}
              </tbody>
            </table>
          </div>
        )}

        {/* REFERRALS */}
        {tab==='referrals'&&isAdmin&&(
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}><div style={{ fontSize:12,color:'#64748b' }}>25% of monthly contract value — paid after 2nd invoice settled</div><button onClick={()=>setShowAddRef(!showAddRef)} style={{ padding:'7px 16px',background:accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13 }}>+ Add Referral</button></div>
            {showAddRef&&(<div style={{ ...card,border:`2px solid ${accent}`,marginBottom:16 }}><h3 style={{ margin:'0 0 14px',color:accent,fontSize:15 }}>New Referral</h3><div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>{[['Referred By','referred_by','text'],['Client Name','client','text'],['Monthly Fee','mrr','number'],['Date','date','msel']].map(([label,key,type])=>(<div key={key}><div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3 }}>{label}</div>{type==='msel'?<select value={newRef[key]||''} onChange={e=>setNewRef(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}><option value=''>— select —</option>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>:<input type={type} value={newRef[key]} onChange={e=>setNewRef(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box' }} /></div>))}</div>{newRef.mrr>0&&<div style={{ marginTop:10,fontSize:12,color:accent,fontWeight:600 }}>💰 {fmt(newRef.mrr)} → 25% Bonus: {fmt(getReferralBonus(newRef.mrr))}</div>}<div style={{ marginTop:14,display:'flex',gap:10 }}><button onClick={addRef} style={{ padding:'8px 18px',background:accent,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Save</button><button onClick={()=>setShowAddRef(false)} style={{ padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Cancel</button></div></div>)}
            {refs.length===0&&!showAddRef&&<div style={{ ...card,textAlign:'center',color:'#94a3b8',padding:40 }}>No referrals yet.</div>}
            {refs.length>0&&(<div style={{ overflowX:'auto' }}><table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001' }}><thead><tr>{['Referred By','Client','Monthly Fee','25% Bonus','Date','Status','Approvals','Action',''].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead><tbody>{refs.map(r=>(<tr key={r.id}><td style={{ ...td,fontWeight:700 }}>{r.referred_by}</td><td style={td}>{r.client}</td><td style={{ ...td,color:'#0ea5e9',fontWeight:700 }}>{fmt(r.mrr)}</td><td style={{ ...td,color:accent,fontWeight:700 }}>{fmt(r.bonus)}</td><td style={td}>{r.date}</td><td style={td}><Badge paid={r.paid} /></td><td style={td}><ApprCell item={r} tbl='referrals' setter={setRefs} /></td><td style={td}><button onClick={()=>togRefPaid(r)} style={{ padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:r.paid?'#fee2e2':'#d1fae5',color:r.paid?'#991b1b':'#065f46' }}>{r.paid?'↩ Unpaid':'✓ Mark Paid'}</button></td><td style={td}><button onClick={()=>delRef(r.id)} style={{ padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:'#fee2e2',color:'#991b1b' }}>🗑</button></td></tr>))}</tbody><tfoot><tr style={{ background:'#f8fafc' }}><td style={{ ...td,fontWeight:800 }} colSpan={2}>TOTALS</td><td style={{ ...td,fontWeight:800,color:'#0ea5e9' }}>{fmt(refs.reduce((s,r)=>s+r.mrr,0))}</td><td style={{ ...td,fontWeight:800,color:accent }}>{fmt(refs.reduce((s,r)=>s+r.bonus,0))}</td><td style={td}></td><td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700 }}>{fmt(refs.reduce((s,r)=>s+(r.paid?r.bonus:0),0))} paid</td><td style={td}></td><td style={td}></td><td style={td}></td></tr></tfoot></table></div>)}
          </div>
        )}
      </div>
    </div>
  )
}
