import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useGame } from "./GameContext";
import { socketService } from "@/services/socketService";
import { toast } from "sonner";
import { useAudio } from "./AudioContext";
import api from "@/services/api";

// --- Types ---

interface PeerState {
  volume: number;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface VoiceContextType {
  isMuted: boolean;
  isSelfSpeaking: boolean;
  micMonitoring: boolean;
  isVoiceEnabled: boolean;
  peerStates: { [socketId: string]: PeerState };
  permissionState: "prompt" | "granted" | "denied";
  toggleMute: () => void;
  toggleMicMonitoring: () => void;
  toggleVoiceChat: () => void;
  setPeerVolume: (socketId: string, volume: number) => void;
  togglePeerMute: (socketId: string) => void;
}

// --- Context Definition ---

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

// --- Helper Component for Audio Playback ---

interface AudioPlayerProps {
  stream: MediaStream;
  socketId: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ stream, socketId }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { peerStates } = useVoice();
  const state = peerStates[socketId] || {
    volume: 1,
    isMuted: false,
    isSpeaking: false,
  };

  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && stream) {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      // The play() promise-based approach is more robust
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error(`Error playing audio for ${socketId}:`, error);
          if (error.name === "NotAllowedError") {
            toast.error("Could not play audio", {
              description:
                "Browser blocked automatic playback. Click anywhere to activate audio.",
            });
          }
        });
      }
    }
  }, [stream, socketId]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.volume = state.volume;
      audioEl.muted = state.isMuted;
    }
  }, [state.volume, state.isMuted]);

  return <audio ref={audioRef} playsInline />;
};

// --- Provider Component ---

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { gameState, playerId } = useGame();
  const { setBgmDucked } = useAudio();

  // --- State and Refs ---
  const [permissionState, setPermissionState] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);
  const [micMonitoring, setMicMonitoring] = useState(false);
  const [peerStates, setPeerStates] = useState<{
    [socketId: string]: PeerState;
  }>({});
  const [peerStreams, setPeerStreams] = useState<{
    [socketId: string]: MediaStream;
  }>({});

  const iceServersRef = useRef<RTCIceServer[] | null>(null);

  // Refactored stream management
  const localStreamRef = useRef<MediaStream | null>(null); // Raw mic input
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(
    null
  );
  const localGainRef = useRef<GainNode | null>(null); // Gain node for muting

  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>(
    {}
  );
  const queuedOffersRef = useRef<
    { fromId: string; sdp: RTCSessionDescriptionInit }[]
  >([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<{
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
  } | null>(null);
  const loopbackNodesRef = useRef<{
    source: MediaStreamAudioSourceNode;
    gain: GainNode;
  } | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserNodesRef = useRef<{
    [socketId: string]: {
      analyser: AnalyserNode;
      source: MediaStreamAudioSourceNode;
    };
  }>({});

  // --- Core WebRTC Functions ---

  const closePeerConnection = useCallback(
    (socketIdOrData: string | { socketId: string }) => {
      const socketId =
        typeof socketIdOrData === "string"
          ? socketIdOrData
          : socketIdOrData.socketId;
      console.log(`[voice] Closing connection for peer: ${socketId}`);

      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
      if (analyserNodesRef.current[socketId]) {
        analyserNodesRef.current[socketId].source.disconnect();
        delete analyserNodesRef.current[socketId];
      }

      setPeerStreams((prev) => {
        const newStreams = { ...prev };
        delete newStreams[socketId];
        return newStreams;
      });

      setPeerStates((prev) => {
        const newStates = { ...prev };
        delete newStates[socketId];
        return newStates;
      });
    },
    []
  );

  const createPeerConnection = useCallback(
    (targetSocketId: string) => {
      if (peerConnectionsRef.current[targetSocketId]) {
        console.log(
          `[voice] Peer connection for ${targetSocketId} already exists.`
        );
        return peerConnectionsRef.current[targetSocketId];
      }

      console.log(`[voice] Creating new peer connection for ${targetSocketId}`);
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current ?? [],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.emit("voice:ice-candidate", {
            targetId: targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log(`[voice] Received track from ${targetSocketId}`);
        if (event.streams && event.streams[0]) {
          setPeerStreams((prev) => ({
            ...prev,
            [targetSocketId]: event.streams[0],
          }));
        }
      };

      // Add more detailed logging
      pc.onconnectionstatechange = () => {
        console.log(
          `[voice] Peer ${targetSocketId} connection state: ${pc.connectionState}`
        );
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          closePeerConnection(targetSocketId);
        }
      };

      pc.onsignalingstatechange = () => {
        console.log(
          `[voice] Peer ${targetSocketId} signaling state: ${pc.signalingState}`
        );
      };

      pc.onicegatheringstatechange = () => {
        console.log(
          `[voice] Peer ${targetSocketId} ICE gathering state: ${pc.iceGatheringState}`
        );
      };

      pc.onnegotiationneeded = async () => {
        // Only the "senior" peer (lexicographically larger ID) initiates the offer to prevent glare.
        if (playerId && playerId > targetSocketId) {
          console.log(
            `[voice] Negotiation needed for ${targetSocketId}. Creating offer.`
          );
          try {
            // Double check signaling state to avoid race conditions.
            if (pc.signalingState === "stable") {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              if (pc.localDescription) {
                socketService.emit("voice:offer", {
                  targetId: targetSocketId,
                  sdp: pc.localDescription,
                });
              }
            }
          } catch (err) {
            console.error(
              `[voice] Error during onnegotiationneeded for ${targetSocketId}:`,
              err
            );
          }
        }
      };

      peerConnectionsRef.current[targetSocketId] = pc;
      return pc;
    },
    [closePeerConnection, playerId]
  );

  // --- Signaling Event Handlers ---

  const processOffer = useCallback(
    async (fromId: string, sdp: RTCSessionDescriptionInit) => {
      console.log(`[voice] Processing offer from ${fromId}`);
      const pc = createPeerConnection(fromId);
      if (pc.signalingState !== "stable") {
        console.warn(
          `[voice] Cannot process offer from ${fromId}, signaling state is ${pc.signalingState}. This can happen in a glare situation.`
        );
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Add local tracks (from the processed stream) to the connection BEFORE creating the answer
      if (processedStream) {
        processedStream.getTracks().forEach((track) => {
          if (!pc.getSenders().find((sender) => sender.track === track)) {
            pc.addTrack(track, processedStream);
          }
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (pc.localDescription) {
        socketService.emit("voice:answer", {
          targetId: fromId,
          sdp: pc.localDescription,
        });
      }
    },
    [createPeerConnection, processedStream]
  );

  const handleOffer = useCallback(
    async ({
      fromId,
      sdp,
    }: {
      fromId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (processedStream) {
        await processOffer(fromId, sdp);
      } else {
        console.log(
          `[voice] Queuing offer from ${fromId} as local stream is not ready.`
        );
        queuedOffersRef.current.push({ fromId, sdp });
      }
    },
    [processOffer, processedStream]
  );

  const handleAnswer = useCallback(
    async ({
      fromId,
      sdp,
    }: {
      fromId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionsRef.current[fromId];
      if (pc) {
        console.log(
          `[voice] Received answer from ${fromId}, signaling state: ${pc.signalingState}`
        );
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    },
    []
  );

  const handleIceCandidate = useCallback(
    async ({
      fromId,
      candidate,
    }: {
      fromId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionsRef.current[fromId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[voice] Error adding received ice candidate", e);
        }
      }
    },
    []
  );

  // --- Microphone & Main Setup ---

  const startVoiceChat = useCallback(async () => {
    if (localStreamRef.current) return;

    if (!iceServersRef.current) {
      try {
        const { data } = await api.get("/webrtc/ice-servers");
        iceServersRef.current = data.iceServers;
        console.log(
          "[voice] Fetched ICE servers from backend, including TURN if available."
        );
      } catch (error) {
        console.error(
          "[voice] Failed to fetch ICE servers, falling back to default STUN.",
          error
        );
        toast.error("Voice chat connection may be less reliable.", {
          description: "Could not retrieve optimal server configuration.",
        });
        // Fallback to a minimal set of public STUN servers
        iceServersRef.current = [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun.services.mozilla.com" },
          { urls: "stun:stun.stunprotocol.org:3478" },
          { urls: "stun:stun.nextcloud.com:443" },
          { urls: "stun:global.stun.twilio.com:3478" },
          { urls: "stun:stun.xten.com" },
          { urls: "stun:stun.voip.blackberry.com:3478" },
          { urls: "stun:stun.counterpath.net:3478" },
        ];
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;

      // --- New Audio Graph for Muting ---
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext.currentTime);
      localGainRef.current = gainNode;

      const destination = audioContext.createMediaStreamDestination();
      source.connect(gainNode).connect(destination);
      setProcessedStream(destination.stream);
      // --- End New Audio Graph ---

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser); // Connect analyser to original source for accurate speaking detection
      localAnalyserRef.current = { analyser, source };

      setPermissionState("granted");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setPermissionState("denied");
    }
  }, [isMuted]);

  const stopVoiceChat = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (processedStream) {
      processedStream.getTracks().forEach((track) => track.stop());
    }
    setProcessedStream(null);

    if (localGainRef.current) {
      localGainRef.current.disconnect();
      localGainRef.current = null;
    }
    if (localAnalyserRef.current) {
      localAnalyserRef.current.source.disconnect();
      localAnalyserRef.current = null;
    }
    if (loopbackNodesRef.current) {
      loopbackNodesRef.current.source.disconnect();
      loopbackNodesRef.current = null;
    }

    Object.keys(peerConnectionsRef.current).forEach((id) =>
      closePeerConnection({ socketId: id })
    );
    peerConnectionsRef.current = {};
    setPeerStreams({});
    setPeerStates({});
    setIsSelfSpeaking(false);
    queuedOffersRef.current = [];
    iceServersRef.current = null; // Clear cached servers
  }, [closePeerConnection, processedStream]);

  // --- Effects ---

  // NEW: Logic to determine if anyone is speaking
  const isAnyoneSpeaking =
    isSelfSpeaking || Object.values(peerStates).some((p) => p.isSpeaking);

  // NEW: Effect to control audio ducking
  useEffect(() => {
    setBgmDucked(isAnyoneSpeaking);
  }, [isAnyoneSpeaking, setBgmDucked]);

  useEffect(() => {
    if (!gameState.roomCode) return;

    console.log("[voice] Attaching signaling listeners.");
    socketService.on("voice:user-left", closePeerConnection);
    socketService.on("voice:offer", handleOffer);
    socketService.on("voice:answer", handleAnswer);
    socketService.on("voice:ice-candidate", handleIceCandidate);

    return () => {
      console.log("[voice] Detaching signaling listeners.");
      socketService.off("voice:user-left", closePeerConnection);
      socketService.off("voice:offer", handleOffer);
      socketService.off("voice:answer", handleAnswer);
      socketService.off("voice:ice-candidate", handleIceCandidate);
    };
  }, [
    gameState.roomCode,
    closePeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  ]);

  // This effect now correctly handles starting/stopping voice based on room, permission, and the master toggle
  useEffect(() => {
    if (gameState.roomCode && isVoiceEnabled) {
      if (permissionState !== "denied") {
        startVoiceChat();
      }
    } else {
      stopVoiceChat();
    }
  }, [
    gameState.roomCode,
    startVoiceChat,
    stopVoiceChat,
    permissionState,
    isVoiceEnabled,
  ]);

  // This effect shows the permission denied toast only once when the state changes to denied.
  useEffect(() => {
    if (permissionState === "denied") {
      toast.error("Microphone access denied", {
        description:
          "Voice chat will be disabled. Please grant microphone permissions in your browser settings and rejoin.",
      });
    }
  }, [permissionState]);

  // This effect resets the permission state when the user leaves a room, allowing them to be prompted again.
  useEffect(() => {
    if (!gameState.roomCode) {
      setPermissionState("prompt");
    }
  }, [gameState.roomCode]);

  // NEW Effect to process queued offers once the stream is ready.
  useEffect(() => {
    if (processedStream && queuedOffersRef.current.length > 0) {
      console.log(
        `[voice] Processing ${queuedOffersRef.current.length} queued offers.`
      );
      const offersToProcess = [...queuedOffersRef.current];
      queuedOffersRef.current = []; // Clear queue immediately
      offersToProcess.forEach((offer) => {
        processOffer(offer.fromId, offer.sdp);
      });
    }
  }, [processedStream, processOffer]);

  // This effect now correctly depends on `processedStream` state.
  useEffect(() => {
    if (!processedStream || !playerId || permissionState !== "granted") {
      return;
    }

    const otherPlayers = gameState.players.filter(
      (p) => p.id !== playerId && p.status === "CONNECTED"
    );

    for (const player of otherPlayers) {
      const existingConnection = peerConnectionsRef.current[player.id];
      if (!existingConnection) {
        console.log(
          `[voice] Found new player ${player.name} (${player.id}). Creating connection.`
        );
        const pc = createPeerConnection(player.id);
        processedStream.getTracks().forEach((track) => {
          pc.addTrack(track, processedStream);
        });
      }
    }
  }, [
    processedStream,
    gameState.players,
    playerId,
    permissionState,
    createPeerConnection,
  ]);

  // Effect to manage peer analysers
  useEffect(() => {
    if (!audioContextRef.current && Object.keys(peerStreams).length > 0) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
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

  // Effect for mic monitoring (self-hearing)
  useEffect(() => {
    if (permissionState !== "granted" || !localStreamRef.current) {
      if (loopbackNodesRef.current) {
        loopbackNodesRef.current.source.disconnect();
        loopbackNodesRef.current = null;
      }
      return;
    }
    if (!audioContextRef.current) return;
    const audioContext = audioContextRef.current;

    if (micMonitoring) {
      if (!loopbackNodesRef.current) {
        const source = audioContext.createMediaStreamSource(
          localStreamRef.current
        );
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0.7, audioContext.currentTime);
        source.connect(gain);
        gain.connect(audioContext.destination);
        loopbackNodesRef.current = { source, gain };
        console.log("[voice] Mic monitoring enabled.");
      } else {
        loopbackNodesRef.current.gain.gain.setValueAtTime(
          0.7,
          audioContext.currentTime
        );
      }
    } else {
      if (loopbackNodesRef.current) {
        loopbackNodesRef.current.gain.gain.setValueAtTime(
          0,
          audioContext.currentTime
        );
        console.log("[voice] Mic monitoring disabled.");
      }
    }
  }, [micMonitoring, permissionState]);

  // Effect for speaking detection loop
  useEffect(() => {
    if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);

    speakingTimerRef.current = setInterval(() => {
      // Update peer speaking states
      setPeerStates((currentPeerStates) => {
        const newPeerStates = { ...currentPeerStates };
        let didChange = false;
        Object.keys(analyserNodesRef.current).forEach((id) => {
          const { analyser } = analyserNodesRef.current[id];
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const volume =
            dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const isCurrentlySpeaking = volume > 20;

          const currentState = newPeerStates[id] || {
            volume: 1,
            isMuted: false,
            isSpeaking: false,
          };
          if (currentState.isSpeaking !== isCurrentlySpeaking) {
            newPeerStates[id] = {
              ...currentState,
              isSpeaking: isCurrentlySpeaking,
            };
            didChange = true;
          }
        });
        return didChange ? newPeerStates : currentPeerStates;
      });

      // Update local speaking state
      if (localAnalyserRef.current) {
        const { analyser } = localAnalyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isCurrentlySpeaking = volume > 10;

        setIsSelfSpeaking(isCurrentlySpeaking && !isMuted);
      }
    }, 200);

    return () => {
      if (speakingTimerRef.current) {
        clearInterval(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    };
  }, [isMuted]);

  // --- Control Functions ---
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMutedState = !prev;
      if (localGainRef.current && audioContextRef.current) {
        const gainValue = newMutedState ? 0 : 1;
        localGainRef.current.gain.setValueAtTime(
          gainValue,
          audioContextRef.current.currentTime
        );
        console.log(`[voice] Mic gain set to ${gainValue}`);
      }
      return newMutedState;
    });
  }, []);

  const toggleMicMonitoring = useCallback(() => {
    setMicMonitoring((prev) => !prev);
  }, []);

  const toggleVoiceChat = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      if (prev) {
        // if turning off
        setPermissionState("prompt");
      }
      return !prev;
    });
  }, []);

  const setPeerVolume = useCallback((socketId: string, volume: number) => {
    setPeerStates((prev) => ({
      ...prev,
      [socketId]: {
        ...(prev[socketId] || { volume: 1, isMuted: false, isSpeaking: false }),
        volume,
      },
    }));
  }, []);

  const togglePeerMute = useCallback((socketId: string) => {
    setPeerStates((prev) => {
      const current = prev[socketId] || {
        volume: 1,
        isMuted: false,
        isSpeaking: false,
      };
      return {
        ...prev,
        [socketId]: { ...current, isMuted: !current.isMuted },
      };
    });
  }, []);

  const contextValue: VoiceContextType = {
    isMuted,
    isSelfSpeaking,
    micMonitoring,
    isVoiceEnabled,
    peerStates,
    permissionState,
    toggleMute,
    toggleMicMonitoring,
    toggleVoiceChat,
    setPeerVolume,
    togglePeerMute,
  };

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
      <div id="audio-container" style={{ display: "none" }}>
        {Object.entries(peerStreams).map(([socketId, stream]) => (
          <AudioPlayer key={socketId} socketId={socketId} stream={stream} />
        ))}
      </div>
    </VoiceContext.Provider>
  );
};

// --- Custom Hook ---

export const useVoice = (): VoiceContextType => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return context;
};
