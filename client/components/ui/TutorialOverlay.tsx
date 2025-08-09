import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import Button from './Button';
import { tutorialSteps } from '@/tutorial/tutorialConfig';

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const TutorialOverlay: React.FC = () => {
    const { tutorialStep, nextTutorialStep, prevTutorialStep, endTutorial } = useGame();
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

    const currentStep = tutorialSteps[tutorialStep];

    useLayoutEffect(() => {
        if (!currentStep) return;

        let attempts = 0;
        const maxAttempts = 20; // 20 * 150ms = 3 seconds
        let intervalId: ReturnType<typeof setTimeout> | null = null;

        const findAndPosition = () => {
            const element = document.getElementById(currentStep.elementId);

            if (element) {
                if (intervalId) clearTimeout(intervalId);

                const scrollAndMeasure = () => {
                    const rect = element.getBoundingClientRect();
                    const newRect = {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                    };
                    setTargetRect(newRect);
                    
                    const popover = document.getElementById('tutorial-popover');
                    if (!popover) return;
                    
                    const popoverRect = popover.getBoundingClientRect();
                    const pos = currentStep.position || 'bottom';

                    let top = 0, left = 0;
                    const offset = 16;
                    
                    if (pos === 'bottom') {
                        top = rect.bottom + offset;
                        left = rect.left + rect.width / 2 - popoverRect.width / 2;
                    } else if (pos === 'top') {
                        top = rect.top - popoverRect.height - offset;
                        left = rect.left + rect.width / 2 - popoverRect.width / 2;
                    } else if (pos === 'right') {
                        top = rect.top + rect.height / 2 - popoverRect.height / 2;
                        left = rect.right + offset;
                    } else if (pos === 'left') {
                        top = rect.top + rect.height / 2 - popoverRect.height / 2;
                        left = rect.left - popoverRect.width - offset;
                    } else { // center
                        top = window.innerHeight / 2 - popoverRect.height / 2;
                        left = window.innerWidth / 2 - popoverRect.width / 2;
                    }
                    
                    // Boundary checks
                    left = Math.max(offset, Math.min(left, window.innerWidth - popoverRect.width - offset));
                    top = Math.max(offset, Math.min(top, window.innerHeight - popoverRect.height - offset));

                    setPopoverPosition({ top, left });
                };

                const elementsToScroll = [
                    'role-vision',
                    'quest-progress-bar',
                    'player-grid',
                    'team-vote-buttons',
                    'quest-vote-buttons',
                    'assassination-grid'
                ];

                if (elementsToScroll.includes(currentStep.elementId)) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(scrollAndMeasure, 500);
                } else {
                    scrollAndMeasure();
                }
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    intervalId = setTimeout(findAndPosition, 150);
                } else {
                    // Fallback: Center popover if element not found
                    setTargetRect(null);
                    const popover = document.getElementById('tutorial-popover');
                    if(!popover) return;
                    const popoverRect = popover.getBoundingClientRect();
                    setPopoverPosition({
                        top: window.innerHeight / 2 - popoverRect.height / 2,
                        left: window.innerWidth / 2 - popoverRect.width / 2,
                    });
                }
            }
        };
        
        // Using a longer initial delay to allow for component transitions and mounting.
        const initialTimeout = setTimeout(findAndPosition, 250);
        window.addEventListener('resize', findAndPosition);
        
        return () => {
            clearTimeout(initialTimeout);
            if (intervalId) clearTimeout(intervalId);
            window.removeEventListener('resize', findAndPosition);
        };
    }, [tutorialStep, currentStep]);


    if (!currentStep) return null;

    const highlightStyle: React.CSSProperties = targetRect
        ? {
              position: 'fixed',
              top: `${targetRect.top - 6}px`, // 6px padding
              left: `${targetRect.left - 6}px`,
              width: `${targetRect.width + 12}px`,
              height: `${targetRect.height + 12}px`,
          }
        : { 
            // When no element, don't show a highlight
            display: 'none'
        };

    const popoverStyle: React.CSSProperties = {
        position: 'fixed',
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`,
    };
    
    return createPortal(
        <div className="fixed inset-0 z-[999]">
            <AnimatePresence>
                <motion.div
                    key={`highlight-${tutorialStep}`}
                    className="tutorial-highlight"
                    style={highlightStyle}
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.3 }}
                />
            </AnimatePresence>

            <AnimatePresence>
                 <motion.div
                    key={`popover-${tutorialStep}`}
                    id="tutorial-popover"
                    className="tutorial-popover w-[clamp(280px,80vw,400px)] bg-slate-900/80 backdrop-blur-md text-white rounded-xl shadow-2xl border-2 border-yellow-500/50 p-4"
                    style={popoverStyle}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex justify-between items-center mb-2">
                         <h3 className="font-eaglelake text-xl text-yellow-400">{currentStep.title}</h3>
                         <button onClick={endTutorial} className="p-1 rounded-full hover:bg-slate-700">
                             <X size={20} />
                         </button>
                    </div>
                   
                    <p className="text-slate-200 text-sm mb-4">{currentStep.content}</p>

                    <div className="flex justify-between items-center">
                        <Button
                            onClick={prevTutorialStep}
                            disabled={tutorialStep === 0}
                            variant="secondary"
                            className="text-sm py-2 px-4"
                        >
                            <ArrowLeft size={16} className="mr-1" /> Back
                        </Button>

                        <div className="text-sm text-slate-400">
                            {tutorialStep + 1} / {tutorialSteps.length}
                        </div>

                        <Button
                            onClick={tutorialStep === tutorialSteps.length - 1 ? endTutorial : nextTutorialStep}
                            className="text-sm py-2 px-4"
                        >
                            {tutorialStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                            <ArrowRight size={16} className="ml-1" />
                        </Button>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>,
        document.body
    );
};

export default TutorialOverlay;