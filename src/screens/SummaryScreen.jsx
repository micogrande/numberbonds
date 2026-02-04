import React from 'react';
import styles from './Summary.module.css';
import confetti from 'canvas-confetti';

const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SummaryScreen = ({ score, total, finalTime, isNewRecord, previousBest, onRestart }) => {
    // Launch confetti on mount if score is perfect
    React.useEffect(() => {
        if (score === total || isNewRecord) {
            confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.6 }
            });
        }
    }, [score, total, isNewRecord]);

    return (
        <div className={styles.summaryContainer}>
            <h2 className={styles.summaryTitle}>Session Complete!</h2>

            <div className={styles.summaryScore}>
                {score} / {total}
            </div>

            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '10px' }}>
                Time: {formatTime(finalTime)}
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
                    Previous Best: {previousBest.score} in {formatTime(previousBest.time)}
                </div>
            )}

            <p className={styles.summaryDetails}>
                {score === total ? 'Perfect Score! 🌟' : 'Great Practice! Keep it up!'}
            </p>

            <button className={styles.restartButton} onClick={onRestart}>
                Play Again
            </button>
        </div>
    );
};

export default SummaryScreen;
