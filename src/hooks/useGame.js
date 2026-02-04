import { useState, useCallback } from 'react';
import { generateDeck, generateMixedDeck } from '../engines/BondEngine';
import { saveScore } from '../storage/ScoreStorage';
import confetti from 'canvas-confetti';

const MODES = {
    MENU: 'MENU',
    PRACTICE: 'PRACTICE',
    PRACTICE_PARTS: 'PRACTICE_PARTS',
    SUMMARY: 'SUMMARY'
};

export const useGame = () => {
    const [mode, setMode] = useState(MODES.MENU);
    const [target, setTarget] = useState(10);

    // Game State
    const [deck, setDeck] = useState([]);
    const [currentBond, setCurrentBond] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    // UX State
    const [userInput, setUserInput] = useState('');
    const [feedback, setFeedback] = useState('idle');
    const [score, setScore] = useState(0);

    // Timer State
    const [startTime, setStartTime] = useState(null);
    const [finalTime, setFinalTime] = useState(0);

    // High Score State
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [previousBest, setPreviousBest] = useState(null);

    const startGame = (selectedMode, targetVal = 10) => {
        setMode(selectedMode);
        setTarget(targetVal);

        // Initialize Session
        let newDeck;
        if (selectedMode === MODES.PRACTICE_PARTS) {
            newDeck = generateMixedDeck(targetVal);
        } else {
            newDeck = generateDeck(targetVal);
        }

        setDeck(newDeck);
        setCurrentIndex(0);
        setCurrentBond(newDeck[0]);
        setScore(0);
        setUserInput('');
        setFeedback('idle');
        setStartTime(Date.now());
        setFinalTime(0);
        setIsNewRecord(false);
        setPreviousBest(null);
    };

    const nextProblem = useCallback(() => {
        setUserInput('');
        setFeedback('idle');

        const nextIdx = currentIndex + 1;

        if (nextIdx < deck.length) {
            setCurrentIndex(nextIdx);
            setCurrentBond(deck[nextIdx]);
        } else {
            // Session Complete
            const time = Date.now() - startTime;
            setFinalTime(time);

            // Save Score
            const { isNewRecord: newRec, previousBest: prev } = saveScore(mode, target, score, time);
            setIsNewRecord(newRec);
            setPreviousBest(prev);

            setMode(MODES.SUMMARY);
        }
    }, [currentIndex, deck, startTime, mode, target, score]);

    const submitInput = (val) => {
        if (feedback !== 'idle') return;

        const numVal = parseInt(val, 10);
        if (isNaN(numVal)) return;

        if (numVal === currentBond.answer) {
            // Correct!
            setFeedback('success');
            setScore(s => s + 1);
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#ec4899', '#22c55e']
            });
            setTimeout(() => {
                nextProblem();
            }, 1500);
        } else {
            // Incorrect -> Show Correction -> Next
            setFeedback('error');

            // 1. Shake
            setTimeout(() => {
                // 2. Reveal Answer
                setFeedback('correction');
                setUserInput(currentBond.answer.toString());
            }, 500);

            // 3. Move On (No Score Inc)
            setTimeout(() => {
                nextProblem();
            }, 2500);
        }
    };

    const handleKeypad = (key) => {
        if (feedback !== 'idle') return;

        if (key === 'ENTER') {
            submitInput(userInput);
            return;
        }

        if (key === 'DEL') {
            setUserInput(prev => prev.slice(0, -1));
            return;
        }

        // Limit input length to 3 digits
        if (userInput.length >= 3) return;

        setUserInput(prev => prev + key);
    };

    return {
        mode,
        score,
        total: deck.length,
        currentIndex,
        currentBond,
        userInput,
        feedback,
        startGame,
        handleKeypad,
        MODES,
        startTime,
        finalTime,
        isNewRecord,
        previousBest
    };
};
