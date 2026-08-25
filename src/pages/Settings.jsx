import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'

/**
 * Settings page
 *
 * - Super Admin: sees and can edit all settings sections including Security
 *   (session timeout, password policy) and global alert thresholds.
 * - Vendor Admin: sees and can edit their own organisation's profile,
 *   alert/notification settings. Cannot touch password policy.
 * - Viewer: read-only message (blocked at route level, but graceful fallback here).
 */
export default function Settings() {
  const { user } = useAuth()
  const role = user?.role
  const isVendorAdmin = role === ROLES.VENDOR_ADMIN
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  const [settings, setSettings] = useState({
    officeName: '',
    timeZone: 'UTC',
    alertThreshold: 3,
    teamsWebhook: '',
    reportFrequency: 'daily',
    sessionTimeout: 28800,
    passwordPolicy: 'min 8 chars, 1 uppercase, 1 number',
  })
  const [orgName, setOrgName] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        // Settings endpoint is scoped by the backend for vendor_admin automatically
        const data = await api.get('/api/settings')
        if (mounted && data.settings) {
          setSettings((prev) => ({
            ...prev,
            teamsWebhook: data.settings.teamsWebhook || '',
            reportFrequency: data.settings.reportFrequency || 'daily',
            sessionTimeout: data.settings.sessionTimeout || 28800,
            passwordPolicy: data.settings.passwordPolicy || 'min 8 chars, 1 uppercase, 1 number',
          }))
        }

        // Fetch org name for the vendor profile section
        if (user?.organizationId) {
          try {
            const locData = await api.get(`/api/locations?organizationId=${user.organizationId}`)
            if (mounted && locData?.locations?.length) {
              setOrgName(locData.locations[0]?.officeName || '')
            }
          } catch {
            // non-critical — org name is display only
          }
        }
      } catch (e) {
        console.error('Settings load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user?.organizationId])

  function handleChange(field, value) {
    setSettings({ ...settings, [field]: value })
    setSaved(false)
    setSubmitError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    try {
      const orgId = user?.organizationId
      const payload = {
        organizationId: orgId,
        teamsWebhook: settings.teamsWebhook,
        reportFrequency: settings.reportFrequency,
        sessionTimeout: settings.sessionTimeout,
      }
      // Only super_admin sends passwordPolicy
      if (isSuperAdmin) {
        payload.passwordPolicy = settings.passwordPolicy
      }
      await api.put('/api/settings', payload)
      setSaved(true)
    } catch (err) {
      setSubmitError(err.message || 'Failed to save settings')
    }
  }

  async function handleTestWebhook() {
    try {
      await api.post('/api/settings/test-teams-webhook', {
        teamsWebhook: settings.teamsWebhook,
      })
      alert('Test webhook sent successfully')
    } catch (err) {
      alert(err.message || 'Failed to send test webhook')
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
    <div className="page">
      <form className="settings-form card" onSubmit={handleSubmit}>

        {/* ── Section 1: Vendor / Organisation Profile ──────────────────── */}
        <section className="settings-section">
          <h3>
            {isVendorAdmin ? 'Vendor Profile' : 'Organisation'}
          </h3>
          {isVendorAdmin && (
            <p className="settings-section__desc">
              Manage your vendor organisation profile and notification preferences.
            </p>
          )}
          <label>
            Organisation Name
            <input
              value={orgName}
              disabled
              title="Update the organisation name via Site Configuration"
              className="input--locked"
            />
          </label>
          {isSuperAdmin && (
            <label>
              Time Zone
              <select
                value={settings.timeZone}
                onChange={(e) => handleChange('timeZone', e.target.value)}
                className="select"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern (US)</option>
                <option value="America/Chicago">Central (US)</option>
                <option value="America/Los_Angeles">Pacific (US)</option>
                <option value="Asia/Kolkata">India (IST)</option>
              </select>
            </label>
          )}
        </section>

        {/* ── Section 2: Alerts & Notifications ─────────────────────────── */}
        <section className="settings-section">
          <h3>Alerts &amp; Notifications</h3>
          <p className="settings-section__desc">
            Configure how your organisation receives alert notifications.
          </p>

          <label>
            Alert Threshold
            <span className="label-hint">(unhappy feedback count before alert is raised)</span>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.alertThreshold}
              onChange={(e) => handleChange('alertThreshold', Number(e.target.value))}
            />
          </label>

          <label>
            Microsoft Teams Webhook URL
            <input
              value={settings.teamsWebhook}
              onChange={(e) => handleChange('teamsWebhook', e.target.value)}
              placeholder="https://outlook.office.com/webhook/..."
              type="url"
            />
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleTestWebhook}
            disabled={!settings.teamsWebhook}
          >
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

        {/* ── Section 3: Security — Super Admin only ─────────────────────── */}
        {isSuperAdmin && (
          <section className="settings-section">
            <h3>Security</h3>
            <p className="settings-section__desc">
              Global security settings. These apply across all organisations.
            </p>
            <label>
              Session Timeout (seconds)
              <input
                type="number"
                min="300"
                value={settings.sessionTimeout}
                onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
              />
            </label>
            <label>
              Password Policy
              <input
                value={settings.passwordPolicy}
                onChange={(e) => handleChange('passwordPolicy', e.target.value)}
                placeholder="min 8 chars, 1 uppercase, 1 number"
              />
            </label>
          </section>
        )}

        {/* Vendor Admin — informational note about what they cannot change */}
        {isVendorAdmin && (
          <section className="settings-section settings-section--info">
            <h3>Security</h3>
            <p className="settings-section__desc text-muted">
              Session timeout and password policy are managed by your Super Admin and cannot
              be changed here.
            </p>
            <label>
              Session Timeout (seconds)
              <input
                type="number"
                value={settings.sessionTimeout}
                disabled
                className="input--locked"
                title="Managed by Super Admin"
              />
            </label>
          </section>
        )}

        <div className="settings-form__actions">
          <button type="submit" className="btn btn--primary">
            Save Settings
          </button>
          {saved && (
            <span className="settings-form__saved" role="status">
              Settings saved!
            </span>
          )}
          {submitError && (
            <span className="settings-form__error" role="alert">
              {submitError}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
