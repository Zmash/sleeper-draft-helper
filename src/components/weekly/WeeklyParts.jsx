import Icon from '../Icon'
import SleeperAvatar from '../SleeperAvatar'
import { cx } from '../../utils/formatting'

const pts = (n) => (n == null ? '–' : Number(n).toFixed(1))
const signed = (n) => (n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Number(n)).toFixed(1)}`)
const pct = (n) => (n == null ? '–' : `${Math.round(Number(n) * 100)} %`)
const leagueLabel = (list = []) => (list.length === 1 ? list[0].leagueName : `${list.length} Ligen`)
const leagueTitle = (list = []) => list.map((l) => l.leagueName).join(', ')

// ── Kopf ────────────────────────────────────────────────────────────────────

export function WeekPicker({ week, weeks, onPick, disabled }) {
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
        <Icon name="chevron-down" size={15} className="wk-rot-r" />
      </button>
      <select
        className="wk-week-select" value={week ?? ''} disabled={disabled}
        onChange={(e) => onPick(Number(e.target.value))} aria-label="Woche"
      >
        {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
      </select>
      <button
        type="button" className="wk-week-btn" onClick={() => go(-1)}
        disabled={disabled || idx <= 0} aria-label="Woche vor"
      >
        <Icon name="chevron-up" size={15} className="wk-rot-r" />
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
      key: 'bench',
      label: 'Auf der Bank gelassen',
      value: pts(record.pointsLeftOnBench),
      hint: record.pointsLeftOnBench > 0 ? 'Punkte über alle Ligen' : 'optimal aufgestellt',
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
          <span className="wk-num wk-out-delta">{signed(player.delta)}</span>
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

export function OutlierBoard({ outliers, labels, emptyHint }) {
  const max = Math.max(0, ...[...outliers.over, ...outliers.under].map((p) => Math.abs(p.delta)))
  const columns = [
    { key: 'over', tone: 'good', title: labels.over, list: outliers.over },
    { key: 'under', tone: 'bad', title: labels.under, list: outliers.under },
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
                <span className="wk-num">{pts(l.pointsLeftOnBench)} Punkte auf der Bank · optimal {pts(l.optimalPoints)}</span>
              ) : (
                <span>Optimale Aufstellung.</span>
              )}
            </div>
            {miss && (
              <div className="wk-bench-miss">
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

export function PositionBars({ rows }) {
  if (!rows.length) return <div className="wk-empty">Noch keine abgeschlossenen Starter-Spiele.</div>
  const max = Math.max(...rows.map((r) => Math.max(r.points, r.projected)), 1)
  return (
    <div className="wk-card wk-posbars">
      {rows.map((r) => (
        <div key={r.pos} className="wk-posrow">
          <span className={`wk-pos wk-pos--${String(r.pos || '').toLowerCase()}`}>{r.pos}</span>
          <div className="wk-posbar" aria-hidden="true">
            <i className="wk-posbar-proj" style={{ width: `${(r.projected / max) * 100}%` }} />
            <i className={cx('wk-posbar-real', r.delta >= 0 ? 'is-good' : 'is-bad')} style={{ width: `${(r.points / max) * 100}%` }} />
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
