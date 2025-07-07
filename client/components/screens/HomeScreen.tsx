import React, { useState } from 'react';
import { useGame } from '@/components/context/GameContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

const HomeScreen: React.FC = () => {
    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const { joinRoom } = useGame();

    const handleHost = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim()) {
            joinRoom(playerName.trim());
        }
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim() && roomCode.trim()) {
            joinRoom(playerName.trim(), roomCode.trim().toUpperCase());
        }
    };

    return (
        <div className="animate-fadeIn flex flex-col items-center justify-center space-y-8">
            <h1 className="font-cinzel text-5xl sm:text-6xl md:text-8xl font-bold text-yellow-500 text-center tracking-wider" style={{ textShadow: '0 0 25px rgba(234, 179, 8, 0.5)' }}>
                Avalon Online
            </h1>
            <p className="text-slate-300 text-base md:text-lg max-w-2xl text-center font-eaglelake">A game of hidden loyalty, deception, and deduction set in a world of myth and legend.</p>

            <Card className="w-full max-w-md">
                <form className="flex flex-col space-y-6">
                    <input
                        type="text"
                        placeholder="Enter Your Name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
                        required
                    />
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={handleHost} disabled={!playerName.trim()} className="w-full" type="button">
                            Host New Game
                        </Button>
                        <div className="flex flex-col gap-4 w-full">
                           <input
                                type="text"
                                placeholder="Room Code"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value)}
                                className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 uppercase transition"
                            />
                            <Button variant="secondary" onClick={handleJoin} disabled={!playerName.trim() || !roomCode.trim()} className="w-full" type="button">
                                Join Game
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default HomeScreen;