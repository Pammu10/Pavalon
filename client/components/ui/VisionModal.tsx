import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Player } from '@/types';
import Card from './Card';
import PlayerTile from './PlayerTile';
import { Eye, X } from 'lucide-react';
import Button from './Button';

interface VisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    visiblePlayers: { player: Player; knownAs: 'Evil' | 'Mystic' }[];
}

const VisionModal: React.FC<VisionModalProps> = ({ isOpen, onClose, visiblePlayers }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getVisionDescription = () => {
        if (visiblePlayers.length === 0) {
            return "Your senses reveal nothing out of the ordinary. Trust no one.";
        }
        const firstKnownAs = visiblePlayers[0].knownAs;
        if (firstKnownAs === 'Evil') {
            return "You see your fellow agents of shadow. Coordinate to bring ruin to the kingdom.";
        }
        if (firstKnownAs === 'Mystic') {
            return "Two figures of immense power appear to you. One is Merlin, the other, the deceptive Morgana. Discern the truth.";
        }
        return "You have glimpsed those who share your dark allegiance.";
    };

    return createPortal(
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] animate-fadeIn p-4"
            onClick={onClose}
        >
            <Card 
                className="w-full max-w-2xl animate-slideInUp border-2 border-yellow-700/50 my-auto bg-slate-900/100 backdrop-blur-none"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-eaglelake text-2xl text-yellow-500 flex items-center gap-2">
                        <Eye /> Your Vision
                    </h2>
                     <Button
                        variant="danger"
                        onClick={onClose}
                        className="p-2 h-auto rounded-full aspect-square"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </Button>
                </div>
                
                <p className="text-center text-slate-300 mb-6">{getVisionDescription()}</p>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-4 gap-y-6 justify-center">
                    {visiblePlayers.map(({ player, knownAs }) => (
                        <PlayerTile
                            key={player.id}
                            player={player}
                            isKnownAs={knownAs}
                        />
                    ))}
                </div>

                {visiblePlayers.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-slate-500 italic">You see no one.</p>
                    </div>
                )}
            </Card>
        </div>,
        document.body
    );
};

export default VisionModal;