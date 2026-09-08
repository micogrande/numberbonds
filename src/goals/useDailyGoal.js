import { useCallback, useEffect, useState } from 'react'

import { readGoals } from './goals'

/**
 * The vine, as React state. (GOALS.md)
 *
 * A thin seam over `readGoals`, which is where all the thinking is. This exists
 * for two reasons that a plain call in render would not handle:
 *
 *   1. SHE COMES BACK TO THIS SCREEN. Finishing a session writes a completion
 *      and then navigates; the home screen mounts again afterwards and reads
 *      fresh. That much a plain call would give us.
 *   2. THE DAY ROLLS OVER WHILE THE TAB IS OPEN. A phone left on the home
 *      screen overnight — or, far more likely here, a clock she has just
 *      changed — would otherwise keep painting yesterday's blooms until
 *      something forced a re-render. Re-reading when the tab becomes visible
 *      catches both, costs one localStorage read, and needs no timer.
 *
 * There is deliberately no interval. Polling for a day boundary would be a
 * wakeup every minute for an event that happens once, and the screen is not
 * wrong in a way anybody can see until she looks at it again.
 *
 * @returns {{ tasks: Object[], completed: number, total: number, allDone: boolean, refresh: () => void }}
 */
export function useDailyGoal() {
  const [goals, setGoals] = useState(() => readGoals(Date.now()))

  const refresh = useCallback(() => {
    setGoals(readGoals(Date.now()))
  }, [])

  useEffect(() => {
    // No read on mount: the `useState` initializer above already did it, on this
    // very render. Repeating it here would be a second localStorage hit and a
    // wasted re-render, and `react-hooks/set-state-in-effect` is right to say so.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { ...goals, refresh }
}

export default useDailyGoal
