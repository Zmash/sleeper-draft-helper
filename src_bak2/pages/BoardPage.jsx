import React from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/BoardPage.module.css';
import ProgressBar from '../components/ProgressBar';
import PlayersTable from '../components/PlayersTable';
import { cx } from '../services/utils';

/**
 * BoardPage
 * ---------
 * Presentational page for the draft board.
 * Receives filtered players and UI state/handlers via props.
 * No business logic or data fetching here.
 *
 * Props:
 * - filteredPlayers: array of normalized player rows to display
 * - searchQuery, onSearchQueryChange
 * - positionFilter, onPositionFilterChange
 * - autoRefreshEnabled, onAutoRefreshToggle
 * - refreshIntervalSeconds, onRefreshIntervalChange
 * - onSync: manually trigger a refresh
 * - progress: { pickedCount, totalCount, percent, currentPickLabel }
 * - isCsvLoaded: boolean to show empty-state hint
 */
export default function BoardPage({
  filteredPlayers = [],
  searchQuery = '',
  onSearchQueryChange,
  positionFilter = 'ALL',
  onPositionFilterChange,
  autoRefreshEnabled = false,
  onAutoRefreshToggle,
  refreshIntervalSeconds = 5,
  onRefreshIntervalChange,
  onSync,
  progress = { pickedCount: 0, totalCount: 0, percent: 0, currentPickLabel: '' },
  isCsvLoaded = false,
}) {
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K'];

  return (
    <section className="card">
      <div className={cx(styles.headerRow)}>
        <h2>Draft Board</h2>
        <div className={styles.headerMeta}>
          {progress?.currentPickLabel ? (
            <span className={styles.currentPick} title="Current pick">
              {progress.currentPickLabel}
            </span>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => onSync && onSync()}
            title="Sync live picks now"
          >
            Sync
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search players…"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange && onSearchQueryChange(e.target.value)}
        />
        <select
          value={positionFilter}
          onChange={(e) => onPositionFilterChange && onPositionFilterChange(e.target.value)}
        >
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className={styles.refreshControls}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => onAutoRefreshToggle && onAutoRefreshToggle(e.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
          <label className={styles.interval}>
            <span>every</span>
            <input
              type="number"
              min="2"
              max="60"
              value={Number.isFinite(+refreshIntervalSeconds) ? +refreshIntervalSeconds : 5}
              onChange={(e) => onRefreshIntervalChange && onRefreshIntervalChange(Number(e.target.value || 5))}
            />
            <span>sec</span>
          </label>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.progressWrap}>
        <ProgressBar percent={+progress?.percent || 0} />
        <div className={styles.progressMeta}>
          <span>{progress?.pickedCount ?? 0} of {progress?.totalCount ?? 0} players marked</span>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <PlayersTable players={filteredPlayers} isCsvLoaded={isCsvLoaded} />
      </div>
    </section>
  );
}

BoardPage.propTypes = {
  filteredPlayers: PropTypes.arrayOf(PropTypes.object),
  searchQuery: PropTypes.string,
  onSearchQueryChange: PropTypes.func,
  positionFilter: PropTypes.string,
  onPositionFilterChange: PropTypes.func,
  autoRefreshEnabled: PropTypes.bool,
  onAutoRefreshToggle: PropTypes.func,
  refreshIntervalSeconds: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onRefreshIntervalChange: PropTypes.func,
  onSync: PropTypes.func,
  progress: PropTypes.shape({
    pickedCount: PropTypes.number,
    totalCount: PropTypes.number,
    percent: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    currentPickLabel: PropTypes.string,
  }),
  isCsvLoaded: PropTypes.bool,
};
