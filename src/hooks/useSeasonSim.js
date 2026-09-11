// Laedt alle Simulator-Inputs und steuert den Worker. Simuliert wird NUR nach
// explizitem start() (10k Sims + ~17 Matchup-Requests sind zu teuer fuer
// Auto-Run beim Tab-Wechsel). Raw-Rosters werden hier selbst geladen
// (fetchLeagueRosters), weil useDynastyStore.leagueRosters weder Wins noch
// Bye/Injury enthaelt -- der Store bleibt unangetastet.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLeagueRosters, fetchMatchups, fetchNflState } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useDynastyValuesStore } from '../stores/useDynastyValuesStore'
import { normalizePlayerName } from '../utils/formatting'
import { pointsFieldFor, DEFAULT_SIMS } from '../services/analysis/seasonSim'
import { buildRemainingSchedule, playoffCutoff } from '../services/analysis/seasonSchedule'
import { buildIdRankMaps, selectAndScore } from '../services/analysis/seasonStrengths'
import SimWorker from '../workers/simWorker.js?worker'

const WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']

// R2: ownerLabels ist eine Map (user:user_id -> Anzeigename, App.jsx:122).
function rosterLabel(rosterId, { ownerLabels, rosterToUserMap }) {
  const ownerId = rosterToUserMap?.[String(rosterId)]
  const label = ownerId != null && ownerLabels instanceof Map
    ? ownerLabels.get(`user:${ownerId}`)
    : null
  return label || `Team ${rosterId}`
}

// R3: Sync-Fallback fuer WebViews ohne Worker — gleiche Sims, gechunkt mit
// Yield pro Chunk, damit die UI nicht einfriert.
async function runInline({ strengthsPayload, schedule, playoffTeams, dynastyTotals, sims, seed, onProgress, isAlive }) {
  const { simulateSeason, aggregateOdds, SIM_CHUNK } = await import('../services/analysis/seasonSim')
  const strengthsByWeek = new Map(strengthsPayload.map(([w, rows]) => [Number(w), new Map(rows)]))
  const dynMap = dynastyTotals ? new Map(dynastyTotals) : null
  const rosterIds = [...new Set(schedule.flatMap((g) => [g.a, g.b]))]
  const results = []
  for (let done = 0; done < sims; done += SIM_CHUNK) {
    if (!isAlive()) return null
    const n = Math.min(SIM_CHUNK, sims - done)
    for (let i = 0; i < n; i++) {
      results.push(simulateSeason({ strengthsByWeek, schedule, playoffTeams, seed: seed + done + i, dynastyTotals: dynMap }))
    }
    onProgress({ done: Math.min(done + n, sims), total: sims })
    await new Promise((r) => setTimeout(r, 0))
  }
  if (!isAlive()) return null
  return [...aggregateOdds(results, { rosterIds, sims }).entries()].map(([rosterId, o]) => ({ rosterId, ...o }))
}

export function useSeasonSim({ league, seasonYear, scoringType, rosterPositions, ownerLabels, draftMode }) {
  const [state, setState] = useState(league?.league_id ? 'idle' : 'unavailable')
  const [progress, setProgress] = useState(null)
  const [odds, setOdds] = useState(null)
  const [unavailableReason, setUnavailableReason] = useState(
    league?.league_id ? null : 'Keine Liga ausgewählt.'
  )
  const workerRef = useRef(null)
  const runIdRef = useRef(0)

  useEffect(() => () => {
    try { workerRef.current?.terminate() } catch {}
    workerRef.current = null
  }, [])

  const cancel = useCallback(() => {
    runIdRef.current += 1
    try { workerRef.current?.postMessage({ type: 'cancel' }) } catch {}
    try { workerRef.current?.terminate() } catch {}
    workerRef.current = null
    setState('idle')
    setProgress(null)
  }, [])

  const start = useCallback(async () => {
    const myRun = ++runIdRef.current
    const alive = () => runIdRef.current === myRun
    if (!league?.league_id) {
      setState('unavailable')
      setUnavailableReason('Keine Liga ausgewählt.')
      return
    }
    setState('loading')
    setProgress(null)
    setOdds(null)
    try {
      const { playoffWeekStart, playoffTeams } = playoffCutoff({ league })
      const [nfl, rawRosters, playersMeta] = await Promise.all([
        fetchNflState().catch(() => null),
        fetchLeagueRosters(league.league_id).catch(() => []),
        loadPlayersMetaCached({ season: Number(seasonYear) || new Date().getFullYear() }).catch(() => ({})),
      ])
      if (!alive()) return
      if (!rawRosters?.length || rawRosters.length < 4) {
        setState('unavailable')
        setUnavailableReason('Zu wenige Kader in dieser Liga (mindestens 4 nötig).')
        return
      }
      const week = Number(nfl?.week) || 1
      const positions = (rosterPositions?.length ? rosterPositions : league.roster_positions) || []
      const scoring = scoringType === 'half_ppr' ? 'half' : scoringType === 'standard' ? 'std' : 'ppr'
      const weekly = useWeeklyRankingsStore.getState()
      const jobs = []
      for (const pos of WEEK_POSITIONS) jobs.push(weekly.loadIfStale({ pos, scope: 'week', scoring }))
      const upper = new Set(positions.map((s) => String(s).toUpperCase()))
      if (['FLEX', 'REC_FLEX', 'WRRB_FLEX'].some((s) => upper.has(s))) jobs.push(weekly.loadIfStale({ pos: 'FLEX', scope: 'week', scoring }))
      if (upper.has('SUPER_FLEX')) jobs.push(weekly.loadIfStale({ pos: 'SUPER_FLEX', scope: 'week', scoring }))
      jobs.push(weekly.loadSleeperWeekIfStale({ season: Number(seasonYear) || Number(nfl?.season) || new Date().getFullYear(), week }))
      await Promise.all(jobs.map((j) => j.catch(() => null)))
      if (!alive()) return
      if (draftMode === 'rookie') {
        await useDynastyValuesStore.getState()
          .loadDynastyValuesIfStale({ superflex: upper.has('SUPER_FLEX') })
          .catch(() => null)
        if (!alive()) return
      }
      const fresh = useWeeklyRankingsStore.getState()
      const field = pointsFieldFor(scoringType)
      const pointsById = new Map()
      for (const [id, v] of fresh.sleeperWeekById || []) {
        pointsById.set(String(id), v)
      }
      const hasProjections = pointsById.size > 0
      const dynastyValuesByName = draftMode === 'rookie'
        ? new Map((useDynastyValuesStore.getState().dynastyValues || []).map((d) => [d.nname, d.dynasty_value]))
        : null
      // Kader aufbereiten (Muster LineupPage.jsx:169): inkl. team/bye/injury.
      const teams = rawRosters.map((r) => {
        const starterSet = new Set((r.starters || []).map(String))
        const taxiSet = new Set((r.taxi || []).map(String))
        const reserveSet = new Set((r.reserve || []).map(String))
        const rosterPlayers = (r.players || []).map((id) => {
          const meta = playersMeta[id] || {}
          const name = meta.full_name
            || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
            || `#${id}`
          return {
            sleeper_id: String(id),
            name,
            nname: normalizePlayerName(name),
            pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
            team: meta.team || '',
            bye: meta.bye_week != null ? String(meta.bye_week) : '',
            injury_status: meta.injury_status || null,
            slot: taxiSet.has(String(id)) ? 'taxi' : reserveSet.has(String(id)) ? 'ir' : starterSet.has(String(id)) ? 'starter' : 'bench',
          }
        })
        return { rosterId: String(r.roster_id), rosterPlayers }
      })
      const rankMapsByTeam = new Map(
        teams.map((t) => [t.rosterId, buildIdRankMaps({ rosterPlayers: t.rosterPlayers, getRankMap: fresh.getRankMap })])
      )
      // Rest-Spielplan: Matchups currentWeek..playoffWeekStart-1, Fehler pro
      // Woche werden geschluckt (Woche fehlt dann im Schedule = dokumentierte
      // „reduzierte Genauigkeit", kein harter Fehler).
      const matchupsByWeek = new Map()
      await Promise.all(
        Array.from({ length: Math.max(0, playoffWeekStart - week) }, (_, i) => week + i).map(async (w) => {
          try {
            const m = await fetchMatchups(league.league_id, w)
            if (alive() && m?.length) matchupsByWeek.set(w, m)
          } catch {}
        })
      )
      if (!alive()) return
      const schedule = buildRemainingSchedule({ matchupsByWeek, fromWeek: week })
      if (!schedule.length) {
        setState('unavailable')
        setUnavailableReason('Kein Rest-Spielplan verfügbar (Saison ggf. beendet).')
        return
      }
      // Staerke je Team je Simulations-Woche (Bye-bereinigt via bestLineup).
      // Zeilen: [rosterId, punkte, missingCount, dynastyTotal].
      const weeks = [...new Set(schedule.map((g) => g.week))].sort((a, b) => a - b)
      const strengthsByWeek = weeks.map((w) => [w, teams.map((t) => {
        const s = selectAndScore({
          rosterPlayers: t.rosterPlayers,
          rosterPositions: positions,
          rankMaps: rankMapsByTeam.get(t.rosterId),
          byeWeek: String(w),
          pointsById,
          field,
          dynastyValuesByName,
        })
        return [t.rosterId, s.points, s.missingCount, s.dynastyTotal]
      })])
      const missingByTeam = new Map()
      const strengthsPayload = strengthsByWeek.map(([w, rows]) => {
        for (const [id, , missing] of rows) {
          missingByTeam.set(id, Math.max(missingByTeam.get(id) || 0, missing))
        }
        return [w, rows.map(([id, pts]) => [id, pts])]
      })
      // R1: Dynasty-Totals aus der ersten Simulations-Woche (aendern sich nur
      // ueber Bye-Auswahl marginal); null im Redraft-Modus.
      const dynastyTotalsPayload = draftMode === 'rookie'
        ? (strengthsByWeek[0]?.[1] || []).map(([id, , , dt]) => [id, Number(dt) || 0])
        : null
      const applyResults = (results) => {
        const map = useDynastyStore.getState().rosterToUserMap || {}
        const mine = useDynastyStore.getState().mySleeperRosterId
        setOdds((results || []).map((r) => ({
          rosterId: String(r.rosterId),
          name: rosterLabel(r.rosterId, { ownerLabels, rosterToUserMap: map }),
          isMine: String(mine ?? '') === String(r.rosterId),
          winsAvg: r.winsAvg,
          playoffPct: r.playoffPct,
          byePct: r.byePct,
          titlePct: r.titlePct,
          reducedAccuracy: !hasProjections || (missingByTeam.get(String(r.rosterId)) || 0) > 2,
        })).sort((a, b) => b.titlePct - a.titlePct))
        setState('done')
        setProgress(null)
      }
      setState('simulating')
      let worker = null
      try { worker = new SimWorker() } catch { worker = null }
      if (!worker) {
        // R3 Sync-Fallback (alte WebViews ohne Worker).
        const inline = await runInline({
          strengthsPayload, schedule, playoffTeams, dynastyTotals: dynastyTotalsPayload,
          sims: DEFAULT_SIMS, seed: Date.now() % 100000,
          onProgress: (p) => { if (alive()) setProgress(p) },
          isAlive: alive,
        })
        if (!alive() || !inline) return
        applyResults(inline)
        return
      }
      workerRef.current = worker
      worker.onmessage = (e) => {
        if (!alive()) return
        const msg = e?.data || {}
        if (msg.type === 'progress') setProgress({ done: msg.done, total: msg.total })
        else if (msg.type === 'done') applyResults(msg.results)
        else if (msg.type === 'error') {
          setState('unavailable')
          setUnavailableReason('Simulation fehlgeschlagen.')
        }
      }
      worker.onerror = () => {
        if (!alive()) return
        setState('unavailable')
        setUnavailableReason('Simulation fehlgeschlagen.')
      }
      worker.postMessage({
        type: 'run',
        payload: { strengthsPayload, schedule, playoffTeams, sims: DEFAULT_SIMS, seed: Date.now() % 100000, dynastyTotals: dynastyTotalsPayload },
      })
    } catch (e) {
      console.warn('[useSeasonSim] failed', e)
      if (!alive()) return
      setState('unavailable')
      setUnavailableReason('Daten konnten nicht geladen werden.')
    }
  }, [league, seasonYear, scoringType, rosterPositions, ownerLabels, draftMode])

  return { state, progress, odds, unavailableReason, start, cancel }
}
