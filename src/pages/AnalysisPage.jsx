import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useDynastyValuesStore } from '../stores/useDynastyValuesStore'
import {
  teamDraftRanking, positionalScarcity, tierUsage, positionalRuns,
} from '../services/analysis/draftStats'
import {
  rosterValueSplit, teamPowerRanking, ageProfile, starterVsBenchSplit, withDynastyValueFallback,
} from '../services/analysis/rosterStats'
import { marketDisagreement, expertDisagreement } from '../services/analysis/marketStats'
import { teamKeyFromPick, picksUntilMyNext as computePicksUntilMyNext } from '../services/derive'
import DraftTab from '../components/analysis/DraftTab'
import RosterTab from '../components/analysis/RosterTab'
import MarketTab from '../components/analysis/MarketTab'
import { useSeasonSim } from '../hooks/useSeasonSim'
import SeasonTab from '../components/analysis/SeasonTab'
import { cx } from '../utils/formatting'
import '../styles/analysis.css'

const TABS = [['draft', 'Draft'], ['roster', 'Kader'], ['market', 'Markt'], ['saison', 'Saison']]

export default function AnalysisPage({
  teamsCount, ownerLabels, effRoster, draftSlot, selectedDraft, draftMode, isSuperflex,
  selectedLeague, seasonYear, effScoringType,
}) {
  const [tab, setTab] = useState('draft')
  // Staerke-Modell des Saison-Tabs (Dynasty-Daddy-Paritaet: Projektionen vs.
  // ADP-Marktwert). Lebt hier (nicht im SeasonTab), weil der Hook es braucht.
  // Umschalten zeigt ggf. das gecachte Ergebnis (Hook), kein Auto-Sim.
  const [seasonModel, setSeasonModel] = useState('projections')
  const { sleeperUserId } = useSessionStore()
  const { boardPlayers, marketMeta } = useBoardStore()
  const { livePicks } = useLiveStore()
  const { leagueRosters, mySleeperRosterId, dynastyRoster, rosterToUserMap } = useDynastyStore()
  const { dynastyValues, loadDynastyValuesIfStale } = useDynastyValuesStore()

  const teams = Number(teamsCount) || 12
  const isRookieMode = draftMode === 'rookie'

  // Hintergrund-Import, unabhaengig vom Board-Tab -- laedt/aktualisiert sich
  // von selbst, kein Nutzer-Zutun (siehe useDynastyValuesStore.js).
  useEffect(() => {
    loadDynastyValuesIfStale({ superflex: !!isSuperflex })
  }, [isSuperflex, loadDynastyValuesIfStale])

  const seasonSim = useSeasonSim({
    league: selectedLeague, seasonYear, scoringType: effScoringType,
    rosterPositions: effRoster, ownerLabels, draftMode, model: seasonModel,
  })

  // Nur fuer die Kader-Analyse (Wert-Vergleich ueber die ganze Liga) --
  // Draft-/Markt-Tab bleiben strikt am Board des Nutzers, das misst etwas
  // anderes (eigene Pick-Entscheidungen gegen die eigene Rangliste).
  const rosterBoardPlayers = useMemo(
    () => withDynastyValueFallback(boardPlayers, dynastyValues),
    [boardPlayers, dynastyValues]
  )

  // Eigenes Team: erst ueber einen eigenen Pick, sonst ueber den Draft-Slot.
  // Findet sich keins, bleiben die Ich-Angaben leer -- lieber keine Zahl als
  // die eines geratenen Teams.
  const myTeamKey = useMemo(() => {
    const mine = (livePicks || []).find((p) => p?.picked_by && p.picked_by === sleeperUserId)
    if (mine) return teamKeyFromPick(mine, teams)
    if (draftSlot) {
      const bySlot = (livePicks || []).find((p) => Number(p?.draft_slot) === Number(draftSlot))
      if (bySlot) return teamKeyFromPick(bySlot, teams)
    }
    return null
  }, [livePicks, sleeperUserId, draftSlot, teams])

  const nextPickNo = (livePicks?.length || 0) + 1

  const myPicksUntilNext = useMemo(
    () => computePicksUntilMyNext({ picks: livePicks, meUserId: sleeperUserId, teamsCount: teams, draftSlot }),
    [livePicks, sleeperUserId, teams, draftSlot]
  )

  const ranking = useMemo(
    () => teamDraftRanking({ picks: livePicks, boardPlayers, teamsCount: teams, ownerLabels, myTeamKey }),
    [livePicks, boardPlayers, teams, ownerLabels, myTeamKey]
  )
  const scarcity = useMemo(
    () => positionalScarcity({
      boardPlayers, picks: livePicks, rosterPositions: effRoster, teamsCount: teams,
      rounds: selectedDraft?.settings?.rounds, picksUntilMyNext: myPicksUntilNext,
    }),
    [boardPlayers, livePicks, effRoster, teams, selectedDraft?.settings?.rounds, myPicksUntilNext]
  )
  const tiers = useMemo(
    () => tierUsage({ boardPlayers, picks: livePicks }),
    [boardPlayers, livePicks]
  )
  const runs = useMemo(
    () => positionalRuns({ picks: livePicks, teamsCount: teams }),
    [livePicks, teams]
  )
  const split = useMemo(
    () => rosterValueSplit({
      leagueRosters, boardPlayers: rosterBoardPlayers, rosterPositions: effRoster, myRosterId: mySleeperRosterId,
    }),
    [leagueRosters, rosterBoardPlayers, effRoster, mySleeperRosterId]
  )
  const power = useMemo(
    () => teamPowerRanking({
      leagueRosters, boardPlayers: rosterBoardPlayers, rosterPositions: effRoster, myRosterId: mySleeperRosterId,
      rosterToUserMap, ownerLabels,
    }),
    [leagueRosters, rosterBoardPlayers, effRoster, mySleeperRosterId, rosterToUserMap, ownerLabels]
  )
  const ages = useMemo(
    () => ageProfile({ leagueRosters, rosterPositions: effRoster, myRosterId: mySleeperRosterId }),
    [leagueRosters, effRoster, mySleeperRosterId]
  )
  const starterBench = useMemo(
    () => starterVsBenchSplit({ dynastyRoster, boardPlayers: rosterBoardPlayers }),
    [dynastyRoster, rosterBoardPlayers]
  )
  const market = useMemo(
    () => marketDisagreement({ boardPlayers, picks: livePicks }),
    [boardPlayers, livePicks]
  )
  const expert = useMemo(
    () => expertDisagreement({ boardPlayers, picks: livePicks }),
    [boardPlayers, livePicks]
  )

  return (
    <section className="an-page">
      <nav className="an-tabs" role="tablist" aria-label="Analyse-Bereiche">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            id={`an-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`an-panel-${id}`}
            className={cx('an-tab', tab === id && 'is-on')}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Ein tabpanel je Reiter, per aria-labelledby an seinen Knopf gebunden:
          sonst hoert ein Screenreader zwar die Reiter, kann den angezeigten
          Inhalt aber keinem davon zuordnen. */}
      <div role="tabpanel" id={`an-panel-${tab}`} aria-labelledby={`an-tab-${tab}`}>
        {tab === 'draft' && (
          <DraftTab
            ranking={ranking} scarcity={scarcity} tiers={tiers} runs={runs}
            myTeamKey={myTeamKey} picksUntilMyNext={myPicksUntilNext}
          />
        )}
        {tab === 'roster' && (
          <RosterTab
            split={split} power={power} ages={ages} starterBench={starterBench}
            myRosterId={mySleeperRosterId} isRookieMode={isRookieMode}
          />
        )}
        {tab === 'market' && <MarketTab market={market} expert={expert} marketMeta={marketMeta} nextPickNo={nextPickNo} />}
        {tab === 'saison' && (
          <SeasonTab sim={{
            state: seasonSim.state, progress: seasonSim.progress, odds: seasonSim.odds,
            unavailableReason: seasonSim.unavailableReason,
            onStart: seasonSim.start, onCancel: seasonSim.cancel,
            model: seasonModel, onModelChange: setSeasonModel,
          }} />
        )}
      </div>
    </section>
  )
}
