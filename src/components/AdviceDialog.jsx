import React from 'react'
import { formatUsage } from '../services/aiCost'
import { CostHint } from './CostHint'

const SURVIVAL_LABEL = {
  duerfte_da_sein: 'dürfte da sein',
  muenzwurf: 'ein Münzwurf',
  duerfte_weg_sein: 'dürfte weg sein',
}

function AdviceBody({ advice, warnings = [], usage = null, model = '', myNextPick = null }) {
  if (!advice) {
    return warnings.length
      ? <div className="advice-warnings">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
      : null
  }
  return (
    <>
      {warnings.length > 0 && (
        <div className="advice-warnings">
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      <section className="advice-section">
        <h3>Empfehlung</h3>
        <p><strong>{advice.primary.player_display || advice.primary.player_nname}</strong>
          {' '}· {advice.primary.pos}{advice.primary.rk != null ? ` · RK ${advice.primary.rk}` : ''}</p>
        <p>{advice.primary.why}</p>
      </section>

      {advice.alternatives?.length > 0 && (
        <section className="advice-section">
          <h3>Vergleich</h3>
          <ul>
            {advice.alternatives.map(a => (
              <li key={a.player_nname}>
                <strong>{a.player_display || a.player_nname}</strong> · {a.pos}
                {a.rk != null ? ` · RK ${a.rk}` : ''} — {a.why}
                <div className="advice-tradeoff">{a.tradeoff_vs_primary}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {advice.survival?.length > 0 && (
        <section className="advice-section">
          <h3>{myNextPick ? `Überlebt bis Pick ${myNextPick}?` : 'Überlebt bis zu deinem nächsten Pick?'}</h3>
          <ul>
            {advice.survival.map(s => (
              <li key={s.player_nname}>
                <strong>{s.player_nname}</strong>: {SURVIVAL_LABEL[s.verdict] || s.verdict} — {s.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {advice.plan_next_picks?.length > 0 && (
        <section className="advice-section">
          <h3>Plan für deine nächsten Picks</h3>
          <ul>
            {advice.plan_next_picks.map(p => (
              <li key={p.pick_number}>
                <strong>Pick {p.pick_number}</strong> · {(p.target_positions || []).join('/')} — {p.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {advice.run_alert && (
        <section className="advice-section advice-run">
          <h3>Run-Hinweis: {advice.run_alert.pos}</h3>
          <p>{advice.run_alert.note}</p>
        </section>
      )}

      {advice.strategy_notes && (
        <section className="advice-section">
          <h3>Strategie-Notizen</h3>
          <p>{advice.strategy_notes}</p>
        </section>
      )}

      {usage && <div className="advice-usage"><CostHint text={formatUsage(usage, model)} prefix="Verbraucht: " /></div>}
    </>
  )
}

export default function AdviceDialog({
  open, onClose, loading, advice, error, debug,
  warnings = [], usage = null, model = '', myNextPick = null,
}) {
  if (!open) return null

  return (
    <div style={backdropStyle}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-label="AI Advice">
        <div style={headRow}>
          <h3 style={{ margin: 0 }}>AI Draft Advice</h3>
          <button onClick={onClose} style={btnGhost} aria-label="Close">×</button>
        </div>

        {loading && (
          <div style={{ padding: '8px 0' }}>Analysiere Board, Liga und Roster …</div>
        )}

        {!loading && error && (
          <div style={{ color: 'crimson', marginBottom: 8 }}>{String(error)}</div>
        )}

        {!loading && !error && (
          <AdviceBody advice={advice} warnings={warnings} usage={usage} model={model} myNextPick={myNextPick} />
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
const preStyle = {
  margin: 0, padding: 10, border: '1px solid #333', borderRadius: 8,
  background: '#0f0f0f', color: '#ddd', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
}
