import React, { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'

/** ========================================
 *  Constants & Storage Keys
 *  ======================================== */
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'
const CURRENT_YEAR = new Date().getFullYear()

// LocalStorage keys
const STORAGE_KEY = 'draft-helper-state-v3'
const THEME_STORAGE_KEY = 'draft-helper-theme' // 'dark' | 'light'

/** ========================================
 *  Small Utilities
 *  ======================================== */
const cx = (...classes) => classes.filter(Boolean).join(' ')

const saveToLocalStorage = (partial) => {
  const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  const next = { ...previous, ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

const loadFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const normalizePlayerName = (name) =>
  (name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(jr|sr|iii|ii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// Debounced effect (use to avoid focus flicker on inputs while persisting)
const useDebouncedEffect = (fn, deps, delay = 200) => {
  const timeoutRef = useRef()
  useEffect(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(fn, delay)
    return () => clearTimeout(timeoutRef.current)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

// Draft-ID aus reiner ID oder URL extrahieren
function parseDraftId(input) {
  if (!input) return ''
  const s = String(input).trim()
  // Beispiel-URL: https://sleeper.com/draft/nfl/1259938279696896000
  const fromUrl = s.match(/\/draft\/[^/]+\/(\d+)/i)
  if (fromUrl) return fromUrl[1]
  // reine Zahl?
  const onlyDigits = s.match(/\d{6,}/)
  return onlyDigits ? onlyDigits[0] : ''
}

/** ========================================
 *  Main App Component
 *  ======================================== */
export default function App() {
  // ----- Theme (Dark by default) -----
  const initialTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark'
  const [themeMode, setThemeMode] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  // ----- Persisted state (user + league setup) -----
  const persisted = loadFromLocalStorage()

  const [sleeperUsername, setSleeperUsername] = useState(persisted.username || '')
  const [sleeperUserId, setSleeperUserId] = useState(persisted.userId || '')
  const [seasonYear, setSeasonYear] = useState(String(persisted.year || CURRENT_YEAR))

  const [availableLeagues, setAvailableLeagues] = useState([])
  const [selectedLeagueId, setSelectedLeagueId] = useState(persisted.leagueId || '')

  const [availableDrafts, setAvailableDrafts] = useState([])
  const [selectedDraftId, setSelectedDraftId] = useState(persisted.draftId || '')

  const [leagueUsers, setLeagueUsers] = useState([])

  // CSV + Board state (persisted)
  const [csvRawText, setCsvRawText] = useState(persisted.csvRawText || '')
  const [boardPlayers, setBoardPlayers] = useState(Array.isArray(persisted.boardPlayers) ? persisted.boardPlayers : [])

  // UI filters (persisted)
  const [searchQuery, setSearchQuery] = useState(persisted.searchQuery || '')
  const [positionFilter, setPositionFilter] = useState(persisted.positionFilter || 'ALL')

  // Live picks (NOT persisted)
  const [livePicks, setLivePicks] = useState([])
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(
    typeof persisted.autoRefreshEnabled === 'boolean' ? persisted.autoRefreshEnabled : true
  )
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    Number.isFinite(persisted.refreshIntervalSeconds) ? persisted.refreshIntervalSeconds : 10
  )
  const [lastSyncAt, setLastSyncAt] = useState(null)

  // Tabs (persisted)
  const [activeTab, setActiveTab] = useState(persisted.activeTab || (persisted.leagueId ? 'board' : 'setup'))

  // Android UA Erkennung (für Datei-Chooser)
  const isAndroid = /Android/i.test(navigator.userAgent)

  // Manuelle Draft-ID Eingabe (persisted)
  const [manualDraftInput, setManualDraftInput] = useState(persisted.manualDraftInput || '')

  // Refs
  const prevConfigRef = useRef({
    sleeperUserId,
    selectedLeagueId,
    selectedDraftId,
  })
  const pollingIntervalRef = useRef(null)

  // Persist important fields (debounced) – ALLES außer livePicks/lastSyncAt
  useDebouncedEffect(
    () => {
      saveToLocalStorage({
        // Config
        username: sleeperUsername,
        userId: sleeperUserId,
        year: seasonYear,
        leagueId: selectedLeagueId,
        draftId: selectedDraftId,

        // CSV/Board
        csvRawText,
        boardPlayers,

        // UI
        searchQuery,
        positionFilter,
        autoRefreshEnabled,
        refreshIntervalSeconds,
        activeTab,

        // Manual draft input
        manualDraftInput,
      })
    },
    [
      sleeperUsername, sleeperUserId, seasonYear,
      selectedLeagueId, selectedDraftId,

      csvRawText, boardPlayers,
      searchQuery, positionFilter,
      autoRefreshEnabled, refreshIntervalSeconds,
      activeTab,
      manualDraftInput,
    ],
    200
  )

  /** ========================================
   *  Networking Helpers
   *  ======================================== */
  async function fetchJson(url) {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error('HTTP ' + res.status)
    }
    return res.json()
  }

  async function resolveUserId() {
    if (sleeperUserId) return sleeperUserId
    if (!sleeperUsername) throw new Error('Bitte Benutzername eingeben')
    const data = await fetchJson(`${SLEEPER_API_BASE}/user/${encodeURIComponent(sleeperUsername)}`)
    setSleeperUserId(data.user_id)
    // sofort speichern (snappier)
    saveToLocalStorage({ userId: data.user_id })
    return data.user_id
  }

  async function loadLeagues() {
    const userId = await resolveUserId()
    const leagues = await fetchJson(`${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${seasonYear}`)
    setAvailableLeagues(leagues)

    const preferred = leagues.find(l => l.status === 'drafting' || l.status === 'in_season') || leagues[0]
    if (preferred) {
      setSelectedLeagueId(preferred.league_id)
      saveToLocalStorage({ leagueId: preferred.league_id })
      await loadDraftOptions(preferred.league_id)
    } else {
      await loadDraftOptions('')
    }
  }

  async function loadLeagueUsers(leagueId) {
    if (!leagueId) return
    const users = await fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`)
    setLeagueUsers(users)
  }

  async function loadPicks(draftId) {
    if (!draftId) return []
    const ps = await fetchJson(`${SLEEPER_API_BASE}/draft/${draftId}/picks`)
    setLivePicks(ps)
    setLastSyncAt(new Date())
    return ps
  }

  // Alle Drafts (inkl. Mock) eines Users im Jahr
  async function loadUserDraftsForYear(userId, year) {
    const url = `${SLEEPER_API_BASE}/user/${userId}/drafts/nfl/${year}`
    return fetchJson(url)
  }

  // Drafts der aktuellen Liga
  async function fetchLeagueDrafts(leagueId) {
    if (!leagueId) return []
    return fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/drafts`)
  }

  // Unique-Merge nach draft_id
  function mergeDraftsUnique(...arrays) {
    const map = new Map()
    arrays.flat().forEach(d => {
      if (d && d.draft_id && !map.has(d.draft_id)) {
        map.set(d.draft_id, d)
      }
    })
    return Array.from(map.values())
  }

  // Label für Dropdown: [Mock] / [Liga]
  function formatDraftLabel(d, leaguesById) {
    const isMock = !d.league_id
    const prefix = isMock ? '[Mock]' : '[Liga]'
    const name = d?.metadata?.name || d.draft_id
    const leagueName = !isMock ? (leaguesById.get(d.league_id)?.name || d.league_id) : ''
    return isMock ? `${prefix} ${name}` : `${prefix} ${name} – ${leagueName}`
  }

  // Kombiniert User-(inkl. Mock) + Liga-Drafts und setzt availableDrafts
  async function loadDraftOptions(leagueId) {
    const userId = await resolveUserId()
    const [userDrafts, leagueDrafts] = await Promise.all([
      loadUserDraftsForYear(userId, seasonYear),
      fetchLeagueDrafts(leagueId),
    ])

    const merged = mergeDraftsUnique(userDrafts, leagueDrafts)

    merged.sort(
      (a, b) =>
        (b.start_time || 0) - (a.start_time || 0) ||
        String(b.draft_id).localeCompare(String(a.draft_id))
    )

    setAvailableDrafts(merged)

    if (!selectedDraftId && merged.length) {
      setSelectedDraftId(merged[0].draft_id)
      saveToLocalStorage({ draftId: merged[0].draft_id })
    }
  }

  // Draft direkt per ID/URL "registrieren" und laden
  async function attachDraftByIdOrUrl(input) {
    const id = parseDraftId(input)
    if (!id) throw new Error('Bitte gültige Draft-ID oder URL eingeben.')

    await loadPicks(id)

    const exists = availableDrafts.some(d => d.draft_id === id)
    if (!exists) {
      setAvailableDrafts(prev => [{ draft_id: id, metadata: { name: `Draft ${id}` } }, ...prev])
    }

    setSelectedDraftId(id)
    saveToLocalStorage({ draftId: id })
    alert('Draft per ID/URL gesetzt.')
  }

  /** ========================================
   *  CSV Parsing / Mapping
   *  ======================================== */
  function parseFantasyProsCsv(text) {
    if (!text?.trim()) return []
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })

    return (parsed.data || []).map((row, idx) => ({
      id: idx + 1,
      rk: row['RK'] || String(idx + 1),
      tier: row['TIERS'] || '',
      name: row['PLAYER NAME'] || row['Player'] || row['Name'] || '',
      team: row['TEAM'] || row['Team'] || '',
      pos: (row['POS'] || row['Position'] || '').replace(/\d+/g, ''),
      bye: row['BYE WEEK'] || row['Bye'] || '',
      sos: (() => {
        const raw = row['SOS SEASON'] || row['SOS'] || ''
        const m = String(raw).match(/(\d)\s*(?:out\s*of|\/)\s*5/i)
        return m ? `${m[1]}/5` : raw
      })(),
      ecrVsAdp: row['ECR VS. ADP'] || row['ECRvsADP'] || '',
      nname: normalizePlayerName(row['PLAYER NAME'] || row['Player'] || row['Name'] || ''),
      status: null,     // null | 'me' | 'other'
      pick_no: null,
      picked_by: null,
    }))
  }

  // Re-map player statuses whenever livePicks update
  useEffect(() => {
    if (!boardPlayers.length) return

    const byNormalizedName = new Map(boardPlayers.map(p => [p.nname, p]))

    for (const pick of livePicks || []) {
      const fullName = normalizePlayerName(`${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`)
      const player = byNormalizedName.get(fullName)
      if (player) {
        player.status = pick.picked_by === sleeperUserId ? 'me' : 'other'
        player.pick_no = pick.pick_no
        player.picked_by = pick.picked_by
      }
    }

    // neue sortierte Kopie setzen
    const updated = [...byNormalizedName.values()].sort((a, b) => Number(a.rk) - Number(b.rk))
    setBoardPlayers(updated)
    // Markierungen/Board sofort speichern (snappier)
    saveToLocalStorage({ boardPlayers: updated })
  }, [livePicks]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ========================================
   *  Derived UI State
   *  ======================================== */
  const filteredPlayers = useMemo(() => {
    const q = normalizePlayerName(searchQuery)
    return boardPlayers.filter(p => {
      if (positionFilter !== 'ALL' && p.pos !== positionFilter) return false
      if (!q) return true
      return normalizePlayerName(p.name).includes(q)
    })
  }, [boardPlayers, searchQuery, positionFilter])

  const pickedCount = useMemo(
    () => boardPlayers.filter(p => p.status).length,
    [boardPlayers]
  )

  const currentPickNumber = livePicks?.length
    ? Math.max(...livePicks.map(p => p.pick_no || 0))
    : 0

  const progressPercent = boardPlayers.length
    ? Math.round((pickedCount / boardPlayers.length) * 100)
    : 0

  /** ========================================
   *  Polling for live updates
   *  ======================================== */
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedDraftId) return

    clearInterval(pollingIntervalRef.current)
    pollingIntervalRef.current = setInterval(() => {
      loadPicks(selectedDraftId).catch(() => {})
    }, Math.max(4, Number(refreshIntervalSeconds)) * 1000)

    return () => clearInterval(pollingIntervalRef.current)
  }, [autoRefreshEnabled, selectedDraftId, refreshIntervalSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ========================================
   *  React to League changes (and also when none is selected)
   *  ======================================== */
  useEffect(() => {
    // Immer Draft-Optionen laden: User+Mock, plus ggf. Liga
    loadDraftOptions(selectedLeagueId).catch(() => {})

    if (selectedLeagueId) {
      loadLeagueUsers(selectedLeagueId).catch(() => {})
    }
  }, [selectedLeagueId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ========================================
   *  Map der Ligen (für Labels im Draft-Select)
   *  ======================================== */
  const leaguesById = useMemo(() => {
    const m = new Map()
    ;(availableLeagues || []).forEach(l => m.set(l.league_id, l))
    return m
  }, [availableLeagues])

  /** ========================================
   *  Detect config changes → re-mark
   *  ======================================== */
  useEffect(() => {
    const prev = prevConfigRef.current
    const changed =
      prev.sleeperUserId !== sleeperUserId ||
      prev.selectedLeagueId !== selectedLeagueId ||
      prev.selectedDraftId !== selectedDraftId

    if (changed && boardPlayers.length) {
      const ok = window.confirm('Konfiguration geändert. Markierungen zurücksetzen und neu synchronisieren?')
      if (ok) {
        const cleared = boardPlayers.map(p => ({ ...p, status: null, pick_no: null, picked_by: null }))
        setBoardPlayers(cleared)
        saveToLocalStorage({ boardPlayers: cleared })
        if (selectedDraftId) loadPicks(selectedDraftId)
        setActiveTab('board')
        saveToLocalStorage({ activeTab: 'board' })
      }
    }

    prevConfigRef.current = { sleeperUserId, selectedLeagueId, selectedDraftId }
  }, [sleeperUserId, selectedLeagueId, selectedDraftId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ========================================
   *  Event Handlers
   *  ======================================== */
  async function handleCsvLoad() {
    try {
      if (!csvRawText.trim()) {
        alert('Bitte CSV einfügen oder Datei wählen.')
        return
      }

      if (boardPlayers.length) {
        const ok = window.confirm('Es ist bereits eine CSV geladen. Aktuelle Daten überschreiben?')
        if (!ok) return
      }

      const rows = parseFantasyProsCsv(csvRawText)
      if (!rows.length) {
        alert('CSV konnte nicht gelesen werden.')
        return
      }

      const fresh = rows.map(r => ({ ...r, status: null, pick_no: null, picked_by: null }))

      setBoardPlayers(fresh)
      // sofort sichern
      saveToLocalStorage({ csvRawText, boardPlayers: fresh })

      if (selectedDraftId) await loadPicks(selectedDraftId)
      setActiveTab('board')
      saveToLocalStorage({ activeTab: 'board' })

      alert('CSV erfolgreich geladen.')
    } catch (e) {
      alert('Fehler beim Laden der CSV: ' + (e.message || e))
    }
  }

  /** ========================================
   *  Render
   *  ======================================== */
  return (
    <div className="wrap">
      {/* Header */}
      <header className="topbar">
        <h1>Sleeper Draft Helper</h1>

        <button
          className="btn"
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {themeMode === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      {/* Tabs */}
      <nav className="tabs">
        <button className={cx('tab', activeTab === 'setup' && 'active')} onClick={() => { setActiveTab('setup'); saveToLocalStorage({ activeTab: 'setup' })}}>
          Setup
        </button>
        <button className={cx('tab', activeTab === 'board' && 'active')} onClick={() => { setActiveTab('board'); saveToLocalStorage({ activeTab: 'board' })}}>
          Board
        </button>
        <button className={cx('tab', activeTab === 'roster' && 'active')} onClick={() => { setActiveTab('roster'); saveToLocalStorage({ activeTab: 'roster' })}}>
          Roster
        </button>
      </nav>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <section className="card">
          <h2>Konfiguration</h2>
          <p className="muted">Sleeper verbinden und FantasyPros‑CSV laden.</p>

          <div className="grid3">
            {/* Username */}
            <label className="field">
              <span>Benutzername (Sleeper)</span>
              <input
                value={sleeperUsername}
                onChange={(e) => setSleeperUsername(e.target.value)}
                placeholder="deinName123"
                autoComplete="username"
              />
            </label>

            {/* User ID */}
            <label className="field">
              <span>User ID (auto)</span>
              <div className="row">
                <input
                  value={sleeperUserId}
                  onChange={(e) => setSleeperUserId(e.target.value)}
                  placeholder="wird ermittelt"
                />
                <button
                  className="btn responsive"
                  onClick={async () => {
                    try {
                      const id = await resolveUserId()
                      alert('User ID: ' + id)
                    } catch (err) {
                      alert(err.message)
                    }
                  }}
                >
                  Ermitteln
                </button>
              </div>
            </label>

            {/* Year */}
            <label className="field">
              <span>Jahr</span>
              <input value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} />
            </label>
          </div>

          {/* Load leagues / drafts */}
          <div className="row mt-2 wrap">
            <button className="btn responsive" onClick={loadLeagues}>
              Ligen laden
            </button>
            <button
              className="btn ghost responsive"
              onClick={async () => {
                try {
                  await loadDraftOptions(selectedLeagueId)
                  alert('Drafts aktualisiert.')
                } catch (e) {
                  alert('Konnte Drafts nicht aktualisieren: ' + (e.message || e))
                }
              }}
            >
              Drafts aktualisieren
            </button>
          </div>

          <div className="grid2 mt-2">
            {/* League */}
            <label className="field">
              <span>League</span>
              <select
                value={selectedLeagueId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedLeagueId(val)
                  saveToLocalStorage({ leagueId: val })
                }}
              >
                <option value="" disabled>— auswählen —</option>
                {availableLeagues.map((l) => (
                  <option key={l.league_id} value={l.league_id}>
                    {l.name || l.league_id}
                  </option>
                ))}
              </select>
            </label>

            {/* Draft */}
            <label className="field">
              <span>Draft</span>
              <select
                value={selectedDraftId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedDraftId(val)
                  saveToLocalStorage({ draftId: val })
                }}
              >
                <option value="" disabled>— auswählen —</option>
                {availableDrafts.map((d) => (
                  <option key={d.draft_id} value={d.draft_id}>
                    {formatDraftLabel(d, leaguesById)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Manuelle Draft-ID / URL */}
          <div className="mt-3">
            <label className="field">
              <span>Draft-ID oder URL</span>
              <div className="row">
                <input
                  placeholder="z. B. 1259938279696896000 oder https://sleeper.com/draft/nfl/1259938279696896000"
                  value={manualDraftInput}
                  onChange={(e) => setManualDraftInput(e.target.value)}
                />
                <button
                  className="btn responsive"
                  onClick={async () => {
                    try {
                      await attachDraftByIdOrUrl(manualDraftInput)
                    } catch (e) {
                      alert(e.message || String(e))
                    }
                  }}
                >
                  Per ID laden
                </button>
              </div>
            </label>
          </div>

          {/* CSV */}
          <div className="mt-3">
            <label className="field">
              <span>FantasyPros CSV</span>
              <input
                type="file"
                accept={isAndroid ? "*/*" : ".csv,text/csv,application/csv,application/vnd.ms-excel,text/plain"}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  const name = (file.name || '').toLowerCase()
                  const mime = (file.type || '').toLowerCase()
                  const looksLikeCsv =
                    name.endsWith('.csv') ||
                    ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'].includes(mime)

                  if (!looksLikeCsv) {
                    alert('Bitte eine CSV-Datei wählen.')
                    e.target.value = ''
                    return
                  }

                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const text = String(ev.target?.result || '')
                    setCsvRawText(text)
                    saveToLocalStorage({ csvRawText: text })
                  }
                  reader.onerror = () => alert('Die Datei konnte nicht gelesen werden.')
                  reader.readAsText(file) // UTF‑8
                }}
              />
            </label>

            <textarea
              rows={6}
              className="mt-2"
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              placeholder={"RK,TIERS,\"PLAYER NAME\",TEAM,\"POS\",\"BYE WEEK\",\"SOS SEASON\",\"ECR VS. ADP\"\\n1,1,\"Ja'Marr Chase\",CIN,\"WR1\",\"10\",\"3 out of 5 stars\",\"0\""}
            />

            <div className="row mt-2 wrap">
              <button className="btn responsive" onClick={handleCsvLoad}>
                CSV laden
              </button>
              <button
                className="btn ghost responsive"
                onClick={() => {
                  setCsvRawText('')
                  saveToLocalStorage({ csvRawText: '' })
                }}
              >
                Eingabe leeren
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Board Tab */}
      {activeTab === 'board' && (
        <section className="card">
          <div className="row between items-center wrap">
            <h2>Draft Board</h2>

            <div className="toolbar">
              <span className="chip chip--small">Aktuelle Picks: {currentPickNumber}</span>

              <label className="toolbar-item">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled}
                  onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                />
                <span>Auto‑Refresh</span>
              </label>

              <div className="toolbar-item">
                <span>Intervall (s)</span>
                <input
                  className="w-16"
                  value={refreshIntervalSeconds}
                  onChange={(e) => setRefreshIntervalSeconds(Number(e.target.value || 10))}
                />
              </div>

              <button className="btn ghost" onClick={() => selectedDraftId && loadPicks(selectedDraftId)}>
                Sync
              </button>

              {lastSyncAt && (
                <span className="muted text-xs">
                  zuletzt:{' '}
                  {lastSyncAt.toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="row mt-2 gap">
            <input
              className="flex-1"
              placeholder="Spieler suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
              {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Progress */}
          <div className="progress mt-2">
            <div style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="muted text-xs mt-1">
            {pickedCount} von {boardPlayers.length} Spielern markiert
          </div>

          {/* Table */}
          <div className="table-wrap mt-3">
            <table className="nowrap">
              <thead>
                <tr>
                  <th className="col-rk">#</th>
                  <th className="col-name">Name</th>
                  <th className="col-team">Team</th>
                  <th className="col-pos">Pos</th>
                  <th className="col-bye">Bye</th>
                  <th className="col-sos">SOS</th>
                  <th className="col-ecr">ECR±ADP</th>
                  <th className="col-pick">Pick</th>
                </tr>
              </thead>

              <tbody>
                {filteredPlayers.map((p) => (
                  <tr
                    key={`${p.id}-${p.name}`}
                    className={cx(p.status === 'me' && 'row-me', p.status === 'other' && 'row-other')}
                    style={{ lineHeight: 1.8 }}
                  >
                    <td className="col-rk"   style={{ padding: '0.9rem 0.8rem' }}>{p.rk}</td>
                    <td className="col-name" style={{ padding: '0.9rem 0.8rem' }}>
                      <span className={cx('pill', p.status === 'me' && 'pill-me', p.status === 'other' && 'pill-other')}>
                        {p.name}
                      </span>
                    </td>
                    <td className="col-team" style={{ padding: '0.9rem 0.8rem' }}>{p.team}</td>
                    <td className="col-pos"  style={{ padding: '0.9rem 0.8rem' }}>{p.pos}</td>
                    <td className="col-bye"  style={{ padding: '0.9rem 0.8rem' }}>{p.bye}</td>
                    <td className="col-sos"  style={{ padding: '0.9rem 0.8rem' }}>{p.sos}</td>
                    <td className="col-ecr"  style={{ padding: '0.9rem 0.8rem' }}>{p.ecrVsAdp}</td>
                    <td className="col-pick" style={{ padding: '0.9rem 0.8rem' }}>{p.pick_no || ''}</td>
                  </tr>
                ))}

                {!boardPlayers.length && (
                  <tr>
                    <td colSpan={8} className="muted center" style={{ padding: '1rem' }}>
                      Noch keine CSV geladen.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Roster Tab */}
      {activeTab === 'roster' && (
        <section className="card">
          <h2>Mein Roster</h2>
          <RosterList picks={livePicks} me={sleeperUserId} />
        </section>
      )}

      <footer className="muted text-xs mt-6">
        SleeperDarftHelper byZmash
      </footer>
    </div>
  )
}

/** ========================================
 *  Roster List Component
 *  ======================================== */
function RosterList({ picks, me }) {
  const mine = (picks || []).filter((p) => p.picked_by === me)

  const positionOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
  mine.sort((a, b) => {
    const ai = positionOrder.indexOf(a?.metadata?.position || '')
    const bi = positionOrder.indexOf(b?.metadata?.position || '')
    if (ai !== bi) return ai - bi
    return (a.pick_no || 0) - (b.pick_no || 0)
  })

  if (!mine.length) {
    return <div className="muted">Noch keine eigenen Picks.</div>
  }

  return (
    <div className="grid2">
      {mine.map((m) => (
        <div key={m.pick_no} className="card" style={{ padding: '12px' }}>
          <div className="row between">
            <strong>
              {m.metadata?.first_name} {m.metadata?.last_name}
            </strong>
            <span className="chip">#{m.pick_no}</span>
          </div>

          <div className="muted text-xs" style={{ marginTop: '4px' }}>
            {m.metadata?.position} • {m.metadata?.team}
          </div>
        </div>
      ))}
    </div>
  )
}
