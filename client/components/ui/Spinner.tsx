import React, { useState } from 'react';
import { cn } from '@/lib/utils';

const TriskelionSymbol = ({ className }: { className?: string }) => (
    <div
      className={cn("relative", className)}
      style={{ filter: 'drop-shadow(0 0 15px rgba(252, 211, 77, 0.7))' }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <radialGradient id="goldGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="10" fill="url(#goldGradient)" />
        <g stroke="url(#goldGradient)" strokeWidth="6" fill="none" strokeLinecap="round">
            <path d="M50 50 C 75 25, 75 75, 50 50" transform="rotate(0 50 50)"/>
            <path d="M50 50 C 75 25, 75 75, 50 50" transform="rotate(120 50 50)"/>
            <path d="M50 50 C 75 25, 75 75, 50 50" transform="rotate(240 50 50)"/>
        </g>
      </svg>
    </div>
  );

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
    const [speed, setSpeed] = useState<'fast' | 'slow'>('slow');

    const toggleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent clicks from bubbling up, e.g., if it's in a button
        setSpeed(prev => (prev === 'fast' ? 'slow' : 'fast'));
    };

    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-16 h-16',
        lg: 'w-32 h-32',
    };

    const animationClass = speed === 'fast' ? 'animate-spin-fast' : 'animate-spin-slow';

    return (
        <div 
            className="flex justify-center items-center cursor-pointer [-webkit-tap-highlight-color:transparent]" 
            onClick={toggleSpeed} 
            role="button" 
            tabIndex={0}
            aria-label="Toggle spinner speed"
        >
            <div className={cn(sizeClasses[size], animationClass, 'transition-transform duration-200 active:scale-90')}>
                 <TriskelionSymbol className="w-full h-full" />
            </div>
        </div>
    );
};

export default Spinner;
