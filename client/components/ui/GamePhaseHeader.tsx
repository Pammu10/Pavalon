import React from 'react';
import { useGame } from '@/components/context/GameContext';
import { GamePhase, Role } from '@/types';
import { motion } from 'framer-motion';
import { usePlayerVisionMap } from '@/hooks/usePlayerVision';
import { Crown, Eye } from 'lucide-react';

export const GamePhaseHeader: React.FC = () => {
    const { gameState, playerId } = useGame();
    const { phase, leader, currentQuest, players, questHistory } = gameState;
    const isLeader = leader?.id === playerId;
    const currentQuestInfo = questHistory.find(q => q.questNumber === currentQuest);
    const teamSize = currentQuestInfo?.teamSize;
    const visiblePlayerMap = usePlayerVisionMap();

    let title = '';
    let subtitle = '';

    switch (phase) {
        case GamePhase.TEAM_SELECTION:
            if (isLeader) {
                title = 'Your Turn, Leader';
                subtitle = `Select ${teamSize} knights for the quest.`;
            } else {
                title = 'Awaiting a New Team';
                subtitle = `Waiting for ${leader?.name || 'the leader'} to propose a team.`;
            }
            break;
        case GamePhase.TEAM_VOTE:
            title = 'All Knights, Cast Your Vote!';
            subtitle = 'Does this proposed team inspire your trust?';
            break;
        case GamePhase.QUEST_VOTE:
            const isOnTeam = currentQuestInfo?.team.some(p => p.id === playerId);
            if (isOnTeam) {
                title = 'Your Sacred Mission';
                subtitle = 'Vote to determine the fate of the quest.';
            } else {
                title = 'Awaiting Mission Results';
                subtitle = 'The chosen knights are on their quest.';
            }
            break;
        case GamePhase.ASSASSINATION:
            const isAssassin = players.find(p => p.id === playerId)?.role === Role.ASSASSIN;
            if (isAssassin) {
                title = 'The Assassin Strikes!';
                subtitle = 'Identify and eliminate Merlin to claim victory.';
            } else {
                title = 'A Fateful Choice';
                subtitle = 'The Assassin is making their move... Pray for Merlin.';
            }
            break;
        default:
            title = '';
            subtitle = '';
    }
    
    const legendItems = [];

    // The user explicitly requested 'host'. PlayerTile shows it, so we add it to legend.
    if (gameState.players.some(p => p.isHost)) {
         legendItems.push({
            icon: <Crown size={14} className="text-yellow-300" />,
            label: 'Host',
            color: 'bg-yellow-800/80'
        });
    }

    if (gameState.leader) {
        legendItems.push({
            icon: <Crown size={14} className="text-blue-300" />,
            label: 'Quest Leader',
            color: 'bg-blue-800/80'
        });
    }

    const hasEvilVision = Array.from(visiblePlayerMap.values()).includes('Evil');
    const hasMysticVision = Array.from(visiblePlayerMap.values()).includes('Mystic');

    if (hasEvilVision) {
        legendItems.push({
            icon: <Eye size={14} className="text-red-300" />,
            label: 'Known Evil',
            color: 'bg-red-900/80'
        });
    }

    if (hasMysticVision) {
        legendItems.push({
            icon: <Eye size={14} className="text-purple-300" />,
            label: 'Mystic Vision',
            color: 'bg-purple-900/80'
        });
    }


    if (!title && legendItems.length === 0) return null;

    return (
        <motion.div 
            id="game-phase-header"
            key={phase} // Animate on phase change
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-4 flex flex-col justify-center"
        >
            <div className="min-h-[72px] flex flex-col justify-center">
                {title && (
                    <>
                        <h2 className="font-eaglelake text-2xl sm:text-4xl text-yellow-500" style={{ textShadow: "0 0 15px rgba(234, 179, 8, 0.4)" }}>
                            {title}
                        </h2>
                        {subtitle && <p className="text-slate-300 mt-1 text-base sm:text-lg">{subtitle}</p>}
                    </>
                )}
            </div>
            
            {legendItems.length > 0 && (
                <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-300">
                    {legendItems.map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 ${item.color} rounded-full flex items-center justify-center`}>
                                {item.icon}
                            </div>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};