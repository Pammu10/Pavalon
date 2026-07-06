import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { GameState, GamePhase, Player, Message, Role, User, LoginCredentials, RegisterCredentials, Achievement, Friend, FriendRequest, GameInvite, FriendSuggestion } from '@/types';
import { socketService } from '@/services/socketService';
import api, { fetcher } from '@/services/api';
import { toast } from 'sonner';
import { useAudio } from './AudioContext';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Settings {
    skipIntro: boolean;
}

export interface TeamVoteRevealData {
    votes: { playerId: string; vote: 'APPROVE' | 'REJECT' }[];
    players: Player[];
    wasApproved: boolean;
}

export type SuspicionMark = 'trusted' | 'suspect' | 'evil';

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
    hasViewedCurrentQuestResult: boolean;
    hasViewedEndGameResult: boolean;
    justJoined: boolean;
    teamVoteReveal: TeamVoteRevealData | null;
    clearTeamVoteReveal: () => void;
    activeEmotes: Record<string, { emote: string; key: number }>;
    sendEmote: (emote: string) => void;
    suspicionMarks: Record<number, SuspicionMark>;
    cycleSuspicionMark: (userId: number) => void;
    // Username Modal State
    isUsernameModalOpen: boolean;
    suggestedUsername: string;
    openUsernameModal: (username: string) => void;
    closeUsernameModal: () => void;
    // Social State
    friendRequests: FriendRequest[];
    pendingInvites: GameInvite[];
    isSocialHubOpen: boolean;
    openSocialHub: () => void;
    closeSocialHub: () => void;
    // Preview State
    previewBackground: string | null;
    setPreviewBackground: React.Dispatch<React.SetStateAction<string | null>>;
    setHasViewedRole: React.Dispatch<React.SetStateAction<boolean>>;
    markQuestResultAsViewed: () => void;
    markEndGameAsViewed: () => void;
    clearJustJoined: () => void;
    updateSettings: (newSettings: Partial<Settings>) => void;
    updateUser: (data: Partial<User>) => void;
    updateUsername: (newUsername: string) => Promise<void>;
    login: (credentials: LoginCredentials, onSuccess?: () => void) => Promise<void>;
    register: (credentials: RegisterCredentials, onSuccess?: () => void) => Promise<void>;
    googleLogin: (accessToken: string) => Promise<void>;
    linkGoogleAccount: (accessToken: string) => Promise<void>;
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
    // Tutorial
    advanceTutorial: () => void;
    // CPU Game
    startCPUGame: (data: { difficulty: 'easy' | 'medium' | 'hard'; playerCount: number }) => void;
    addBot: (difficulty: 'easy' | 'medium' | 'hard') => void;
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
};

const GameContext = createContext<GameContextType | undefined>(undefined);

const SOCKET_ERROR_TOAST_ID = 'socket-connection-error';
const SERVER_ERROR_TOAST_ID = 'server-connection-error'; // Must match the one in api.ts

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasViewedRole, setHasViewedRole] = useState(false);
    const [viewedSessionKeys, setViewedSessionKeys] = useState<Set<string>>(new Set());
    const [settings, setSettings] = useState<Settings>(initialSettings);
    const [justJoined, setJustJoined] = useState(false);

    // Username Modal State
    const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
    const [suggestedUsername, setSuggestedUsername] = useState('');

    // Social State
    const [pendingInvites, setPendingInvites] = useState<GameInvite[]>([]);
    const [isSocialHubOpen, setIsSocialHubOpen] = useState(false);
    const [inviteCooldowns, setInviteCooldowns] = useState<Map<number, number>>(new Map());
    const [inviteQueue, setInviteQueue] = useState<number | null>(null);

    // Preview State
    const [previewBackground, setPreviewBackground] = useState<string | null>(null);
    const { playSound } = useAudio();

    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isConnected, setIsConnected] = useState<boolean>(false);

    const [teamVoteReveal, setTeamVoteReveal] = useState<TeamVoteRevealData | null>(null);
    const clearTeamVoteReveal = useCallback(() => setTeamVoteReveal(null), []);

    // Emote reactions: playerId -> latest emote (key forces re-animation on repeat)
    const [activeEmotes, setActiveEmotes] = useState<Record<string, { emote: string; key: number }>>({});
    const emoteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // Private per-game deduction notes: userId -> mark. Never sent to the server.
    const [suspicionMarks, setSuspicionMarks] = useState<Record<number, SuspicionMark>>({});
    const cycleSuspicionMark = useCallback((userId: number) => {
        setSuspicionMarks(prev => {
            const order: (SuspicionMark | null)[] = [null, 'trusted', 'suspect', 'evil'];
            const current = prev[userId] ?? null;
            const next = order[(order.indexOf(current) + 1) % order.length];
            const updated = { ...prev };
            if (next === null) delete updated[userId];
            else updated[userId] = next;
            return updated;
        });
    }, []);

    const prevRoomCode = useRef(gameState.roomCode);
    
    // Fetch friend requests for notification badges using React Query
    const { data: friendRequests = [] } = useQuery({
        queryKey: ['friendRequests'],
        queryFn: () => fetcher<FriendRequest[]>('/social/requests'),
        enabled: isAuthenticated,
    });

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

    const openUsernameModal = (username: string) => {
        setSuggestedUsername(username);
        setIsUsernameModalOpen(true);
    };
    
    const closeUsernameModal = () => {
        setIsUsernameModalOpen(false);
    };


    useEffect(() => {
        if (gameState.roomCode && gameState.roomCode !== prevRoomCode.current) {
            router.push(`/game/${gameState.roomCode}`);
        } else if (!gameState.roomCode && prevRoomCode.current) {
            router.push('/');
        }
        if (gameState.roomCode !== prevRoomCode.current) {
            setSuspicionMarks({});
        }
        prevRoomCode.current = gameState.roomCode;
    }, [gameState.roomCode, router]);

    // Reset deduction notes whenever a fresh game starts (role reveal)
    useEffect(() => {
        if (gameState.phase === GamePhase.ROLE_REVEAL) {
            setSuspicionMarks({});
        }
    }, [gameState.phase]);
    
    // Trigger the team-vote reveal overlay when the phase moves past TEAM_VOTE.
    // Votes are redacted while voting is open, so the reveal is built from the
    // server's post-vote records (approvedVote / pastVotes) on the next state.
    const prevPhaseForRevealRef = useRef(gameState.phase);
    useEffect(() => {
        const prevPhase = prevPhaseForRevealRef.current;
        const { phase } = gameState;
        prevPhaseForRevealRef.current = phase;

        if (prevPhase === GamePhase.TEAM_VOTE && (phase === GamePhase.QUEST_VOTE || phase === GamePhase.TEAM_SELECTION)) {
            const quest = gameState.questHistory[gameState.currentQuest - 1];
            const wasApproved = phase === GamePhase.QUEST_VOTE;
            const record = wasApproved
                ? quest?.approvedVote
                : quest?.pastVotes[quest.pastVotes.length - 1];
            if (record && record.votes.length > 0) {
                setTeamVoteReveal({ votes: record.votes, players: gameState.players, wasApproved });
            }
        }

        // The quest-result / end-game presentations own the screen and audio;
        // a reveal still on screen at that point must yield (bots can finish
        // the quest vote before the reveal animation has ended).
        if (
            phase === GamePhase.QUEST_RESULT ||
            phase === GamePhase.END_GAME ||
            phase === GamePhase.LOBBY ||
            phase === GamePhase.ROLE_REVEAL
        ) {
            setTeamVoteReveal(null);
        }
    }, [gameState]);

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
    const updateSettings = useCallback((newSettings: Partial<Settings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('pavalonSettings', JSON.stringify(updated));
            return updated;
        });
    }, []);

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
                    if (error.response) {
                        console.error("Token verification failed (server responded with error), logging out.", error);
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('user');
                        delete api.defaults.headers.common['Authorization'];
                        setToken(null);
                        setUser(null);
                        setIsAuthenticated(false);
                    } else {
                        console.warn("Could not verify token (network error), keeping client-side auth state.", error);
                        const storedUser = localStorage.getItem('user');
                        if (storedUser) {
                            try {
                                setUser(JSON.parse(storedUser));
                                setToken(storedToken);
                                setIsAuthenticated(true);
                            } catch (e) {
                                console.error("Failed to parse stored user data, logging out.", e);
                                localStorage.removeItem('authToken');
                                localStorage.removeItem('user');
                                setIsAuthenticated(false);
                            }
                        } else {
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
        setGameState(prevState => {
            if (newState.phase === GamePhase.LOBBY && prevState.phase === GamePhase.HOME) {
                setJustJoined(true);
            }
            const isNewGameStarting = (prevState.phase === GamePhase.END_GAME && newState.phase === GamePhase.LOBBY) || 
                                      (prevState.phase === GamePhase.LOBBY && newState.phase === GamePhase.ROLE_REVEAL);
            if (isNewGameStarting) {
                setHasViewedRole(false);
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
    }, []);

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
        queryClient.invalidateQueries({ queryKey: ['achievements'] });
    }, [playSound, queryClient]);

    const handleKicked = useCallback((reason: string) => {
        // The server sends 'kicked' for voluntary leaves too — don't present
        // those as if the player was removed by someone else.
        if (reason.startsWith('You have left')) {
            toast.info(reason);
        } else {
            toast.error(reason, {
                description: "You have been removed from the game."
            });
        }
        setGameState(initialGameState);
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
        queryClient.clear(); // Clear all cached data on logout
        router.push('/');
    }, [gameState.roomCode, router, queryClient]);

    // --- Social Socket Handlers ---
    const handleSocialStatus = useCallback(({ userId, isOnline, isInGame, gamePhase }: { userId: number, isOnline: boolean, isInGame: boolean, gamePhase?: GamePhase | null }) => {
        queryClient.setQueryData<Friend[]>(['friends'], (oldData) => 
            oldData?.map(f => f.id === userId ? { ...f, isOnline, isInGame, gamePhase } : f)
        );
    }, [queryClient]);
    
    const handleRequestReceived = useCallback((request: FriendRequest) => {
        queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        toast.info(`New friend request from ${request.username}!`);
    }, [queryClient]);

    const handleRequestAccepted = useCallback((newFriend: Friend) => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['sentFriendRequests'] });
        queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        queryClient.invalidateQueries({ queryKey: ['suggestions'] });
        toast.success(`${newFriend.username} is now your friend!`);
    }, [queryClient]);
    
    const handleFriendRemoved = useCallback(({ friendId }: { friendId: number }) => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['suggestions'] });
        toast.warning(`A user has removed you from their friends list.`);
    }, [queryClient]);

    const handleSocialRequestCancelled = useCallback(({ requesterId }: { requesterId: number }) => {
        queryClient.setQueryData<FriendRequest[]>(['friendRequests'], (oldData) =>
            oldData?.filter(req => req.id !== requesterId)
        );
        toast.info("A friend request was cancelled.");
    }, [queryClient]);
    
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


    const handleEmote = useCallback(({ playerId: senderId, emote }: { playerId: string; emote: string }) => {
        setActiveEmotes(prev => ({ ...prev, [senderId]: { emote, key: Date.now() } }));
        if (emoteTimersRef.current[senderId]) clearTimeout(emoteTimersRef.current[senderId]);
        emoteTimersRef.current[senderId] = setTimeout(() => {
            setActiveEmotes(prev => {
                const updated = { ...prev };
                delete updated[senderId];
                return updated;
            });
            delete emoteTimersRef.current[senderId];
        }, 3000);
    }, []);

    // --- Socket Listener `useEffect` ---
    useEffect(() => {
        socketService.on('updateGameState', handleUpdate);
        socketService.on('chatMessage', handleChatMessage);
        socketService.on('emote', handleEmote);
        socketService.on('error', handleError);
        socketService.on('achievementUnlocked', handleAchievementUnlocked);
        socketService.on('kicked', handleKicked);
        socketService.on('social:status', handleSocialStatus);
        socketService.on('social:request_received', handleRequestReceived);
        socketService.on('social:request_accepted', handleRequestAccepted);
        socketService.on('social:friend_removed', handleFriendRemoved);
        socketService.on('social:request_cancelled', handleSocialRequestCancelled);
        socketService.on('social:invite_received', handleInviteReceived);

        return () => {
            socketService.off('updateGameState', handleUpdate);
            socketService.off('chatMessage', handleChatMessage);
            socketService.off('emote', handleEmote);
            socketService.off('error', handleError);
            socketService.off('achievementUnlocked', handleAchievementUnlocked);
            socketService.off('kicked', handleKicked);
            socketService.off('social:status', handleSocialStatus);
            socketService.off('social:request_received', handleRequestReceived);
            socketService.off('social:request_accepted', handleRequestAccepted);
            socketService.off('social:friend_removed', handleFriendRemoved);
            socketService.off('social:request_cancelled', handleSocialRequestCancelled);
            socketService.off('social:invite_received', handleInviteReceived);
        };
    }, [handleUpdate, handleChatMessage, handleEmote, handleError, handleAchievementUnlocked, handleKicked, handleSocialStatus, handleRequestReceived, handleRequestAccepted, handleFriendRemoved, handleSocialRequestCancelled, handleInviteReceived]);

    useEffect(() => {
        const handleConnectError = (err: Error) => {
            if (isAuthenticated) {
                console.error("Socket connection error:", err.message);
                if (err.message.includes("Authentication error")) {
                    toast.error("Your session is invalid or has expired.", { description: "You have been logged out. Please log in again." });
                    logout(); 
                } else {
                    toast.error("Could not connect to the game server.", { id: SOCKET_ERROR_TOAST_ID, description: "Please check your internet connection and try again." });
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
    
    const googleLogin = async (accessToken: string) => {
        try {
            setAuthError(null);
            const { data } = await api.post('/auth/google', { accessToken });
            const { token: new_token, user: new_user, isNewUser } = data;
            
            localStorage.setItem('authToken', new_token);
            localStorage.setItem('user', JSON.stringify(new_user));
            api.defaults.headers.common['Authorization'] = `Bearer ${new_token}`;
            setToken(new_token);
            setUser(new_user);
            setIsAuthenticated(true);

            if (isNewUser) {
                openUsernameModal(new_user.username);
            }
        } catch (err: any) {
            const message = err.response?.data?.message || 'Google login failed.';
            autoClearError(setAuthError, message);
            toast.error(message);
            throw err;
        }
    };

    const linkGoogleAccount = async (accessToken: string) => {
        try {
            const { data } = await api.post('/user/link-google', { accessToken });
            setUser(prev => prev ? { ...prev, isGoogleLinked: true } : null);
            toast.success("Google account linked successfully!");
        } catch(err: any) {
            const message = err.response?.data?.message || 'Failed to link account.';
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
    }, []);
    
    const openSocialHub = () => setIsSocialHubOpen(true);
    const closeSocialHub = () => setIsSocialHubOpen(false);

    const addFriend = async (username: string) => {
        try {
            const response = await api.post('/social/add', { username });
            toast.success(response.data.message);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
                queryClient.invalidateQueries({ queryKey: ['sentFriendRequests'] })
            ]);
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to send friend request.';
            toast.error(message);
        }
    };
    
    const respondToFriendRequest = async (requesterId: number, action: 'accept' | 'decline') => {
        try {
            await api.post('/social/respond', { requesterId, action });
            await queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
            if (action === 'accept') {
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['friends'] }),
                    queryClient.invalidateQueries({ queryKey: ['suggestions'] })
                ]);
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
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['friends'] }),
                queryClient.invalidateQueries({ queryKey: ['suggestions'] })
            ]);
            toast.success("Friend removed.");
        } catch (err: any) {
             toast.error(err.response?.data?.message || 'Failed to remove friend.');
        }
    };

    const cancelFriendRequest = async (recipientId: number) => {
        try {
            await api.delete(`/social/request/cancel/${recipientId}`);
            await queryClient.invalidateQueries({ queryKey: ['sentFriendRequests'] });
            await queryClient.invalidateQueries({ queryKey: ['suggestions'] });
            toast.success("Friend request cancelled.");
        } catch (err: any) {
            const message = (err as any).response?.data?.message || 'Failed to cancel request.';
            toast.error(message);
        }
    };
    
    const inviteFriendToGame = (friendId: number) => {
        const now = Date.now();
        const lastInviteTime = inviteCooldowns.get(friendId);

        if (lastInviteTime && (now - lastInviteTime) < 10000) {
            const timeLeft = Math.ceil((10000 - (now - lastInviteTime)) / 1000);
            toast.warning(`Please wait ${timeLeft}s before inviting this player again.`);
            return;
        }

        setInviteCooldowns(prev => new Map(prev).set(friendId, now));
        
        if (gameState.roomCode) {
            socketService.emit('social:invite_to_game', { friendId });
            toast.success("Game invite sent!");
        } else {
            toast.info("Creating a new room for your game...");
            setInviteQueue(friendId);
            joinRoom();
        }
    };

    const advanceTutorial = () => socketService.emit('advanceTutorial');
    const startCPUGame = (data: { difficulty: 'easy' | 'medium' | 'hard'; playerCount: number }) =>
        socketService.emit('startCPUGame', data);
    const addBot = (difficulty: 'easy' | 'medium' | 'hard') => socketService.emit('addBot', difficulty);
    const kickPlayer = (playerIdToKick: string) => socketService.emit('kickPlayer', playerIdToKick);
    const sendMessage = (messageText: string) => socketService.emit('sendMessage', messageText);
    const sendEmote = useCallback((emote: string) => socketService.emit('sendEmote', emote), []);
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
    const startDragonsBreath = () => socketService.emit('startDragonsBreath');
    const drawCard = () => socketService.emit('drawCard');
    const playCard = (cardId: string) => socketService.emit('playCard', cardId);
    const placeDragonCard = (index: number) => socketService.emit('placeDragonCard', index);
    const endFutureView = () => socketService.emit('endFutureView');
    const returnToLobby = () => socketService.emit('returnToLobby');

    const hasViewedCurrentQuestResult = viewedSessionKeys.has(`viewedQuest-${gameState.roomCode}-${gameState.currentQuest}`);
    const hasViewedEndGameResult = viewedSessionKeys.has(`viewedEndGame-${gameState.roomCode}`);

    const value: GameContextType = {
        gameState, playerId, error, messages, user, token, isAuthenticated, authError,
        isLoading, isConnected, hasViewedRole, settings, hasViewedCurrentQuestResult,
        hasViewedEndGameResult, justJoined, teamVoteReveal, clearTeamVoteReveal,
        activeEmotes, sendEmote, suspicionMarks, cycleSuspicionMark,
        isUsernameModalOpen, suggestedUsername, openUsernameModal,
        closeUsernameModal, friendRequests, pendingInvites, isSocialHubOpen,
        openSocialHub, closeSocialHub, previewBackground, setPreviewBackground, setHasViewedRole, markQuestResultAsViewed,
        markEndGameAsViewed, clearJustJoined, updateSettings, updateUser, updateUsername,
        login, register, logout, joinRoom, leaveRoom, kickPlayer, startGame,
        updateSelectedRoles, selectTeam, updatePendingTeam, updateAssassinationTarget,
        voteOnTeam, voteOnQuest, assassinate, playerReady, playerReadyForNextGame, sendMessage,
        initiateRestart, voteOnRestart, startDragonsBreath, drawCard, playCard, placeDragonCard,
        endFutureView, returnToLobby, advanceTutorial, startCPUGame, addBot, addFriend, respondToFriendRequest, removeFriend,
        cancelFriendRequest, inviteFriendToGame, acceptInvite, declineInvite, googleLogin, linkGoogleAccount,
    };

    return (
        <GameContext.Provider value={value}>
            {children}
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