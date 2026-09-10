import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { leagueIdsOf } from '../services/profileStore'
import Icon from './Icon'

export default function ProfileBadgeCard({ profile, deviations, isNew, allProfiles, onRebind, onUnbind, onRename, onPersist }) {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(profile.name)

  const boundIds = leagueIdsOf(profile)
  const isLeagueBound = boundIds.length > 0
  const otherProfiles = (allProfiles || []).filter(p => p.id !== profile.id)

  return (
    <div className="card profile-badge-card">
      <div className="profile-badge-row">
        <Icon name={isLeagueBound ? 'anchor' : 'shuffle'} size={16} label={isLeagueBound ? 'Liga-gebunden' : 'Format-gebunden'} />
        {renaming ? (
          <input
            className="control control--sm"
            value={nameInput}
            autoFocus
            onChange={e => setNameInput(e.target.value)}
            onBlur={() => { onRename(nameInput); setRenaming(false) }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          />
        ) : (
          <button type="button" className="profile-badge-name" onClick={() => setRenaming(true)} title="Umbenennen">
            {profile.name}
          </button>
        )}
        <span className="badge badge--neutral">{isLeagueBound ? `Liga-gebunden${boundIds.length > 1 ? ` · ${boundIds.length} Ligen` : ''}` : 'Format-gebunden'}</span>
        {isNew && <span className="badge badge--info">Neu erkannt</span>}
      </div>

      {deviations?.length > 0 && (
        <p className="form-error">
          Achtung: dieser Draft weicht vom gespeicherten Profil ab — {deviations.join('; ')}
        </p>
      )}

      {isNew && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onPersist}>
          Profil für diese Liga speichern
        </button>
      )}
      {isNew && <p className="muted text-xs">Noch nicht gespeichert — Übernimmt das erkannte Format, nichts muss von Hand gesetzt werden.</p>}

      <div className="row profile-badge-actions">
        {otherProfiles.length > 0 && (
          <select
            className="control control--sm"
            value=""
            onChange={e => {
              if (e.target.value === '__auto__') { if (onUnbind) onUnbind() }
              else if (e.target.value) onRebind(e.target.value)
            }}
          >
            <option value="">Anderes Profil verwenden…</option>
            {isLeagueBound && onUnbind && <option value="__auto__">Automatisch (passendes Profil suchen)</option>}
            {otherProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/profiles', { state: { focusProfileId: profile.id } })}>
          Profil verwalten
        </button>
      </div>
    </div>
  )
}
