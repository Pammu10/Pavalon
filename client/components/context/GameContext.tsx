import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { GameState, GamePhase, Player, Message, Role, User, LoginCredentials, RegisterCredentials, Achievement, Friend, FriendRequest, GameInvite } from '@/types';
import { socketService } from '@/services/socketService';
import api from '@/services/api';
import { toast } from 'sonner';
import { useAudio } from './AudioContext';
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
    justJoined: boolean;
    // Social State
    friends: Friend[];
    friendRequests: FriendRequest[];
    sentFriendRequests: FriendRequest[];
    pendingInvites: GameInvite[];
    isSocialHubOpen: boolean;
    openSocialHub: () => void;
    closeSocialHub: () => void;
    setHasViewedRole: React.Dispatch<React.SetStateAction<boolean>>;
    markQuestResultAsViewed: () => void;
    markEndGameAsViewed: () => void;
    clearJustJoined: () => void;
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
    updateSelectedRoles: (roles: Role[]) => void;
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
    // Social Functions
    addFriend: (username: string) => Promise<void>;
    respondToFriendRequest: (requesterId: number, action: 'accept' | 'decline') => Promise<void>;
    removeFriend: (friendId: number) => Promise<void>;
    cancelFriendRequest: (recipientId: number) => Promise<void>;
    inviteFriendToGame: (friendId: number) => void;
    acceptInvite: (roomCode: string) => void;
    declineInvite: (roomCode: string) => void;
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
    selectedRoles: [],
};

const initialSettings: Settings = {
    skipIntro: false,
    showTutorial: true,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

const SOCKET_ERROR_TOAST_ID = 'socket-connection-error';
const SERVER_ERROR_TOAST_ID = 'server-connection-error'; // Must match the one in api.ts

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
    const [justJoined, setJustJoined] = useState(false);

    // Social State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [sentFriendRequests, setSentFriendRequests] = useState<FriendRequest[]>([]);
    const [pendingInvites, setPendingInvites] = useState<GameInvite[]>([]);
    const [isSocialHubOpen, setIsSocialHubOpen] = useState(false);
    const [inviteCooldowns, setInviteCooldowns] = useState<Map<number, number>>(new Map());
    const [inviteQueue, setInviteQueue] = useState<number | null>(null);


    const { playSound, setSystemMute } = useAudio();

    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isConnected, setIsConnected] = useState<boolean>(false);

    const prevRoomCode = useRef(gameState.roomCode);
    
    const autoClearError = useCallback((setter: React.Dispatch<React.SetStateAction<string | null>>, message: string) => {
      setter(message);
      playSound('error', { manageBgm: false });
      setTimeout(() => setter(null), 5000);
    }, [playSound]);

    const joinRoom = useCallback((roomCode?: string) => {
        if (!isAuthenticated || !token) {
            const message = 'You must be logged in to join a room.';
            autoClearError(setError, message);
            toast.error(message);
            if(roomCode) {
                 router.push(`/join/${roomCode}`);
            }
            return
        };
        socketService.emit('joinRoom', { roomCode });
        setPendingInvites([]); // Clear pending invites when joining a room
    }, [isAuthenticated, token, autoClearError, router]);

    useEffect(() => {
        if (gameState.roomCode && gameState.roomCode !== prevRoomCode.current) {
            router.push(`/game/${gameState.roomCode}`);
        } else if (!gameState.roomCode && prevRoomCode.current) {
            router.push('/');
        }
        prevRoomCode.current = gameState.roomCode;
    }, [gameState.roomCode, router]);
    
    useEffect(() => {
        // If we just entered a room and there's a pending invite
        if (gameState.roomCode && inviteQueue !== null) {
            // Ensure the player is actually in the list of players for the room
            const isPlayerInRoom = gameState.players.some(p => p.id === playerId);
            if (isPlayerInRoom) {
                socketService.emit('social:invite_to_game', { friendId: inviteQueue });
                toast.success("Room created and invite sent!");
                setInviteQueue(null); // Clear the queue
            }
        }
    }, [gameState.roomCode, gameState.players, inviteQueue, playerId]);

    
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
        const verifyToken = async () => {
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                try {
                    const { data } = await api.get('/verify-token');
                    setToken(storedToken);
                    setUser(data.user);
                    setIsAuthenticated(true);
                } catch (error: any) {
                    // If there's a response, it's an auth error from the server (e.g. 401).
                    // If there's NO response, it's a network error (server is down).
                    if (error.response) {
                        console.error("Token verification failed (server responded with error), logging out.", error);
                        // This is an actual authentication error (e.g. invalid token)
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('user');
                        delete api.defaults.headers.common['Authorization'];
                        setToken(null);
                        setUser(null);
                        setIsAuthenticated(false);
                    } else {
                        // This is likely a network error; the server is down or unreachable.
                        // We should trust the locally stored token and user data for now
                        // to avoid forcing a re-login when the connection is restored.
                        console.warn("Could not verify token (network error), keeping client-side auth state.", error);
                        
                        // Re-hydrate user from localStorage since the app just loaded.
                        const storedUser = localStorage.getItem('user');
                        if (storedUser) {
                            try {
                                setUser(JSON.parse(storedUser));
                                setToken(storedToken);
                                setIsAuthenticated(true); // Assume authenticated until socket fails
                            } catch (e) {
                                // If user data is corrupt, then we must log out.
                                console.error("Failed to parse stored user data, logging out.", e);
                                localStorage.removeItem('authToken');
                                localStorage.removeItem('user');
                                setIsAuthenticated(false);
                            }
                        } else {
                            // If there's no stored user data, we can't maintain the session.
                            localStorage.removeItem('authToken');
                            setIsAuthenticated(false);
                        }
                    }
                }
            }
            setIsLoading(false);
        };

        verifyToken();
    }, []);

    const fetchFriendsAndRequests = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const [friendsRes, requestsRes, sentRequestsRes] = await Promise.all([
                api.get('/social/friends'),
                api.get('/social/requests'),
                api.get('/social/requests/sent'),
            ]);
            setFriends(friendsRes.data);
            setFriendRequests(requestsRes.data);
            setSentFriendRequests(sentRequestsRes.data);
        } catch (error) {
            console.error("Failed to fetch social data", error);
            toast.error("Could not load your friends list.");
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchFriendsAndRequests();
        }
    }, [isAuthenticated, fetchFriendsAndRequests]);

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
        const onConnect = () => {
            setIsConnected(true);
            // On successful connection, dismiss any persistent connection error toasts
            toast.dismiss(SOCKET_ERROR_TOAST_ID);
            toast.dismiss(SERVER_ERROR_TOAST_ID);
        };
        const onDisconnect = () => setIsConnected(false);

        setIsConnected(socketService.socket.connected);

        socketService.socket.on('connect', onConnect);
        socketService.socket.on('disconnect', onDisconnect);

        return () => {
            socketService.socket.off('connect', onConnect);
            socketService.socket.off('disconnect', onDisconnect);
        };
    }, []);
    
    const clearJustJoined = useCallback(() => {
        setJustJoined(false);
    }, []);

    // --- Socket Event Handlers (wrapped in useCallback) ---
    const handleUpdate = useCallback((newState: GameState) => {
        // Automatically mute BGM if the user is in a room to prevent audio conflicts on mobile.
        // This respects the user's manual mute setting by not altering `isBgmMuted`.
        setSystemMute(!!newState.roomCode);

        setGameState(prevState => {
            // --- Sound Effect Logic ---
            if (newState.phase === GamePhase.LOBBY && prevState.phase === GamePhase.HOME) {
                setJustJoined(true);
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
    }, [setSystemMute]);

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
        // Reset social state on logout
        setFriends([]);
        setFriendRequests([]);
        setSentFriendRequests([]);
        setPendingInvites([]);
        router.push('/');
    }, [gameState.roomCode, router]);

    // --- Social Socket Handlers ---
    const handleSocialStatus = useCallback(({ userId, isOnline, isInGame, gamePhase }: { userId: number, isOnline: boolean, isInGame: boolean, gamePhase?: GamePhase | null }) => {
        setFriends(prev => prev.map(f => f.id === userId ? { ...f, isOnline, isInGame, gamePhase } : f));
    }, []);
    
    const handleRequestReceived = useCallback((request: FriendRequest) => {
        setFriendRequests(prev => [...prev, request]);
        toast.info(`New friend request from ${request.username}!`);
    }, []);

    const handleRequestAccepted = useCallback((newFriend: Friend) => {
        setFriends(prev => [...prev, newFriend]);
        // This event is fired for both users.
        // If I was the requester, it removes from my sent list.
        setSentFriendRequests(prev => prev.filter(req => req.id !== newFriend.id));
        // If I was the recipient, it removes from my received list.
        setFriendRequests(prev => prev.filter(req => req.id !== newFriend.id));
        toast.success(`${newFriend.username} accepted your friend request!`);
    }, []);
    
    const handleFriendRemoved = useCallback(({ friendId }: { friendId: number }) => {
        setFriends(prev => prev.filter(f => f.id !== friendId));
        toast.warning(`A user has removed you from their friends list.`);
    }, []);
    
    const declineInvite = useCallback((roomCode: string) => {
        setPendingInvites(prev => prev.filter(inv => inv.roomCode !== roomCode));
        toast.info("Invite declined.");
    }, []);

    const acceptInvite = useCallback((roomCode: string) => {
        const nonSwitchablePhases = [
            GamePhase.ROLE_REVEAL,
            GamePhase.TEAM_SELECTION,
            GamePhase.TEAM_VOTE,
            GamePhase.QUEST_VOTE,
            GamePhase.QUEST_RESULT,
            GamePhase.ASSASSINATION,
        ];
        if (gameState.roomCode && nonSwitchablePhases.includes(gameState.phase)) {
            toast.error("You cannot accept an invite while in an active game.");
            return;
        }
        joinRoom(roomCode);
    }, [gameState.roomCode, gameState.phase, joinRoom]);

    const handleInviteReceived = useCallback((data: GameInvite) => {
        playSound('transition');
        setPendingInvites(prev => [...prev, data]);
        toast.info(`Game Invite from ${data.from.username}`, {
            description: `You've been invited to join their game.`,
            duration: 15000,
            action: {
                label: "Join",
                onClick: () => acceptInvite(data.roomCode)
            },
            cancel: {
                label: "Decline",
                onClick: () => declineInvite(data.roomCode)
            }
        });
    }, [playSound, acceptInvite, declineInvite]);


    // --- Socket Listener `useEffect` ---
    useEffect(() => {
        socketService.on('updateGameState', handleUpdate);
        socketService.on('chatMessage', handleChatMessage);
        socketService.on('error', handleError);
        socketService.on('achievementUnlocked', handleAchievementUnlocked);
        socketService.on('kicked', handleKicked);

        // Social Listeners
        socketService.on('social:status', handleSocialStatus);
        socketService.on('social:request_received', handleRequestReceived);
        socketService.on('social:request_accepted', handleRequestAccepted);
        socketService.on('social:friend_removed', handleFriendRemoved);
        socketService.on('social:invite_received', handleInviteReceived);


        return () => {
            socketService.off('updateGameState', handleUpdate);
            socketService.off('chatMessage', handleChatMessage);
            socketService.off('error', handleError);
            socketService.off('achievementUnlocked', handleAchievementUnlocked);
            socketService.off('kicked', handleKicked);
             // Social Listeners
            socketService.off('social:status', handleSocialStatus);
            socketService.off('social:request_received', handleRequestReceived);
            socketService.off('social:request_accepted', handleRequestAccepted);
            socketService.off('social:friend_removed', handleFriendRemoved);
            socketService.off('social:invite_received', handleInviteReceived);
        };
    }, [handleUpdate, handleChatMessage, handleError, handleAchievementUnlocked, handleKicked, handleSocialStatus, handleRequestReceived, handleRequestAccepted, handleFriendRemoved, handleInviteReceived]);

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
                        id: SOCKET_ERROR_TOAST_ID,
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

    const leaveRoom = useCallback(() => {
        socketService.emit('leaveRoom');
        // The server will handle the state change and push an update with a null roomCode,
        // which will trigger the useEffect to redirect to home.
    }, []);
    
    // --- Social Functions ---
    const openSocialHub = () => setIsSocialHubOpen(true);
    const closeSocialHub = () => setIsSocialHubOpen(false);

    const addFriend = async (username: string) => {
        try {
            const response = await api.post('/social/add', { username });
            toast.success(response.data.message);
            if (response.data.sentRequest) {
                setSentFriendRequests(prev => [...prev, response.data.sentRequest]);
            }
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to send friend request.';
            toast.error(message);
        }
    };
    
    const respondToFriendRequest = async (requesterId: number, action: 'accept' | 'decline') => {
        try {
            await api.post('/social/respond', { requesterId, action });
            setFriendRequests(prev => prev.filter(req => req.id !== requesterId));
            if (action === 'accept') {
                // The socket `request_accepted` event will handle adding to the friends list
                toast.success("Friend request accepted!");
            } else {
                toast.info("Friend request declined.");
            }
        } catch (err: any) {
             toast.error(err.response?.data?.message || 'Action failed.');
        }
    };

    const removeFriend = async (friendId: number) => {
        try {
            await api.delete(`/social/remove/${friendId}`);
            setFriends(prev => prev.filter(f => f.id !== friendId));
            toast.success("Friend removed.");
        } catch (err: any) {
             toast.error(err.response?.data?.message || 'Failed to remove friend.');
        }
    };

    const cancelFriendRequest = async (recipientId: number) => {
        try {
            await api.delete(`/social/request/cancel/${recipientId}`);
            setSentFriendRequests(prev => prev.filter(req => req.id !== recipientId));
            toast.success("Friend request cancelled.");
        } catch (err: any) {
            const message = (err as any).response?.data?.message || 'Failed to cancel request.';
            toast.error(message);
        }
    };
    
    const inviteFriendToGame = (friendId: number) => {
        const now = Date.now();
        const lastInviteTime = inviteCooldowns.get(friendId);

        if (lastInviteTime && (now - lastInviteTime) < 10000) { // 10 second cooldown
            const timeLeft = Math.ceil((10000 - (now - lastInviteTime)) / 1000);
            toast.warning(`Please wait ${timeLeft}s before inviting this player again.`);
            return;
        }

        // Set cooldown immediately
        setInviteCooldowns(prev => new Map(prev).set(friendId, now));
        
        if (gameState.roomCode) {
            socketService.emit('social:invite_to_game', { friendId });
            toast.success("Game invite sent!");
        } else {
            toast.info("Creating a new room for your game...");
            setInviteQueue(friendId);
            joinRoom(); // This will create a new room
        }
    };


    // --- Emitting Functions ---
    const kickPlayer = (playerIdToKick: string) => socketService.emit('kickPlayer', playerIdToKick);
    const sendMessage = (messageText: string) => socketService.emit('sendMessage', messageText);
    const startGame = (data: { selectedRoles: Role[] }) => {
        setHasViewedRole(false);
        socketService.emit('startGame', data);
    }
    const updateSelectedRoles = (roles: Role[]) => socketService.emit('updateSelectedRoles', roles);
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
        justJoined,
        friends,
        friendRequests,
        sentFriendRequests,
        pendingInvites,
        isSocialHubOpen,
        openSocialHub,
        closeSocialHub,
        setHasViewedRole,
        markQuestResultAsViewed,
        markEndGameAsViewed,
        clearJustJoined,
        updateSettings,
        updateUser,
        updateUsername,
        login,
        register,
        logout,
        joinRoom: joinRoom,
        leaveRoom,
        kickPlayer,
        startGame,
        updateSelectedRoles,
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
        addFriend,
        respondToFriendRequest,
        removeFriend,
        cancelFriendRequest,
        inviteFriendToGame,
        acceptInvite,
        declineInvite,
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
