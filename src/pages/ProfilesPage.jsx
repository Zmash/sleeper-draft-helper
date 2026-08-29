import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FORMAT_DEFAULTS } from '../services/draftFormat'
import { loadProfiles, renameProfile, duplicateProfile, deleteProfile, createBlankProfile } from '../services/profileStore'
import Icon from '../components/Icon'
import ProfileEditor from '../components/ProfileEditor'

function scoringLabel(t) {
  if (t === 'half_ppr') return 'Half-PPR'
  if (t === 'standard') return 'Standard'
  return String(t || 'ppr').toUpperCase()
}

function formatSummary(profile) {
  const o = profile.overrides || {}
  const fp = profile.fingerprint
  const teams = o.teams ?? fp?.teams ?? FORMAT_DEFAULTS.teams
  const scoring = o.scoring_type ?? fp?.scoringType ?? FORMAT_DEFAULTS.scoringType
  const superflex = o.superflex ?? fp?.superflex ?? false
  return `${teams} Teams · ${scoringLabel(scoring)}${superflex ? ' · Superflex' : ''}`
}

export default function ProfilesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tick, setTick] = useState(0)
  const [expandedId, setExpandedId] = useState(location.state?.focusProfileId || null)
  const [newName, setNewName] = useState('')

  const profiles = useMemo(() => loadProfiles(), [tick])
  const refresh = () => setTick(t => t + 1)

  function handleRename(id, name) {
    renameProfile(id, name)
    refresh()
  }

  function handleDuplicate(id) {
    const copy = duplicateProfile(id)
    refresh()
    if (copy) setExpandedId(copy.id)
  }

  function handleDelete(id, name) {
    if (!window.confirm(`Profil "${name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return
    deleteProfile(id)
    if (expandedId === id) setExpandedId(null)
    refresh()
  }

  function handleCreate() {
    const created = createBlankProfile(newName)
    setNewName('')
    refresh()
    setExpandedId(created.id)
  }

  if (!profiles.length) {
    return (
      <section className="card profiles-empty">
        <div className="dashboard-empty-icon"><Icon name="shuffle" size={40} /></div>
        <h2>Noch keine Profile</h2>
        <p className="muted">
          Profile bündeln Format-Einstellungen und Draft-Strategie — sie entstehen automatisch,
          sobald du eine Liga verbindest oder einen Draft öffnest.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Liga/Mock hinzufügen</button>
      </section>
    )
  }

  return (
    <section className="profiles-page">
      <h2>Profile</h2>
      <div className="row" style={{ gap: 8, marginBottom: '1rem' }}>
        <input className="control" placeholder="Name für neues Profil" value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="btn btn-secondary" onClick={handleCreate}>+ Neues Profil</button>
      </div>

      {profiles.map(profile => (
        <div key={profile.id} className="card profile-hub-card">
          <div className="profile-badge-row">
            <Icon name={profile.boundLeagueId ? 'anchor' : 'shuffle'} size={16} label={profile.boundLeagueId ? 'Liga-gebunden' : 'Format-gebunden'} />
            <strong>{profile.name}</strong>
            <span className="badge badge--neutral">{formatSummary(profile)}</span>
            <span className="muted text-xs">zuletzt geändert: {new Date(profile.updatedAt).toLocaleDateString('de-DE')}</span>
          </div>
          <div className="row profile-badge-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setExpandedId(id => id === profile.id ? null : profile.id)}>
              {expandedId === profile.id ? 'Zuklappen' : 'Bearbeiten'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { const name = window.prompt('Neuer Name', profile.name); if (name) handleRename(profile.id, name) }}>
              Umbenennen
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(profile.id)}>Duplizieren</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(profile.id, profile.name)} title="Löschen">
              <Icon name="trash-2" size={14} />
            </button>
          </div>
          {expandedId === profile.id && (
            <ProfileEditor
              profile={profile}
              detected={{
                scoringType: profile.fingerprint?.scoringType || FORMAT_DEFAULTS.scoringType,
                isSuperflex: profile.fingerprint?.superflex || false,
                teams: profile.fingerprint?.teams || FORMAT_DEFAULTS.teams,
                rounds: FORMAT_DEFAULTS.rounds,
                type: FORMAT_DEFAULTS.type,
                rosterPositions: FORMAT_DEFAULTS.rosterPositions,
                source: 'default',
              }}
              strategyFormat={{
                teams: profile.overrides.teams ?? profile.fingerprint?.teams ?? FORMAT_DEFAULTS.teams,
                scoringType: profile.overrides.scoring_type ?? profile.fingerprint?.scoringType ?? FORMAT_DEFAULTS.scoringType,
                isSuperflex: profile.overrides.superflex ?? profile.fingerprint?.superflex ?? false,
                rosterPositions: profile.overrides.roster_positions ?? FORMAT_DEFAULTS.rosterPositions,
              }}
              season={String(new Date().getFullYear())}
              draftMode={profile.fingerprint?.draftMode || 'redraft'}
              onProfileChange={refresh}
            />
          )}
        </div>
      ))}
    </section>
  )
}
