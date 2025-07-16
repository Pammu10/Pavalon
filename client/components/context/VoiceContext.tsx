import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useGame } from './GameContext';
import { socketService } from '@/services/socketService';
import { toast } from 'sonner';

// --- Types ---

interface PeerState {
    volume: number;
    isMuted: boolean;
    isSpeaking: boolean;
}

interface VoiceContextType {
    isMuted: boolean;
    peerStates: { [socketId: string]: PeerState };
    permissionState: 'prompt' | 'granted' | 'denied';
    toggleMute: () => void;
    setPeerVolume: (socketId: string, volume: number) => void;
    togglePeerMute: (socketId: string) => void;
}

// --- Context Definition ---

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

// --- Provider Component ---

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { gameState, playerId } = useGame();
    const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [isMuted, setIsMuted] = useState(false);
    
    // --- State and Refs ---
    const [peerStates, setPeerStates] = useState<{ [socketId: string]: PeerState }>({});
    const [peerStreams, setPeerStreams] = useState<{ [socketId: string]: MediaStream }>({});

    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
    const audioElementsRef = useRef<{ [socketId: string]: HTMLAudioElement }>({});
    const analyserNodesRef = useRef<{ [socketId: string]: { analyser: AnalyserNode, source: MediaStreamAudioSourceNode } }>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const speakingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // --- Core WebRTC Functions ---

    const createPeerConnection = useCallback((targetSocketId: string) => {
        if (peerConnectionsRef.current[targetSocketId]) {
            peerConnectionsRef.current[targetSocketId].close();
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketService.emit('voice:ice-candidate', { targetId: targetSocketId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setPeerStreams(prev => ({ ...prev, [targetSocketId]: event.streams[0] }));
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }
        
        peerConnectionsRef.current[targetSocketId] = pc;
        return pc;
    }, []);

    const closePeerConnection = useCallback((socketIdOrData: string | { socketId: string }) => {
        const socketId = typeof socketIdOrData === 'string' ? socketIdOrData : socketIdOrData.socketId;

        if (peerConnectionsRef.current[socketId]) {
            peerConnectionsRef.current[socketId].close();
            delete peerConnectionsRef.current[socketId];
        }
        if (audioElementsRef.current[socketId]) {
            delete audioElementsRef.current[socketId];
        }
        if (analyserNodesRef.current[socketId]) {
            analyserNodesRef.current[socketId].source.disconnect();
            delete analyserNodesRef.current[socketId];
        }

        setPeerStreams(prev => {
            const newStreams = { ...prev };
            delete newStreams[socketId];
            return newStreams;
        });

        setPeerStates(prev => {
            const newStates = { ...prev };
            delete newStates[socketId];
            return newStates;
        });
    }, []);

    // --- Signaling Event Handlers ---

    const handleUserJoined = useCallback(async ({ socketId }: { socketId: string }) => {
        if (socketId === playerId || !localStreamRef.current) return;
        const pc = createPeerConnection(socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.emit('voice:offer', { targetId: socketId, sdp: offer });
    }, [createPeerConnection, playerId]);

    const handleOffer = useCallback(async ({ fromId, sdp }: { fromId: string, sdp: RTCSessionDescriptionInit }) => {
        if (!localStreamRef.current) return;
        const pc = createPeerConnection(fromId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.emit('voice:answer', { targetId: fromId, sdp: answer });
    }, [createPeerConnection]);

    const handleAnswer = useCallback(async ({ fromId, sdp }: { fromId: string, sdp: RTCSessionDescriptionInit }) => {
        const pc = peerConnectionsRef.current[fromId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    }, []);

    const handleIceCandidate = useCallback(async ({ fromId, candidate }: { fromId: string, candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current[fromId];
        if (pc && candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error("Error adding received ice candidate", e);
            }
        }
    }, []);

    // --- Microphone & Main Setup ---

    const startVoiceChat = useCallback(async () => {
        if (localStreamRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            // Set initial muted state
            stream.getAudioTracks().forEach(track => track.enabled = !isMuted);

            setPermissionState('granted');
        } catch (error) {
            console.error("Error accessing microphone:", error);
            setPermissionState('denied');
            toast.error("Microphone access denied", {
                description: "Voice chat will be disabled. Please grant microphone permissions in your browser settings and rejoin.",
            });
        }
    }, [isMuted]);

    const stopVoiceChat = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        Object.keys(peerConnectionsRef.current).forEach(id => closePeerConnection({socketId: id}));
        peerConnectionsRef.current = {};
        audioElementsRef.current = {};
        setPeerStreams({});
        setPeerStates({});
        setPermissionState('prompt');
    }, [closePeerConnection]);
    
    // --- Effects ---

    useEffect(() => {
        if (gameState.roomCode && permissionState !== 'denied') {
            startVoiceChat();
        } else {
            stopVoiceChat();
        }
    }, [gameState.roomCode, startVoiceChat, stopVoiceChat, permissionState]);

    useEffect(() => {
        if (permissionState !== 'granted') return;
        
        socketService.on('voice:user-joined', handleUserJoined);
        socketService.on('voice:user-left', closePeerConnection);
        socketService.on('voice:offer', handleOffer);
        socketService.on('voice:answer', handleAnswer);
        socketService.on('voice:ice-candidate', handleIceCandidate);

        return () => {
            socketService.off('voice:user-joined', handleUserJoined);
            socketService.off('voice:user-left', closePeerConnection);
            socketService.off('voice:offer', handleOffer);
            socketService.off('voice:answer', handleAnswer);
            socketService.off('voice:ice-candidate', handleIceCandidate);
        };
    }, [permissionState, handleUserJoined, closePeerConnection, handleOffer, handleAnswer, handleIceCandidate]);
    
     // Effect to manage analysers
    useEffect(() => {
        if (!audioContextRef.current && Object.keys(peerStreams).length > 0) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        if (!audioContext) return;

        Object.entries(peerStreams).forEach(([socketId, stream]) => {
            if (!analyserNodesRef.current[socketId]) {
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 512;
                source.connect(analyser);
                analyserNodesRef.current[socketId] = { analyser, source };
            }
        });

    }, [peerStreams]);

    // Effect for speaking detection loop
    useEffect(() => {
        if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);

        speakingTimerRef.current = setInterval(() => {
            const newPeerStates = { ...peerStates };
            let didChange = false;

            Object.keys(analyserNodesRef.current).forEach((id) => {
                const { analyser } = analyserNodesRef.current[id];
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const isCurrentlySpeaking = volume > 20;

                const currentState = newPeerStates[id] || { volume: 1, isMuted: false, isSpeaking: false };
                if (currentState.isSpeaking !== isCurrentlySpeaking) {
                    newPeerStates[id] = { ...currentState, isSpeaking: isCurrentlySpeaking };
                    didChange = true;
                }
            });

            if (didChange) {
                setPeerStates(newPeerStates);
            }
        }, 200);

        return () => {
            if (speakingTimerRef.current) {
                clearInterval(speakingTimerRef.current);
                speakingTimerRef.current = null;
            }
        };
    }, [peerStates]); // Rerun if peerStates changes from external source

    // --- Control Functions ---
    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newMutedState = !prev;
            if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(track => {
                    track.enabled = !newMutedState;
                });
            }
            return newMutedState;
        });
    }, []);

    const setPeerVolume = useCallback((socketId: string, volume: number) => {
        setPeerStates(prev => ({
            ...prev,
            [socketId]: { ...(prev[socketId] || { volume: 1, isMuted: false, isSpeaking: false }), volume },
        }));
        if (audioElementsRef.current[socketId]) {
            audioElementsRef.current[socketId].volume = volume;
        }
    }, []);

    const togglePeerMute = useCallback((socketId: string) => {
        setPeerStates(prev => {
            const current = prev[socketId] || { volume: 1, isMuted: false, isSpeaking: false };
            const newMutedState = !current.isMuted;
            if (audioElementsRef.current[socketId]) {
                audioElementsRef.current[socketId].muted = newMutedState;
            }
            return {
                ...prev,
                [socketId]: { ...current, isMuted: newMutedState },
            };
        });
    }, []);

    const contextValue: VoiceContextType = {
        isMuted,
        peerStates,
        permissionState,
        toggleMute,
        setPeerVolume,
        togglePeerMute,
    };

    return (
        <VoiceContext.Provider value={contextValue}>
            {children}
            <div id="audio-container" style={{ display: 'none' }}>
                {Object.entries(peerStreams).map(([socketId, stream]) => (
                    <audio
                        key={socketId}
                        ref={audioEl => {
                            if (audioEl) {
                                audioElementsRef.current[socketId] = audioEl;
                                if (audioEl.srcObject !== stream) {
                                    audioEl.srcObject = stream;
                                }
                                const state = peerStates[socketId];
                                if (state) {
                                    audioEl.volume = state.volume;
                                    audioEl.muted = state.isMuted;
                                }
                            }
                        }}
                        autoPlay
                        playsInline
                    />
                ))}
            </div>
        </VoiceContext.Provider>
    );
};

// --- Custom Hook ---

export const useVoice = (): VoiceContextType => {
    const context = useContext(VoiceContext);
    if (!context) {
        throw new Error('useVoice must be used within a VoiceProvider');
    }
    return context;
};