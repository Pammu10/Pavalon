import React from 'react';
import { useVoice } from '../context/VoiceContext';
import { useGame } from '../context/GameContext';
import { Mic, MicOff, Volume2, VolumeX, Ear, EarOff, Headset } from 'lucide-react';
import { GamePhase } from '@/types';

const Toggle: React.FC<{ label: string; enabled: boolean; onToggle: () => void, Icon: React.FC<any>, OffIcon: React.FC<any> }> = ({ label, enabled, onToggle, Icon, OffIcon }) => (
    <div className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
            {enabled ? <Icon size={20} className="text-green-400" /> : <OffIcon size={20} className="text-red-400" />}
            <span className="font-bold text-lg text-white">{label}</span>
        </div>
        <button
            onClick={onToggle}
            className={`relative inline-flex items-center h-7 rounded-full w-12 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-yellow-500 ${enabled ? 'bg-green-600' : 'bg-slate-600'}`}
        >
            <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const VoiceControls: React.FC = () => {
    const { gameState, playerId } = useGame();
    const { isMuted, peerStates, permissionState, toggleMute, setPeerVolume, togglePeerMute, micMonitoring, toggleMicMonitoring } = useVoice();
    const { players, roomCode, phase } = gameState;

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

    if (phase === GamePhase.HOME) {
        return (
            <div className="p-4 text-center text-slate-400 h-full flex flex-col items-center justify-center">
                <Mic className="mx-auto mb-2 w-10 h-10" />
                <p className="font-bold">Voice Chat Ready</p>
                <p className="text-sm">Your microphone will activate automatically when the game starts.</p>
            </div>
        );
    }

    const otherPlayers = players.filter(p => p.id !== playerId);

    return (
        <div className="p-2 md:p-4 space-y-4 max-h-full overflow-y-auto scroll-hide">
             {players.length <= 1 ? (
                <div className="p-4 text-center text-slate-400">
                    <Mic className="mx-auto mb-2 w-10 h-10" />
                    <p className="font-bold">Voice chat is active.</p>
                    <p className="text-sm">Waiting for other players to join...</p>
                </div>
            ) : (
                <>
                    {/* My Controls */}
                    <div className="space-y-3">
                         <h4 className="font-eagleLake text-yellow-500 text-lg">My Controls</h4>
                        <Toggle label="Microphone" enabled={!isMuted} onToggle={toggleMute} Icon={Mic} OffIcon={MicOff} />
                        <Toggle label="Mic Monitoring" enabled={micMonitoring} onToggle={toggleMicMonitoring} Icon={Ear} OffIcon={EarOff} />
                    </div>

                    {/* Individual Player Controls */}
                    <div className="space-y-3 pt-4 border-t border-slate-700/50">
                        <h4 className="font-eagleLake text-yellow-500 text-lg">Player Volumes</h4>
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
                </>
            )}
        </div>
    );
};

export default VoiceControls;
