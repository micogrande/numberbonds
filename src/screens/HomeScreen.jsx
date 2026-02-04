import React, { useState } from 'react';
import styles from '../styles/Screens.module.css';

const HomeScreen = ({ onStart }) => {
    const [practiceTarget, setPracticeTarget] = useState(10);

    return (
        <div className={`${styles.screen} ${styles.homeContainer}`}>
            <h1 className={styles.title}>Number Bonds</h1>

            <div className={styles.menuButtons}>
                <button
                    className={styles.primaryButton}
                    onClick={() => onStart('PRACTICE', practiceTarget)}
                >
                    Practice Bonds to {practiceTarget}
                </button>

                <button
                    className={styles.secondaryButton}
                    onClick={() => onStart('PRACTICE_PARTS', practiceTarget)}
                    style={{ width: '100%' }}
                >
                    Practice Parts up to {practiceTarget}
                </button>

                {/* Number Selectors */}
                <div className={styles.numberGrid}>
                    {/* Range 3-20 (18 numbers) - Perfect 6x3 Grid */}
                    {Array.from({ length: 18 }, (_, i) => i + 3).map(n => (
                        <NumberButton key={n} num={n} target={practiceTarget} setTarget={setPracticeTarget} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const NumberButton = ({ num, target, setTarget }) => (
    <button
        onClick={() => setTarget(num)}
        className={`${styles.numberButton} ${target === num ? styles.active : ''}`}
    >
        {num}
    </button>
);

export default HomeScreen;
