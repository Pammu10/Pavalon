import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../context/GameContext';
import Card from './Card';
import Button from './Button';
import Spinner from './Spinner';
import api from '@/services/api';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UsernameSetupModalProps {
    suggestedUsername: string;
    onClose: () => void;
}

const UsernameSetupModal: React.FC<UsernameSetupModalProps> = ({ suggestedUsername, onClose }) => {
    const { updateUsername } = useGame();
    const [username, setUsername] = useState(suggestedUsername);
    const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Provide instant feedback for length requirements as the user types
    useEffect(() => {
        if (username.length > 0 && (username.length < 3 || username.length > 10)) {
            setStatus('invalid');
            setMessage('Username must be 3-10 characters.');
        } else if (status === 'invalid' && message === 'Username must be 3-10 characters.') {
            // Clear the length error if it's now valid, but don't perform an API check.
            setStatus('idle');
            setMessage('');
        }
    }, [username, status, message]);

    const handleConfirm = async () => {
        // Clear previous API messages, but keep length validation messages if they exist.
        if (status !== 'invalid' || message === 'Username must be 3-10 characters.') {
            setStatus('idle');
            setMessage('');
        }

        // Final length check on submit
        if (username.length < 3 || username.length > 10) {
            setStatus('invalid');
            setMessage('Username must be 3-10 characters.');
            return;
        }
        
        setIsSubmitting(true);
        try {
            // If the user kept the suggested name, no action is needed. Just close.
            if (username === suggestedUsername) {
                onClose();
                return;
            }

            // If the name is new, check for availability first before updating.
            setStatus('checking');
            const { data } = await api.get(`/user/check-username?username=${username}`);
            if (data.available) {
                await updateUsername(username);
                onClose();
            } else {
                setStatus('invalid');
                setMessage(data.message || 'Username is not available.');
            }
        } catch (error: any) {
            // This will catch errors from either the check or the update.
            setStatus('invalid');
            setMessage(error.response?.data?.message || 'An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isConfirmDisabled = status === 'invalid' || isSubmitting;

    const StatusIcon = () => {
        switch (status) {
            case 'checking': return <Spinner size="sm" />;
            case 'valid': return <CheckCircle className="text-green-500" />;
            case 'invalid': return <XCircle className="text-red-500" />;
            default: return null;
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] animate-fadeIn p-4">
            <Card className="w-full max-w-md animate-slideInUp border-2 border-yellow-700/50" onClick={e => e.stopPropagation()}>
                <h2 className="font-eaglelake text-3xl text-yellow-500 text-center mb-2">Welcome to Pavalon!</h2>
                <p className="text-center text-slate-300 mb-6">Let's set up your in-game identity.</p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="username-input" className="block text-sm font-bold text-slate-400 mb-2">Your Username:</label>
                        <div className="relative">
                            <input
                                id="username-input"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition pr-10"
                                maxLength={10}
                            />
                            <div className="absolute inset-y-0 right-3 flex items-center">
                                <StatusIcon />
                            </div>
                        </div>
                        <AnimatePresence>
                            {message && (
                                <motion.p 
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className={`text-sm mt-2 text-center ${status === 'valid' ? 'text-green-400' : 'text-red-400'}`}
                                >
                                    {message}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg text-slate-400 text-xs">
                        <Info size={24} className="flex-shrink-0 mt-0.5"/>
                        <span>You can change your username later from the settings page (once every 7 days).</span>
                    </div>

                    <Button onClick={handleConfirm} disabled={isConfirmDisabled} className="w-full !text-lg !py-3">
                        {isSubmitting ? <Spinner size="sm" /> : 'Confirm and Enter'}
                    </Button>
                </div>
            </Card>
        </div>,
        document.body
    );
};

export default UsernameSetupModal;