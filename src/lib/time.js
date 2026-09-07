/**
 * Wall-clock formatting for the live timer and the summary.
 *
 * This was duplicated verbatim in Timer.jsx and SummaryScreen.jsx (PLAN 5, dead
 * code). It is moved here unchanged — personal bests rank on wall-clock time
 * (PLAN 2.6), so the two readings she compares must be formatted by exactly the
 * same code.
 *
 * Minutes are not rolled into hours on purpose: a session is minutes long, and
 * "62:03" is a more honest reading of a forgotten tab than "1:02:03".
 *
 * @param {number} ms  Elapsed milliseconds.
 * @returns {string} `m:ss`
 */
export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return `${mins}:${secs.toString().padStart(2, '0')}`
}
