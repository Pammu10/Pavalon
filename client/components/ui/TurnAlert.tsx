'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { GamePhase, Role } from '@/types';
import { haptics } from '@/lib/haptics';

/**
 * Detects when the game is waiting on the local player and grabs their
 * attention: banner drop-in, vibration, and a tab-title change for players
 * who tabbed away.
 */
const TurnAlert: React.FC = () => {
    const { gameState, playerId } = useGame();
    const [show, setShow] = useState(false);
    const prevNeedsAction = useRef(false);
    const originalTitle = useRef<string | null>(null);

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

        let timer: ReturnType<typeof setTimeout> | undefined;
        if (needsAction && !prevNeedsAction.current) {
            setShow(true);
            haptics.confirm();
            document.title = '⚔️ Your turn! — Pavalon';
            timer = setTimeout(() => setShow(false), 4500);
        } else if (!needsAction && prevNeedsAction.current) {
            setShow(false);
            if (originalTitle.current) document.title = originalTitle.current;
        }
        prevNeedsAction.current = needsAction;

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [needsAction]);

    // Restore title on unmount (leaving the game page)
    useEffect(() => {
        return () => {
            if (originalTitle.current) document.title = originalTitle.current;
        };
    }, []);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -40 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                    className="fixed top-16 md:top-32 left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-[calc(100%-2rem)] max-w-md"
                >
                    <div className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-800/95 via-yellow-700/95 to-amber-800/95 border-2 border-yellow-500 rounded-xl px-4 py-2.5 shadow-2xl shadow-yellow-900/40 backdrop-blur-sm">
                        <motion.div
                            animate={{ rotate: [0, -12, 12, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.2 }}
                        >
                            <Swords size={20} className="text-yellow-300 flex-shrink-0" />
                        </motion.div>
                        <p className="text-sm sm:text-base font-bold text-yellow-100 text-center">{message}</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TurnAlert;
