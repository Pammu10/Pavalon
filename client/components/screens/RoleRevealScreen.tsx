import React, { useState, useEffect } from 'react';
import { useGame } from '@/components/context/GameContext';
import { ROLES } from '@/constants';
import { Role, Alignment } from '@/types';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

const RoleRevealScreen: React.FC = () => {
    const { gameState, playerId, playerReady } = useGame();
    const [isFlipped, setIsFlipped] = useState(false);
    
    const player = gameState.players.find(p => p.id === playerId);
    const roleInfo = player?.role ? ROLES[player.role] : null;
    const isPaused = !!gameState.reconnectingPlayer;

    useEffect(() => {
        const timer = setTimeout(() => setIsFlipped(true), 500);
        return () => clearTimeout(timer);
    }, []);

    if (!player || !player.role || !roleInfo) {
        return <div className="text-center"><Spinner /></div>;
    }

    const getVisiblePlayers = () => {
        const { players } = gameState;
        const self = player;

        if (!self.role || !self.alignment) return [];
        
        switch (self.role) {
            case Role.MERLIN:
                return players.filter(p => p.alignment === Alignment.EVIL && p.role !== Role.MORDRED);
            case Role.PERCIVAL:
                return players.filter(p => p.role === Role.MERLIN || p.role === Role.MORGANA);
            case Role.MORGANA:
            case Role.ASSASSIN:
            case Role.MORDRED:
            case Role.MINION:
                 return players.filter(p => p.id !== self.id && p.alignment === Alignment.EVIL && p.role !== Role.OBERON);
            default:
                return [];
        }
    }
    
    const handleReadyClick = () => {
        playerReady();
    };

    const visiblePlayers = getVisiblePlayers();
    const alignmentColor = roleInfo.alignment === Alignment.GOOD ? 'text-blue-400' : 'text-red-500';
    const isReady = gameState.readyPlayers.includes(playerId!);

    return (
        <div className="animate-fadeIn flex flex-col items-center justify-center p-4">
            <h1 className="font-cinzel text-3xl md:text-4xl mb-8 text-center text-white">Your Identity is Revealed</h1>
            
            <div className={`card w-full max-w-sm h-96 perspective-1000 ${isFlipped ? 'is-flipped' : ''}`}>
                {/* Card Back */}
                <div className="card-face absolute w-full h-full bg-slate-800 border-4 border-yellow-700 rounded-2xl flex items-center justify-center shadow-2xl p-4">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        <p className="font-cinzel text-2xl mt-4 text-yellow-500">Awaiting Your Role</p>
                    </div>
                </div>

                {/* Card Front */}
                <div className="card-face card-face-back absolute w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-slate-600 rounded-2xl shadow-2xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start">
                             <h2 className="font-cinzel text-3xl font-bold text-white">{player.role}</h2>
                             <span className={`font-bold text-lg ${alignmentColor}`}>{roleInfo.alignment}</span>
                        </div>
                        <p className="text-slate-400 mt-2 italic text-sm">{roleInfo.description}</p>
                    </div>
                    
                    {visiblePlayers.length > 0 && (
                        <div className="mt-4">
                            <h3 className="font-cinzel text-yellow-500 border-b border-slate-700 pb-1 mb-2">Your Vision:</h3>
                            <p className="text-slate-300 text-xs italic">{roleInfo.vision}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {visiblePlayers.map(p => (
                                    <span key={p.id} className="bg-slate-700 text-white px-3 py-1 rounded-full text-sm">{p.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 text-center w-full max-w-lg">
                <div className="bg-slate-900/50 p-4 rounded-lg">
                    <h4 className="font-cinzel text-xl text-yellow-500 mb-3">Player Status</h4>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-left">
                        {gameState.players.map(p => (
                            <li key={p.id} className={`text-slate-300 truncate ${p.status === 'DISCONNECTED' ? 'text-slate-500' : ''}`}>
                                <span className={`mr-2 ${gameState.readyPlayers.includes(p.id) ? 'text-green-400' : 'text-slate-500'}`}>
                                    {gameState.readyPlayers.includes(p.id) ? '●' : '○'}
                                </span>
                                {p.name}
                                {p.status === 'DISCONNECTED' && ' (DC)'}
                            </li>
                        ))}
                    </ul>
                </div>
                 <Button onClick={handleReadyClick} disabled={isReady || isPaused} className="mt-6">
                    {isPaused ? 'Game Paused' : isReady ? 'Waiting for others...' : 'I Am Ready'}
                </Button>
            </div>
        </div>
    );
};

export default RoleRevealScreen;
