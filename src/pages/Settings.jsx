import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
import { useToast } from '../context/ToastContext'

export default function Settings() {
  const { user } = useAuth()
  const role = user?.role
  const isVendorAdmin = role === ROLES.VENDOR_ADMIN
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  const [settings, setSettings] = useState({
    officeName: '',
    timeZone: 'UTC',
    teamsWebhook: '',
    teamsRecipient: 'Operations Teams channel',
    reportFrequency: 'daily',
    sessionTimeout: 28800,
    passwordPolicy: 'min 8 chars, 1 uppercase, 1 number',
  })
  const [orgName, setOrgName] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState(null)
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [webhookStatus, setWebhookStatus] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const settingsUrl = isSuperAdmin && user?.organizationId
          ? `/api/settings?organizationId=${encodeURIComponent(user.organizationId)}`
          : '/api/settings'
        const data = await api.get(settingsUrl)
        if (mounted && data.settings) {
          setSettings((prev) => ({
            ...prev,
            teamsWebhook: data.settings.teamsWebhook || '',
            teamsRecipient: data.settings.teamsRecipient || 'Operations Teams channel',
            reportFrequency: data.settings.reportFrequency || 'daily',
            sessionTimeout: data.settings.sessionTimeout || 28800,
            passwordPolicy: data.settings.passwordPolicy || 'min 8 chars, 1 uppercase, 1 number',
          }))
        }
        if (user?.organizationId) {
          try {
            const locData = await api.get(`/api/locations?organizationId=${user.organizationId}`)
            if (mounted && locData?.locations?.length) {
              setOrgName(locData.locations[0]?.officeName || '')
            }
          } catch { /* non-critical */ }
        }
      } catch (e) {
        console.error('Settings load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [isSuperAdmin, user?.organizationId])

  function handleChange(field, value) {
    setSettings((s) => ({ ...s, [field]: value }))
    setSaved(false)
    setSubmitError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    try {
      const payload = {
        organizationId: user?.organizationId,
        teamsWebhook: settings.teamsWebhook,
        teamsRecipient: settings.teamsRecipient,
        reportFrequency: settings.reportFrequency,
        sessionTimeout: settings.sessionTimeout,
      }
      if (isSuperAdmin) payload.passwordPolicy = settings.passwordPolicy
      await api.put('/api/settings', payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      toast.success('Settings saved.')
    } catch (err) {
      setSubmitError(err.message || 'Failed to save settings')
      toast.error(err.message || 'Failed to save settings.')
    }
  }

  async function handleTestWebhook() {
    setWebhookTesting(true)
    setWebhookStatus(null)
    try {
      await api.post('/api/settings/test-teams-webhook', { teamsWebhook: settings.teamsWebhook })
      setWebhookStatus('ok')
    } catch {
      setWebhookStatus('error')
    } finally {
      setWebhookTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loader-wrap"><div className="loader" /></div>
      </div>
    )
  }

  return (
    <div className="page settings-page">
      <form className="settings-content" onSubmit={handleSubmit}>

        {/* ── Organisation ─────────────────────────────────────────────── */}
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
              <label className="settings-label">
                Organisation Name
                <span className="settings-badge settings-badge--locked">Read only</span>
              </label>
              <input
                value={orgName || user?.organizationId || '—'}
                disabled
                className="settings-input settings-input--locked"
                title="Update via Site Configuration"
              />
              <p className="settings-hint">To update the name, go to Site Configuration.</p>
            </div>
            {isSuperAdmin && (
              <div className="settings-field">
                <label className="settings-label">Time Zone</label>
                <select
                  value={settings.timeZone}
                  onChange={(e) => handleChange('timeZone', e.target.value)}
                  className="settings-input"
                >
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

        {/* ── Notifications ─────────────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">🔔</span>
            <div>
              <h3 className="settings-card__title">Notifications</h3>
              <p className="settings-card__desc">Configure how alerts are delivered to your team.</p>
              {settings.teamsWebhook && (
                <p className="settings-hint" style={{ marginTop: 8, color: '#15803d' }}>
                  ✓ Connected to: {settings.teamsRecipient || 'Operations Teams channel'}
                </p>
              )}
            </div>
          </div>
          <div className="settings-grid">
            <div className="settings-field settings-field--full">
              <label className="settings-label">Microsoft Teams Webhook URL</label>
              <div className="settings-input-row">
                <input
                  value={settings.teamsWebhook}
                  onChange={(e) => handleChange('teamsWebhook', e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                  type="url"
                  className="settings-input"
                />
                <button
                  type="button"
                  className={`btn settings-test-btn ${webhookStatus === 'ok' ? 'btn--success' : webhookStatus === 'error' ? 'btn--danger' : 'btn--secondary'}`}
                  onClick={handleTestWebhook}
                  disabled={!settings.teamsWebhook || webhookTesting}
                >
                  {webhookTesting ? 'Sending…' : webhookStatus === 'ok' ? '✓ Sent' : webhookStatus === 'error' ? '✗ Failed' : 'Test'}
                </button>
              </div>
              <p className="settings-hint">
                Paste a Teams incoming webhook URL to receive alert notifications in your Teams channel.
              </p>
            </div>
            <div className="settings-field">
              <label className="settings-label">Teams notification recipient</label>
              <input
                value={settings.teamsRecipient}
                onChange={(e) => handleChange('teamsRecipient', e.target.value)}
                placeholder="Operations Teams channel"
                className="settings-input"
              />
              <p className="settings-hint">Name the channel and on-call team that receives unhappy-event alerts.</p>
            </div>
          </div>
        </section>

        {/* ── Reports ───────────────────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">📊</span>
            <div>
              <h3 className="settings-card__title">Reports</h3>
              <p className="settings-card__desc">Control how often scheduled reports are generated and delivered.</p>
            </div>
          </div>
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Report Frequency</label>
              <select
                value={settings.reportFrequency}
                onChange={(e) => handleChange('reportFrequency', e.target.value)}
                className="settings-input"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p className="settings-hint">Reports will be auto-generated at the selected cadence.</p>
            </div>
          </div>
        </section>

        {/* ── Security ──────────────────────────────────────────────────── */}
        {(isSuperAdmin || isVendorAdmin) && (
          <section className="settings-card">
            <div className="settings-card__header">
              <span className="settings-card__icon">🔒</span>
              <div>
                <h3 className="settings-card__title">Security</h3>
                <p className="settings-card__desc">
                  {isSuperAdmin
                    ? 'Global security settings applied across all organisations.'
                    : 'Security settings are managed by your Super Admin.'}
                </p>
              </div>
            </div>
            <div className="settings-grid">
              <div className="settings-field">
                <label className="settings-label">
                  Session Timeout (seconds)
                  {isVendorAdmin && <span className="settings-badge settings-badge--locked">Read only</span>}
                </label>
                <input
                  type="number"
                  min="300"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
                  disabled={isVendorAdmin}
                  className={`settings-input ${isVendorAdmin ? 'settings-input--locked' : ''}`}
                />
                <p className="settings-hint">
                  {Math.floor(settings.sessionTimeout / 3600) > 0
                    ? `${Math.floor(settings.sessionTimeout / 3600)}h ${Math.floor((settings.sessionTimeout % 3600) / 60)}m`
                    : `${Math.floor(settings.sessionTimeout / 60)} minutes`}
                </p>
              </div>
              {isSuperAdmin && (
                <div className="settings-field">
                  <label className="settings-label">Password Policy</label>
                  <input
                    value={settings.passwordPolicy}
                    onChange={(e) => handleChange('passwordPolicy', e.target.value)}
                    placeholder="min 8 chars, 1 uppercase, 1 number"
                    className="settings-input"
                  />
                  <p className="settings-hint">Displayed to users when they set or reset their password.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Save bar ──────────────────────────────────────────────────── */}
        <div className="settings-save-bar">
          <div className="settings-save-bar__feedback">
            {saved && <span className="settings-status settings-status--ok">✓ Settings saved</span>}
            {submitError && <span className="settings-status settings-status--error">✗ {submitError}</span>}
          </div>
          <button type="submit" className="btn btn--primary settings-save-btn">
            Save Settings
          </button>
        </div>

      </form>
    </div>
  )
}
