import { useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import {
  teamDraftRanking, positionalScarcity, tierUsage, positionalRuns,
} from '../services/analysis/draftStats'
import { rosterValueSplit } from '../services/analysis/rosterStats'
import { marketDisagreement } from '../services/analysis/marketStats'
import { teamKeyFromPick, picksUntilMyNext as computePicksUntilMyNext } from '../services/derive'
import DraftTab from '../components/analysis/DraftTab'
import RosterTab from '../components/analysis/RosterTab'
import MarketTab from '../components/analysis/MarketTab'
import { cx } from '../utils/formatting'
import '../styles/analysis.css'

const TABS = [['draft', 'Draft'], ['roster', 'Kader'], ['market', 'Markt']]

export default function AnalysisPage({ teamsCount, ownerLabels, effRoster, draftSlot, selectedDraft }) {
  const [tab, setTab] = useState('draft')
  const { sleeperUserId } = useSessionStore()
  const { boardPlayers } = useBoardStore()
  const { livePicks } = useLiveStore()
  const { leagueRosters, mySleeperRosterId } = useDynastyStore()

  const teams = Number(teamsCount) || 12

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
      leagueRosters, boardPlayers, rosterPositions: effRoster, myRosterId: mySleeperRosterId,
    }),
    [leagueRosters, boardPlayers, effRoster, mySleeperRosterId]
  )
  const market = useMemo(
    () => marketDisagreement({ boardPlayers, picks: livePicks }),
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
        {tab === 'roster' && <RosterTab split={split} />}
        {tab === 'market' && <MarketTab market={market} nextPickNo={nextPickNo} />}
      </div>
    </section>
  )
}
