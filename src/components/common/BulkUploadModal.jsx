/**
 * BulkUploadModal
 *
 * Reusable modal for CSV bulk-upload flows.
 *
 * States:
 *   uploading  – spinner shown while the HTTP request is in flight
 *   result     – summary card (created / skipped / errors) + per-row error table
 *
 * Props
 *   uploading  {boolean}          – true while the API call is pending
 *   result     {object|null}      – { created, skipped, errors: [{row, message}] }
 *   onClose    {function}         – called when user dismisses the modal
 *   entityName {string}           – "Device" | "Gateway" (used in heading copy)
 */
export default function BulkUploadModal({ uploading, result, onClose, entityName = 'Item' }) {
  if (!uploading && !result) return null

  return (
    <div
      className="modal-overlay"
      onClick={!uploading ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`Bulk ${entityName} Upload`}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 580 }}
      >
        {/* ── Uploading state ── */}
        {uploading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div className="loader" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
              Uploading {entityName.toLowerCase()}s… please wait
            </p>
          </div>
        )}

        {/* ── Result state ── */}
        {!uploading && result && (
          <>
            <h3 style={{ marginTop: 0 }}>Bulk Upload Result</h3>

            {/* Summary pills */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0 16px' }}>
              <Pill color="green" label={`✓ Created: ${result.created}`} />
              <Pill color="yellow" label={`↩ Skipped (duplicate): ${result.skipped}`} />
              {result.errors.length > 0 && (
                <Pill color="red" label={`✕ Invalid rows: ${result.errors.length}`} />
              )}
            </div>

            {/* All-success message */}
            {result.errors.length === 0 && result.created > 0 && (
              <p style={{ color: '#166534', fontSize: 14, margin: '0 0 16px' }}>
                All valid rows were processed successfully.
                {result.skipped > 0 && ` ${result.skipped} row(s) were skipped because the EUI already exists.`}
              </p>
            )}

            {result.created === 0 && result.skipped === 0 && result.errors.length === 0 && (
              <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px' }}>
                No rows were found in the file.
              </p>
            )}

            {/* Per-row error table */}
            {result.errors.length > 0 && (
              <>
                <p style={{ color: '#7f1d1d', fontSize: 13, margin: '0 0 8px', fontWeight: 600 }}>
                  The following rows had problems and were not imported:
                </p>
                <div
                  style={{
                    maxHeight: 260,
                    overflowY: 'auto',
                    border: '1px solid #fca5a5',
                    borderRadius: 6,
                    marginBottom: 16,
                  }}
                >
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
                    aria-label="Row errors"
                  >
                    <thead>
                      <tr style={{ background: '#fee2e2', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>Row</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #fecaca' }}>
                          <td style={{ padding: '6px 10px', color: '#b91c1c', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {err.row === '—' ? '—' : `Row ${err.row}`}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#374151', wordBreak: 'break-word' }}>
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="btn-group" style={{ marginTop: 4 }}>
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Internal helper ── */
function Pill({ color, label }) {
  const styles = {
    green:  { background: '#dcfce7', color: '#166534' },
    yellow: { background: '#fef9c3', color: '#854d0e' },
    red:    { background: '#fee2e2', color: '#991b1b' },
  }
  return (
    <span
      style={{
        borderRadius: 6,
        padding: '4px 12px',
        fontWeight: 600,
        fontSize: 14,
        ...styles[color],
      }}
    >
      {label}
    </span>
  )
}
