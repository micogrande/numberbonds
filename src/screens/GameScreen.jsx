import React from 'react';
import styles from '../styles/Screens.module.css';
import BondDiagram from '../components/BondDiagram';
import Keypad from '../components/Keypad';
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

                <div className={styles.score}>Score: {score}</div>
            </div>

            <div className={styles.gameArea}>
                <BondDiagram
                    bond={currentBond}
                    userInput={userInput}
                    feedback={feedback}
                />
            </div>

            <Keypad onKeyPress={onKeyPress} />
        </div>
    );
};

export default GameScreen;
