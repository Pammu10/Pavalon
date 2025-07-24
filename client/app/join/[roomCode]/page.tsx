
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGame } from '@/components/context/GameContext';
import Spinner from '@/components/ui/Spinner';
import AuthScreen from '@/components/screens/AuthScreen';
import { Castle, Play } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { motion } from 'framer-motion';

export default function JoinPage() {
    const params = useParams();
    const router = useRouter();
    const roomCode = params.roomCode as string;
    const { isAuthenticated, isLoading, joinRoom, gameState, isConnected } = useGame();
    const [status, setStatus] = useState('Initializing...');
    const [readyToJoin, setReadyToJoin] = useState(false);

    useEffect(() => {
        if (isLoading) {
            setStatus('Authenticating...');
            return;
        }

        if (!isAuthenticated) {
            setStatus('Redirecting to login...');
            return;
        }
        
        if (gameState.roomCode) {
            if (gameState.roomCode !== roomCode) {
                 setStatus(`Already in room ${gameState.roomCode}. Redirecting...`);
            } else {
                 setStatus(`You are already in this room. Redirecting...`);
            }
             router.replace(`/game/${gameState.roomCode}`);
             return;
        }

        if (!isConnected) {
            setStatus('Connecting to server...');
            return;
        }
        
        setStatus(`Ready to enter room ${roomCode.toUpperCase()}`);
        setReadyToJoin(true);
        
    }, [isLoading, isAuthenticated, isConnected, gameState.roomCode, roomCode, router]);

    const handleJoinClick = () => {
        setStatus(`Joining room ${roomCode.toUpperCase()}...`);
        setReadyToJoin(false);
        joinRoom(roomCode);
    };
    
    if (!isAuthenticated && !isLoading) {
        const handleAuthSuccess = () => {};
        return <AuthScreen onLoginSuccess={handleAuthSuccess} onRegisterSuccess={handleAuthSuccess} />;
    }

    return (
        <div className="flex items-center justify-center h-screen bg-slate-900/50">
            <Card className="w-full max-w-md text-center animate-fadeIn p-8 border-yellow-700/50">
                <Castle size={80} className="mx-auto text-yellow-500 mb-8 animate-glow" />
                
                <h1 className="text-3xl font-eaglelake text-white mb-2">Joining Game</h1>
                {roomCode && <p className="font-mono text-2xl text-yellow-400 tracking-widest mb-6">{roomCode.toUpperCase()}</p>}
                
                <div className="min-h-[80px] flex items-center justify-center">
                    {readyToJoin ? (
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            transition={{
                                repeat: Infinity,
                                repeatType: "reverse",
                                duration: 1.5,
                                ease: "easeInOut"
                            }}
                        >
                            <Button onClick={handleJoinClick} className="flex items-center gap-2 text-2xl py-4 px-8 shadow-lg shadow-yellow-500/20">
                                <Play size={24} />
                                Enter Game
                            </Button>
                        </motion.div>
                    ) : (
                        <Spinner size="lg" />
                    )}
                </div>

                <p className="mt-6 text-slate-300 text-lg tracking-wide">{status}</p>
            </Card>
        </div>
    );
}