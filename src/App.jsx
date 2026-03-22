import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const fmt = (n) => `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const MONTHS = ['Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26','Aug-26','Sept-26','Oct-26','Nov-26','Dec-26','Jan-27','Feb-27','Mar-27','Apr-27','May-27','Jun-27']
const getP2Month = (p1) => { const i = MONTHS.indexOf(p1); return i !== -1 && MONTHS[i+6] ? MONTHS[i+6] : '' }
const COMPANY_COLORS = { xactco: '#6366f1', bloodhound: '#ef4444' }
const BLANK_DEAL = { month:'Jan-26', client:'', once_off:0, app_users:0, lite_users:0, a_user_cost:950, l_user_cost:0, admin:1, free_admin:0, admin_cost:1000, dashboards:0, dash_cost:0, billing_date:'', p1_date:'', notes:'' }
const BLANK_REFERRAL = { referred_by:'', client:'', mrr:0, date:'', paid:false }
const LUKE_ID = 'f3b67113-e524-403e-9191-f3b0621e46a3'

const REFERRAL_TIERS = [
  { min:0,      max:10000,  bonus:2500  },
  { min:10001,  max:20000,  bonus:5000  },
  { min:20001,  max:30000,  bonus:7500  },
  { min:30001,  max:40000,  bonus:10000 },
  { min:40001,  max:50000,  bonus:12500 },
  { min:50001,  max:60000,  bonus:15000 },
  { min:60001,  max:100000, bonus:17500 },
  { min:100001, max:999999, bonus:25000 },
]
const getReferralBonus = (mrr) => {
  const tier = REFERRAL_TIERS.find(t => mrr >= t.min && mrr <= t.max)
  return tier ? tier.bonus : 0
}

const Badge = ({ paid }) => (
  <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:paid?'#d1fae5':'#fef3c7', color:paid?'#065f46':'#92400e' }}>
    {paid ? 'PAID' : 'PENDING'}
  </span>
)

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:16, padding:40, width:360, boxShadow:'0 4px 24px #0001' }}>
        <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:800, color:'#1e293b' }}>💼 Commission Tracker</h1>
        <p style={{ margin:'0 0 28px', color:'#64748b', fontSize:13 }}>Sign in to your account</p>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginBottom:4 }}>Email</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:14, boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginBottom:4 }}>Password</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleLogin()}
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #cbd5e1', fontSize:14, boxSizing:'border-box' }} />
        </div>
        {error && <div style={{ color:'#ef4444', fontSize:13, marginBottom:14 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{ width:'100%', padding:'11px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:15, cursor:'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [deals, setDeals] = useState([])
  const [profiles, setProfiles] = useState([])
  const [referrals, setReferrals] = useState([])
  const [company, setCompany] = useState('xactco')
  const [selectedSP, setSelectedSP] = useState(null)
  const [tab, setTab] = useState('summary')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddReferral, setShowAddReferral] = useState(false)
  const [newDeal, setNewDeal] = useState(BLANK_DEAL)
  const [newReferral, setNewReferral] = useState(BLANK_REFERRAL)
  const [editingDate, setEditingDate] = useState(null)
  const [editingDeal, setEditingDeal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_e, session) => setSession(session))
  }, [])

  useEffect(() => {
    if (!session) { setLoading(false); return }
    loadProfile()
  }, [session])

  useEffect(() => {
    if (!profile) return
    if (profile.role === 'admin') loadAllProfiles()
    else loadDeals(profile.id)
  }, [profile, company])

  useEffect(() => {
    if (selectedSP) loadDeals(selectedSP.id)
  }, [selectedSP])

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
    setLoading(false)
  }

  const loadAllProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('company', company)
    const sps = (data || []).filter(p => p.role === 'salesperson' || p.role === 'admin')
    setProfiles(sps)
    if (sps.length) setSelectedSP(sps[0])
  }

  const loadDeals = async (spId) => {
    const { data } = await supabase.from('deals').select('*').eq('salesperson_id', spId).eq('company', company).order('created_at')
    setDeals(data || [])
    loadReferrals(spId)
  }

  const loadReferrals = async (spId) => {
    const { data } = await supabase.from('referrals').select('*').eq('salesperson_id', spId).eq('company', company).order('created_at')
    setReferrals(data || [])
  }

  const toggleP1 = async (deal) => {
    const nowPaid = !deal.p1_paid
    const updates = { p1_paid: nowPaid, p1_paid_date: nowPaid ? new Date().toLocaleDateString('en-ZA') : null, p2_date: nowPaid ? getP2Month(deal.p1_date) : deal.p2_date }
    await supabase.from('deals').update(updates).eq('id', deal.id)
    loadDeals(selectedSP?.id || profile.id)
  }

  const toggleP2 = async (deal) => {
    await supabase.from('deals').update({ p2_paid: !deal.p2_paid }).eq('id', deal.id)
    loadDeals(selectedSP?.id || profile.id)
  }

  const updateDate = async (deal, which, val) => {
    const updates = { [which]: val }
    if (which === 'p1_date' && !deal.p2_paid) updates.p2_date = getP2Month(val)
    await supabase.from('deals').update(updates).eq('id', deal.id)
    setEditingDate(null)
    loadDeals(selectedSP?.id || profile.id)
  }

  const addDeal = async () => {
    if (!newDeal.client || !newDeal.p1_date) return
    const total = (newDeal.app_users*newDeal.a_user_cost)+(newDeal.lite_users*newDeal.l_user_cost)+Math.max(0,newDeal.admin-newDeal.free_admin)*newDeal.admin_cost+(newDeal.dashboards*newDeal.dash_cost)
    const arr = total * 12
    const spId = profile.role === 'admin' ? selectedSP?.id : profile.id
    const isLuke = spId === LUKE_ID
    const comm = isLuke ? total : arr * 0.08
    const p1 = isLuke ? total : comm / 2
    const p2 = isLuke ? 0 : comm / 2
    const p2_date = isLuke ? '' : getP2Month(newDeal.p1_date)
    await supabase.from('deals').insert([{ ...newDeal, salesperson_id: spId, company, total, arr, comm, p1, p2, p2_date, p1_paid:false, p2_paid:false }])
    setShowAdd(false); setNewDeal(BLANK_DEAL)
    loadDeals(spId)
  }

  const deleteDeal = async (id) => {
    if (!window.confirm('Are you sure you want to delete this deal?')) return
    await supabase.from('deals').delete().eq('id', id)
    loadDeals(selectedSP?.id || profile.id)
  }

  const saveEditedDeal = async () => {
    if (!editingDeal) return
    const total = (editingDeal.app_users*editingDeal.a_user_cost)+(editingDeal.lite_users*editingDeal.l_user_cost)+Math.max(0,editingDeal.admin-editingDeal.free_admin)*editingDeal.admin_cost+(editingDeal.dashboards*editingDeal.dash_cost)
    const arr = total * 12
    const isLuke = editingDeal.salesperson_id === LUKE_ID
    const comm = isLuke ? total : arr * 0.08
    const p1 = isLuke ? total : comm / 2
    const p2 = isLuke ? 0 : comm / 2
    await supabase.from('deals').update({ ...editingDeal, total, arr, comm, p1, p2 }).eq('id', editingDeal.id)
    setEditingDeal(null)
    loadDeals(selectedSP?.id || profile.id)
  }

  const addReferral = async () => {
    if (!newReferral.referred_by || !newReferral.client || !newReferral.mrr) return
    const bonus = getReferralBonus(newReferral.mrr)
    const spId = profile.role === 'admin' ? selectedSP?.id : profile.id
    await supabase.from('referrals').insert([{ ...newReferral, salesperson_id: spId, company, bonus, paid: false }])
    setShowAddReferral(false); setNewReferral(BLANK_REFERRAL)
    loadReferrals(spId)
  }

  const toggleReferralPaid = async (r) => {
    await supabase.from('referrals').update({ paid: !r.paid }).eq('id', r.id)
    loadReferrals(selectedSP?.id || profile.id)
  }

  const deleteReferral = async (id) => {
    if (!window.confirm('Delete this referral?')) return
    await supabase.from('referrals').delete().eq('id', id)
    loadReferrals(selectedSP?.id || profile.id)
  }

  const signOut = () => supabase.auth.signOut()

  if (!session) return <Login />
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#64748b', fontFamily:"'Segoe UI',sans-serif" }}>Loading...</div>

  const isAdmin = profile?.role === 'admin'
  const isLukeView = selectedSP?.id === LUKE_ID || (!isAdmin && profile?.id === LUKE_ID)
  const accentColor = selectedSP?.color || profile?.color || COMPANY_COLORS[company]
  const displayName = isAdmin ? selectedSP?.name : profile?.name

  const totalComm = deals.reduce((s,d)=>s+d.comm,0)
  const totalPaid = deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0)+(d.p2_paid?d.p2:0),0)
  const totalPending = totalComm - totalPaid

  const css = { fontFamily:"'Segoe UI',sans-serif", background:'#f8fafc', minHeight:'100vh', padding:20 }
  const card = { background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 1px 4px #0001' }
  const th = { padding:'10px 14px', background:'#f1f5f9', fontSize:12, fontWeight:700, color:'#475569', textAlign:'left', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }
  const td = { padding:'10px 14px', fontSize:13, color:'#1e293b', borderBottom:'1px solid #f1f5f9', verticalAlign:'middle' }
  const tabBtn = (t) => ({ padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:13, background:tab===t?accentColor:'#e2e8f0', color:tab===t?'#fff':'#475569' })
  const actionBtn = (color, bg) => ({ padding:'5px 12px', fontSize:11, borderRadius:6, border:'none', cursor:'pointer', fontWeight:700, background:bg, color, whiteSpace:'nowrap' })

  const EditModal = () => {
    if (!editingDeal) return null
    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#0008', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:28, width:700, maxHeight:'80vh', overflowY:'auto', boxShadow:'0 8px 32px #0003' }}>
          <h3 style={{ margin:'0 0 18px', color:accentColor, fontSize:16 }}>Edit Deal — {editingDeal.client}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[['Signed Month','month','select'],['Client Name','client','text'],['Once Off (R)','once_off','number'],
              ['App Users','app_users','number'],['Lite Users','lite_users','number'],
              ['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],
              ['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],
              ['Dashboards','dashboards','number'],['Dashboard Cost','dash_cost','number'],
              ['Billing Date','billing_date','text'],['Payout 1 Month','p1_date','select'],['Notes','notes','text'],
            ].map(([label,key,type])=>(
              <div key={key}>
                <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:3 }}>{label}</div>
                {type==='select'
                  ? <select value={editingDeal[key]} onChange={e=>setEditingDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13 }}>
                      {MONTHS.map(m=><option key={m}>{m}</option>)}
                    </select>
                  : <input type={type} value={editingDeal[key]} onChange={e=>setEditingDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))}
                      style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, boxSizing:'border-box' }} />
                }
              </div>
            ))}
          </div>
          <div style={{ marginTop:18, display:'flex', gap:10 }}>
            <button onClick={saveEditedDeal} style={{ padding:'8px 18px', background:accentColor, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Save Changes</button>
            <button onClick={()=>setEditingDeal(null)} style={{ padding:'8px 18px', background:'#e2e8f0', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  const DateCell = ({ deal, which, disabled }) => {
    const isEditing = editingDate?.id===deal.id && editingDate?.which===which
    const val = deal[which]
    if (disabled) return <span style={{ color:'#94a3b8', fontSize:12 }}>Set when P1 paid</span>
    if (isEditing) return (
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <select autoFocus defaultValue={val} onChange={e=>updateDate(deal,which,e.target.value)} style={{ padding:'4px 6px', borderRadius:6, border:`1px solid ${accentColor}`, fontSize:12 }}>
          {MONTHS.map(m=><option key={m}>{m}</option>)}
        </select>
        <button onClick={()=>setEditingDate(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#94a3b8' }}>✕</button>
      </div>
    )
    const canEdit = isAdmin && !deal[which==='p1_date'?'p1_paid':'p2_paid']
    return (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span>{val||'—'}</span>
        {canEdit && <button onClick={()=>setEditingDate({id:deal.id,which})} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:accentColor, padding:0 }}>✏️</button>}
        {which==='p1_date' && deal.p1_paid && deal.p1_paid_date && <span style={{ fontSize:10, color:'#10b981', display:'block' }}>paid {deal.p1_paid_date}</span>}
      </div>
    )
  }

  const commLabel = isLukeView ? 'Commission' : '8% Comm'

  return (
    <div style={css}>
      <EditModal />
      <div style={{ maxWidth:1200, margin:'0 auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'#1e293b' }}>
              <span style={{ color:COMPANY_COLORS[company] }}>{company.charAt(0).toUpperCase()+company.slice(1)}</span> Commission Tracker
            </h1>
            <p style={{ margin:'4px 0 0', color:'#64748b', fontSize:13 }}>FY 2025 / 2026 · {isAdmin ? '👑 Admin' : `👤 ${profile?.name}`}</p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={()=>setShowAdd(!showAdd)} style={{ padding:'8px 16px', background:accentColor, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:13 }}>+ Add Deal</button>
            <button onClick={signOut} style={{ padding:'8px 14px', background:'#e2e8f0', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:13, color:'#475569' }}>Sign Out</button>
          </div>
        </div>

        {isAdmin && (
          <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
            <div style={{ background:'#fff', borderRadius:12, padding:4, display:'inline-flex', gap:4, boxShadow:'0 1px 4px #0001' }}>
              {['xactco','bloodhound'].map(c=>(
                <button key={c} onClick={()=>{ setCompany(c); setSelectedSP(null); setDeals([]) }} style={{ padding:'8px 28px', borderRadius:9, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:company===c?COMPANY_COLORS[c]:'transparent', color:company===c?'#fff':'#94a3b8' }}>
                  {c.charAt(0).toUpperCase()+c.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
            {profiles.map(sp=>(
              <button key={sp.id} onClick={()=>setSelectedSP(sp)} style={{ padding:'7px 20px', borderRadius:20, border:`2px solid ${sp.color}`, cursor:'pointer', fontWeight:700, fontSize:13, background:selectedSP?.id===sp.id?sp.color:'#fff', color:selectedSP?.id===sp.id?'#fff':sp.color }}>
                {sp.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[
            { label:`${displayName || '...'} — Total Commission`, value:fmt(totalComm), color:accentColor },
            { label:'Total Paid Out', value:fmt(totalPaid), color:'#10b981' },
            { label:'Outstanding', value:fmt(totalPending), color:'#f59e0b' },
          ].map(k=>(
            <div key={k.label} style={{ ...card, borderTop:`4px solid ${k.color}`, marginBottom:0 }}>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:600, marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {showAdd && (
          <div style={{ ...card, border:`2px solid ${accentColor}` }}>
            <h3 style={{ margin:'0 0 14px', color:accentColor, fontSize:15 }}>New Deal — {displayName}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[['Signed Month','month','select'],['Client Name','client','text'],['Once Off (R)','once_off','number'],
                ['App Users','app_users','number'],['Lite Users','lite_users','number'],
                ['App User Cost','a_user_cost','number'],['Lite User Cost','l_user_cost','number'],
                ['Admins','admin','number'],['Free Admins','free_admin','number'],['Admin Cost','admin_cost','number'],
                ['Dashboards','dashboards','number'],['Dashboard Cost','dash_cost','number'],
                ['Billing Date','billing_date','text'],['Payout 1 Month','p1_date','select'],['Notes','notes','text'],
              ].map(([label,key,type])=>(
                <div key={key}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:3 }}>{label}</div>
                  {type==='select'
                    ? <select value={newDeal[key]} onChange={e=>setNewDeal(p=>({...p,[key]:e.target.value}))} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13 }}>
                        <option value=''>— select —</option>
                        {MONTHS.map(m=><option key={m}>{m}</option>)}
                      </select>
                    : <input type={type} value={newDeal[key]} onChange={e=>setNewDeal(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))}
                        style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, boxSizing:'border-box' }} />
                  }
                </div>
              ))}
            </div>
            {newDeal.p1_date && !isLukeView && <div style={{ marginTop:10, fontSize:12, color:accentColor, fontWeight:600 }}>📅 Payout 2 auto-set to: <strong>{getP2Month(newDeal.p1_date)||'—'}</strong></div>}
            <div style={{ marginTop:14, display:'flex', gap:10 }}>
              <button onClick={addDeal} style={{ padding:'8px 18px', background:accentColor, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Save Deal</button>
              <button onClick={()=>setShowAdd(false)} style={{ padding:'8px 18px', background:'#e2e8f0', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button style={tabBtn('summary')} onClick={()=>setTab('summary')}>Payout Summary</button>
          <button style={tabBtn('detail')} onClick={()=>setTab('detail')}>Deal Detail</button>
          {isAdmin && <button style={tabBtn('referrals')} onClick={()=>setTab('referrals')}>Referrals</button>}
        </div>

        {deals.length===0 && tab !== 'referrals' && (
          <div style={{ ...card, textAlign:'center', color:'#94a3b8', padding:40 }}>
            No deals yet. Click <strong>+ Add Deal</strong> to get started.
          </div>
        )}

        {tab==='summary' && deals.length>0 && (
          <div style={{ overflowX:'auto' }}>
            {isAdmin && <div style={{ fontSize:12, color:'#94a3b8', marginBottom:8 }}>✏️ Click the pencil icon to reschedule a payout</div>}
            <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px #0001' }}>
              <thead>
                <tr>
                  {['Client','Monthly Deal','× 12 (ARR)', commLabel,'Payout 1','P1 Date','P1 Status',
                    ...(isAdmin ? [''] : []),
                    ...(!isLukeView ? ['Payout 2','P2 Date','P2 Status', ...(isAdmin ? [''] : [])] : [])
                  ].map((h,i)=>(
                    <th key={i} style={{ ...th, background:i>=8?'#ede9fe':'#f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.map(d=>(
                  <tr key={d.id}>
                    <td style={{ ...td, fontWeight:700 }}>{d.client}</td>
                    <td style={{ ...td, fontWeight:700, color:'#0ea5e9' }}>{fmt(d.total)}</td>
                    <td style={{ ...td, color:'#475569' }}>{fmt(d.arr)}</td>
                    <td style={{ ...td, color:accentColor, fontWeight:700 }}>{fmt(d.comm)}</td>
                    <td style={td}>{fmt(d.p1)}</td>
                    <td style={td}><DateCell deal={d} which='p1_date' disabled={false} /></td>
                    <td style={td}><Badge paid={d.p1_paid} /></td>
                    {isAdmin && <td style={td}><button onClick={()=>toggleP1(d)} style={actionBtn(d.p1_paid?'#991b1b':'#065f46',d.p1_paid?'#fee2e2':'#d1fae5')}>{d.p1_paid?'↩ Unpaid':'✓ Mark Paid'}</button></td>}
                    {!isLukeView && <>
                      <td style={{ ...td, background:'#faf5ff' }}>{fmt(d.p2)}</td>
                      <td style={{ ...td, background:'#faf5ff' }}><DateCell deal={d} which='p2_date' disabled={!d.p1_paid} /></td>
                      <td style={{ ...td, background:'#faf5ff' }}><Badge paid={d.p2_paid} /></td>
                      {isAdmin && <td style={{ ...td, background:'#faf5ff' }}>
                        {d.p1_paid
                          ? <button onClick={()=>toggleP2(d)} style={actionBtn(d.p2_paid?'#991b1b':'#065f46',d.p2_paid?'#fee2e2':'#d1fae5')}>{d.p2_paid?'↩ Unpaid':'✓ Mark Paid'}</button>
                          : <span style={{ fontSize:11, color:'#94a3b8' }}>Locked</span>}
                      </td>}
                    </>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'#f8fafc' }}>
                  <td style={{ ...td, fontWeight:800 }}>TOTALS</td>
                  <td style={{ ...td, fontWeight:800, color:'#0ea5e9' }}>{fmt(deals.reduce((s,d)=>s+d.total,0))}</td>
                  <td style={{ ...td, fontWeight:800 }}>{fmt(deals.reduce((s,d)=>s+d.arr,0))}</td>
                  <td style={{ ...td, fontWeight:800, color:accentColor }}>{fmt(totalComm)}</td>
                  <td style={{ ...td, fontWeight:700 }}>{fmt(deals.reduce((s,d)=>s+d.p1,0))}</td>
                  <td style={td}></td>
                  <td style={{ ...td, fontSize:12, color:'#10b981', fontWeight:700 }}>{fmt(deals.reduce((s,d)=>s+(d.p1_paid?d.p1:0),0))} paid</td>
                  {isAdmin && <td style={td}></td>}
                  {!isLukeView && <>
                    <td style={{ ...td, fontWeight:700, background:'#faf5ff' }}>{fmt(deals.reduce((s,d)=>s+d.p2,0))}</td>
                    <td style={{ background:'#faf5ff' }}></td>
                    <td style={{ ...td, fontSize:12, color:'#10b981', fontWeight:700, background:'#faf5ff' }}>{fmt(deals.reduce((s,d)=>s+(d.p2_paid?d.p2:0),0))} paid</td>
                    {isAdmin && <td style={{ background:'#faf5ff' }}></td>}
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab==='detail' && deals.length>0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px #0001' }}>
              <thead>
                <tr>{['Month','Client','Once Off','App Users','Lite Users','Admins','Dashboards','Monthly Total','ARR', commLabel,'Billing Date','Notes',...(isAdmin?['Actions']:[])].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {deals.map(d=>(
                  <tr key={d.id}>
                    <td style={td}>{d.month}</td>
                    <td style={{ ...td, fontWeight:700 }}>{d.client}</td>
                    <td style={td}>{fmt(d.once_off)}</td>
                    <td style={td}>{d.app_users}</td>
                    <td style={td}>{d.lite_users}</td>
                    <td style={td}>{d.admin} ({d.free_admin} free)</td>
                    <td style={td}>{d.dashboards}</td>
                    <td style={td}>{fmt(d.total)}</td>
                    <td style={td}>{fmt(d.arr)}</td>
                    <td style={{ ...td, fontWeight:700, color:accentColor }}>{fmt(d.comm)}</td>
                    <td style={td}>{d.billing_date}</td>
                    <td style={{ ...td, color:'#64748b', fontSize:12 }}>{d.notes}</td>
                    {isAdmin && <td style={td}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setEditingDeal(d)} style={actionBtn('#1e293b','#e2e8f0')}>✏️ Edit</button>
                        <button onClick={()=>deleteDeal(d.id)} style={actionBtn('#991b1b','#fee2e2')}>🗑 Delete</button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab==='referrals' && isAdmin && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#64748b' }}>25% of monthly contract value — paid after 2nd invoice settled</div>
              <button onClick={()=>setShowAddReferral(!showAddReferral)} style={{ padding:'7px 16px', background:accentColor, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:13 }}>+ Add Referral</button>
            </div>

            {showAddReferral && (
              <div style={{ ...card, border:`2px solid ${accentColor}`, marginBottom:16 }}>
                <h3 style={{ margin:'0 0 14px', color:accentColor, fontSize:15 }}>New Referral</h3>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {[['Referred By','referred_by','text'],['Client Name','client','text'],['Monthly Value (MRR)','mrr','number'],['Date','date','text']].map(([label,key,type])=>(
                    <div key={key}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#64748b', marginBottom:3 }}>{label}</div>
                      <input type={type} value={newReferral[key]} onChange={e=>setNewReferral(p=>({...p,[key]:type==='number'?parseFloat(e.target.value)||0:e.target.value}))}
                        style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #cbd5e1', fontSize:13, boxSizing:'border-box' }} />
                    </div>
                  ))}
                </div>
                {newReferral.mrr > 0 && (
                  <div style={{ marginTop:10, fontSize:13, color:accentColor, fontWeight:600 }}>
                    💰 Referral bonus: <strong>{fmt(getReferralBonus(newReferral.mrr))}</strong>
                  </div>
                )}
                <div style={{ marginTop:14, display:'flex', gap:10 }}>
                  <button onClick={addReferral} style={{ padding:'8px 18px', background:accentColor, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Save Referral</button>
                  <button onClick={()=>setShowAddReferral(false)} style={{ padding:'8px 18px', background:'#e2e8f0', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {referrals.length === 0 && !showAddReferral && (
              <div style={{ ...card, textAlign:'center', color:'#94a3b8', padding:40 }}>No referrals yet. Click <strong>+ Add Referral</strong> to get started.</div>
            )}

            {referrals.length > 0 && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px #0001' }}>
                  <thead>
                    <tr>{['Referred By','Client','MRR','25% Bonus','Date','Status','Action',''].map((h,i)=>(
                      <th key={i} style={th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {referrals.map(r=>(
                      <tr key={r.id}>
                        <td style={{ ...td, fontWeight:700 }}>{r.referred_by}</td>
                        <td style={td}>{r.client}</td>
                        <td style={{ ...td, color:'#0ea5e9', fontWeight:700 }}>{fmt(r.mrr)}</td>
                        <td style={{ ...td, color:accentColor, fontWeight:700 }}>{fmt(r.bonus)}</td>
                        <td style={td}>{r.date}</td>
                        <td style={td}><Badge paid={r.paid} /></td>
                        <td style={td}>
                          <button onClick={()=>toggleReferralPaid(r)} style={{ padding:'5px 12px', fontSize:11, borderRadius:6, border:'none', cursor:'pointer', fontWeight:700, background:r.paid?'#fee2e2':'#d1fae5', color:r.paid?'#991b1b':'#065f46' }}>
                            {r.paid ? '↩ Unpaid' : '✓ Mark Paid'}
                          </button>
                        </td>
                        <td style={td}>
                          <button onClick={()=>deleteReferral(r.id)} style={{ padding:'5px 12px', fontSize:11, borderRadius:6, border:'none', cursor:'pointer', fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8fafc' }}>
                      <td style={{ ...td, fontWeight:800 }} colSpan={2}>TOTALS</td>
                      <td style={{ ...td, fontWeight:800, color:'#0ea5e9' }}>{fmt(referrals.reduce((s,r)=>s+r.mrr,0))}</td>
                      <td style={{ ...td, fontWeight:800, color:accentColor }}>{fmt(referrals.reduce((s,r)=>s+r.bonus,0))}</td>
                      <td style={td}></td>
                      <td style={{ ...td, fontSize:12, color:'#10b981', fontWeight:700 }}>{fmt(referrals.reduce((s,r)=>s+(r.paid?r.bonus:0),0))} paid</td>
                      <td style={td}></td><td style={td}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
