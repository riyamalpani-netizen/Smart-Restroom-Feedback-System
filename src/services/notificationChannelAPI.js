/**
 * notificationChannelAPI — all frontend calls for the Notification Channel
 * management system. Mirrors the routes in notificationChannelRoutes.js.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('srfs_token')
}

async function req(path, options = {}) {
  const token = getToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (response.status === 401) {
    localStorage.removeItem('srfs_token')
    window.location.href = '/login'
    return Promise.reject(new Error('Unauthorized'))
  }
  if (!response.ok) {
    const text = await response.text()
    let message = text || response.statusText
    try { message = JSON.parse(text).message || message } catch { /* ignore */ }
    return Promise.reject(new Error(message))
  }
  if (response.status === 204) return null
  return response.json()
}

// ── Provider / channel metadata ────────────────────────────────────────────
export const getMetadata = () => req('/api/notifications/metadata')

// ── Channels ───────────────────────────────────────────────────────────────
export const getChannels = () => req('/api/notifications/channels')
export const getChannelById = (id) => req(`/api/notifications/channels/${encodeURIComponent(id)}`)
export const createChannel = (data) => req('/api/notifications/channels', { method: 'POST', body: JSON.stringify(data) })
export const updateChannel = (id, data) => req(`/api/notifications/channels/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteChannel = (id) => req(`/api/notifications/channels/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const toggleChannelStatus = (id, enabled) => req(`/api/notifications/channels/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ enabled }) })
export const testChannel = (id) => req(`/api/notifications/channels/${encodeURIComponent(id)}/test`, { method: 'POST' })

// ── Recipients ─────────────────────────────────────────────────────────────
export const addRecipient = (channelId, data) => req(`/api/notifications/channels/${encodeURIComponent(channelId)}/recipients`, { method: 'POST', body: JSON.stringify(data) })
export const updateRecipient = (id, data) => req(`/api/notifications/recipients/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteRecipient = (id) => req(`/api/notifications/recipients/${encodeURIComponent(id)}`, { method: 'DELETE' })

// ── Templates ──────────────────────────────────────────────────────────────
export const getTemplates = () => req('/api/notifications/templates')
export const createTemplate = (data) => req('/api/notifications/templates', { method: 'POST', body: JSON.stringify(data) })
export const updateTemplate = (id, data) => req(`/api/notifications/templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })

// ── History ────────────────────────────────────────────────────────────────
export const getHistory = (params = {}) => {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, v) })
  const q = qs.toString()
  return req(`/api/notifications/history${q ? `?${q}` : ''}`)
}

// ── Gmail OAuth2 ───────────────────────────────────────────────────────────
export const getGmailAuthUrl = () => req('/api/notifications/gmail/auth-url')
export const disconnectGmail = (channelId) => req(`/api/notifications/gmail/disconnect/${encodeURIComponent(channelId)}`, { method: 'POST' })

export default {
  getMetadata, getChannels, getChannelById, createChannel, updateChannel,
  deleteChannel, toggleChannelStatus, testChannel,
  addRecipient, updateRecipient, deleteRecipient,
  getTemplates, createTemplate, updateTemplate,
  getHistory,
}
