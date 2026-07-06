'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Player } from '@/types';
import { useAudio } from '@/components/context/AudioContext';
import { haptics } from '@/lib/haptics';

interface VoteRevealData {
    votes: { playerId: string; vote: 'APPROVE' | 'REJECT' }[];
    players: Player[];
    wasApproved: boolean;
}

interface TeamVoteRevealOverlayProps {
    data: VoteRevealData;
    onClose: () => void;
}

const FLIP_START_DELAY = 1600;
const FLIP_INTERVAL = 480;
const RESULT_DELAY_AFTER_LAST = 600;
const AUTO_CLOSE_AFTER_RESULT = 3800;

const VoteCard: React.FC<{
    playerName: string;
    vote: 'APPROVE' | 'REJECT';
    isFlipped: boolean;
    entryDelay: number;
}> = ({ playerName, vote, isFlipped, entryDelay }) => {
    const isApprove = vote === 'APPROVE';

    return (
        <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: entryDelay, ease: 'easeOut' }}
            className="relative w-[4.5rem] h-[6rem] sm:w-20 sm:h-28"
            style={{ perspective: '700px' }}
        >
            <motion.div
                className="w-full h-full relative"
                style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
            >
                {/* Front face — decorative back-of-card */}
                <div
                    className="absolute inset-0 rounded-xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-between p-1.5 select-none"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                    <div className="flex-1 w-full flex items-center justify-center">
                        <div className="w-full h-full border border-slate-600/50 rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-slate-500 rounded-full" />
                        </div>
                    </div>
                    <p className="text-[0.6rem] text-slate-400 truncate w-full text-center leading-tight">{playerName}</p>
                </div>

                {/* Back face — revealed vote */}
                <div
                    className={`absolute inset-0 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 select-none ${
                        isApprove
                            ? 'border-blue-500 bg-gradient-to-br from-blue-900 to-blue-950'
                            : 'border-red-500 bg-gradient-to-br from-red-900 to-red-950'
                    }`}
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    {/* Glow behind icon */}
                    <div className={`absolute inset-0 rounded-xl blur-md opacity-30 ${isApprove ? 'bg-blue-400' : 'bg-red-500'}`} />
                    {isApprove ? (
                        <Check className="relative w-7 h-7 sm:w-9 sm:h-9 text-blue-300" strokeWidth={3} />
                    ) : (
                        <X className="relative w-7 h-7 sm:w-9 sm:h-9 text-red-300" strokeWidth={3} />
                    )}
                    <p className="relative text-[0.6rem] font-bold text-center leading-tight truncate w-full px-1 text-slate-300">{playerName}</p>
                    <p className={`relative text-[0.55rem] font-black tracking-widest uppercase ${isApprove ? 'text-blue-400' : 'text-red-400'}`}>
                        {isApprove ? 'APPROVE' : 'REJECT'}
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
};

const TeamVoteRevealOverlay: React.FC<TeamVoteRevealOverlayProps> = ({ data, onClose }) => {
    const { votes, players, wasApproved } = data;
    const { playSound } = useAudio();
    const [revealedCount, setRevealedCount] = useState(0);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];

        votes.forEach((_, i) => {
            const t = setTimeout(() => {
                setRevealedCount(i + 1);
                playSound('card-fan', { manageBgm: false });
            }, FLIP_START_DELAY + i * FLIP_INTERVAL);
            timers.push(t);
        });

        const resultDelay = FLIP_START_DELAY + votes.length * FLIP_INTERVAL + RESULT_DELAY_AFTER_LAST;
        timers.push(setTimeout(() => {
            setShowResult(true);
            if (wasApproved) haptics.success(); else haptics.failure();
        }, resultDelay));
        timers.push(setTimeout(onClose, resultDelay + AUTO_CLOSE_AFTER_RESULT));

        return () => timers.forEach(clearTimeout);
    }, [votes.length, onClose, playSound]); // eslint-disable-line react-hooks/exhaustive-deps

    const approveCount = votes.filter(v => v.vote === 'APPROVE').length;
    const rejectCount = votes.length - approveCount;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 px-4 py-8 overflow-hidden">
            {/* Atmospheric glow */}
            <div className={`absolute inset-0 opacity-10 transition-opacity duration-1000 ${wasApproved ? 'bg-blue-500' : 'bg-red-600'}`} />

            {/* Title */}
            <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative font-eaglelake text-3xl sm:text-5xl text-yellow-400 mb-8 sm:mb-10 text-center"
                style={{ textShadow: '0 0 24px rgba(234,179,8,0.6)' }}
            >
                The votes are in...
            </motion.h2>

            {/* Card grid */}
            <div className="relative flex flex-wrap justify-center gap-2 sm:gap-3 max-w-2xl mx-auto mb-8 sm:mb-10">
                {votes.map((vote, i) => {
                    const player = players.find(p => p.id === vote.playerId);
                    return (
                        <VoteCard
                            key={vote.playerId}
                            playerName={player?.name ?? 'Player'}
                            vote={vote.vote}
                            isFlipped={i < revealedCount}
                            entryDelay={0.05 + i * 0.07}
                        />
                    );
                })}
            </div>

            {/* Tally + outcome */}
            <AnimatePresence>
                {showResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                        className="relative text-center"
                    >
                        <div className="flex justify-center items-end gap-6 sm:gap-10 mb-5">
                            <div className="text-center">
                                <p className="text-4xl sm:text-5xl font-bold text-blue-400">{approveCount}</p>
                                <p className="text-xs sm:text-sm text-slate-400 mt-1 uppercase tracking-widest">Approve</p>
                            </div>
                            <div className="text-3xl text-slate-600 mb-2">vs</div>
                            <div className="text-center">
                                <p className="text-4xl sm:text-5xl font-bold text-red-400">{rejectCount}</p>
                                <p className="text-xs sm:text-sm text-slate-400 mt-1 uppercase tracking-widest">Reject</p>
                            </div>
                        </div>
                        <h3
                            className={`font-eaglelake text-4xl sm:text-6xl font-bold tracking-widest uppercase animate-glow ${
                                wasApproved ? 'text-blue-400' : 'text-red-400'
                            }`}
                        >
                            {wasApproved ? 'Team Approved!' : 'Team Rejected!'}
                        </h3>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body,
    );
};

export default TeamVoteRevealOverlay;
