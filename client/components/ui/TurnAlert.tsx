'use client';
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '../context/GameContext';
import { GamePhase, Role } from '@/types';
import { haptics } from '@/lib/haptics';

/**
 * Detects when the game is waiting on the local player and grabs their
 * attention: toast (via the app's normal Sonner toaster), vibration, and a
 * tab-title change for players who tabbed away.
 */
const TurnAlert: React.FC = () => {
    const { gameState, playerId } = useGame();
    const prevNeedsAction = useRef(false);
    const originalTitle = useRef<string | null>(null);
    const toastIdRef = useRef<string | number | null>(null);

    const player = gameState.players.find(p => p.id === playerId);
    const quest = gameState.questHistory[gameState.currentQuest - 1];

    let needsAction = false;
    let message = '';
    if (player && !gameState.reconnectingPlayer) {
        if (gameState.phase === GamePhase.TEAM_SELECTION && gameState.leader?.id === playerId) {
            needsAction = true;
            message = 'You are the Quest Leader — assemble your team!';
        } else if (gameState.phase === GamePhase.TEAM_VOTE && !player.hasVoted) {
            needsAction = true;
            message = 'Cast your vote on the proposed team!';
        } else if (
            gameState.phase === GamePhase.QUEST_VOTE &&
            quest?.team.some(t => t.id === playerId) &&
            !player.hasVoted
        ) {
            needsAction = true;
            message = 'You are on the quest — choose your fate!';
        } else if (gameState.phase === GamePhase.ASSASSINATION && player.role === Role.ASSASSIN) {
            needsAction = true;
            message = 'Find and eliminate Merlin!';
        }
    }

    useEffect(() => {
        if (originalTitle.current === null && typeof document !== 'undefined') {
            originalTitle.current = document.title;
        }

        if (needsAction && !prevNeedsAction.current) {
            haptics.confirm();
            document.title = '⚔️ Your turn! — Pavalon';
            toastIdRef.current = toast.custom(
                () => (
                    <div className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-800/95 via-yellow-700/95 to-amber-800/95 border-2 border-yellow-500 rounded-xl px-4 py-2.5 shadow-2xl shadow-yellow-900/40 backdrop-blur-sm w-[calc(100vw-2rem)] max-w-md">
                        <motion.div
                            animate={{ rotate: [0, -12, 12, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.2 }}
                        >
                            <Swords size={20} className="text-yellow-300 flex-shrink-0" />
                        </motion.div>
                        <p className="text-sm sm:text-base font-bold text-yellow-100 text-center">{message}</p>
                    </div>
                ),
                { duration: 4500 },
            );
        } else if (!needsAction && prevNeedsAction.current) {
            if (toastIdRef.current !== null) toast.dismiss(toastIdRef.current);
            if (originalTitle.current) document.title = originalTitle.current;
        }
        prevNeedsAction.current = needsAction;
    }, [needsAction, message]);

    // Restore title on unmount (leaving the game page)
    useEffect(() => {
        return () => {
            if (originalTitle.current) document.title = originalTitle.current;
        };
    }, []);

    return null;
};

export default TurnAlert;
