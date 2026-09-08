import React from 'react';
import styles from './Summary.module.css';
import Screen, { ScreenChrome, ScreenContent } from '../components/screen/Screen';
import Bloom from '../components/garden/Bloom';
import { useDailyGoal } from '../goals/useDailyGoal';
import ScreenHeader from '../components/ScreenHeader';
import { celebrateSession } from '../feedback/celebrate';
import { formatTime } from '../lib/time';

/**
 * The result of a session, on its own route (PLAN 2.5).
 *
 * Two ways off it, and they are different things now that routing exists:
 * `onRestart` deals a new deck of the same option, and the gate top-left goes
 * home like it does on every other non-home screen. Before this step there was
 * one button labelled "Play Again" that went to the menu.
 *
 * It takes the finished session as ONE object rather than as five props, for the
 * same reason the play host holds a `reported` ref: the object's identity is the
 * only thing that distinguishes this finished game from the next one. Two
 * sessions can easily agree on every value in it.
 */

/**
 * The denominator for a stored personal best.
 *
 * PLAN 5 lists "no `total` stored, so *Previous Best: 10* has no denominator" as
 * a bug, and PLAN 2.6 stores `total` precisely so this line can read
 * "Previous best: 10 / 18". Three shapes reach here and all three have to read
 * as a real fraction:
 *
 *   - a record written by `scores.js`, which stores the deck size it was out of
 *   - a record the migration rescued, whose `total` was reconstructed from the
 *     old recipe (`storage/migrations.js`) because the old store kept none
 *   - a record from a shape older still, with no `total` at all — a store
 *     written before either of those, or hand-edited
 *
 * The last one falls back to THIS session's deck size, and that is sound rather
 * than a guess: a best is filed under `${id}::${option}::v${version}`, and PLAN
 * 2.2 bumps `version` exactly when the recipe changes enough to make old scores
 * incomparable. A record sharing this key was therefore scored out of the deck
 * she has just played. Only if that is missing too does the fraction collapse
 * back to a bare number, because "4 / 0" is worse than saying less.
 *
 * @param {{ total?: number }|null} previousBest
 * @param {number} total  This session's deck size.
 * @returns {number|null}
 */
function previousDenominator(previousBest, total) {
    const stored = previousBest?.total;
    if (Number.isFinite(stored) && stored > 0) return stored;

    return Number.isFinite(total) && total > 0 ? total : null;
}

/**
 * @param {Object} props
 * @param {{ score: number, total: number, wallMs: number, isNewRecord: boolean,
 *           previousBest: Object|null }} props.result  One finished session.
 * @param {() => void} props.onRestart
 * @param {() => void} props.onHome
 */
const SummaryScreen = ({ result, onRestart, onHome }) => {
    // Read here rather than in a child: this screen mounts immediately after
    // PlayHost has written the completion, so the numbers are already current.
    const day = useDailyGoal();

    const { score, total, wallMs, isNewRecord, previousBest } = result;

    /**
     * Confetti, once per finished session.
     *
     * Guarded on the IDENTITY of the result, which is the same discipline as the
     * session's epoch guard in `useSession` and the play host's `reported` ref.
     * Without it React 19's StrictMode mounts this screen, tears the effect down
     * and mounts it again, so every dev session she is shown got two hundred
     * particles twice — and any re-render that changed the dependencies would do
     * it again in production.
     *
     * A ref rather than state: nothing renders differently because of it, and a
     * ref survives StrictMode's simulated remount, which is the whole point.
     */
    const celebrated = React.useRef(null);

    React.useEffect(() => {
        if (celebrated.current === result) return;
        celebrated.current = result;

        if (score === total || isNewRecord) celebrateSession();
    }, [result, score, total, isNewRecord]);

    const previousTotal = previousDenominator(previousBest, total);

    return (
        // growth="flow". Bounded in practice, but not by a constant anyone can
        // write down: what this screen draws varies with isNewRecord, with
        // isFirstResult, and with whether the previous-best line wraps. If you
        // cannot name the constant, it is flow — and the payoff is concrete, at
        // 667x375 the Play Again button used to sit 94px below the fold with
        // zero visible height and nothing able to scroll to it.
        <Screen growth="flow">
            <ScreenChrome>
                <ScreenHeader onBack={onHome} />
            </ScreenChrome>

            <ScreenContent mode="center" className={styles.summaryContainer}>
                <h2 className={styles.summaryTitle}>Session Complete!</h2>

                <div className={styles.summaryScore}>
                    {score} / {total}
                </div>

                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '10px' }}>
                    Time: {formatTime(wallMs)}
                </div>

                {isNewRecord && (
                    <div style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontWeight: 700,
                        marginBottom: '15px',
                        display: 'inline-block'
                    }}>
                        🏆 New Personal Best!
                    </div>
                )}

                {!isNewRecord && previousBest && (
                    <div style={{
                        color: 'var(--color-text-light)',
                        fontSize: '1rem',
                        marginBottom: '15px'
                    }}>
                        {/* A fraction, never a bare number: "4" above "3 / 8" is
                            not a score she can compare (PLAN 2.6). The time is
                            beside it because wall-clock time is what personal
                            bests rank on. */}
                        Previous best: {previousBest.score}
                        {previousTotal === null ? '' : ` / ${previousTotal}`} in{' '}
                        {formatTime(previousBest.wallMs)}
                    </div>
                )}

                <p className={styles.summaryDetails}>
                    {score === total ? 'Perfect Score! 🌟' : 'Great Practice! Keep it up!'}
                </p>

                {/* The day's vine, at the moment it is actually earned.
                    (GOALS.md section 3)

                    Past tense, always — "you did", never "do three to get". And
                    the finished-day line is deliberately quiet: this screen has
                    ALREADY fired confetti for the session, and if finishing the
                    whole day looked the same, neither would mean anything. The
                    bunny arriving home on the home screen is the celebration;
                    this is the receipt. */}
                {day.total > 0 && (
                    <div className={styles.day}>
                        <div className={styles.dayBlooms} aria-hidden="true">
                            {day.tasks.map((task, index) => (
                                <Bloom key={`${task.key}-${index}`} open={task.done} className={styles.dayBloom} />
                            ))}
                        </div>
                        <p className={styles.dayText}>
                            {day.allDone
                                ? `You did everything on your list today.`
                                : `You did ${day.completed} of ${day.total} today.`}
                        </p>
                    </div>
                )}

                <button className={styles.restartButton} onClick={onRestart}>
                    Play Again
                </button>
            </ScreenContent>
        </Screen>
    );
};

export default SummaryScreen;
