
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import bcrypt from "bcrypt";
import {
  GameState,
  Player,
  GamePhase,
  Role,
  Alignment,
  Quest,
  Message,
  ClientToServerEvents,
  ServerToClientEvents,
  User,
  MatchPlayerPerformance,
  LeaderboardData,
  LeaderboardEntry,
  UserAchievement,
  PlayerStats,
  Achievement as ClientAchievement,
  LogEntry
} from "./types";
import { EVIL_PLAYER_COUNT, QUEST_CONFIGURATIONS, ROLES } from "./constants";
import db from "./db";
import { authMiddleware, generateToken, authMiddlewareSocket, adminMiddleware } from "./auth";
import { ALL_ACHIEVEMENTS, Achievement } from "./achievements";

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
    'http://localhost:3000', // For local development
    'https://wtwmw7ps-3000.inc1.devtunnels.ms', // From your error log
    // Add your Vercel production URL here, e.g., 'https://your-app-name.vercel.app'
];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow Vercel preview deployments
        if (origin && origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        // Allow whitelisted origins + no origin (server-to-server, mobile apps)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // This is crucial for sending auth headers.
};

app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON bodies

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: corsOptions, // Use the same, more robust CORS options for Socket.IO
});

const RECONNECT_TIMEOUT = 60000; // 60 seconds
const RESTART_COOLDOWN = 120000; // 2 minutes
const RESTART_VOTE_DURATION = 30000; // 30 seconds

// --- API ROUTES ---
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || username.length > 10) {
    return res
      .status(400)
      .json({ message: "Username must be between 3 and 10 characters." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, is_admin",
      [username, hashedPassword]
    );
    const { id, is_admin } = result.rows[0];
    const user: User = { id, username, is_admin };
    const token = generateToken(user);
    res.status(201).json({ token, user: { ...user, selectedTitle: null, selectedBorder: null, selectedIcon: null } });
  } catch (error: any) {
    if (error.code === "23505") { // Unique constraint violation
      return res.status(409).json({ message: "Username already exists." });
    }
    res.status(500).json({ message: "Server error during registration." });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }
  try {
    const userRow = await db.get<{
        id: number;
        username: string;
        password_hash: string;
        is_admin: boolean;
        selected_title: string | null;
        selected_border: string | null;
        selected_icon: string | null;
    }>(
      "SELECT id, username, password_hash, is_admin, selected_title, selected_border, selected_icon FROM users WHERE username = $1",
      [username]
    );
    if (!userRow) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const match = await bcrypt.compare(
      password,
      userRow.password_hash
    );
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const user: User = { 
        id: userRow.id, 
        username: userRow.username,
        is_admin: userRow.is_admin,
        selectedTitle: userRow.selected_title,
        selectedBorder: userRow.selected_border,
        selectedIcon: userRow.selected_icon,
    };
    const token = generateToken({ id: user.id, username: user.username, is_admin: user.is_admin });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Server error during login." });
  }
});

app.get("/api/stats", authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const stats = await gameService.getPlayerStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch player stats." });
  }
});

app.get("/api/leaderboard", authMiddleware, async (req, res) => {
  try {
    const leaderboardData = await gameService.getLeaderboard();
    res.json(leaderboardData);
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    res.status(500).json({ message: "Failed to fetch leaderboard data." });
  }
});

app.get("/api/match/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const performances = await db.all<MatchPlayerPerformance[]>(
      "SELECT u.username, pp.role, pp.alignment, pp.won FROM player_performance pp JOIN users u ON pp.user_id = u.id WHERE pp.match_id = $1 ORDER BY u.username",
      [id]
    );
    if (!performances || performances.length === 0) {
      return res.status(404).json({ message: "Match not found." });
    }
    res.json(performances);
  } catch (error) {
    console.error("Failed to fetch match details:", error);
    res.status(500).json({ message: "Failed to fetch match details." });
  }
});

app.get("/api/achievements", authMiddleware, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const userAchievements = await db.all<UserAchievement[]>(
            "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1",
            [userId]
        );
        const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));
        const fullAchievementData = ALL_ACHIEVEMENTS
          .filter(ach => !ach.hidden || unlockedIds.has(ach.id))
          .map(ach => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { check, ...rest } = ach;
            return {
                ...rest,
                unlocked: unlockedIds.has(ach.id),
                unlocked_at: userAchievements.find(ua => ua.achievement_id === ach.id)?.unlocked_at
            }
        });
        res.json(fullAchievementData);
    } catch (error) {
        console.error("Failed to fetch achievements:", error);
        res.status(500).json({ message: "Failed to fetch achievements." });
    }
});

app.post("/api/user/customize", authMiddleware, async (req, res) => {
    const userId = (req as any).user.id;
    const { title, border, icon } = req.body;
    try {
        // Here you would also validate that the user has unlocked this title/border/icon
        // For simplicity, we'll trust the client for now.
        await db.run("UPDATE users SET selected_title = $1, selected_border = $2, selected_icon = $3 WHERE id = $4", [title, border, icon, userId]);
        
        // Update player in any active game session for real-time changes
        gameService.updatePlayerCustomization(userId, { title, border, icon });

        res.json({ success: true, message: "Customizations updated." });
    } catch (error) {
        console.error("Failed to update customizations:", error);
        res.status(500).json({ message: "Failed to update customizations." });
    }
});

app.post("/api/user/username", authMiddleware, async (req, res) => {
    const userId = (req as any).user.id;
    const oldUsername = (req as any).user.username;
    const { username } = req.body;

    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 10) {
        return res.status(400).json({ message: "Username must be between 3 and 10 characters." });
    }

    if (username === oldUsername) {
        return res.status(400).json({ message: "This is already your username." });
    }

    try {
        const existingUser = await db.get("SELECT id FROM users WHERE username = $1 AND id != $2", [username, userId]);
        if (existingUser) {
            return res.status(409).json({ message: "Username is already taken." });
        }

        await db.run("UPDATE users SET username = $1 WHERE id = $2", [username, userId]);
        
        gameService.updatePlayerUsername(userId, username);
        
        const userRow = await db.get<{ is_admin: boolean; selected_title: string | null; selected_border: string | null; selected_icon: string | null; }>(
             "SELECT is_admin, selected_title, selected_border, selected_icon FROM users WHERE id = $1",
             [userId]
        );

        const fullUserObject: User = {
            id: userId,
            username,
            is_admin: userRow?.is_admin,
            selectedTitle: userRow?.selected_title,
            selectedBorder: userRow?.selected_border,
            selectedIcon: userRow?.selected_icon
        };
        
        const token = generateToken(fullUserObject);

        res.json({ success: true, message: "Username updated successfully.", user: fullUserObject, token });

    } catch (error) {
        console.error("Failed to update username:", error);
        res.status(500).json({ message: "Server error during username update." });
    }
});

// --- ADMIN ROUTES ---
const adminRouter = express.Router();
adminRouter.use(authMiddleware, adminMiddleware);

adminRouter.get('/dashboard', async (req, res) => {
    const userCount = await db.get<{count: string}>("SELECT COUNT(*) FROM users");
    const matchCount = await db.get<{count: string}>("SELECT COUNT(*) FROM matches");
    const roomCount = gameService.getRoomCount();
    res.json({
        userCount: parseInt(userCount?.count || '0', 10),
        matchCount: parseInt(matchCount?.count || '0', 10),
        roomCount
    });
});

adminRouter.get('/users', async (req, res) => {
    const users = await db.all("SELECT id, username, created_at, is_admin FROM users ORDER BY created_at DESC");
    res.json(users);
});

adminRouter.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    try {
        await gameService.forceRemoveUserByUserId(userId);
        await db.run("DELETE FROM users WHERE id = $1", [userId]);
        res.json({ success: true, message: 'User deleted successfully.' });
    } catch (error) {
        console.error(`Admin failed to delete user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
});

adminRouter.get('/users/:id/stats', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    try {
        const stats = await db.get(`
            SELECT 
                win_streak, assassin_kills, total_games, total_wins, 
                good_games, good_wins, evil_games, evil_wins 
            FROM users WHERE id = $1`, [userId]);
        if (!stats) return res.status(404).json({ message: 'User not found.' });
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch user stats.' });
    }
});

adminRouter.put('/users/:id/stats', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { win_streak, assassin_kills, total_games, total_wins, good_games, good_wins, evil_games, evil_wins } = req.body;
    try {
        await db.run(`
            UPDATE users SET 
                win_streak = $1, assassin_kills = $2, total_games = $3, total_wins = $4,
                good_games = $5, good_wins = $6, evil_games = $7, evil_wins = $8
            WHERE id = $9`, 
            [win_streak, assassin_kills, total_games, total_wins, good_games, good_wins, evil_games, evil_wins, userId]
        );
        res.json({ success: true, message: 'Stats updated.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update stats.' });
    }
});


adminRouter.get('/rooms', (req, res) => {
    const rooms = gameService.getAllRooms();
    res.json(rooms);
});

adminRouter.delete('/rooms/:roomCode', (req, res) => {
    const { roomCode } = req.params;
    gameService.forceCloseRoom(roomCode);
    res.json({ success: true, message: `Room ${roomCode} has been closed.` });
});

adminRouter.post('/achievements/grant', async (req, res) => {
    const { userId, achievementId } = req.body;
    try {
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return res.status(404).json({ message: 'Achievement not found.'});
        
        await db.run("INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT(user_id, achievement_id) DO NOTHING", [userId, achievementId]);
        res.json({ success: true, message: `Achievement '${achievement.name}' granted.` });
    } catch (error) {
        console.error(`Admin failed to grant achievement:`, error);
        res.status(500).json({ message: 'Failed to grant achievement.' });
    }
});

adminRouter.get('/achievements', (req, res) => {
    res.json(ALL_ACHIEVEMENTS.map(({ check, ...rest }) => rest));
});


app.use('/api/admin', adminRouter);


// --- Achievement Service ---
class AchievementService {
  async checkAndGrantAchievements(
    userId: number, 
    performance: { role: Role; alignment: Alignment; won: boolean; },
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    gameState: GameState,
  ) {
      const stats = await gameService.getPlayerStats(userId);
      const userAchievements = await db.all<UserAchievement[]>("SELECT achievement_id FROM user_achievements WHERE user_id = $1", [userId]);
      const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));

      for (const achievement of ALL_ACHIEVEMENTS) {
          if (!unlockedIds.has(achievement.id)) {
              if (achievement.check(stats, performance)) {
                  await this.grantAchievement(userId, achievement.id, io, gameState);
              }
          }
      }
  }

  private async grantAchievement(userId: number, achievementId: string, io: Server, gameState: GameState) {
      try {
          await db.run("INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)", [userId, achievementId]);
          console.log(`Achievement unlocked for user ${userId}: ${achievementId}`);
          
          const playerInGame = gameState.players.find(p => p.userId === userId);
          if (playerInGame) {
              const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
              if (achievement) {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { check, ...payload } = achievement;
                  const unlockedPayload: ClientAchievement = {
                      ...payload,
                      unlocked: true,
                      unlocked_at: new Date().toISOString()
                  };
                  io.to(playerInGame.id).emit('achievementUnlocked', unlockedPayload);
              }
          }
      } catch (error) {
          // It might fail if granted in another async process, which is fine
          if ((error as any).code !== '23505') { // 23505 is unique_violation in postgres
            console.error(`Failed to grant achievement ${achievementId} to user ${userId}:`, error);
          }
      }
  }
}
const achievementService = new AchievementService();

// --- Game Service ---
class GameService {
  private games: Map<string, GameState> = new Map();
  private reconnectionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private restartVoteTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  private addLog(gameState: GameState, text: string, type: LogEntry['type']) {
      const entry: LogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          text,
          type,
      };
      gameState.gameLog.push(entry);
      if (gameState.gameLog.length > 150) {
          gameState.gameLog.shift();
      }
  }

  private createInitialGameState(roomCode: string): GameState {
    return {
      roomCode,
      players: [],
      phase: GamePhase.LOBBY,
      currentQuest: 1,
      questHistory: [],
      leader: null,
      voteTrack: 0,
      winner: null,
      endGameReason: "",
      chat: [],
      gameLog: [],
      readyPlayers: [],
      endGameReadyPlayers: [],
      reconnectingPlayer: null,
      restartVote: null,
      lastRestartInitiatedAt: null,
      pendingTeam: null,
    };
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private getPlayer(
    gameState: GameState,
    playerId: string
  ): Player | undefined {
    return gameState.players.find((p) => p.id === playerId);
  }

  private findRoomByPlayerId(playerId: string): string | undefined {
    for (const [code, state] of this.games.entries()) {
      if (state.players.some((p) => p.id === playerId)) {
        return code;
      }
    }
    return undefined;
  }

  findGameByPlayerUserId(userId: number): [string, GameState] | undefined {
    for (const [code, state] of this.games.entries()) {
      if (state.players.some((p) => p.userId === userId)) {
        return [code, state];
      }
    }
    return undefined;
  }

  isUserInGame(userId: number): boolean {
    for (const state of this.games.values()) {
      if (
        state.players.some(
          (p) => p.userId === userId && p.status === "CONNECTED"
        )
      ) {
        return true;
      }
    }
    return false;
  }

  async handleJoinRoom(socket: Socket, user: User, roomCode?: string) {
    const existingGame = this.findGameByPlayerUserId(user.id);
    if (existingGame) {
      this.handleReconnect(socket, user, existingGame);
      return;
    }

    let code = roomCode?.toUpperCase();
    let gameState: GameState | undefined;

    if (code) {
      gameState = this.games.get(code);
      if (!gameState || gameState.phase !== GamePhase.LOBBY) {
        socket.emit("error", "Room not found or game already in progress.");
        return;
      }
      if (gameState.players.length >= 10) {
        socket.emit("error", "Room is full.");
        return;
      }
    } else {
      code = this.generateRoomCode();
      gameState = this.createInitialGameState(code);
      this.games.set(code, gameState);
    }
    
    const userCustomizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string; }>(
        "SELECT selected_title, selected_border, selected_icon FROM users WHERE id = $1",
        [user.id]
    );
    
    // --- Voice Chat Integration Start ---
    const otherPlayers = gameState.players.filter(p => p.status === 'CONNECTED');
    for (const player of otherPlayers) {
      // Tell new user about existing players
      socket.emit('voice:user-joined', { socketId: player.id, user: { userId: player.userId, name: player.name }});
      // Tell existing players about new user
      this.io.to(player.id).emit('voice:user-joined', { socketId: socket.id, user: { userId: user.id, name: user.username }});
    }
    // --- Voice Chat Integration End ---

    socket.join(code);
    const isHost = gameState.players.length === 0;
    const newPlayer: Player = {
      id: socket.id,
      userId: user.id,
      name: user.username,
      role: null,
      alignment: null,
      isHost,
      hasVoted: false,
      status: "CONNECTED",
      selectedTitle: userCustomizations?.selected_title,
      selectedBorder: userCustomizations?.selected_border,
      selectedIcon: userCustomizations?.selected_icon,
    };
    gameState.players.push(newPlayer);

    this.io.to(code).emit("updateGameState", gameState);
  }

  async handleReconnect(
    socket: any,
    user: User,
    [roomCode, gameState]: [string, GameState]
  ) {
    console.log(`Attempting to reconnect user ${user.username} to room ${roomCode}`);
    const player = gameState.players.find((p) => p.userId === user.id);
    
    if (!player) {
      socket.emit("error", "Could not find your player in this game to reconnect.");
      return;
    }

    if (gameState.reconnectingPlayer?.userId === user.id) {
        const timer = this.reconnectionTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.reconnectionTimers.delete(roomCode);
        }
        this.addLog(gameState, `${player.name} has reconnected.`, 'system');
        gameState.reconnectingPlayer = null;
    }
    
    // --- Voice Chat Integration Reconnect Start ---
    const otherPlayers = gameState.players.filter(p => p.status === 'CONNECTED' && p.userId !== user.id);
    for (const otherPlayer of otherPlayers) {
        // Tell reconnected user about existing players
        socket.emit('voice:user-joined', { socketId: otherPlayer.id, user: { userId: otherPlayer.userId, name: otherPlayer.name }});
        // Tell existing players about reconnected user
        this.io.to(otherPlayer.id).emit('voice:user-joined', { socketId: socket.id, user: { userId: user.id, name: user.username }});
    }
    // --- Voice Chat Integration Reconnect End ---

    const userCustomizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string; }>(
        "SELECT selected_title, selected_border, selected_icon FROM users WHERE id = $1",
        [user.id]
    );
    player.selectedTitle = userCustomizations?.selected_title;
    player.selectedBorder = userCustomizations?.selected_border;
    player.selectedIcon = userCustomizations?.selected_icon;

    player.id = socket.id;
    player.status = "CONNECTED";
    
    socket.join(roomCode);
    this.io.to(roomCode).emit("updateGameState", gameState);
    console.log(`Successfully reconnected user ${user.username} with new socket ID ${socket.id}`);
  }

  handleStartGame(playerId: string, selectedRoles: Role[]) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;

    if (gameState.reconnectingPlayer) return;

    const player = this.getPlayer(gameState, playerId);
    const socket = this.io.sockets.sockets.get(playerId);

    if (!player || !player.isHost) {
      socket?.emit("error", "Only the host can start the game.");
      return;
    }

    const playerCount = gameState.players.length;
    if (playerCount < 5 || playerCount > 10) {
      socket?.emit(
        "error",
        `Games require 5-10 players. You have ${playerCount}.`
      );
      return;
    }

    const requiredEvilCount =
      EVIL_PLAYER_COUNT[playerCount as keyof typeof EVIL_PLAYER_COUNT];
    const actualEvilCount = selectedRoles.filter(
      (r) => ROLES[r].alignment === Alignment.EVIL
    ).length;

    if (selectedRoles.length !== playerCount) {
      socket?.emit(
        "error",
        `Role selection count (${selectedRoles.length}) does not match player count (${playerCount}).`
      );
      return;
    }
    if (actualEvilCount !== requiredEvilCount) {
      socket?.emit(
        "error",
        `Invalid number of evil roles. For ${playerCount} players, there must be ${requiredEvilCount} evil roles. You have ${actualEvilCount}.`
      );
      return;
    }
    const hasMorgana = selectedRoles.includes(Role.MORGANA);
    const hasPercival = selectedRoles.includes(Role.PERCIVAL);
    if (hasMorgana !== hasPercival) {
      socket?.emit(
        "error",
        "Morgana and Percival must be in the game together."
      );
      return;
    }

    this.assignRoles(gameState, selectedRoles);
    this.setupQuests(gameState);
    gameState.phase = GamePhase.ROLE_REVEAL;
    gameState.leader =
      gameState.players[Math.floor(Math.random() * playerCount)];

    this.addLog(gameState, `The game has begun with ${playerCount} players.`, 'system');
    this.addLog(gameState, `${gameState.leader.name} is the first Quest Leader.`, 'leader');
    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  async getPlayerStats(userId: number): Promise<PlayerStats> {
    const userStats = await db.get<{
        total_games: number;
        total_wins: number;
        good_games: number;
        good_wins: number;
        evil_games: number;
        evil_wins: number;
    }>(
      "SELECT total_games, total_wins, good_games, good_wins, evil_games, evil_wins FROM users WHERE id = $1",
      [userId]
    );

    if (!userStats) {
        return {
            totalGames: 0, totalWins: 0, goodGames: 0, goodWins: 0, evilGames: 0, evilWins: 0,
            winRate: 0, goodWinRate: 0, evilWinRate: 0, recentMatches: [], achievements: []
        };
    }

    const recentMatches = await db.all<any[]>(
      "SELECT m.id, m.winner, pp.role, pp.won, m.played_at FROM matches m JOIN player_performance pp ON m.id = pp.match_id WHERE pp.user_id = $1 ORDER BY m.played_at DESC LIMIT 10",
      [userId]
    );
    const achievements = await db.all<UserAchievement[]>(
      "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1",
      [userId]
    );

    const { total_games, total_wins, good_games, good_wins, evil_games, evil_wins } = userStats;

    return {
      totalGames: total_games,
      totalWins: total_wins,
      goodGames: good_games,
      goodWins: good_wins,
      evilGames: evil_games,
      evilWins: evil_wins,
      winRate: total_games
        ? Math.round((total_wins / total_games) * 100)
        : 0,
      goodWinRate: good_games
        ? Math.round((good_wins / good_games) * 100)
        : 0,
      evilWinRate: evil_games
        ? Math.round((evil_wins / evil_games) * 100)
        : 0,
      recentMatches: recentMatches.map((m) => ({
        id: m.id,
        winner: m.winner,
        role: m.role,
        won: !!m.won,
        playedAt: m.played_at,
      })),
      achievements: achievements,
    };
  }

  async getLeaderboard(): Promise<LeaderboardData> {
     const allUsers: { 
        id: number;
        username: string; 
        win_streak: number; 
        assassin_kills: number;
        total_games: number;
        total_wins: number;
        good_wins: number;
        evil_wins: number;
    }[] = await db.all(`
        SELECT id, username, win_streak, assassin_kills, 
               total_games, total_wins, good_wins, evil_wins 
        FROM users WHERE total_games > 0
    `);
    
    const leaderboard: LeaderboardData = {
        totalWins: [],
        winRate: [],
        topAssassins: [],
        winStreaks: [],
        bestGood: [],
        bestEvil: [],
    };

    for (const user of allUsers) {
        const winRateValue = user.total_games > 0 ? Math.round((user.total_wins / user.total_games) * 100) : 0;

        leaderboard.totalWins.push({ username: user.username, value: user.total_wins });
        leaderboard.winRate.push({ username: user.username, value: winRateValue });
        leaderboard.topAssassins.push({ username: user.username, value: user.assassin_kills });
        leaderboard.winStreaks.push({ username: user.username, value: user.win_streak });
        leaderboard.bestGood.push({ username: user.username, value: user.good_wins });
        leaderboard.bestEvil.push({ username: user.username, value: user.evil_wins });
    }

    // Sort all categories with a secondary sort by username for stability
    const sortByValue = (a: LeaderboardEntry, b: LeaderboardEntry) => {
        const diff = (b.value as number) - (a.value as number);
        return diff !== 0 ? diff : a.username.localeCompare(b.username);
    };
    
    leaderboard.totalWins.sort(sortByValue);
    leaderboard.winRate.sort(sortByValue);
    leaderboard.topAssassins.sort(sortByValue);
    leaderboard.winStreaks.sort(sortByValue);
    leaderboard.bestGood.sort(sortByValue);
    leaderboard.bestEvil.sort(sortByValue);

    return leaderboard;
  }

  async endGame(
    gameState: GameState,
    winner: Alignment | null,
    reason: string
  ) {
    const roomCode = gameState.roomCode;
    if (!roomCode) return;

    this.addLog(gameState, `Game Over: ${reason}`, 'system');

    const timer = this.reconnectionTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(roomCode);
    }
    const voteTimer = this.restartVoteTimers.get(roomCode);
    if (voteTimer) {
      clearTimeout(voteTimer);
      this.restartVoteTimers.delete(roomCode);
    }

    gameState.phase = GamePhase.END_GAME;
    gameState.winner = winner;
    gameState.endGameReason = reason;
    gameState.reconnectingPlayer = null;
    gameState.restartVote = null;
    gameState.pendingTeam = null;

    if (winner) {
      try {
        const matchResult = await db.run(
          "INSERT INTO matches (winner) VALUES ($1) RETURNING id",
          [winner]
        );
        const matchId = matchResult.rows[0].id;

        for (const player of gameState.players) {
          if (player.role && player.alignment && player.userId) {
            const won = player.alignment === winner;
            const performance = {
              user_id: player.userId,
              match_id: matchId,
              role: player.role,
              alignment: player.alignment,
              won,
            };
            await db.run(
              "INSERT INTO player_performance (user_id, match_id, role, alignment, won) VALUES ($1, $2, $3, $4, $5)",
              [ performance.user_id, performance.match_id, performance.role, performance.alignment, performance.won ]
            );
            
            // Update denormalized stats
            const goodGameIncrement = player.alignment === Alignment.GOOD ? 1 : 0;
            const evilGameIncrement = player.alignment === Alignment.EVIL ? 1 : 0;
            const goodWinIncrement = (player.alignment === Alignment.GOOD && won) ? 1 : 0;
            const evilWinIncrement = (player.alignment === Alignment.EVIL && won) ? 1 : 0;
            const winIncrement = won ? 1 : 0;
            
            await db.run(`
              UPDATE users 
              SET 
                total_games = total_games + 1,
                total_wins = total_wins + $1,
                good_games = good_games + $2,
                good_wins = good_wins + $3,
                evil_games = evil_games + $4,
                evil_wins = evil_wins + $5,
                win_streak = CASE WHEN $1 = 1 THEN win_streak + 1 ELSE 0 END
              WHERE id = $6
            `, [winIncrement, goodGameIncrement, goodWinIncrement, evilGameIncrement, evilWinIncrement, player.userId]);


            // Check for achievements
            await achievementService.checkAndGrantAchievements(player.userId, performance, this.io, gameState);
          }
        }
      } catch (e) {
        console.error("Failed to save match results:", e);
      }
    }

    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  handlePlayerReady(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;

    if (gameState.reconnectingPlayer) return;
    if (gameState.phase !== GamePhase.ROLE_REVEAL) return;

    if (!gameState.readyPlayers.includes(playerId)) {
      gameState.readyPlayers.push(playerId);
    }

    if (gameState.readyPlayers.length === gameState.players.length) {
      this.addLog(gameState, `All players are ready. Starting Quest ${gameState.currentQuest}.`, 'system');
      gameState.phase = GamePhase.TEAM_SELECTION;
      gameState.readyPlayers = [];
    }

    this.io.to(roomCode).emit("updateGameState", gameState);
  }
  
  private async restartGameByRoomCode(roomCode: string) {
    const gameState = this.games.get(roomCode);
    if(!gameState) return;

    // Preserve chat and players
    const preservedChat = gameState.chat;
    const preservedLog = gameState.gameLog;
    const originalPlayerInfos = await Promise.all(gameState.players.map(async (p) => {
        const customizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string }>(
            "SELECT selected_title, selected_border, selected_icon FROM users WHERE id = $1", [p.userId]
        );
        return {
            id: p.id,
            userId: p.userId,
            name: p.name,
            role: null,
            alignment: null,
            isHost: p.isHost,
            hasVoted: false,
            status: "CONNECTED" as "CONNECTED", // Reset status
            selectedTitle: customizations?.selected_title,
            selectedBorder: customizations?.selected_border,
            selectedIcon: customizations?.selected_icon,
        };
    }));


    const newGameState = this.createInitialGameState(roomCode);
    newGameState.players = originalPlayerInfos;
    newGameState.chat = preservedChat;
    newGameState.gameLog = preservedLog;
    newGameState.pendingTeam = null;

    // Re-assign host if the original host disconnected
    if (!newGameState.players.some(p => p.isHost)) {
      const connected = newGameState.players.filter(p => p.status === 'CONNECTED');
      if (connected.length > 0) {
        connected[0].isHost = true;
      }
    }

    this.games.set(roomCode, newGameState);
    this.io.to(roomCode).emit("updateGameState", newGameState);
  }

  handlePlayerReadyForNextGame(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    
    if (gameState.phase !== GamePhase.END_GAME) return;
    
    if (!gameState.endGameReadyPlayers.includes(playerId)) {
      gameState.endGameReadyPlayers.push(playerId);
    }

    const connectedPlayers = gameState.players.filter(p => p.status === 'CONNECTED');
    if (connectedPlayers.length > 0 && gameState.endGameReadyPlayers.length === connectedPlayers.length) {
      this.restartGameByRoomCode(roomCode);
    } else {
      this.io.to(roomCode).emit("updateGameState", gameState);
    }
  }

  private handleReconnectTimeout(roomCode: string) {
    const gameState = this.games.get(roomCode);
    if (!gameState || !gameState.reconnectingPlayer) return;
  
    const { name, userId } = gameState.reconnectingPlayer;
    console.log(`Reconnect timeout for ${name} in room ${roomCode}.`);
    
    this.reconnectionTimers.delete(roomCode);
  
    if (gameState.phase === GamePhase.LOBBY) {
      gameState.players = gameState.players.filter(p => p.userId !== userId);
      
      this.io.to(roomCode).emit("chatMessage", { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${name} left the lobby.`});
      this.addLog(gameState, `${name} left the lobby.`, 'system');

      if (gameState.players.length === 0) {
          this.games.delete(roomCode);
          console.log(`Lobby ${roomCode} is empty, deleting.`);
          return;
      }
      if (!gameState.players.some(p => p.isHost)) {
          gameState.players[0].isHost = true;
      }
      gameState.reconnectingPlayer = null;
      this.io.to(roomCode).emit("updateGameState", gameState);
  
    } else {
      this.abortGameForReconnectFailure(roomCode);
    }
  }

  private abortGameForReconnectFailure(roomCode: string) {
    const gameState = this.games.get(roomCode);
    if (gameState && gameState.reconnectingPlayer) {
      this.endGame(
        gameState,
        null,
        `${gameState.reconnectingPlayer.name} failed to reconnect. The game has been aborted.`
      );
    }
  }

  handleDisconnect(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;

    const disconnectedPlayer = this.getPlayer(gameState, playerId);
    if (!disconnectedPlayer) return;

    disconnectedPlayer.status = "DISCONNECTED";
    this.addLog(gameState, `${disconnectedPlayer.name} has disconnected.`, 'system');
    
    // Voice Chat: Notify others the user left
    this.io.to(roomCode).emit('voice:user-left', { socketId: playerId });


     if (gameState.phase === GamePhase.END_GAME) {
       gameState.endGameReadyPlayers = gameState.endGameReadyPlayers.filter(id => id !== playerId);

       const connectedPlayers = gameState.players.filter(p => p.status === 'CONNECTED');
       if (connectedPlayers.length > 0 && gameState.endGameReadyPlayers.length === connectedPlayers.length) {
         this.restartGameByRoomCode(roomCode);
       } else {
         this.io.to(roomCode).emit("updateGameState", gameState);
       }
       return;
     }

    if (gameState.reconnectingPlayer) {
        this.io.to(roomCode).emit("updateGameState", gameState);
        return;
    }

    const endsAt = Date.now() + RECONNECT_TIMEOUT;
    gameState.reconnectingPlayer = {
      userId: disconnectedPlayer.userId,
      name: disconnectedPlayer.name,
      endsAt,
    };
    
    if (gameState.phase === GamePhase.LOBBY && disconnectedPlayer.isHost) {
        const connectedPlayers = gameState.players.filter(p => p.status === 'CONNECTED');
        if (connectedPlayers.length > 0) {
            connectedPlayers[0].isHost = true;
        }
    }

    const timer = setTimeout(() => {
        const currentGameState = this.games.get(roomCode);
        if (currentGameState && currentGameState.reconnectingPlayer?.userId === disconnectedPlayer.userId) {
            this.handleReconnectTimeout(roomCode);
        }
    }, RECONNECT_TIMEOUT);

    this.reconnectionTimers.set(roomCode, timer);
    
    this.io.to(roomCode).emit("updateGameState", gameState);
    console.log(
      `Player ${disconnectedPlayer.name} disconnected from ${roomCode}. Starting ${RECONNECT_TIMEOUT / 1000}s timer.`
    );
  }

  private assignRoles(gameState: GameState, rolesToAssign: Role[]) {
    const shuffledRoles = [...rolesToAssign];
    for (let i = shuffledRoles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledRoles[i], shuffledRoles[j]] = [
        shuffledRoles[j],
        shuffledRoles[i],
      ];
    }

    gameState.players.forEach((player, index) => {
      const role = shuffledRoles[index];
      player.role = role;
      player.alignment = ROLES[role].alignment;
    });
  }

  private setupQuests(gameState: GameState) {
    const playerCount = gameState.players.length;
    gameState.questHistory = QUEST_CONFIGURATIONS[
      playerCount as keyof typeof QUEST_CONFIGURATIONS
    ].map((config, i) => ({
      questNumber: i + 1,
      teamSize: config.teamSize,
      failsRequired: config.failsRequired,
      status: "PENDING",
      team: [],
      votes: [],
      results: [],
      pastVotes: [],
      questLeader: null,
      approvedVote: null,
    }));
    gameState.questHistory[0].status = "ACTIVE";
  }

  handleUpdatePendingTeam(playerId: string, teamPlayerIds: string[]) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;

    if (
      gameState.leader?.id !== playerId ||
      gameState.phase !== GamePhase.TEAM_SELECTION
    )
      return;

    gameState.pendingTeam = teamPlayerIds;
    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  handleSelectTeam(playerId: string, teamPlayerIds: string[]) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    if (gameState.reconnectingPlayer) return;

    if (
      gameState.leader?.id !== playerId ||
      gameState.phase !== GamePhase.TEAM_SELECTION
    )
      return;

    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
    if (teamPlayerIds.length !== currentQuest.teamSize) {
      this.io.sockets.sockets
        .get(playerId)
        ?.emit(
          "error",
          `You must select ${currentQuest.teamSize} players for this quest.`
        );
      return;
    }

    currentQuest.team = gameState.players.filter((p) =>
      teamPlayerIds.includes(p.id)
    );
    currentQuest.votes = [];
    gameState.phase = GamePhase.TEAM_VOTE;
    gameState.players.forEach((p) => (p.hasVoted = false));
    gameState.pendingTeam = null;

    this.addLog(gameState, `${gameState.leader!.name} has proposed a team: ${currentQuest.team.map(p => p.name).join(', ')}.`, 'team');
    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  handleVoteOnTeam(playerId: string, vote: "APPROVE" | "REJECT") {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    if (gameState.reconnectingPlayer) return;

    const player = this.getPlayer(gameState, playerId);

    if (!player || player.hasVoted || gameState.phase !== GamePhase.TEAM_VOTE)
      return;

    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
    currentQuest.votes.push({ playerId, vote });
    player.hasVoted = true;
    this.io.to(roomCode).emit("updateGameState", { ...gameState });

    const connectedPlayers = gameState.players.filter(
      (p) => p.status === "CONNECTED"
    );
    if (currentQuest.votes.length === connectedPlayers.length) {
      this.processTeamVote(gameState);
    }
  }

  private processTeamVote(gameState: GameState) {
    const roomCode = gameState.roomCode!;
    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
    const connectedPlayers = gameState.players.filter(
      (p) => p.status === "CONNECTED"
    );
    const approvals = currentQuest.votes.filter(
      (v) => v.vote === "APPROVE"
    ).length;
    const rejections = connectedPlayers.length - approvals;

    if (approvals > connectedPlayers.length / 2) {
      this.addLog(gameState, `Team Approved. Votes: ${approvals} Approve, ${rejections} Reject.`, 'vote');
      gameState.phase = GamePhase.QUEST_VOTE;
      gameState.voteTrack = 0;
      currentQuest.questLeader = gameState.leader;
      currentQuest.approvedVote = {
        team: currentQuest.team,
        votes: currentQuest.votes,
      };
    } else {
      gameState.voteTrack++;
      this.addLog(gameState, `Team Rejected. Votes: ${approvals} Approve, ${rejections} Reject. Vote Track is now ${gameState.voteTrack}/5.`, 'vote');
      currentQuest.pastVotes.push({
        leader: gameState.leader,
        team: currentQuest.team,
        votes: currentQuest.votes,
      });

      if (gameState.voteTrack >= 5) {
        this.endGame(
          gameState,
          Alignment.EVIL,
          "Five consecutive teams were rejected. The kingdom falls into chaos."
        );
        return;
      }
      this.advanceLeader(gameState);
      this.addLog(gameState, `${gameState.leader!.name} is the new Quest Leader.`, 'leader');
      gameState.phase = GamePhase.TEAM_SELECTION;
      gameState.pendingTeam = null;
    }

    currentQuest.team =
      approvals > connectedPlayers.length / 2 ? currentQuest.team : [];
    currentQuest.votes = [];
    gameState.players.forEach((p) => (p.hasVoted = false));
    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  handleVoteOnQuest(playerId: string, vote: "SUCCESS" | "FAIL") {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    if (gameState.reconnectingPlayer) return;

    const player = this.getPlayer(gameState, playerId);
    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];

    if (
      !player ||
      player.hasVoted ||
      !currentQuest.team.some((p) => p.id === playerId) ||
      gameState.phase !== GamePhase.QUEST_VOTE
    )
      return;

    if (player.alignment === Alignment.GOOD && vote === "FAIL") {
      this.io.sockets.sockets
        .get(playerId)
        ?.emit("error", "Loyal servants cannot vote to fail a quest.");
      return;
    }

    currentQuest.results.push({ playerId, vote });
    player.hasVoted = true;
    this.io.to(roomCode).emit("updateGameState", { ...gameState });

    if (currentQuest.results.length === currentQuest.team.length) {
      this.processQuestResult(gameState);
    }
  }

  private processQuestResult(gameState: GameState) {
    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
    const failVotes = currentQuest.results.filter((r) => r.vote === "FAIL").length;

    if (failVotes >= currentQuest.failsRequired) {
      currentQuest.status = "FAILED";
      this.addLog(gameState, `Quest ${gameState.currentQuest} has Failed with ${failVotes} fail vote(s).`, 'quest');
    } else {
      currentQuest.status = "PASSED";
      this.addLog(gameState, `Quest ${gameState.currentQuest} has Succeeded.`, 'quest');
    }

    gameState.phase = GamePhase.QUEST_RESULT;
    this.io.to(gameState.roomCode!).emit("updateGameState", gameState);
    setTimeout(() => this.checkForGameOver(gameState), 8000);
  }

  private checkForGameOver(gameState: GameState) {
    if (!gameState.roomCode || gameState.reconnectingPlayer) return;
    const passedQuests = gameState.questHistory.filter(
      (q) => q.status === "PASSED"
    ).length;
    const failedQuests = gameState.questHistory.filter(
      (q) => q.status === "FAILED"
    ).length;

    if (failedQuests >= 3) {
      this.endGame(
        gameState,
        Alignment.EVIL,
        "Three quests have failed. The forces of Evil have triumphed."
      );
      return;
    }

    if (passedQuests >= 3) {
      this.addLog(gameState, 'Three quests have passed! The Assassin prepares to strike...', 'assassination');
      gameState.phase = GamePhase.ASSASSINATION;
      this.io.to(gameState.roomCode).emit("updateGameState", gameState);
      return;
    }

    gameState.currentQuest++;
    gameState.questHistory[gameState.currentQuest - 1].status = "ACTIVE";
    this.advanceLeader(gameState);
    this.addLog(gameState, `Starting Quest ${gameState.currentQuest}. ${gameState.leader!.name} is the Quest Leader.`, 'leader');
    gameState.phase = GamePhase.TEAM_SELECTION;
    gameState.players.forEach((p) => (p.hasVoted = false));
    this.io.to(gameState.roomCode).emit("updateGameState", gameState);
  }

  async handleAssassinate(assassinId: string, targetId: string) {
    const roomCode = this.findRoomByPlayerId(assassinId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    if (gameState.reconnectingPlayer) return;

    const assassin = this.getPlayer(gameState, assassinId);
    if (!assassin || assassin.role !== Role.ASSASSIN || gameState.phase !== GamePhase.ASSASSINATION) return;

    const target = this.getPlayer(gameState, targetId);
    this.addLog(gameState, `The Assassin has targeted ${target!.name}.`, 'assassination');
    if (target?.role === Role.MERLIN) {
      await db.run("UPDATE users SET assassin_kills = assassin_kills + 1 WHERE id = $1", [assassin.userId]);
      this.endGame(gameState, Alignment.EVIL, `The Assassin has slain Merlin! Evil wins!`);
    } else {
      this.endGame(gameState, Alignment.GOOD, `The Assassin chose poorly. Merlin survives! The kingdom is safe.`);
    }
  }

  handleSendMessage(playerId: string, messageText: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const player = this.getPlayer(gameState, playerId);
    if (!player) return;

    const message: Message = {
      senderId: playerId,
      senderUserId: player.userId,
      senderName: player.name,
      text: messageText,
    };

    gameState.chat.push(message);
    if (gameState.chat.length > 100) {
      gameState.chat.shift();
    }

    this.io.to(roomCode).emit("chatMessage", message);
  }

  private advanceLeader(gameState: GameState) {
    if (!gameState.leader) return;
    const connectedPlayers = gameState.players.filter(
      (p) => p.status === "CONNECTED"
    );
    if (connectedPlayers.length === 0) return;
    const currentIndex = connectedPlayers.findIndex(
      (p) => p.id === gameState.leader?.id
    );
    const nextIndex = (currentIndex + 1) % connectedPlayers.length;
    gameState.leader = connectedPlayers[nextIndex];
  }

  // --- Restart Logic ---
  handleInitiateRestart(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const player = this.getPlayer(gameState, playerId);
    const socket = this.io.sockets.sockets.get(playerId);

    if (!player?.isHost) {
      socket?.emit("error", "Only the host can initiate a restart.");
      return;
    }
    if (gameState.restartVote) {
      socket?.emit("error", "A restart vote is already in progress.");
      return;
    }
    const now = Date.now();
    if (gameState.lastRestartInitiatedAt && (now - gameState.lastRestartInitiatedAt) < RESTART_COOLDOWN) {
      socket?.emit("error", "Restart can only be initiated every 2 minutes.");
      return;
    }

    gameState.lastRestartInitiatedAt = now;
    gameState.restartVote = {
      initiatorId: player.id,
      initiatorName: player.name,
      votes: { [player.id]: 'yes' },
      endsAt: now + RESTART_VOTE_DURATION
    };

    this.addLog(gameState, `${player.name} has initiated a vote to restart the game.`, 'system');
    const timer = setTimeout(() => this.processRestartVote(gameState), RESTART_VOTE_DURATION);
    this.restartVoteTimers.set(roomCode, timer);

    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  handleVoteOnRestart(playerId: string, vote: 'yes' | 'no') {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;

    if (!gameState.restartVote || gameState.restartVote.votes[playerId]) {
      return;
    }

    gameState.restartVote.votes[playerId] = vote;
    
    const connectedPlayers = gameState.players.filter(p => p.status === 'CONNECTED');
    if (Object.keys(gameState.restartVote.votes).length === connectedPlayers.length) {
      const timer = this.restartVoteTimers.get(roomCode);
      if (timer) clearTimeout(timer);
      this.processRestartVote(gameState);
    } else {
      this.io.to(roomCode).emit("updateGameState", gameState);
    }
  }

  private processRestartVote(gameState: GameState) {
    if (!gameState.restartVote || !gameState.roomCode) return;
    
    const { votes } = gameState.restartVote;
    const roomCode = gameState.roomCode;
    const connectedPlayersCount = gameState.players.filter(p => p.status === 'CONNECTED').length;
    const yesVotes = Object.values(votes).filter(v => v === 'yes').length;

    if (yesVotes > connectedPlayersCount / 2) {
      this.addLog(gameState, 'Restart vote passed. The game will return to the lobby.', 'system');
      this.io.to(roomCode).emit("chatMessage", { senderId: 'system', senderUserId: 0, senderName: 'System', text: 'Vote passed! The game will now restart.' });
      this.restartGameByRoomCode(roomCode);
    } else {
      this.addLog(gameState, 'Restart vote failed. The game will continue.', 'system');
      this.io.to(roomCode).emit("chatMessage", { senderId: 'system', senderUserId: 0, senderName: 'System', text: 'Vote failed. The game will continue.' });
      gameState.restartVote = null;
      this.io.to(roomCode).emit("updateGameState", gameState);
    }
    
    this.restartVoteTimers.delete(roomCode);
  }

  handleLeaveRoom(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    
    if (gameState.phase !== GamePhase.LOBBY) {
        this.handleDisconnect(playerId);
        return;
    }

    const leavingPlayer = this.getPlayer(gameState, playerId);
    if (!leavingPlayer) return;

    const socket = this.io.sockets.sockets.get(playerId);
    if (socket) {
        // Explicitly tell the leaving client to reset its state.
        socket.emit("kicked", "You have left the lobby.");
        socket.leave(roomCode);
    }

    // Voice Chat: Notify others
    this.io.to(roomCode).emit('voice:user-left', { socketId: playerId });
    
    gameState.players = gameState.players.filter(p => p.id !== playerId);

    if (gameState.players.length === 0) {
        this.games.delete(roomCode);
        console.log(`Lobby ${roomCode} is empty, deleting.`);
        return;
    }

    if (leavingPlayer.isHost) {
        gameState.players[0].isHost = true;
    }

    this.io.to(roomCode).emit("updateGameState", gameState);
    this.io.to(roomCode).emit("chatMessage", {
        senderId: 'system',
        senderUserId: 0,
        senderName: 'System',
        text: `${leavingPlayer.name} has left the lobby.`
    });
  }

  handleKickPlayer(hostId: string, playerIdToKick: string) {
    const roomCode = this.findRoomByPlayerId(hostId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;

    const host = this.getPlayer(gameState, hostId);
    const playerToKick = this.getPlayer(gameState, playerIdToKick);

    if (!host || !host.isHost) {
      this.io.sockets.sockets.get(hostId)?.emit("error", "Only the host can kick players.");
      return;
    }
    if (!playerToKick) {
      this.io.sockets.sockets.get(hostId)?.emit("error", "Player to kick not found.");
      return;
    }
     if (hostId === playerIdToKick) {
      this.io.sockets.sockets.get(hostId)?.emit("error", "You cannot kick yourself.");
      return;
    }

    const kickedPlayerName = playerToKick.name;
    const kickedSocket = this.io.sockets.sockets.get(playerIdToKick);

    if (kickedSocket) {
        // Let the kicked player know they were kicked and should reset state
        kickedSocket.emit("kicked", "You have been kicked from the game by the host.");
        kickedSocket.leave(roomCode);
    }
    
    // Voice Chat: Notify others
    this.io.to(roomCode).emit('voice:user-left', { socketId: playerIdToKick });

    if (gameState.phase === GamePhase.LOBBY) {
        gameState.players = gameState.players.filter(p => p.id !== playerIdToKick);
        this.addLog(gameState, `${kickedPlayerName} was kicked by the host.`, 'system');
        this.io.to(roomCode).emit("chatMessage", { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${kickedPlayerName} was kicked by the host.` });
        this.io.to(roomCode).emit("updateGameState", gameState);
    } else {
        // In game, kicking aborts the game
        this.endGame(
            gameState,
            null,
            `${kickedPlayerName} was kicked by the host. The game has been aborted.`
        );
    }
  }

  updatePlayerCustomization(userId: number, customizations: { title: string | null; border: string | null; icon: string | null; }) {
    const gameInfo = this.findGameByPlayerUserId(userId);
    if (gameInfo) {
      const [roomCode, gameState] = gameInfo;
      const playerInGame = gameState.players.find(p => p.userId === userId);
      if (playerInGame) {
        playerInGame.selectedTitle = customizations.title;
        playerInGame.selectedBorder = customizations.border;
        playerInGame.selectedIcon = customizations.icon;
        this.io.to(roomCode).emit("updateGameState", gameState);
        console.log(`Pushed real-time customization update for ${playerInGame.name} to room ${roomCode}.`);
      }
    }
  }

  updatePlayerUsername(userId: number, newUsername: string) {
    const gameInfo = this.findGameByPlayerUserId(userId);
    if (gameInfo) {
      const [roomCode, gameState] = gameInfo;
      const playerInGame = gameState.players.find(p => p.userId === userId);
      const oldUsername = playerInGame?.name;
      if (playerInGame) {
        playerInGame.name = newUsername;
        
        // Update leader name if it was this player
        if (gameState.leader?.userId === userId) {
            gameState.leader.name = newUsername;
        }

        this.io.to(roomCode).emit("updateGameState", gameState);
        this.io.to(roomCode).emit("chatMessage", {
            senderId: 'system',
            senderUserId: 0,
            senderName: 'System',
            text: `${oldUsername} is now known as ${newUsername}.`
        });
        console.log(`Pushed real-time username update for ${userId} to ${newUsername} in room ${roomCode}.`);
      }
    }
  }
  
  // --- Admin Methods ---
  getRoomCount() {
    return this.games.size;
  }
  
  getAllRooms() {
    return Array.from(this.games.values()).map(state => ({
        roomCode: state.roomCode,
        playerCount: state.players.length,
        phase: state.phase,
        players: state.players.map(p => ({ name: p.name, status: p.status }))
    }));
  }
  
  forceCloseRoom(roomCode: string) {
    const gameState = this.games.get(roomCode.toUpperCase());
    if (gameState) {
      this.io.to(roomCode).emit("kicked", "This room has been closed by an administrator.");
      this.io.in(roomCode).disconnectSockets(true);
      this.games.delete(roomCode.toUpperCase());
      console.log(`Admin forced closed room: ${roomCode}`);
    }
  }
  
  forceRemoveUserByUserId(userId: number) {
    const gameInfo = this.findGameByPlayerUserId(userId);
    if (gameInfo) {
      const [roomCode, gameState] = gameInfo;
      const player = gameState.players.find(p => p.userId === userId);
      if (player) {
        const socket = this.io.sockets.sockets.get(player.id);
        if (socket) {
          socket.emit("kicked", "You have been removed from the game by an administrator.");
          socket.leave(roomCode);
          socket.disconnect(true);
        }
        // Proceed to disconnect, which will handle player removal from state
        this.handleDisconnect(player.id);
        console.log(`Admin forced removal of user ${userId} from room ${roomCode}`);
      }
    }
  }
}

const gameService = new GameService(io);

io.use(authMiddlewareSocket);

io.on("connection", (socket: any) => {
  console.log(`A user connected: ${socket.id}, username: ${socket.user.username}`);

  const gameToRejoin = gameService.findGameByPlayerUserId(socket.user.id);
  if (gameToRejoin) {
    gameService.handleReconnect(socket, socket.user, gameToRejoin);
  }

  socket.on("joinRoom", ({ roomCode }) => gameService.handleJoinRoom(socket, socket.user, roomCode));
  socket.on("leaveRoom", () => gameService.handleLeaveRoom(socket.id));
  socket.on("startGame", (data) => gameService.handleStartGame(socket.id, data.selectedRoles));
  socket.on("playerReady", () => gameService.handlePlayerReady(socket.id));
  socket.on("playerReadyForNextGame", () => gameService.handlePlayerReadyForNextGame(socket.id));
  socket.on("selectTeam", (teamPlayerIds) => gameService.handleSelectTeam(socket.id, teamPlayerIds));
  socket.on("updatePendingTeam", (teamPlayerIds) => gameService.handleUpdatePendingTeam(socket.id, teamPlayerIds));
  socket.on("voteOnTeam", (vote) => gameService.handleVoteOnTeam(socket.id, vote));
  socket.on("voteOnQuest", (vote) => gameService.handleVoteOnQuest(socket.id, vote));
  socket.on("assassinate", (targetId) => gameService.handleAssassinate(socket.id, targetId));
  socket.on("sendMessage", (message) => gameService.handleSendMessage(socket.id, message));
  socket.on("initiateRestart", () => gameService.handleInitiateRestart(socket.id));
  socket.on("voteOnRestart", (vote) => gameService.handleVoteOnRestart(socket.id, vote));
  socket.on("kickPlayer", (playerIdToKick) => gameService.handleKickPlayer(socket.id, playerIdToKick));

  // --- Voice Chat Signaling ---
  socket.on('voice:offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('voice:offer', { fromId: socket.id, sdp });
  });

  socket.on('voice:answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('voice:answer', { fromId: socket.id, sdp });
  });

  socket.on('voice:ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('voice:ice-candidate', { fromId: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    gameService.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
