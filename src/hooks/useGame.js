import { useState, useCallback, useEffect } from 'react';
import { generateDeck } from '../engines/BondEngine';
import confetti from 'canvas-confetti';

const MODES = {
    MENU: 'MENU',
    PRACTICE: 'PRACTICE',
    SUMMARY: 'SUMMARY'
};

export const useGame = () => {
    const [mode, setMode] = useState(MODES.MENU);
    const [target, setTarget] = useState(10);

    // Game State
    const [deck, setDeck] = useState([]);
    const [currentBond, setCurrentBond] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    // UI State
    const [userInput, setUserInput] = useState('');
    const [feedback, setFeedback] = useState('idle');
    const [score, setScore] = useState(0); // Correct count

    const startGame = (selectedMode, targetVal = 10) => {
        setMode(selectedMode);
        setTarget(targetVal);

        // Initialize Session
        const newDeck = generateDeck(targetVal);
        setDeck(newDeck);
        setCurrentIndex(0);
        setCurrentBond(newDeck[0]);
        setScore(0);
        setUserInput('');
        setFeedback('idle');
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
            setMode(MODES.SUMMARY);
        }
    }, [currentIndex, deck]);

    // Trigger first problem when mode changes to active
    // This useEffect is no longer needed as startGame now initializes the first problem
    // useEffect(() => {
    //     if (mode !== MODES.MENU) {
    //         nextProblem();
    //     }
    // }, [mode, nextProblem]);

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

        const nextInput = userInput + key;

        // 1. Check Exact Match (WIN)
        if (parseInt(nextInput, 10) === currentBond.answer) {
            setUserInput(nextInput);
            submitInput(nextInput);
            return;
        }

        // 2. Check Prefix Match (WAIT)
        const answerString = currentBond.answer.toString();
        if (answerString.startsWith(nextInput)) {
            setUserInput(nextInput);
            return;
        }

        // 3. No match? (FAIL)
        setUserInput(nextInput);
        submitInput(nextInput);
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
        MODES
    };
};
