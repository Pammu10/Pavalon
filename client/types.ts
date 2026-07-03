export enum Role {
  MERLIN = "Merlin",
  PERCIVAL = "Percival",
  LOYAL_SERVANT = "Loyal Servant of Arthur",
  MORGANA = "Morgana",
  ASSASSIN = "Assassin",
  MORDRED = "Mordred",
  OBERON = "Oberon",
  MINION = "Minion of Mordred",
}

export enum Alignment {
  GOOD = "Good",
  EVIL = "Evil",
}

export interface Player {
  id: string; // socket.id
  userId: number;
  name: string;
  role: Role | null;
  alignment: Alignment | null;
  isHost: boolean;
  hasVoted: boolean;
  status: "CONNECTED" | "DISCONNECTED";
  selectedTitle?: string | null;
  selectedBorder?: string | null;
  selectedIcon?: string | null;
  selectedBackground?: string | null;
  // Server-computed, per-viewer: what this client knows about this player
  // mid-game ('Evil' for Merlin/evil-team vision, 'Mystic' for Percival).
  visibleAs?: "Evil" | "Mystic";
}

export enum GamePhase {
  HOME = "HOME", // Now represents the join/host screen for logged-in users
  LOBBY = "LOBBY",
  ROLE_REVEAL = "ROLE_REVEAL",
  TEAM_SELECTION = "TEAM_SELECTION",
  TEAM_VOTE = "TEAM_VOTE",
  QUEST_VOTE = "QUEST_VOTE",
  QUEST_RESULT = "QUEST_RESULT",
  ASSASSINATION = "ASSASSINATION",
  END_GAME = "END_GAME",
  DRAGONS_BREATH = "DRAGONS_BREATH", // New phase for the 2-player game
}

export type Tab = 'home' | 'game' | 'social' | 'leaderboard' | 'settings' | 'achievements' | 'admin' | 'chat' | 'gamelog';

export interface Quest {
  questNumber: number;
  teamSize: number;
  status: "PENDING" | "ACTIVE" | "PASSED" | "FAILED";
  team: Player[];
  votes: { playerId: string; vote: "APPROVE" | "REJECT" }[];
  results: { playerId: string; vote: "SUCCESS" | "FAIL" }[];
  failsRequired: number;
  questLeader: Player | null;
  pastVotes: {
    leader: Player | null;
    team: Player[];
    votes: { playerId: string; vote: "APPROVE" | "REJECT" }[];
  }[];
  approvedVote: {
    team: Player[];
    votes: { playerId: string; vote: "APPROVE" | "REJECT" }[];
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
  type: 'leader' | 'team' | 'vote' | 'quest' | 'system' | 'assassination' | 'dragonsBreath';
}

// --- Dragon's Breath Types ---
export enum DragonCardType {
    DRAGON_BREATH = 'Dragon Breath',
    DEFUSE = 'Defuse',
    ATTACK = 'Attack',
    SKIP = 'Skip',
    SEE_THE_FUTURE = 'See the Future',
    SHUFFLE = 'Shuffle',
    EMBERDRAKE_HATCHLING = 'Emberdrake Hatchling',
    GLIMMERING_WHELP = 'Glimmering Whelp',
    SUNSTONE_DRAKE = 'Sunstone Drake',
}

export interface DragonCard {
    id: string;
    type: DragonCardType;
}

export interface DragonsBreathState {
    deck: DragonCard[];
    hands: { [playerId: string]: DragonCard[] };
    discardPile: DragonCard[];
    currentPlayerId: string;
    turnsToTake: number;
    isViewingFuture: string | null; // PlayerId of who is viewing
    futureCards: DragonCard[];
    isPlacingDragon: string | null; // PlayerId of who is placing the dragon
    winner: string | null; // PlayerId of the winner
    loser: string | null; // PlayerId of the loser
}

export interface DragonsBreathMatch {
  id: number;
  opponentName: string;
  won: boolean;
  playedAt: string;
}

export interface DragonsBreathOpponentStats {
  opponentId: number;
  opponentName: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
}

export interface DragonsBreathStats {
  totalGames: number;
  totalWins: number;
  opponentStats: DragonsBreathOpponentStats[];
  matchHistory: DragonsBreathMatch[];
}

export interface TutorialStep {
    step: number;
    title: string;
    text: string;
    highlight?: string[];
    actionRequired?: string;
    actionText?: string;
    isFinalStep?: boolean;
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
  dragonsBreathState: DragonsBreathState | null;
  assassinationTargetId: string | null;
  selectedRoles: Role[];
  tutorial?: TutorialStep | null;
}

export interface RoleDescription {
  role: Role;
  alignment: Alignment;
  description: string;
  vision: string;
}

export type CharacterName = Role;

export interface CharacterInfo {
    color: string;
    bgColor: string;
    alignment: Alignment;
    description: string;
    vision: string;
    img: string;
    strategy: string;
}

export interface QuestResult {
  questNumber: number;
  passed: boolean;
  successVotes: number;
  failVotes: number;
  leader: Player;
  questMembers: Player[];
  votes: { player: Player; vote: 'success' | 'fail' }[];
}


// Auth & Stats Types
export interface User {
  id: number;
  username: string;
  is_admin?: boolean;
  selectedTitle?: string | null;
  selectedBorder?: string | null;
  selectedIcon?: string | null;
  selectedBackground?: string | null;
  isGoogleLinked?: boolean;
  usernameLastChangedAt?: string;
}
export type RegisterCredentials = {
  username: string;
  password: string;
};
export type LoginCredentials = RegisterCredentials;

export interface Match {
  id: number;
  winner: Alignment;
  role: Role;
  won: boolean;
  playedAt: string;
}

export interface MatchPlayerPerformance {
  username:string;
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

export interface AchievementReward {
    type: 'TITLE' | 'BORDER' | 'ICON' | 'BACKGROUND';
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

export interface DragonsBreathLeaderboardData {
    mostWins: LeaderboardEntry[];
    mostDefuses: LeaderboardEntry[];
    mostSees: LeaderboardEntry[];
    mostAttacks: LeaderboardEntry[];
    mostFillers: LeaderboardEntry[];
}

// --- Social Types ---
export interface Friend {
    id: number;
    username: string;
    selectedTitle: string | null;
    selectedBorder: string | null;
    selectedIcon: string | null;
    selectedBackground?: string | null;
    isOnline: boolean;
    isInGame: boolean;
    gamePhase?: GamePhase | null;
}

export interface FriendRequest {
    id: number; // user id of the requester
    username: string;
}

export interface FriendSuggestion {
    id: number;
    username: string;
    mutual_friends: number;
}

export interface GameInvite {
    from: User;
    roomCode: string;
}

// Socket Event Types
export interface ClientToServerEvents {
  joinRoom: (data: { roomCode?: string }) => void;
  leaveRoom: () => void;
  // Pavalon Events
  startGame: (data: { selectedRoles: Role[] }) => void;
  kickPlayer: (playerIdToKick: string) => void;
  updateSelectedRoles: (roles: Role[]) => void;
  selectTeam: (teamPlayerIds: string[]) => void;
  updatePendingTeam: (teamPlayerIds: string[]) => void;
  updateAssassinationTarget: (targetId: string | null) => void;
  voteOnTeam: (vote: "APPROVE" | "REJECT") => void;
  voteOnQuest: (vote: "SUCCESS" | "FAIL") => void;
  assassinate: (targetId: string) => void;
  playerReady: () => void;
  playerReadyForNextGame: () => void;
  initiateRestart: () => void;
  voteOnRestart: (vote: 'yes' | 'no') => void;

  // Shared Events
  sendMessage: (messageText: string) => void;
  sendEmote: (emote: string) => void;
  
  // Dragon's Breath Events
  startDragonsBreath: () => void;
  drawCard: () => void;
  playCard: (cardId: string) => void;
  placeDragonCard: (index: number) => void;
  endFutureView: () => void;
  returnToLobby: () => void;
  
  // Tutorial Event
  advanceTutorial: () => void;

  // Social Events
  'social:invite_to_game': (data: { friendId: number }) => void;

  // Voice Chat
  'voice:offer': (data: { targetId: string, sdp: RTCSessionDescriptionInit }) => void;
  'voice:answer': (data: { targetId: string, sdp: RTCSessionDescriptionInit }) => void;
  'voice:ice-candidate': (data: { targetId: string, candidate: RTCIceCandidateInit }) => void;
}

export interface ServerToClientEvents {
  updateGameState: (gameState: GameState) => void;
  chatMessage: (message: Message) => void;
  emote: (data: { playerId: string; emote: string }) => void;
  error: (message: string) => void;
  achievementUnlocked: (achievement: Achievement) => void;
  kicked: (reason: string) => void;

  // Social Events
  'social:status': (data: { userId: number, isOnline: boolean, isInGame: boolean, gamePhase?: GamePhase | null }) => void;
  'social:request_received': (data: FriendRequest) => void;
  'social:request_accepted': (data: Friend) => void;
  'social:friend_removed': (data: { friendId: number }) => void;
  'social:request_cancelled': (data: { requesterId: number }) => void;
  'social:invite_received': (data: GameInvite) => void;

  // Voice Chat
  'voice:user-joined': (data: { socketId: string }) => void;
  'voice:user-left': (data: { socketId: string }) => void;
  'voice:offer': (data: { fromId: string, sdp: RTCSessionDescriptionInit }) => void;
  'voice:answer': (data: { fromId: string, sdp: RTCSessionDescriptionInit }) => void;
  'voice:ice-candidate': (data: { fromId: string, candidate: RTCIceCandidateInit }) => void;
}