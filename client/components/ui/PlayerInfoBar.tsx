import React, { useState } from 'react';
import { useGame } from '@/components/context/GameContext';
import { ROLES } from '@/constants';
import { Alignment, Role } from '@/types';
import { User, Eye, Copy } from 'lucide-react';
import { getVisiblePlayers } from '@/hooks/usePlayerVision';
import { toast } from 'sonner';
import VisionModal from './VisionModal';

// Helper function to shorten long role names
const shortenRoleName = (role: Role | null): string => {
    if (role === Role.LOYAL_SERVANT) {
        return "Loyal Servant";
    }
    if (role === Role.MINION) {
        return "Minion";
    }
    return role || '';
};

const PlayerInfoBar: React.FC = () => {
    const { gameState, playerId } = useGame();
    const player = gameState.players.find((p) => p.id === playerId);
    const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);

    if (!player || !player.role) {
        return null;
    }

    const handleShare = async () => {
        if (!gameState.roomCode) return;
        const inviteText = `Join my Pavalon game!\nCode: ${gameState.roomCode}\nLink: ${window.location.origin}/join/${gameState.roomCode}`;
        const shareData = {
            title: "Join Pavalon Game",
            text: `Join my game on Pavalon! Code: ${gameState.roomCode}`,
            url: `${window.location.origin}/join/${gameState.roomCode}`,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log("Web Share API failed, likely user cancellation.", error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(inviteText);
                toast.success("Invite copied to clipboard!", { duration: 2000 });
            } catch (error) {
                console.error("Failed to copy invite:", error);
                toast.error("Could not copy invite.");
            }
        }
    };

    const roleInfo = ROLES[player.role];
    const alignmentColor = roleInfo.alignment === Alignment.GOOD ? 'text-blue-400' : 'text-red-500';

    const visiblePlayerInfo = getVisiblePlayers(player, gameState.players);
    const hasVision = visiblePlayerInfo.length > 0;
    
    const visionButtonBaseClasses = "py-1.5 px-3 sm:px-4 text-sm flex items-center gap-2 h-auto rounded-lg backdrop-blur-sm border transition-all duration-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";
    const visionButtonColorClasses = hasVision 
        ? (player.alignment === Alignment.GOOD 
            ? 'bg-blue-900/20 border-blue-600/50 text-blue-300 hover:bg-blue-900/40 hover:border-blue-500 focus:ring-blue-500' 
            : 'bg-red-900/20 border-red-600/50 text-red-300 hover:bg-red-900/40 hover:border-red-500 focus:ring-red-500')
        : 'bg-slate-800/40 border-slate-600/50 text-slate-300 hover:bg-slate-800/70 hover:border-slate-400 focus:ring-slate-400';

    return (
        <>
            <div id="player-info-bar" className="bg-slate-900/80 backdrop-blur-md text-white px-2 sm:px-4 py-2 border-b border-slate-700/50 shadow-md">
                <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-x-2 sm:gap-x-4">
                    
                    {/* Left: Player Name & Role */}
                    <div className="flex-1 flex justify-start">
                        <div className="px-3 py-1.5 flex items-center gap-3 flex-shrink-0 min-w-0 shadow-inner">
                            <User className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="font-bold text-base leading-tight text-white truncate">{player.name}</p>
                                <p className={`font-semibold text-sm leading-tight ${alignmentColor} truncate`}>{shortenRoleName(player.role)}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Center: Vision Button */}
                    <div className="flex-1 flex justify-center">
                         <button 
                            onClick={() => setIsVisionModalOpen(true)}
                            className={`${visionButtonBaseClasses} ${visionButtonColorClasses}`}
                        >
                            <Eye size={16} />
                            <span className="hidden sm:inline">View Vision</span>
                        </button>
                    </div>

                    {/* Right: Room Code */}
                    <div className="flex-1 flex justify-end">
                        <button 
                            onClick={handleShare} 
                            className="flex items-center gap-2 flex-shrink-0 cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors"
                            title="Share Game Invite"
                        >
                            <p className="font-mono font-bold text-base tracking-widest text-white">{gameState.roomCode}</p>
                            <Copy className="w-4 h-4 text-yellow-500" />
                        </button>
                    </div>
                </div>
            </div>
            <VisionModal 
                isOpen={isVisionModalOpen}
                onClose={() => setIsVisionModalOpen(false)}
                visiblePlayers={visiblePlayerInfo}
            />
        </>
    );
};

export default PlayerInfoBar;