/**
 * Generates a Number Bond problem.
 * @param {number} whole - The target whole number (e.g. 10)
 * @returns {Object} { whole, parts: [p1, p2], missingIndex: 0|1 }
 */
/**
 * Generates a full deck of all permutations for a target number.
 * @param {number} whole
 * @returns {Array} Array of bond objects
 */
export const generateDeck = (whole) => {
    const deck = [];
    // Generate all pairs: 0+N, 1+(N-1), ... N+0
    for (let i = 0; i <= whole; i++) {
        deck.push({
            whole,
            parts: [i, whole - i],
            missingIndex: Math.random() < 0.5 ? 0 : 1, // Randomize which part is missing
            answer: Math.random() < 0.5 ? i : (whole - i) // Actually answer depends on missingIndex
        });
        // Fix answer logic:
        // If missingIndex is 0, answer is parts[0] which is i
        // If missingIndex is 1, answer is parts[1] which is whole-i
        deck[deck.length - 1].answer = deck[deck.length - 1].missingIndex === 0 ? i : (whole - i);
    }

    // Shuffle logic (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
};

export const generateBond = (whole) => {
    // Deprecated for main game, keeping for legacy/testing
    const deck = generateDeck(whole);
    return deck[0];
};
