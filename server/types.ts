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
    results: ('SUCCESS' | 'FAIL')[];
    failsRequired: number;
    questLeader: Player | null;
    pastVotes: {
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
    senderName: string;
    text: string;
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
    readyPlayers: string[];
    reconnectingPlayer: { userId: number; name: string; endsAt: number } | null;
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
}


// Socket Event Types
export interface ClientToServerEvents {
    joinRoom: (data: { roomCode?: string }) => void; // Auth token is handled by middleware
    startGame: (data: { selectedRoles: Role[] }) => void;
    restartGame: () => void;
    selectTeam: (teamPlayerIds: string[]) => void;
    voteOnTeam: (vote: 'APPROVE' | 'REJECT') => void;
    voteOnQuest: (vote: 'SUCCESS' | 'FAIL') => void;
    assassinate: (targetId: string) => void;
    sendMessage: (messageText: string) => void;
    playerReady: () => void;
}

export interface ServerToClientEvents {
    updateGameState: (gameState: GameState) => void;
    chatMessage: (message: Message) => void;
    error: (message: string) => void;
}
