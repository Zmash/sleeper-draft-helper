export default function FiltersRow({
    searchQuery,
    onSearchChange,
    positionFilter,
    onPositionChange,
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
      </div>
    )
  }
  