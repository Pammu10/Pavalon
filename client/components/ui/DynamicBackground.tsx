'use client';

import { useGame } from '@/components/context/GameContext';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import Image from 'next/image';

const backgrounds = {
    '': '/background/king.jpg', // Default
    default: '/background/king.jpg',
    goodguy: '/background/goodguy.png',
    badguy: '/background/badguy.png',
    forestday: '/background/forestday.png',
    forestnight: '/background/forestnight.png',
    cherry: '/background/cherry.png',
    pool: '/background/pool.png',
    chair: '/background/chair.png',
    tournament: '/background/tournament.png',
    ice: '/background/ice.png',
    fire: '/background/fire.png',
    dark: '/background/dark.png',
    light: '/background/light.png',
    reddrag: '/background/reddrag.png',
    bluedrag: '/background/bluedrag.png',
    purpledrag: '/background/purpledrag.png'
};

const DynamicBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, previewBackground } = useGame();
    
    const bgKey = previewBackground !== null ? previewBackground : (user?.selectedBackground || '');
    const bgUrl = backgrounds[bgKey as keyof typeof backgrounds] || backgrounds.default;

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
                    {/* Overlay for darkening and vignette effect */}
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.7)_100%)]" />
                </motion.div>
            </AnimatePresence>
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default DynamicBackground;