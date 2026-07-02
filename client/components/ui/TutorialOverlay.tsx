'use client';
import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import Button from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { TUTORIAL_SEEN_KEY } from './TutorialPromptModal';

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const TOTAL_STEPS = 7;

const TutorialOverlay: React.FC = () => {
    const { gameState, advanceTutorial, leaveRoom } = useGame();
    const { tutorial } = gameState;
    const [highlightRects, setHighlightRects] = useState<Rect[]>([]);
    const [confirmingSkip, setConfirmingSkip] = useState(false);

    useLayoutEffect(() => {
        if (!tutorial?.highlight || tutorial.highlight.length === 0) {
            setHighlightRects([]);
            return;
        }

        const getRects = () => {
            const newRects: Rect[] = [];
            tutorial.highlight!.forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    newRects.push({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
                }
            });
            setHighlightRects(newRects);
        };

        // Scroll the first highlighted element into view so it's always visible
        const firstEl = document.getElementById(tutorial.highlight[0]);
        if (firstEl) {
            firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Re-measure after scroll settles
            setTimeout(getRects, 350);
        } else {
            getRects();
        }

        window.addEventListener('resize', getRects);
        return () => window.removeEventListener('resize', getRects);
    }, [tutorial?.highlight]);

    if (!tutorial) return null;

    const hasHighlight = highlightRects.length > 0;
    const firstRect = hasHighlight ? highlightRects[0] : null;

    // Position dialog away from the highlighted element using inline styles
    let dialogStyle: React.CSSProperties = { bottom: 48, left: '50%', transform: 'translateX(-50%)' };
    if (firstRect) {
        const isHighlightInTopHalf = firstRect.top < window.innerHeight / 2;
        if (isHighlightInTopHalf) {
            dialogStyle = { top: firstRect.top + firstRect.height + 20, left: '50%', transform: 'translateX(-50%)' };
        } else {
            dialogStyle = { bottom: window.innerHeight - firstRect.top + 20, left: '50%', transform: 'translateX(-50%)' };
        }
    }

    const handleFinish = () => {
        localStorage.setItem(TUTORIAL_SEEN_KEY, Date.now().toString());
        leaveRoom();
    };

    const handleSkipConfirmed = () => {
        localStorage.setItem(TUTORIAL_SEEN_KEY, Date.now().toString());
        leaveRoom();
    };

    const handleNext = () => {
        if (tutorial.isFinalStep) {
            handleFinish();
        } else {
            advanceTutorial();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] pointer-events-none">
            {/* Backdrop with spotlight cutouts */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {highlightRects.map((rect, i) => (
                            <rect
                                key={i}
                                x={rect.left - 10}
                                y={rect.top - 10}
                                width={rect.width + 20}
                                height={rect.height + 20}
                                rx="14"
                                fill="black"
                            />
                        ))}
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#spotlight-mask)" />
            </svg>

            {/* Animated pulsing glow borders around highlighted elements */}
            {highlightRects.map((rect, i) => (
                <motion.div
                    key={`glow-${i}`}
                    className="absolute pointer-events-none rounded-2xl"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        top: rect.top - 10,
                        left: rect.left - 10,
                        width: rect.width + 20,
                        height: rect.height + 20,
                        boxShadow: '0 0 0 2px rgba(250, 204, 21, 1), 0 0 28px 6px rgba(250, 204, 21, 0.5)',
                        animation: 'tutorialGlow 2s ease-in-out infinite',
                    }}
                />
            ))}

            {/* Dialog box */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={tutorial.step}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="absolute pointer-events-auto w-[calc(100%-2rem)] max-w-md"
                    style={dialogStyle}
                >
                    <div className="relative bg-slate-900/97 backdrop-blur-md rounded-2xl border-2 border-yellow-500/80 shadow-2xl shadow-black/60 p-5 sm:p-6 text-white text-center">
                        {/* Skip button (top-right corner) */}
                        {!tutorial.isFinalStep && (
                            <button
                                onClick={() => setConfirmingSkip(true)}
                                className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors"
                                aria-label="Skip tutorial"
                            >
                                <X size={18} />
                            </button>
                        )}

                        {/* Step counter */}
                        <div className="flex items-center justify-center gap-1.5 mb-3">
                            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                        i < tutorial.step
                                            ? 'w-4 bg-yellow-400'
                                            : i === tutorial.step - 1
                                              ? 'w-6 bg-yellow-400'
                                              : 'w-3 bg-slate-600'
                                    }`}
                                />
                            ))}
                            <span className="text-xs text-slate-500 ml-1">
                                {tutorial.step}/{TOTAL_STEPS}
                            </span>
                        </div>

                        <h2 className="font-eaglelake text-2xl sm:text-3xl text-yellow-400 mb-3 leading-tight">
                            {tutorial.title}
                        </h2>
                        <p
                            className="text-slate-200 mb-5 leading-relaxed text-sm sm:text-base"
                            dangerouslySetInnerHTML={{ __html: tutorial.text }}
                        />

                        {!tutorial.actionRequired ? (
                            <Button onClick={handleNext} className="w-full">
                                {tutorial.isFinalStep ? 'Finish Tutorial' : 'Next →'}
                            </Button>
                        ) : (
                            <div className="py-2">
                                <motion.p
                                    className="font-bold text-yellow-400 text-sm"
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    ↑ Perform the highlighted action to continue
                                </motion.p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Skip confirmation dialog */}
            <AnimatePresence>
                {confirmingSkip && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto"
                        style={{ background: 'rgba(0,0,0,0.5)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border-2 border-slate-600 rounded-2xl p-6 max-w-sm mx-4 text-center shadow-2xl"
                        >
                            <h3 className="font-eaglelake text-2xl text-yellow-400 mb-2">Leave Tutorial?</h3>
                            <p className="text-slate-300 text-sm mb-5">
                                You can replay it anytime from Settings.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setConfirmingSkip(false)} className="flex-1">
                                    Keep Going
                                </Button>
                                <Button variant="danger" onClick={handleSkipConfirmed} className="flex-1">
                                    Skip
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
};

export default TutorialOverlay;
