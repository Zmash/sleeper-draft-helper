// Duenner WebWorker fuer die Saison-Simulation: empfaengt Inputs, simuliert in
// SIM_CHUNK-Bloecken (UI bleibt responsiv, Progress pro Block), postet Odds.
// Abbruch via {type:'cancel'}. Kein Unit-Test (Vitest laedt keine Worker);
// Logik liegt in seasonSim.js und ist dort getestet.
import { simulateSeason, aggregateOdds, SIM_CHUNK } from '../services/analysis/seasonSim'

let cancelled = false

function toMap(pairs) {
  const m = new Map()
  for (const [k, v] of pairs || []) m.set(k, v)
  return m
}

self.onmessage = (e) => {
  const msg = e?.data || {}
  if (msg.type === 'cancel') { cancelled = true; return }
  if (msg.type !== 'run') return
  cancelled = false
  try {
    const p = msg.payload || {}
    const strengthsByWeek = new Map()
    for (const [week, pairs] of p.strengthsByWeek || []) {
      strengthsByWeek.set(Number(week), toMap(pairs))
    }
    const dynastyTotals = p.dynastyTotals ? toMap(p.dynastyTotals) : null
    const schedule = (p.schedule || []).map((g) => ({ week: Number(g.week), a: String(g.a), b: String(g.b) }))
    const sims = Math.max(1, Number(p.sims) || 1)
    const rosterIds = [...new Set(schedule.flatMap((g) => [g.a, g.b]))]
    const results = []
    const chunk = SIM_CHUNK
    for (let done = 0; done < sims; done += chunk) {
      if (cancelled) return
      const n = Math.min(chunk, sims - done)
      for (let i = 0; i < n; i++) {
        results.push(simulateSeason({
          strengthsByWeek,
          schedule,
          playoffTeams: p.playoffTeams,
          seed: (Number(p.seed) || 0) + done + i,
          dynastyTotals,
        }))
      }
      self.postMessage({ type: 'progress', done: Math.min(done + n, sims), total: sims })
    }
    if (cancelled) return
    const odds = aggregateOdds(results, { rosterIds, sims })
    self.postMessage({ type: 'done', results: [...odds.entries()].map(([rosterId, o]) => ({ rosterId, ...o })) })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message || err) })
  }
}
