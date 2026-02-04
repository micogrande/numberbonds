const STORAGE_KEY = 'number_bonds_scores';

export const getStoredScores = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Failed to load scores", e);
        return {};
    }
};

export const getBestScore = (mode, target) => {
    const scores = getStoredScores();
    const key = `${mode}_${target}`;
    return scores[key] || null;
};

export const saveScore = (mode, target, currentScore, currentTime) => {
    const scores = getStoredScores();
    const key = `${mode}_${target}`;
    const previous = scores[key];

    const newEntry = { score: currentScore, time: currentTime, date: Date.now() };

    let isNewRecord = false;

    if (!previous) {
        isNewRecord = true;
        scores[key] = newEntry;
    } else {
        // Condition: Better Score OR (Same Score AND Better Time)
        if (currentScore > previous.score) {
            isNewRecord = true;
            scores[key] = newEntry;
        } else if (currentScore === previous.score && currentTime < previous.time) {
            isNewRecord = true;
            scores[key] = newEntry;
        }
    }

    if (isNewRecord) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    }

    return { isNewRecord, previousBest: previous };
};
