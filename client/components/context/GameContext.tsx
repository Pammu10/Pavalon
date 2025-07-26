

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { GameState, GamePhase, Player, Message, Role, User, LoginCredentials, RegisterCredentials, Achievement } from '@/types';
import { socketService } from '@/services/socketService';
import api from '@/services/api';
import { toast } from 'sonner';
import { useAudio } from './AudiContext';
import { useRouter } from 'next/navigation';

interface Settings {
    skipIntro: boolean;
    showTutorial: boolean;
}

interface GameContextType {
    gameState: GameState;
    playerId: string | null;
    error: string | null;
    messages: Message[];
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    authError: string | null;
    isLoading: boolean;
    isConnected: boolean;
    hasViewedRole: boolean;
    settings: Settings;
    achievementsVersion: number;
    hasViewedCurrentQuestResult: boolean;
    hasViewedEndGameResult: boolean;
    setHasViewedRole: React.Dispatch<React.SetStateAction<boolean>>;
    markQuestResultAsViewed: () => void;
    markEndGameAsViewed: () => void;
    updateSettings: (newSettings: Partial<Settings>) => void;
    updateUser: (data: Partial<User>) => void;
    updateUsername: (newUsername: string) => Promise<void>;
    login: (credentials: LoginCredentials, onSuccess?: () => void) => Promise<void>;
    register: (credentials: RegisterCredentials, onSuccess?: () => void) => Promise<void>;
    logout: () => void;
    joinRoom: (roomCode?: string) => void;
    leaveRoom: () => void;
    kickPlayer: (playerIdToKick: string) => void;
    // Pavalon
    startGame: (data: { selectedRoles: Role[] }) => void;
    selectTeam: (teamPlayerIds: string[]) => void;
    updatePendingTeam: (teamPlayerIds: string[]) => void;
    updateAssassinationTarget: (targetId: string | null) => void;
    voteOnTeam: (vote: 'APPROVE' | 'REJECT') => void;
    voteOnQuest: (vote: 'SUCCESS' | 'FAIL') => void;
    assassinate: (targetId: string) => void;
    playerReady: () => void;
    playerReadyForNextGame: () => void;
    initiateRestart: () => void;
    voteOnRestart: (vote: 'yes' | 'no') => void;
    // Shared
    sendMessage: (messageText: string) => void;
    // Dragon's Breath
    startDragonsBreath: () => void;
    drawCard: () => void;
    playCard: (cardId: string) => void;
    placeDragonCard: (index: number) => void;
    endFutureView: () => void;
    returnToLobby: () => void;
}

const initialGameState: GameState = {
    roomCode: null,
    players: [],
    phase: GamePhase.HOME,
    currentQuest: 1,
    questHistory: [],
    leader: null,
    voteTrack: 0,
    winner: null,
    endGameReason: '',
    chat: [],
    gameLog: [],
    readyPlayers: [],
    endGameReadyPlayers: [],
    reconnectingPlayer: null,
    restartVote: null,
    lastRestartInitiatedAt: null,
    pendingTeam: null,
    dragonsBreathState: null,
    assassinationTargetId: null,
};

const initialSettings: Settings = {
    skipIntro: false,
    showTutorial: true,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasViewedRole, setHasViewedRole] = useState(false);
    const [viewedSessionKeys, setViewedSessionKeys] = useState<Set<string>>(new Set());
    const [settings, setSettings] = useState<Settings>(initialSettings);
    const [achievementsVersion, setAchievementsVersion] = useState(0);

    const { playSound } = useAudio();

    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isConnected, setIsConnected] = useState<boolean>(false);

    const prevRoomCode = useRef(gameState.roomCode);

    useEffect(() => {
        if (gameState.roomCode && gameState.roomCode !== prevRoomCode.current) {
            router.push(`/game/${gameState.roomCode}`);
        } else if (!gameState.roomCode && prevRoomCode.current) {
            router.push('/');
        }
        prevRoomCode.current = gameState.roomCode;
    }, [gameState.roomCode, router]);

    const autoClearError = useCallback((setter: React.Dispatch<React.SetStateAction<string | null>>, message: string) => {
      setter(message);
      playSound('error', { manageBgm: false });
      setTimeout(() => setter(null), 5000);
    }, [playSound]);
    
    // --- Session Storage Management for Overlays ---
    const markQuestResultAsViewed = useCallback(() => {
        if (gameState.roomCode && gameState.phase === GamePhase.QUEST_RESULT) {
            const key = `viewedQuest-${gameState.roomCode}-${gameState.currentQuest}`;
            sessionStorage.setItem(key, 'true');
            setViewedSessionKeys(prev => new Set(prev).add(key));
        }
    }, [gameState.roomCode, gameState.currentQuest, gameState.phase]);

    const markEndGameAsViewed = useCallback(() => {
        if (gameState.roomCode && gameState.phase === GamePhase.END_GAME) {
            const key = `viewedEndGame-${gameState.roomCode}`;
            sessionStorage.setItem(key, 'true');
            setViewedSessionKeys(prev => new Set(prev).add(key));
        }
    }, [gameState.roomCode, gameState.phase]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const keys = new Set<string>();
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && (key.startsWith('viewedQuest-') || key.startsWith('viewedEndGame-'))) {
                    keys.add(key);
                }
            }
            setViewedSessionKeys(keys);
        }
    }, []);
    
    // --- Settings Management ---
    useEffect(() => {
        try {
            const storedSettings = localStorage.getItem('pavalonSettings');
            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);
                // Ensure all keys from initialSettings are present
                setSettings({ ...initialSettings, ...parsedSettings });
            }
        } catch (e) {
            console.error("Failed to parse settings from localStorage", e);
        }
    }, []);

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('pavalonSettings', JSON.stringify(updated));
            return updated;
        });
    };
    
    const updateUser = (data: Partial<User>) => {
        setUser(prev => {
            if (!prev) return null;
            const newUser = { ...prev, ...data };
            localStorage.setItem('user', JSON.stringify(newUser));
            return newUser;
        });
    };

    // --- Auth Management ---
    useEffect(() => {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(parsedUser);
                setIsAuthenticated(true);
                api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            } catch (e) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
            }
        }
        setIsLoading(false);
    }, []);

    // Effect to manage socket connection based on auth state
    useEffect(() => {
        if (token && isAuthenticated) {
            socketService.connect(token);
        } else {
            socketService.disconnect();
        }
        
        return () => {
            socketService.disconnect();
        }
    }, [token, isAuthenticated]);

    // Effect for socket connection status
    useEffect(() => {
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        setIsConnected(socketService.socket.connected);

        socketService.socket.on('connect', onConnect);
        socketService.socket.on('disconnect', onDisconnect);

        return () => {
            socketService.socket.off('connect', onConnect);
            socketService.socket.off('disconnect', onDisconnect);
        };
    }, []);
    
    // --- Socket Event Handlers (wrapped in useCallback) ---
    const handleUpdate = useCallback((newState: GameState) => {
        setGameState(prevState => {
            // --- Sound Effect Logic ---
            if (newState.phase === GamePhase.LOBBY && prevState.phase === GamePhase.HOME) {
                playSound('transition');
            }

            // --- State Cleanup Logic ---
            const isNewGameStarting = (prevState.phase === GamePhase.END_GAME && newState.phase === GamePhase.LOBBY) || 
                                      (prevState.phase === GamePhase.LOBBY && newState.phase === GamePhase.ROLE_REVEAL);
            if (isNewGameStarting) {
                setHasViewedRole(false);
                // Clean up session state for the new game
                if (prevState.roomCode) {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && key.startsWith('viewed') && key.includes(prevState.roomCode)) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => sessionStorage.removeItem(key));
                }
                setViewedSessionKeys(new Set());
            }
            return newState;
        });
        setMessages(newState.chat || []);
    }, [playSound]);

    const handleChatMessage = useCallback((message: Message) => {
        setMessages(prev => [...prev, message]);
    }, []);

    const handleError = useCallback((message: string) => {
        autoClearError(setError, message);
        toast.error(message);
    }, [autoClearError]);

    const handleAchievementUnlocked = useCallback((achievement: Achievement) => {
        playSound('success', { manageBgm: false });
        toast.success(`Achievement Unlocked: ${achievement.name}`, {
            description: `You've earned: ${achievement.rewards.map(r => r.name).join(', ')}`,
            duration: 8000,
        });
        setAchievementsVersion(v => v + 1);
    }, [playSound]);

    const handleKicked = useCallback((reason: string) => {
        toast.error(reason, {
            description: "You have been removed from the game."
        });
        setGameState(initialGameState); // This will trigger the useEffect to redirect to '/'
        setMessages([]);
        setHasViewedRole(false);
    }, []);

    const logout = useCallback(() => {
        if (gameState.roomCode && socketService.socket.connected) {
            socketService.emit('leaveRoom');
        }
        socketService.disconnect();
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setGameState(initialGameState);
        setHasViewedRole(false);
        setViewedSessionKeys(new Set());
        router.push('/');
    }, [gameState.roomCode, router]);

    // --- Socket Listener `useEffect` ---
    useEffect(() => {
        socketService.on('updateGameState', handleUpdate);
        socketService.on('chatMessage', handleChatMessage);
        socketService.on('error', handleError);
        socketService.on('achievementUnlocked', handleAchievementUnlocked);
        socketService.on('kicked', handleKicked);

        return () => {
            socketService.off('updateGameState', handleUpdate);
            socketService.off('chatMessage', handleChatMessage);
            socketService.off('error', handleError);
            socketService.off('achievementUnlocked', handleAchievementUnlocked);
            socketService.off('kicked', handleKicked);
        };
    }, [handleUpdate, handleChatMessage, handleError, handleAchievementUnlocked, handleKicked]);

    // This effect handles authentication failures on connection
    useEffect(() => {
        const handleConnectError = (err: Error) => {
             // Only handle this if the user was supposed to be authenticated.
            // This prevents firing the toast on the login screen if the server is down.
            if (isAuthenticated) {
                console.error("Socket connection error:", err.message);
                if (err.message.includes("Authentication error")) {
                    toast.error("Your session is invalid or has expired.", {
                        description: "You have been logged out. Please log in again."
                    });
                    logout(); 
                } else {
                    // Generic connection error for an authenticated user trying to connect
                    toast.error("Could not connect to the game server.", {
                        description: "Please check your internet connection and try again."
                    });
                }
            }
        };

        socketService.socket.on('connect_error', handleConnectError);

        return () => {
            socketService.socket.off('connect_error', handleConnectError);
        };
    }, [isAuthenticated, logout]);

     useEffect(() => {
        const onConnect = () => setPlayerId(socketService.socket.id!);
        setPlayerId(socketService.socket.id ?? null);
        socketService.socket.on('connect', onConnect);
        return () => {
          socketService.socket.off('connect', onConnect);
        }
    }, [])

    const login = async (credentials: LoginCredentials, onSuccess?: () => void) => {
        try {
            setAuthError(null);
            const { data } = await api.post('/login', credentials);
            const { token: new_token, user: new_user } = data;
            localStorage.setItem('authToken', new_token);
            localStorage.setItem('user', JSON.stringify(new_user));
            api.defaults.headers.common['Authorization'] = `Bearer ${new_token}`;
            setToken(new_token);
            setUser(new_user);
            setIsAuthenticated(true);
            onSuccess?.();
        } catch (err: any) {
            const message = err.response?.data?.message || 'Login failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
        }
    };

    const register = async (credentials: RegisterCredentials, onSuccess?: () => void) => {
        try {
            setAuthError(null);
            const { data } = await api.post('/register', credentials);
            const { token: new_token, user: new_user } = data;
            localStorage.setItem('authToken', new_token);
            localStorage.setItem('user', JSON.stringify(new_user));
            api.defaults.headers.common['Authorization'] = `Bearer ${new_token}`;
            setToken(new_token);
            setUser(new_user);
            setIsAuthenticated(true);
            onSuccess?.();
        } catch (err: any) {
            const message = err.response?.data?.message || 'Registration failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
        }
    };

    const updateUsername = async (newUsername: string) => {
        try {
            setAuthError(null);
            const { data } = await api.post('/user/username', { username: newUsername });
            const { token: newToken, user: newUser } = data;
            localStorage.setItem('authToken', newToken);
            localStorage.setItem('user', JSON.stringify(newUser));
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            setToken(newToken);
            setUser(newUser);
            toast.success("Username updated successfully!");
            if (socketService.socket.connected) {
                socketService.disconnect();
                socketService.connect(newToken);
            }
        } catch (err: any) {
            const message = err.response?.data?.message || 'Username update failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
            throw new Error(message);
        }
    };

    const joinRoom = (roomCode?: string) => {
        if (!isAuthenticated || !token) {
            const message = 'You must be logged in to join a room.';
            autoClearError(setError, message);
            toast.error(message);
            router.push(`/join/${roomCode}`);
            return
        };
        socketService.emit('joinRoom', { roomCode });
    };

    const leaveRoom = useCallback(() => {
        socketService.emit('leaveRoom');
        // The server will handle the state change and push an update with a null roomCode,
        // which will trigger the useEffect to redirect to home.
    }, []);
    
    // --- Emitting Functions ---
    const kickPlayer = (playerIdToKick: string) => socketService.emit('kickPlayer', playerIdToKick);
    const sendMessage = (messageText: string) => socketService.emit('sendMessage', messageText);
    const startGame = (data: { selectedRoles: Role[] }) => {
        setHasViewedRole(false);
        socketService.emit('startGame', data);
    }
    const selectTeam = (teamPlayerIds: string[]) => socketService.emit('selectTeam', teamPlayerIds);
    const updatePendingTeam = (teamPlayerIds: string[]) => socketService.emit('updatePendingTeam', teamPlayerIds);
    const updateAssassinationTarget = (targetId: string | null) => socketService.emit('updateAssassinationTarget', targetId);
    const voteOnTeam = (vote: 'APPROVE' | 'REJECT') => socketService.emit('voteOnTeam', vote);
    const voteOnQuest = (vote: 'SUCCESS' | 'FAIL') => socketService.emit('voteOnQuest', vote);
    const assassinate = (targetId: string) => socketService.emit('assassinate', targetId);
    const playerReady = () => socketService.emit('playerReady');
    const playerReadyForNextGame = () => socketService.emit('playerReadyForNextGame');
    const initiateRestart = () => socketService.emit('initiateRestart');
    const voteOnRestart = (vote: 'yes' | 'no') => socketService.emit('voteOnRestart', vote);
    // Dragon's Breath Emitters
    const startDragonsBreath = () => socketService.emit('startDragonsBreath');
    const drawCard = () => socketService.emit('drawCard');
    const playCard = (cardId: string) => socketService.emit('playCard', cardId);
    const placeDragonCard = (index: number) => socketService.emit('placeDragonCard', index);
    const endFutureView = () => socketService.emit('endFutureView');
    const returnToLobby = () => socketService.emit('returnToLobby');


    const hasViewedCurrentQuestResult = viewedSessionKeys.has(`viewedQuest-${gameState.roomCode}-${gameState.currentQuest}`);
    const hasViewedEndGameResult = viewedSessionKeys.has(`viewedEndGame-${gameState.roomCode}`);

    const value: GameContextType = {
        gameState,
        playerId,
        error,
        messages,
        user,
        token,
        isAuthenticated,
        authError,
        isLoading,
        isConnected,
        hasViewedRole,
        settings,
        achievementsVersion,
        hasViewedCurrentQuestResult,
        hasViewedEndGameResult,
        setHasViewedRole,
        markQuestResultAsViewed,
        markEndGameAsViewed,
        updateSettings,
        updateUser,
        updateUsername,
        login,
        register,
        logout,
        joinRoom,
        leaveRoom,
        kickPlayer,
        startGame,
        selectTeam,
        updatePendingTeam,
        updateAssassinationTarget,
        voteOnTeam,
        voteOnQuest,
        assassinate,
        playerReady,
        playerReadyForNextGame,
        sendMessage,
        initiateRestart,
        voteOnRestart,
        startDragonsBreath,
        drawCard,
        playCard,
        placeDragonCard,
        endFutureView,
        returnToLobby,
    };

    return (
        <GameContext.Provider value={value}>
            {children}
            {error && (
                <div className="animate-fadeIn fixed bottom-5 left-5 z-[100] bg-red-800/80 backdrop-blur-md text-white font-bold py-3 px-6 rounded-lg shadow-2xl border-2 border-red-600">
                    Error: {error}
                </div>
            )}
        </GameContext.Provider>
    );
};

export const useGame = (): GameContextType => {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
