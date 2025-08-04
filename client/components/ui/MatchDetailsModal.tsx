import React, { useState, useEffect } from 'react';
import { fetcher } from '@/services/api';
import { MatchPlayerPerformance, Alignment } from '@/types';
import Spinner from './Spinner';
import Card from './Card';
import { useQuery } from '@tanstack/react-query';

interface MatchDetailsModalProps {
    matchId: number;
    onClose: () => void;
}

const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({ matchId, onClose }) => {
    const { data: details, isLoading: loading, isError: error } = useQuery<MatchPlayerPerformance[]>({
        queryKey: ['matchDetails', matchId],
        queryFn: () => fetcher(`/match/${matchId}`),
        enabled: !!matchId,
    });

    // Handle Escape key press
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] animate-fadeIn p-4"
            onClick={onClose}
        >
            <Card 
                className="w-full max-w-lg animate-slideInUp border-2 border-yellow-700/50"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-eagleLake text-2xl text-yellow-500">Match Details</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                
                {loading && <div className="h-48 flex justify-center items-center"><Spinner /></div>}
                
                {error && <p className="text-center text-red-500">Failed to load match details.</p>}
                
                {!loading && !error && details && (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {details.map((player, index) => {
                            const isGood = player.alignment === Alignment.GOOD;
                            const alignmentColor = isGood ? 'text-blue-400' : 'text-red-400';
                            
                            return (
                                <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                                    <div>
                                        <p className="font-bold text-lg text-white">{player.username}</p>
                                        <p className={`text-sm ${alignmentColor}`}>{player.role}</p>
                                    </div>
                                    <span className={`font-bold font-eagleLake text-sm ${player.won ? 'text-green-400' : 'text-red-500'}`}>
                                        {player.won ? 'VICTORY' : 'DEFEAT'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default MatchDetailsModal;