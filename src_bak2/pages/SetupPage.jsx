// src/pages/SetupPage.jsx
import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/SetupPage.module.css';

/**
 * Presentational Setup page. All logic comes via props.
 */
export default function SetupPage({
  sleeperUsername = '',
  onSleeperUsernameChange,
  sleeperUserId = '',
  onSleeperUserIdChange,
  seasonYear = new Date().getFullYear(),
  onSeasonYearChange,
  availableLeagues = [],
  selectedLeagueId = '',
  onSelectLeague,
  availableDrafts = [],
  selectedDraftId = '',
  onSelectDraft,
  manualDraftInput = '',
  onManualDraftInputChange,
  onResolveUserId,
  onLoadLeagues,
  onRefreshDrafts,
  onAttachDraft,
  onCsvFileLoad,
  onCsvTextLoad,
}) {
  const csvTextareaRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onCsvFileLoad) onCsvFileLoad(file);
    e.target.value = '';
  };

  const handleCsvTextLoad = () => {
    const text = csvTextareaRef.current?.value || '';
    if (text && onCsvTextLoad) onCsvTextLoad(text);
  };

  return (
    <section className="card">
      <h2>Configuration</h2>
      <p className="muted">Connect to Sleeper and load your FantasyPros CSV.</p>

      {/* Account + season */}
      <div className={styles.grid3}>
        <div className={styles.formGroup}>
          <label htmlFor="slp-username">Sleeper Username</label>
          <div className={styles.row}>
            <input
              id="slp-username"
              type="text"
              value={sleeperUsername}
              onChange={(e) => onSleeperUsernameChange && onSleeperUsernameChange(e.target.value)}
              placeholder="e.g. zmash_dev"
            />
            <button
              type="button"
              className="btn"
              title="Resolve user ID from username"
              onClick={() => onResolveUserId && onResolveUserId()}
            >
              Resolve ID
            </button>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="slp-userid">Sleeper User ID</label>
          <input
            id="slp-userid"
            type="text"
            value={sleeperUserId}
            onChange={(e) => onSleeperUserIdChange && onSleeperUserIdChange(e.target.value)}
            placeholder="numeric id"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="season">Season (Year)</label>
          <input
            id="season"
            type="number"
            min="2000"
            max="2100"
            value={seasonYear}
            onChange={(e) => onSeasonYearChange && onSeasonYearChange(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actionsRow}>
        <button type="button" className="btn" onClick={() => onLoadLeagues && onLoadLeagues()}>
          Load Leagues
        </button>

        <button type="button" className="btn btn--ghost" onClick={() => onRefreshDrafts && onRefreshDrafts()}>
          Refresh Drafts
        </button>
      </div>

      {/* League & Draft */}
      <div className={styles.grid2}>
        <div className={styles.formGroup}>
          <label htmlFor="league">League</label>
          <select
            id="league"
            value={selectedLeagueId}
            onChange={(e) => onSelectLeague && onSelectLeague(e.target.value)}
          >
            <option value="">— Select League —</option>
            {availableLeagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name || l.id}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="draft">Draft</label>
          <select
            id="draft"
            value={selectedDraftId}
            onChange={(e) => onSelectDraft && onSelectDraft(e.target.value)}
          >
            <option value="">— Select Draft —</option>
            {availableDrafts.map((d) => (
              <option key={d.id} value={d.id}>{d.name || d.id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Manual ID/URL */}
      <div className={styles.gridAttach}>
        <div className={styles.formGroup}>
          <label htmlFor="manual">Draft ID or URL</label>
          <input
            id="manual"
            type="text"
            value={manualDraftInput}
            onChange={(e) => onManualDraftInputChange && onManualDraftInputChange(e.target.value)}
            placeholder="e.g. 123456789012345678 or https://sleeper.app/draft/12345"
          />
        </div>
        <div className={styles.formGroup}>
          <label>&nbsp;</label>
          <button type="button" className="btn" onClick={() => onAttachDraft && onAttachDraft()}>
            Attach Draft
          </button>
        </div>
      </div>

      {/* CSV */}
      <div className={styles.cardSection}>
        <h3>FantasyPros CSV</h3>
        <p className="muted">Upload or paste the CSV to populate the board.</p>
        <div className={styles.grid2}>
          <div className={styles.formGroup}>
            <label htmlFor="csv-file">Upload CSV file</label>
            <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="csv-text">Paste CSV text</label>
            <textarea id="csv-text" ref={csvTextareaRef} rows={6} placeholder="Paste CSV content here" />
            <div className={styles.actionsRow}>
              <button type="button" className="btn" onClick={handleCsvTextLoad}>
                Load CSV Text
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

SetupPage.propTypes = {
  sleeperUsername: PropTypes.string,
  onSleeperUsernameChange: PropTypes.func,
  sleeperUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSleeperUserIdChange: PropTypes.func,
  seasonYear: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSeasonYearChange: PropTypes.func,
  availableLeagues: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, name: PropTypes.string })),
  selectedLeagueId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectLeague: PropTypes.func,
  availableDrafts: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, name: PropTypes.string })),
  selectedDraftId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectDraft: PropTypes.func,
  manualDraftInput: PropTypes.string,
  onManualDraftInputChange: PropTypes.func,
  onResolveUserId: PropTypes.func,
  onLoadLeagues: PropTypes.func,
  onRefreshDrafts: PropTypes.func,
  onAttachDraft: PropTypes.func,
  onCsvFileLoad: PropTypes.func,
  onCsvTextLoad: PropTypes.func,
};
