import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode,
} from "react";
import {
    Room,
    RoomEvent,
    ConnectionState,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    Track,
    Participant,
} from "livekit-client";
import { useGame } from "./GameContext";
import { toast } from "sonner";
import api from "@/services/api";

interface PeerState {
    volume: number;
    isMuted: boolean;
    isSpeaking: boolean;
}

type VoiceConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

interface VoiceContextType {
    isMuted: boolean;
    isSelfSpeaking: boolean;
    isVoiceEnabled: boolean;
    connectionState: VoiceConnectionState;
    peerStates: { [userId: string]: PeerState };
    permissionState: "prompt" | "granted" | "denied";
    toggleMute: () => void;
    toggleVoiceChat: () => void;
    setPeerVolume: (userId: string, volume: number) => void;
    togglePeerMute: (userId: string) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

const defaultPeerState: PeerState = { volume: 1, isMuted: false, isSpeaking: false };

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { gameState } = useGame();

    const [isMuted, setIsMuted] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);
    const [connectionState, setConnectionState] = useState<VoiceConnectionState>("disconnected");
    const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
    const [peerStates, setPeerStates] = useState<{ [userId: string]: PeerState }>({});

    const roomRef = useRef<Room | null>(null);
    const audioContainerRef = useRef<HTMLDivElement | null>(null);
    // Latest volume/mute settings, applied to late-arriving participants.
    const peerStatesRef = useRef(peerStates);
    peerStatesRef.current = peerStates;

    const applyPeerAudio = useCallback((participant: RemoteParticipant) => {
        const state = peerStatesRef.current[participant.identity] ?? defaultPeerState;
        participant.setVolume(state.isMuted ? 0 : state.volume);
    }, []);

    // Connect/disconnect lifecycle.
    useEffect(() => {
        const roomCode = gameState.roomCode;
        if (!roomCode || !isVoiceEnabled) return;

        let cancelled = false;
        const room = new Room();
        roomRef.current = room;

        room
            .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
                if (state === ConnectionState.Connected) setConnectionState("connected");
                else if (state === ConnectionState.Reconnecting) setConnectionState("reconnecting");
                else if (state === ConnectionState.Connecting) setConnectionState("connecting");
                else setConnectionState("disconnected");
            })
            .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
                if (track.kind === Track.Kind.Audio) {
                    const el = track.attach();
                    audioContainerRef.current?.appendChild(el);
                    applyPeerAudio(participant);
                }
            })
            .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
                track.detach().forEach((el) => el.remove());
            })
            .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
                setPeerStates((prev) => {
                    if (!(participant.identity in prev)) return prev;
                    const next = { ...prev };
                    delete next[participant.identity];
                    return next;
                });
            })
            .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                const speakingIds = new Set(speakers.map((s) => s.identity));
                setIsSelfSpeaking(room.localParticipant ? speakingIds.has(room.localParticipant.identity) : false);
                setPeerStates((prev) => {
                    const next: { [userId: string]: PeerState } = { ...prev };
                    let changed = false;
                    room.remoteParticipants.forEach((p) => {
                        const cur = next[p.identity] ?? defaultPeerState;
                        const speaking = speakingIds.has(p.identity);
                        if (cur.isSpeaking !== speaking || !(p.identity in next)) {
                            next[p.identity] = { ...cur, isSpeaking: speaking };
                            changed = true;
                        }
                    });
                    return changed ? next : prev;
                });
            });

        const connect = async () => {
            setConnectionState("connecting");
            try {
                const { data } = await api.get(`/voice/token?roomCode=${encodeURIComponent(roomCode)}`);
                if (cancelled) return;
                await room.connect(data.url, data.token);
                if (cancelled) return;
                try {
                    await room.localParticipant.setMicrophoneEnabled(!isMuted);
                    setPermissionState("granted");
                } catch (err: any) {
                    if (err?.name === "NotAllowedError") {
                        setPermissionState("denied");
                    } else {
                        throw err;
                    }
                }
            } catch (err) {
                if (cancelled) return;
                console.error("[voice] Failed to join voice room:", err);
                setConnectionState("disconnected");
                toast.error("Voice chat unavailable", {
                    description: "Could not connect to the voice server. The game will continue without voice.",
                });
            }
        };
        connect();

        return () => {
            cancelled = true;
            roomRef.current = null;
            room.disconnect();
            setConnectionState("disconnected");
            setPeerStates({});
            setIsSelfSpeaking(false);
        };
        // isMuted intentionally excluded: mute toggles are applied imperatively below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.roomCode, isVoiceEnabled, applyPeerAudio]);

    // Reset permission state when leaving the room so the user can be prompted again.
    useEffect(() => {
        if (!gameState.roomCode) setPermissionState("prompt");
    }, [gameState.roomCode]);

    useEffect(() => {
        if (permissionState === "denied") {
            toast.error("Microphone access denied", {
                description:
                    "Voice chat will be disabled. Please grant microphone permissions in your browser settings and rejoin.",
            });
        }
    }, [permissionState]);

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            roomRef.current?.localParticipant.setMicrophoneEnabled(!next).catch((err) => {
                console.error("[voice] Failed to toggle microphone:", err);
            });
            return next;
        });
    }, []);

    const toggleVoiceChat = useCallback(() => {
        setIsVoiceEnabled((prev) => {
            if (prev) setPermissionState("prompt");
            return !prev;
        });
    }, []);

    const updatePeerState = useCallback(
        (userId: string, patch: Partial<PeerState>) => {
            setPeerStates((prev) => {
                const cur = prev[userId] ?? defaultPeerState;
                const nextState = { ...cur, ...patch };
                const room = roomRef.current;
                const participant = room?.remoteParticipants.get(userId);
                participant?.setVolume(nextState.isMuted ? 0 : nextState.volume);
                return { ...prev, [userId]: nextState };
            });
        },
        [],
    );

    const setPeerVolume = useCallback(
        (userId: string, volume: number) => updatePeerState(userId, { volume }),
        [updatePeerState],
    );

    const togglePeerMute = useCallback(
        (userId: string) => {
            setPeerStates((prev) => {
                const cur = prev[userId] ?? defaultPeerState;
                const nextState = { ...cur, isMuted: !cur.isMuted };
                roomRef.current?.remoteParticipants.get(userId)?.setVolume(nextState.isMuted ? 0 : nextState.volume);
                return { ...prev, [userId]: nextState };
            });
        },
        [],
    );

    const contextValue: VoiceContextType = {
        isMuted,
        isSelfSpeaking,
        isVoiceEnabled,
        connectionState,
        peerStates,
        permissionState,
        toggleMute,
        toggleVoiceChat,
        setPeerVolume,
        togglePeerMute,
    };

    return (
        <VoiceContext.Provider value={contextValue}>
            {children}
            <div ref={audioContainerRef} id="audio-container" style={{ display: "none" }} />
        </VoiceContext.Provider>
    );
};

export const useVoice = (): VoiceContextType => {
    const context = useContext(VoiceContext);
    if (!context) {
        throw new Error("useVoice must be used within a VoiceProvider");
    }
    return context;
};
