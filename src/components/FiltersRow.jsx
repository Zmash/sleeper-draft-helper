import { cx } from '../utils/formatting'

export default function FiltersRow({
    searchQuery,
    onSearchChange,
    positionFilter,
    onPositionChange,
    onJumpToNext,
    hideAvoid,
    setHideAvoid,
  }) {
    return (
      <div className="row mt-2 gap">
        <input
          className="flex-1"
          placeholder="Spieler suchen…"
          value={searchQuery}
          onChange={onSearchChange}
        />
  
        <select value={positionFilter} onChange={onPositionChange}>
          {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
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
  