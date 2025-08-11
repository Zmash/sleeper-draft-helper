// src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar';
import TabNavigation from './components/TabNavigation';
import SetupPage from './pages/SetupPage';
import BoardPage from './pages/BoardPage';
import RosterPage from './pages/RosterPage';

import useDebouncedEffect from './hooks/useDebouncedEffect';

import {
  resolveUserId,
  fetchLeagues,
  fetchLeagueDrafts,
  fetchDraftPicks,
  fetchDraft,
  getCurrentPickLabel,
  formatDraftLabel,
} from './services/sleeperService';

import {
  parseCsv,
  mapFantasyProsRowsToPlayers,
} from './services/csvService';

import * as storage from './services/storageService';
import { cx, parseDraftId, toPercent } from './services/utils';

import './styles/global.css';
// Optional: wenn du dein altes Style beibehalten willst, zusätzlich:
// import './styles/style.css';

export default function App() {
  // THEME
  const [themeMode, setThemeMode] = useState('dark');
  const toggleTheme = () => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));

  // NAV
  const [activeTab, setActiveTab] = useState('setup');

  // CONFIG
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [sleeperUserId, setSleeperUserId] = useState('');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());

  const [availableLeagues, setAvailableLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');

  const [availableDrafts, setAvailableDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');

  const [manualDraftInput, setManualDraftInput] = useState('');

  // CSV / BOARD
  const [csvPlayers, setCsvPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');

  // LIVE DRAFT
  const [livePicks, setLivePicks] = useState([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(5);

  // Load persisted
  useEffect(() => {
    const s = storage.load();
    if (!s) return;
    if (typeof s.themeMode !== 'undefined') setThemeMode(s.themeMode);
    if (s.activeTab) setActiveTab(s.activeTab);
    if (s.sleeperUsername) setSleeperUsername(s.sleeperUsername);
    if (s.sleeperUserId) setSleeperUserId(s.sleeperUserId);
    if (s.seasonYear) setSeasonYear(s.seasonYear);
    if (s.selectedLeagueId) setSelectedLeagueId(s.selectedLeagueId);
    if (s.selectedDraftId) setSelectedDraftId(s.selectedDraftId);
    if (s.searchQuery) setSearchQuery(s.searchQuery);
    if (s.positionFilter) setPositionFilter(s.positionFilter);
    if (typeof s.autoRefreshEnabled !== 'undefined') setAutoRefreshEnabled(!!s.autoRefreshEnabled);
    if (s.refreshIntervalSeconds) setRefreshIntervalSeconds(s.refreshIntervalSeconds);
  }, []);

  // Persist
  useDebouncedEffect(() => {
    storage.save({
      themeMode,
      activeTab,
      sleeperUsername,
      sleeperUserId,
      seasonYear,
      selectedLeagueId,
      selectedDraftId,
      searchQuery,
      positionFilter,
      autoRefreshEnabled,
      refreshIntervalSeconds,
    });
  }, [
    themeMode, activeTab, sleeperUsername, sleeperUserId, seasonYear,
    selectedLeagueId, selectedDraftId, searchQuery, positionFilter,
    autoRefreshEnabled, refreshIntervalSeconds,
  ], 200);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  // Resolve ID (button next to username)
  async function resolveAndSetId() {
    try {
      const { userId } = await resolveUserId({ username: sleeperUsername, userId: sleeperUserId });
      setSleeperUserId(userId);
      alert(`Sleeper User ID: ${userId}`);
    } catch (err) {
      console.error('resolve user id error:', err);
      alert('Could not resolve user ID. Check the username.');
    }
  }

  // Load leagues
  async function loadLeagues() {
    try {
      const { userId } = await resolveUserId({ username: sleeperUsername, userId: sleeperUserId });
      const leagues = await fetchLeagues(userId, seasonYear);
      const mapped = (leagues || []).map((l) => ({
        id: l.league_id || l.id,
        name: l.name || l.display_name || (l.league_id || l.id),
      }));
      setAvailableLeagues(mapped);

      // Optional: wenn du direkt die erste Liga wählen und Drafts laden willst:
      if (mapped.length && !selectedLeagueId) {
        const first = mapped[0].id;
        setSelectedLeagueId(first);
        await loadDrafts(first); // direkt Drafts laden
      }
    } catch (err) {
      console.error('loadLeagues error:', err);
      alert('Failed to load leagues. Please verify username/userId and year.');
    }
  }

  // Load drafts for leagueId (if given) else for selected state
  async function loadDrafts(leagueIdArg) {
    try {
      const leagueId = leagueIdArg || selectedLeagueId;
      if (!leagueId) {
        setAvailableDrafts([]);
        return;
      }
      const drafts = await fetchLeagueDrafts(leagueId);
      const mapped = (drafts || []).map((d) => ({
        id: d.draft_id || d.id,
        name: formatDraftLabel(d),
      }));
      setAvailableDrafts(mapped);

      // Optional: auto-select first if nothing selected
      if (mapped.length && !selectedDraftId) {
        setSelectedDraftId(mapped[0].id);
      }
    } catch (err) {
      console.error('loadDrafts error:', err);
      alert('Failed to load drafts.');
    }
  }

  // When league changes from dropdown in SetupPage
  useEffect(() => {
    if (!selectedLeagueId) return;
    loadDrafts(selectedLeagueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId]);

  // Attach draft via selected or manual input
  async function attachDraft() {
    const id = selectedDraftId || parseDraftId(manualDraftInput);
    if (!id) {
      alert('Please enter a valid draft ID or URL.');
      return;
    }
    try {
      // Try to fetch draft details to improve label and ensure dropdown contains it
      let draftMeta = null;
      try {
        draftMeta = await fetchDraft(id);
      } catch {}
      const entry = { id, name: draftMeta ? formatDraftLabel(draftMeta) : `Manual · ${id}` };
      setAvailableDrafts((prev) => {
        const exists = (prev || []).some((d) => String(d.id) === String(id));
        return exists ? prev : [...(prev || []), entry];
      });

      setSelectedDraftId(id);
      setActiveTab('board');

      const picks = await fetchDraftPicks(id);
      setLivePicks(picks || []);
    } catch (err) {
      console.error('attachDraft error:', err);
      alert('Could not attach draft.');
    }
  }

  // Manual sync for live picks
  async function syncNow() {
    if (!selectedDraftId) return;
    try {
      const picks = await fetchDraftPicks(selectedDraftId);
      setLivePicks(picks || []);
    } catch (err) {
      console.error('sync error:', err);
    }
  }

  // Auto refresh interval
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedDraftId) return;
    const sec = Number(refreshIntervalSeconds) || 5;
    const handle = setInterval(() => { syncNow(); }, Math.max(2000, sec * 1000));
    return () => clearInterval(handle);
  }, [autoRefreshEnabled, refreshIntervalSeconds, selectedDraftId]);

  // CSV handlers
  async function handleCsvFileLoad(file) {
    try {
      const text = await file.text();
      handleCsvTextLoad(text);
    } catch (err) {
      console.error('csv file read error:', err);
      alert('Error reading CSV file.');
    }
  }
  function handleCsvTextLoad(text) {
    try {
      const { rows } = parseCsv(text);
      const players = mapFantasyProsRowsToPlayers(rows);
      setCsvPlayers(players);
      setActiveTab('board'); // optional QoL
    } catch (err) {
      console.error('csv parse error:', err);
      alert('Error parsing CSV text.');
    }
  }

  // Mark board rows with pick status
  const playersWithStatus = useMemo(() => {
    if (!Array.isArray(csvPlayers) || !csvPlayers.length) return [];
    if (!Array.isArray(livePicks) || !livePicks.length) return csvPlayers;

    const pickedByName = new Map();
    for (const p of livePicks) {
      const meta = p?.metadata || {};
      const first = meta.first_name || meta.first || '';
      const last = meta.last_name || meta.last || '';
      const full = `${first} ${last}`.trim().toLowerCase();
      if (!full) continue;
      pickedByName.set(full, p);
    }
    return csvPlayers.map((row) => {
      const name = String(row.name || '').trim().toLowerCase();
      const pick = pickedByName.get(name);
      if (!pick) return row;
      const status = String(pick.user_id) === String(sleeperUserId) ? 'me' : 'other';
      return { ...row, status, pick_no: pick.pick_no ?? row.pick_no };
    });
  }, [csvPlayers, livePicks, sleeperUserId]);

  // Filtered view for board
  const filteredPlayers = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const pf = String(positionFilter || 'ALL').toUpperCase();
    return playersWithStatus.filter((p) => {
      if (pf !== 'ALL' && String(p.pos || '').toUpperCase() !== pf) return false;
      if (!q) return true;
      return String(p.name || '').toLowerCase().includes(q);
    });
  }, [playersWithStatus, searchQuery, positionFilter]);

  // Progress
  const pickedCount = livePicks.length;
  const totalCount = csvPlayers.length || 0;
  const progressPercent = toPercent(pickedCount, totalCount || 1);
  const currentPickLabel = getCurrentPickLabel(livePicks);

  return (
    <div className={cx('app', themeMode === 'dark' && 'theme-dark')}>
      <TopBar themeMode={themeMode} onToggleTheme={toggleTheme} />
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'setup' && (
        <SetupPage
          sleeperUsername={sleeperUsername}
          onSleeperUsernameChange={setSleeperUsername}
          sleeperUserId={sleeperUserId}
          onSleeperUserIdChange={setSleeperUserId}
          seasonYear={seasonYear}
          onSeasonYearChange={setSeasonYear}
          availableLeagues={availableLeagues}
          selectedLeagueId={selectedLeagueId}
          onSelectLeague={setSelectedLeagueId}
          availableDrafts={availableDrafts}
          selectedDraftId={selectedDraftId}
          onSelectDraft={setSelectedDraftId}
          manualDraftInput={manualDraftInput}
          onManualDraftInputChange={setManualDraftInput}
          onResolveUserId={resolveAndSetId}
          onLoadLeagues={loadLeagues}
          onRefreshDrafts={() => loadDrafts(selectedLeagueId)}
          onAttachDraft={attachDraft}
          onCsvFileLoad={handleCsvFileLoad}
          onCsvTextLoad={handleCsvTextLoad}
        />
      )}

      {activeTab === 'board' && (
        <BoardPage
          filteredPlayers={filteredPlayers}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          positionFilter={positionFilter}
          onPositionFilterChange={setPositionFilter}
          autoRefreshEnabled={autoRefreshEnabled}
          onAutoRefreshToggle={setAutoRefreshEnabled}
          refreshIntervalSeconds={refreshIntervalSeconds}
          onRefreshIntervalChange={setRefreshIntervalSeconds}
          onSync={syncNow}
          progress={{
            pickedCount,
            totalCount,
            percent: progressPercent,
            currentPickLabel,
          }}
          isCsvLoaded={Boolean(csvPlayers?.length)}
        />
      )}

      {activeTab === 'roster' && (
        <RosterPage picks={livePicks} me={sleeperUserId} />
      )}
    </div>
  );
}

