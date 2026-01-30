import React from 'react';
import styles from './Summary.module.css';
import confetti from 'canvas-confetti';

const SummaryScreen = ({ score, total, onRestart }) => {
    // Launch confetti on mount if score is perfect
    React.useEffect(() => {
        if (score === total) {
            confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.6 }
            });
        }
    }, [score, total]);

    return (
        <div className={styles.summaryContainer}>
            <h2 className={styles.summaryTitle}>Session Complete!</h2>

            <div className={styles.summaryScore}>
                {score} / {total}
            </div>

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
