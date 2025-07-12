import React from 'react';
import { useGame } from '@/components/context/GameContext';
import { ROLES } from '@/constants';
import { Role, Alignment } from '@/types';
import { KeyRound, User, Eye } from 'lucide-react';

const PlayerInfoBar: React.FC = () => {
    const { gameState, playerId } = useGame();
    const player = gameState.players.find((p) => p.id === playerId);

    if (!player || !player.role) {
        return null;
    }

    const roleInfo = ROLES[player.role];
    const alignmentColor = roleInfo.alignment === Alignment.GOOD ? 'text-blue-400' : 'text-red-500';

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
    };

    const visiblePlayers = getVisiblePlayers();

    return (
        <div className="bg-slate-900/80 backdrop-blur-md text-white px-2 sm:px-4 py-1.5 border-b border-slate-700/50 shadow-md">
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
                        {visiblePlayers.length > 0 ? (
                            visiblePlayers.map(p => {
                                const roleText = player.role === Role.PERCIVAL ? 'Merlin/Morgana' : p.role;
                                const roleColor = player.role === Role.PERCIVAL ? 'text-purple-400' : 'text-red-400';
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
                <div className="flex items-center gap-2 flex-shrink-0">
                    <KeyRound className="w-5 h-5 text-yellow-500" />
                    <p className="font-mono font-bold text-base tracking-widest text-white">{gameState.roomCode}</p>
                </div>

            </div>
        </div>
    );
};

export default PlayerInfoBar;
