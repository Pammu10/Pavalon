'use client';

import { useGame } from '@/components/context/GameContext';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import Image from 'next/image';

const backgrounds = {
    '': '/background/king.jpg', // Default
    default: '/background/king.jpg',
    lady: '/background/lady.png',
    woods: '/background/woods.png',
    orchard: '/background/orchard.png',
    dragon: '/background/dragon.png',
    round: '/background/round.png',
    pool: '/background/pool.png',
    siege: '/background/siege.png',
    tournament: '/background/tournament.png',
    chapel: '/background/chapel.png',
    armory: '/background/armory.png',
};

const DynamicBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useGame();
    
    const selectedBgKey = user?.selectedBackground || '';
    const bgUrl = backgrounds[selectedBgKey as keyof typeof backgrounds] || backgrounds.default;

    return (
        <div className="min-h-[100dvh] overflow-hidden relative">
            <AnimatePresence>
                <motion.div
                    key={bgUrl}
                    className="absolute inset-0 z-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: 'easeInOut' }}
                >
                    <Image
                        src={bgUrl}
                        alt="Pavalon game background"
                        fill
                        className="object-cover"
                        quality={75}
                        priority
                    />
                </motion.div>
            </AnimatePresence>
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default DynamicBackground;