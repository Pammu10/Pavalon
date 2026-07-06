'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import Button from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hand } from 'lucide-react';
import { TUTORIAL_SEEN_KEY } from './TutorialPromptModal';

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const TOTAL_STEPS = 7;
const PADDING = 12;

/** Stable measure: rAF chain lets browser finish layout before we read rects */
function measureAfterPaint(ids: string[], cb: (rects: Rect[]) => void) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const rects: Rect[] = [];
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el) {
                    const r = el.getBoundingClientRect();
                    rects.push({ top: r.top, left: r.left, width: r.width, height: r.height });
                }
            }
            cb(rects);
        });
    });
}

const TutorialOverlay: React.FC = () => {
    const { gameState, advanceTutorial, leaveRoom } = useGame();
    const { tutorial } = gameState;
    const [highlightRects, setHighlightRects] = useState<Rect[]>([]);
    const [confirmingSkip, setConfirmingSkip] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const scrollSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const measure = useCallback(() => {
        if (!tutorial?.highlight?.length) {
            setHighlightRects([]);
            return;
        }
        measureAfterPaint(tutorial.highlight, setHighlightRects);
    }, [tutorial?.highlight]);

    useEffect(() => {
        if (!tutorial?.highlight?.length) {
            setHighlightRects([]);
            return;
        }

        const firstEl = document.getElementById(tutorial.highlight[0]);
        if (firstEl) {
            firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Wait for smooth scroll to finish, then measure twice to catch edge cases
            if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
            scrollSettleTimer.current = setTimeout(() => {
                measure();
                // Second measure 200ms later handles slow devices
                scrollSettleTimer.current = setTimeout(measure, 200);
            }, 400);
        } else {
            measure();
        }

        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, { passive: true });
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure);
            if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
        };
    }, [tutorial?.highlight, measure]);

    if (!tutorial) return null;

    const hasHighlight = highlightRects.length > 0;
    const firstRect = hasHighlight ? highlightRects[0] : null;

    // Desktop dialog positioning — avoid the highlighted element, clamp to viewport
    let desktopDialogStyle: React.CSSProperties = {};
    if (!isMobile && firstRect) {
        const vh = window.innerHeight;
        const dialogH = 260; // estimated
        const dialogW = Math.min(window.innerWidth - 32, 448);
        const spaceBelow = vh - (firstRect.top + firstRect.height);
        const spaceAbove = firstRect.top;

        if (spaceBelow >= dialogH + PADDING * 2) {
            // Place below
            desktopDialogStyle = {
                top: Math.min(firstRect.top + firstRect.height + PADDING, vh - dialogH - 16),
                left: '50%',
                transform: 'translateX(-50%)',
            };
        } else if (spaceAbove >= dialogH + PADDING * 2) {
            // Place above
            desktopDialogStyle = {
                top: Math.max(firstRect.top - dialogH - PADDING, 16),
                left: '50%',
                transform: 'translateX(-50%)',
            };
        } else {
            // Not enough room above or below — place to the right or left
            const spaceRight = window.innerWidth - (firstRect.left + firstRect.width);
            if (spaceRight >= dialogW + PADDING) {
                desktopDialogStyle = {
                    top: Math.max(16, Math.min(firstRect.top, vh - dialogH - 16)),
                    left: firstRect.left + firstRect.width + PADDING,
                };
            } else {
                desktopDialogStyle = {
                    top: Math.max(16, Math.min(firstRect.top, vh - dialogH - 16)),
                    right: window.innerWidth - firstRect.left + PADDING,
                };
            }
        }
    } else if (!isMobile) {
        // No measured highlight: keep clear of the bottom action buttons
        // (Ready / vote controls) when the step waits on one of them.
        desktopDialogStyle = tutorial?.actionRequired
            ? { top: 80, left: '50%', transform: 'translateX(-50%)' }
            : { bottom: 48, left: '50%', transform: 'translateX(-50%)' };
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
        if (tutorial.isFinalStep) handleFinish();
        else advanceTutorial();
    };

    const dialogContent = (
        <div className="relative bg-slate-900/98 backdrop-blur-md rounded-2xl border-2 border-yellow-500/90 shadow-2xl shadow-black/70 p-4 sm:p-5 text-white">
            {/* Skip button */}
            {!tutorial.isFinalStep && (
                <button
                    onClick={() => setConfirmingSkip(true)}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                    aria-label="Skip tutorial"
                >
                    <X size={15} />
                </button>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === tutorial.step - 1
                                ? 'w-6 bg-yellow-400'
                                : i < tutorial.step - 1
                                  ? 'w-4 bg-yellow-600'
                                  : 'w-3 bg-slate-600'
                        }`}
                    />
                ))}
                <span className="text-xs text-slate-500 ml-1 tabular-nums">
                    {tutorial.step}/{TOTAL_STEPS}
                </span>
            </div>

            {/* Title */}
            <h2 className="font-eaglelake text-xl sm:text-2xl text-yellow-400 mb-2 leading-tight text-center pr-6">
                {tutorial.title}
            </h2>

            {/* Body text */}
            <p
                className="text-slate-200 mb-4 leading-relaxed text-sm text-center"
                dangerouslySetInnerHTML={{ __html: tutorial.text }}
            />

            {/* Action callout — specific instruction when waiting for user action */}
            {tutorial.actionRequired ? (
                <motion.div
                    className="flex items-center gap-3 bg-yellow-500/15 border border-yellow-500/50 rounded-xl px-4 py-3"
                    animate={{ borderColor: ['rgba(234,179,8,0.4)', 'rgba(234,179,8,0.9)', 'rgba(234,179,8,0.4)'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <motion.div
                        animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex-shrink-0"
                    >
                        <Hand size={20} className="text-yellow-400" />
                    </motion.div>
                    <p className="text-yellow-300 font-semibold text-sm leading-snug">
                        {tutorial.actionText ?? 'Perform the highlighted action to continue'}
                    </p>
                </motion.div>
            ) : (
                <Button onClick={handleNext} className="w-full mt-1">
                    {tutorial.isFinalStep ? '🎉 Start Playing' : 'Next →'}
                </Button>
            )}
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-[1000] pointer-events-none">
            {/* Backdrop with spotlight cutouts. Visual only: SVG masks don't
                cut pointer-event holes, so an interactive backdrop would
                swallow the very clicks the steps ask for (server-side
                tutorial guards ignore off-script actions anyway). */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {highlightRects.map((rect, i) => (
                            <rect
                                key={i}
                                x={rect.left - PADDING}
                                y={rect.top - PADDING}
                                width={rect.width + PADDING * 2}
                                height={rect.height + PADDING * 2}
                                rx="14"
                                fill="black"
                            />
                        ))}
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#spotlight-mask)" />
            </svg>

            {/* Glow borders around highlighted elements */}
            {highlightRects.map((rect, i) => (
                <motion.div
                    key={`glow-${i}-${tutorial.step}`}
                    className="absolute pointer-events-none rounded-2xl"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    style={{
                        top: rect.top - PADDING,
                        left: rect.left - PADDING,
                        width: rect.width + PADDING * 2,
                        height: rect.height + PADDING * 2,
                        boxShadow: '0 0 0 2.5px rgba(250,204,21,1), 0 0 0 5px rgba(250,204,21,0.25), 0 0 32px 8px rgba(250,204,21,0.45)',
                        animation: 'tutorialGlow 2s ease-in-out infinite',
                    }}
                />
            ))}

            {/* ── MOBILE: bottom sheet (always anchored, never overlaps content) ── */}
            {isMobile && (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={tutorial.step}
                        initial={{ opacity: 0, y: 60 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="pointer-events-auto absolute bottom-0 left-0 right-0 px-3 pb-4 pt-1"
                        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                    >
                        {dialogContent}
                    </motion.div>
                </AnimatePresence>
            )}

            {/* ── DESKTOP: smart positioned dialog ── */}
            {!isMobile && (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={tutorial.step}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -12, scale: 0.97 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="absolute pointer-events-auto w-[calc(100%-2rem)] max-w-md"
                        style={desktopDialogStyle}
                    >
                        {dialogContent}
                    </motion.div>
                </AnimatePresence>
            )}

            {/* Skip confirmation */}
            <AnimatePresence>
                {confirmingSkip && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 flex items-end sm:items-center justify-center pointer-events-auto"
                        style={{ background: 'rgba(0,0,0,0.55)' }}
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 80, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            className="bg-slate-900 border-2 border-slate-600 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm text-center shadow-2xl"
                            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
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
