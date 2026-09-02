import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
import { useToast } from '../context/ToastContext'
import * as ncApi from '../services/notificationChannelAPI'
import './NotificationChannels.css'

// ─── constants ────────────────────────────────────────────────────────────────
const CH_ICONS  = { email:'✉️', teams:'💬', slack:'⚡', webhook:'🔗' }
const CH_LABELS = { email:'Email', teams:'Microsoft Teams', slack:'Slack', webhook:'Custom Webhook' }
const EV_LABELS = {
  unhappy_feedback:'Unhappy Feedback', emergency_feedback:'Emergency Feedback',
  device_offline:'Device Offline', low_battery:'Low Battery',
  gateway_offline:'Gateway Offline', system_alert:'System Alert',
}
const ALL_EVENTS = Object.keys(EV_LABELS)
const STEPS = ['Channel','Provider','Configure','Recipients','Events','Template','Review']

// ─── helpers ──────────────────────────────────────────────────────────────────
function getAuthModes(meta, ct, p) {
  const prov = meta?.[ct]?.providers?.[p]
  return prov?.authModes ? Object.entries(prov.authModes).map(([k,v])=>({key:k,label:v.label})) : null
}
function getFields(meta, ct, p, am) {
  const prov = meta?.[ct]?.providers?.[p]
  if (!prov) return []
  if (prov.authModes) return prov.authModes[am]?.fields || []
  return prov.fields || []
}

// ─── single config field ──────────────────────────────────────────────────────
function CField({ f, val, all, onChange }) {
  const visible = !f.showWhen || all[f.showWhen.field] === f.showWhen.value
  if (!visible) return null
  if (f.type === 'boolean') return (
    <label className="nc-field nc-checkbox-field">
      <input type="checkbox" checked={!!val} onChange={e=>onChange(f.key,e.target.checked)}/>
      {f.label}{f.hint && <span className="nc-hint"> — {f.hint}</span>}
    </label>
  )
  if (f.type === 'select') return (
    <div className="nc-field">
      <label className="nc-label">{f.label}{f.required&&<span className="nc-req"> *</span>}</label>
      <select className="nc-input" value={val||f.default||''} onChange={e=>onChange(f.key,e.target.value)}>
        {(f.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      {f.hint&&<p className="nc-hint">{f.hint}</p>}
    </div>
  )
  if (f.type === 'textarea') return (
    <div className="nc-field nc-field--full">
      <label className="nc-label">{f.label}{f.required&&<span className="nc-req"> *</span>}</label>
      <textarea className="nc-input nc-textarea" rows={4} value={val||''} onChange={e=>onChange(f.key,e.target.value)} placeholder={f.placeholder||''}/>
      {f.hint&&<p className="nc-hint">{f.hint}</p>}
    </div>
  )
  return (
    <div className="nc-field">
      <label className="nc-label">{f.label}{f.required&&<span className="nc-req"> *</span>}</label>
      <input className="nc-input"
        type={f.type==='password'?'password':f.type==='number'?'number':f.type==='url'?'url':f.type==='email'?'email':'text'}
        value={val||''} onChange={e=>onChange(f.key,e.target.value)}
        placeholder={f.placeholder||''} autoComplete={f.type==='password'?'new-password':undefined}/>
      {f.hint&&<p className="nc-hint">{f.hint}</p>}
    </div>
  )
}

// ─── wizard ───────────────────────────────────────────────────────────────────
function Wizard({ meta, editCh, onSave, onClose }) {
  const isEdit = !!editCh
  const [step, setStep]         = useState(isEdit ? 2 : 0)
  const [ct, setCt]             = useState(editCh?.channelType||'')
  const [prov, setProv]         = useState(editCh?.provider||'')
  const [name, setName]         = useState(editCh?.name||'')
  const [authMode, setAuthMode] = useState('')
  const [cfg, setCfg]           = useState(editCh?.configuration||{})
  const [recips, setRecips]     = useState(editCh?.recipients||[])
  const [newRec, setNewRec]     = useState({val:'',lbl:'',evs:[]})
  const [events, setEvents]     = useState(editCh?.templates?.map(t=>t.eventType)||['unhappy_feedback','emergency_feedback'])
  const [tmpls, setTmpls]       = useState({})
  const [saving, setSaving]     = useState(false)
  const toast = useToast()

  const ams    = meta ? getAuthModes(meta,ct,prov) : null
  const effAm  = authMode || ams?.[0]?.key || ''
  const fields = meta ? getFields(meta,ct,prov,effAm) : []

  function setC(k,v){ setCfg(c=>({...c,[k]:v})) }
  function pickCt(c){ setCt(c); const ps=meta?Object.keys(meta[c]?.providers||{}):[];setProv(ps[0]||'');setAuthMode('');setCfg({});setStep(1) }
  function pickProv(p){ setProv(p);setAuthMode('');setCfg({});setStep(2) }

  function addRec(){
    if(!newRec.val.trim()) return
    const rtype=ct==='email'?'email':ct==='slack'?'slack_channel':'teams_user'
    setRecips(r=>[...r,{_new:true,recipientType:rtype,recipientValue:newRec.val.trim(),label:newRec.lbl||null,eventTypes:newRec.evs.length?newRec.evs:null,enabled:true}])
    setNewRec({val:'',lbl:'',evs:[]})
  }
  function toggleRecEv(e){ setNewRec(r=>({...r,evs:r.evs.includes(e)?r.evs.filter(x=>x!==e):[...r.evs,e]})) }

  async function save(){
    if(!name.trim()){toast.error('Channel name is required');return}
    setSaving(true)
    try{ await onSave({isEdit,channelId:editCh?.id,ct,prov,name,cfg:{...cfg,authMode:effAm},recips,events,tmpls}) }
    finally{ setSaving(false) }
  }

  const canNext = step===0?!!ct:step===1?!!prov:step===2?!!name:true

  return (
    <div className="nc-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="nc-modal">
        <div className="nc-modal-hdr">
          <h2>{isEdit?`Configure — ${editCh.name}`:'Add Notification Channel'}</h2>
          <button className="nc-close" onClick={onClose}>✕</button>
        </div>
        <div className="nc-stepbar">
          {STEPS.map((s,i)=>(
            <div key={s} className={`nc-stepbar-item${i===step?' nc-stepbar-item--active':i<step?' nc-stepbar-item--done':''}`}>
              <span className="nc-stepbar-num">{i<step?'✓':i+1}</span>
              <span className="nc-stepbar-lbl">{s}</span>
            </div>
          ))}
        </div>
        <div className="nc-modal-body">
          {step===0&&(
            <div>
              <p className="nc-step-desc">Select the type of notification channel.</p>
              <div className="nc-ch-grid">
                {meta&&Object.entries(meta).map(([c,info])=>(
                  <button key={c} className={`nc-ch-opt${ct===c?' nc-ch-opt--sel':''}`} onClick={()=>pickCt(c)}>
                    <span className="nc-ch-opt-icon">{CH_ICONS[c]||'🔔'}</span>
                    <span>{info.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step===1&&ct&&meta&&(
            <div>
              <p className="nc-step-desc">Choose the provider for your {CH_LABELS[ct]} channel.</p>
              <div className="nc-prov-list">
                {Object.entries(meta[ct]?.providers||{}).map(([pk,pv])=>(
                  <button key={pk} className={`nc-prov-opt${prov===pk?' nc-prov-opt--sel':''}`} onClick={()=>pickProv(pk)}>
                    <strong>{pv.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step===2&&(
            <div>
              <div className="nc-field nc-field--full">
                <label className="nc-label">Channel Name <span className="nc-req">*</span></label>
                <input className="nc-input" value={name} onChange={e=>setName(e.target.value)} placeholder={`My ${CH_LABELS[ct]||''} Channel`}/>
              </div>
              {ams&&(
                <div className="nc-field">
                  <label className="nc-label">Auth Method</label>
                  <select className="nc-input" value={effAm} onChange={e=>setAuthMode(e.target.value)}>
                    {ams.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
              )}
              <div className="nc-cfg-grid">
                {fields.map(f=><CField key={f.key} f={f} val={cfg[f.key]} all={cfg} onChange={setC}/>)}
              </div>
            </div>
          )}
          {step===3&&(
            <div>
              <p className="nc-step-desc">Add people or destinations that will receive notifications.</p>
              {recips.length>0&&(
                <div className="nc-recip-list">
                  {recips.map((r,i)=>(
                    <div key={i} className={`nc-recip${r.enabled?'':' nc-recip--off'}`}>
                      <div className="nc-recip-info">
                        <span className="nc-recip-val">{r.recipientValue}</span>
                        {r.label&&<span className="nc-recip-lbl">{r.label}</span>}
                      </div>
                      <div className="nc-recip-acts">
                        <button className="nc-icon-btn" onClick={()=>setRecips(rs=>rs.map((x,j)=>j===i?{...x,enabled:!x.enabled}:x))}>{r.enabled?'✓':'○'}</button>
                        <button className="nc-icon-btn nc-icon-btn--del" onClick={()=>setRecips(rs=>rs.filter((_,j)=>j!==i))}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="nc-add-recip">
                <h4>Add Recipient</h4>
                <div className="nc-field">
                  <label className="nc-label">{ct==='email'?'Email Address':ct==='slack'?'Slack Channel':'Recipient'}</label>
                  <input className="nc-input" value={newRec.val} onChange={e=>setNewRec(r=>({...r,val:e.target.value}))}
                    placeholder={ct==='email'?'user@example.com':ct==='slack'?'#alerts':'Recipient'}/>
                </div>
                <div className="nc-field">
                  <label className="nc-label">Label (optional)</label>
                  <input className="nc-input" value={newRec.lbl} onChange={e=>setNewRec(r=>({...r,lbl:e.target.value}))} placeholder="e.g. Facility Manager"/>
                </div>
                <div className="nc-field nc-field--full">
                  <label className="nc-label">Subscribe to events (empty = all events)</label>
                  <div className="nc-ev-checks">
                    {ALL_EVENTS.map(ev=>(
                      <label key={ev} className="nc-checkbox">
                        <input type="checkbox" checked={newRec.evs.includes(ev)} onChange={()=>toggleRecEv(ev)}/>
                        {EV_LABELS[ev]}
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn btn--sm btn--primary" onClick={addRec} disabled={!newRec.val.trim()}>+ Add Recipient</button>
              </div>
            </div>
          )}
          {step===4&&(
            <div>
              <p className="nc-step-desc">Which events trigger notifications through this channel?</p>
              <div className="nc-ev-list">
                {ALL_EVENTS.map(ev=>(
                  <label key={ev} className="nc-ev-row">
                    <input type="checkbox" checked={events.includes(ev)}
                      onChange={()=>setEvents(s=>s.includes(ev)?s.filter(x=>x!==ev):[...s,ev])}/>
                    <strong>{EV_LABELS[ev]}</strong>
                  </label>
                ))}
              </div>
            </div>
          )}
          {step===5&&(
            <div>
              <p className="nc-step-desc">Customise message templates. Supports <code>{'{{variable}}'}</code> — siteName, floorName, restroomName, deviceId, feedbackType, priority, timestamp.</p>
              {events.map(ev=>(
                <div key={ev} className="nc-tmpl-block">
                  <h4 className="nc-tmpl-title">{EV_LABELS[ev]}</h4>
                  {ct==='email'&&(
                    <div className="nc-field nc-field--full">
                      <label className="nc-label">Subject</label>
                      <input className="nc-input" value={tmpls[ev]?.subject||''} placeholder="Alert — {{siteName}}"
                        onChange={e=>setTmpls(t=>({...t,[ev]:{...t[ev],subject:e.target.value}}))}/>
                    </div>
                  )}
                  <div className="nc-field nc-field--full">
                    <label className="nc-label">Body</label>
                    <textarea className="nc-input nc-textarea" rows={4} value={tmpls[ev]?.body||''}
                      placeholder="Alert for {{restroomName}} at {{siteName}}…"
                      onChange={e=>setTmpls(t=>({...t,[ev]:{...t[ev],body:e.target.value}}))}/>
                  </div>
                </div>
              ))}
              <p className="nc-hint">Leave empty to use built-in defaults.</p>
            </div>
          )}
          {step===6&&(
            <div className="nc-review">
              {[
                ['Channel',CH_LABELS[ct]||ct],
                ['Provider',meta?.[ct]?.providers?.[prov]?.label||prov],
                ['Name',name],
                ['Recipients',`${recips.length} configured`],
                ['Events',events.map(e=>EV_LABELS[e]).join(', ')||'None'],
                ['Custom Templates',Object.keys(tmpls).length?Object.keys(tmpls).join(', '):'Using defaults'],
              ].map(([k,v])=>(
                <div key={k} className="nc-review-row">
                  <span className="nc-review-key">{k}</span>
                  <strong className="nc-review-val">{v}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="nc-modal-ftr">
          {step>0&&!isEdit&&<button className="btn btn--ghost" onClick={()=>setStep(s=>s-1)}>← Back</button>}
          <span style={{flex:1}}/>
          {step<STEPS.length-1
            ?<button className="btn btn--primary" onClick={()=>setStep(s=>s+1)} disabled={!canNext}>Next →</button>
            :<button className="btn btn--success" onClick={save} disabled={saving}>{saving?'Saving…':isEdit?'Save Changes':'Create Channel'}</button>
          }
        </div>
      </div>
    </div>
  )
}

// ─── history panel ────────────────────────────────────────────────────────────
function History({ onClose }) {
  const [logs,setLogs]       = useState([])
  const [loading,setLoading] = useState(true)
  const [f,setF]             = useState({eventType:'',channelType:'',status:'',page:1})
  const [total,setTotal]     = useState(0)
  const load = useCallback(async()=>{
    setLoading(true)
    try{ const r=await ncApi.getHistory({...f,limit:20});setLogs(r.logs||[]);setTotal(r.total||0) }
    catch{/*ignore*/}finally{setLoading(false)}
  },[f])
  useEffect(()=>{load()},[load])
  const statusCls={sent:'nc-ls-sent',failed:'nc-ls-fail',skipped:'nc-ls-skip',pending:'nc-ls-pend'}
  return (
    <div className="nc-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="nc-modal" style={{maxWidth:800}}>
        <div className="nc-modal-hdr">
          <h2>Notification History</h2>
          <button className="nc-close" onClick={onClose}>✕</button>
        </div>
        <div className="nc-modal-body">
          <div className="nc-hist-filters">
            <select className="nc-input nc-input--sm" value={f.eventType} onChange={e=>setF(x=>({...x,eventType:e.target.value,page:1}))}>
              <option value="">All Events</option>
              {ALL_EVENTS.map(ev=><option key={ev} value={ev}>{EV_LABELS[ev]}</option>)}
            </select>
            <select className="nc-input nc-input--sm" value={f.channelType} onChange={e=>setF(x=>({...x,channelType:e.target.value,page:1}))}>
              <option value="">All Channels</option>
              {Object.entries(CH_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select className="nc-input nc-input--sm" value={f.status} onChange={e=>setF(x=>({...x,status:e.target.value,page:1}))}>
              <option value="">All Status</option>
              <option value="sent">Sent</option><option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
            <button className="btn btn--sm btn--ghost" onClick={load}>↺</button>
          </div>
          {loading?<div className="nc-empty-msg">Loading…</div>:logs.length===0?<div className="nc-empty-msg">No logs found.</div>:(
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Event</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>
                  {logs.map(l=>(
                    <tr key={l.id}>
                      <td>{EV_LABELS[l.eventType]||l.eventType}</td>
                      <td>{CH_ICONS[l.channelType]} {CH_LABELS[l.channelType]||l.channelType}</td>
                      <td className="nc-recip-cell" title={l.recipient}>{l.recipient}</td>
                      <td><span className={`nc-log-status ${statusCls[l.status]||''}`}>{l.status}</span></td>
                      <td>{l.createdAt?new Date(l.createdAt).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total>20&&(
            <div className="nc-paging">
              <button className="btn btn--sm btn--ghost" disabled={f.page<=1} onClick={()=>setF(x=>({...x,page:x.page-1}))}>← Prev</button>
              <span>Page {f.page} of {Math.ceil(total/20)}</span>
              <button className="btn btn--sm btn--ghost" disabled={f.page*20>=total} onClick={()=>setF(x=>({...x,page:x.page+1}))}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── inline channel card ──────────────────────────────────────────────────────
function ChannelCard({ ch, testing, onTest, onEdit, onDelete, onToggle }) {
  const active=(ch.recipients||[]).filter(r=>r.enabled).length
  return (
    <div className={`settings-nc-card${ch.enabled?'':' settings-nc-card--off'}`}>
      <div className="settings-nc-card__left">
        <span className="settings-nc-card__icon">{CH_ICONS[ch.channelType]||'🔔'}</span>
        <div>
          <p className="settings-nc-card__name">{ch.name}</p>
          <p className="settings-nc-card__meta">{CH_LABELS[ch.channelType]||ch.channelType} · {ch.provider}</p>
          <p className="settings-nc-card__meta">{active} recipient{active!==1?'s':''} · {ch._count?.logs||0} sent</p>
        </div>
      </div>
      <div className="settings-nc-card__right">
        <span className={`settings-nc-badge ${ch.enabled?'settings-nc-badge--on':'settings-nc-badge--off'}`}>{ch.enabled?'Enabled':'Disabled'}</span>
        <button className="btn btn--sm btn--secondary" onClick={()=>onEdit(ch)}>Configure</button>
        <button className={`btn btn--sm ${testing===ch.id?'btn--secondary':'btn--primary'}`}
          onClick={()=>onTest(ch.id)} disabled={testing===ch.id||!ch.enabled}>
          {testing===ch.id?'Sending…':'Test'}
        </button>
        <button className={`btn btn--sm ${ch.enabled?'btn--ghost':'btn--success'}`} onClick={()=>onToggle(ch.id,!ch.enabled)}>
          {ch.enabled?'Disable':'Enable'}
        </button>
        <button className="btn btn--sm btn--danger" onClick={()=>onDelete(ch.id)}>✕</button>
      </div>
    </div>
  )
}

// ─── notification channels section (embedded in Settings) ────────────────────
function NotificationChannelsSection() {
  const toast = useToast()
  const [channels,setChannels] = useState([])
  const [meta,setMeta]         = useState(null)
  const [loading,setLoading]   = useState(true)
  const [testing,setTesting]   = useState(null)
  const [wizard,setWizard]     = useState(false)
  const [editCh,setEditCh]     = useState(null)
  const [delConfirm,setDelConfirm] = useState(null)
  const [showHistory,setShowHistory] = useState(false)

  const load = useCallback(async()=>{
    setLoading(true)
    try{
      const [cr,mr]=await Promise.all([ncApi.getChannels(),ncApi.getMetadata()])
      setChannels(cr.channels||[]);setMeta(mr.metadata||null)
    }catch(e){toast.error(e.message)}
    finally{setLoading(false)}
  },[toast])

  useEffect(()=>{load()},[load])

  async function handleTest(id){
    setTesting(id)
    try{
      const r=await ncApi.testChannel(id)
      r?.success?toast.success('Test notification sent!'):toast.error(r?.message||'Test failed')
    }catch(e){toast.error(e.message)}
    finally{setTesting(null)}
  }

  async function handleToggle(id,enabled){
    try{
      await ncApi.toggleChannelStatus(id,enabled)
      setChannels(cs=>cs.map(c=>c.id===id?{...c,enabled}:c))
      toast.success(`Channel ${enabled?'enabled':'disabled'}`)
    }catch(e){toast.error(e.message)}
  }

  async function handleDelete(id){
    try{
      await ncApi.deleteChannel(id)
      setChannels(cs=>cs.filter(c=>c.id!==id))
      setDelConfirm(null);toast.success('Channel deleted')
    }catch(e){toast.error(e.message)}
  }

  async function handleSave({isEdit,channelId,ct,prov,name,cfg,recips,events,tmpls}){
    try{
      let ch
      if(isEdit){ch=(await ncApi.updateChannel(channelId,{name,configuration:cfg,enabled:true})).channel}
      else{ch=(await ncApi.createChannel({channelType:ct,provider:prov,name,configuration:cfg,enabled:true})).channel}
      for(const r of recips){
        if(r._new) await ncApi.addRecipient(ch.id,{recipientType:r.recipientType,recipientValue:r.recipientValue,label:r.label,enabled:r.enabled,eventTypes:r.eventTypes?.length?r.eventTypes:null}).catch(()=>{})
      }
      for(const [ev,tmpl] of Object.entries(tmpls)){
        if(tmpl?.body) await ncApi.createTemplate({notificationChannelId:ch.id,eventType:ev,subject:tmpl.subject||'',body:tmpl.body,format:'text'}).catch(()=>{})
      }
      toast.success(isEdit?'Channel updated!':'Channel created!')
      setWizard(false);setEditCh(null);load()
    }catch(e){toast.error(e.message||'Failed to save channel');throw e}
  }

  if(loading) return <div className="settings-hint" style={{padding:'8px 0'}}>Loading channels…</div>

  return (
    <div className="settings-nc-section">
      {channels.length===0?(
        <div className="settings-nc-empty">
          <p>No notification channels configured yet.</p>
          <p className="settings-hint">Add a channel to receive automatic email, Teams, or Slack alerts.</p>
        </div>
      ):(
        <div className="settings-nc-list">
          {channels.map(ch=>(
            <ChannelCard key={ch.id} ch={ch} testing={testing}
              onTest={handleTest}
              onEdit={c=>{setEditCh(c);setWizard(true)}}
              onDelete={id=>setDelConfirm(id)}
              onToggle={handleToggle}/>
          ))}
        </div>
      )}

      <div className="settings-nc-actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={()=>{setEditCh(null);setWizard(true)}}>
          + Add Channel
        </button>
        {channels.length>0&&(
          <button type="button" className="btn btn--ghost btn--sm" onClick={()=>setShowHistory(true)}>
            View History
          </button>
        )}
      </div>

      {delConfirm&&(
        <div className="settings-nc-confirm">
          <p>Delete this channel and all its recipients and logs?</p>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button className="btn btn--sm btn--ghost" onClick={()=>setDelConfirm(null)}>Cancel</button>
            <button className="btn btn--sm btn--danger" onClick={()=>handleDelete(delConfirm)}>Delete</button>
          </div>
        </div>
      )}

      {wizard&&<Wizard meta={meta} editCh={editCh} onSave={handleSave} onClose={()=>{setWizard(false);setEditCh(null)}}/>}
      {showHistory&&<History onClose={()=>setShowHistory(false)}/>}
    </div>
  )
}

// ─── main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth()
  const role = user?.role
  const isVendorAdmin = role === ROLES.VENDOR_ADMIN
  const isSuperAdmin  = role === ROLES.SUPER_ADMIN

  const [settings,setSettings] = useState({
    officeName:'',timeZone:'UTC',reportFrequency:'daily',
    sessionTimeout:28800,passwordPolicy:'min 8 chars, 1 uppercase, 1 number',
  })
  const [orgName,setOrgName]         = useState('')
  const [saved,setSaved]             = useState(false)
  const [loading,setLoading]         = useState(true)
  const [submitError,setSubmitError] = useState(null)
  const toast = useToast()

  useEffect(()=>{
    let mounted=true
    async function load(){
      setLoading(true)
      try{
        const url=isSuperAdmin&&user?.organizationId
          ?`/api/settings?organizationId=${encodeURIComponent(user.organizationId)}`
          :'/api/settings'
        const data=await api.get(url)
        if(mounted&&data.settings){
          setSettings(prev=>({...prev,
            reportFrequency:data.settings.reportFrequency||'daily',
            sessionTimeout:data.settings.sessionTimeout||28800,
            passwordPolicy:data.settings.passwordPolicy||'min 8 chars, 1 uppercase, 1 number',
          }))
        }
        if(user?.organizationId){
          try{
            const locData=await api.get(`/api/locations?organizationId=${user.organizationId}`)
            if(mounted&&locData?.locations?.length) setOrgName(locData.locations[0]?.officeName||'')
          }catch{/*non-critical*/}
        }
      }catch(e){console.error('Settings load error:',e)}
      finally{if(mounted)setLoading(false)}
    }
    load()
    return()=>{mounted=false}
  },[isSuperAdmin,user?.organizationId])

  function handleChange(field,value){setSettings(s=>({...s,[field]:value}));setSaved(false);setSubmitError(null)}

  async function handleSubmit(e){
    e.preventDefault();setSubmitError(null)
    try{
      const payload={organizationId:user?.organizationId,reportFrequency:settings.reportFrequency,sessionTimeout:settings.sessionTimeout}
      if(isSuperAdmin) payload.passwordPolicy=settings.passwordPolicy
      await api.put('/api/settings',payload)
      setSaved(true);setTimeout(()=>setSaved(false),3000);toast.success('Settings saved.')
    }catch(err){setSubmitError(err.message||'Failed to save settings');toast.error(err.message||'Failed to save settings.')}
  }

  if(loading) return <div className="page"><div className="loader-wrap"><div className="loader"/></div></div>

  return (
    <div className="page settings-page">
      <form className="settings-content" onSubmit={handleSubmit}>

        {/* ── Organisation ─────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">🏢</span>
            <div>
              <h3 className="settings-card__title">Organisation</h3>
              <p className="settings-card__desc">Your organisation profile and regional settings.</p>
            </div>
          </div>
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Organisation Name <span className="settings-badge settings-badge--locked">Read only</span></label>
              <input value={orgName||user?.organizationId||'—'} disabled className="settings-input settings-input--locked" title="Update via Site Configuration"/>
              <p className="settings-hint">To update the name, go to Site Configuration.</p>
            </div>
            {isSuperAdmin&&(
              <div className="settings-field">
                <label className="settings-label">Time Zone</label>
                <select value={settings.timeZone} onChange={e=>handleChange('timeZone',e.target.value)} className="settings-input">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern (US)</option>
                  <option value="America/Chicago">Central (US)</option>
                  <option value="America/Los_Angeles">Pacific (US)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* ── Notification Channels — vendor admin only ────────── */}
        {isVendorAdmin&&(
          <section className="settings-card">
            <div className="settings-card__header">
              <span className="settings-card__icon">🔔</span>
              <div>
                <h3 className="settings-card__title">Notification Channels</h3>
                <p className="settings-card__desc">
                  Configure email, Teams, Slack and webhooks. Alerts fire automatically when a device sends unhappy or emergency feedback.
                </p>
              </div>
            </div>
            <NotificationChannelsSection/>
          </section>
        )}

        {/* ── Reports ──────────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">📊</span>
            <div>
              <h3 className="settings-card__title">Reports</h3>
              <p className="settings-card__desc">Control how often scheduled reports are generated.</p>
            </div>
          </div>
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Report Frequency</label>
              <select value={settings.reportFrequency} onChange={e=>handleChange('reportFrequency',e.target.value)} className="settings-input">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p className="settings-hint">Reports will be auto-generated at the selected cadence.</p>
            </div>
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────────── */}
        {(isSuperAdmin||isVendorAdmin)&&(
          <section className="settings-card">
            <div className="settings-card__header">
              <span className="settings-card__icon">🔒</span>
              <div>
                <h3 className="settings-card__title">Security</h3>
                <p className="settings-card__desc">{isSuperAdmin?'Global security settings applied across all organisations.':'Security settings are managed by your Super Admin.'}</p>
              </div>
            </div>
            <div className="settings-grid">
              <div className="settings-field">
                <label className="settings-label">Session Timeout (seconds){isVendorAdmin&&<span className="settings-badge settings-badge--locked">Read only</span>}</label>
                <input type="number" min="300" value={settings.sessionTimeout}
                  onChange={e=>handleChange('sessionTimeout',Number(e.target.value))}
                  disabled={isVendorAdmin}
                  className={`settings-input ${isVendorAdmin?'settings-input--locked':''}`}/>
                <p className="settings-hint">
                  {Math.floor(settings.sessionTimeout/3600)>0
                    ?`${Math.floor(settings.sessionTimeout/3600)}h ${Math.floor((settings.sessionTimeout%3600)/60)}m`
                    :`${Math.floor(settings.sessionTimeout/60)} minutes`}
                </p>
              </div>
              {isSuperAdmin&&(
                <div className="settings-field">
                  <label className="settings-label">Password Policy</label>
                  <input value={settings.passwordPolicy} onChange={e=>handleChange('passwordPolicy',e.target.value)}
                    placeholder="min 8 chars, 1 uppercase, 1 number" className="settings-input"/>
                  <p className="settings-hint">Displayed to users when they set or reset their password.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Save bar ─────────────────────────────────────────── */}
        <div className="settings-save-bar">
          <div className="settings-save-bar__feedback">
            {saved       &&<span className="settings-status settings-status--ok">✓ Settings saved</span>}
            {submitError &&<span className="settings-status settings-status--error">✗ {submitError}</span>}
          </div>
          <button type="submit" className="btn btn--primary settings-save-btn">Save Settings</button>
        </div>

      </form>
    </div>
  )
}
