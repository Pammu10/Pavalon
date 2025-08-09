import React from 'react';
import { createPortal } from 'react-dom';
import Card from './Card';
import Button from './Button';
import { BookOpen, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface TutorialPromptModalProps {
    onStart: () => void;
    onClose: () => void;
}

const TutorialPromptModal: React.FC<TutorialPromptModalProps> = ({ onStart, onClose }) => {
    
    const handleStart = () => {
        onStart();
        onClose();
    }
    
    return createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] animate-fadeIn p-4">
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <Card 
                    className="w-full max-w-md border-2 border-yellow-700/50" 
                    onClick={e => e.stopPropagation()}
                >
                    <h2 className="font-eagleLake text-3xl text-yellow-500 text-center mb-2">Welcome, Knight!</h2>
                    <p className="text-center text-slate-300 mb-6">
                        Would you like a guided tour of Pavalon to learn the rules of the game?
                    </p>
                    <p className="text-center text-xs text-slate-400 mb-6 italic">
                        You can always access this tutorial later from the settings menu.
                    </p>

                    <div className="space-y-4">
                        <Button onClick={handleStart} className="w-full !text-lg !py-3 flex items-center justify-center gap-2">
                            <BookOpen size={20} /> Yes, Start Tutorial
                        </Button>
                        <Button onClick={onClose} variant="secondary" className="w-full !text-lg !py-3">
                            No, I'll Figure It Out
                        </Button>
                    </div>
                </Card>
            </motion.div>
        </div>,
        document.body
    );
};

export default TutorialPromptModal;
