import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '@/components/context/GameContext';
import Button from './Button';
import Card from './Card';
import PlayerStatusList from './PlayerStatusList';

const RestartVoteOverlay: React.FC = () => {
    const { gameState, playerId, voteOnRestart } = useGame();
    const { restartVote } = gameState;
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!restartVote) return;
        
        const interval = setInterval(() => {
            const seconds = Math.round((restartVote.endsAt - Date.now()) / 1000);
            setTimeLeft(Math.max(0, seconds));
        }, 1000);

        return () => clearInterval(interval);
    }, [restartVote]);

    if (!restartVote) return null;

    const playerVoted = playerId ? restartVote.votes[playerId] : false;
    const connectedPlayers = gameState.players.filter(p => p.status === 'CONNECTED');
    const votedPlayerIds = Object.keys(restartVote.votes);

    return createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] animate-fadeIn p-4">
            <Card className="w-full max-w-md animate-slideInUp border-2 border-yellow-700/50">
                <h2 className="font-eagleLake text-2xl text-yellow-500 text-center">Restart Game Vote</h2>
                <p className="text-center text-slate-300 mt-2 mb-4">
                    <span className="font-bold">{restartVote.initiatorName}</span> has initiated a vote to restart the game.
                </p>
                
                <div className="my-4 text-center">
                    <p className="text-slate-400">Time remaining:</p>
                    <p className="text-3xl font-bold text-white">{timeLeft}s</p>
                </div>
                
                <div className="my-6">
                    <PlayerStatusList
                        title="Voter Status"
                        players={connectedPlayers}
                        readyPlayerIds={votedPlayerIds}
                        iconMapping={{ ready: '✓', notReady: '?' }}
                    />
                </div>

                {!playerVoted ? (
                    <div className="flex justify-center gap-4">
                        <Button variant="success" onClick={() => voteOnRestart('yes')}>Yes, Restart</Button>
                        <Button variant="fail" onClick={() => voteOnRestart('no')}>No, Continue</Button>
                    </div>
                ) : (
                    <p className="text-center text-lg text-slate-400 font-bold">Waiting for other players to vote...</p>
                )}
            </Card>
        </div>,
        document.body
    );
};

export default RestartVoteOverlay;
