import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../context/ToastContext'
import * as ncApi from '../services/notificationChannelAPI'
import './NotificationChannels.css'

// ── Gmail OAuth2 Connect Button ───────────────────────────────────────────────
function GmailConnectButton({ connected, gmailAddress, onSuccess, onDisconnect }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await ncApi.getGmailAuthUrl()
      if (!res?.url) { toast.error('Gmail OAuth not configured on server'); setLoading(false); return }

      const popup = window.open(res.url, 'gmail-oauth', 'width=520,height=620,scrollbars=yes')

      function onMessage(e) {
        if (e.data?.type === 'GMAIL_OAUTH_SUCCESS') {
          window.removeEventListener('message', onMessage)
          onSuccess(e.data)
          toast.success(`Gmail connected: ${e.data.gmailAddress}`)
          setLoading(false)
          popup?.close()
        } else if (e.data?.type === 'GMAIL_OAUTH_ERROR') {
          window.removeEventListener('message', onMessage)
          toast.error(`Gmail connection failed: ${e.data.error}`)
          setLoading(false)
        }
      }
      window.addEventListener('message', onMessage)

      // Fallback: if popup closes without sending message
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer)
          window.removeEventListener('message', onMessage)
          setLoading(false)
        }
      }, 500)
    } catch (e) {
      toast.error(e.message || 'Failed to start Gmail OAuth')
      setLoading(false)
    }
  }

  if (connected) return (
    <div className="nc-gmail-connected">
      <span className="nc-gmail-check">✅</span>
      <div>
        <strong>Gmail connected</strong>
        <p className="nc-hint">{gmailAddress}</p>
      </div>
      <button className="btn btn--sm btn--ghost" onClick={onDisconnect} style={{marginLeft:'auto'}}>Disconnect</button>
    </div>
  )

  return (
    <div className="nc-gmail-connect">
      <p className="nc-hint" style={{marginBottom:10}}>
        Click below to authorize with your Google account. No password required.
      </p>
      <button className="btn btn--google" onClick={handleConnect} disabled={loading}>
        <svg width="18" height="18" viewBox="0 0 48 48" style={{marginRight:8,flexShrink:0}}>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
        {loading ? 'Opening Google…' : 'Connect Gmail Account'}
      </button>
    </div>
  )
}

const CH_ICONS  = { email:'✉️', teams:'💬', slack:'⚡', webhook:'🔗', sms:'📱', push:'🔔' }
const CH_LABELS = { email:'Email', teams:'Microsoft Teams', slack:'Slack', webhook:'Custom Webhook', sms:'SMS', push:'Push' }
const EV_LABELS = {
  unhappy_feedback:'Unhappy Feedback', emergency_feedback:'Emergency Feedback',
  device_offline:'Device Offline', low_battery:'Low Battery',
  gateway_offline:'Gateway Offline', system_alert:'System Alert',
}
const ALL_EVENTS = Object.keys(EV_LABELS)
const STEPS = ['Channel','Provider','Configure','Recipients','Template','Review']

// ─── helpers ──────────────────────────────────────────────────────────────────
function getAuthModes(meta, ct, p) {
  const prov = meta?.[ct]?.providers?.[p]
  return prov?.authModes
    ? Object.entries(prov.authModes).map(([k,v])=>({key:k,label:v.label}))
    : null
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
      {f.label}
      {f.hint && <span className="nc-hint">{f.hint}</span>}
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
      <input
        className="nc-input"
        type={f.type==='password'?'password':f.type==='number'?'number':f.type==='url'?'url':f.type==='email'?'email':'text'}
        value={val||''} onChange={e=>onChange(f.key,e.target.value)}
        placeholder={f.placeholder||''}
        autoComplete={f.type==='password'?'new-password':undefined}
      />
      {f.hint&&<p className="nc-hint">{f.hint}</p>}
    </div>
  )
}

// ─── channel card ─────────────────────────────────────────────────────────────
function ChannelCard({ ch, testing, onTest, onEdit, onDelete, onToggle }) {
  const active = (ch.recipients||[]).filter(r=>r.enabled).length
  return (
    <div className={`nc-card${ch.enabled?'':' nc-card--disabled'}`}>
      <div className="nc-card-header">
        <span className="nc-card-icon">{CH_ICONS[ch.channelType]||'🔔'}</span>
        <div className="nc-card-info">
          <h3 className="nc-card-name">{ch.name}</h3>
          <p className="nc-card-meta">{CH_LABELS[ch.channelType]||ch.channelType} · {ch.provider}</p>
        </div>
        <span className={`nc-badge nc-badge--${ch.enabled?'on':'off'}`}>{ch.enabled?'Enabled':'Disabled'}</span>
      </div>
      <div className="nc-card-stats">
        <span>📨 {active}/{(ch.recipients||[]).length} recipients</span>
        <span>📋 {ch._count?.logs||0} sent</span>
      </div>
      <div className="nc-card-actions">
        <button className="btn btn--sm btn--secondary" onClick={()=>onEdit(ch)}>Configure</button>
        <button className={`btn btn--sm ${testing===ch.id?'btn--secondary':'btn--primary'}`}
          onClick={()=>onTest(ch.id)} disabled={testing===ch.id||!ch.enabled}>
          {testing===ch.id?'Sending…':'Test'}
        </button>
        <button className={`btn btn--sm ${ch.enabled?'btn--ghost':'btn--success'}`}
          onClick={()=>onToggle(ch.id,!ch.enabled)}>
          {ch.enabled?'Disable':'Enable'}
        </button>
        <button className="btn btn--sm btn--danger" onClick={()=>onDelete(ch.id)}>Delete</button>
      </div>
    </div>
  )
}

// ─── wizard ───────────────────────────────────────────────────────────────────
function Wizard({ meta, editCh, onSave, onClose }) {
  const isEdit = !!editCh
  const [step, setStep]           = useState(isEdit ? 2 : 0)
  const [ct, setCt]               = useState(editCh?.channelType||'')
  const [prov, setProv]           = useState(editCh?.provider||'')
  const [name, setName]           = useState(editCh?.name||'')
  const [authMode, setAuthMode]   = useState('')
  const [cfg, setCfg]             = useState(editCh?.configuration||{})
  const [recips, setRecips]       = useState(editCh?.recipients||[])
  const [newRec, setNewRec]       = useState({val:'',lbl:'',evs:[]})
  const [events, setEvents]       = useState(
    editCh?.templates?.map(t=>t.eventType)||['unhappy_feedback','emergency_feedback']
  )
  const [tmpls, setTmpls]         = useState({})
  const [saving, setSaving]       = useState(false)
  const toast = useToast()

  const ams   = meta ? getAuthModes(meta,ct,prov) : null
  const effAm = authMode || ams?.[0]?.key || ''
  const fields= meta ? getFields(meta,ct,prov,effAm) : []

  function setC(k,v){ setCfg(c=>({...c,[k]:v})) }

  function pickCt(c){
    setCt(c)
    const ps=meta?Object.keys(meta[c]?.providers||{}):[]
    setProv(ps[0]||''); setAuthMode(''); setCfg({}); setStep(1)
  }
  function pickProv(p){ setProv(p); setAuthMode(''); setCfg({}); setStep(2) }

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

  const canNext = step===0?!!ct : step===1?!!prov : step===2?!!name : true

  return (
    <div className="nc-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="nc-modal">
        <div className="nc-modal-hdr">
          <h2>{isEdit?`Configure — ${editCh.name}`:'Add Notification Channel'}</h2>
          <button className="nc-close" onClick={onClose}>✕</button>
        </div>

        {/* steps bar */}
        <div className="nc-stepbar">
          {STEPS.map((s,i)=>(
            <div key={s} className={`nc-stepbar-item${i===step?' nc-stepbar-item--active':i<step?' nc-stepbar-item--done':''}`}>
              <span className="nc-stepbar-num">{i<step?'✓':i+1}</span>
              <span className="nc-stepbar-lbl">{s}</span>
            </div>
          ))}
        </div>

        <div className="nc-modal-body">

          {/* 0 – channel type */}
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

          {/* 1 – provider */}
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

          {/* 2 – configure */}
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

          {/* 3 – recipients */}
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
                        <button className="nc-icon-btn" onClick={()=>setRecips(rs=>rs.map((x,j)=>j===i?{...x,enabled:!x.enabled}:x))}>
                          {r.enabled?'✓':'○'}
                        </button>
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

          {/* 4 – template */}
          {step===4&&(
            <div>
              <p className="nc-step-desc">
                Customise message templates. Supports <code>{'{{variable}}'}</code> — siteName, floorName, restroomName, deviceId, feedbackType, priority, timestamp.
              </p>
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

          {/* 5 – review */}
          {step===5&&(
            <div className="nc-review">
              {[
                ['Channel', CH_LABELS[ct]||ct],
                ['Provider', meta?.[ct]?.providers?.[prov]?.label||prov],
                ['Name', name],
                ['Recipients', `${recips.length} configured`],
                ['Custom Templates', Object.keys(tmpls).length?Object.keys(tmpls).join(', '):'Using defaults'],
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
function History() {
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [f, setF]           = useState({eventType:'',channelType:'',status:'',page:1})
  const [total, setTotal]   = useState(0)

  const load = useCallback(async()=>{
    setLoading(true)
    try{
      const r = await ncApi.getHistory({...f,limit:20})
      setLogs(r.logs||[]); setTotal(r.total||0)
    }catch{ /* ignore */ }finally{ setLoading(false) }
  },[f])

  useEffect(()=>{load()},[load])

  const statusCls = {sent:'nc-ls-sent',failed:'nc-ls-fail',skipped:'nc-ls-skip',pending:'nc-ls-pend'}

  return (
    <div className="nc-history">
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
          <option value="skipped">Skipped</option><option value="pending">Pending</option>
        </select>
        <button className="btn btn--sm btn--ghost" onClick={load}>↺</button>
      </div>

      {loading?<div className="nc-empty-msg">Loading…</div>:logs.length===0?(
        <div className="nc-empty-msg">No notification logs found.</div>
      ):(
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr>
              <th>Event</th><th>Channel</th><th>Provider</th><th>Recipient</th><th>Status</th><th>Time</th>
            </tr></thead>
            <tbody>
              {logs.map(l=>(
                <tr key={l.id}>
                  <td>{EV_LABELS[l.eventType]||l.eventType}</td>
                  <td>{CH_ICONS[l.channelType]} {CH_LABELS[l.channelType]||l.channelType}</td>
                  <td>{l.provider}</td>
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
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function NotificationChannels() {
  const toast = useToast()
  const [channels, setChannels] = useState([])
  const [meta, setMeta]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [testing, setTesting]   = useState(null)
  const [wizard, setWizard]     = useState(false)
  const [editCh, setEditCh]     = useState(null)
  const [tab, setTab]           = useState('channels')
  const [delConfirm, setDelConfirm] = useState(null)

  const loadAll = useCallback(async()=>{
    setLoading(true)
    try{
      const [cr, mr] = await Promise.all([ncApi.getChannels(), ncApi.getMetadata()])
      setChannels(cr.channels||[]); setMeta(mr.metadata||null)
    }catch(e){ toast.error(e.message||'Failed to load channels') }
    finally{ setLoading(false) }
  },[toast])

  useEffect(()=>{loadAll()},[loadAll])

  async function handleTest(id){
    setTesting(id)
    try{
      const res = await ncApi.testChannel(id)
      if (res?.success) {
        toast.success('Test notification sent successfully!')
      } else {
        toast.error(res?.message || 'Test notification failed')
      }
    }
    catch(e){ toast.error(e.message||'Test failed') }
    finally{ setTesting(null) }
  }

  async function handleToggle(id, enabled){
    try{
      await ncApi.toggleChannelStatus(id, enabled)
      setChannels(cs=>cs.map(c=>c.id===id?{...c,enabled}:c))
      toast.success(`Channel ${enabled?'enabled':'disabled'}`)
    }catch(e){ toast.error(e.message) }
  }

  async function handleDelete(id){
    try{
      await ncApi.deleteChannel(id)
      setChannels(cs=>cs.filter(c=>c.id!==id))
      setDelConfirm(null); toast.success('Channel deleted')
    }catch(e){ toast.error(e.message) }
  }

  async function handleSave({ isEdit, channelId, ct, prov, name, cfg, recips, events, tmpls }){
    try{
      let ch
      if(isEdit){
        ch = (await ncApi.updateChannel(channelId,{name,configuration:cfg,enabled:true})).channel
      } else {
        ch = (await ncApi.createChannel({channelType:ct,provider:prov,name,configuration:cfg,enabled:true})).channel
      }
      for(const r of recips){
        if(r._new){
          await ncApi.addRecipient(ch.id,{
            recipientType:r.recipientType,recipientValue:r.recipientValue,
            label:r.label,enabled:r.enabled,eventTypes:r.eventTypes?.length?r.eventTypes:null,
          }).catch(()=>{})
        }
      }
      for(const [ev,tmpl] of Object.entries(tmpls)){
        if(tmpl?.body) await ncApi.createTemplate({notificationChannelId:ch.id,eventType:ev,subject:tmpl.subject||'',body:tmpl.body,format:'text'}).catch(()=>{})
      }
      toast.success(isEdit?'Channel updated!':'Channel created!')
      setWizard(false); setEditCh(null); loadAll()
    }catch(e){ toast.error(e.message||'Failed to save channel'); throw e }
  }

  if(loading) return <div className="page"><div className="loader-wrap"><div className="loader"/></div></div>

  return (
    <div className="page nc-page">
      <div className="nc-page-hdr">
        <div>
          <h1 className="nc-page-title">Notification Channels</h1>
          <p className="nc-page-sub">Configure email, Teams, Slack, webhooks and more for alert delivery.</p>
        </div>
        <button className="btn btn--primary" onClick={()=>{setEditCh(null);setWizard(true)}}>+ Add Channel</button>
      </div>

      <div className="tabs">
        <button className={`tab${tab==='channels'?' tab--active':''}`} onClick={()=>setTab('channels')}>
          Channels ({channels.length})
        </button>
        <button className={`tab${tab==='history'?' tab--active':''}`} onClick={()=>setTab('history')}>
          Notification History
        </button>
      </div>

      {tab==='channels'&&(
        channels.length===0
          ?<div className="nc-empty">
            <div className="nc-empty-icon">🔔</div>
            <h3>No notification channels yet</h3>
            <p>Add your first channel to start receiving alerts via email, Teams, Slack, or webhook.</p>
            <button className="btn btn--primary" onClick={()=>setWizard(true)}>+ Add Notification Channel</button>
          </div>
          :<div className="nc-cards">
            {channels.map(ch=>(
              <ChannelCard key={ch.id} ch={ch} testing={testing}
                onTest={handleTest}
                onEdit={c=>{setEditCh(c);setWizard(true)}}
                onDelete={id=>setDelConfirm(id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
      )}

      {tab==='history'&&<History/>}

      {wizard&&<Wizard meta={meta} editCh={editCh} onSave={handleSave} onClose={()=>{setWizard(false);setEditCh(null)}}/>}

      {delConfirm&&(
        <div className="nc-overlay" onClick={()=>setDelConfirm(null)}>
          <div className="nc-confirm" onClick={e=>e.stopPropagation()}>
            <h3>Delete channel?</h3>
            <p>This permanently deletes the channel, all its recipients, templates, and logs.</p>
            <div className="nc-confirm-acts">
              <button className="btn btn--ghost" onClick={()=>setDelConfirm(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={()=>handleDelete(delConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
