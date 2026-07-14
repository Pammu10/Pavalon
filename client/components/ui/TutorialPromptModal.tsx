'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, Shield, Sword, Crown, Users } from 'lucide-react';
import Button from './Button';

export const TUTORIAL_SEEN_KEY = 'pavalon_tutorial_seen_at';
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const SESSION_PROMPT_KEY = 'pavalon_tutorial_prompt_shown';

export function shouldShowTutorialPrompt(): 'new' | 'returning' | null {
    if (typeof window === 'undefined') return null;
    if (sessionStorage.getItem(SESSION_PROMPT_KEY)) return null;

    const seenAt = localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (!seenAt) return 'new';
    if (Date.now() - parseInt(seenAt, 10) > SIXTY_DAYS_MS) return 'returning';
    return null;
}

export function dismissTutorialPrompt() {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_PROMPT_KEY, '1');
    localStorage.setItem(TUTORIAL_SEEN_KEY, Date.now().toString());
}

interface TutorialPromptModalProps {
    username: string;
    variant: 'new' | 'returning';
    onStartTutorial: () => void;
    onDismiss: () => void;
}

const FEATURE_PILLS = [
    { icon: <Shield size={14} />, label: 'Roles & Alignment' },
    { icon: <Users size={14} />, label: 'Team Selection' },
    { icon: <Sword size={14} />, label: 'Quest Voting' },
    { icon: <Crown size={14} />, label: 'Victory Conditions' },
];

const TutorialPromptModal: React.FC<TutorialPromptModalProps> = ({
    username,
    variant,
    onStartTutorial,
    onDismiss,
}) => {
    const isNew = variant === 'new';

    const handleStart = () => {
        dismissTutorialPrompt();
        onStartTutorial();
    };

    const handleDismiss = () => {
        dismissTutorialPrompt();
        onDismiss();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[500] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
                onClick={handleDismiss}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.93, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 12 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    className="relative w-full max-w-sm bg-slate-900 border-2 border-yellow-500/70 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-black/60"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Ambient glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />

                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                        className="relative w-16 h-16 mx-auto mb-5"
                    >
                        <div className="absolute inset-0 rounded-full blur-xl bg-yellow-500/40" />
                        <div className="w-full h-full rounded-full border-2 border-yellow-500 bg-gradient-to-br from-yellow-900 to-yellow-950 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-yellow-400" />
                        </div>
                    </motion.div>

                    {/* Heading */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18 }}
                    >
                        {isNew ? (
                            <>
                                <h2 className="font-eaglelake text-2xl sm:text-3xl text-yellow-400 mb-1 leading-tight">
                                    Welcome, {username}!
                                </h2>
                                <p className="text-slate-400 text-sm mb-5">
                                    New to Pavalon? A 2-minute interactive tutorial will get you battle-ready.
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="font-eaglelake text-2xl sm:text-3xl text-yellow-400 mb-1 leading-tight">
                                    Welcome back!
                                </h2>
                                <p className="text-slate-400 text-sm mb-5">
                                    It&apos;s been a while, {username}. Want a quick refresher on the rules?
                                </p>
                            </>
                        )}
                    </motion.div>

                    {/* Feature pills */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.28 }}
                        className="flex flex-wrap justify-center gap-2 mb-6"
                    >
                        {FEATURE_PILLS.map((f) => (
                            <span
                                key={f.label}
                                className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-300"
                            >
                                <span className="text-yellow-500">{f.icon}</span>
                                {f.label}
                            </span>
                        ))}
                    </motion.div>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="flex flex-col gap-3"
                    >
                        <Button
                            onClick={handleStart}
                            className="w-full h-12 flex items-center justify-center gap-2 text-base"
                        >
                            <BookOpen size={16} />
                            {isNew ? 'Start Tutorial' : 'Replay Tutorial'}
                            <ChevronRight size={16} />
                        </Button>
                        <button
                            onClick={handleDismiss}
                            className="text-sm text-slate-500 hover:text-slate-300 transition-colors py-1"
                        >
                            {isNew ? 'Skip for now' : 'I remember the rules'}
                        </button>
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TutorialPromptModal;
