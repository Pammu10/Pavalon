"use client";
import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, animate } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, X, Crown } from 'lucide-react';

interface SwipeableCardProps {
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  rightLabel: string;
  leftLabel: string;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  title: string;
  disabled?: boolean;
  leftSwipeDisabled?: boolean;
}

function SwipeableCard({
  onSwipeRight,
  onSwipeLeft,
  rightLabel,
  leftLabel,
  rightIcon = <Check size={24} />,
  leftIcon = <X size={24} />,
  title,
  disabled = false,
  leftSwipeDisabled = false,
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [constraints, setConstraints] = useState({ left: 0, right: 0 });
  const [maxOffset, setMaxOffset] = useState(0);
  const [isAtEnd, setIsAtEnd] = useState<'left' | 'right' | null>(null);
  const [lockedChoice, setLockedChoice] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const orbWidth = 56; // h-14 = 3.5rem = 56px
      const offset = (containerWidth - orbWidth) / 2;
      setMaxOffset(offset);
      setConstraints({ left: leftSwipeDisabled ? 0 : -offset, right: offset });
    }
  }, [leftSwipeDisabled]);

  useEffect(() => {
    const unsubscribe = x.on("change", (latestX) => {
        const tolerance = 1; // 1px tolerance
        if (latestX >= maxOffset - tolerance && maxOffset > 0) {
            setIsAtEnd('right');
        } else if (latestX <= -maxOffset + tolerance && maxOffset > 0) {
            if (!leftSwipeDisabled) setIsAtEnd('left');
        } else {
            setIsAtEnd(null);
        }
    });
    return () => unsubscribe();
  }, [x, maxOffset, leftSwipeDisabled]);

  const handleDragEnd = (event: any, info: any) => {
    const tolerance = 5; // px tolerance to count as reaching the end
    if (!disabled && !lockedChoice) {
        if (info.offset.x >= maxOffset - tolerance) {
            setLockedChoice('right');
            onSwipeRight();
        } else if (info.offset.x <= -maxOffset + tolerance) {
            if (!leftSwipeDisabled) {
              setLockedChoice('left');
              onSwipeLeft();
            }
        } else {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
        }
    }
  };

  // Transformations for background fills
  const rightFillWidth = useTransform(x, [0, maxOffset], ['0%', '100%']);
  const leftFillWidth = useTransform(x, [-maxOffset, 0], leftSwipeDisabled ? ['0%', '0%'] : ['100%', '0%']);
  
  // Orb transformations
  const centerContentOpacity = useTransform(x, [-maxOffset * 0.5, 0, maxOffset * 0.5], [0, 1, 0]);
  const rightIconOpacity = useTransform(x, [maxOffset * 0.2, maxOffset * 0.8], [0, 1]);
  const leftIconOpacity = useTransform(x, [-maxOffset * 0.8, -maxOffset * 0.2], [1, 0]);
  const orbBgOpacity = useTransform(x, [-maxOffset * 0.8, 0, maxOffset * 0.8], [0.1, 0.4, 0.1]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xs sm:max-w-sm">
        <h3 className="font-eaglelake text-2xl text-yellow-400 text-center" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{title}</h3>
        <div 
          ref={containerRef} 
          className="relative w-full h-16 rounded-full bg-slate-900/80 border border-slate-400/30 shadow-inner shadow-black/50 overflow-hidden flex items-center"
        >
            <AnimatePresence>
            {!disabled && (
                <>
                <motion.div 
                    style={{ width: leftFillWidth }} 
                    className={cn(
                        "absolute top-0 left-0 bottom-0 bg-red-600 flex items-center justify-start pl-6 overflow-hidden",
                        isAtEnd === 'left' && "animate-vote-glow-red",
                        lockedChoice && lockedChoice !== 'left' && 'opacity-30'
                    )}
                >
                    <div className={cn( "flex items-center gap-2 text-slate-100 font-bold text-lg font-eaglelake whitespace-nowrap", isAtEnd === 'left' && "animate-bounce-vote-text" )}>
                        {leftIcon} {leftLabel}
                    </div>
                </motion.div>
                
                <motion.div 
                    style={{ width: rightFillWidth }} 
                    className={cn(
                        "absolute top-0 right-0 bottom-0 bg-blue-600 flex items-center justify-end pr-6 overflow-hidden",
                         isAtEnd === 'right' && "animate-vote-glow-blue",
                         lockedChoice && lockedChoice !== 'right' && 'opacity-30'
                    )}
                >
                     <div className={cn( "flex items-center gap-2 text-slate-100 font-bold text-lg font-eaglelake whitespace-nowrap", isAtEnd === 'right' && "animate-bounce-vote-text" )}>
                        {rightLabel} {rightIcon}
                    </div>
                </motion.div>
                </>
            )}
            </AnimatePresence>

            <motion.div
                drag={disabled || !!lockedChoice ? false : "x"}
                dragConstraints={constraints}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className={cn(
                  "absolute top-0 bottom-0 my-auto left-1/2 -ml-7 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-10",
                  "border-2 border-white/30 backdrop-blur-sm",
                  disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
                  lockedChoice && 'animate-lock-in'
                )}
            >
                <motion.div 
                    className="absolute inset-0 rounded-full bg-slate-400"
                    style={{ opacity: orbBgOpacity }}
                />
                
                <AnimatePresence>
                  {!lockedChoice && (
                    <>
                      <motion.div className="absolute" style={{ opacity: centerContentOpacity }}>
                          <Crown className="w-8 h-8 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.8))'}} />
                      </motion.div>
                      <motion.div className="absolute" style={{ opacity: rightIconOpacity }}>
                          <Check className="w-8 h-8 text-blue-300" style={{ filter: 'drop-shadow(0 0 8px rgba(147, 197, 253, 0.8))'}} />
                      </motion.div>
                      <motion.div className="absolute" style={{ opacity: leftIconOpacity }}>
                          <X className="w-8 h-8 text-red-300" style={{ filter: 'drop-shadow(0 0 8px rgba(252, 165, 165, 0.8))'}} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                
                 {lockedChoice === 'right' && (
                    <Check className="w-8 h-8 text-blue-300" style={{ filter: 'drop-shadow(0 0 8px rgba(147, 197, 253, 0.8))'}} />
                 )}
                 {lockedChoice === 'left' && (
                     <X className="w-8 h-8 text-red-300" style={{ filter: 'drop-shadow(0 0 8px rgba(252, 165, 165, 0.8))'}} />
                 )}
            </motion.div>
        </div>
    </div>
  );
}

export default SwipeableCard;