const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('srfs_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const method = options.method || 'GET'
  console.log(`[API] ${method} ${path}`)

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
    try {
      const json = JSON.parse(text)
      message = json.message || message
      if (json.error && json.message === 'Internal server error') {
        message = json.error
      }
    } catch {
      // keep text as message
    }
    console.error(`[API] ${method} ${path} failed:`, message)
    return Promise.reject(new Error(message))
  }

  if (response.status === 204) {
    console.log(`[API] ${method} ${path} -> 204 No Content`)
    return null
  }

  const json = await response.json()
  console.log(`[API] ${method} ${path} ->`, json)
  return json
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

export const floorplanAPI = {
  getHeatmap: ({ period, siteId, floor }) =>
    request(`/api/dashboard/heatmap?period=${encodeURIComponent(period || 'today')}${siteId ? `&locationId=${encodeURIComponent(siteId)}` : ''}${floor ? `&floorId=${encodeURIComponent(floor)}` : ''}`),
}

export const floorPlanAPI = {
  getByFloor: (floorId) => request(`/api/floor-plans?floorId=${encodeURIComponent(floorId)}`),
  getById: (id) => request(`/api/floor-plans/${encodeURIComponent(id)}`),
  create: (data) => request('/api/floor-plans', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/floor-plans/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/floor-plans/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateDevicePosition: (id, x, y, restroomId, floorId) => request(`/api/devices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ floorPlanPosX: x, floorPlanPosY: y, restroomId: restroomId || null, floorId: floorId || null }) }),
  createRestroom: (data) => request('/api/restrooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRestroom: (id, data) => request(`/api/restrooms/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  getDevicesByFloor: (floorId) => request(`/api/devices?floorId=${encodeURIComponent(floorId)}`),
}

export const locationAPI = {
  getAll: (organizationId) => request(`/api/locations${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`),
  getById: (id) => request(`/api/locations/${encodeURIComponent(id)}`),
  create: (data) => request('/api/locations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/locations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/locations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const floorAPI = {
  getAll: () => request('/api/floors'),
  getByLocation: (locationId) => request(`/api/floors?locationId=${encodeURIComponent(locationId)}`),
  getById: (id) => request(`/api/floors/${encodeURIComponent(id)}`),
  create: (data) => request('/api/floors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/floors/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/floors/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const zoneAPI = {
  getAll: () => request('/api/zones'),
  getByFloor: (floorId) => request(`/api/zones?floorId=${encodeURIComponent(floorId)}`),
  getById: (id) => request(`/api/zones/${encodeURIComponent(id)}`),
  create: (data) => request('/api/zones', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/zones/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/zones/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  importGeoJson: (data) => request('/api/zones/import', { method: 'POST', body: JSON.stringify(data) }),
}

export const restroomAPI = {
  getAll: () => request('/api/restrooms'),
  getByFloor: (floorId) => request(`/api/restrooms?floorId=${encodeURIComponent(floorId)}`),
  update: (id, data) => request(`/api/restrooms/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export const deviceAPI = {
  getAll: () => request('/api/devices'),
  getByFloor: (floorId) => request(`/api/devices?floorId=${encodeURIComponent(floorId)}`),
  getByZone: (zoneId) => request(`/api/zones/${encodeURIComponent(zoneId)}/devices`),
  create: (data) => request('/api/devices', { method: 'POST', body: JSON.stringify(data) }),
  bulkCreate: (items) => request('/api/devices/bulk', { method: 'POST', body: JSON.stringify({ items }) }),
  update: (id, data) => request(`/api/devices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const gatewayAPI = {
  getAll: (params) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.locationId) qs.set('locationId', params.locationId)
    if (params?.floorId) qs.set('floorId', params.floorId)
    if (params?.zoneId) qs.set('zoneId', params.zoneId)
    if (params?.search) qs.set('search', params.search)
    const q = qs.toString()
    return request(`/api/gateway${q ? `?${q}` : ''}`)
  },
  getById: (id) => request(`/api/gateway/${encodeURIComponent(id)}`),
  create: (data) => request('/api/gateway', { method: 'POST', body: JSON.stringify(data) }),
  bulkCreate: (items) => request('/api/gateway/bulk', { method: 'POST', body: JSON.stringify({ items }) }),
  update: (id, data) => request(`/api/gateway/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/api/gateway/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  registerTTN: (id, data) => request(`/api/gateway/${encodeURIComponent(id)}/register-ttn`, { method: 'POST', body: JSON.stringify(data) }),
  getDevices: (id) => request(`/api/gateway/${encodeURIComponent(id)}/devices`),
  getUplinks: (id, limit) => request(`/api/gateway/${encodeURIComponent(id)}/uplinks${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`),
  getEvents: (id, limit) => request(`/api/gateway/${encodeURIComponent(id)}/events${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`),
}

export default api

export const testModeAPI = {
  simulate: (data) => request('/api/test-mode/simulate-feedback', { method: 'POST', body: JSON.stringify(data) }),
  getEvents: (params) => {
    const qs = new URLSearchParams()
    if (params?.badgeId) qs.set('badgeId', params.badgeId)
    if (params?.deviceEui) qs.set('deviceEui', params.deviceEui)
    if (params?.limit) qs.set('limit', params.limit)
    const q = qs.toString()
    return request(`/api/test-mode/events${q ? `?${q}` : ''}`)
  },
  clearEvents: (data) => request('/api/test-mode/events/clear', { method: 'POST', body: JSON.stringify(data) }),
}

export const alertAPI = {
  getUnhappyAggregated: () => request('/api/alerts/unhappy-aggregated'),
  acknowledgeGroup: (data) => request('/api/alerts/acknowledge-group', { method: 'POST', body: JSON.stringify(data) }),
  resolveGroup: (data) => request('/api/alerts/resolve-group', { method: 'POST', body: JSON.stringify(data) }),
  addNote: (data) => request('/api/alerts/add-note-group', { method: 'POST', body: JSON.stringify(data) }),
}
