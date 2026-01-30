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

                {/* Number Selector (5-10) */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                    // fit all on one row
                    flexWrap: 'nowrap',
                    maxWidth: '100%',
                    margin: '20px auto'
                }}>
                    {[5, 6, 7, 8, 9, 10].map(n => (
                        <button
                            key={n}
                            onClick={() => setPracticeTarget(n)}
                            style={{
                                width: '60px',
                                height: '60px',
                                background: practiceTarget === n ? 'var(--color-primary)' : 'white',
                                color: practiceTarget === n ? 'white' : 'var(--color-text)',
                                borderRadius: '12px',
                                fontWeight: '900',
                                fontSize: '1.5rem',
                                border: '2px solid var(--color-text-light)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                transform: practiceTarget === n ? 'scale(1.1)' : 'scale(1)'
                            }}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeScreen;
