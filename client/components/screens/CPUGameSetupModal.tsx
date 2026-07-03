'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sword, Shield, Crown, Bot, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useGame } from '@/components/context/GameContext';

interface Props {
    onClose: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTIES = [
    {
        id: 'easy' as Difficulty,
        label: 'Easy',
        icon: Sword,
        color: 'text-green-400',
        border: 'border-green-500/60 hover:border-green-400',
        activeBorder: 'border-green-400 bg-green-950/40',
        opponents: ['Elara', 'Rupert', 'The Wanderer'],
        desc: 'Chatty, impulsive opponents who make mistakes. Great for learning.',
    },
    {
        id: 'medium' as Difficulty,
        label: 'Medium',
        icon: Shield,
        color: 'text-amber-400',
        border: 'border-amber-500/60 hover:border-amber-400',
        activeBorder: 'border-amber-400 bg-amber-950/40',
        opponents: ['Lady Veyra', 'Dorian', 'Brother Halwyn'],
        desc: 'Thoughtful players who notice patterns and vote strategically.',
    },
    {
        id: 'hard' as Difficulty,
        label: 'Hard',
        icon: Crown,
        color: 'text-red-400',
        border: 'border-red-500/60 hover:border-red-400',
        activeBorder: 'border-red-400 bg-red-950/40',
        opponents: ['Aldric', 'Cressida'],
        desc: 'Near-optimal play. Minimal chat. No mercy.',
    },
] as const;

const PLAYER_COUNTS = [5, 6, 7, 8] as const;

export default function CPUGameSetupModal({ onClose }: Props) {
    const { startCPUGame } = useGame();
    const [difficulty, setDifficulty] = useState<Difficulty>('medium');
    const [playerCount, setPlayerCount] = useState(5);

    const handleStart = () => {
        startCPUGame({ difficulty, playerCount });
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.75)' }}
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 60, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="relative bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-5 sm:p-6 shadow-2xl"
                    style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                >
                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                            <Bot size={20} className="text-slate-300" />
                        </div>
                        <div>
                            <h2 className="font-eaglelake text-xl text-yellow-400">Play vs CPU</h2>
                            <p className="text-slate-400 text-xs">Solo practice against AI opponents</p>
                        </div>
                    </div>

                    {/* Difficulty selection */}
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Difficulty</p>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                        {DIFFICULTIES.map((d) => {
                            const Icon = d.icon;
                            const isActive = difficulty === d.id;
                            return (
                                <button
                                    key={d.id}
                                    onClick={() => setDifficulty(d.id)}
                                    className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                                        isActive ? d.activeBorder : `border-slate-700 bg-slate-800/50 ${d.border}`
                                    }`}
                                >
                                    <Icon size={16} className={`${d.color} mb-1.5`} />
                                    <p className={`text-sm font-bold ${isActive ? d.color : 'text-slate-300'}`}>
                                        {d.label}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                        {d.opponents.slice(0, 2).join(', ')}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected difficulty description */}
                    <p className="text-slate-400 text-sm mb-5 min-h-[2.5rem] leading-relaxed">
                        {DIFFICULTIES.find((d) => d.id === difficulty)?.desc}
                    </p>

                    {/* Player count */}
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Players (you + {playerCount - 1} bots)
                    </p>
                    <div className="flex gap-2 mb-6">
                        {PLAYER_COUNTS.map((n) => (
                            <button
                                key={n}
                                onClick={() => setPlayerCount(n)}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    playerCount === n
                                        ? 'bg-yellow-500 text-slate-900'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    <Button onClick={handleStart} className="w-full h-12 flex items-center justify-center gap-2">
                        Begin Quest
                        <ChevronRight size={16} />
                    </Button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
