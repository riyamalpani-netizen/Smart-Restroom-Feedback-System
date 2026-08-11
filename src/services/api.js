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
  updateDevicePosition: (id, x, y, restroomId) => request(`/api/devices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ floorPlanPosX: x, floorPlanPosY: y, restroomId: restroomId || null }) }),
  createRestroom: (data) => request('/api/restrooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRestroom: (id, data) => request(`/api/restrooms/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
}

export default api
