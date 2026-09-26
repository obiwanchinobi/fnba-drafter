import { useEffect, useMemo, useState } from 'react'
import {
  fetchDraft,
  refreshDraft,
  type DraftPick,
  type DraftState,
} from '../api/draft.ts'
import DraftPanel from '../components/DraftPanel.tsx'
import ProjectionsPage from './ProjectionsPage.tsx'

export default function DraftPage() {
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [hideDrafted, setHideDrafted] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDraft()
      .then((state) => {
        if (!cancelled) setDraft(state)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load draft')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keyed by player_id so the table can mark rows; ESPN players FNBA cannot
  // match (player_id null) stay off the board.
  const drafted = useMemo(() => {
    const map = new Map<number, DraftPick>()
    for (const pick of draft?.picks ?? []) {
      if (pick.player_id != null) map.set(pick.player_id, pick)
    }
    return map
  }, [draft])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      setDraft(await refreshDraft())
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to refresh draft picks',
      )
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ProjectionsPage
      title="Draft night"
      defaultView="z"
      panel={
        <DraftPanel
          draft={draft}
          refreshing={refreshing}
          error={error}
          onRefresh={handleRefresh}
          hideDrafted={hideDrafted}
          onHideDraftedChange={setHideDrafted}
        />
      }
      drafted={drafted}
      hideDrafted={hideDrafted}
    />
  )
}
