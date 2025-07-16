
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { GameState, GamePhase, Player, Message, Role, User, LoginCredentials, RegisterCredentials, Achievement } from '@/types';
import { socketService } from '@/services/socketService';
import api from '@/services/api';
import { toast } from 'sonner';
import { useAudio } from './AudiContext';

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
    hasViewedRole: boolean;
    hasViewedEndGame: boolean;
    settings: Settings;
    achievementsVersion: number;
    setHasViewedRole: React.Dispatch<React.SetStateAction<boolean>>;
    setHasViewedEndGame: React.Dispatch<React.SetStateAction<boolean>>;
    updateSettings: (newSettings: Partial<Settings>) => void;
    updateUser: (data: Partial<User>) => void;
    updateUsername: (newUsername: string) => Promise<void>;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<void>;
    logout: () => void;
    joinRoom: (roomCode?: string) => void;
    leaveRoom: () => void;
    kickPlayer: (playerIdToKick: string) => void;
    startGame: (data: { selectedRoles: Role[] }) => void;
    selectTeam: (teamPlayerIds: string[]) => void;
    updatePendingTeam: (teamPlayerIds: string[]) => void;
    voteOnTeam: (vote: 'APPROVE' | 'REJECT') => void;
    voteOnQuest: (vote: 'SUCCESS' | 'FAIL') => void;
    assassinate: (targetId: string) => void;
    sendMessage: (messageText: string) => void;
    playerReady: () => void;
    playerReadyForNextGame: () => void;
    initiateRestart: () => void;
    voteOnRestart: (vote: 'yes' | 'no') => void;
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
};

const initialSettings: Settings = {
    skipIntro: false,
    showTutorial: true,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasViewedRole, setHasViewedRole] = useState(false);
    const [hasViewedEndGame, setHasViewedEndGame] = useState(false);
    const [settings, setSettings] = useState<Settings>(initialSettings);
    const [achievementsVersion, setAchievementsVersion] = useState(0);

    const { playSound } = useAudio();

    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const autoClearError = (setter: React.Dispatch<React.SetStateAction<string | null>>, message: string) => {
      setter(message);
      playSound('error', { manageBgm: false });
      setTimeout(() => setter(null), 5000);
    }
    
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
    
    // --- Socket Event Listeners ---
    useEffect(() => {
        const handleUpdate = (newState: GameState) => {
            setGameState(prevState => {
                const isNewGameStarting = (prevState.phase === GamePhase.END_GAME && newState.phase === GamePhase.LOBBY) || 
                                          (prevState.phase === GamePhase.LOBBY && newState.phase === GamePhase.ROLE_REVEAL);
                if (isNewGameStarting) {
                    setHasViewedRole(false);
                    setHasViewedEndGame(false);
                }
                return newState;
            });
            setMessages(newState.chat || []);
        };
        
        const handleChatMessage = (message: Message) => {
            setMessages(prev => [...prev, message]);
        };

        const handleError = (message: string) => {
            autoClearError(setError, message);
            toast.error(message);
        };

        const handleAchievementUnlocked = (achievement: Achievement) => {
            playSound('success', { manageBgm: false });
            toast.success(`Achievement Unlocked: ${achievement.name}`, {
                description: `You've earned: ${achievement.rewards.map(r => r.name).join(', ')}`,
                duration: 8000,
            });
            setAchievementsVersion(v => v + 1);
        };

        const handleKicked = (reason: string) => {
            toast.error(reason, {
                description: "You have been removed from the game."
            });
            setGameState(initialGameState);
            setMessages([]);
            setHasViewedRole(false);
            setHasViewedEndGame(false);
        };

        socketService.on('updateGameState', handleUpdate);
        socketService.on('chatMessage', handleChatMessage);
        socketService.on('error', handleError);
        socketService.on('achievementUnlocked', handleAchievementUnlocked);
        socketService.on('kicked', handleKicked);


        return () => {
            socketService.off('updateGameState');
            socketService.off('chatMessage');
            socketService.off('error');
            socketService.off('achievementUnlocked');
            socketService.off('kicked');
        };
    }, [playSound]);

     useEffect(() => {
        const onConnect = () => setPlayerId(socketService.socket.id!);
        setPlayerId(socketService.socket.id ?? null);
        socketService.socket.on('connect', onConnect);
        return () => {
          socketService.socket.off('connect', onConnect);
        }
    }, [])

    const login = async (credentials: LoginCredentials) => {
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
        } catch (err: any) {
            const message = err.response?.data?.message || 'Login failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
        }
    };

    const register = async (credentials: RegisterCredentials) => {
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
        } catch (err: any) {
            const message = err.response?.data?.message || 'Registration failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
        }
    };

    const logout = () => {
        // If connected to a room, tell server we're leaving gracefully
        if (gameState.roomCode && socketService.socket.connected) {
            socketService.emit('leaveRoom');
        }
        
        // Disconnect the socket connection entirely
        socketService.disconnect();

        // Then clear all local data
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setGameState(initialGameState);
        setHasViewedRole(false);
        setHasViewedEndGame(false);
    };

    const updateUsername = async (newUsername: string) => {
        try {
            setAuthError(null);
            const { data } = await api.post('/user/username', { username: newUsername });
            const { token: newToken, user: newUser } = data;
            
            // Update local state and storage
            localStorage.setItem('authToken', newToken);
            localStorage.setItem('user', JSON.stringify(newUser));
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            setToken(newToken);
            setUser(newUser);
            
            toast.success("Username updated successfully!");
            
            // Reconnect with new token to ensure server-side socket has updated user info
            if (socketService.socket.connected) {
                socketService.disconnect();
                socketService.connect(newToken);
            }
    
        } catch (err: any) {
            const message = err.response?.data?.message || 'Username update failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
            // Throw to signal failure to the caller component
            throw new Error(message);
        }
    };

    const joinRoom = (roomCode?: string) => {
        if (!isAuthenticated || !token) {
            const message = 'You must be logged in to join a room.';
            autoClearError(setError, message);
            toast.error(message);
            return
        };
        socketService.emit('joinRoom', { roomCode });
    };

    const leaveRoom = useCallback(() => {
        socketService.emit('leaveRoom');
        setGameState(initialGameState); // Reset state immediately on client
    }, []);
    
    const kickPlayer = (playerIdToKick: string) => socketService.emit('kickPlayer', playerIdToKick);
    const sendMessage = (messageText: string) => socketService.emit('sendMessage', messageText);
    const startGame = (data: { selectedRoles: Role[] }) => {
        setHasViewedRole(false);
        socketService.emit('startGame', data);
    }
    const selectTeam = (teamPlayerIds: string[]) => socketService.emit('selectTeam', teamPlayerIds);
    const updatePendingTeam = (teamPlayerIds: string[]) => socketService.emit('updatePendingTeam', teamPlayerIds);
    const voteOnTeam = (vote: 'APPROVE' | 'REJECT') => socketService.emit('voteOnTeam', vote);
    const voteOnQuest = (vote: 'SUCCESS' | 'FAIL') => socketService.emit('voteOnQuest', vote);
    const assassinate = (targetId: string) => socketService.emit('assassinate', targetId);
    const playerReady = () => socketService.emit('playerReady');
    const playerReadyForNextGame = () => socketService.emit('playerReadyForNextGame');
    const initiateRestart = () => socketService.emit('initiateRestart');
    const voteOnRestart = (vote: 'yes' | 'no') => socketService.emit('voteOnRestart', vote);

    const value = {
        gameState,
        playerId,
        error,
        messages,
        user,
        token,
        isAuthenticated,
        authError,
        isLoading,
        hasViewedRole,
        hasViewedEndGame,
        settings,
        achievementsVersion,
        setHasViewedRole,
        setHasViewedEndGame,
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
        voteOnTeam,
        voteOnQuest,
        assassinate,
        sendMessage,
        playerReady,
        playerReadyForNextGame,
        initiateRestart,
        voteOnRestart,
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
