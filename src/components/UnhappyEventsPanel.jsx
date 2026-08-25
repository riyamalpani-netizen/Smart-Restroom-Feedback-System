import { useState } from 'react'
import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { alertAPI } from '../services/api'

// Parse the appended note log (each entry is "[timestamp] author: text")
function parseNoteHistory(rawNotes) {
  if (!rawNotes) return []
  return rawNotes
    .split('\n\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^\[(.+?)\]\s(.+?):\s([\s\S]+)$/)
      if (match) return { timestamp: match[1], author: match[2], text: match[3] }
      return { timestamp: null, author: null, text: entry }
    })
}

function ComplaintCard({ complaint, onAcknowledge, onResolve, onNoteAdded }) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [localNotes, setLocalNotes] = useState(complaint.latestNote || null)

  const noteHistory = parseNoteHistory(localNotes)
  const priority = complaint.priority || 'low'

  async function handleAcknowledge() {
    try {
      await alertAPI.acknowledgeGroup({ locationId: complaint.locationId, zoneId: complaint.zoneId })
      onAcknowledge?.()
    } catch (e) {
      console.error('Acknowledge failed:', e)
    }
  }

  async function handleResolve() {
    try {
      await alertAPI.resolveGroup({ locationId: complaint.locationId, zoneId: complaint.zoneId })
      onResolve?.()
    } catch (e) {
      console.error('Resolve failed:', e)
    }
  }

  async function handleSaveNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const res = await alertAPI.addNote({
        locationId: complaint.locationId,
        zoneId: complaint.zoneId,
        note: noteText.trim(),
      })
      setLocalNotes(res.notes)
      setNoteText('')
      setNoteOpen(false)
      onNoteAdded?.()
    } catch (err) {
      alert(err.message || 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`unhappy-panel__item unhappy-panel__item--${priority}`}>
      {/* Card body */}
      <div className="unhappy-panel__item-body">
        <div className="unhappy-panel__item-header">
          <div>
            <div className="unhappy-panel__location">{complaint.locationName}</div>
            <div className="unhappy-panel__zone">{complaint.zoneName}</div>
          </div>
          <StatusBadge status={complaint.statusDisplay || complaint.status} variant="alert" />
        </div>

        <div className="unhappy-panel__meta">
          <span className="unhappy-panel__count">
            <span className="unhappy-panel__count-dot" />
            {complaint.unhappyCount} unhappy
          </span>
          <span className={`unhappy-panel__priority unhappy-panel__priority--${priority}`}>
            {priority}
          </span>
          {complaint.lastReported && (
            <span className="unhappy-panel__time">
              {formatDateTime(complaint.lastReported)}
            </span>
          )}
        </div>
      </div>

      {/* Notes history */}
      {noteHistory.length > 0 && (
        <div className="unhappy-panel__notes">
          <div className="unhappy-panel__notes-header">
            📋 Investigation Notes ({noteHistory.length})
          </div>
          <div className="unhappy-panel__notes-body">
            {noteHistory.map((entry, i) => (
              <div key={i} className="unhappy-panel__note-entry">
                {(entry.author || entry.timestamp) && (
                  <div className="unhappy-panel__note-meta">
                    {entry.author && (
                      <span className="unhappy-panel__note-author">{entry.author}</span>
                    )}
                    {entry.timestamp && <span>· {entry.timestamp}</span>}
                  </div>
                )}
                <div className="unhappy-panel__note-text">{entry.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add note form */}
      {noteOpen && (
        <div className="unhappy-panel__note-form">
          <form onSubmit={handleSaveNote}>
            <textarea
              className="unhappy-panel__note-textarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Explain the cause — e.g. 'Cleaner on break', 'Soap dispenser empty', 'Reported to maintenance'…"
              autoFocus
            />
            <div className="unhappy-panel__note-form-actions">
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={saving || !noteText.trim()}
              >
                {saving ? 'Saving…' : 'Save Note'}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => { setNoteOpen(false); setNoteText('') }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Action buttons */}
      <div className="unhappy-panel__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => setNoteOpen((o) => !o)}
          title="Add an investigation note"
        >
          📋 {noteOpen ? 'Cancel Note' : noteHistory.length > 0 ? 'Add Note' : 'Add Note'}
        </button>
        {complaint.status === 'open' && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleAcknowledge}>
            Acknowledge
          </button>
        )}
        {complaint.status !== 'closed' && (
          <button type="button" className="btn btn--primary btn--sm" onClick={handleResolve}>
            Resolve
          </button>
        )}
      </div>
    </div>
  )
}

export default function UnhappyEventsPanel({ aggregatedComplaints = [], onAcknowledge, onResolve }) {
  const totalUnhappy = aggregatedComplaints.reduce((sum, c) => sum + (c.unhappyCount || 0), 0)

  return (
    <div className="card unhappy-panel">
      <div className="unhappy-panel__header">
        <h3 className="unhappy-panel__title">Unhappy Complaints</h3>
        <span className="unhappy-panel__badge">{totalUnhappy}</span>
      </div>

      {aggregatedComplaints.length === 0 ? (
        <p className="unhappy-panel__empty">No unresolved unhappy complaints.</p>
      ) : (
        <div className="unhappy-panel__list">
          {aggregatedComplaints.map((complaint) => (
            <ComplaintCard
              key={`${complaint.locationId}-${complaint.zoneId}`}
              complaint={complaint}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
              onNoteAdded={onAcknowledge}
            />
          ))}
        </div>
      )}
    </div>
  )
}
