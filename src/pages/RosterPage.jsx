import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import RosterSection from '../components/RosterSection'

export default function RosterPage({ selectedLeague, selectedDraft, teamsCount }) {
  const { sleeperUserId } = useSessionStore()
  const { boardPlayers, draftMode } = useBoardStore()
  const { livePicks } = useLiveStore()
  const { dynastyRoster } = useDynastyStore()

  return (
    <RosterSection
      picks={livePicks}
      me={sleeperUserId}
      boardPlayers={boardPlayers}
      league={selectedLeague}
      draft={selectedDraft}
      teamsCount={teamsCount}
      draftMode={draftMode}
      dynastyRoster={dynastyRoster}
    />
  )
}
