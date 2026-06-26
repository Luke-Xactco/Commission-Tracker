import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const fmt = (n) => `R ${Number(n||0).toLocaleString('en-ZA',{minimumFractionDigits:0,maximumFractionDigits:0})}`
const MONTHS = ['Nov-24','Dec-24','Jan-25','Feb-25','Mar-25','Apr-25','May-25','Jun-25','Jul-25','Aug-25','Sept-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26','Aug-26','Sept-26','Oct-26','Nov-26','Dec-26','Jan-27','Feb-27','Mar-27','Apr-27','May-27','Jun-27']
const getP2Month = (p1) => { const i=MONTHS.indexOf(p1); return i!==-1&&MONTHS[i+6]?MONTHS[i+6]:'' }
const COMPANY_COLORS = { xactco:'#6366f1', bloodhound:'#ef4444' }
const LUKE_ID    = 'f3b67113-e524-403e-9191-f3b0621e46a3'
const BERNARD_ID = 'bc508a11-e937-46a6-acc2-fd7c8e575767'
const ROMAINE_ID = '294f7939-a6c5-40ce-ad6e-1631f243ecd5'
const APPROVERS  = [
  {id:LUKE_ID,    name:'Luke',    key:'approved_luke'   },
  {id:BERNARD_ID, name:'Bernard', key:'approved_bernard'},
  {id:ROMAINE_ID, name:'Romaine', key:'approved_romaine'},
]
const getReferralBonus = (mrr) => Math.round(mrr*0.25)
const calcBHTotalLic   = (d)   => (d.patrol_qty||0)*(d.patrol_rate||0)+(d.inspect_qty||0)*(d.inspect_rate||0)+(d.vm_qty||0)*(d.vm_rate||0)+(d.ilog_qty||0)*(d.ilog_rate||0)
const calcBHComm       = (total,dealType) => dealType==='upsell'?Math.round(total*12*0.04):Math.round(total*12*0.08)
const isExistingClient = (inception,month) => {
  if(!inception||!month) return false
  const ii=MONTHS.indexOf(inception), di=MONTHS.indexOf(month)
  return ii!==-1&&di!==-1&&(di-ii)>=12
}

const calcDealFinancials = (deal, company, salespersonId) => {
  if(company==='bloodhound'){
    const total    = calcBHTotalLic(deal)
    const dealType = deal.deal_type||(isExistingClient(deal.inception_date,deal.month)?'upsell':'new')
    const isUpsell = dealType==='upsell'
    const arr      = total*12
    const comm     = calcBHComm(total,dealType)
    const p1       = isUpsell?comm:Math.round(comm/2)
    const p2       = isUpsell?0:Math.round(comm/2)
    const p2_date  = isUpsell?'':getP2Month(deal.p1_date)
    return {total,arr,comm,p1,p2,p2_date,deal_type:dealType,p2_voided:isUpsell}
  } else {
    const total  = (deal.app_users*deal.a_user_cost)+(deal.lite_users*(deal.l_user_cost||0))+Math.max(0,deal.admin-deal.free_admin)*deal.admin_cost+(deal.dashboards*deal.dash_cost)
    const arr    = total*12
    const isLuke = salespersonId===LUKE_ID
    const comm   = isLuke?total:arr*0.08
    const p1     = isLuke?total:comm/2
    const p2     = isLuke?0:comm/2
    const p2_date= isLuke?'':getP2Month(deal.p1_date)
    return {total,arr,comm,p1,p2,p2_date,deal_type:'new',p2_voided:false}
  }
}

const BLANK_XACTCO = {month:'Jan-26',client:'',once_off:0,app_users:0,lite_users:0,a_user_cost:950,l_user_cost:0,admin:1,free_admin:0,admin_cost:1000,dashboards:0,dash_cost:0,billing_date:'',p1_date:'',notes:'',first_payment_received:'TBC',inception_date:'',quote_no:''}
const BLANK_BH     = {month:'Jan-26',client:'',patrol_qty:0,patrol_rate:0,inspect_qty:0,inspect_rate:0,vm_qty:0,vm_rate:0,ilog_qty:0,ilog_rate:0,invoice_total:0,quote_no:'',inception_date:'',p1_date:'',billing_date:'',notes:'',first_payment_received:'TBC',deal_type:'new'}
const BLANK_REF    = {referred_by:'',client:'',mrr:0,date:'',paid:false}

const exportToExcel = async (deals,referrals,name,isLukeView,company) => {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
  const fmtN = (n) => Number(n||0)
  const isBHX = company==='bloodhound'
  const ph = isBHX
    ?['Client','Month','Deal Type','Patrol Qty','Patrol Rate','Inspect Qty','Inspect Rate','VM Qty','VM Rate','iLog Qty','iLog Rate','Total Lic','Invoice Total','Commission','Payout 1','Comm Pay Date','P1 Status','Client 1st Payment','Payout 2','P2 Date','P2 Status','Quote No','Inception','Cancelled','Cancellation Date','Notes']
    :['Client','Monthly Deal','ARR','Commission','Payout 1','P1 Date','P1 Status','1st Payment',...(!isLukeView?['Payout 2','P2 Date','P2 Status']:[]),'Cancelled','Cancellation Date']
  const pr = deals.map(d=>isBHX?[
    d.client,d.month,d.deal_type==='upsell'?'Upsell (4%)':'New Client (8%)',
    d.patrol_qty||0,d.patrol_rate||0,d.inspect_qty||0,d.inspect_rate||0,d.vm_qty||0,d.vm_rate||0,d.ilog_qty||0,d.ilog_rate||0,
    fmtN(calcBHTotalLic(d)),fmtN(d.invoice_total),fmtN(d.comm),
    fmtN(d.p1),d.p1_date||'',d.p1_paid?'PAID':'PENDING',d.first_payment_received||'TBC',
    fmtN(d.p2),d.p2_date||'',d.p2_voided?'VOIDED':d.p2_paid?'PAID':'PENDING',
    d.quote_no||'',d.inception_date||'',d.cancelled?'Yes':'No',d.cancellation_date||'',d.notes||''
  ]:[
    d.client,fmtN(d.total),fmtN(d.arr),fmtN(d.comm),
    fmtN(d.p1),d.p1_date||'',d.p1_paid?'PAID':'PENDING',d.first_payment_received||'TBC',
    ...(!isLukeView?[fmtN(d.p2),d.p2_date||'',d.p2_voided?'VOIDED':d.p2_paid?'PAID':'PENDING']:[]),
    d.cancelled?'Yes':'No',d.cancellation_date||''
  ])
  const rh = ['Referred By','Client','Monthly Fee','25% Bonus','Date','Status']
  const rr = referrals.map(r=>[r.referred_by,r.client,fmtN(r.mrr),fmtN(r.bonus),r.date||'',r.paid?'PAID':'PENDING'])
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.aoa_to_sheet([ph,...pr])
  ws1['!cols'] = ph.map(h=>({wch:Math.max(h.length+2,12)}))
  XLSX.utils.book_append_sheet(wb,ws1,'Payout Summary')
  const ws2 = XLSX.utils.aoa_to_sheet([rh,...rr])
  ws2['!cols'] = rh.map(h=>({wch:Math.max(h.length+2,14)}))
  XLSX.utils.book_append_sheet(wb,ws2,'Referrals')
  XLSX.writeFile(wb,`${name}_Commission_${new Date().toLocaleDateString('en-ZA').replace(/\//g,'-')}.xlsx`)
}

const Badge = ({paid,voided}) => {
  if(voided) return <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:'#fee2e2',color:'#991b1b'}}>VOIDED</span>
  return <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:paid?'#d1fae5':'#fef3c7',color:paid?'#065f46':'#92400e'}}>{paid?'PAID':'PENDING'}</span>
}
const PaymentBadge = ({val}) => {
  const c={Yes:['#d1fae5','#065f46'],No:['#fee2e2','#991b1b'],TBC:['#fef3c7','#92400e']}
  const [bg,col]=c[val]||c.TBC
  return <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:bg,color:col}}>{val||'TBC'}</span>
}
const StatCard = ({label,value,color,sub}) => (
  <div style={{background:'#fff',borderRadius:12,padding:'16px 20px',borderTop:`4px solid ${color}`,boxShadow:'0 1px 4px #0001'}}>
    <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginBottom:4}}>{label}</div>
    <div style={{fontSize:20,fontWeight:800,color}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{sub}</div>}
  </div>
)

function Login() {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const handleLogin = async () => {
    setLoading(true);setError('')
    const{error}=await supabase.auth.signInWithPassword({email,password})
    if(error)setError(error.message)
    setLoading(false)
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,padding:40,width:360,boxShadow:'0 4px 24px #0001'}}>
        <h1 style={{margin:'0 0 6px',fontSize:22,fontWeight:800,color:'#1e293b'}}>Commission Tracker</h1>
        <p style={{margin:'0 0 28px',color:'#64748b',fontSize:13}}>Sign in to your account</p>
        <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4}}>Email</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,boxSizing:'border-box'}}/></div>
        <div style={{marginBottom:20}}><div style={{fontSize:12,fontWeight:600,color:'#475569',marginBottom:4}}>Password</div><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:14,boxSizing:'border-box'}}/></div>
        {error&&<div style={{color:'#ef4444',fontSize:13,marginBottom:14}}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:'100%',padding:'11px',background:'#6366f1',color:'#fff',border:'none',borderRadius:8,fontWeight:700,fontSize:15,cursor:'pointer'}}>{loading?'Signing in...':'Sign In'}</button>
      </div>
    </div>
  )
}

const CancelCell = ({deal,isAdmin,accentColor,onUpdate,company}) => {
  const [open,setOpen]=useState(false)
  const [date,setDate]=useState(deal.cancellation_date||'')
  const [months,setMonths]=useState(deal.active_months||'')
  if(deal.cancelled){
    const commPerMonth=(deal.comm||0)/12
    const activeMths=parseInt(deal.active_months)||0
    const paidOut=(deal.p1_paid?deal.p1:0)+(deal.p2_paid?deal.p2:0)
    const earned=Math.round(commPerMonth*activeMths)
    const diff=earned-paidOut
    const isClawback=diff<0
    return(
      <div>
        <span style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,background:'#fee2e2',color:'#991b1b'}}>Cancelled</span>
        <div style={{fontSize:10,color:'#64748b',marginTop:2}}>{deal.cancellation_date} · {deal.active_months}m</div>
        {diff!==0&&<div style={{fontSize:11,fontWeight:700,color:isClawback?'#ef4444':'#10b981',marginTop:2}}>{isClawback?`Clawback: ${fmt(Math.abs(diff))}`:`Still owed: ${fmt(diff)}`}</div>}
        {isAdmin&&diff!==0&&!deal.clawback_settled&&(
          <button onClick={e=>{e.stopPropagation();onUpdate(deal.id,true,deal.cancellation_date,deal.active_months,true)}} style={{marginTop:4,padding:'2px 8px',fontSize:10,borderRadius:6,border:'none',cursor:'pointer',background:isClawback?'#fee2e2':'#d1fae5',color:isClawback?'#991b1b':'#065f46',fontWeight:700}}>
            {isClawback?'Clawback Recovered':'Mark Paid'}
          </button>
        )}
        {deal.clawback_settled&&<div style={{fontSize:10,color:'#10b981',fontWeight:700,marginTop:2}}>Settled</div>}
        {isAdmin&&<button onClick={e=>{e.stopPropagation();onUpdate(deal.id,false,'',0,false)}} style={{marginTop:4,padding:'2px 8px',fontSize:10,borderRadius:6,border:'none',cursor:'pointer',background:'#e2e8f0',color:'#475569',display:'block'}}>Undo</button>}
      </div>
    )
  }
  if(!isAdmin)return <span style={{color:'#94a3b8',fontSize:11}}>—</span>
  if(open)return(
    <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:150}} onClick={e=>e.stopPropagation()}>
      <select value={date} onChange={e=>setDate(e.target.value)} style={{padding:'3px 6px',borderRadius:5,border:'1px solid #cbd5e1',fontSize:11}}>
        <option value=''>— cancel month —</option>
        {MONTHS.map(m=><option key={m}>{m}</option>)}
      </select>
      <input type="number" placeholder="Active months" value={months} onChange={e=>setMonths(e.target.value)} style={{padding:'3px 6px',borderRadius:5,border:'1px solid #cbd5e1',fontSize:11}}/>
      <div style={{display:'flex',gap:4}}>
        <button onClick={e=>{e.stopPropagation();onUpdate(deal.id,true,date,parseInt(months)||0,false);setOpen(false)}} style={{padding:'3px 8px',fontSize:11,borderRadius:5,border:'none',cursor:'pointer',background:'#ef4444',color:'#fff',fontWeight:700}}>Save</button>
        <button onClick={e=>{e.stopPropagation();setOpen(false)}} style={{padding:'3px 8px',fontSize:11,borderRadius:5,border:'none',cursor:'pointer',background:'#e2e8f0',color:'#475569'}}>Cancel</button>
      </div>
    </div>
  )
  return <button onClick={e=>{e.stopPropagation();setOpen(true)}} style={{padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:'#fee2e2',color:'#991b1b'}}>Mark Cancelled</button>
}

export default function App() {
  const [session,setSession]       = useState(null)
  const [profile,setProfile]       = useState(null)
  const [deals,setDeals]           = useState([])
  const [allDeals,setAllDeals]     = useState([])
  const [profiles,setProfiles]     = useState([])
  const [referrals,setReferrals]   = useState([])
  const [company,setCompany]       = useState('xactco')
  const [selectedSP,setSelectedSP] = useState(null)
  const [tab,setTab]               = useState('summary')
  const [showAdd,setShowAdd]       = useState(false)
  const [showAddRef,setShowAddRef] = useState(false)
  const [newDeal,setNewDeal]       = useState(BLANK_XACTCO)
  const [newRef,setNewRef]         = useState(BLANK_REF)
  const [editingDate,setEditingDate] = useState(null)
  const [editingDeal,setEditingDeal] = useState(null)
  const [loading,setLoading]       = useState(true)
  const [search,setSearch]         = useState('')
  const [payMonth,setPayMonth]     = useState('Jan-26')

  const isBH = (profile?.role==='admin'||profile?.role==='manager')?company==='bloodhound':profile?.company==='bloodhound'

  useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>setSession(session));supabase.auth.onAuthStateChange((_e,s)=>setSession(s))},[])
  useEffect(()=>{if(!session){setLoading(false);return};loadProfile()},[session])
  useEffect(()=>{if(!profile)return;if(profile.role==='admin'||profile.role==='manager'){loadAllProfiles();loadAllDeals()}else loadDeals(profile.id)},[profile,company])
  useEffect(()=>{if(selectedSP)loadDeals(selectedSP.id)},[selectedSP])

  const loadProfile = async () => {
    const{data}=await supabase.from('profiles').select('*').eq('id',session.user.id).single()
    setProfile(data)
    if(data?.company==='bloodhound'){setCompany('bloodhound');setNewDeal(BLANK_BH)}
    setLoading(false)
  }
  const loadAllProfiles = async () => {
    const{data}=await supabase.from('profiles').select('*').eq('company',company)
    const sps=(data||[]).filter(p=>p.role==='salesperson'||p.role==='admin')
    setProfiles(sps)
    if(sps.length&&!selectedSP)setSelectedSP(sps[0])
  }
  const loadDeals = async (spId) => {
    const{data}=await supabase.from('deals').select('*').eq('salesperson_id',spId).eq('company',company).order('created_at')
    const sorted=(data||[]).sort((a,b)=>MONTHS.indexOf(a.p1_date)-MONTHS.indexOf(b.p1_date))
    setDeals(sorted)
    loadReferrals(spId)
  }
  const loadAllDeals = async () => {
    const{data}=await supabase.from('deals').select('*').eq('company',company)
    setAllDeals(data||[])
  }
  const loadReferrals = async (spId) => {
    const{data}=await supabase.from('referrals').select('*').eq('salesperson_id',spId).eq('company',company).order('created_at')
    setReferrals(data||[])
  }

  const patchDeals = (id,updates) => {
    setDeals(prev=>prev.map(d=>d.id===id?{...d,...updates}:d))
    setAllDeals(prev=>prev.map(d=>d.id===id?{...d,...updates}:d))
  }

  const toggleP1 = async (deal) => {
    const nowPaid=!deal.p1_paid
    const p2_date=nowPaid?getP2Month(deal.p1_date):deal.p2_date
    const updates={p1_paid:nowPaid,p1_paid_date:nowPaid?new Date().toLocaleDateString('en-ZA'):null,p2_date}
    const{error}=await supabase.from('deals').update(updates).eq('id',deal.id)
    if(error){alert('Error: '+error.message);return}
    await loadDeals(selectedSP?.id||profile.id)
    await loadAllDeals()
  }

  const toggleP2 = async (deal) => {
    const updates={p2_paid:!deal.p2_paid}
    const{error}=await supabase.from('deals').update(updates).eq('id',deal.id)
    if(error){alert('Error: '+error.message);return}
    await loadDeals(selectedSP?.id||profile.id)
    await loadAllDeals()
  }

  const updateDate = async (deal,which,val) => {
    const updates={[which]:val}
    if(which==='p1_date'&&!deal.p2_paid)updates.p2_date=getP2Month(val)
    await supabase.from('deals').update(updates).eq('id',deal.id)
    setEditingDate(null)
    await loadDeals(selectedSP?.id||profile.id)
  }

  const updatePaymentStatus = async (id,val) => {
    await supabase.from('deals').update({first_payment_received:val}).eq('id',id)
    await loadDeals(selectedSP?.id||profile.id)
  }

  const toggleApproval = async (id,key,table,setter) => {
    const src=table==='deals'?deals:referrals
    const item=src.find(x=>x.id===id)
    if(!item)return
    const updates={[key]:!item[key]}
    await supabase.from(table).update(updates).eq('id',id)
    if(table==='deals'){
      await loadDeals(selectedSP?.id||profile.id)
      await loadAllDeals()
    } else {
      setter(prev=>prev.map(x=>x.id===id?{...x,...updates}:x))
    }
  }

  const updateCancellation = async (id,cancelled,cancellation_date,active_months,clawback_settled) => {
    const deal=deals.find(d=>d.id===id)
    if(!deal)return
    const commPerMonth=(deal.comm||0)/12
    const paidOut=(deal.p1_paid?deal.p1:0)+(deal.p2_paid?deal.p2:0)
    const earned=cancelled?Math.round(commPerMonth*(parseInt(active_months)||0)):deal.comm
    const diff=earned-paidOut
    const updates={cancelled,cancellation_date,active_months,recalculated_comm:cancelled?earned:0,p2_voided:cancelled&&!deal.p2_paid,clawback_settled:clawback_settled||false,clawback_amount:diff}
    await supabase.from('deals').update(updates).eq('id',id)
    await loadDeals(selectedSP?.id||profile.id)
    await loadAllDeals()
  }

  const addDeal = async () => {
    if(!newDeal.client||!newDeal.p1_date)return alert('Please fill in Client and P1 Date')
    const spId   =(profile.role==='admin'||profile.role==='manager')?(selectedSP?.id||profile.id):profile.id
    const spComp =(profile.role==='admin'||profile.role==='manager')?company:profile.company
    const result = calcDealFinancials(newDeal,spComp,spId)
    const{error}=await supabase.from('deals').insert([{
      ...newDeal,salesperson_id:spId,company:spComp,
      total:result.total,arr:result.arr,comm:result.comm,p1:result.p1,p2:result.p2,
      p2_date:result.p2_date,deal_type:result.deal_type,p2_voided:result.p2_voided,
      p1_paid:false,p2_paid:false,approved_luke:false,approved_bernard:false,approved_romaine:false,
      cancelled:false,clawback_settled:false,clawback_amount:0
    }])
    if(error){alert('Error saving: '+error.message);return}
    setShowAdd(false);setNewDeal(spComp==='bloodhound'?BLANK_BH:BLANK_XACTCO)
    loadDeals(spId);loadAllDeals()
  }

  const deleteDeal = async (id) => {
    if(!window.confirm('Delete this deal?'))return
    await supabase.from('deals').delete().eq('id',id)
    setDeals(prev=>prev.filter(d=>d.id!==id))
    setAllDeals(prev=>prev.filter(d=>d.id!==id))
  }

  const saveEditedDeal = async () => {
    if(!editingDeal)return
    const result=calcDealFinancials(editingDeal,isBH?'bloodhound':'xactco',editingDeal.salesperson_id)
    await supabase.from('deals').update({...editingDeal,total:result.total,arr:result.arr,comm:result.comm,p1:result.p1,p2:result.p2,deal_type:result.deal_type,p2_voided:result.p2_voided}).eq('id',editingDeal.id)
    setEditingDeal(null);loadDeals(selectedSP?.id||profile.id);loadAllDeals()
  }

  const addReferral = async () => {
    if(!newRef.referred_by||!newRef.client||!newRef.mrr)return
    const spId=(profile.role==='admin'||profile.role==='manager')?selectedSP?.id:profile.id
    const bonus=getReferralBonus(newRef.mrr)
    await supabase.from('referrals').insert([{...newRef,salesperson_id:spId,company,bonus,paid:false,approved_luke:false,approved_bernard:false,approved_romaine:false}])
    setShowAddRef(false);setNewRef(BLANK_REF);loadReferrals(spId)
  }
  const toggleRefPaid = async (r) => {
    const u={paid:!r.paid};await supabase.from('referrals').update(u).eq('id',r.id)
    setReferrals(prev=>prev.map(x=>x.id===r.id?{...x,...u}:x))
  }
  const deleteRef = async (id) => {
    if(!window.confirm('Delete?'))return
    await supabase.from('referrals').delete().eq('id',id)
    setReferrals(prev=>prev.filter(r=>r.id!==id))
  }
  const signOut = () => supabase.auth.signOut()

  if(!session)return <Login/>
  if(loading)return <div style={{padding:40,textAlign:'center',color:'#64748b',fontFamily:"'Segoe UI',sans-serif"}}>Loading...</div>

  const isAdmin    = profile?.role==='admin'||profile?.role==='manager'
  const isLukeView = !isBH&&(selectedSP?.id===LUKE_ID||(!isAdmin&&profile?.id===LUKE_ID))
  const accentColor= isBH?'#ef4444':(selectedSP?.color||profile?.color||'#6366f1')
  const displayName= isAdmin?selectedSP?.name:profile?.name
  const commLabel  = isLukeView?'Commission':'8% Comm'

  const isCompleted = (d) => d.deal_type==='upsell'?d.p1_paid:(d.p1_paid&&(d.p2_paid||d.p2_voided))
  const activeDeals    = deals.filter(d=>!isCompleted(d))
  const completedDeals = deals.filter(d=>isCompleted(d))
  const sortedActive   = [
    ...activeDeals.filter(d=>d.p1_paid).sort((a,b)=>MONTHS.indexOf(a.p1_date)-MONTHS.indexOf(b.p1_date)),
    ...activeDeals.filter(d=>!d.p1_paid).sort((a,b)=>MONTHS.indexOf(a.p1_date)-MONTHS.indexOf(b.p1_date)),
  ]
  const filterD = (ds) => search?ds.filter(d=>d.client?.toLowerCase().includes(search.toLowerCase())):ds
  const newDeals     = filterD(sortedActive).filter(d=>(d.deal_type||'new')==='new')
  const upsellDeals  = filterD(sortedActive).filter(d=>d.deal_type==='upsell')
  const compNewDeals = filterD(completedDeals).filter(d=>(d.deal_type||'new')==='new')
  const compUpDeals  = filterD(completedDeals).filter(d=>d.deal_type==='upsell')

  const totalComm     = deals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
  const totalPaid     = deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)
  const totalClawback = deals.filter(d=>d.cancelled&&(d.clawback_amount||0)<0&&!d.clawback_settled).reduce((s,d)=>s+Math.abs(d.clawback_amount||0),0)
  const netComm       = totalComm - totalClawback
  const totalPending  = netComm - totalPaid

  const css  = {fontFamily:"'Segoe UI',sans-serif",background:'#f8fafc',minHeight:'100vh',padding:20}
  const card = {background:'#fff',borderRadius:12,padding:20,marginBottom:16,boxShadow:'0 1px 4px #0001'}
  const th   = {padding:'8px 10px',background:'#f1f5f9',fontSize:11,fontWeight:700,color:'#475569',textAlign:'left',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}
  const td   = {padding:'8px 10px',fontSize:12,color:'#1e293b',borderBottom:'1px solid #f1f5f9',verticalAlign:'middle'}
  const tBtn = (t)=>({padding:'8px 18px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,background:tab===t?accentColor:'#e2e8f0',color:tab===t?'#fff':'#475569',whiteSpace:'nowrap'})
  const aBtn = (color,bg)=>({padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:bg,color,whiteSpace:'nowrap'})

  const CC = ({deal}) => <CancelCell deal={deal} isAdmin={isAdmin} accentColor={accentColor} onUpdate={updateCancellation} company={isBH?'bloodhound':'xactco'}/>

  const ApprCell = ({item,table,setter}) => (
    <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
      {APPROVERS.map(a=>{
        const approved=item[a.key]; const can=profile?.id===a.id
        return <button key={a.id} onClick={can?e=>{e.stopPropagation();toggleApproval(item.id,a.key,table,setter)}:undefined}
          style={{padding:'2px 6px',borderRadius:10,fontSize:10,fontWeight:700,border:'none',cursor:can?'pointer':'default',background:approved?'#d1fae5':'#f1f5f9',color:approved?'#065f46':'#94a3b8'}}>
          {approved?'✅':'⬜'} {a.name}
        </button>
      })}
    </div>
  )

  const DateCell = ({deal,which,disabled}) => {
    const isE=editingDate?.id===deal.id&&editingDate?.which===which; const val=deal[which]
    if(disabled)return <span style={{color:'#94a3b8',fontSize:11}}>Set when P1 paid</span>
    if(isE)return(
      <div style={{display:'flex',alignItems:'center',gap:4}} onClick={e=>e.stopPropagation()}>
        <select autoFocus defaultValue={val} onChange={e=>updateDate(deal,which,e.target.value)} style={{padding:'3px 6px',borderRadius:5,border:`1px solid ${accentColor}`,fontSize:11}}>
          {MONTHS.map(m=><option key={m}>{m}</option>)}
        </select>
        <button onClick={e=>{e.stopPropagation();setEditingDate(null)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#94a3b8'}}>✕</button>
      </div>
    )
    const canEdit=isAdmin&&!deal[which==='p1_date'?'p1_paid':'p2_paid']
    return(
      <div style={{display:'flex',alignItems:'center',gap:4}}>
        <span>{val||'—'}</span>
        {canEdit&&<button onClick={e=>{e.stopPropagation();setEditingDate({id:deal.id,which})}} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:accentColor,padding:0}}>✏️</button>}
        {which==='p1_date'&&deal.p1_paid&&deal.p1_paid_date&&<span style={{fontSize:10,color:'#10b981',display:'block'}}>paid {deal.p1_paid_date}</span>}
      </div>
    )
  }

  const PaySel = ({deal}) => (
    isAdmin
      ?<select value={deal.first_payment_received||'TBC'} onChange={e=>updatePaymentStatus(deal.id,e.target.value)} onClick={e=>e.stopPropagation()}
          style={{padding:'3px 7px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:11,fontWeight:700,cursor:'pointer',
            background:deal.first_payment_received==='Yes'?'#d1fae5':deal.first_payment_received==='No'?'#fee2e2':'#fef3c7',
            color:deal.first_payment_received==='Yes'?'#065f46':deal.first_payment_received==='No'?'#991b1b':'#92400e'}}>
          <option>TBC</option><option>Yes</option><option>No</option>
        </select>
      :<PaymentBadge val={deal.first_payment_received}/>
  )

  const EditModal = () => {
    if(!editingDeal)return null
    const fields=isBH
      ?[['Month','month','select'],['Client','client','text'],['Deal Type','deal_type','dtype'],['Patrol Qty','patrol_qty','number'],['Patrol Rate','patrol_rate','number'],['Inspect Qty','inspect_qty','number'],['Inspect Rate','inspect_rate','number'],['VM Qty','vm_qty','number'],['VM Rate','vm_rate','number'],['iLog Qty','ilog_qty','number'],['iLog Rate','ilog_rate','number'],['Invoice Total','invoice_total','number'],['Quote No','quote_no','text'],['Inception Date','inception_date','select'],['P1 Date','p1_date','select'],['Billing Date','billing_date','text'],['Notes','notes','text']]
      :[['Month','month','select'],['Client','client','text'],['Once Off','once_off','number'],['App Users','app_users','number'],['Lite Users','lite_users','number'],['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],['Dashboards','dashboards','number'],['Dash Cost','dash_cost','number'],['Billing Date','billing_date','text'],['P1 Date','p1_date','select'],['Quote No','quote_no','text'],['Inception Date','inception_date','select'],['Notes','notes','text']]
    return(
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0008',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setEditingDeal(null)}>
        <div style={{background:'#fff',borderRadius:16,padding:28,width:740,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 8px 32px #0003'}} onClick={e=>e.stopPropagation()}>
          <h3 style={{margin:'0 0 16px',color:accentColor,fontSize:15}}>Edit Deal — {editingDeal.client}</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {fields.map(([label,key,type])=>(
              <div key={key}>
                <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3}}>{label}</div>
                {type==='select'?<select value={editingDeal[key]||''} onChange={e=>setEditingDeal(p=>({...p,[key]:e.target.value}))} style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12}}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>
                :type==='dtype'?<select value={editingDeal[key]||'new'} onChange={e=>setEditingDeal(p=>({...p,[key]:e.target.value}))} style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12}}><option value='new'>New Business (8%)</option><option value='upsell'>Existing Client (4%)</option></select>
                :<input type={type} value={editingDeal[key]||''} onChange={e=>setEditingDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box'}}/>}
              </div>
            ))}
          </div>
          <div style={{marginTop:16,display:'flex',gap:10}}>
            <button onClick={saveEditedDeal} style={{padding:'8px 18px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Save Changes</button>
            <button onClick={()=>setEditingDeal(null)} style={{padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  const BHSection = ({sectionDeals,type}) => {
    if(!sectionDeals.length)return null
    const isU=type==='upsell'
    const sComm=sectionDeals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
    const sPaid=sectionDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)
    const col=isU?'#f59e0b':'#ef4444', bgC=isU?'rgba(245,158,11,0.06)':'rgba(239,68,68,0.06)'
    const bdrC=isU?'rgba(245,158,11,0.25)':'rgba(239,68,68,0.25)', txtC=isU?'#92400e':'#991b1b'
    const bth={...th,padding:'7px 8px',fontSize:11}, btd={...td,padding:'7px 8px',fontSize:11}, p2bg={background:'#faf5ff'}
    const hdrs=['Client','Month','Monthly Deal','× 12 (ARR)',isU?'Total Comm (4%)':'Total Comm (8%)','Payout 1','Comm Pay Date',isU?'Status':'P1 Status','Client 1st Payment',...(isAdmin?['Finance Action']:[]),...(!isU?['Payout 2','P2 Date','P2 Status',...(isAdmin?['Finance Action']:[])]:[]),'Cancellation','Approvals']
    const p2i=hdrs.indexOf('P2 Date')
    return(
      <div style={{marginBottom:24,borderRadius:10,overflow:'hidden',border:`0.5px solid ${bdrC}`,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        <div style={{padding:'10px 16px',background:bgC,borderBottom:`0.5px solid ${bdrC}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:col}}></div>
            <span style={{color:txtC,fontSize:14,fontWeight:700}}>{isU?'Existing Client Upsell':'New Business'}</span>
            <span style={{fontSize:11,color:'#64748b'}}>{isU?'4% of ARR · Once-off · No clawback':'8% of ARR · Split 50/50 · P1 month 2, P2 month 7'}</span>
          </div>
          <div style={{fontSize:13,color:txtC,fontWeight:700}}>Commission: {fmt(sComm)} · Paid: {fmt(sPaid)}</div>
        </div>
        <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
          <table style={{width:'100%',borderCollapse:'collapse',background:'#fff'}}>
            <thead><tr>{hdrs.map((h,i)=><th key={i} style={{...bth,background:!isU&&p2i!==-1&&i>=p2i&&h!=='Cancellation'&&h!=='Approvals'?'rgba(99,102,241,0.06)':bth.background}}>{h}</th>)}</tr></thead>
            <tbody>
              {sectionDeals.map(d=>{
                const lic=calcBHTotalLic(d), arr=lic*12
                const comm=d.cancelled?(d.recalculated_comm||0):d.comm
                return(
                  <tr key={d.id} style={{opacity:d.cancelled?0.75:1,background:d.cancelled?'#fff5f5':d.p1_paid?'#f0fdf4':'#fff'}}>
                    <td style={{...btd,fontWeight:700}}>
                      <div>{d.client}</div>
                      {d.cancelled&&<span style={{padding:'1px 5px',borderRadius:4,fontSize:10,background:'#fee2e2',color:'#991b1b'}}>Cancelled</span>}
                      {d.p1_paid&&<span style={{fontSize:10,color:'#10b981'}}>P1 paid</span>}
                    </td>
                    <td style={{...btd,whiteSpace:'nowrap'}}>{d.month}</td>
                    <td style={{...btd,fontWeight:700,color:'#0ea5e9',whiteSpace:'nowrap'}}>{fmt(lic)}</td>
                    <td style={{...btd,color:'#475569',whiteSpace:'nowrap'}}>{fmt(arr)}</td>
                    <td style={{...btd,color:col,fontWeight:700,whiteSpace:'nowrap'}}>{fmt(comm)}</td>
                    <td style={{...btd,whiteSpace:'nowrap'}}>{fmt(d.p1)}</td>
                    <td style={{...btd,whiteSpace:'nowrap'}}><DateCell deal={d} which='p1_date' disabled={false}/></td>
                    <td style={btd}><Badge paid={d.p1_paid}/></td>
                    <td style={btd}><PaySel deal={d}/></td>
                    {isAdmin&&<td style={btd}><button onClick={e=>{e.stopPropagation();toggleP1(d)}} style={{...aBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5'),fontSize:10,padding:'3px 7px'}}>{d.p1_paid?'↩ Unpaid':'✓ P1 Paid'}</button></td>}
                    {!isU&&<>
                      <td style={{...btd,...p2bg,whiteSpace:'nowrap'}}>{fmt(d.p2)}</td>
                      <td style={{...btd,...p2bg,whiteSpace:'nowrap'}}><DateCell deal={d} which='p2_date' disabled={!d.p1_paid}/></td>
                      <td style={{...btd,...p2bg}}><Badge paid={d.p2_paid} voided={d.p2_voided}/></td>
                      {isAdmin&&<td style={{...btd,...p2bg}}>
                        {d.p2_voided?<span style={{fontSize:10,color:'#ef4444',fontWeight:700}}>Voided</span>
                          :d.p1_paid?<button onClick={e=>{e.stopPropagation();toggleP2(d)}} style={{...aBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5'),fontSize:10,padding:'3px 7px'}}>{d.p2_paid?'↩ Unpaid':'✓ P2 Paid'}</button>
                          :<span style={{fontSize:10,color:'#94a3b8'}}>Locked</span>}
                      </td>}
                    </>}
                    <td style={btd}><CC deal={d}/></td>
                    <td style={btd}><ApprCell item={d} table='deals' setter={setDeals}/></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{background:'#f8fafc'}}>
                <td style={{...btd,fontWeight:800}} colSpan={2}>TOTALS</td>
                <td style={{...btd,fontWeight:800,color:'#0ea5e9'}}>{fmt(sectionDeals.reduce((s,d)=>s+calcBHTotalLic(d),0))}</td>
                <td style={{...btd,fontWeight:800,color:'#475569'}}>{fmt(sectionDeals.reduce((s,d)=>s+calcBHTotalLic(d)*12,0))}</td>
                <td style={{...btd,fontWeight:800,color:col}}>{fmt(sComm)}</td>
                <td style={{...btd,fontWeight:700}}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p1||0),0))}</td>
                <td style={btd}></td>
                <td style={{...btd,color:'#10b981',fontWeight:700}}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                <td style={btd}></td>{isAdmin&&<td style={btd}></td>}
                {!isU&&<>
                  <td style={{...btd,...p2bg,fontWeight:700}}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p2||0),0))}</td>
                  <td style={{...btd,...p2bg}}></td>
                  <td style={{...btd,...p2bg,color:'#10b981',fontWeight:700}}>{fmt(sectionDeals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
                  {isAdmin&&<td style={{...btd,...p2bg}}></td>}
                </>}
                <td style={btd}></td><td style={btd}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  const XactcoTable = ({tDeals}) => {
    if(!tDeals.length)return null
    return(
      <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001'}}>
          <thead><tr>{['Client','Monthly Deal','× 12 (ARR)',commLabel,'Payout 1','Comm Pay Date','P1 Status','Client 1st Payment',...(isAdmin?['Finance Action']:[]),...(!isLukeView?['Payout 2','P2 Date','P2 Status',...(isAdmin?['Finance Action']:[])]:[]),'Cancellation','Approvals'].map((h,i)=><th key={i} style={{...th,background:i>=8?'#ede9fe':'#f1f5f9'}}>{h}</th>)}</tr></thead>
          <tbody>
            {tDeals.map(d=>{
              const comm=d.cancelled?(d.recalculated_comm||0):d.comm
              return(
                <tr key={d.id} style={{opacity:d.cancelled?0.75:1,background:d.cancelled?'#fff5f5':d.p1_paid?'#f0fdf4':'#fff'}}>
                  <td style={{...td,fontWeight:700}}>
                    {d.client}
                    {d.cancelled&&<span style={{marginLeft:6,padding:'1px 6px',borderRadius:4,fontSize:10,background:'#fee2e2',color:'#991b1b'}}>Cancelled</span>}
                    {d.p1_paid&&<span style={{marginLeft:6,fontSize:10,color:'#10b981'}}>P1 paid</span>}
                  </td>
                  <td style={{...td,fontWeight:700,color:'#0ea5e9'}}>{fmt(d.total)}</td>
                  <td style={{...td,color:'#475569'}}>{fmt(d.arr)}</td>
                  <td style={{...td,color:accentColor,fontWeight:700}}>{fmt(comm)}</td>
                  <td style={td}>{fmt(d.p1)}</td>
                  <td style={td}><DateCell deal={d} which='p1_date' disabled={false}/></td>
                  <td style={td}><Badge paid={d.p1_paid}/></td>
                  <td style={td}><PaySel deal={d}/></td>
                  {isAdmin&&<td style={td}><button onClick={e=>{e.stopPropagation();toggleP1(d)}} style={aBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5')}>{d.p1_paid?'↩ Unpaid':'✓ Mark Paid'}</button></td>}
                  {!isLukeView&&<>
                    <td style={{...td,background:'#faf5ff'}}>{fmt(d.p2)}</td>
                    <td style={{...td,background:'#faf5ff'}}><DateCell deal={d} which='p2_date' disabled={!d.p1_paid}/></td>
                    <td style={{...td,background:'#faf5ff'}}><Badge paid={d.p2_paid} voided={d.p2_voided}/></td>
                    {isAdmin&&<td style={{...td,background:'#faf5ff'}}>
                      {d.p2_voided?<span style={{fontSize:11,color:'#ef4444',fontWeight:700}}>Voided</span>
                        :d.p1_paid?<button onClick={e=>{e.stopPropagation();toggleP2(d)}} style={aBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5')}>{d.p2_paid?'↩ Unpaid':'✓ Mark Paid'}</button>
                        :<span style={{fontSize:11,color:'#94a3b8'}}>Locked</span>}
                    </td>}
                  </>}
                  <td style={td}><CC deal={d}/></td>
                  <td style={td}><ApprCell item={d} table='deals' setter={setDeals}/></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr style={{background:'#f8fafc'}}>
            <td style={{...td,fontWeight:800}}>TOTALS</td>
            <td style={{...td,fontWeight:800,color:'#0ea5e9'}}>{fmt(tDeals.reduce((s,d)=>s+(d.total||0),0))}</td>
            <td style={{...td,fontWeight:800}}>{fmt(tDeals.reduce((s,d)=>s+(d.arr||0),0))}</td>
            <td style={{...td,fontWeight:800,color:accentColor}}>{fmt(tDeals.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0))}</td>
            <td style={{...td,fontWeight:700}}>{fmt(tDeals.reduce((s,d)=>s+(d.p1||0),0))}</td>
            <td style={td}></td>
            <td style={{...td,fontSize:11,color:'#10b981',fontWeight:700}}>{fmt(tDeals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
            <td style={td}></td>{isAdmin&&<td style={td}></td>}
            {!isLukeView&&<>
              <td style={{...td,fontWeight:700,background:'#faf5ff'}}>{fmt(tDeals.reduce((s,d)=>s+(d.p2||0),0))}</td>
              <td style={{background:'#faf5ff'}}></td>
              <td style={{...td,fontSize:11,color:'#10b981',fontWeight:700,background:'#faf5ff'}}>{fmt(tDeals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
              {isAdmin&&<td style={{background:'#faf5ff'}}></td>}
            </>}
            <td style={td}></td><td style={td}></td>
          </tr></tfoot>
        </table>
      </div>
    )
  }

  return(
    <div style={css}>
      <EditModal/>
      <div style={{maxWidth:1500,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:'#1e293b'}}><span style={{color:COMPANY_COLORS[company]}}>{company.charAt(0).toUpperCase()+company.slice(1)}</span> Commission Tracker</h1>
            <p style={{margin:'4px 0 0',color:'#64748b',fontSize:13}}>FY 2025/2026 · {isAdmin?'👑 Admin':`👤 ${profile?.name}`}</p>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <button onClick={()=>setShowAdd(!showAdd)} style={{padding:'8px 16px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13}}>+ Add Deal</button>
            <button onClick={()=>exportToExcel(deals,referrals,displayName||'Export',isLukeView,company).catch(e=>alert('Export failed: '+e.message))} style={{padding:'8px 16px',background:'#10b981',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13}}>⬇ Export</button>
            <button onClick={signOut} style={{padding:'8px 14px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:13,color:'#475569'}}>Sign Out</button>
          </div>
        </div>

        {isAdmin&&(
          <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
            <div style={{background:'#fff',borderRadius:12,padding:4,display:'inline-flex',gap:4,boxShadow:'0 1px 4px #0001'}}>
              {['xactco','bloodhound'].map(c=>(
                <button key={c} onClick={()=>{setCompany(c);setSelectedSP(null);setDeals([]);setAllDeals([]);setNewDeal(c==='bloodhound'?BLANK_BH:BLANK_XACTCO)}}
                  style={{padding:'8px 28px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:14,background:company===c?COMPANY_COLORS[c]:'transparent',color:company===c?'#fff':'#94a3b8'}}>
                  {c.charAt(0).toUpperCase()+c.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isAdmin&&profiles.length>0&&(
          <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
            {profiles.map(sp=>(
              <button key={sp.id} onClick={()=>setSelectedSP(sp)}
                style={{padding:'7px 20px',borderRadius:20,border:`2px solid ${sp.color}`,cursor:'pointer',fontWeight:700,fontSize:13,background:selectedSP?.id===sp.id?sp.color:'#fff',color:selectedSP?.id===sp.id?'#fff':sp.color}}>
                {sp.name}
              </button>
            ))}
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          <StatCard label={`${displayName||'...'} — Total Commission`} value={fmt(totalComm)} color={accentColor}/>
          <StatCard label='Total Paid Out' value={fmt(totalPaid)} color='#10b981'/>
          <StatCard label='Outstanding' value={fmt(totalPending)} color='#f59e0b'/>
          <StatCard label='Pending Clawbacks' value={fmt(totalClawback)} color='#ef4444' sub={totalClawback>0?'Deducted from net comm':'No active clawbacks'}/>
        </div>

        {totalClawback>0&&(
          <div style={{...card,background:'#fef2f2',border:'1px solid #fecaca',marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:'#991b1b',marginBottom:8}}>⚠️ Clawback Summary</div>
            {deals.filter(d=>d.cancelled&&(d.clawback_amount||0)<0&&!d.clawback_settled).map(d=>(
              <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #fecaca'}}>
                <span style={{fontSize:12,color:'#1e293b'}}>{d.client} — {d.month}</span>
                <span style={{fontSize:13,fontWeight:700,color:'#ef4444'}}>{fmt(Math.abs(d.clawback_amount||0))} clawback</span>
              </div>
            ))}
            <div style={{marginTop:8,fontSize:13,fontWeight:800,color:'#991b1b',textAlign:'right'}}>Total pending: {fmt(totalClawback)}</div>
          </div>
        )}

        {showAdd&&(
          <div style={{...card,border:`2px solid ${accentColor}`}}>
            <h3 style={{margin:'0 0 14px',color:accentColor,fontSize:15}}>New Deal — {displayName||profile?.name}{isBH&&<span style={{fontSize:11,color:'#64748b',fontWeight:400}}> · SLA licence revenue only</span>}</h3>
            {isBH&&(
              <div style={{marginBottom:14,display:'flex',gap:10,alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:600,color:'#475569'}}>Deal Type:</span>
                <button onClick={()=>setNewDeal(p=>({...p,deal_type:'new'}))} style={{padding:'6px 16px',borderRadius:20,border:'2px solid #0ea5e9',cursor:'pointer',fontWeight:700,fontSize:13,background:newDeal.deal_type==='new'?'#0ea5e9':'#fff',color:newDeal.deal_type==='new'?'#fff':'#0ea5e9'}}>New Business (8%)</button>
                <button onClick={()=>setNewDeal(p=>({...p,deal_type:'upsell'}))} style={{padding:'6px 16px',borderRadius:20,border:'2px solid #f59e0b',cursor:'pointer',fontWeight:700,fontSize:13,background:newDeal.deal_type==='upsell'?'#f59e0b':'#fff',color:newDeal.deal_type==='upsell'?'#fff':'#f59e0b'}}>Existing Client (4%)</button>
                {newDeal.inception_date&&newDeal.month&&<span style={{fontSize:11,color:isExistingClient(newDeal.inception_date,newDeal.month)?'#92400e':'#0369a1',fontWeight:600}}>{isExistingClient(newDeal.inception_date,newDeal.month)?'⚠️ Auto-detected: Existing client':'✅ Auto-detected: New client'}</span>}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {(isBH?[['Month','month','select'],['Client','client','text'],['Quote No','quote_no','text'],['Inception Date','inception_date','select'],['Patrol Qty','patrol_qty','number'],['Patrol Rate','patrol_rate','number'],['Inspect Qty','inspect_qty','number'],['Inspect Rate','inspect_rate','number'],['VM Qty','vm_qty','number'],['VM Rate','vm_rate','number'],['iLog Qty','ilog_qty','number'],['iLog Rate','ilog_rate','number'],['Invoice Total','invoice_total','number'],['P1 Date','p1_date','select'],['Billing Date','billing_date','text'],['Notes','notes','text']]
              :[['Month','month','select'],['Client','client','text'],['Once Off','once_off','number'],['App Users','app_users','number'],['Lite Users','lite_users','number'],['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],['Dashboards','dashboards','number'],['Dash Cost','dash_cost','number'],['Billing Date','billing_date','text'],['P1 Date','p1_date','select'],['Quote No','quote_no','text'],['Inception Date','inception_date','select'],['Notes','notes','text']])
              .map(([label,key,type])=>(
                <div key={key}>
                  <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3}}>{label}</div>
                  {type==='select'
                    ?<select value={newDeal[key]||''} onChange={e=>setNewDeal(p=>({...p,[key]:e.target.value}))} style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12}}><option value=''>— select —</option>{MONTHS.map(m=><option key={m}>{m}</option>)}</select>
                    :<input type={type} value={newDeal[key]||''} onChange={e=>setNewDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box'}}/>
                  }
                </div>
              ))}
            </div>
            {isBH&&calcBHTotalLic(newDeal)>0&&<div style={{marginTop:10,padding:'8px 14px',borderRadius:8,background:newDeal.deal_type==='upsell'?'rgba(245,158,11,0.1)':'rgba(14,165,233,0.1)',fontSize:12,fontWeight:600,color:newDeal.deal_type==='upsell'?'#92400e':'#0369a1'}}>Lic Total: <strong>{fmt(calcBHTotalLic(newDeal))}</strong> → Commission: <strong>{fmt(newDeal.deal_type==='upsell'?Math.round(calcBHTotalLic(newDeal)*0.04):Math.round(calcBHTotalLic(newDeal)*12*0.08))}</strong>{newDeal.deal_type!=='upsell'&&newDeal.p1_date&&<span style={{marginLeft:8}}>P2: <strong>{getP2Month(newDeal.p1_date)||'—'}</strong></span>}</div>}
            {!isBH&&newDeal.p1_date&&!isLukeView&&<div style={{marginTop:10,fontSize:12,color:accentColor,fontWeight:600}}>P2 auto-set to: <strong>{getP2Month(newDeal.p1_date)||'—'}</strong></div>}
            <div style={{marginTop:14,display:'flex',gap:10}}>
              <button onClick={addDeal} style={{padding:'8px 18px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Save Deal</button>
              <button onClick={()=>setShowAdd(false)} style={{padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <button style={tBtn('summary')} onClick={()=>setTab('summary')}>Payout Summary</button>
          <button style={tBtn('completed')} onClick={()=>setTab('completed')}>Completed {completedDeals.length>0&&<span style={{marginLeft:4,padding:'1px 6px',borderRadius:10,background:tab==='completed'?'rgba(255,255,255,0.3)':'#6366f1',color:'#fff',fontSize:11}}>{completedDeals.length}</span>}</button>
          <button style={tBtn('monthly')} onClick={()=>setTab('monthly')}>Monthly Payables</button>
          <button style={tBtn('detail')} onClick={()=>setTab('detail')}>Deal Detail</button>
          {isAdmin&&<button style={tBtn('referrals')} onClick={()=>setTab('referrals')}>Referrals</button>}
          {isAdmin&&<button style={tBtn('dashboard')} onClick={()=>setTab('dashboard')}>Admin Dashboard</button>}
          {(tab==='summary'||tab==='completed')&&(
            <input placeholder="Search client..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{marginLeft:'auto',padding:'7px 12px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:13,width:200,outline:'none'}}/>
          )}
        </div>

        {deals.length===0&&tab!=='referrals'&&tab!=='dashboard'&&tab!=='monthly'&&(
          <div style={{...card,textAlign:'center',color:'#94a3b8',padding:40}}>No deals yet. Click <strong>+ Add Deal</strong> to get started.</div>
        )}

        {tab==='summary'&&deals.length>0&&(
          isBH?(
            <div>
              <BHSection sectionDeals={newDeals} type='new'/>
              <BHSection sectionDeals={upsellDeals} type='upsell'/>
              {newDeals.length===0&&upsellDeals.length===0&&<div style={{...card,textAlign:'center',color:'#94a3b8',padding:40}}>All deals completed.{search&&' Try clearing your search.'}</div>}
            </div>
          ):(
            <div>
              {isAdmin&&<div style={{fontSize:12,color:'#94a3b8',marginBottom:8}}>✏️ Pencil = reschedule payout date · Green rows = P1 paid</div>}
              <XactcoTable tDeals={filterD(sortedActive)}/>
              {filterD(sortedActive).length===0&&<div style={{...card,textAlign:'center',color:'#94a3b8',padding:40}}>All deals completed.{search&&' Try clearing your search.'}</div>}
            </div>
          )
        )}

        {tab==='completed'&&(
          <div>
            <div style={{...card,background:'#f0fdf4',border:'1px solid #bbf7d0',padding:'12px 16px',marginBottom:16}}>
              <span style={{fontSize:13,color:'#065f46',fontWeight:600}}>✅ Completed deals — all payouts fulfilled. Mark any payout unpaid to move back to Payout Summary.</span>
            </div>
            {isBH?(
              <div>
                <BHSection sectionDeals={compNewDeals} type='new'/>
                <BHSection sectionDeals={compUpDeals} type='upsell'/>
                {compNewDeals.length===0&&compUpDeals.length===0&&<div style={{...card,textAlign:'center',color:'#94a3b8',padding:40}}>No completed deals yet.</div>}
              </div>
            ):(
              <div>
                <XactcoTable tDeals={filterD(completedDeals)}/>
                {filterD(completedDeals).length===0&&<div style={{...card,textAlign:'center',color:'#94a3b8',padding:40}}>No completed deals yet.</div>}
              </div>
            )}
          </div>
        )}

        {tab==='monthly'&&(()=>{
          // Only Luke-approved, non-cancelled deals
          const spDeals = deals.filter(d=>d.approved_luke&&!d.cancelled)
          const p1Due   = spDeals.filter(d=>d.p1_date===payMonth)
          const p2Due   = spDeals.filter(d=>d.p2_date===payMonth&&!d.p2_voided)
          // Clawbacks/outstanding where cancellation_date falls in selected month
          const clawbackDeals = deals.filter(d=>d.cancelled&&d.cancellation_date===payMonth)
          const p1Tot   = p1Due.reduce((s,d)=>s+(d.p1||0),0)
          const p2Tot   = p2Due.reduce((s,d)=>s+(d.p2||0),0)
          const cbTot   = clawbackDeals.reduce((s,d)=>s+(d.clawback_amount||0),0)
          const netTot  = p1Tot + p2Tot + cbTot // cbTot is negative for clawbacks

          const dealTypeBadge = (d) => (
            <span style={{padding:'2px 7px',borderRadius:6,fontSize:10,fontWeight:700,
              background:d.deal_type==='upsell'?'rgba(245,158,11,0.15)':'rgba(99,102,241,0.12)',
              color:d.deal_type==='upsell'?'#92400e':'#4338ca'}}>
              {d.deal_type==='upsell'?'Upsell 4%':'New 8%'}
            </span>
          )

          const SectionHeader = ({label,total,color,bg}) => (
            <div style={{padding:'10px 16px',background:bg,borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,color,fontSize:13}}>{label}</span>
              <span style={{fontWeight:700,color,fontSize:13}}>{fmt(total)}</span>
            </div>
          )

          return(
            <div>
              {/* Month selector */}
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
                <span style={{fontWeight:700,color:'#1e293b',fontSize:14}}>Select Month:</span>
                <select value={payMonth} onChange={e=>setPayMonth(e.target.value)}
                  style={{padding:'8px 14px',borderRadius:8,border:'1px solid #cbd5e1',fontSize:13,fontWeight:600,color:'#1e293b'}}>
                  {MONTHS.map(m=><option key={m}>{m}</option>)}
                </select>
                <span style={{fontSize:12,color:'#64748b'}}>Luke-approved deals only · {displayName||profile?.name}</span>
              </div>

              {/* Summary cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
                <StatCard label={`P1 Payable`} value={fmt(p1Tot)} color='#6366f1' sub={`${p1Due.length} deal${p1Due.length!==1?'s':''}`}/>
                <StatCard label={`P2 Payable`} value={fmt(p2Tot)} color='#8b5cf6' sub={`${p2Due.length} deal${p2Due.length!==1?'s':''}`}/>
                <StatCard label='Clawbacks / Outstanding' value={fmt(Math.abs(cbTot))} color={cbTot<0?'#ef4444':cbTot>0?'#10b981':'#94a3b8'} sub={cbTot<0?'To recover':cbTot>0?'Still owed':'None this month'}/>
                <StatCard label='Net Payable' value={fmt(netTot)} color={accentColor} sub={`${payMonth} total`}/>
              </div>

              {/* P1 Section */}
              <div style={{...card,padding:0,overflow:'hidden',marginBottom:16}}>
                <SectionHeader label={`Payout 1 — ${payMonth}`} total={p1Tot} color='#6366f1' bg='rgba(99,102,241,0.06)'/>
                {p1Due.length===0
                  ?<div style={{padding:24,textAlign:'center',color:'#94a3b8',fontSize:13}}>No P1 payouts due in {payMonth}</div>
                  :<div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>
                        {['Client','Deal Month','Deal Type','Monthly Deal','Commission','P1 Amount','Status','Client 1st Payment','Approvals',...(isAdmin?['Action']:[])].map(h=><th key={h} style={th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {p1Due.map(d=>(
                          <tr key={d.id} style={{background:d.p1_paid?'#f0fdf4':'#fff'}}>
                            <td style={{...td,fontWeight:700}}>{d.client}</td>
                            <td style={td}>{d.month}</td>
                            <td style={td}>{dealTypeBadge(d)}</td>
                            <td style={{...td,color:'#0ea5e9',fontWeight:700}}>{fmt(isBH?calcBHTotalLic(d):d.total)}</td>
                            <td style={{...td,color:accentColor,fontWeight:700}}>{fmt(d.comm)}</td>
                            <td style={{...td,fontWeight:800,color:'#6366f1'}}>{fmt(d.p1)}</td>
                            <td style={td}><Badge paid={d.p1_paid}/></td>
                            <td style={td}><PaySel deal={d}/></td>
                            <td style={td}><ApprCell item={d} table='deals' setter={setDeals}/></td>
                            {isAdmin&&<td style={td}>
                              <button onClick={e=>{e.stopPropagation();toggleP1(d)}}
                                style={aBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5')}>
                                {d.p1_paid?'↩ Unpaid':'✓ Mark Paid'}
                              </button>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{background:'#f8fafc'}}>
                          <td style={{...td,fontWeight:800}} colSpan={5}>P1 TOTAL</td>
                          <td style={{...td,fontWeight:800,color:'#6366f1'}}>{fmt(p1Tot)}</td>
                          <td style={{...td,fontSize:11,color:'#10b981',fontWeight:700}}>{fmt(p1Due.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                          <td colSpan={isAdmin?3:2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                }
              </div>

              {/* P2 Section */}
              <div style={{...card,padding:0,overflow:'hidden',marginBottom:16}}>
                <SectionHeader label={`Payout 2 — ${payMonth}`} total={p2Tot} color='#8b5cf6' bg='rgba(139,92,246,0.06)'/>
                {p2Due.length===0
                  ?<div style={{padding:24,textAlign:'center',color:'#94a3b8',fontSize:13}}>No P2 payouts due in {payMonth}</div>
                  :<div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>
                        {['Client','Deal Month','Deal Type','Monthly Deal','Commission','P2 Amount','Status','Approvals',...(isAdmin?['Action']:[])].map(h=><th key={h} style={th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {p2Due.map(d=>(
                          <tr key={d.id} style={{background:d.p2_paid?'#f0fdf4':'#fff'}}>
                            <td style={{...td,fontWeight:700}}>{d.client}</td>
                            <td style={td}>{d.month}</td>
                            <td style={td}>{dealTypeBadge(d)}</td>
                            <td style={{...td,color:'#0ea5e9',fontWeight:700}}>{fmt(isBH?calcBHTotalLic(d):d.total)}</td>
                            <td style={{...td,color:accentColor,fontWeight:700}}>{fmt(d.comm)}</td>
                            <td style={{...td,fontWeight:800,color:'#8b5cf6'}}>{fmt(d.p2)}</td>
                            <td style={td}><Badge paid={d.p2_paid}/></td>
                            <td style={td}><ApprCell item={d} table='deals' setter={setDeals}/></td>
                            {isAdmin&&<td style={td}>
                              <button onClick={e=>{e.stopPropagation();toggleP2(d)}}
                                style={aBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5')}>
                                {d.p2_paid?'↩ Unpaid':'✓ Mark Paid'}
                              </button>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{background:'#f8fafc'}}>
                          <td style={{...td,fontWeight:800}} colSpan={5}>P2 TOTAL</td>
                          <td style={{...td,fontWeight:800,color:'#8b5cf6'}}>{fmt(p2Tot)}</td>
                          <td style={{...td,fontSize:11,color:'#10b981',fontWeight:700}}>{fmt(p2Due.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
                          <td colSpan={isAdmin?2:1}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                }
              </div>

              {/* Clawbacks / Outstanding Section */}
              <div style={{...card,padding:0,overflow:'hidden',marginBottom:16}}>
                <div style={{padding:'10px 16px',background:clawbackDeals.length>0?'rgba(239,68,68,0.06)':'#f8fafc',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,color:cbTot<0?'#ef4444':cbTot>0?'#10b981':'#64748b',fontSize:13}}>
                    Clawbacks & Outstanding Comm — {payMonth}
                  </span>
                  <span style={{fontWeight:700,color:cbTot<0?'#ef4444':cbTot>0?'#10b981':'#64748b',fontSize:13}}>
                    {cbTot<0?`-${fmt(Math.abs(cbTot))}`:fmt(cbTot)}
                  </span>
                </div>
                {clawbackDeals.length===0
                  ?<div style={{padding:24,textAlign:'center',color:'#94a3b8',fontSize:13}}>No cancellations recorded in {payMonth}</div>
                  :<div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>
                        {['Client','Deal Month','Deal Type','Comm Paid Out','Active Months','Earned Comm','Difference','Type','Settled',...(isAdmin?['Action']:[])].map(h=><th key={h} style={th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {clawbackDeals.map(d=>{
                          const paidOut=(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0)
                          const earned=d.recalculated_comm||0
                          const diff=d.clawback_amount||0
                          const isClawback=diff<0
                          return(
                            <tr key={d.id} style={{background:isClawback?'#fff5f5':'#f0fdf4'}}>
                              <td style={{...td,fontWeight:700}}>{d.client}</td>
                              <td style={td}>{d.month}</td>
                              <td style={td}>{dealTypeBadge(d)}</td>
                              <td style={{...td,fontWeight:700}}>{fmt(paidOut)}</td>
                              <td style={td}>{d.active_months} months</td>
                              <td style={td}>{fmt(earned)}</td>
                              <td style={{...td,fontWeight:800,color:isClawback?'#ef4444':'#10b981'}}>
                                {isClawback?`-${fmt(Math.abs(diff))}`:fmt(diff)}
                              </td>
                              <td style={td}>
                                <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,
                                  background:isClawback?'#fee2e2':'#d1fae5',
                                  color:isClawback?'#991b1b':'#065f46'}}>
                                  {isClawback?'Clawback':'Still Owed'}
                                </span>
                              </td>
                              <td style={td}>
                                {d.clawback_settled
                                  ?<span style={{fontSize:11,color:'#10b981',fontWeight:700}}>✅ Settled</span>
                                  :<span style={{fontSize:11,color:'#f59e0b',fontWeight:700}}>Pending</span>}
                              </td>
                              {isAdmin&&<td style={td}>
                                {!d.clawback_settled&&(
                                  <button onClick={e=>{e.stopPropagation();updateCancellation(d.id,true,d.cancellation_date,d.active_months,true)}}
                                    style={aBtn(isClawback?'#991b1b':'#065f46',isClawback?'#fee2e2':'#d1fae5')}>
                                    {isClawback?'Mark Recovered':'Mark Paid'}
                                  </button>
                                )}
                              </td>}
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{background:'#f8fafc'}}>
                          <td style={{...td,fontWeight:800}} colSpan={6}>NET CLAWBACK / OWED</td>
                          <td style={{...td,fontWeight:800,color:cbTot<0?'#ef4444':'#10b981'}}>
                            {cbTot<0?`-${fmt(Math.abs(cbTot))}`:fmt(cbTot)}
                          </td>
                          <td colSpan={isAdmin?3:2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                }
              </div>

              {/* Net Payable Summary */}
              <div style={{...card,background:'linear-gradient(135deg,#1e293b,#334155)',color:'#fff'}}>
                <div style={{fontSize:12,color:'#94a3b8',marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>
                  {payMonth} — Net Payable Summary for {displayName||profile?.name}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
                  <div><div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>P1 Payouts</div><div style={{fontSize:18,fontWeight:800,color:'#818cf8'}}>{fmt(p1Tot)}</div></div>
                  <div><div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>P2 Payouts</div><div style={{fontSize:18,fontWeight:800,color:'#a78bfa'}}>{fmt(p2Tot)}</div></div>
                  <div><div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>{cbTot<0?'Clawbacks':cbTot>0?'Still Owed':'Clawbacks'}</div><div style={{fontSize:18,fontWeight:800,color:cbTot<0?'#f87171':cbTot>0?'#34d399':'#94a3b8'}}>{cbTot!==0?(cbTot<0?`-${fmt(Math.abs(cbTot))}`:fmt(cbTot)):fmt(0)}</div></div>
                  <div style={{borderLeft:'1px solid rgba(255,255,255,0.1)',paddingLeft:16}}>
                    <div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>NET PAYABLE</div>
                    <div style={{fontSize:24,fontWeight:800,color:'#34d399'}}>{fmt(netTot)}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {tab==='detail'&&deals.length>0&&(
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001'}}>
              <thead>
                {isBH&&<tr><th colSpan={6} style={th}></th><th colSpan={2} style={{...th,background:'rgba(14,165,233,0.1)',color:'#0ea5e9',textAlign:'center'}}>Patrol</th><th colSpan={2} style={{...th,background:'rgba(139,92,246,0.1)',color:'#8b5cf6',textAlign:'center'}}>Inspect</th><th colSpan={2} style={{...th,background:'rgba(245,158,11,0.1)',color:'#f59e0b',textAlign:'center'}}>VM</th><th colSpan={2} style={{...th,background:'rgba(16,185,129,0.1)',color:'#10b981',textAlign:'center'}}>iLog</th><th colSpan={7} style={th}></th></tr>}
                <tr>{isBH?['Month','Client','Deal Type','Quote No','Inception','Invoice','Qty','Rate','Qty','Rate','Qty','Rate','Qty','Rate','Total Lic','Commission','Client 1st Payment','Notes','Cancelled',...(isAdmin?['Actions']:[])].map((h,i)=><th key={i} style={th}>{h}</th>):['Month','Client','Once Off','App Users','Lite Users','Admins','Dashboards','Monthly Total','ARR',commLabel,'Billing Date','Client 1st Payment','Notes','Cancelled',...(isAdmin?['Actions']:[])].map(h=><th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {deals.map(d=>(
                  <tr key={d.id} style={{background:d.cancelled?'#fff5f5':'#fff'}}>
                    {isBH?<>
                      <td style={td}>{d.month}</td><td style={{...td,fontWeight:700}}>{d.client}</td>
                      <td style={td}><span style={{padding:'2px 7px',borderRadius:8,fontSize:10,fontWeight:700,background:d.deal_type==='upsell'?'rgba(245,158,11,0.15)':'rgba(14,165,233,0.15)',color:d.deal_type==='upsell'?'#92400e':'#0369a1'}}>{d.deal_type==='upsell'?'Existing 4%':'New 8%'}</span></td>
                      <td style={{...td,color:'#64748b',fontSize:11}}>{d.quote_no||'—'}</td><td style={{...td,color:'#64748b',fontSize:11}}>{d.inception_date||'—'}</td>
                      <td style={td}>{fmt(d.invoice_total)}</td>
                      <td style={{...td,background:'rgba(14,165,233,0.04)'}}>{d.patrol_qty||0}</td><td style={{...td,background:'rgba(14,165,233,0.04)'}}>R{d.patrol_rate||0}</td>
                      <td style={{...td,background:'rgba(139,92,246,0.04)'}}>{d.inspect_qty||0}</td><td style={{...td,background:'rgba(139,92,246,0.04)'}}>R{d.inspect_rate||0}</td>
                      <td style={{...td,background:'rgba(245,158,11,0.04)'}}>{d.vm_qty||0}</td><td style={{...td,background:'rgba(245,158,11,0.04)'}}>R{d.vm_rate||0}</td>
                      <td style={{...td,background:'rgba(16,185,129,0.04)'}}>{d.ilog_qty||0}</td><td style={{...td,background:'rgba(16,185,129,0.04)'}}>R{d.ilog_rate||0}</td>
                      <td style={{...td,fontWeight:700}}>{fmt(calcBHTotalLic(d))}</td>
                      <td style={{...td,color:accentColor,fontWeight:700}}>{fmt(d.cancelled?d.recalculated_comm:d.comm)}</td>
                      <td style={td}><PaySel deal={d}/></td>
                      <td style={{...td,color:'#64748b',fontSize:11}}>{d.notes||'—'}</td>
                      <td style={td}><CC deal={d}/></td>
                      {isAdmin&&<td style={td}><div style={{display:'flex',gap:4}}><button onClick={()=>setEditingDeal(d)} style={aBtn('#1e293b','#e2e8f0')}>✏️ Edit</button><button onClick={()=>deleteDeal(d.id)} style={aBtn('#991b1b','#fee2e2')}>🗑</button></div></td>}
                    </>:<>
                      <td style={td}>{d.month}</td><td style={{...td,fontWeight:700}}>{d.client}</td>
                      <td style={td}>{fmt(d.once_off)}</td><td style={td}>{d.app_users}</td><td style={td}>{d.lite_users}</td>
                      <td style={td}>{d.admin} ({d.free_admin} free)</td><td style={td}>{d.dashboards}</td>
                      <td style={td}>{fmt(d.total)}</td><td style={td}>{fmt(d.arr)}</td>
                      <td style={{...td,fontWeight:700,color:accentColor}}>{fmt(d.cancelled?d.recalculated_comm:d.comm)}</td>
                      <td style={td}>{d.billing_date}</td><td style={td}><PaySel deal={d}/></td>
                      <td style={{...td,color:'#64748b',fontSize:11}}>{d.notes}</td>
                      <td style={td}><CC deal={d}/></td>
                      {isAdmin&&<td style={td}><div style={{display:'flex',gap:4}}><button onClick={()=>setEditingDeal(d)} style={aBtn('#1e293b','#e2e8f0')}>✏️ Edit</button><button onClick={()=>deleteDeal(d.id)} style={aBtn('#991b1b','#fee2e2')}>🗑</button></div></td>}
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab==='referrals'&&isAdmin&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:12,color:'#64748b'}}>25% of monthly contract value — paid after 2nd invoice settled</div>
              <button onClick={()=>setShowAddRef(!showAddRef)} style={{padding:'7px 16px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13}}>+ Add Referral</button>
            </div>
            {showAddRef&&(
              <div style={{...card,border:`2px solid ${accentColor}`,marginBottom:16}}>
                <h3 style={{margin:'0 0 14px',color:accentColor,fontSize:15}}>New Referral</h3>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {[['Referred By','referred_by','text'],['Client Name','client','text'],['Monthly Fee','mrr','number'],['Date','date','text']].map(([label,key,type])=>(
                    <div key={key}><div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:3}}>{label}</div>
                    <input type={type} value={newRef[key]} onChange={e=>setNewRef(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))} style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #cbd5e1',fontSize:12,boxSizing:'border-box'}}/></div>
                  ))}
                </div>
                {newRef.mrr>0&&<div style={{marginTop:10,fontSize:12,color:accentColor,fontWeight:600}}>Monthly Fee: <strong>{fmt(newRef.mrr)}</strong> → 25% Bonus: <strong>{fmt(getReferralBonus(newRef.mrr))}</strong></div>}
                <div style={{marginTop:14,display:'flex',gap:10}}>
                  <button onClick={addReferral} style={{padding:'8px 18px',background:accentColor,color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Save Referral</button>
                  <button onClick={()=>setShowAddRef(false)} style={{padding:'8px 18px',background:'#e2e8f0',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            )}
            {referrals.length===0&&!showAddRef&&<div style={{...card,textAlign:'center',color:'#94a3b8',padding:40}}>No referrals yet.</div>}
            {referrals.length>0&&(
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px #0001'}}>
                  <thead><tr>{['Referred By','Client','Monthly Fee','25% Bonus','Date','Status','Approvals','Action',''].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{referrals.map(r=>(
                    <tr key={r.id}>
                      <td style={{...td,fontWeight:700}}>{r.referred_by}</td><td style={td}>{r.client}</td>
                      <td style={{...td,color:'#0ea5e9',fontWeight:700}}>{fmt(r.mrr)}</td><td style={{...td,color:accentColor,fontWeight:700}}>{fmt(r.bonus)}</td>
                      <td style={td}>{r.date}</td><td style={td}><Badge paid={r.paid}/></td>
                      <td style={td}><ApprCell item={r} table='referrals' setter={setReferrals}/></td>
                      <td style={td}><button onClick={()=>toggleRefPaid(r)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:r.paid?'#fee2e2':'#d1fae5',color:r.paid?'#991b1b':'#065f46'}}>{r.paid?'↩ Unpaid':'✓ Mark Paid'}</button></td>
                      <td style={td}><button onClick={()=>deleteRef(r.id)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,background:'#fee2e2',color:'#991b1b'}}>🗑</button></td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr style={{background:'#f8fafc'}}>
                    <td style={{...td,fontWeight:800}} colSpan={2}>TOTALS</td>
                    <td style={{...td,fontWeight:800,color:'#0ea5e9'}}>{fmt(referrals.reduce((s,r)=>s+r.mrr,0))}</td>
                    <td style={{...td,fontWeight:800,color:accentColor}}>{fmt(referrals.reduce((s,r)=>s+r.bonus,0))}</td>
                    <td style={td}></td><td style={{...td,fontSize:11,color:'#10b981',fontWeight:700}}>{fmt(referrals.reduce((s,r)=>s+(r.paid?r.bonus:0),0))} paid</td>
                    <td style={td}></td><td style={td}></td><td style={td}></td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {tab==='dashboard'&&isAdmin&&(()=>{
          const spStats=profiles.map(sp=>{
            const spD=allDeals.filter(d=>d.salesperson_id===sp.id)
            const activeD=spD.filter(d=>!d.cancelled)
            const totalMRR=activeD.reduce((s,d)=>s+(d.total||0),0)
            const totalARR=activeD.reduce((s,d)=>s+(d.arr||0),0)
            const totalComm=spD.reduce((s,d)=>s+(d.cancelled?d.recalculated_comm||0:d.comm||0),0)
            const totalPaid=spD.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)
            const clawbackDeals=spD.filter(d=>d.cancelled&&(d.clawback_amount||0)<0)
            const totalClawback=clawbackDeals.reduce((s,d)=>s+Math.abs(d.clawback_amount||0),0)
            const settledCB=clawbackDeals.filter(d=>d.clawback_settled).reduce((s,d)=>s+Math.abs(d.clawback_amount||0),0)
            const netComm=totalComm-totalClawback
            return {sp,dealCount:spD.length,activeCount:activeD.length,cancelledCount:spD.filter(d=>d.cancelled).length,completedCount:spD.filter(d=>isCompleted(d)).length,totalMRR,totalARR,totalComm,totalPaid,totalOutstanding:totalComm-totalPaid,totalClawback,settledCB,pendingCB:totalClawback-settledCB,netComm}
          })
          const coMRR=spStats.reduce((s,x)=>s+x.totalMRR,0)
          const coARR=spStats.reduce((s,x)=>s+x.totalARR,0)
          const coComm=spStats.reduce((s,x)=>s+x.totalComm,0)
          const coPaid=spStats.reduce((s,x)=>s+x.totalPaid,0)
          const coOut=spStats.reduce((s,x)=>s+x.totalOutstanding,0)
          const coCB=spStats.reduce((s,x)=>s+x.totalClawback,0)
          const coNet=spStats.reduce((s,x)=>s+x.netComm,0)
          const P=({label,val,color})=>(
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f1f5f9'}}>
              <span style={{fontSize:12,color:'#64748b'}}>{label}</span>
              <span style={{fontSize:13,fontWeight:700,color:color||'#1e293b'}}>{val}</span>
            </div>
          )
          return(
            <div>
              <div style={{...card,background:'linear-gradient(135deg,#1e293b,#334155)',color:'#fff',marginBottom:24}}>
                <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>{company.charAt(0).toUpperCase()+company.slice(1)} — Company Overview</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
                  {[{l:'Total MRR',v:fmt(coMRR),c:'#60a5fa'},{l:'Total ARR',v:fmt(coARR),c:'#818cf8'},{l:'Commission Liability',v:fmt(coComm),c:'#f59e0b'},{l:'Total Paid Out',v:fmt(coPaid),c:'#34d399'},{l:'Outstanding',v:fmt(coOut),c:'#fb923c'},{l:'Total Clawbacks',v:fmt(coCB),c:'#f87171'},{l:'Net Commission',v:fmt(coNet),c:'#a78bfa'},{l:'Total Deals',v:allDeals.length,c:'#fff'}].map(k=>(
                    <div key={k.l}><div style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>{k.l}</div><div style={{fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div></div>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:16}}>
                {spStats.map(({sp,dealCount,activeCount,cancelledCount,completedCount,totalMRR,totalARR,totalComm,totalPaid,totalOutstanding,totalClawback,settledCB,pendingCB,netComm})=>(
                  <div key={sp.id} style={{...card,borderTop:`4px solid ${sp.color||accentColor}`,marginBottom:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:800,color:'#1e293b'}}>{sp.name}</div>
                        <div style={{fontSize:11,color:'#64748b',textTransform:'capitalize'}}>{sp.role} · {sp.company}</div>
                      </div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <span style={{padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>{dealCount} deals</span>
                        <span style={{padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'#d1fae5',color:'#065f46'}}>{completedCount} done</span>
                        {cancelledCount>0&&<span style={{padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'#fee2e2',color:'#991b1b'}}>{cancelledCount} cancelled</span>}
                      </div>
                    </div>
                    <P label='Monthly Revenue (MRR)' val={fmt(totalMRR)} color='#0ea5e9'/>
                    <P label='Annual Revenue (ARR)' val={fmt(totalARR)} color='#6366f1'/>
                    <P label='Total Commission Earned' val={fmt(totalComm)} color='#f59e0b'/>
                    <P label='Total Paid Out' val={fmt(totalPaid)} color='#10b981'/>
                    <P label='Outstanding' val={fmt(totalOutstanding)} color='#f59e0b'/>
                    {totalClawback>0&&<>
                      <P label='Total Clawbacks' val={fmt(totalClawback)} color='#ef4444'/>
                      <P label='Clawbacks Settled' val={fmt(settledCB)} color='#10b981'/>
                      {pendingCB>0&&<P label='Pending Clawback Recovery' val={fmt(pendingCB)} color='#ef4444'/>}
                    </>}
                    <div style={{marginTop:10,paddingTop:10,borderTop:'2px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:12,color:'#64748b',fontWeight:600}}>Net Commission</span>
                      <span style={{fontSize:16,fontWeight:800,color:netComm>=0?'#10b981':'#ef4444'}}>{fmt(netComm)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
