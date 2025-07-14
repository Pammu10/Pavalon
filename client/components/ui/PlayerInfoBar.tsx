import React, { useState } from 'react';
import { useGame } from '@/components/context/GameContext';
import { ROLES } from '@/constants';
import { Alignment } from '@/types';
import { KeyRound, User, Eye, Copy, Check } from 'lucide-react';
import { getVisiblePlayers } from '@/hooks/usePlayerVision';
import { toast } from 'sonner';

const PlayerInfoBar: React.FC = () => {
    const { gameState, playerId } = useGame();
    const player = gameState.players.find((p) => p.id === playerId);
    const [copied, setCopied] = useState(false);

    if (!player || !player.role) {
        return null;
    }

    const handleCopyClick = () => {
        if (gameState.roomCode) {
            navigator.clipboard.writeText(gameState.roomCode).then(
                () => {
                    setCopied(true);
                    toast.success("Room code copied!");
                    setTimeout(() => setCopied(false), 2000);
                },
                () => {
                    toast.error("Failed to copy room code.");
                }
            );
        }
    };

    const roleInfo = ROLES[player.role];
    const alignmentColor = roleInfo.alignment === Alignment.GOOD ? 'text-blue-400' : 'text-red-500';

    const visiblePlayerInfo = getVisiblePlayers(player, gameState.players);

    return (
        <div id="player-info-bar" className="bg-slate-900/80 backdrop-blur-md text-white px-2 sm:px-4 py-1.5 border-b border-slate-700/50 shadow-md">
            <div className="w-full max-w-7xl mx-auto flex flex-wrap justify-center sm:justify-between items-center gap-x-4 gap-y-1">
                
                {/* Player Name & Role */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <User className="w-5 h-5 text-yellow-500" />
                    <div>
                        <p className="font-bold text-sm leading-tight text-white">{player.name}</p>
                        <p className={`font-semibold text-xs leading-tight ${alignmentColor}`}>{player.role}</p>
                    </div>
                </div>

                {/* Vision */}
                <div className="flex-grow flex items-center justify-center gap-2 min-w-0 py-1">
                    <Eye className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap justify-center">
                        {visiblePlayerInfo.length > 0 ? (
                            visiblePlayerInfo.map(({ player: p, knownAs }) => {
                                const roleText = knownAs === 'Mystic' ? 'Merlin/Morgana' : p.role;
                                const roleColor = knownAs === 'Mystic' ? 'text-purple-400' : 'text-red-400';
                                return (
                                    <div key={p.id} className="flex items-baseline gap-1 bg-slate-800/60 px-1.5 py-0.5 rounded">
                                        <span className="font-semibold text-white text-xs whitespace-nowrap">{p.name}</span>
                                        <span className={`text-[10px] font-bold opacity-80 ${roleColor}`}>({roleText})</span>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-xs text-slate-400 italic">You see no one.</p>
                        )}
                    </div>
                </div>

                {/* Room Code */}
                <div className="flex items-center gap-1 flex-shrink-0 bg-slate-800/60 pl-2 pr-1 py-1 rounded-lg">
                    <KeyRound className="w-5 h-5 text-yellow-500" />
                    <p className="font-mono font-bold text-base tracking-widest text-white">{gameState.roomCode}</p>
                    <button
                        onClick={handleCopyClick}
                        className="bg-slate-700/70 p-1.5 rounded-md hover:bg-slate-600 transition-colors ml-1"
                        aria-label="Copy room code"
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                        ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PlayerInfoBar;