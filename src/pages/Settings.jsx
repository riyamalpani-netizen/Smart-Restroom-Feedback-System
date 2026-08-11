import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState({
    officeName: '',
    timeZone: 'UTC',
    alertThreshold: 3,
    teamsWebhook: '',
    reportFrequency: 'daily',
    autoEmailReports: false,
    sessionTimeout: 30,
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const canEdit = user?.role !== 'viewer'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/settings')
        if (mounted && data.settings) {
          setSettings({
            officeName: '',
            timeZone: data.settings.timezone || 'UTC',
            alertThreshold: data.settings.alertThreshold || 3,
            teamsWebhook: data.settings.teamsWebhook || '',
            reportFrequency: data.settings.reportFrequency || 'daily',
            autoEmailReports: false,
            sessionTimeout: data.settings.sessionTimeout || 30,
          })
        }
      } catch (e) {
        console.error('Settings load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  function handleChange(field, value) {
    setSettings({ ...settings, [field]: value })
    setSaved(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const orgId = JSON.parse(localStorage.getItem('srfs_user') || '{}')?.organizationId
      await api.put('/api/settings', {
        organizationId: orgId,
        teamsWebhook: settings.teamsWebhook,
        reportFrequency: settings.reportFrequency,
        sessionTimeout: settings.sessionTimeout,
        passwordPolicy: settings.passwordPolicy,
      })
      setSaved(true)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleTestWebhook() {
    try {
      await api.post('/api/settings/test-teams-webhook', { teamsWebhook: settings.teamsWebhook })
      alert('Test webhook sent successfully')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Configure office, alerts, and notification preferences"
      />

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : canEdit ? (
        <form className="settings-form card" onSubmit={handleSubmit}>
          <section className="settings-section">
            <h3>General</h3>
            <label>
              Office Name
              <input
                value={settings.officeName}
                onChange={(e) => handleChange('officeName', e.target.value)}
                disabled
              />
            </label>
            <label>
              Time Zone
              <select
                value={settings.timeZone}
                onChange={(e) => handleChange('timeZone', e.target.value)}
                className="select"
              >
                <option value="America/New_York">Eastern (US)</option>
                <option value="America/Chicago">Central (US)</option>
                <option value="America/Los_Angeles">Pacific (US)</option>
                <option value="Asia/Kolkata">India (IST)</option>
              </select>
            </label>
          </section>

          <section className="settings-section">
            <h3>Alerts & Notifications</h3>
            <label>
              Alert Threshold (unhappy feedback count)
              <input
                type="number"
                min="1"
                value={settings.alertThreshold}
                onChange={(e) => handleChange('alertThreshold', Number(e.target.value))}
              />
            </label>
            <label>
              Teams Webhook URL
              <input
                value={settings.teamsWebhook}
                onChange={(e) => handleChange('teamsWebhook', e.target.value)}
                placeholder="https://outlook.office.com/webhook/..."
              />
            </label>
            <button type="button" className="btn btn--secondary" onClick={handleTestWebhook}>
              Test Teams Webhook
            </button>
            <label>
              Report Frequency
              <select
                value={settings.reportFrequency}
                onChange={(e) => handleChange('reportFrequency', e.target.value)}
                className="select"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </section>

          <section className="settings-section">
            <h3>Security</h3>
            <label>
              Session Timeout (seconds)
              <input
                type="number"
                min="5"
                value={settings.sessionTimeout}
                onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
              />
            </label>
          </section>

          <div className="settings-form__actions">
            <button type="submit" className="btn btn--primary">Save Settings</button>
            {saved && <span className="settings-form__saved">Settings saved!</span>}
          </div>
        </form>
      ) : (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
          Viewers cannot edit settings.
        </div>
      )}
    </div>
  )
}
