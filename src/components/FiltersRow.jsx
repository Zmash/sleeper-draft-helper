import { cx } from '../utils/formatting'

export default function FiltersRow({
    searchQuery,
    onSearchChange,
    positionFilter,
    onPositionChange,
    onJumpToNext,
    hideAvoid,
    setHideAvoid,
    ownerLabels,
    teamFilter,
    onTeamFilterChange,
  }) {
    return (
      <div className="row wrap mt-2 gap filters-toolbar">
        <input
          className="flex-1"
          placeholder="Spieler suchen…"
          value={searchQuery}
          onChange={onSearchChange}
        />
  
        <div className="filter-chips" role="group" aria-label="Position filtern">
          {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => (
            <button
              key={p}
              type="button"
              className={cx('filter-chip', positionFilter === p && 'active')}
              aria-pressed={positionFilter === p}
              onClick={() => onPositionChange({ target: { value: p } })}
            >
              {p}
            </button>
          ))}
        </div>
              {/* Team-Filter: wie das Positions-Select stylen -> kein spezieller Wrapper */}
      <select
        value={teamFilter}
        onChange={onTeamFilterChange}
        disabled={!ownerLabels || (ownerLabels.size ?? 0) === 0}
        title="Nur Picks eines Teams anzeigen"
      >
        <option value="ALL">Alle Teams</option>
        {ownerLabels
          ? Array.from(ownerLabels.entries()).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))
          : null}
      </select>
        <button
          type="button"
          className={cx('btn', 'btn-toggle', hideAvoid && 'is-active')}
          onClick={() => setHideAvoid(!hideAvoid)}
          title="Avoid-Spieler ausblenden"
          aria-pressed={hideAvoid}
        >
          {hideAvoid ? 'show avoid' : 'hide avoid'}
        </button>

        <button type="button" className="btn" onClick={onJumpToNext}>
        Jump
      </button>
      </div>
    )
  }
  