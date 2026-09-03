import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { parseDraftId } from '../utils/parse'

// Echter Sleeper-Draft mit vollen settings (teams, rounds, slots_*, scoring_type) —
// genau das, was deriveFormat braucht, im Gegensatz zum alten Stub
// { draft_id, metadata: { name } }.
const DRAFT_ID = '1259938279696896001'
const REAL_DRAFT = {
  draft_id: DRAFT_ID,
  type: 'snake',
  settings: { teams: 12, rounds: 15, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1 },
  metadata: { scoring_type: 'ppr', name: 'Mock 7' },
}

function mockFetch(routes) {
  return vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    if (!key) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
    const r = routes[key]
    if (r instanceof Error) return Promise.reject(r)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(r) })
  })
}

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals() })

describe('attachDraftByIdOrUrl', () => {
  it('ruft fetchDraft auf und legt den echten Draft (mit settings) in availableDrafts ab, nicht nur einen Stub', async () => {
    vi.stubGlobal('fetch', mockFetch({
      [`/draft/${DRAFT_ID}/picks`]: [],
      [`/draft/${DRAFT_ID}`]: REAL_DRAFT,
    }))
    const { useSessionStore } = await import('./useSessionStore')

    const result = await useSessionStore.getState().attachDraftByIdOrUrl(
      `https://sleeper.com/draft/nfl/${DRAFT_ID}`,
      parseDraftId
    )

    expect(result).toBe(DRAFT_ID)
    const stored = useSessionStore.getState().availableDrafts.find((d) => d.draft_id === DRAFT_ID)
    expect(stored).toBeTruthy()
    expect(stored.settings).toEqual(REAL_DRAFT.settings)
    expect(stored.metadata.scoring_type).toBe('ppr')
    expect(useSessionStore.getState().selectedDraftId).toBe(DRAFT_ID)
  })

  it('ersetzt einen vorhandenen Stub durch die frisch geladenen echten Daten', async () => {
    vi.stubGlobal('fetch', mockFetch({
      [`/draft/${DRAFT_ID}/picks`]: [],
      [`/draft/${DRAFT_ID}`]: REAL_DRAFT,
    }))
    const { useSessionStore } = await import('./useSessionStore')
    useSessionStore.setState({
      availableDrafts: [{ draft_id: DRAFT_ID, metadata: { name: `Draft ${DRAFT_ID}` } }],
    })

    await useSessionStore.getState().attachDraftByIdOrUrl(DRAFT_ID, parseDraftId)

    const stored = useSessionStore.getState().availableDrafts.find((d) => d.draft_id === DRAFT_ID)
    expect(stored.settings).toEqual(REAL_DRAFT.settings)
  })

  it('gibt null zurueck bei ungueltiger Eingabe, ohne zu werfen', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    const { useSessionStore } = await import('./useSessionStore')
    const result = await useSessionStore.getState().attachDraftByIdOrUrl('kaputt', parseDraftId)
    expect(result).toBeNull()
  })

  it('gibt null zurueck, wenn fetchDraft fehlschlaegt (kein Draft unter der ID)', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    const { useSessionStore } = await import('./useSessionStore')
    const result = await useSessionStore.getState().attachDraftByIdOrUrl('999999999999999', parseDraftId)
    expect(result).toBeNull()
  })
})

describe('loadDraftOptions', () => {
  // Bug (verifiziert gegen einen echten laufenden Draft, 2026-09-03):
  // /user/{id}/drafts/nfl/{jahr} liefert fuer einen Draft, der AUCH in der
  // gerade betrachteten Liga laeuft, eine abgespeckte Variante
  // (draft_order: null, kein slot_to_roster_id) -- /league/{id}/drafts
  // liefert dieselbe draft_id vollstaendig. mergeDraftsUnique behaelt bei
  // doppelten IDs das ERSTE Vorkommen -- die Liga-Variante muss also zuerst
  // in den Merge, sonst gewinnt dauerhaft die leere User-Variante.
  const LEAGUE_ID = 'L1'
  const DRAFT_ID2 = 'D-shared'
  const userDraftStub = {
    draft_id: DRAFT_ID2, league_id: LEAGUE_ID, draft_order: null,
    settings: { teams: 12, rounds: 14 },
  }
  const leagueDraftFull = {
    draft_id: DRAFT_ID2, league_id: LEAGUE_ID,
    draft_order: { u1: 1, u2: 2 },
    settings: { teams: 12, rounds: 14 },
  }

  it('bevorzugt die vollstaendige Liga-Draft-Variante ueber die abgespeckte User-Draft-Variante', async () => {
    vi.stubGlobal('fetch', mockFetch({
      [`/user/u0/drafts/`]: [userDraftStub],
      [`/league/${LEAGUE_ID}/drafts`]: [leagueDraftFull],
    }))
    const { useSessionStore } = await import('./useSessionStore')
    useSessionStore.setState({ sleeperUserId: 'u0' })

    await useSessionStore.getState().loadDraftOptions(LEAGUE_ID)

    const stored = useSessionStore.getState().availableDrafts.find((d) => d.draft_id === DRAFT_ID2)
    expect(stored.draft_order).toEqual({ u1: 1, u2: 2 })
  })
})
