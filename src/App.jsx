import React from 'react';
import { useGame } from './hooks/useGame';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import SummaryScreen from './screens/SummaryScreen';

function App() {
    const game = useGame();

    return (
        <div className="full-screen">
            {game.mode === game.MODES.MENU && (
                <HomeScreen onStart={game.startGame} />
            )}

            {(game.mode === game.MODES.PRACTICE || game.mode === game.MODES.PRACTICE_PARTS) && (
                <GameScreen
                    gameData={game}
                    onKeyPress={game.handleKeypad}
                    onBack={() => game.startGame(game.MODES.MENU)}
                />
            )}

            {game.mode === game.MODES.SUMMARY && (
                <SummaryScreen
                    score={game.score}
                    total={game.total}
                    finalTime={game.finalTime}
                    onRestart={() => game.startGame(game.MODES.MENU)}
                />
            )}

            {/* Fallback for SummaryScreen import */}
            {!SummaryScreen && <div>Loading...</div>}
        </div>
    );
}

export default App;
