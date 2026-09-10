/**
 * useRealtimeSocket
 *
 * Manages a single authenticated Socket.IO connection per component mount.
 * Handles connect / disconnect / error states and calls the provided
 * event-handler map whenever the server emits a matching event.
 *
 * Usage:
 *   const { status } = useRealtimeSocket({
 *     'new-feedback': (data) => handleFeedback(data),
 *     'new-alert':    (data) => handleAlert(data),
 *   })
 *
 * status values: 'connecting' | 'connected' | 'disconnected' | 'error' | 'no-token'
 */

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function useRealtimeSocket(handlers = {}) {
  const [status, setStatus] = useState('connecting')
  const socketRef = useRef(null)
  // Keep handler refs fresh so closures inside socket events always call
  // the latest version without re-subscribing the socket listeners.
  const handlersRef = useRef(handlers)
  useEffect(() => { handlersRef.current = handlers })

  useEffect(() => {
    const token = localStorage.getItem('srfs_token')
    if (!token) {
      setStatus('no-token')
      return
    }

    let mounted = true

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (mounted) setStatus('connected')
    })

    socket.on('disconnect', () => {
      if (mounted) setStatus('disconnected')
    })

    socket.on('connect_error', () => {
      if (mounted) setStatus('error')
    })

    // Register each event from the handlers map once.
    // Uses a stable wrapper that delegates to the latest handlersRef.
    const eventNames = Object.keys(handlers)
    const wrappers = {}
    for (const event of eventNames) {
      wrappers[event] = (data) => {
        if (mounted && handlersRef.current[event]) {
          handlersRef.current[event](data)
        }
      }
      socket.on(event, wrappers[event])
    }

    return () => {
      mounted = false
      for (const event of eventNames) {
        socket.off(event, wrappers[event])
      }
      socket.disconnect()
      socketRef.current = null
    }
    // Intentionally run once — handlers are kept fresh via handlersRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, socket: socketRef }
}
