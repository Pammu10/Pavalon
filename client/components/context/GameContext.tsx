import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { GameState, GamePhase, Player, Message, Role, User, LoginCredentials, RegisterCredentials } from '@/types';
import { socketService } from '@/services/socketService';
import api from '@/services/api';

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
    hasUnreadMessages: boolean;
    clearUnreadMessages: () => void;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<void>;
    logout: () => void;
    joinRoom: (roomCode?: string) => void;
    startGame: (data: { selectedRoles: Role[] }) => void;
    selectTeam: (teamPlayerIds: string[]) => void;
    voteOnTeam: (vote: 'APPROVE' | 'REJECT') => void;
    voteOnQuest: (vote: 'SUCCESS' | 'FAIL') => void;
    assassinate: (targetId: string) => void;
    sendMessage: (messageText: string) => void;
    restartGame: () => void;
    playerReady: () => void;
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
    readyPlayers: [],
    reconnectingPlayer: null
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const clearError = (setter: React.Dispatch<React.SetStateAction<string | null>>) => {
      setter(null);
    }
    const autoClearError = (setter: React.Dispatch<React.SetStateAction<string | null>>, message: string) => {
      setter(message);
      setTimeout(() => setter(null), 5000);
    }

    const clearUnreadMessages = () => {
        setHasUnreadMessages(false);
    }

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
                // Handle corrupted data in localStorage
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

    useEffect(() => {
        const handleUpdate = (newState: GameState) => {
            console.log("Game state updated:", newState);
            setGameState(newState);
            setMessages(newState.chat || []);
        };
        
        const handleChatMessage = (message: Message) => {
            setMessages(prev => [...prev, message]);
        };

        const handleError = (message: string) => {
            autoClearError(setError, message);
        };

        socketService.on('updateGameState', handleUpdate);
        socketService.on('chatMessage', handleChatMessage);
        socketService.on('error', handleError);

        return () => {
            socketService.off('updateGameState');
            socketService.off('chatMessage');
            socketService.off('error');
        };
    }, []);

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
            clearError(setAuthError);
            const { data } = await api.post('/login', credentials);
            const { token, user } = data;
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setToken(token);
            setUser(user);
            setIsAuthenticated(true);
        } catch (err: any) {
            autoClearError(setAuthError, err.response?.data?.message || 'Login failed.');
        }
    };

    const register = async (credentials: RegisterCredentials) => {
        try {
            clearError(setAuthError);
            const { data } = await api.post('/register', credentials);
            const { token, user } = data;
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setToken(token);
            setUser(user);
            setIsAuthenticated(true);
        } catch (err: any) {
            autoClearError(setAuthError, err.response?.data?.message || 'Registration failed.');
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setGameState(initialGameState); // Reset game state on logout
    };

    const joinRoom = (roomCode?: string) => {
        if (!isAuthenticated || !token) {
            autoClearError(setError, 'You must be logged in to join a room.');
            return
        };
        socketService.emit('joinRoom', { roomCode });
    };
    
    const sendMessage = (messageText: string) => socketService.emit('sendMessage', messageText);
    const restartGame = () => socketService.emit('restartGame');
    const startGame = (data: { selectedRoles: Role[] }) => socketService.emit('startGame', data);
    const selectTeam = (teamPlayerIds: string[]) => socketService.emit('selectTeam', teamPlayerIds);
    const voteOnTeam = (vote: 'APPROVE' | 'REJECT') => socketService.emit('voteOnTeam', vote);
    const voteOnQuest = (vote: 'SUCCESS' | 'FAIL') => socketService.emit('voteOnQuest', vote);
    const assassinate = (targetId: string) => socketService.emit('assassinate', targetId);
    const playerReady = () => socketService.emit('playerReady');

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
        hasUnreadMessages,
        clearUnreadMessages,
        login,
        register,
        logout,
        joinRoom,
        startGame,
        selectTeam,
        voteOnTeam,
        voteOnQuest,
        assassinate,
        sendMessage,
        restartGame,
        playerReady,
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