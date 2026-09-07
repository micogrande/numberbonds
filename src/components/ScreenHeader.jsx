import React from 'react';
import { Home } from 'lucide-react';
import Timer from './Timer';
import styles from './ScreenHeader.module.css';

/**
 * The bar across the top of a play screen: the one way out on the left, in the
 * identical position on every non-home screen (PLAN 3.7), progress through the
 * deck in the middle, and the live timer and live score on the right.
 *
 * The timer and the score stay exactly as they are — PLAN 9.1 is an owner
 * decision, not an open question. They are not a candidate for tidying.
 */
const ScreenHeader = ({
    onBack,
    backLabel = 'Back to Home',
    currentIndex,
    total,
    startTime,
    score
}) => {
    const showProgress = currentIndex !== undefined && total;

    // The timer and the live score belong to a session, so they appear only when
    // there is one. Every non-home screen mounts this header for its one way
    // home — the gate has to be the same pixel on all of them (PLAN 3.7) — and
    // a category screen has no clock to show. This is a rendering condition, not
    // a change to the play screen: PLAN 9.1 is an owner decision and the timer
    // and score stay exactly as they are wherever a session is running.
    const showStatus = startTime !== undefined && startTime !== null;

    return (
        <div className={styles.header}>
            <button
                type="button"
                className={styles.homeButton}
                onClick={onBack}
                aria-label={backLabel}
            >
                <Home size={24} aria-hidden="true" />
            </button>

            <div className={styles.progress}>
                {showProgress ? `${currentIndex + 1} / ${total}` : ''}
            </div>

            {showStatus ? (
                <div className={styles.status}>
                    <Timer startTime={startTime} />
                    <div className={styles.score}>Score: {score}</div>
                </div>
            ) : (
                // Keeps the gate on the left rather than letting it centre
                // itself: `justify-content: space-between` needs something on
                // the other end.
                <div aria-hidden="true" />
            )}
        </div>
    );
};

export default ScreenHeader;
