
import React from 'react';
import { useVoice } from '../context/VoiceContext';
import { useGame } from '../context/GameContext';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

const VoiceControls: React.FC = () => {
    const { gameState, playerId } = useGame();
    const { isMuted, peerStates, permissionState, toggleMute, setPeerVolume, togglePeerMute } = useVoice();
    const { players, roomCode } = gameState;

    if (permissionState === 'denied') {
        return (
            <div className="p-4 text-center text-slate-400">
                <MicOff className="mx-auto mb-2 w-10 h-10 text-red-500" />
                <h4 className="font-bold">Microphone Access Denied</h4>
                <p className="text-sm">Please enable microphone permissions in your browser settings to use voice chat.</p>
            </div>
        );
    }
    
    if (!roomCode) {
         return (
             <div className="p-4 text-center text-slate-400">
                <MicOff className="mx-auto mb-2 w-10 h-10" />
                <p className="font-bold">Voice Chat Inactive</p>
                <p className="text-sm">Join a room to talk with others.</p>
            </div>
        )
    }

    if (players.length <= 1) {
        return (
             <div className="p-4 text-center text-slate-400">
                <Mic className="mx-auto mb-2 w-10 h-10" />
                <p className="font-bold">Voice chat is active.</p>
                <p className="text-sm">Waiting for other players to join...</p>
            </div>
        )
    }

    const otherPlayers = players.filter(p => p.id !== playerId);

    return (
        <div className="p-2 md:p-4 space-y-4 max-h-full overflow-y-auto scroll-hide">
            {/* Master Mute Control */}
            <div className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                <span className="font-bold text-lg text-white">Your Microphone</span>
                <button
                    onClick={toggleMute}
                    className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
            </div>

            {/* Individual Player Controls */}
            <div className="space-y-3">
                {otherPlayers.map(player => {
                    const state = peerStates[player.id] || { volume: 1, isMuted: false, isSpeaking: false };
                    
                    return (
                        <div key={player.id} className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`font-semibold transition-all ${state.isSpeaking ? 'text-green-400 animate-pulse' : 'text-slate-300'}`}>
                                    {player.name}
                                </span>
                                <button onClick={() => togglePeerMute(player.id)}>
                                    {state.isMuted ? <VolumeX className="text-red-400" size={20} /> : <Volume2 className="text-slate-400 hover:text-white" size={20} />}
                                </button>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={state.volume}
                                onChange={(e) => setPeerVolume(player.id, parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                disabled={state.isMuted}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VoiceControls;
