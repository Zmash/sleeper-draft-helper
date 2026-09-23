import { posColor, formatProjectedPts } from '../../utils/formatting'
import { berlinShortDay, berlinTime } from '../../utils/berlinTime'

// Kurzform des Sleeper-Injury-Status fuer die Zeile.
const STATUS_SHORT = { Questionable: 'Q', Doubtful: 'D' }
const SLOT_LABEL = { SUPER_FLEX: 'SF', REC_FLEX: 'W/T', WRRB_FLEX: 'W/R' }

function kickoffText(ms) {
  if (ms == null) return null
  return `${berlinShortDay(ms)} ${berlinTime(ms)}`
}

// Abgleich mit dem, was in Sleeper hinterlegt ist -- nur, wenn die Zuordnung
// ueberhaupt lesbar ist (assigned != null). Sonst kein Status, statt "nicht
// gesetzt" zu behaupten.
function assignedState(pick, assigned, nameById) {
  if (!assigned) return null
  const current = assigned.get(String(pick.starter.sleeper_id))
  if (current === String(pick.sub.sleeper_id)) return { kind: 'ok', text: 'gesetzt' }
  if (current) return { kind: 'change', text: `in Sleeper: ${nameById?.[current] || current}` }
  return { kind: 'change', text: 'noch nicht gesetzt' }
}

/**
 * AutoSub-Empfehlung der Lineup-Karte. Erscheint nur in Ligen mit AutoSubs.
 * @param {object} props
 * @param {{rules:{maxSubs:number, requireLaterKickoff:boolean}, picks:object[], uncovered:object[],
 *          assigned:Map<string,string>|null, kickoffFor:(p:object)=>number|null}} props.autoSub
 * @param {Record<string,string>} [props.rosterNameById]
 */
export default function AutoSubSection({ autoSub, rosterNameById }) {
  if (!autoSub?.rules) return null
  const { rules, picks, uncovered, assigned, kickoffFor } = autoSub
  const staleAssigned = assigned
    ? [...assigned.entries()].filter(([starter]) => !picks.some((p) => String(p.starter.sleeper_id) === starter))
    : []
  return (
    <div className="an-autosub" data-testid="autosub-section">
      <div className="an-lineup-subhead">
        AutoSubs
        <span className="an-autosub-rule">
          {picks.length} von max. {rules.maxSubs}
          {rules.requireLaterKickoff ? ' · Sub spielt gleich spät oder später' : ''}
        </span>
      </div>
      {picks.length === 0 && uncovered.length === 0 && (
        <p className="an-autosub-empty">Kein Starter mit Ausfallrisiko – diese Woche braucht es keinen AutoSub.</p>
      )}
      {picks.map((p) => {
        const state = assignedState(p, assigned, rosterNameById)
        const kStarter = kickoffText(kickoffFor?.(p.starter))
        const kSub = kickoffText(kickoffFor?.(p.sub))
        return (
          <div className="an-autosub-row" key={`${p.slot}-${p.slotIndex}`}>
            <span className="an-pos" style={{ background: posColor(p.slot) }}>{SLOT_LABEL[p.slot] || p.slot}</span>
            <span className="an-autosub-pair">
              <span className="an-autosub-starter">
                {p.starter.name}
                <span className="an-autosub-status" title={p.starter.injury_status}>{STATUS_SHORT[p.starter.injury_status] || p.starter.injury_status}</span>
                {kStarter && <span className="an-autosub-kick">{kStarter}</span>}
              </span>
              <span className="an-autosub-arrow" aria-hidden="true">→</span>
              <span className="an-autosub-sub">
                <strong>{p.sub.name}</strong>
                <span className="an-autosub-kick">{p.sub.pos}{kSub ? ` · ${kSub}` : ''}</span>
              </span>
            </span>
            <span className="an-autosub-meta">
              {p.expected != null && (
                <span className="an-num" title="Erwartete Punkte, die der Sub rettet: Ausfallrisiko x Projektion des Subs">
                  +{formatProjectedPts(p.expected)}
                </span>
              )}
              {state && <span className={`an-autosub-state an-autosub-state--${state.kind}`}>{state.text}</span>}
            </span>
          </div>
        )
      })}
      {uncovered.map((u) => (
        <p className="an-autosub-note" key={`u-${u.slot}-${u.slotIndex}`}>
          {u.starter.name} ({STATUS_SHORT[u.starter.injury_status] || u.starter.injury_status}):{' '}
          {u.reason === 'limit'
            ? 'kein AutoSub mehr frei – die anderen retten mehr Punkte.'
            : rules.requireLaterKickoff
              ? 'kein passender Bankspieler, der gleich spät oder später spielt.'
              : 'kein passender Bankspieler auf der Bank.'}
        </p>
      ))}
      {staleAssigned.map(([starter, sub]) => (
        <p className="an-autosub-note" key={`s-${starter}`}>
          In Sleeper hinterlegt, Starter ohne Ausfallrisiko: {rosterNameById?.[starter] || starter} → {rosterNameById?.[sub] || sub} – der Platz wäre woanders nützlicher, falls noch jemand fraglich wird.
        </p>
      ))}
      <p className="an-card-basis">
        Nur Starter mit Status Questionable/Doubtful bekommen einen Vorschlag – ein AutoSub-Platz, der auf einem sicheren Starter liegt, fehlt beim nächsten Wackelkandidaten.
        {!assigned && ' Welche Subs in Sleeper schon hinterlegt sind, ist über die Schnittstelle nicht erkennbar – bitte in der App abgleichen.'}
      </p>
    </div>
  )
}
