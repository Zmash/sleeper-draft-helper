import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

export default function ProfileBadgeCard({ profile, deviations, isNew, allProfiles, onRebind, onRename }) {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(profile.name)

  const isLeagueBound = !!profile.boundLeagueId
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
        <span className="badge badge--neutral">{isLeagueBound ? 'Liga-gebunden' : 'Format-gebunden'}</span>
        {isNew && <span className="badge badge--info">Neu erkannt</span>}
      </div>

      {deviations?.length > 0 && (
        <p className="form-error">
          Achtung: dieser Draft weicht vom gespeicherten Profil ab — {deviations.join('; ')}
        </p>
      )}

      <div className="row profile-badge-actions">
        {otherProfiles.length > 0 && (
          <select
            className="control control--sm"
            value=""
            onChange={e => { if (e.target.value) onRebind(e.target.value) }}
          >
            <option value="">Anderes Profil verwenden…</option>
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
