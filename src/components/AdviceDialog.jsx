import React from 'react'

export default function AdviceDialog({ open, onClose, loading, advice, error, debug }) {
  if (!open) return null

  const hasAdvice =
    advice && typeof advice === 'object' &&
    (advice.primary || (Array.isArray(advice.alternatives) && advice.alternatives.length > 0))

  return (
    <div style={backdropStyle}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-label="AI Advice">
        <div style={headRow}>
          <h3 style={{ margin: 0 }}>AI Draft Advice</h3>
          <button onClick={onClose} style={btnGhost} aria-label="Close">×</button>
        </div>

        {loading && <div style={{ padding: '8px 0' }}>Analysiere Board, Liga und Roster …</div>}

        {!loading && error && (
          <div style={{ color: 'crimson', marginBottom: 8 }}>{String(error)}</div>
        )}

        {!loading && !error && hasAdvice && (
          <div style={{ display: 'grid', gap: 12 }}>
            {advice?.primary && (
              <section>
                <h4 style={h4}>Empfehlung</h4>
                <p style={{ margin: 0 }}>
                  <strong>{advice?.primary?.player_display || advice?.primary?.player_nname}</strong>
                  {advice?.primary?.pos ? ` · ${advice.primary.pos}` : ''}
                  {Number.isFinite(advice?.primary?.rk) ? ` · RK ${advice.primary.rk}` : ''}
                </p>
                {advice?.primary?.why && <p style={{ marginTop: 6 }}>{advice.primary.why}</p>}
              </section>
            )}

            {Array.isArray(advice?.alternatives) && advice.alternatives.length > 0 && (
              <section>
                <h4 style={h4}>Alternativen</h4>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {advice.alternatives.map((alt, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      <strong>{alt.player_display || alt.player_nname}</strong>
                      {alt.pos ? ` · ${alt.pos}` : ''}
                      {Number.isFinite(alt.rk) ? ` · RK ${alt.rk}` : ''}
                      {alt.why ? ` — ${alt.why}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {advice?.strategy_notes && (
              <section>
                <h4 style={h4}>Strategie-Notizen</h4>
                <p style={{ marginTop: 6 }}>{advice.strategy_notes}</p>
              </section>
            )}
          </div>
        )}

        {!loading && !error && !hasAdvice && (
          <div style={{ opacity: 0.85 }}>
            Keine strukturierte Empfehlung empfangen.
            {debug?.raw && (
              <p style={{ marginTop: 8 }}>
                Das Modell hat keinen parsebaren JSON-Inhalt geliefert.
              </p>
            )}
          </div>
        )}

        {/* Debug-Details */}
        {debug && (
  <details style={{ marginTop: 14 }}>
    <summary style={{ cursor: 'pointer' }}>Debug anzeigen</summary>
    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
      {debug?.request && (
        <pre style={preStyle}>
{JSON.stringify(debug.request, null, 2)}
        </pre>
      )}
     {debug?.request_context_sample && (
       <>
         <div style={{ fontWeight: 600, marginTop: 6 }}>Request Context (sample)</div>
         <pre style={preStyle}>
{JSON.stringify(debug.request_context_sample, null, 2)}
         </pre>
       </>
     )}
     {debug?.request_payload && (
       <>
         <div style={{ fontWeight: 600, marginTop: 6 }}>Request Payload (to OpenAI)</div>
         <pre style={preStyle}>
{JSON.stringify(debug.request_payload, null, 2)}
         </pre>
       </>
     )}
      {debug?.response && (
        <pre style={preStyle}>
{JSON.stringify(debug.response, null, 2)}
        </pre>
      )}
      {debug?.raw && (
        <>
          <div style={{ fontWeight: 600, marginTop: 6 }}>Raw content</div>
          <pre style={preStyle}>{debug.raw}</pre>
        </>
      )}
      {debug?.tool_calls && (
        <>
          <div style={{ fontWeight: 600, marginTop: 6 }}>Tool Calls</div>
          <pre style={preStyle}>
{JSON.stringify(debug.tool_calls, null, 2)}
          </pre>
        </>
      )}
      {debug?.openai_message && (
       <>
         <div style={{ fontWeight: 600, marginTop: 6 }}>OpenAI message (echo)</div>
         <pre style={preStyle}>
{JSON.stringify(debug.openai_message, null, 2)}
         </pre>
       </>
     )}

     {debug?.response_all && (
       <>
         <div style={{ fontWeight: 600, marginTop: 6 }}>Full response JSON</div>
         <pre style={preStyle}>
{JSON.stringify(debug.response_all, null, 2)}
         </pre>
       </>
     )}

     {debug?.response_text && (
       <>
         <div style={{ fontWeight: 600, marginTop: 6 }}>Raw response text</div>
         <pre style={preStyle}>{debug.response_text}</pre>
       </>
     )}
    </div>
  </details>
)}

      </div>
    </div>
  )
}

const backdropStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'grid', placeItems: 'center', zIndex: 1000,
}
const dialogStyle = {
  background: 'var(--bg, #161616)', color: 'var(--fg, #eaeaea)',
  minWidth: 420, maxWidth: 900, width: '90%',
  borderRadius: 10, padding: 16, boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
}
const headRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }
const btnGhost = {
  background: 'transparent', border: '1px solid #444', color: 'inherit',
  borderRadius: 6, width: 28, height: 28, lineHeight: '28px', cursor: 'pointer'
}
const h4 = { margin: '8px 0' }
const preStyle = {
  margin: 0, padding: 10, border: '1px solid #333', borderRadius: 8,
  background: '#0f0f0f', color: '#ddd', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
}
