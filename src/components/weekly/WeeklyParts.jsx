import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import SleeperAvatar from '../SleeperAvatar'
import { cx } from '../../utils/formatting'

const pts = (n) => (n == null ? '–' : Number(n).toFixed(1))
const signed = (n) => (n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Number(n)).toFixed(1)}`)
const pct = (n) => (n == null ? '–' : `${Math.round(Number(n) * 100)} %`)
const leagueLabel = (list = []) => (list.length === 1 ? list[0].leagueName : `${list.length} Ligen`)
const leagueTitle = (list = []) => list.map((l) => l.leagueName).join(', ')

// ── Kopf ────────────────────────────────────────────────────────────────────

// Bewusst KEIN <select>: dessen aufgeklappte Liste zeichnet das Betriebssystem,
// nicht die App -- im dunklen Theme steht da eine systemhelle Liste in
// Systemschrift. Dieselbe Loesung wie fuer Theme-Wahl und Draft-Umschalter in
// der NextShell: eigener Knopf + eigenes Menue.
function WeekMenu({ week, weeks, currentWeek, onPick, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    // Auf die aktive Woche scrollen: bei 18 Wochen liegt Week 1 sonst
    // unsichtbar unterhalb des Menuerands.
    // scrollIntoView fehlt in jsdom (und alten WebViews) -> optional aufrufen.
    ref.current?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' })
  }, [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="wk-menu-backdrop" onClick={onClose} />
      <div className="wk-menu" role="listbox" aria-label="Woche" ref={ref}>
        {weeks.map((w) => (
          <button
            key={w}
            type="button"
            role="option"
            aria-selected={w === week}
            className={cx('wk-menu-item', w === week && 'is-active')}
            onClick={() => { onPick(w); onClose() }}
          >
            <span className="wk-num">Week {w}</span>
            {w === currentWeek && <span className="wk-menu-now">läuft</span>}
            {w === week && <Icon name="check" size={13} />}
          </button>
        ))}
      </div>
    </>
  )
}

export function WeekPicker({ week, weeks, currentWeek, onPick, disabled }) {
  const [open, setOpen] = useState(false)
  const idx = weeks.indexOf(week)
  // weeks ist absteigend (aktuelle Woche zuerst) -- "zurueck" geht im Array
  // also nach hinten, "vor" nach vorn.
  const go = (step) => {
    const next = weeks[idx + step]
    if (next != null) onPick(next)
  }
  return (
    <div className="wk-weeks" role="group" aria-label="Woche wählen">
      <button
        type="button" className="wk-week-btn" onClick={() => go(1)}
        disabled={disabled || idx === -1 || idx >= weeks.length - 1} aria-label="Woche zurück"
      >
        <Icon name="chevron-left" size={15} />
      </button>
      <div className="wk-week-host">
        <button
          type="button"
          className="wk-week-current"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Woche"
        >
          <span className="wk-num">Week {week ?? '–'}</span>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} />
        </button>
        {open && (
          <WeekMenu
            week={week} weeks={weeks} currentWeek={currentWeek}
            onPick={onPick} onClose={() => setOpen(false)}
          />
        )}
      </div>
      <button
        type="button" className="wk-week-btn" onClick={() => go(-1)}
        disabled={disabled || idx <= 0} aria-label="Woche vor"
      >
        <Icon name="chevron-right" size={15} />
      </button>
    </div>
  )
}

// ── Wochenbilanz ────────────────────────────────────────────────────────────

export function RecordStrip({ record }) {
  const tiles = [
    {
      key: 'record',
      label: 'Bilanz',
      value: `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ''}`,
      hint: record.live ? `${record.live} noch offen` : `${record.leagues} Ligen`,
      tone: record.wins > record.losses ? 'good' : record.wins < record.losses ? 'bad' : null,
    },
    { key: 'points', label: 'Punkte gesamt', value: pts(record.totalPoints), hint: `${record.leagues} Ligen` },
    {
      key: 'hit',
      label: 'Über Projektion',
      value: record.hitRate == null ? '–' : pct(record.hitRate),
      hint: record.ratedStarters ? `${record.ratedStarters} bewertete Starter` : 'noch keine Wertung',
      tone: record.hitRate == null ? null : record.hitRate >= 0.5 ? 'good' : 'bad',
    },
    {
      // "Auf der Bank gelassen" las sich wie die Summe aller Bankpunkte. Es ist
      // die DIFFERENZ zur bestmoeglichen Aufstellung -- also nur das, was ein
      // anderer Einsatz wirklich mehr gebracht haette.
      key: 'bench',
      label: 'Verschenkte Punkte',
      value: pts(record.pointsLeftOnBench),
      hint: record.pointsLeftOnBench > 0 ? 'gegen die beste Aufstellung' : 'optimal aufgestellt',
      tone: record.pointsLeftOnBench > 0 ? 'bad' : 'good',
    },
  ]
  return (
    <div className="wk-record">
      {tiles.map((t) => (
        <div key={t.key} className="wk-stat">
          <div className="wk-stat-label">{t.label}</div>
          <div className={cx('wk-num wk-stat-value', t.tone && `is-${t.tone}`)}>{t.value}</div>
          <div className="wk-stat-hint">{t.hint}</div>
        </div>
      ))}
    </div>
  )
}

const RESULT_LABEL = { win: 'Sieg', loss: 'Niederlage', tie: 'Unentschieden', live: 'Läuft', none: 'Kein Gegner' }

export function LeagueResults({ leagues, errors = [] }) {
  if (!leagues.length && !errors.length) {
    return <div className="wk-empty">Für diese Woche liegen keine Matchups vor.</div>
  }
  return (
    <div className="wk-results">
      {leagues.map((l) => (
        <div key={l.leagueId} className={cx('wk-result', `is-${l.result}`)}>
          <div className="wk-result-top">
            <SleeperAvatar avatar={l.leagueAvatar} name={l.leagueName} size={16} />
            <span className="wk-result-name">{l.leagueName}</span>
            <span className={cx('wk-badge', `is-${l.result}`)}>{RESULT_LABEL[l.result]}</span>
          </div>
          <div className="wk-result-score">
            <span className="wk-num wk-result-me">{pts(l.myPoints)}</span>
            <span className="wk-result-vs">:</span>
            <span className="wk-num wk-result-opp">{pts(l.opponentPoints)}</span>
            {l.margin != null && (
              <span className={cx('wk-num wk-result-margin', l.margin >= 0 ? 'is-good' : 'is-bad')}>{signed(l.margin)}</span>
            )}
          </div>
          <div className="wk-result-sub">
            {l.opponentName && <span className="wk-ellip">gegen {l.opponentName}</span>}
            {l.rank != null && (
              <span className="wk-num" title="Platz nach Wochenpunkten in dieser Liga">
                Platz {l.rank}/{l.teams}
              </span>
            )}
          </div>
          <div className="wk-result-foot">
            <span className="wk-num">Ø Liga {pts(l.leagueAvg)}</span>
            <span className="wk-num">Top {pts(l.leagueHigh)}</span>
            {l.openStarters > 0 && <span className="wk-num wk-open">{l.openStarters} Starter offen</span>}
          </div>
        </div>
      ))}
      {errors.map((e) => (
        <div key={e.leagueId} className="wk-result is-error">
          <div className="wk-result-top"><span className="wk-result-name">{e.leagueName}</span></div>
          <div className="wk-result-error">Nicht geladen ({e.error})</div>
        </div>
      ))}
    </div>
  )
}

// ── Ausreisser ──────────────────────────────────────────────────────────────

function OutlierRow({ player, max, tone }) {
  const width = max > 0 ? Math.min(100, (Math.abs(player.delta) / max) * 100) : 0
  return (
    <div className="wk-out">
      <span className={`wk-pos wk-pos--${String(player.pos || '').toLowerCase()}`}>{player.pos}</span>
      <div className="wk-out-main">
        <div className="wk-out-name">
          <span className="wk-ellip">{player.name}</span>
          <span className={cx('wk-num wk-out-delta', `is-${tone}`)}>{signed(player.delta)}</span>
        </div>
        <div className="wk-out-bar" aria-hidden="true">
          <i className={`is-${tone}`} style={{ width: `${width}%` }} />
        </div>
        <div className="wk-out-sub">
          <span className="wk-num">{pts(player.points)} statt {pts(player.projected)}</span>
          <span className="wk-chip" title={leagueTitle(player.leagues)}>{leagueLabel(player.leagues)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {{over:'good'|'bad', under:'good'|'bad'}} [props.tones]
 *   Farbe je Spalte. Default gilt fuer die EIGENEN Starter: über Projektion ist
 *   gut. Bei den Gegnern ist es genau umgekehrt -- ein Gegner über seiner
 *   Projektion hat dich Punkte gekostet und darf nicht grün sein.
 */
export function OutlierBoard({ outliers, labels, emptyHint, tones = { over: 'good', under: 'bad' } }) {
  const max = Math.max(0, ...[...outliers.over, ...outliers.under].map((p) => Math.abs(p.delta)))
  const columns = [
    { key: 'over', tone: tones.over, title: labels.over, list: outliers.over },
    { key: 'under', tone: tones.under, title: labels.under, list: outliers.under },
  ]
  return (
    <div className="wk-outliers">
      {columns.map((c) => (
        <div key={c.key} className="wk-card wk-outcol">
          <div className="wk-outcol-h">{c.title}</div>
          {c.list.length === 0
            ? <div className="wk-empty">{emptyHint}</div>
            : c.list.map((p) => <OutlierRow key={p.playerId} player={p} max={max} tone={c.tone} />)}
        </div>
      ))}
      {outliers.pending > 0 && (
        <div className="wk-hint">
          <Icon name="info" size={13} /> {outliers.pending} Spieler sind noch im Einsatz und fließen erst nach Spielende ein.
        </div>
      )}
    </div>
  )
}

// ── Detail-Tabs (Ausreißer du / Gegner / Team-Check) ─────────────────────────
// Spart die vier gestapelten Sections: nur ein Panel ist sichtbar.
export function DetailTabs({ active, onActive, injuryCount = 0 }) {
  const tabs = [
    { key: 'du', label: 'Deine Ausreißer' },
    { key: 'geg', label: 'Gegner' },
    { key: 'team', label: `Team-Check${injuryCount > 0 ? ` ${injuryCount}` : ''}` },
  ]
  return (
    <div className="wk-tabs" role="tablist" aria-label="Details">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={cx('wk-tab', active === t.key && 'is-active')}
          onClick={() => onActive(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Verletzungen & Ausfaelle ────────────────────────────────────────────────

const SEVERITY_TEXT = {
  out: 'Aufgestellt und ausgefallen',
  dnp: 'Aufgestellt, keine Punkte',
  watch: 'Fraglich aufgestellt',
  bench: 'Auf der Bank betroffen',
}

export function InjuryList({ entries }) {
  if (!entries.length) return <div className="wk-empty">Keine Verletzungen oder Nullnummern in deinen Kadern.</div>
  return (
    <div className="wk-card wk-list">
      {entries.map((p) => (
        <div key={p.playerId} className={cx('wk-inj', `is-${p.severity}`)}>
          <span className={`wk-pos wk-pos--${String(p.pos || '').toLowerCase()}`}>{p.pos}</span>
          <div className="wk-inj-main">
            <div className="wk-inj-name">
              <span className="wk-ellip">{p.name}</span>
              {p.injuryStatus && <span className={cx('wk-tag', `is-${p.severity}`)}>{p.injuryStatus}</span>}
            </div>
            <div className="wk-inj-sub">
              <span>{SEVERITY_TEXT[p.severity]}</span>
              {p.startedIn.length > 0 && (
                <span className="wk-chip is-me" title={leagueTitle(p.startedIn)}>Start: {leagueLabel(p.startedIn)}</span>
              )}
              {p.benchedIn.length > 0 && (
                <span className="wk-chip" title={leagueTitle(p.benchedIn)}>Bank: {leagueLabel(p.benchedIn)}</span>
              )}
            </div>
          </div>
          <div className="wk-inj-pts">
            <span className="wk-num">{pts(p.points)}</span>
            {p.projected != null && <small className="wk-num">Proj {pts(p.projected)}</small>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Liga-Filter als Dropdown (Mobile) ───────────────────────────────────────
// Dieselbe Auswahl wie die Chips, aber ohne horizontales Scrollen: Button mit
// Zusammenfassung + Menü mit Checkbox-Zeilen. Bewusst eigenes Menü statt
// nativem <select> (siehe WeekPicker): die OS-Liste passt nicht ins Theme.
// Das Menü bleibt nach einem Toggle offen (Multi-Select), "Alle Ligen" setzt zurück.
export function LeagueFilterDropdown({ leagues = [], activeIds = [], onToggle, onSelectAll }) {
  const [open, setOpen] = useState(false)
  const allOn = leagues.length > 0 && leagues.every((l) => activeIds.includes(l.id))
  const label = allOn ? 'Alle Ligen' : `${activeIds.length} von ${leagues.length} Ligen`
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="wk-leagues">
      <div className="wk-leagues-host">
        <button
          type="button"
          className="wk-leagues-current"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="wk-leagues-label">{label}</span>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} />
        </button>
        {open && (
          <>
            <div className="wk-menu-backdrop" onClick={() => setOpen(false)} />
            <div className="wk-menu wk-leagues-menu" role="menu" aria-label="Ligen filtern">
              {!allOn && (
                <button
                  type="button" role="menuitem" className="wk-menu-item"
                  onClick={() => { onSelectAll(); setOpen(false) }}
                >
                  <Icon name="check" size={13} />
                  <span>Alle Ligen</span>
                </button>
              )}
              {leagues.map((l) => {
                const on = activeIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    type="button" role="menuitemcheckbox" aria-checked={on}
                    className={cx('wk-menu-item', on && 'is-active')}
                    onClick={() => onToggle(l.id)}
                  >
                    <SleeperAvatar avatar={l.avatar} name={l.label} size={16} />
                    <span className="wk-ellip">{l.label}</span>
                    {on && <Icon name="check" size={13} />}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Team-Check: Verletzungen (Dringende offen, Bank eingeklappt) + ──────────
// Aufstellung + Positionsbilanz in einem Panel. Auf Mobile einspaltig,
// damit die Spark-Zeilen nicht aus der Card laufen.
export function TeamCheck({ injuries = [], leagues = [], positions = [] }) {
  const urgent = injuries.filter((p) => p.severity !== 'bench')
  const bank = injuries.filter((p) => p.severity === 'bench')
  return (
    <div className="wk-team">
      <div className="wk-team-h">Verletzungen – nur aufgestellt</div>
      <InjuryList entries={urgent} />
      {bank.length > 0 && (
        <details className="wk-bank">
          <summary>Bank betroffen ({bank.length}) – aufklappen</summary>
          <InjuryList entries={bank} />
        </details>
      )}
      <div className="wk-team-h">Aufstellung im Rückblick</div>
      <BenchReport leagues={leagues} />
      <div className="wk-team-h">Positionsbilanz</div>
      <PositionBars rows={positions} />
    </div>
  )
}

// ── Bank-Bilanz ─────────────────────────────────────────────────────────────

export function BenchReport({ leagues }) {
  const rated = leagues.filter((l) => l.efficiency != null)
  if (!rated.length) return <div className="wk-empty">Noch keine Punkte für eine Aufstellungs-Bilanz.</div>
  return (
    <div className="wk-card wk-list">
      {rated.map((l) => {
        const miss = l.misses[0]
        return (
          <div key={l.leagueId} className="wk-bench">
            <div className="wk-bench-top">
              <span className="wk-ellip">{l.leagueName}</span>
              <span className={cx('wk-num wk-bench-eff', l.efficiency >= 0.95 ? 'is-good' : l.efficiency < 0.85 ? 'is-bad' : null)}>
                {pct(l.efficiency)}
              </span>
            </div>
            <div className="wk-bench-bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.max(0, l.efficiency * 100))}%` }} />
            </div>
            <div className="wk-bench-sub">
              {l.pointsLeftOnBench > 0.05 ? (
                <span className="wk-num">{pts(l.pointsLeftOnBench)} Punkte verschenkt · optimal wären {pts(l.optimalPoints)}</span>
              ) : (
                <span>Optimale Aufstellung.</span>
              )}
            </div>
            {miss && (
              // Der Slot steht bewusst dabei: nur mit ihm ist der Tausch
              // nachvollziehbar (und ein positionsfremdes Paar faellt sofort auf).
              <div className="wk-bench-miss">
                <span className="wk-bench-slot">{miss.slot}</span>
                <span className="wk-chip is-me">{miss.in.name} {pts(miss.in.points)}</span>
                <Icon name="swap" size={13} />
                {miss.out
                  ? <span className="wk-chip is-opp">{miss.out.name} {pts(miss.out.points)}</span>
                  : <span className="wk-chip is-opp">Slot leer</span>}
                <span className="wk-num wk-bench-gain">{signed(miss.gain)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Positionsbilanz ─────────────────────────────────────────────────────────

// Bullet-Chart statt zweier gestapelter Balken: die Projektion ist eine
// Zielmarke, keine Flaeche. Zwei Graustufen uebereinander (Balken auf Spur)
// verschwinden in Themes, deren --border und --text-dim dicht beieinander
// liegen (Befund im Volt-Theme); eine Marke in --text-primary steht dagegen
// in jedem Theme.
export function PositionBars({ rows }) {
  if (!rows.length) return <div className="wk-empty">Noch keine abgeschlossenen Starter-Spiele.</div>
  const max = Math.max(...rows.map((r) => Math.max(r.points, r.projected)), 1)
  return (
    <div className="wk-card wk-posbars">
      {rows.map((r) => (
        <div key={r.pos} className="wk-posrow">
          <span className={`wk-pos wk-pos--${String(r.pos || '').toLowerCase()}`}>{r.pos}</span>
          <div className="wk-posbar" aria-hidden="true">
            <i className={cx('wk-posbar-real', r.delta >= 0 ? 'is-good' : 'is-bad')} style={{ width: `${(r.points / max) * 100}%` }} />
            <i className="wk-posbar-proj" style={{ left: `${(r.projected / max) * 100}%` }} />
          </div>
          <span className="wk-num wk-posval" title={`${pts(r.points)} Punkte, projiziert ${pts(r.projected)} (${r.count} Starter)`}>
            {pts(r.points)}
            <small className={cx('wk-num', r.delta >= 0 ? 'is-good' : 'is-bad')}>{signed(r.delta)}</small>
          </span>
        </div>
      ))}
      <div className="wk-poslegend">
        <span><i className="wk-swatch wk-swatch--proj" /> Projektion</span>
        <span><i className="wk-swatch wk-swatch--real" /> erzielt</span>
      </div>
    </div>
  )
}
