
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import Button from './Button';
import { motion, AnimatePresence } from 'framer-motion';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TutorialOverlay: React.FC = () => {
    const { gameState, advanceTutorial, leaveRoom } = useGame();
    const { tutorial } = gameState;
    const [highlightRects, setHighlightRects] = useState<Rect[]>([]);

    useLayoutEffect(() => {
        if (!tutorial?.highlight || tutorial.highlight.length === 0) {
            setHighlightRects([]);
            return;
        }

        const getRects = () => {
            const newRects: Rect[] = [];
            tutorial.highlight?.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    newRects.push({
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                    });
                }
            });
            setHighlightRects(newRects);
        }

        getRects(); // Initial calculation
        
        window.addEventListener('resize', getRects);
        return () => window.removeEventListener('resize', getRects);
    }, [tutorial?.highlight]);

    if (!tutorial) return null;

    const hasHighlight = highlightRects.length > 0;
    const firstRect = hasHighlight ? highlightRects[0] : null;

    // Position the dialog box away from the highlighted element
    let dialogPositionClasses = 'bottom-10 left-1/2 -translate-x-1/2'; // Default bottom center
    if (firstRect) {
        const isHighlightHigh = firstRect.top < window.innerHeight / 2;
        if (isHighlightHigh) {
            dialogPositionClasses = `top-[${firstRect.top + firstRect.height + 20}px] left-1/2 -translate-x-1/2`;
        } else {
             dialogPositionClasses = `bottom-[${window.innerHeight - firstRect.top + 20}px] left-1/2 -translate-x-1/2`;
        }
    }


    const handleNext = () => {
        if (tutorial.isFinalStep) {
            leaveRoom();
        } else {
            advanceTutorial();
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[1000]">
            {/* Backdrop & Spotlight */}
             <svg className="absolute inset-0 w-full h-full">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {highlightRects.map((rect, i) => (
                           <rect
                                key={i}
                                x={rect.left - 8}
                                y={rect.top - 8}
                                width={rect.width + 16}
                                height={rect.height + 16}
                                rx="16"
                                fill="black"
                            />
                        ))}
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#spotlight-mask)" />
            </svg>
            
             {/* Glowing Borders for Highlights */}
            {highlightRects.map((rect, i) => (
                <div
                    key={i}
                    className="absolute pointer-events-none rounded-2xl"
                    style={{
                        top: rect.top - 8,
                        left: rect.left - 8,
                        width: rect.width + 16,
                        height: rect.height + 16,
                        boxShadow: '0 0 25px 8px rgba(250, 204, 21, 0.7), 0 0 0 2px rgba(250, 204, 21, 1)',
                        animation: 'pulse-glow 2s infinite',
                    }}
                />
            ))}

            {/* Dialog Box */}
            <AnimatePresence>
                <motion.div
                    key={tutorial.step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    className={`absolute w-[calc(100%-2rem)] max-w-md p-6 bg-slate-900/95 backdrop-blur-md rounded-2xl border-2 border-yellow-500/80 shadow-2xl text-white text-center transform ${dialogPositionClasses}`}
                >
                    <h2 className="font-eaglelake text-3xl text-yellow-400 mb-3">{tutorial.title}</h2>
                    <p className="text-slate-200 mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: tutorial.text }} />

                    {!tutorial.actionRequired ? (
                         <Button onClick={handleNext}>
                            {tutorial.isFinalStep ? 'Finish Tutorial' : 'Next'}
                        </Button>
                    ) : (
                        <p className="font-bold text-yellow-500 animate-pulse">Perform the highlighted action to continue...</p>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>,
        document.body
    );
};

export default TutorialOverlay;