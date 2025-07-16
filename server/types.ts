
export enum Role {
    MERLIN = 'Merlin',
    PERCIVAL = 'Percival',
    LOYAL_SERVANT = 'Loyal Servant of Arthur',
    MORGANA = 'Morgana',
    ASSASSIN = 'Assassin',
    MORDRED = 'Mordred',
    OBERON = 'Oberon',
    MINION = 'Minion of Mordred',
}

export enum Alignment {
    GOOD = 'Good',
    EVIL = 'Evil',
}

export interface Player {
    id: string; // socket.id
    userId: number;
    name: string;
    role: Role | null;
    alignment: Alignment | null;
    isHost: boolean;
    hasVoted: boolean;
    status: 'CONNECTED' | 'DISCONNECTED';
    selectedTitle?: string | null;
    selectedBorder?: string | null;
    selectedIcon?: string | null;
}

export enum GamePhase {
    HOME = 'HOME', // Now represents the join/host screen for logged-in users
    LOBBY = 'LOBBY',
    ROLE_REVEAL = 'ROLE_REVEAL',
    TEAM_SELECTION = 'TEAM_SELECTION',
    TEAM_VOTE = 'TEAM_VOTE',
    QUEST_VOTE = 'QUEST_VOTE',
    QUEST_RESULT = 'QUEST_RESULT',
    ASSASSINATION = 'ASSASSINATION',
    END_GAME = 'END_GAME',
}

export interface Quest {
    questNumber: number;
    teamSize: number;
    status: 'PENDING' | 'ACTIVE' | 'PASSED' | 'FAILED';
    team: Player[];
    votes: { playerId: string; vote: 'APPROVE' | 'REJECT' }[];
    results: { playerId: string; vote: 'SUCCESS' | 'FAIL' }[];
    failsRequired: number;
    questLeader: Player | null;
    pastVotes: {
        leader: Player | null;
        team: Player[];
        votes: { playerId: string; vote: 'APPROVE' | 'REJECT' }[];
    }[];
    approvedVote: {
        team: Player[];
        votes: { playerId: string; vote: 'APPROVE' | 'REJECT' }[];
    } | null;
}

export interface Message {
    senderId: string;
    senderUserId: number;
    senderName: string;
    text: string;
}

export interface LogEntry {
    id: string;
    timestamp: number;
    text: string;
    type: 'leader' | 'team' | 'vote' | 'quest' | 'system' | 'assassination';
}

export interface GameState {
    roomCode: string | null;
    players: Player[];
    phase: GamePhase;
    currentQuest: number;
    questHistory: Quest[];
    leader: Player | null;
    voteTrack: number;
    winner: Alignment | null;
    endGameReason: string;
    chat: Message[];
    gameLog: LogEntry[];
    readyPlayers: string[];
    endGameReadyPlayers: string[];
    reconnectingPlayer: { userId: number; name: string; endsAt: number } | null;
    restartVote: {
        initiatorId: string;
        initiatorName: string;
        votes: { [playerId: string]: 'yes' | 'no' };
        endsAt: number;
    } | null;
    lastRestartInitiatedAt: number | null;
    pendingTeam: string[] | null;
}

export interface RoleDescription {
    role: Role;
    alignment: Alignment;
    description: string;
    vision: string;
}

// Auth & Stats Types
export interface User {
    id: number;
    username: string;
    is_admin?: boolean;
    selectedTitle?: string | null;
    selectedBorder?: string | null;
    selectedIcon?: string | null;
}
export interface Match {
    id: number;
    winner: Alignment;
    role: Role;
    won: boolean;
    playedAt: string;
}

export interface MatchPlayerPerformance {
    username: string;
    role: Role;
    alignment: Alignment;
    won: boolean;
}

export interface UserAchievement {
    achievement_id: string;
    unlocked_at: string;
}

export interface PlayerStats {
    totalGames: number;
    totalWins: number;
    goodGames: number;
    goodWins: number;
    evilGames: number;
    evilWins: number;
    winRate: number;
    goodWinRate: number;
    evilWinRate: number;
    recentMatches: Match[];
    achievements: UserAchievement[];
}

export interface LeaderboardEntry {
    username: string;
    value: number | string;
}

export interface LeaderboardData {
    totalWins: LeaderboardEntry[];
    winRate: LeaderboardEntry[];
    topAssassins: LeaderboardEntry[];
    winStreaks: LeaderboardEntry[];
    bestGood: LeaderboardEntry[];
    bestEvil: LeaderboardEntry[];
}

// Achievement types for socket payload
export interface AchievementReward {
    type: 'TITLE' | 'BORDER' | 'ICON';
    value: string;
    name: string;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    rewards: AchievementReward[];
    unlocked: boolean;
    unlocked_at?: string;
    hidden?: boolean;
}


// Socket Event Types
export interface ClientToServerEvents {
    joinRoom: (data: { roomCode?: string }) => void;
    leaveRoom: () => void;
    startGame: (data: { selectedRoles: Role[] }) => void;
    kickPlayer: (playerIdToKick: string) => void;
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

    // WebRTC Signaling
    'voice:offer': (data: { targetId: string; sdp: RTCSessionDescriptionInit }) => void;
    'voice:answer': (data: { targetId: string; sdp: RTCSessionDescriptionInit }) => void;
    'voice:ice-candidate': (data: { targetId: string; candidate: RTCIceCandidateInit }) => void;
}

export interface ServerToClientEvents {
    updateGameState: (gameState: GameState) => void;
    chatMessage: (message: Message) => void;
    error: (message: string) => void;
    achievementUnlocked: (achievement: Achievement) => void;
    kicked: (reason: string) => void;

    // WebRTC Signaling
    'voice:user-joined': (data: { socketId: string; user: { userId: number; name: string } }) => void;
    'voice:user-left': (data: { socketId: string }) => void;
    'voice:offer': (data: { fromId: string; sdp: RTCSessionDescriptionInit }) => void;
    'voice:answer': (data: { fromId: string; sdp: RTCSessionDescriptionInit }) => void;
    'voice:ice-candidate': (data: { fromId: string; candidate: RTCIceCandidateInit }) => void;
}
