import React from 'react';
import styles from '../styles/Screens.module.css';
import BondDiagram from '../components/BondDiagram';
import Keypad from '../components/Keypad';
import Timer from '../components/Timer';
import { Home } from 'lucide-react';

const GameScreen = ({
    gameData,
    onKeyPress,
    onBack
}) => {
    const { currentBond, userInput, feedback, score, total, currentIndex } = gameData;

    return (
        <div className={`${styles.screen} ${styles.gameContainer}`}>
            <div className={styles.header}>
                <button onClick={onBack} aria-label="Back to Home">
                    <Home color="var(--color-text-light)" />
                </button>

                {/* Progress Indicator */}
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                    {currentIndex !== undefined && total ? `${currentIndex + 1} / ${total}` : ''}
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Timer startTime={gameData.startTime} />
                    <div className={styles.score}>Score: {score}</div>
                </div>
            </div>


            <div className={styles.mainContent}>
                <div className={styles.gameArea}>
                    <BondDiagram
                        bond={currentBond}
                        userInput={userInput}
                        feedback={feedback}
                    />
                </div>

                <Keypad onKeyPress={onKeyPress} />
            </div>
        </div>
    );
};

export default GameScreen;
