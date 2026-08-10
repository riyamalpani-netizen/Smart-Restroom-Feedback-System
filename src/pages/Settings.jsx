import { useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import { settings as initialSettings } from '../services/mockData'

export default function Settings() {
  const [settings, setSettings] = useState(initialSettings)
  const [saved, setSaved] = useState(false)

  function handleChange(field, value) {
    setSettings({ ...settings, [field]: value })
    setSaved(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSaved(true)
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Configure office, alerts, and notification preferences"
      />

      <form className="settings-form card" onSubmit={handleSubmit}>
        <section className="settings-section">
          <h3>General</h3>
          <label>
            Office Name
            <input
              value={settings.officeName}
              onChange={(e) => handleChange('officeName', e.target.value)}
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
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.autoEmailReports}
              onChange={(e) => handleChange('autoEmailReports', e.target.checked)}
            />
            Auto Email Reports
          </label>
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
            Session Timeout (minutes)
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
    </div>
  )
}
