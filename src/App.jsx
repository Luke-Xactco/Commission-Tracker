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
const calcBHComm = (total, dealType) => dealType === 'upsell' ? Math.round(total*12*0.04) : Math.round(total*12*0.08)
const isExistingClient = (inceptionDate, dealMonth) => {
  if (!inceptionDate || !dealMonth) return false
  const ii = MONTHS.indexOf(inceptionDate), di = MONTHS.indexOf(dealMonth)
  if (ii === -1 || di === -1) return false
  return (di - ii) >= 12
}
const calcCancelledComm = (deal, company) => {
  const months = parseInt(deal.active_months)||0
  if (months<=0) return 0
  if (company==='bloodhound') return Math.round(calcBHTotalLic(deal)*months*0.08)
  return Math.round((deal.total||0)*months*0.08)
}

const BLANK_XACTCO_DEAL = { month:'Jan-26', client:'', once_off:0, app_users:0, lite_users:0, a_user_cost:950, l_user_cost:0, admin:1, free_admin:0, admin_cost:1000, dashboards:0, dash_cost:0, billing_date:'', p1_date:'', notes:'', first_payment_received:'TBC', inception_date:'', quote_no:'' }
const BLANK_BH_DEAL = { month:'Jan-26', client:'', patrol_qty:0, patrol_rate:0, inspect_qty:0, inspect_rate:0, vm_qty:0, vm_rate:0, ilog_qty:0, ilog_rate:0, invoice_total:0, quote_no:'', inception_date:'', p1_date:'', billing_date:'', notes:'', first_payment_received:'TBC', deal_type:'new' }
const BLANK_REFERRAL = { referred_by:'', client:'', mrr:0, date:'', paid:false }

const exportToExcel = async (deals, referrals, name, isLukeView, company) => {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
  const fmtN = (n) => Number(n||0)
  const isBH = company==='bloodhound'
  const payoutHeaders = isBH
    ? ['Client','Month','Deal Type','Patrol Qty','Patrol Rate','Inspect Qty','Inspect Rate','VM Qty','VM Rate','iLog Qty','iLog Rate','Total Lic','Invoice Total','Commission','Payout 1','Comm Pay Date','P1 Status','Client 1st Payment','Payout 2','P2 Date','P2 Status','Quote No','Inception','Cancelled','Cancellation Date','Notes']
    : ['Client','Monthly Deal','ARR','Commission','Payout 1','P1 Date','P1 Status','1st Payment',...(!isLukeView?['Payout 2','P2 Date','P2 Status']:[]),'Cancelled','Cancellation Date']
  const payoutRows = deals.map(d => isBH ? [
    d.client, d.month, d.deal_type==='upsell'?'Upsell (4%)':'New Client (8%)',
    d.patrol_qty||0, d.patrol_rate||0, d.inspect_qty||0, d.inspect_rate||0, d.vm_qty||0, d.vm_rate||0, d.ilog_qty||0, d.ilog_rate||0,
    fmtN(calcBHTotalLic(d)), fmtN(d.invoice_total), fmtN(d.comm),
    fmtN(d.p1), d.p1_date||'', d.p1_paid?'PAID':'PENDING', d.first_payment_received||'TBC',
    fmtN(d.p2), d.p2_date||'', d.p2_voided?'VOIDED':d.p2_paid?'PAID':'PENDING',
    d.quote_no||'', d.inception_date||'', d.cancelled?'Yes':'No', d.cancellation_date||'', d.notes||''
  ] : [
    d.client, fmtN(d.total), fmtN(d.arr), fmtN(d.comm),
    fmtN(d.p1), d.p1_date||'', d.p1_paid?'PAID':'PENDING', d.first_payment_received||'TBC',
    ...(!isLukeView?[fmtN(d.p2), d.p2_date||'', d.p2_voided?'VOIDED':d.p2_paid?'PAID':'PENDING']:[]),
    d.cancelled?'Yes':'No', d.cancellation_date||''
  ])
  const refHeaders = ['Referred By','Client','Monthly Fee','25% Bonus','Date','Status']
  const refRows = referrals.map(r=>[r.referred_by,r.client,fmtN(r.mrr),fmtN(r.bonus),r.date||'',r.paid?'PAID':'PENDING'])
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.aoa_to_sheet([payoutHeaders,...payoutRows])
  ws1['!cols'] = payoutHeaders.map(h=>({wch:Math.max(h.length+2,12)}))
  XLSX.utils.book_append_sheet(wb,ws1,'Payout Summary')
  const ws2 = XLSX.utils.aoa_to_sheet([refHeaders,...refRows])
  ws2['!cols'] = refHeaders.map(h=>({wch:Math.max(h.length+2,14)}))
  XLSX.utils.book_append_sheet(wb,ws2,'Referrals')
  XLSX.writeFile(wb,`${name}_Commission_${new Date().toLocaleDateString('en-ZA').replace(/\//g,'-')}.xlsx`)
}

const Badge = ({ paid, voided }) => {
  if (voided) return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>VOIDED</span>
  return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:paid?'#d1fae5':'#fef3c7', color:paid?'#065f46':'#92400e' }}>{paid?'PAID':'PENDING'}</span>
}
const PaymentBadge = ({ val }) => {
  const c = { Yes:['#d1fae5','#065f46'], No:['#fee2e2','#991b1b'], TBC:['#fef3c7','#92400e'] }
  const [bg,col] = c[val]||c.TBC
  return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:bg, color:col }}>{val||'TBC'}</span>
}

function Login() {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false)
  const handleLogin = async () => { setLoading(true);setError('');const{error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setLoading(false) }
  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:'#fff',borderRadius:16,padding:40,width:360,boxShadow:'0 4px 24px #0001' }}>
        <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:800,color:'#1e293b' }}>💼 Commission Tracker</h1>
        <p style={{ margin:'0 0 28px',color:'#64748b',fontSize:13 }}>Sign in to your account</p>
        <div style={{ marginBottom:14 }}><div style={{ fontSize:12,fontWeight:600,color:'#475569',marginBottom:4 }}>Email</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,boxSizing:'border-box' }} /></div>
        <div style={{ marginBottom:20 }}><div style={{ fontSize:12,fontWeight:600,color:'#475569',marginBottom:4 }}>Password</div><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{ width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,boxSizing:'border-box' }} /></div>
        {error&&<div style={{ color:'#ef4444',fontSize:13,marginBottom:14 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{ width:'100%',padding:'11px',background:'#6366f1',color:'#fff',border:'none',borderRadius:8,fontWeight:700,fontSize:15,cursor:'pointer' }}>{loading?'Signing in...':'Sign In'}</button>
      </div>
    </div>
  )
}

const CancelCell = ({ deal, isAdmin, accentColor, onUpdate }) => {
  const [open,setOpen]=useState(false)
  const [date,setDate]=useState(deal.cancellation_date||'')
  const [months,setMonths]=useState(deal.active_months||'')
  if(deal.cancelled)return(<div><span style={{ padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,background:'#fee2e2',color:'#991b1b' }}>Cancelled</span><div style={{ fontSize:10,color:'#64748b',marginTop:2 }}>{deal.cancellation_date} · {deal.active_months}m</div><div style={{ fontSize:10,color:'#ef4444',fontWeight:700 }}>Revised: R {Number(deal.recalculated_comm||0).toLocaleString('en-ZA')}</div>{isAdmin&&<button onClick={()=>onUpdate(deal.id,false,'',0)} style={{ marginTop:4,padding:'2px 8px',fontSize:10,borderRadius:6,border:'none',cursor:'pointer',background:'#e2e8f0',color:'#475569' }}>↩ Undo</button>}</div>)
  if(!isAdmin)return <span style={{ color:'#94a3b8',fontSize:11 }}>—</span>
  if(open)return(<div style={{ display:'flex',flexDirection:'column',gap:4,minWidth:150 }}><input placeholder="Cancel date e.g. Mar-26" value={date} onChange={e=>setDate(e.target.value)} style={{ padding:'3px 6px',borderRadius:5,border:'1px solid #cbd5e1',fontSize:11 }} /><input type="number" placeholder="Active months" value={months} onChange={e=>setMonths(e.target.value)} style={{ padding:'3px 6px',borderRadius:5,border:'1px solid #cbd5e1',fontSize:11 }} /><div style={{ display:'flex',gap:4 }}><button onClick={()=>{onUpdate(deal.id,true,date,parseInt(months)||0);setOpen(false)}} style={{ padding:'3px 8px',fontSize:11,borderRadius:5,border:'none',cursor:'pointer',background:'#ef4444',color:'#fff',fontWeight:700 }}>Save</button><button onClick={()=>setOpen(false)} style={{ padding:'3px 8px',fontSize:11,borderRadius:5,border:'none',cursor:'pointer',background:'#e2e8f0',color:'#475569' }}>✕</button></div></div>)
  return <button onClick={()=>setOpen(true)} style={{ padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:'#fee2e2',color:'#991b1b' }}>Mark Cancelled</button>
}

export default function App() {
  const [session,setSession]=useState(null);const [profile,setProfile]=useState(null);const [deals,setDeals]=useState([]);const [profiles,setProfiles]=useState([]);const [referrals,setReferrals]=useState([]);const [company,setCompany]=useState('xactco');const [selectedSP,setSelectedSP]=useState(null);const [tab,setTab]=useState('summary');const [showAdd,setShowAdd]=useState(false);const [showAddReferral,setShowAddReferral]=useState(false);const [newDeal,setNewDeal]=useState(BLANK_XACTCO_DEAL);const [newReferral,setNewReferral]=useState(BLANK_REFERRAL);const [editingDate,setEditingDate]=useState(null);const [editingDeal,setEditingDeal]=useState(null);const [loading,setLoading]=useState(true)
  const isBH = company==='bloodhound'

  useEffect(()=>{ supabase.auth.getSession().then(({data:{session}})=>setSession(session));supabase.auth.onAuthStateChange((_e,s)=>setSession(s)) },[])
  useEffect(()=>{ if(!session){setLoading(false);return};loadProfile() },[session])
  useEffect(()=>{ if(!profile)return;if(profile.role==='admin'||profile.role==='manager')loadAllProfiles();else loadDeals(profile.id) },[profile,company])
  useEffect(()=>{ if(selectedSP)loadDeals(selectedSP.id) },[selectedSP])

  const loadProfile = async () => { const{data}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();setProfile(data);setLoading(false) }
  const loadAllProfiles = async () => { const{data}=await supabase.from('profiles').select('*').eq('company',company);const sps=(data||[]).filter(p=>p.role==='salesperson'||p.role==='admin');setProfiles(sps);if(sps.length)setSelectedSP(sps[0]) }
  const loadDeals = async (spId) => { const{data}=await supabase.from('deals').select('*').eq('salesperson_id',spId).eq('company',company).order('created_at');const sorted=(data||[]).sort((a,b)=>MONTHS.indexOf(a.p1_date)-MONTHS.indexOf(b.p1_date));setDeals(sorted);loadReferrals(spId) }
  const loadReferrals = async (spId) => { const{data}=await supabase.from('referrals').select('*').eq('salesperson_id',spId).eq('company',company).order('created_at');setReferrals(data||[]) }

  const toggleP1 = async (deal) => { const nowPaid=!deal.p1_paid;const p2_date=nowPaid?getP2Month(deal.p1_date):deal.p2_date;const updates={p1_paid:nowPaid,p1_paid_date:nowPaid?new Date().toLocaleDateString('en-ZA'):null,p2_date};await supabase.from('deals').update(updates).eq('id',deal.id);setDeals(prev=>prev.map(d=>d.id===deal.id?{...d,...updates}:d)) }
  const toggleP2 = async (deal) => { const updates={p2_paid:!deal.p2_paid};await supabase.from('deals').update(updates).eq('id',deal.id);setDeals(prev=>prev.map(d=>d.id===deal.id?{...d,...updates}:d)) }
  const updateDate = async (deal,which,val) => { const updates={[which]:val};if(which==='p1_date'&&!deal.p2_paid)updates.p2_date=getP2Month(val);await supabase.from('deals').update(updates).eq('id',deal.id);setDeals(prev=>prev.map(d=>d.id===deal.id?{...d,...updates}:d));setEditingDate(null) }
  const updatePaymentStatus = async (id,val) => { await supabase.from('deals').update({first_payment_received:val}).eq('id',id);setDeals(prev=>prev.map(d=>d.id===id?{...d,first_payment_received:val}:d)) }
  const toggleApproval = async (id,key,table,setter) => { const item=table==='deals'?deals.find(d=>d.id===id):referrals.find(r=>r.id===id);const updates={[key]:!item[key]};await supabase.from(table).update(updates).eq('id',id);setter(prev=>prev.map(x=>x.id===id?{...x,...updates}:x)) }

  const updateDealType = async (id, dealType) => {
    const deal=deals.find(d=>d.id===id)
    const lic=calcBHTotalLic(deal)
    const comm=calcBHComm(lic,dealType)
    const isUpsell=dealType==='upsell'
    const p1=isUpsell?comm:Math.round(comm/2)
    const p2=isUpsell?0:Math.round(comm/2)
    const p2_date=isUpsell?'':getP2Month(deal.p1_date)
    const updates={deal_type:dealType,arr:lic*12,comm,p1,p2,p2_date,p2_voided:isUpsell}
    await supabase.from('deals').update(updates).eq('id',id)
    setDeals(prev=>prev.map(d=>d.id===id?{...d,...updates}:d))
  }

  const updateCancellation = async (id,cancelled,cancellation_date,active_months) => {
    const deal=deals.find(d=>d.id===id)
    const recalculated_comm=cancelled?calcCancelledComm({...deal,active_months},company):0
    const p2_voided=cancelled&&!deal.p2_paid
    const updates={cancelled,cancellation_date,active_months,recalculated_comm,p2_voided}
    await supabase.from('deals').update(updates).eq('id',id)
    setDeals(prev=>prev.map(d=>d.id===id?{...d,...updates}:d))
  }

  const addDeal = async () => {
    if(!newDeal.client||!newDeal.p1_date)return
    const spId=(profile.role==='admin'||profile.role==='manager')?selectedSP?.id:profile.id
    let total,arr,comm,p1,p2,p2_date,deal_type='new'
    if(isBH){
      total=calcBHTotalLic(newDeal)
      const existing=isExistingClient(newDeal.inception_date,newDeal.month)
      deal_type=newDeal.deal_type||(existing?'upsell':'new')
      arr=total*12
      comm=calcBHComm(total,deal_type)
      p1=deal_type==='upsell'?comm:Math.round(comm/2)
      p2=deal_type==='upsell'?0:Math.round(comm/2)
      p2_date=deal_type==='upsell'?'':getP2Month(newDeal.p1_date)
    } else {
      total=(newDeal.app_users*newDeal.a_user_cost)+(newDeal.lite_users*(newDeal.l_user_cost||0))+Math.max(0,newDeal.admin-newDeal.free_admin)*newDeal.admin_cost+(newDeal.dashboards*newDeal.dash_cost)
      arr=total*12;const isLuke=spId===LUKE_ID;comm=isLuke?total:arr*0.08;p1=isLuke?total:comm/2;p2=isLuke?0:comm/2;p2_date=isLuke?'':getP2Month(newDeal.p1_date)
    }
    await supabase.from('deals').insert([{...newDeal,salesperson_id:spId,company,total,arr,comm,p1,p2,p2_date,deal_type,p1_paid:false,p2_paid:false,approved_luke:false,approved_bernard:false,approved_romaine:false,cancelled:false,p2_voided:deal_type==='upsell'}])
    setShowAdd(false);setNewDeal(isBH?BLANK_BH_DEAL:BLANK_XACTCO_DEAL);loadDeals(spId)
  }

  const deleteDeal = async (id) => { if(!window.confirm('Delete this deal?'))return;await supabase.from('deals').delete().eq('id',id);setDeals(prev=>prev.filter(d=>d.id!==id)) }

  const saveEditedDeal = async () => {
    if(!editingDeal)return
    let total,arr,comm,p1,p2
    if(isBH){
      total=calcBHTotalLic(editingDeal);const isUpsell=editingDeal.deal_type==='upsell'
      arr=isUpsell?total:total*12;comm=isUpsell?Math.round(total*0.04):Math.round(total*12*0.08);p1=isUpsell?comm:Math.round(comm/2);p2=isUpsell?0:Math.round(comm/2)
    } else {
      total=(editingDeal.app_users*editingDeal.a_user_cost)+(editingDeal.lite_users*(editingDeal.l_user_cost||0))+Math.max(0,editingDeal.admin-editingDeal.free_admin)*editingDeal.admin_cost+(editingDeal.dashboards*editingDeal.dash_cost)
      arr=total*12;const isLuke=editingDeal.salesperson_id===LUKE_ID;comm=isLuke?total:arr*0.08;p1=isLuke?total:comm/2;p2=isLuke?0:comm/2
    }
    await supabase.from('deals').update({...editingDeal,total,arr,comm,p1,p2}).eq('id',editingDeal.id)
    setEditingDeal(null);loadDeals(selectedSP?.id||profile.id)
  }

  const addReferral = async () => { if(!newReferral.referred_by||!newReferral.client||!newReferral.mrr)return;const bonus=getReferralBonus(newReferral.mrr);const spId=(profile.role==='admin'||profile.role==='manager')?selectedSP?.id:profile.id;await supabase.from('referrals').insert([{...newReferral,salesperson_id:spId,company,bonus,paid:false,approved_luke:false,approved_bernard:false,approved_romaine:false}]);setShowAddReferral(false);setNewReferral(BLANK_REFERRAL);loadReferrals(spId) }
  const toggleReferralPaid = async (r) => { const updates={paid:!r.paid};await supabase.from('referrals').update(updates).eq('id',r.id);setReferrals(prev=>prev.map(x=>x.id===r.id?{...x,...updates}:x)) }
  const deleteReferral = async (id) => { if(!window.confirm('Delete this referral?'))return;await supabase.from('referrals').delete().eq('id',id);setReferrals(prev=>prev.filter(r=>r.id!==id)) }
  const signOut = () => supabase.auth.signOut()

  if(!session)return <Login />
  if(loading)return <div style={{ padding:40,textAlign:'center',color:'#64748b',fontFamily:"'Segoe UI',sans-serif" }}>Loading...</div>

  const isAdmin=profile?.role==='admin'||profile?.role==='manager'
  const isLukeView=!isBH&&(selectedSP?.id===LUKE_ID||(!isAdmin&&profile?.id===LUKE_ID))
  const accentColor=isBH?'#ef4444':(selectedSP?.color||profile?.color||'#6366f1')
  const displayName=isAdmin?selectedSP?.name:profile?.name
  const commLabel=isLukeView?'Commission':'8% Comm'

  const newDeals=deals.filter(d=>(d.deal_type||'new')==='new')
  const upsellDeals=deals.filter(d=>d.deal_type==='upsell')

  const totalComm=deals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
  const totalPaid=deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)
  const totalPending=totalComm-totalPaid

  const css={fontFamily:"'Segoe UI',sans-serif",background:'#f8fafc',minHeight:'100vh',padding:20}
  const card={background:'#fff',borderRadius:12,padding:20,marginBottom:16,boxShadow:'0 1px 4px #0001'}
  const th={padding:'9px 12px',background:'#f1f5f9',fontSize:11,fontWeight:700,color:'#475569',textAlign:'left',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}
  const td={padding:'9px 12px',fontSize:12,color:'#1e293b',borderBottom:'1px solid #f1f5f9',verticalAlign:'middle'}
  const tabBtn=(t)=>({padding:'8px 20px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,background:tab===t?accentColor:'#e2e8f0',color:tab===t?'#fff':'#475569'})
  const actionBtn=(color,bg)=>({padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:bg,color,whiteSpace:'nowrap'})

  const cancelProps = { isAdmin, accentColor, onUpdate: updateCancellation }
  const CancelCellInner = ({ deal }) => <CancelCell deal={deal} {...cancelProps} />

  const ApprovalCell = ({ item,table,setter }) => (
    <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
      {APPROVERS.map(a=>{ const approved=item[a.key];const canToggle=profile?.id===a.id;return(<button key={a.id} onClick={canToggle?()=>toggleApproval(item.id,a.key,table,setter):undefined} style={{ padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:700,border:'none',cursor:canToggle?'pointer':'default',background:approved?'#d1fae5':'#f1f5f9',color:approved?'#065f46':'#94a3b8' }}>{approved?'✅':'⬜'} {a.name}</button>)})}
    </div>
  )

  const DateCell = ({ deal,which,disabled }) => {
    const isEditing=editingDate?.id===deal.id&&editingDate?.which===which;const val=deal[which]
    if(disabled)return <span style={{ color:'#94a3b8',fontSize:11 }}>Set when P1 paid</span>
    if(isEditing)return(<div style={{ display:'flex',alignItems:'center',gap:4 }}><select autoFocus defaultValue={val} onChange={e=>updateDate(deal,which,e.target.value)} style={{ padding:'3px 6px',borderRadius:5,border:`1px solid ${accentColor}`,fontSize:11 }}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select><button onClick={()=>setEditingDate(null)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#94a3b8' }}>✕</button></div>)
    const canEdit=isAdmin&&!deal[which==='p1_date'?'p1_paid':'p2_paid']
    return(<div style={{ display:'flex',alignItems:'center',gap:4 }}><span>{val||'—'}</span>{canEdit&&<button onClick={()=>setEditingDate({id:deal.id,which})} style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,color:accentColor,padding:0 }}>✏️</button>}{which==='p1_date'&&deal.p1_paid&&deal.p1_paid_date&&<span style={{ fontSize:10,color:'#10b981',display:'block' }}>paid {deal.p1_paid_date}</span>}</div>)
  }

  const PaymentSelect = ({ deal }) => (
    isAdmin?(<select value={deal.first_payment_received||'TBC'} onChange={e=>updatePaymentStatus(deal.id,e.target.value)} style={{ padding:'3px 7px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:11,fontWeight:700,cursor:'pointer',background:deal.first_payment_received==='Yes'?'#d1fae5':deal.first_payment_received==='No'?'#fee2e2':'#fef3c7',color:deal.first_payment_received==='Yes'?'#065f46':deal.first_payment_received==='No'?'#991b1b':'#92400e' }}><option>TBC</option><option>Yes</option><option>No</option></select>):<PaymentBadge val={deal.first_payment_received} />
  )

  const EditModal = () => {
    if(!editingDeal)return null
    const fields=isBH?[['Month','month','select'],['Client','client','text'],['Deal Type','deal_type','deal_type_select'],['Patrol Qty','patrol_qty','number'],['Patrol Rate','patrol_rate','number'],['Inspect Qty','inspect_qty','number'],['Inspect Rate','inspect_rate','number'],['VM Qty','vm_qty','number'],['VM Rate','vm_rate','number'],['iLog Qty','ilog_qty','number'],['iLog Rate','ilog_rate','number'],['Invoice Total','invoice_total','number'],['Quote No','quote_no','text'],['Inception Date','inception_date','text'],['P1 Date','p1_date','select'],['Billing Date','billing_date','text'],['Notes','notes','text']]:
    [['Month','month','select'],['Client','client','text'],['Once Off','once_off','number'],['App Users','app_users','number'],['Lite Users','lite_users','number'],['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],['Dashboards','dashboards','number'],['Dash Cost','dash_cost','number'],['Billing Date','billing_date','text'],['P1 Date','p1_date','select'],['Quote No','quote_no','text'],['Inception Date','inception_date','text'],['Notes','notes','text']]
    return(
      <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0008',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div style={{ background:'#fff',borderRadius:16,padding:28,width:740,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 8px 32px #0003' }}>
          <h3 style={{ margin:'0 0 16px',color:accentColor,fontSize:15 }}>Edit Deal — {editingDeal.client}</h3>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
            {fields.map(([label,key,type])=>(<div key={key}><div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3 }}>{label}</div>
              {type==='select'?<select value={editingDeal[key]||''} onChange={e=>setEditingDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>
              :type==='deal_type_select'?<select value={editingDeal[key]||'new'} onChange={e=>setEditingDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}><option value='new'>New Business (8%)</option><option value='upsell'>Existing Client (4%)</option></select>
              :<input type={type} value={editingDeal[key]||''} onChange={e=>setEditingDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box' }} />}
            </div>))}
          </div>
          <div style={{ marginTop:16,display:'flex',gap:10 }}><button onClick={saveEditedDeal} style={{ padding:'8px 18px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Save Changes</button><button onClick={()=>setEditingDeal(null)} style={{ padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Cancel</button></div>
        </div>
      </div>
    )
  }

  // ── BH Payout Summary — one section (new business or upsell) ──────────────
  const BHSection = ({ sectionDeals, type }) => {
    if(sectionDeals.length===0)return null
    const isUpsell = type==='upsell'
    const sectionComm = sectionDeals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
    const sectionPaid = sectionDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)
    const color      = isUpsell ? '#f59e0b' : '#ef4444'
    const bgColor    = isUpsell ? 'rgba(245,158,11,0.06)'  : 'rgba(239,68,68,0.06)'
    const borderColor= isUpsell ? 'rgba(245,158,11,0.25)'  : 'rgba(239,68,68,0.25)'
    const textColor  = isUpsell ? '#92400e' : '#991b1b'

    // Tighter styles for BH table to fit all columns
    const bth = { ...th, padding:'7px 8px', fontSize:11 }
    const btd = { ...td, padding:'7px 8px', fontSize:11 }
    const p2BG = { background:'#faf5ff' }

    const headers = [
      'Client', 'Month', 'Monthly Deal', '× 12 (ARR)',
      isUpsell ? 'Total Comm (4%)' : 'Total Comm (8%)',
      'Payout 1',
      'Comm Pay Date',
      isUpsell ? 'Status' : 'P1 Status',
      'Client 1st Payment',
      ...(isAdmin ? ['Finance Action'] : []),
      ...(!isUpsell ? [
        'Payout 2',
        'P2 Date',
        'P2 Status',
        ...(isAdmin ? ['Finance Action'] : []),
      ] : []),
      'Cancellation',
      'Approvals',
    ]

    const p2StartIdx = headers.indexOf('P2 Date')

    return (
      <div style={{ marginBottom:24,borderRadius:10,overflow:'hidden',border:`0.5px solid ${borderColor}`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* Section header bar */}
        <div style={{ padding:'10px 16px',background:bgColor,borderBottom:`0.5px solid ${borderColor}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:10,height:10,borderRadius:'50%',background:color }}></div>
            <span style={{ color:textColor,fontSize:14,fontWeight:700 }}>
              {isUpsell ? 'Existing Client Upsell' : 'New Business'}
            </span>
            <span style={{ fontSize:11,color:'#64748b',fontWeight:400 }}>
              {isUpsell
                ? '4% of ARR · Once-off payment · No clawback'
                : '8% of ARR · Split 50/50 · P1 month 2, P2 month 7'}
            </span>
          </div>
          <div style={{ fontSize:13,color:textColor,fontWeight:700 }}>
            Commission: {fmt(sectionComm)} · Paid: {fmt(sectionPaid)}
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',tableLayout:'auto' }}>
            <thead>
              <tr>
                {headers.map((h,i) => (
                  <th key={i} style={{
                    ...bth,
                    background: !isUpsell && p2StartIdx !== -1 && i >= p2StartIdx && h !== 'Cancellation' && h !== 'Approvals'
                      ? 'rgba(99,102,241,0.06)' : bth.background
                  }}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sectionDeals.map(d => {
                const lic  = calcBHTotalLic(d)
                const arr  = lic * 12
                const comm = d.cancelled ? (d.recalculated_comm||0) : d.comm
                return (
                  <tr key={d.id} style={{ opacity:d.cancelled?0.75:1, background:d.cancelled?'#fff5f5':'#fff' }}>
                    {/* Client */}
                    <td style={{ ...btd,fontWeight:700,maxWidth:120 }}>
                      <div>{d.client}</div>
                      {d.cancelled && <span style={{ padding:'1px 5px',borderRadius:4,fontSize:10,background:'#fee2e2',color:'#991b1b' }}>Cancelled</span>}
                    </td>
                    {/* Month */}
                    <td style={{ ...btd,whiteSpace:'nowrap' }}>{d.month}</td>
                    {/* Monthly Deal */}
                    <td style={{ ...btd,fontWeight:700,color:'#0ea5e9',whiteSpace:'nowrap' }}>{fmt(lic)}</td>
                    {/* × 12 ARR */}
                    <td style={{ ...btd,color:'#475569',whiteSpace:'nowrap' }}>{fmt(arr)}</td>
                    {/* Total Comm */}
                    <td style={{ ...btd,color,fontWeight:700,whiteSpace:'nowrap' }}>{fmt(comm)}</td>
                    {/* Payout 1 */}
                    <td style={{ ...btd,whiteSpace:'nowrap' }}>{fmt(d.p1)}</td>
                    {/* Comm Pay Date */}
                    <td style={{ ...btd,whiteSpace:'nowrap' }}><DateCell deal={d} which='p1_date' disabled={false} /></td>
                    {/* P1 Status */}
                    <td style={btd}><Badge paid={d.p1_paid} /></td>
                    {/* Client 1st Payment */}
                    <td style={btd}><PaymentSelect deal={d} /></td>
                    {/* Finance Action P1 */}
                    {isAdmin && (
                      <td style={btd}>
                        <button onClick={()=>toggleP1(d)} style={{ ...actionBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5'),fontSize:10,padding:'3px 7px' }}>
                          {d.p1_paid ? '↩ Unpaid' : '✓ P1 Paid'}
                        </button>
                      </td>
                    )}
                    {/* Payout 2 — new business only, now after Finance Action P1 */}
                    {!isUpsell && <td style={{ ...btd,whiteSpace:'nowrap',...p2BG }}>{fmt(d.p2)}</td>}
                    {/* P2 Date / P2 Status / Finance Action P2 — new business only */}
                    {!isUpsell && <>
                      <td style={{ ...btd,...p2BG,whiteSpace:'nowrap' }}>
                        <DateCell deal={d} which='p2_date' disabled={!d.p1_paid} />
                      </td>
                      <td style={{ ...btd,...p2BG }}>
                        <Badge paid={d.p2_paid} voided={d.p2_voided} />
                      </td>
                      {isAdmin && (
                        <td style={{ ...btd,...p2BG }}>
                          {d.p2_voided
                            ? <span style={{ fontSize:10,color:'#ef4444',fontWeight:700 }}>Voided</span>
                            : d.p1_paid
                              ? <button onClick={()=>toggleP2(d)} style={{ ...actionBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5'),fontSize:10,padding:'3px 7px' }}>
                                  {d.p2_paid ? '↩ Unpaid' : '✓ P2 Paid'}
                                </button>
                              : <span style={{ fontSize:10,color:'#94a3b8' }}>Locked</span>
                          }
                        </td>
                      )}
                    </>}
                    {/* Cancellation */}
                    <td style={btd}><CancelCellInner deal={d} /></td>
                    {/* Approvals */}
                    <td style={btd}><ApprovalCell item={d} table='deals' setter={setDeals} /></td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr style={{ background:'#f8fafc' }}>
                <td style={{ ...btd,fontWeight:800 }} colSpan={2}>TOTALS</td>
                <td style={{ ...btd,fontWeight:800,color:'#0ea5e9' }}>{fmt(sectionDeals.reduce((s,d)=>s+calcBHTotalLic(d),0))}</td>
                <td style={{ ...btd,fontWeight:800,color:'#475569' }}>{fmt(sectionDeals.reduce((s,d)=>s+calcBHTotalLic(d)*12,0))}</td>
                <td style={{ ...btd,fontWeight:800,color }}>{fmt(sectionComm)}</td>
                <td style={{ ...btd,fontWeight:700 }}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p1||0),0))}</td>
                {/* Comm Pay Date — blank */}
                <td style={btd}></td>
                {/* P1 paid summary */}
                <td style={{ ...btd,color:'#10b981',fontWeight:700 }}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                {/* Client 1st Payment — blank */}
                <td style={btd}></td>
                {/* Finance Action P1 — blank */}
                {isAdmin && <td style={btd}></td>}
                {/* Payout 2 / P2 Date / P2 Status / Finance Action P2 totals (new only) */}
                {!isUpsell && <>
                  <td style={{ ...btd,...p2BG,fontWeight:700 }}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p2||0),0))}</td>
                  <td style={{ ...btd,...p2BG }}></td>
                  <td style={{ ...btd,...p2BG,color:'#10b981',fontWeight:700 }}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
                  {isAdmin && <td style={{ ...btd,...p2BG }}></td>}
                </>}
                <td style={btd}></td>
                <td style={btd}></td>
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

        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <div>
            <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:'#1e293b' }}><span style={{ color:COMPANY_COLORS[company] }}>{company.charAt(0).toUpperCase()+company.slice(1)}</span> Commission Tracker</h1>
            <p style={{ margin:'4px 0 0',color:'#64748b',fontSize:13 }}>FY 2025 / 2026 · {isAdmin?'👑 Admin':`👤 ${profile?.name}`}</p>
          </div>
          <div style={{ display:'flex',gap:10,alignItems:'center' }}>
            {isAdmin&&<button onClick={()=>setShowAdd(!showAdd)} style={{ padding:'8px 16px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13 }}>+ Add Deal</button>}
            <button onClick={()=>exportToExcel(deals,referrals,displayName||'Export',isLukeView,company)} style={{ padding:'8px 16px',background:'#10b981',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13 }}>⬇ Export</button>
            <button onClick={signOut} style={{ padding:'8px 14px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:13,color:'#475569' }}>Sign Out</button>
          </div>
        </div>

        {isAdmin&&(<div style={{ display:'flex',justifyContent:'center',marginBottom:20 }}><div style={{ background:'#fff',borderRadius:12,padding:4,display:'inline-flex',gap:4,boxShadow:'0 1px 4px #0001' }}>{['xactco','bloodhound'].map(c=>(<button key={c} onClick={()=>{setCompany(c);setSelectedSP(null);setDeals([]);setNewDeal(c==='bloodhound'?BLANK_BH_DEAL:BLANK_XACTCO_DEAL)}} style={{ padding:'8px 28px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:14,background:company===c?COMPANY_COLORS[c]:'transparent',color:company===c?'#fff':'#94a3b8' }}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>))}</div></div>)}

        {isAdmin&&profiles.length>0&&(<div style={{ display:'flex',gap:8,marginBottom:20,flexWrap:'wrap' }}>{profiles.map(sp=>(<button key={sp.id} onClick={()=>setSelectedSP(sp)} style={{ padding:'7px 20px',borderRadius:20,border:`2px solid ${sp.color}`,cursor:'pointer',fontWeight:700,fontSize:13,background:selectedSP?.id===sp.id?sp.color:'#fff',color:selectedSP?.id===sp.id?'#fff':sp.color }}>{sp.name}</button>))}</div>)}

        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20 }}>
          {[{label:`${displayName||'...'} — Total Commission`,value:fmt(totalComm),color:accentColor},{label:'Total Paid Out',value:fmt(totalPaid),color:'#10b981'},{label:'Outstanding',value:fmt(totalPending),color:'#f59e0b'}].map(k=>(<div key={k.label} style={{ ...card,borderTop:`4px solid ${k.color}`,marginBottom:0 }}><div style={{ fontSize:12,color:'#64748b',fontWeight:600,marginBottom:4 }}>{k.label}</div><div style={{ fontSize:22,fontWeight:800,color:k.color }}>{k.value}</div></div>))}
        </div>

        {showAdd&&isAdmin&&(
          <div style={{ ...card,border:`2px solid ${accentColor}` }}>
            <h3 style={{ margin:'0 0 14px',color:accentColor,fontSize:15 }}>New Deal — {displayName}{isBH&&<span style={{ fontSize:11,color:'#64748b',fontWeight:400 }}> · SLA licence revenue only</span>}</h3>
            {isBH&&(
              <div style={{ marginBottom:14,display:'flex',gap:10,alignItems:'center' }}>
                <span style={{ fontSize:12,fontWeight:600,color:'#475569' }}>Deal Type:</span>
                <button onClick={()=>setNewDeal(p=>({...p,deal_type:'new'}))} style={{ padding:'6px 16px',borderRadius:20,border:'2px solid #0ea5e9',cursor:'pointer',fontWeight:700,fontSize:13,background:newDeal.deal_type==='new'?'#0ea5e9':'#fff',color:newDeal.deal_type==='new'?'#fff':'#0ea5e9' }}>New Business (8%)</button>
                <button onClick={()=>setNewDeal(p=>({...p,deal_type:'upsell'}))} style={{ padding:'6px 16px',borderRadius:20,border:'2px solid #f59e0b',cursor:'pointer',fontWeight:700,fontSize:13,background:newDeal.deal_type==='upsell'?'#f59e0b':'#fff',color:newDeal.deal_type==='upsell'?'#fff':'#f59e0b' }}>Existing Client (4%)</button>
                {newDeal.inception_date&&newDeal.month&&<span style={{ fontSize:11,color:isExistingClient(newDeal.inception_date,newDeal.month)?'#92400e':'#0369a1',fontWeight:600 }}>{isExistingClient(newDeal.inception_date,newDeal.month)?'⚠️ Auto-detected: Existing client':'✅ Auto-detected: New client'}</span>}
              </div>
            )}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
              {(isBH?[['Month','month','select'],['Client','client','text'],['Quote No','quote_no','text'],['Inception Date','inception_date','text'],['Patrol Qty','patrol_qty','number'],['Patrol Rate','patrol_rate','number'],['Inspect Qty','inspect_qty','number'],['Inspect Rate','inspect_rate','number'],['VM Qty','vm_qty','number'],['VM Rate','vm_rate','number'],['iLog Qty','ilog_qty','number'],['iLog Rate','ilog_rate','number'],['Invoice Total','invoice_total','number'],['P1 Date','p1_date','select'],['Billing Date','billing_date','text'],['Notes','notes','text']]:
              [['Month','month','select'],['Client','client','text'],['Once Off','once_off','number'],['App Users','app_users','number'],['Lite Users','lite_users','number'],['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],['Dashboards','dashboards','number'],['Dash Cost','dash_cost','number'],['Billing Date','billing_date','text'],['P1 Date','p1_date','select'],['Quote No','quote_no','text'],['Inception Date','inception_date','text'],['Notes','notes','text']]).map(([label,key,type])=>(<div key={key}><div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3 }}>{label}</div>{type==='select'?<select value={newDeal[key]||''} onChange={e=>setNewDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12 }}><option value=''>— select —</option>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>:<input type={type} value={newDeal[key]||''} onChange={e=>setNewDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box' }} />}</div>))}
            </div>
            {isBH&&calcBHTotalLic(newDeal)>0&&(<div style={{ marginTop:10,padding:'8px 14px',borderRadius:8,background:newDeal.deal_type==='upsell'?'rgba(245,158,11,0.1)':'rgba(14,165,233,0.1)',fontSize:12,fontWeight:600,color:newDeal.deal_type==='upsell'?'#92400e':'#0369a1' }}>Lic Total: <strong>{fmt(calcBHTotalLic(newDeal))}</strong> → Commission: <strong>{fmt(newDeal.deal_type==='upsell'?Math.round(calcBHTotalLic(newDeal)*0.04):Math.round(calcBHTotalLic(newDeal)*12*0.08))}</strong>{newDeal.deal_type!=='upsell'&&newDeal.p1_date&&<span style={{ marginLeft:8 }}>P2 auto-set: <strong>{getP2Month(newDeal.p1_date)||'—'}</strong></span>}</div>)}
            {!isBH&&newDeal.p1_date&&!isLukeView&&<div style={{ marginTop:10,fontSize:12,color:accentColor,fontWeight:600 }}>📅 P2 auto-set to: <strong>{getP2Month(newDeal.p1_date)||'—'}</strong></div>}
            <div style={{ marginTop:14,display:'flex',gap:10 }}><button onClick={addDeal} style={{ padding:'8px 18px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Save Deal</button><button onClick={()=>setShowAdd(false)} style={{ padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Cancel</button></div>
          </div>
        )}

        <div style={{ display:'flex',gap:8,marginBottom:16 }}>
          <button style={tabBtn('summary')} onClick={()=>setTab('summary')}>Payout Summary</button>
          <button style={tabBtn('detail')} onClick={()=>setTab('detail')}>Deal Detail</button>
          {isAdmin&&<button style={tabBtn('referrals')} onClick={()=>setTab('referrals')}>Referrals</button>}
        </div>

        {deals.length===0&&tab!=='referrals'&&<div style={{ ...card,textAlign:'center',color:'#94a3b8',padding:40 }}>No deals yet.{isAdmin&&<> Click <strong>+ Add Deal</strong> to get started.</>}</div>}

        {/* ── PAYOUT SUMMARY ─────────────────────────────────────── */}
        {tab==='summary'&&deals.length>0&&(
          isBH ? (
            <div>
              <BHSection sectionDeals={newDeals} type='new' />
              <BHSection sectionDeals={upsellDeals} type='upsell' />
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              {isAdmin&&<div style={{ fontSize:12,color:'#94a3b8',marginBottom:8 }}>✏️ Pencil = reschedule payout date</div>}
              <table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001' }}>
                <thead><tr>{['Client','Monthly Deal','× 12 (ARR)',commLabel,'Payout 1','Comm Pay Date','P1 Status','Client 1st Payment',...(isAdmin?['Finance Action']:[]),...(!isLukeView?['Payout 2','P2 Date','P2 Status',...(isAdmin?['Finance Action']:[])]:[]),'Cancellation','Approvals'].map((h,i)=>(<th key={i} style={{ ...th,background:i>=8?'#ede9fe':'#f1f5f9' }}>{h}</th>))}</tr></thead>
                <tbody>
                  {deals.map(d=>{
                    const comm=d.cancelled?(d.recalculated_comm||0):d.comm
                    return(<tr key={d.id} style={{ opacity:d.cancelled?0.75:1,background:d.cancelled?'#fff5f5':'#fff' }}>
                      <td style={{ ...td,fontWeight:700 }}>{d.client}{d.cancelled&&<span style={{ marginLeft:6,padding:'1px 6px',borderRadius:4,fontSize:10,background:'#fee2e2',color:'#991b1b' }}>Cancelled</span>}</td>
                      <td style={{ ...td,fontWeight:700,color:'#0ea5e9' }}>{fmt(d.total)}</td>
                      <td style={{ ...td,color:'#475569' }}>{fmt(d.arr)}</td>
                      <td style={{ ...td,color:accentColor,fontWeight:700 }}>{fmt(comm)}</td>
                      <td style={td}>{fmt(d.p1)}</td>
                      <td style={td}><DateCell deal={d} which='p1_date' disabled={false} /></td>
                      <td style={td}><Badge paid={d.p1_paid} /></td>
                      <td style={td}><PaymentSelect deal={d} /></td>
                      {isAdmin&&<td style={td}><button onClick={()=>toggleP1(d)} style={actionBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5')}>{d.p1_paid?'↩ Unpaid':'✓ Mark Paid'}</button></td>}
                      {!isLukeView&&<>
                        <td style={{ ...td,background:'#faf5ff' }}>{fmt(d.p2)}</td>
                        <td style={{ ...td,background:'#faf5ff' }}><DateCell deal={d} which='p2_date' disabled={!d.p1_paid} /></td>
                        <td style={{ ...td,background:'#faf5ff' }}><Badge paid={d.p2_paid} voided={d.p2_voided} /></td>
                        {isAdmin&&<td style={{ ...td,background:'#faf5ff' }}>{d.p2_voided?<span style={{ fontSize:11,color:'#ef4444',fontWeight:700 }}>Voided</span>:d.p1_paid?<button onClick={()=>toggleP2(d)} style={actionBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5')}>{d.p2_paid?'↩ Unpaid':'✓ Mark Paid'}</button>:<span style={{ fontSize:11,color:'#94a3b8' }}>Locked</span>}</td>}
                      </>}
                      <td style={td}><CancelCellInner deal={d} /></td>
                      <td style={td}><ApprovalCell item={d} table='deals' setter={setDeals} /></td>
                    </tr>)
                  })}
                </tbody>
                <tfoot><tr style={{ background:'#f8fafc' }}>
                  <td style={{ ...td,fontWeight:800 }}>TOTALS</td>
                  <td style={{ ...td,fontWeight:800,color:'#0ea5e9' }}>{fmt(deals.reduce((s,d)=>s+(d.total||0),0))}</td>
                  <td style={{ ...td,fontWeight:800 }}>{fmt(deals.reduce((s,d)=>s+(d.arr||0),0))}</td>
                  <td style={{ ...td,fontWeight:800,color:accentColor }}>{fmt(totalComm)}</td>
                  <td style={{ ...td,fontWeight:700 }}>{fmt(deals.reduce((s,d)=>s+(d.p1||0),0))}</td>
                  <td style={td}></td>
                  <td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700 }}>{fmt(deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                  <td style={td}></td>{isAdmin&&<td style={td}></td>}
                  {!isLukeView&&<>
                    <td style={{ ...td,fontWeight:700,background:'#faf5ff' }}>{fmt(deals.reduce((s,d)=>s+(d.p2||0),0))}</td>
                    <td style={{ background:'#faf5ff' }}></td>
                    <td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700,background:'#faf5ff' }}>{fmt(deals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
                    {isAdmin&&<td style={{ background:'#faf5ff' }}></td>}
                  </>}
                  <td style={td}></td><td style={td}></td>
                </tr></tfoot>
              </table>
            </div>
          )
        )}

        {/* ── DEAL DETAIL ────────────────────────────────────────── */}
        {tab==='detail'&&deals.length>0&&(
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001' }}>
              <thead>
                {isBH&&(<tr><th colSpan={6} style={th}></th><th colSpan={2} style={{ ...th,background:'rgba(14,165,233,0.1)',color:'#0ea5e9',textAlign:'center' }}>Patrol</th><th colSpan={2} style={{ ...th,background:'rgba(139,92,246,0.1)',color:'#8b5cf6',textAlign:'center' }}>Inspect</th><th colSpan={2} style={{ ...th,background:'rgba(245,158,11,0.1)',color:'#f59e0b',textAlign:'center' }}>VM</th><th colSpan={2} style={{ ...th,background:'rgba(16,185,129,0.1)',color:'#10b981',textAlign:'center' }}>iLog</th><th colSpan={7} style={th}></th></tr>)}
                <tr>{isBH?['Month','Client','Deal Type','Quote No','Inception','Invoice','Qty','Rate','Qty','Rate','Qty','Rate','Qty','Rate','Total Lic','Commission','Client 1st Payment','Notes','Cancelled',...(isAdmin?['Actions']:[])].map((h,i)=><th key={i} style={th}>{h}</th>):['Month','Client','Once Off','App Users','Lite Users','Admins','Dashboards','Monthly Total','ARR',commLabel,'Billing Date','Client 1st Payment','Notes','Cancelled',...(isAdmin?['Actions']:[])].map(h=><th key={h} style={th}>{h}</th>)}</tr>
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
                    <td style={{ ...td,fontWeight:700 }}>{fmt(calcBHTotalLic(d))}</td>
                    <td style={{ ...td,color:accentColor,fontWeight:700 }}>{fmt(d.cancelled?d.recalculated_comm:d.comm)}</td>
                    <td style={td}><PaymentSelect deal={d} /></td>
                    <td style={{ ...td,color:'#64748b',fontSize:11 }}>{d.notes||'—'}</td>
                    <td style={td}><CancelCell deal={d} isAdmin={isAdmin} accentColor={accentColor} onUpdate={updateCancellation} /></td>
                    {isAdmin&&<td style={td}><div style={{ display:'flex',gap:4 }}><button onClick={()=>setEditingDeal(d)} style={actionBtn('#1e293b','#e2e8f0')}>✏️ Edit</button><button onClick={()=>deleteDeal(d.id)} style={actionBtn('#991b1b','#fee2e2')}>🗑</button></div></td>}
                  </>:<>
                    <td style={td}>{d.month}</td>
                    <td style={{ ...td,fontWeight:700 }}>{d.client}</td>
                    <td style={td}>{fmt(d.once_off)}</td>
                    <td style={td}>{d.app_users}</td><td style={td}>{d.lite_users}</td>
                    <td style={td}>{d.admin} ({d.free_admin} free)</td>
                    <td style={td}>{d.dashboards}</td>
                    <td style={td}>{fmt(d.total)}</td>
                    <td style={td}>{fmt(d.arr)}</td>
                    <td style={{ ...td,fontWeight:700,color:accentColor }}>{fmt(d.cancelled?d.recalculated_comm:d.comm)}</td>
                    <td style={td}>{d.billing_date}</td>
                    <td style={td}><PaymentSelect deal={d} /></td>
                    <td style={{ ...td,color:'#64748b',fontSize:11 }}>{d.notes}</td>
                    <td style={td}><CancelCellInner deal={d} /></td>
                    {isAdmin&&<td style={td}><div style={{ display:'flex',gap:4 }}><button onClick={()=>setEditingDeal(d)} style={actionBtn('#1e293b','#e2e8f0')}>✏️ Edit</button><button onClick={()=>deleteDeal(d.id)} style={actionBtn('#991b1b','#fee2e2')}>🗑</button></div></td>}
                  </>}
                </tr>))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── REFERRALS ──────────────────────────────────────────── */}
        {tab==='referrals'&&isAdmin&&(
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}><div style={{ fontSize:12,color:'#64748b' }}>25% of monthly contract value — paid after 2nd invoice settled</div><button onClick={()=>setShowAddReferral(!showAddReferral)} style={{ padding:'7px 16px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13 }}>+ Add Referral</button></div>
            {showAddReferral&&(<div style={{ ...card,border:`2px solid ${accentColor}`,marginBottom:16 }}><h3 style={{ margin:'0 0 14px',color:accentColor,fontSize:15 }}>New Referral</h3><div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>{[['Referred By','referred_by','text'],['Client Name','client','text'],['Monthly Fee','mrr','number'],['Date','date','text']].map(([label,key,type])=>(<div key={key}><div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3 }}>{label}</div><input type={type} value={newReferral[key]} onChange={e=>setNewReferral(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box' }} /></div>))}</div>{newReferral.mrr>0&&<div style={{ marginTop:10,fontSize:12,color:accentColor,fontWeight:600 }}>💰 Monthly Fee: <strong>{fmt(newReferral.mrr)}</strong> → 25% Bonus: <strong>{fmt(getReferralBonus(newReferral.mrr))}</strong></div>}<div style={{ marginTop:14,display:'flex',gap:10 }}><button onClick={addReferral} style={{ padding:'8px 18px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Save Referral</button><button onClick={()=>setShowAddReferral(false)} style={{ padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer' }}>Cancel</button></div></div>)}
            {referrals.length===0&&!showAddReferral&&<div style={{ ...card,textAlign:'center',color:'#94a3b8',padding:40 }}>No referrals yet. Click <strong>+ Add Referral</strong> to get started.</div>}
            {referrals.length>0&&(<div style={{ overflowX:'auto' }}><table style={{ width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001' }}><thead><tr>{['Referred By','Client','Monthly Fee','25% Bonus','Date','Status','Approvals','Action',''].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead><tbody>{referrals.map(r=>(<tr key={r.id}><td style={{ ...td,fontWeight:700 }}>{r.referred_by}</td><td style={td}>{r.client}</td><td style={{ ...td,color:'#0ea5e9',fontWeight:700 }}>{fmt(r.mrr)}</td><td style={{ ...td,color:accentColor,fontWeight:700 }}>{fmt(r.bonus)}</td><td style={td}>{r.date}</td><td style={td}><Badge paid={r.paid} /></td><td style={td}><ApprovalCell item={r} table='referrals' setter={setReferrals} /></td><td style={td}><button onClick={()=>toggleReferralPaid(r)} style={{ padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:r.paid?'#fee2e2':'#d1fae5',color:r.paid?'#991b1b':'#065f46' }}>{r.paid?'↩ Unpaid':'✓ Mark Paid'}</button></td><td style={td}><button onClick={()=>deleteReferral(r.id)} style={{ padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:'#fee2e2',color:'#991b1b' }}>🗑</button></td></tr>))}</tbody><tfoot><tr style={{ background:'#f8fafc' }}><td style={{ ...td,fontWeight:800 }} colSpan={2}>TOTALS</td><td style={{ ...td,fontWeight:800,color:'#0ea5e9' }}>{fmt(referrals.reduce((s,r)=>s+r.mrr,0))}</td><td style={{ ...td,fontWeight:800,color:accentColor }}>{fmt(referrals.reduce((s,r)=>s+r.bonus,0))}</td><td style={td}></td><td style={{ ...td,fontSize:11,color:'#10b981',fontWeight:700 }}>{fmt(referrals.reduce((s,r)=>s+(r.paid?r.bonus:0),0))} paid</td><td style={td}></td><td style={td}></td><td style={td}></td></tr></tfoot></table></div>)}
          </div>
        )}

      </div>
    </div>
  )
}
