'use client';
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { EMOTE_EMOJIS, EMOTE_PHRASES } from '@/constants';
import { haptics } from '@/lib/haptics';

const SEND_COOLDOWN_MS = 1500;

/**
 * Floating emote button + picker panel + incoming emote rail.
 * Rendered once on the game page so reactions work in every phase.
 */
const EmoteLayer: React.FC = () => {
    const { gameState, activeEmotes, sendEmote } = useGame();
    const [isOpen, setIsOpen] = useState(false);
    const [onCooldown, setOnCooldown] = useState(false);
    const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSend = (emote: string) => {
        if (onCooldown) return;
        haptics.tap();
        sendEmote(emote);
        setIsOpen(false);
        setOnCooldown(true);
        cooldownTimer.current = setTimeout(() => setOnCooldown(false), SEND_COOLDOWN_MS);
    };

    return (
        <>
            {/* Incoming emote rail — bottom-left, above the picker button */}
            <div className="fixed bottom-36 md:bottom-24 left-3 z-40 flex flex-col-reverse gap-1.5 pointer-events-none max-w-[70vw]">
                <AnimatePresence>
                    {Object.entries(activeEmotes).map(([pid, { emote, key }]) => {
                        const player = gameState.players.find(p => p.id === pid);
                        if (!player) return null;
                        const isPhrase = emote.length > 2;
                        return (
                            <motion.div
                                key={`${pid}-${key}`}
                                initial={{ opacity: 0, x: -30, scale: 0.8 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -16, scale: 0.9 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                                className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm border border-slate-600/60 rounded-full pl-3 pr-2 py-1 shadow-lg w-fit"
                            >
                                <span className="text-xs font-bold text-yellow-400 truncate max-w-24">{player.name}</span>
                                {isPhrase ? (
                                    <span className="text-sm text-slate-100 italic whitespace-nowrap">&ldquo;{emote}&rdquo;</span>
                                ) : (
                                    <span className="text-xl leading-none">{emote}</span>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Picker panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="fixed bottom-36 md:bottom-24 left-3 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-slate-900/97 backdrop-blur-md border-2 border-slate-600 rounded-2xl p-3 shadow-2xl shadow-black/60"
                    >
                        <div className="grid grid-cols-6 gap-1 mb-2">
                            {EMOTE_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => handleSend(emoji)}
                                    className="text-2xl p-1.5 rounded-lg hover:bg-slate-700/70 active:scale-90 transition-all"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-slate-700 pt-2 flex flex-wrap gap-1.5">
                            {EMOTE_PHRASES.map(phrase => (
                                <button
                                    key={phrase}
                                    onClick={() => handleSend(phrase)}
                                    className="text-xs text-slate-200 bg-slate-800 border border-slate-600/70 rounded-full px-2.5 py-1 hover:bg-slate-700 hover:border-yellow-500/50 active:scale-95 transition-all"
                                >
                                    {phrase}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating emote button — mirrors the chat FAB on the left side */}
            <div className="fixed bottom-20 md:bottom-6 left-3 md:left-4 z-40">
                <button
                    onClick={() => setIsOpen(o => !o)}
                    disabled={onCooldown && !isOpen}
                    aria-label="Send emote"
                    className={`flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full border-2 shadow-lg backdrop-blur-md active:scale-95 transition-all ${
                        isOpen
                            ? 'bg-yellow-600 border-yellow-400 text-white'
                            : 'bg-slate-800/80 border-yellow-600 text-yellow-500 hover:bg-slate-700 hover:border-yellow-500'
                    } ${onCooldown && !isOpen ? 'opacity-50' : ''}`}
                >
                    {isOpen ? <X size={24} /> : <SmilePlus size={24} />}
                </button>
            </div>
        </>
    );
};

export default EmoteLayer;
