import React from 'react'

export default function SetupForm({
  // Werte
  sleeperUsername,
  sleeperUserId,
  seasonYear,
  availableLeagues,
  selectedLeagueId,
  availableDrafts,
  selectedDraftId,
  leaguesById,
  manualDraftInput,
  csvRawText,
  isAndroid,
  lastSyncAt, // wird hier nicht genutzt, aber ok falls du später Zeitstempel zeigen willst

  // Actions/Handler (aus App.jsx durchgereicht)
  setSleeperUsername,
  setSleeperUserId,
  setSeasonYear,
  setSelectedLeagueId,
  setSelectedDraftId,
  setManualDraftInput,
  setCsvRawText,

  saveToLocalStorage,
  resolveUserId,
  loadLeagues,
  loadDraftOptions,
  attachDraftByIdOrUrl,
  handleCsvLoad,
  formatDraftLabel,
}) {
  return (
    <section className="card">
      <h2>Konfiguration</h2>
      <p className="muted">Sleeper verbinden und FantasyPros-CSV laden.</p>

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
              placeholder="z. B. 1259938279696896000 oder https://sleeper.com/draft/nfl/1259938279696896000"
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
              reader.readAsText(file) // UTF-8
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
  )
}
