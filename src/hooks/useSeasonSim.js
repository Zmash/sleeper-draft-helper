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
import { buildIdRankMaps, selectAndScore, adpTeamValue, normalizeToScale } from '../services/analysis/seasonStrengths'
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
async function runInline({ strengthsPayload, schedule, playoffTeams, dynastyTotals, playoffStrengths, sims, seed, onProgress, isAlive }) {
  const { simulateSeason, aggregateOdds, SIM_CHUNK } = await import('../services/analysis/seasonSim')
  const strengthsByWeek = new Map(strengthsPayload.map(([w, rows]) => [Number(w), new Map(rows)]))
  const dynMap = dynastyTotals ? new Map(dynastyTotals) : null
  const playoffMap = playoffStrengths ? new Map(playoffStrengths) : null
  const rosterIds = [...new Set(schedule.flatMap((g) => [g.a, g.b]))]
  const results = []
  for (let done = 0; done < sims; done += SIM_CHUNK) {
    if (!isAlive()) return null
    const n = Math.min(SIM_CHUNK, sims - done)
    for (let i = 0; i < n; i++) {
      results.push(simulateSeason({ strengthsByWeek, schedule, playoffTeams, seed: seed + done + i, dynastyTotals: dynMap, playoffStrengths: playoffMap }))
    }
    onProgress({ done: Math.min(done + n, sims), total: sims })
    await new Promise((r) => setTimeout(r, 0))
  }
  if (!isAlive()) return null
  return [...aggregateOdds(results, { rosterIds, sims }).entries()].map(([rosterId, o]) => ({ rosterId, ...o }))
}

export function useSeasonSim({ league, seasonYear, scoringType, rosterPositions, ownerLabels, draftMode, model = 'projections' }) {
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

  // Liga kann nach dem Mount kommen (async Load, Deep-Link) oder wechseln:
  // dann zurück auf Start (alte Odds nie stehen lassen).
  useEffect(() => {
    runIdRef.current += 1
    try { workerRef.current?.terminate() } catch {}
    workerRef.current = null
    if (league?.league_id) {
      setState('idle')
      setUnavailableReason(null)
    } else {
      setState('unavailable')
      setUnavailableReason('Keine Liga ausgewählt.')
    }
    setProgress(null)
    setOdds(null)
  }, [league?.league_id])

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
      const isAdp = model === 'adp'
      const ffcFormat = scoringType === 'half_ppr' ? 'half-ppr' : scoringType === 'standard' ? 'standard' : 'ppr'
      const [nfl, rawRosters, playersMeta, adpJson] = await Promise.all([
        fetchNflState().catch(() => null),
        fetchLeagueRosters(league.league_id).catch(() => []),
        loadPlayersMetaCached({ season: Number(seasonYear) || new Date().getFullYear() }).catch(() => ({})),
        // ADP-Linse: Sleeper-ADP (RotoWire, voller Kader-Coverage) nur laden,
        // wenn das Modell aktiv ist — sonst kein zusaetzlicher Request.
        isAdp
          ? fetch(`/api/rankings/sleeper-adp?format=${ffcFormat}`).then((r) => r.json()).catch(() => null)
          : Promise.resolve(null),
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
      // Echte Tabellenstände für die projizierte Endbilanz (V1: Seeding bleibt
      // vereinfacht auf Sim-Siegen, siehe Spec — V1.1-Kandidat).
      // Ties ignoriert (kein Standard-Format).
      const winsBase = new Map(
        (rawRosters || []).map((r) => [String(r.roster_id), Number(r.settings?.wins) || 0])
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
          } catch (e) {
            console.warn('[useSeasonSim] Matchups übersprungen (Woche wandert nicht in die Sim)', w, e?.message || e)
          }
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
      // V1-Vereinfachung: Wochenprojektionen der AKTUELLEN Woche werden fuer
      // alle Restwochen fortgeschrieben; Wochen unterscheiden sich nur via
      // Bye-Ausschluss (Spec § Datenfluss).
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
      // Playoff-Baum (Wochen 15+, keine Byes): volle Kader-Staerke ohne
      // Bye-Ausschluss statt Last-Week-Staerke.
      const playoffStrengthsPayload = teams.map((t) => {
        const s = selectAndScore({
          rosterPlayers: t.rosterPlayers,
          rosterPositions: positions,
          rankMaps: rankMapsByTeam.get(t.rosterId),
          byeWeek: null,
          pointsById,
          field,
          dynastyValuesByName: null,
        })
        return [t.rosterId, s.points]
      })
      // Spiele je Team (fuer Record-Format) + mittleres Rating (fuer
      // Rating-Spalte) aus Schedule bzw. Wochen-Staerken.
      const gamesByTeam = new Map()
      for (const g of schedule) {
        gamesByTeam.set(g.a, (gamesByTeam.get(g.a) || 0) + 1)
        gamesByTeam.set(g.b, (gamesByTeam.get(g.b) || 0) + 1)
      }
      const ratingAcc = new Map()
      for (const [, rows] of strengthsPayload) {
        for (const [id, pts] of rows) {
          const cur = ratingAcc.get(id) || { sum: 0, n: 0 }
          cur.sum += Number(pts) || 0
          cur.n += 1
          ratingAcc.set(id, cur)
        }
      }
      // ADP-Linse: Draftwert statt Wochenpunkten. Rohwerte je Team, normiert
      // auf Mittelwert+Streuung der Projektions-Woche-1 (gleiche ELO-Skala und
      // gleiche Entschiedenheit — nur die Team-Reihenfolge kommt aus ADP).
      // ADP ist wochen-unabhaengig: alle Wochen + Playoff-Baum nutzen dieselbe
      // normierte Staerke (keine Bye-Schwankungen in einer Wert-Linse).
      let effStrengthsPayload = strengthsPayload
      let effPlayoff = playoffStrengthsPayload
      let effMissingByTeam = missingByTeam
      let effRatingAcc = ratingAcc
      let hasStrengthData = hasProjections
      if (isAdp) {
        const adpByName = new Map()
        for (const p of adpJson?.players || []) {
          const key = p?.nname || normalizePlayerName(p?.name || '')
          const adp = Number(p?.adp)
          if (key && Number.isFinite(adp)) adpByName.set(key, adp)
        }
        if (!adpByName.size) {
          setState('unavailable')
          setUnavailableReason('ADP-Daten konnten nicht geladen werden.')
          return
        }
        const raw = teams.map((t) => {
          const v = adpTeamValue({ rosterPlayers: t.rosterPlayers, adpByName })
          return [t.rosterId, v.value, v.missingCount]
        })
        const refPts = (strengthsByWeek[0]?.[1] || []).map(([, pts]) => Number(pts)).filter(Number.isFinite)
        const refMean = refPts.length ? refPts.reduce((a, b) => a + b, 0) / refPts.length : 100
        const refVar = refPts.length ? refPts.reduce((a, b) => a + (b - refMean) ** 2, 0) / refPts.length : 0
        const norm = normalizeToScale(raw.map(([id, value]) => [id, value]), { mean: refMean, sd: Math.sqrt(refVar) })
        effMissingByTeam = new Map(raw.map(([id, , missing]) => [id, missing]))
        effStrengthsPayload = weeks.map((w) => [w, [...norm].map(([id, pts]) => [id, pts])])
        effPlayoff = [...norm].map(([id, pts]) => [id, pts])
        effRatingAcc = new Map([...norm].map(([id, pts]) => [id, { sum: pts, n: 1 }]))
        hasStrengthData = true
      }
      const ratingOf = (id) => {
        const c = effRatingAcc.get(String(id))
        return c?.n ? c.sum / c.n : null
      }
      const applyResults = (results) => {
        const map = useDynastyStore.getState().rosterToUserMap || {}
        const mine = useDynastyStore.getState().mySleeperRosterId
        setOdds((results || []).map((r) => ({
          rosterId: String(r.rosterId),
          name: rosterLabel(r.rosterId, { ownerLabels, rosterToUserMap: map }),
          isMine: String(mine ?? '') === String(r.rosterId),
            winsAvg: r.winsAvg + (winsBase.get(String(r.rosterId)) || 0),
            games: gamesByTeam.get(String(r.rosterId)) || 0,
            rating: ratingOf(r.rosterId),
          playoffPct: r.playoffPct,
          byePct: r.byePct,
          titlePct: r.titlePct,
          reducedAccuracy: !hasStrengthData || (effMissingByTeam.get(String(r.rosterId)) || 0) > 2,
        })).sort((a, b) => b.titlePct - a.titlePct))
        setState('done')
        setProgress(null)
      }
      try { workerRef.current?.terminate() } catch {}
      workerRef.current = null
      setState('simulating')
      let worker = null
      try { worker = new SimWorker() } catch { worker = null }
      if (!worker) {
        // R3 Sync-Fallback (alte WebViews ohne Worker).
        const inline = await runInline({
          strengthsPayload: effStrengthsPayload, schedule, playoffTeams, dynastyTotals: dynastyTotalsPayload,
          playoffStrengths: effPlayoff,
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
          try { workerRef.current?.terminate() } catch {}
          workerRef.current = null
        }
      }
      worker.onerror = () => {
        if (!alive()) return
        setState('unavailable')
        setUnavailableReason('Simulation fehlgeschlagen.')
        try { workerRef.current?.terminate() } catch {}
        workerRef.current = null
      }
      worker.postMessage({
        type: 'run',
        // Worker-Protokoll: strengthsByWeek (Array-Paare) — der Worker liest
        // p.strengthsByWeek; falscher Key = leere Map = alle W-L bei 7.
        payload: { strengthsByWeek: effStrengthsPayload, schedule, playoffTeams, sims: DEFAULT_SIMS, seed: Date.now() % 100000, dynastyTotals: dynastyTotalsPayload, playoffStrengths: effPlayoff },
      })
    } catch (e) {
      console.warn('[useSeasonSim] failed', e)
      if (!alive()) return
      setState('unavailable')
      setUnavailableReason('Daten konnten nicht geladen werden.')
    }
  }, [league, seasonYear, scoringType, rosterPositions, ownerLabels, draftMode, model])

  return { state, progress, odds, unavailableReason, start, cancel }
}
