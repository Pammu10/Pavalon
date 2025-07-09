import express, { Request, Response } from "express";
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
} from "./types";
import { EVIL_PLAYER_COUNT, QUEST_CONFIGURATIONS, ROLES } from "./constants";
import db from "./db";
import { authMiddleware, generateToken, authMiddlewareSocket } from "./auth";

const app = express();
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const RECONNECT_TIMEOUT = 60000; // 60 seconds

// --- API ROUTES ---
app.post("/api/register", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, hashedPassword]
    );
    const user: User = { id: result.lastID!, username };
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ message: "Username already exists." });
    }
    res.status(500).json({ message: "Server error during registration." });
  }
});

app.post("/api/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }
  try {
    const userRow = await db.get<User>(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
      [username]
    );
    if (!userRow) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const match = await bcrypt.compare(
      password,
      (userRow as any).password_hash
    );
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const user: User = { id: userRow.id, username: userRow.username };
    const token = generateToken(user);
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

app.get("/api/match/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const performances = await db.all<MatchPlayerPerformance>(
      "SELECT u.username, pp.role, pp.alignment, pp.won FROM player_performance pp JOIN users u ON pp.user_id = u.id WHERE pp.match_id = ? ORDER BY u.username",
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

// --- Game Service ---
class GameService {
  private games: Map<string, GameState> = new Map();
  private reconnectionTimers: Map<string, NodeJS.Timeout> = new Map();
  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
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
      readyPlayers: [],
      reconnectingPlayer: null,
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

  findGameByReconnectingUserId(
    userId: number
  ): [string, GameState] | undefined {
    for (const [code, state] of this.games.entries()) {
      if (state.reconnectingPlayer?.userId === userId) {
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

  handleJoinRoom(socket: Socket, user: User, roomCode?: string) {
    if (this.isUserInGame(user.id)) {
      socket.emit("error", "You are already in a game in another tab.");
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
    } else {
      code = this.generateRoomCode();
      gameState = this.createInitialGameState(code);
      this.games.set(code, gameState);
    }

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
    };
    gameState.players.push(newPlayer);

    this.io.to(code).emit("updateGameState", gameState);
  }

  handleReconnect(
    socket: any,
    user: User,
    [roomCode, gameState]: [string, GameState]
  ) {
    console.log(`Reconnecting user ${user.username} to room ${roomCode}`);
    const timer = this.reconnectionTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(roomCode);
    }

    const player = gameState.players.find((p) => p.userId === user.id);
    if (player) {
      player.id = socket.id;
      player.status = "CONNECTED";
    }

    gameState.reconnectingPlayer = null;
    socket.join(roomCode);
    this.io.to(roomCode).emit("updateGameState", gameState);
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

    // Validation logic for roles...
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

    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  async getPlayerStats(userId: number) {
    // ... (existing implementation)
    const totalGames = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM player_performance WHERE user_id = ?",
      [userId]
    );
    const wins = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM player_performance WHERE user_id = ? AND won = 1",
      [userId]
    );
    const goodGames = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM player_performance WHERE user_id = ? AND alignment = ?",
      [userId, Alignment.GOOD]
    );
    const goodWins = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM player_performance WHERE user_id = ? AND alignment = ? AND won = 1",
      [userId, Alignment.GOOD]
    );
    const evilGames = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM player_performance WHERE user_id = ? AND alignment = ?",
      [userId, Alignment.EVIL]
    );
    const evilWins = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM player_performance WHERE user_id = ? AND alignment = ? AND won = 1",
      [userId, Alignment.EVIL]
    );
    const recentMatches = await db.all<any[]>(
      "SELECT m.id, m.winner, pp.role, pp.won, m.played_at FROM matches m JOIN player_performance pp ON m.id = pp.match_id WHERE pp.user_id = ? ORDER BY m.played_at DESC LIMIT 10",
      [userId]
    );

    return {
      totalGames: totalGames?.count || 0,
      totalWins: wins?.count || 0,
      goodGames: goodGames?.count || 0,
      goodWins: goodWins?.count || 0,
      evilGames: evilGames?.count || 0,
      evilWins: evilWins?.count || 0,
      winRate: totalGames?.count
        ? Math.round((wins!.count / totalGames.count) * 100)
        : 0,
      goodWinRate: goodGames?.count
        ? Math.round((goodWins!.count / goodGames.count) * 100)
        : 0,
      evilWinRate: evilGames?.count
        ? Math.round((evilWins!.count / evilGames.count) * 100)
        : 0,
      recentMatches: recentMatches.map((m) => ({
        id: m.id,
        winner: m.winner,
        role: m.role,
        won: !!m.won,
        playedAt: m.played_at,
      })),
    };
  }

  async endGame(
    gameState: GameState,
    winner: Alignment | null,
    reason: string
  ) {
    const roomCode = gameState.roomCode;
    if (!roomCode) return;

    // Clear any active reconnection timer for this room
    const timer = this.reconnectionTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(roomCode);
    }

    gameState.phase = GamePhase.END_GAME;
    gameState.winner = winner;
    gameState.endGameReason = reason;
    gameState.reconnectingPlayer = null;

    if (winner) {
      // Only record stats for games with a clear winner
      try {
        const matchResult = await db.run(
          "INSERT INTO matches (winner) VALUES (?)",
          [winner]
        );
        const matchId = matchResult.lastID;

        for (const player of gameState.players) {
          if (player.role && player.alignment && player.userId) {
            await db.run(
              "INSERT INTO player_performance (user_id, match_id, role, alignment, won) VALUES (?, ?, ?, ?, ?)",
              [
                player.userId,
                matchId,
                player.role,
                player.alignment,
                player.alignment === winner,
              ]
            );
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
      gameState.phase = GamePhase.TEAM_SELECTION;
      gameState.readyPlayers = [];
    }

    this.io.to(roomCode).emit("updateGameState", gameState);
  }

  handleRestartGame(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const player = this.getPlayer(gameState, playerId);

    if (!player || !player.isHost) return;

    const preservedChat = gameState.chat;
    const originalPlayers = gameState.players.map((p) => ({
      ...p,
      role: null,
      alignment: null,
      hasVoted: false,
      status: "CONNECTED" as "CONNECTED", // Reset status
    }));

    const newGameState = this.createInitialGameState(roomCode);
    newGameState.players = originalPlayers;
    newGameState.chat = preservedChat;

    this.games.set(roomCode, newGameState);
    this.io.to(roomCode).emit("updateGameState", newGameState);
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

    // If game is not in progress, just remove the player
    if (
      gameState.phase === GamePhase.LOBBY ||
      gameState.phase === GamePhase.END_GAME
    ) {
      gameState.players = gameState.players.filter((p) => p.id !== playerId);
      if (gameState.players.length === 0) {
        this.games.delete(roomCode);
        return;
      }
      if (disconnectedPlayer.isHost && gameState.players.length > 0) {
        gameState.players[0].isHost = true;
      }
      this.io.to(roomCode).emit("updateGameState", gameState);
      return;
    }

    // If game is in progress, start reconnection timer
    disconnectedPlayer.status = "DISCONNECTED";
    const endsAt = Date.now() + RECONNECT_TIMEOUT;
    gameState.reconnectingPlayer = {
      userId: disconnectedPlayer.userId,
      name: disconnectedPlayer.name,
      endsAt,
    };

    const timer = setTimeout(() => {
      this.abortGameForReconnectFailure(roomCode);
    }, RECONNECT_TIMEOUT);

    this.reconnectionTimers.set(roomCode, timer);

    this.io.to(roomCode).emit("updateGameState", gameState);
    console.log(
      `Player ${
        disconnectedPlayer.name
      } disconnected from ${roomCode}. Starting ${
        RECONNECT_TIMEOUT / 1000
      }s timer.`
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

    if (approvals > connectedPlayers.length / 2) {
      // Team approved
      gameState.phase = GamePhase.QUEST_VOTE;
      gameState.voteTrack = 0;
      currentQuest.questLeader = gameState.leader;
      currentQuest.approvedVote = {
        team: currentQuest.team,
        votes: currentQuest.votes,
      };
    } else {
      // Team rejected
      gameState.voteTrack++;
      currentQuest.pastVotes.push({
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
      gameState.phase = GamePhase.TEAM_SELECTION;
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

    currentQuest.results.push(vote);
    player.hasVoted = true;
    this.io.to(roomCode).emit("updateGameState", { ...gameState });

    if (currentQuest.results.length === currentQuest.team.length) {
      this.processQuestResult(gameState);
    }
  }

  private processQuestResult(gameState: GameState) {
    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
    const failVotes = currentQuest.results.filter((r) => r === "FAIL").length;

    if (failVotes >= currentQuest.failsRequired) {
      currentQuest.status = "FAILED";
    } else {
      currentQuest.status = "PASSED";
    }

    gameState.phase = GamePhase.QUEST_RESULT;
    this.io.to(gameState.roomCode!).emit("updateGameState", gameState);

    setTimeout(() => this.checkForGameOver(gameState), 4000);
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
      gameState.phase = GamePhase.ASSASSINATION;
      this.io.to(gameState.roomCode).emit("updateGameState", gameState);
      return;
    }

    gameState.currentQuest++;
    gameState.questHistory[gameState.currentQuest - 1].status = "ACTIVE";
    this.advanceLeader(gameState);
    gameState.phase = GamePhase.TEAM_SELECTION;
    gameState.players.forEach((p) => (p.hasVoted = false));
    this.io.to(gameState.roomCode).emit("updateGameState", gameState);
  }

  handleAssassinate(assassinId: string, targetId: string) {
    const roomCode = this.findRoomByPlayerId(assassinId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    if (gameState.reconnectingPlayer) return;

    const assassin = this.getPlayer(gameState, assassinId);

    if (
      !assassin ||
      assassin.role !== Role.ASSASSIN ||
      gameState.phase !== GamePhase.ASSASSINATION
    )
      return;

    const target = this.getPlayer(gameState, targetId);
    if (target?.role === Role.MERLIN) {
      this.endGame(
        gameState,
        Alignment.EVIL,
        `The Assassin has slain Merlin! Evil wins!`
      );
    } else {
      this.endGame(
        gameState,
        Alignment.GOOD,
        `The Assassin chose poorly. Merlin survives! The kingdom is safe.`
      );
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
}

const gameService = new GameService(io);

// Socket.IO Auth Middleware
io.use(authMiddlewareSocket);

io.on("connection", (socket: any) => {
  console.log(
    `A user connected: ${socket.id}, username: ${socket.user.username}`
  );

  const gameToRejoin = gameService.findGameByReconnectingUserId(socket.user.id);
  if (gameToRejoin) {
    gameService.handleReconnect(socket, socket.user, gameToRejoin);
  }

  socket.on("joinRoom", ({ roomCode }) =>
    gameService.handleJoinRoom(socket, socket.user, roomCode)
  );
  socket.on("startGame", (data) =>
    gameService.handleStartGame(socket.id, data.selectedRoles)
  );
  socket.on("restartGame", () => gameService.handleRestartGame(socket.id));
  socket.on("playerReady", () => gameService.handlePlayerReady(socket.id));
  socket.on("selectTeam", (teamPlayerIds) =>
    gameService.handleSelectTeam(socket.id, teamPlayerIds)
  );
  socket.on("voteOnTeam", (vote) =>
    gameService.handleVoteOnTeam(socket.id, vote)
  );
  socket.on("voteOnQuest", (vote) =>
    gameService.handleVoteOnQuest(socket.id, vote)
  );
  socket.on("assassinate", (targetId) =>
    gameService.handleAssassinate(socket.id, targetId)
  );
  socket.on("sendMessage", (message) =>
    gameService.handleSendMessage(socket.id, message)
  );

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    gameService.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
