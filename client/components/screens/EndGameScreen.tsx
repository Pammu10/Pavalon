import React from 'react';
import { useGame } from '@/components/context/GameContext';
import { Alignment, Player } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const RoleCard: React.FC<{ player: Player }> = ({ player }) => {
    const isGood = player.alignment === Alignment.GOOD;
    const isDisconnected = player.status === 'DISCONNECTED';
    return (
        <div className={`p-4 rounded-lg border-2 transition-all duration-300 relative ${isGood ? 'bg-blue-900/50 border-blue-700' : 'bg-red-900/50 border-red-700'} ${isDisconnected ? 'grayscale opacity-60' : ''}`}>
            <p className="font-bold text-lg text-white truncate">{player.name}</p>
            <p className={`text-sm font-eaglelake ${isGood ? 'text-blue-300' : 'text-red-300'}`}>{player.role || '???'}</p>
             {isDisconnected && <div className="absolute top-1 right-1 text-xs bg-slate-600 px-2 py-0.5 rounded-full">DC</div>}
        </div>
    );
};

const EndGameScreen: React.FC = () => {
    const { gameState, playerId, restartGame } = useGame();
    const { winner, endGameReason, players } = gameState;
    
    const currentPlayer = players.find(p => p.id === playerId);

    const handlePlayAgain = () => {
        if (currentPlayer?.isHost) {
            restartGame();
        }
    };
    
    if (!winner) { // Handle aborted game
        return (
            <div className="animate-fadeIn text-center">
                <Card className="max-w-4xl mx-auto">
                    <h1 className={`font-cinzel text-4xl md:text-6xl font-bold text-slate-400`}>
                        Game Over
                    </h1>
                    <p className="text-slate-300 mt-2 text-base md:text-lg">{endGameReason}</p>
                    <div className="my-8">
                        <h2 className="font-cinzel text-2xl md:text-3xl text-yellow-500 mb-4 border-b-2 border-slate-700 pb-2">Final Status</h2>
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                            {players.map(p => <RoleCard key={p.userId} player={p} />)}
                        </div>
                    </div>
                     <div className="mt-8">
                        {currentPlayer?.isHost ? (
                            <Button onClick={handlePlayAgain}>
                                Return to Lobby
                            </Button>
                        ) : (
                            <p className="text-slate-400 mt-8 font-cinzel text-lg">Waiting for host...</p>
                        )}
                    </div>
                </Card>
            </div>
        );
    }

    const winnerColor = winner === Alignment.GOOD ? 'text-blue-400' : 'text-red-500';
    const winnerShadow = winner === Alignment.GOOD ? 'shadow-blue-500/20' : 'shadow-red-500/20';

    return (
        <div className="animate-fadeIn text-center">
            <Card className={`max-w-4xl mx-auto shadow-2xl ${winnerShadow}`}>
                <h1 className={`font-cinzel text-4xl md:text-6xl font-bold ${winnerColor}`} style={{ textShadow: '0 0 20px currentColor' }}>
                    {winner} Wins!
                </h1>
                <p className="text-slate-300 mt-2 text-base md:text-lg font-eaglelake">{endGameReason}</p>

                <div className="my-8">
                    <h2 className="font-cinzel text-2xl md:text-3xl text-yellow-500 mb-4 border-b-2 border-slate-700 pb-2">Final Roles</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                        {players.map(p => <RoleCard key={p.userId} player={p} />)}
                    </div>
                </div>
                 <div className="mt-8">
                    {currentPlayer?.isHost ? (
                        <Button onClick={handlePlayAgain}>
                            Play Again
                        </Button>
                    ) : (
                        <p className="text-slate-400 mt-8 font-cinzel text-lg">Waiting for host to start a new game...</p>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default EndGameScreen;
