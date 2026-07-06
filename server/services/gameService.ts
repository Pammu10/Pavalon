import { Server, Socket } from 'socket.io';
import db from '../db';
import { logger } from '../logger';
import { redactGameStateFor } from '../redaction';
import { getFullUser } from '../helpers';
import { EVIL_PLAYER_COUNT, QUEST_CONFIGURATIONS, ROLES, ALLOWED_EMOTES, ROLE_CONFIGURATIONS } from '../constants';
import { TUTORIAL_STEPS } from '../tutorial';
import { config } from '../config';
import {
    GameState, Player, GamePhase, Role, Alignment, Message, LogEntry,
    ClientToServerEvents, ServerToClientEvents, User, PlayerStats, Match,
    UserAchievement, LeaderboardData, LeaderboardEntry, DragonsBreathStats,
    DragonCard, DragonCardType, BotDifficulty,
} from '../types';
import { AchievementService } from './achievementService';
import type { SocialService } from './socialService';
import type { BotEngine } from '../bots';
import { selectPersonaForLobby, selectPersonasForSlots } from '../bots/personas';

const { reconnectTimeout: RECONNECT_TIMEOUT, restartCooldown: RESTART_COOLDOWN, restartVoteDuration: RESTART_VOTE_DURATION } = config.game;

interface AuthSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
    user: User;
}

export class GameService {
    private games: Map<string, GameState> = new Map();
    private reconnectionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private restartVoteTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    private socialService: SocialService;
    private achievementService: AchievementService;
    private botEngine: BotEngine | null = null;
    private botSeq = 0; // monotonic id source for lobby-added bots

    setBotEngine(engine: BotEngine): void {
        this.botEngine = engine;
    }

    constructor(
        io: Server<ClientToServerEvents, ServerToClientEvents>,
        socialService: SocialService,
        achievementService: AchievementService,
    ) {
        this.io = io;
        this.socialService = socialService;
        this.achievementService = achievementService;
    }

    public getGameByRoomCode(roomCode: string): GameState | undefined {
        return this.games.get(roomCode.toUpperCase());
    }

    private sendStateTo(playerId: string, gameState: GameState): void {
        this.io.to(playerId).emit('updateGameState', redactGameStateFor(gameState, playerId));
    }

    private broadcastState(gameState: GameState): void {
        for (const player of gameState.players) {
            this.sendStateTo(player.id, gameState);
        }
        this.botEngine?.onPhaseChange(gameState);
    }

    private addLog(gameState: GameState, text: string, type: LogEntry['type']): void {
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
    }

    private generateRoomCode(): string {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    private getPlayer(gameState: GameState, playerId: string): Player | undefined {
        return gameState.players.find((p) => p.id === playerId);
    }

    // Bots must never keep a room alive or end up hosting one (they can't
    // press any buttons). Both helpers exist for every path that removes a
    // human from a lobby.
    private deleteRoomIfNoHumans(roomCode: string, gameState: GameState): boolean {
        if (gameState.players.some((p) => p.userId > 0)) return false;
        this.games.delete(roomCode);
        return true;
    }

    private reassignHostIfNeeded(gameState: GameState): void {
        if (gameState.players.some((p) => p.isHost)) return;
        const human =
            gameState.players.find((p) => p.userId > 0 && p.status === 'CONNECTED') ??
            gameState.players.find((p) => p.userId > 0);
        if (human) human.isHost = true;
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
            if (state.players.some((p) => p.userId === userId && p.status === 'CONNECTED')) {
                return true;
            }
        }
        return false;
    }

    private async createTutorialGame(socket: AuthSocket, user: User): Promise<void> {
        const roomCode = `TUTORIAL-${socket.id}`;
        for (const [code] of this.games.entries()) {
            if (code.startsWith(`TUTORIAL-${socket.id}`)) {
                this.games.delete(code);
            }
        }

        const fullUser = await getFullUser(user.id);
        if (!fullUser) {
            socket.emit('error', 'Could not load user profile for tutorial.');
            return;
        }

        const gameState = this.createInitialGameState(roomCode);

        const player: Player = {
            id: socket.id,
            userId: user.id,
            name: user.username,
            role: Role.MERLIN,
            alignment: Alignment.GOOD,
            isHost: true,
            hasVoted: false,
            status: 'CONNECTED',
            selectedTitle: fullUser.selectedTitle,
            selectedBorder: fullUser.selectedBorder,
            selectedIcon: fullUser.selectedIcon,
            selectedBackground: fullUser.selectedBackground,
        };
        gameState.players.push(player);

        const bots: Player[] = [
            { id: 'bot1', userId: -1, name: 'Bot Alice', role: Role.LOYAL_SERVANT, alignment: Alignment.GOOD, isHost: false, hasVoted: false, status: 'CONNECTED', selectedBorder: 'azure' },
            { id: 'bot2', userId: -2, name: 'Bot Bob', role: Role.PERCIVAL, alignment: Alignment.GOOD, isHost: false, hasVoted: false, status: 'CONNECTED' },
            { id: 'bot3', userId: -3, name: 'Bot Charles', role: Role.MORGANA, alignment: Alignment.EVIL, isHost: false, hasVoted: false, status: 'CONNECTED', selectedBorder: 'crimson' },
            { id: 'bot4', userId: -4, name: 'Bot Diana', role: Role.ASSASSIN, alignment: Alignment.EVIL, isHost: false, hasVoted: false, status: 'CONNECTED', selectedBorder: 'amethyst' },
        ];
        gameState.players.push(...bots);

        this.setupQuests(gameState);
        gameState.phase = GamePhase.ROLE_REVEAL;
        gameState.leader = player;
        gameState.tutorial = TUTORIAL_STEPS[0];

        this.games.set(roomCode, gameState);
        socket.join(roomCode);
        this.sendStateTo(socket.id, gameState);
        logger.info('[TUTORIAL] Created tutorial game', { username: user.username });
    }

    async handleStartCPUGame(
        socket: AuthSocket,
        user: User,
        config: { difficulty: BotDifficulty; playerCount: number },
    ): Promise<void> {
        const { difficulty, playerCount } = config;

        if (playerCount < 5 || playerCount > 10) {
            socket.emit('error', 'CPU games require 5–10 players.');
            return;
        }

        // Leave any existing game first
        const existingGameInfo = this.findGameByPlayerUserId(user.id);
        if (existingGameInfo) {
            const [oldRoom, oldGame] = existingGameInfo;
            const switchablePhases: GamePhase[] = [GamePhase.LOBBY, GamePhase.END_GAME, GamePhase.DRAGONS_BREATH];
            if (switchablePhases.includes(oldGame.phase)) {
                oldGame.players = oldGame.players.filter((p) => p.userId !== user.id);
                if (!this.deleteRoomIfNoHumans(oldRoom, oldGame)) {
                    this.reassignHostIfNeeded(oldGame);
                    this.broadcastState(oldGame);
                }
            } else {
                socket.emit('error', 'You are already in an active game.');
                return;
            }
        }

        const roomCode = this.generateRoomCode();
        const gameState = this.createInitialGameState(roomCode);

        // Human player
        const customizations = await db.get<{
            selected_title: string; selected_border: string;
            selected_icon: string; selected_background: string;
        }>('SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1', [user.id]);

        const humanPlayer: Player = {
            id: socket.id,
            userId: user.id,
            name: user.username,
            role: null, alignment: null,
            isHost: true, hasVoted: false, status: 'CONNECTED',
            selectedTitle: customizations?.selected_title,
            selectedBorder: customizations?.selected_border || '',
            selectedIcon: customizations?.selected_icon,
            selectedBackground: customizations?.selected_background,
        };
        gameState.players.push(humanPlayer);

        const roles = ROLE_CONFIGURATIONS[playerCount];
        const botCount = playerCount - 1;
        // Personas are matched to an alignment mix; the real roles are
        // shuffled across everyone below, so this slice is only an
        // approximation of the bot slots' alignments.
        const botAlignments = roles.slice(1).map((r) =>
            ROLES[r].alignment === Alignment.GOOD ? 'good' as const : 'evil' as const,
        );
        const personas = selectPersonasForSlots(difficulty, botAlignments);

        for (let i = 0; i < botCount; i++) {
            const persona = personas[i];
            const bot: Player = {
                id: `cpu-${roomCode}-${i}`,
                userId: -101 - i,
                name: persona.name,
                role: null, alignment: null,
                isHost: false, hasVoted: false, status: 'CONNECTED',
                selectedBorder: persona.selectedBorder,
                selectedIcon: persona.selectedIcon,
            };
            gameState.players.push(bot);
        }

        // Now properly assign roles across all players (human + bots)
        this.assignRoles(gameState, roles);
        this.setupQuests(gameState);

        gameState.phase = GamePhase.ROLE_REVEAL;
        gameState.leader = gameState.players[Math.floor(Math.random() * playerCount)];
        gameState.selectedRoles = roles;
        gameState.cpuConfig = {
            difficulty,
            personas: personas.map((p) => ({
                name: p.name,
                difficulty: p.difficulty,
                selectedBorder: p.selectedBorder,
                selectedIcon: p.selectedIcon,
            })),
        };

        this.games.set(roomCode, gameState);
        socket.join(roomCode);
        this.addLog(gameState, `CPU game started (${difficulty}, ${playerCount} players).`, 'system');
        this.broadcastState(gameState);
        this.socialService.updateUserStatus(user.id, true, roomCode);
        logger.info('[CPU] Created CPU game', { username: user.username, difficulty, playerCount, roomCode });
    }

    handleAddBot(hostId: string, difficulty: BotDifficulty): void {
        const roomCode = this.findRoomByPlayerId(hostId);
        if (!roomCode || roomCode.startsWith('TUTORIAL-')) return;
        const gameState = this.games.get(roomCode)!;
        const socket = this.io.sockets.sockets.get(hostId);
        const host = this.getPlayer(gameState, hostId);

        if (!host?.isHost) { socket?.emit('error', 'Only the host can add CPU players.'); return; }
        if (gameState.phase !== GamePhase.LOBBY) { socket?.emit('error', 'CPU players can only be added in the lobby.'); return; }
        if (gameState.players.length >= 10) { socket?.emit('error', 'Room is full.'); return; }
        if (!['easy', 'medium', 'hard'].includes(difficulty)) return;

        const usedNames = new Set(gameState.players.map((p) => p.name));
        const persona = selectPersonaForLobby(difficulty, usedNames);
        if (!persona) { socket?.emit('error', 'Every CPU persona is already in this room.'); return; }

        this.botSeq++;
        const bot: Player = {
            id: `cpu-${roomCode}-${this.botSeq}`,
            userId: -(100 + this.botSeq),
            name: persona.name,
            role: null, alignment: null,
            isHost: false, hasVoted: false, status: 'CONNECTED',
            selectedBorder: persona.selectedBorder,
            selectedIcon: persona.selectedIcon,
        };
        gameState.players.push(bot);

        const personaRef = {
            name: persona.name,
            difficulty: persona.difficulty,
            selectedBorder: persona.selectedBorder,
            selectedIcon: persona.selectedIcon,
        };
        if (gameState.cpuConfig) {
            gameState.cpuConfig.personas.push(personaRef);
        } else {
            gameState.cpuConfig = { difficulty, personas: [personaRef] };
        }

        this.addLog(gameState, `${persona.name} (CPU, ${persona.difficulty}) joined the lobby.`, 'system');
        this.broadcastState(gameState);
        logger.info('[CPU] Bot added to lobby', { roomCode, persona: persona.name, difficulty: persona.difficulty });
    }

    async handleJoinRoom(socket: AuthSocket, user: User, roomCode?: string): Promise<void> {
        if (roomCode?.toUpperCase() === 'TUTORIAL') {
            this.createTutorialGame(socket, user);
            return;
        }

        const existingGameInfo = this.findGameByPlayerUserId(user.id);
        const upperRoomCode = roomCode?.toUpperCase();

        if (existingGameInfo && upperRoomCode && existingGameInfo[0] !== upperRoomCode) {
            const [oldRoomCode, oldGameState] = existingGameInfo;
            const oldPlayer = oldGameState.players.find((p) => p.userId === user.id);
            const switchablePhases = [GamePhase.LOBBY, GamePhase.END_GAME, GamePhase.DRAGONS_BREATH];

            if (oldPlayer && switchablePhases.includes(oldGameState.phase)) {
                logger.info('User switching lobbies', { username: user.username, from: oldRoomCode, to: upperRoomCode });
                oldGameState.players = oldGameState.players.filter((p) => p.userId !== user.id);

                if (!this.deleteRoomIfNoHumans(oldRoomCode, oldGameState)) {
                    this.reassignHostIfNeeded(oldGameState);
                    this.addLog(oldGameState, `${user.username} has left to join another game.`, 'system');
                    this.broadcastState(oldGameState);
                }
            } else if (oldPlayer) {
                socket.emit('error', 'You cannot switch rooms while in an active game.');
                return;
            }
        } else if (existingGameInfo) {
            this.handleReconnect(socket, user, existingGameInfo);
            return;
        }

        let code = upperRoomCode;
        let gameState: GameState | undefined;

        if (code) {
            gameState = this.games.get(code);
            if (!gameState || gameState.phase !== GamePhase.LOBBY) {
                socket.emit('error', 'Room not found or game already in progress.');
                return;
            }
            if (gameState.players.some((p) => p.userId === user.id)) {
                this.handleReconnect(socket, user, [code, gameState]);
                return;
            }
            if (gameState.players.length >= 10) {
                socket.emit('error', 'Room is full.');
                return;
            }
        } else {
            code = this.generateRoomCode();
            gameState = this.createInitialGameState(code);
            this.games.set(code, gameState);
        }

        const userCustomizations = await db.get<{
            selected_title: string;
            selected_border: string;
            selected_icon: string;
            selected_background: string;
        }>('SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1', [user.id]);

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
            status: 'CONNECTED',
            selectedTitle: userCustomizations?.selected_title,
            selectedBorder: userCustomizations?.selected_border || '',
            selectedIcon: userCustomizations?.selected_icon,
            selectedBackground: userCustomizations?.selected_background,
        };
        gameState.players.push(newPlayer);
        this.socialService.updateUserStatus(user.id, true, code);
        socket.broadcast.to(code).emit('voice:user-joined', { socketId: socket.id });
        this.broadcastState(gameState);
    }

    async handleReconnect(
        socket: AuthSocket,
        user: User,
        [roomCode, gameState]: [string, GameState],
    ): Promise<void> {
        logger.info('Attempting reconnect', { username: user.username, roomCode });
        const player = gameState.players.find((p) => p.userId === user.id);

        if (!player) {
            socket.emit('error', 'Could not find your player in this game to reconnect.');
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

        const userCustomizations = await db.get<{
            selected_title: string;
            selected_border: string;
            selected_icon: string;
            selected_background: string;
        }>('SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1', [user.id]);

        socket.broadcast.to(roomCode).emit('voice:user-joined', { socketId: socket.id });

        const oldPlayerId = player.id;
        const newPlayerId = socket.id;

        if (oldPlayerId === newPlayerId) {
            player.status = 'CONNECTED';
            socket.join(roomCode);
            this.resumeAfterReconnect(roomCode, gameState);
            this.broadcastState(gameState);
            logger.info('Reconnected with same socket ID', { username: user.username, socketId: newPlayerId });
            return;
        }

        player.selectedTitle = userCustomizations?.selected_title;
        player.selectedBorder = userCustomizations?.selected_border || '';
        player.selectedIcon = userCustomizations?.selected_icon;
        player.selectedBackground = userCustomizations?.selected_background;
        player.id = newPlayerId;
        player.status = 'CONNECTED';

        // State migration: replace oldPlayerId → newPlayerId everywhere in game state
        gameState.readyPlayers = gameState.readyPlayers.map((id) => (id === oldPlayerId ? newPlayerId : id));
        gameState.endGameReadyPlayers = gameState.endGameReadyPlayers.map((id) => (id === oldPlayerId ? newPlayerId : id));

        if (gameState.pendingTeam) {
            gameState.pendingTeam = gameState.pendingTeam.map((id) => (id === oldPlayerId ? newPlayerId : id));
        }

        gameState.questHistory.forEach((quest) => {
            quest.votes.forEach((vote) => { if (vote.playerId === oldPlayerId) vote.playerId = newPlayerId; });
            quest.results.forEach((result) => { if (result.playerId === oldPlayerId) result.playerId = newPlayerId; });
            quest.pastVotes.forEach((pastVote) => {
                pastVote.votes.forEach((vote) => { if (vote.playerId === oldPlayerId) vote.playerId = newPlayerId; });
            });
            if (quest.approvedVote) {
                quest.approvedVote.votes.forEach((vote) => { if (vote.playerId === oldPlayerId) vote.playerId = newPlayerId; });
            }
        });

        if (gameState.restartVote) {
            if (gameState.restartVote.initiatorId === oldPlayerId) gameState.restartVote.initiatorId = newPlayerId;
            if (gameState.restartVote.votes[oldPlayerId]) {
                gameState.restartVote.votes[newPlayerId] = gameState.restartVote.votes[oldPlayerId];
                delete gameState.restartVote.votes[oldPlayerId];
            }
        }

        if (gameState.phase === GamePhase.DRAGONS_BREATH && gameState.dragonsBreathState) {
            const dbState = gameState.dragonsBreathState;
            if (dbState.hands[oldPlayerId]) {
                dbState.hands[newPlayerId] = dbState.hands[oldPlayerId];
                delete dbState.hands[oldPlayerId];
            }
            if (dbState.currentPlayerId === oldPlayerId) dbState.currentPlayerId = newPlayerId;
            if (dbState.isViewingFuture === oldPlayerId) dbState.isViewingFuture = newPlayerId;
            if (dbState.isPlacingDragon === oldPlayerId) dbState.isPlacingDragon = newPlayerId;
            if (dbState.winner === oldPlayerId) dbState.winner = newPlayerId;
            if (dbState.loser === oldPlayerId) dbState.loser = newPlayerId;
        }

        if (gameState.assassinationTargetId === oldPlayerId) {
            gameState.assassinationTargetId = newPlayerId;
        }

        socket.join(roomCode);
        this.resumeAfterReconnect(roomCode, gameState);
        this.broadcastState(gameState);
        logger.info('Reconnect successful', { username: user.username, from: oldPlayerId, to: newPlayerId });
    }

    // A reconnect window can swallow scheduled work: bot actions no-op while
    // reconnectingPlayer is set, and a QUEST_RESULT advance timer that fired
    // during the window is never re-armed. Recover both here.
    private resumeAfterReconnect(roomCode: string, gameState: GameState): void {
        this.botEngine?.onPlayerReconnected(roomCode);
        if (gameState.phase === GamePhase.QUEST_RESULT) {
            setTimeout(() => this.checkForGameOver(gameState), 8000);
        }
    }

    handleUpdateSelectedRoles(playerId: string, roles: Role[]): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const player = this.getPlayer(gameState, playerId);
        if (!player || !player.isHost || gameState.phase !== GamePhase.LOBBY) return;
        gameState.selectedRoles = roles;
        this.broadcastState(gameState);
    }

    handleStartGame(playerId: string, selectedRoles: Role[]): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.reconnectingPlayer) return;

        const player = this.getPlayer(gameState, playerId);
        const socket = this.io.sockets.sockets.get(playerId);

        if (!player || !player.isHost) {
            socket?.emit('error', 'Only the host can start the game.');
            return;
        }

        const playerCount = gameState.players.length;
        if (playerCount < 5 || playerCount > 10) {
            socket?.emit('error', `Games require 5-10 players. You have ${playerCount}.`);
            return;
        }

        const requiredEvilCount = EVIL_PLAYER_COUNT[playerCount as keyof typeof EVIL_PLAYER_COUNT];
        const actualEvilCount = selectedRoles.filter((r) => ROLES[r].alignment === Alignment.EVIL).length;

        if (selectedRoles.length !== playerCount) {
            socket?.emit('error', `Role selection count (${selectedRoles.length}) does not match player count (${playerCount}).`);
            return;
        }
        if (actualEvilCount !== requiredEvilCount) {
            socket?.emit('error', `Invalid number of evil roles. For ${playerCount} players, there must be ${requiredEvilCount} evil roles. You have ${actualEvilCount}.`);
            return;
        }
        const hasMorgana = selectedRoles.includes(Role.MORGANA);
        const hasPercival = selectedRoles.includes(Role.PERCIVAL);
        if (hasMorgana !== hasPercival) {
            socket?.emit('error', 'Morgana and Percival must be in the game together.');
            return;
        }

        this.assignRoles(gameState, selectedRoles);
        this.setupQuests(gameState);
        gameState.phase = GamePhase.ROLE_REVEAL;
        gameState.leader = gameState.players[Math.floor(Math.random() * playerCount)];

        this.addLog(gameState, `The game has begun with ${playerCount} players.`, 'system');
        this.addLog(gameState, `${gameState.leader.name} is the first Quest Leader.`, 'leader');
        this.broadcastState(gameState);
    }

    async getPlayerStats(userId: number): Promise<PlayerStats> {
        const userStats = await db.get<{
            total_games: number; total_wins: number; good_games: number;
            good_wins: number; evil_games: number; evil_wins: number;
        }>('SELECT total_games, total_wins, good_games, good_wins, evil_games, evil_wins FROM users WHERE id = $1', [userId]);

        if (!userStats) {
            return { totalGames: 0, totalWins: 0, goodGames: 0, goodWins: 0, evilGames: 0, evilWins: 0, winRate: 0, goodWinRate: 0, evilWinRate: 0, recentMatches: [], achievements: [] };
        }

        const [recentMatches, achievements] = await Promise.all([
            db.all<Match>('SELECT m.id, m.winner, pp.role, pp.won, m.played_at AS "playedAt" FROM matches m JOIN player_performance pp ON m.id = pp.match_id WHERE pp.user_id = $1 ORDER BY m.played_at DESC LIMIT 10', [userId]),
            db.all<UserAchievement>('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1', [userId]),
        ]);

        const { total_games, total_wins, good_games, good_wins, evil_games, evil_wins } = userStats;
        return {
            totalGames: total_games, totalWins: total_wins, goodGames: good_games, goodWins: good_wins,
            evilGames: evil_games, evilWins: evil_wins,
            winRate: total_games ? Math.round((total_wins / total_games) * 100) : 0,
            goodWinRate: good_games ? Math.round((good_wins / good_games) * 100) : 0,
            evilWinRate: evil_games ? Math.round((evil_wins / evil_games) * 100) : 0,
            recentMatches: recentMatches.map((m) => ({ id: m.id, winner: m.winner, role: m.role, won: !!m.won, playedAt: m.playedAt })),
            achievements,
        };
    }

    async getDragonsBreathStats(userId: number): Promise<DragonsBreathStats> {
        const [totalGamesResult, totalWinsResult, opponentData, matchHistoryData] = await Promise.all([
            db.get<{ count: string }>('SELECT COUNT(*) FROM dragons_breath_matches WHERE winner_user_id = $1 OR loser_user_id = $1', [userId]),
            db.get<{ count: string }>('SELECT COUNT(*) FROM dragons_breath_matches WHERE winner_user_id = $1', [userId]),
            db.all<{ opponent_id: number; opponent_name: string; games_played: string; wins: string }>(`
                SELECT opponent.id as opponent_id, opponent.username as opponent_name,
                       COUNT(*) as games_played,
                       SUM(CASE WHEN m.winner_user_id = $1 THEN 1 ELSE 0 END) as wins
                FROM dragons_breath_matches m
                JOIN users opponent ON (CASE WHEN m.winner_user_id = $1 THEN m.loser_user_id ELSE m.winner_user_id END) = opponent.id
                WHERE m.winner_user_id = $1 OR m.loser_user_id = $1
                GROUP BY opponent.id, opponent.username ORDER BY games_played DESC
            `, [userId]),
            db.all<{ id: number; opponent_name: string; won: boolean; played_at: string }>(`
                SELECT m.id, opponent.username as opponent_name, (m.winner_user_id = $1) as won, m.played_at
                FROM dragons_breath_matches m
                JOIN users opponent ON (CASE WHEN m.winner_user_id = $1 THEN m.loser_user_id ELSE m.winner_user_id END) = opponent.id
                WHERE m.winner_user_id = $1 OR m.loser_user_id = $1
                ORDER BY m.played_at DESC LIMIT 20
            `, [userId]),
        ]);

        return {
            totalGames: parseInt(totalGamesResult?.count || '0', 10),
            totalWins: parseInt(totalWinsResult?.count || '0', 10),
            opponentStats: opponentData.map((o) => {
                const gamesPlayed = parseInt(o.games_played, 10);
                const wins = parseInt(o.wins, 10);
                return { opponentId: o.opponent_id, opponentName: o.opponent_name, gamesPlayed, wins, winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0 };
            }),
            matchHistory: matchHistoryData.map((m) => ({ id: m.id, opponentName: m.opponent_name, won: m.won, playedAt: m.played_at })),
        };
    }

    async getLeaderboard(): Promise<LeaderboardData> {
        const allUsers: {
            username: string; highest_win_streak: number; assassin_kills: number;
            total_games: number; total_wins: number; good_wins: number; evil_wins: number;
        }[] = await db.all('SELECT username, highest_win_streak, assassin_kills, total_games, total_wins, good_wins, evil_wins FROM users WHERE total_games > 0');

        const leaderboard: LeaderboardData = { totalWins: [], winRate: [], topAssassins: [], winStreaks: [], bestGood: [], bestEvil: [] };

        for (const user of allUsers) {
            const winRate = user.total_games > 0 ? Math.round((user.total_wins / user.total_games) * 100) : 0;
            leaderboard.totalWins.push({ username: user.username, value: user.total_wins });
            leaderboard.winRate.push({ username: user.username, value: winRate });
            leaderboard.topAssassins.push({ username: user.username, value: user.assassin_kills });
            leaderboard.winStreaks.push({ username: user.username, value: user.highest_win_streak });
            leaderboard.bestGood.push({ username: user.username, value: user.good_wins });
            leaderboard.bestEvil.push({ username: user.username, value: user.evil_wins });
        }

        const sortByValue = (a: LeaderboardEntry, b: LeaderboardEntry) => {
            const diff = (b.value as number) - (a.value as number);
            return diff !== 0 ? diff : a.username.localeCompare(b.username);
        };
        Object.values(leaderboard).forEach((arr) => arr.sort(sortByValue));
        return leaderboard;
    }

    async endGame(gameState: GameState, winner: Alignment | null, reason: string): Promise<void> {
        const roomCode = gameState.roomCode;
        if (!roomCode) return;

        this.addLog(gameState, `Game Over: ${reason}`, 'system');

        const reconnTimer = this.reconnectionTimers.get(roomCode);
        if (reconnTimer) { clearTimeout(reconnTimer); this.reconnectionTimers.delete(roomCode); }
        const voteTimer = this.restartVoteTimers.get(roomCode);
        if (voteTimer) { clearTimeout(voteTimer); this.restartVoteTimers.delete(roomCode); }

        gameState.phase = GamePhase.END_GAME;
        gameState.winner = winner;
        gameState.endGameReason = reason;
        gameState.reconnectingPlayer = null;
        gameState.restartVote = null;
        gameState.pendingTeam = null;
        gameState.assassinationTargetId = null;

        if (winner) {
            try {
                const matchResult = await db.run('INSERT INTO matches (winner) VALUES ($1) RETURNING id', [winner]);
                const matchId = matchResult.rows[0].id;

                for (const player of gameState.players) {
                    if (player.role && player.alignment && player.userId > 0) {
                        const won = player.alignment === winner;
                        const performance = { user_id: player.userId, match_id: matchId, role: player.role, alignment: player.alignment, won };
                        await db.run('INSERT INTO player_performance (user_id, match_id, role, alignment, won) VALUES ($1, $2, $3, $4, $5)', [performance.user_id, performance.match_id, performance.role, performance.alignment, performance.won]);

                        const winIncrement = won ? 1 : 0;
                        const goodGameIncrement = player.alignment === Alignment.GOOD ? 1 : 0;
                        const evilGameIncrement = player.alignment === Alignment.EVIL ? 1 : 0;
                        const goodWinIncrement = player.alignment === Alignment.GOOD && won ? 1 : 0;
                        const evilWinIncrement = player.alignment === Alignment.EVIL && won ? 1 : 0;

                        await db.run(`
                            UPDATE users SET
                                total_games = total_games + 1,
                                total_wins = total_wins + $1,
                                good_games = good_games + $2,
                                good_wins = good_wins + $3,
                                evil_games = evil_games + $4,
                                evil_wins = evil_wins + $5,
                                highest_win_streak = CASE WHEN $1 = 1 THEN GREATEST(highest_win_streak, win_streak + 1) ELSE highest_win_streak END,
                                win_streak = CASE WHEN $1 = 1 THEN win_streak + 1 ELSE 0 END
                            WHERE id = $6
                        `, [winIncrement, goodGameIncrement, goodWinIncrement, evilGameIncrement, evilWinIncrement, player.userId]);

                        const stats = await this.getPlayerStats(player.userId);
                        await this.achievementService.checkAndGrantAchievements(player.userId, performance, this.io, gameState, stats);
                    }
                }
            } catch (err) {
                logger.error('Failed to save match results', { error: String(err) });
            }
        }

        this.broadcastState(gameState);
    }

    handlePlayerReady(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;

        if (roomCode.startsWith('TUTORIAL-')) {
            const currentStep = gameState.tutorial?.step;
            if (currentStep === 1 || currentStep === 2) {
                const nextStepIndex = TUTORIAL_STEPS.findIndex((s) => s.step === currentStep) + 1;
                gameState.tutorial = TUTORIAL_STEPS[nextStepIndex];
                if (nextStepIndex === 2) gameState.phase = GamePhase.TEAM_SELECTION;
                this.broadcastState(gameState);
                return;
            }
        }

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

        this.broadcastState(gameState);
    }

    private async restartGameByRoomCode(roomCode: string): Promise<void> {
        const gameState = this.games.get(roomCode);
        if (!gameState) return;

        const preservedChat = gameState.chat;
        const preservedLog = gameState.gameLog;
        const cpuConfig = gameState.cpuConfig;

        const originalPlayerInfos = await Promise.all(
            gameState.players
                .filter((p) => p.status === 'CONNECTED')
                .map(async (p) => {
                    // Bots: reconstruct from persona config without DB query
                    if (p.userId < 0) {
                        const persona = cpuConfig?.personas.find((pe) => pe.name === p.name);
                        return {
                            id: p.id, userId: p.userId, name: p.name,
                            role: null as Role | null, alignment: null as Alignment | null,
                            isHost: false, hasVoted: false, status: 'CONNECTED' as const,
                            selectedBorder: persona?.selectedBorder ?? '',
                            selectedIcon: persona?.selectedIcon,
                        };
                    }
                    const customizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string; selected_background: string }>(
                        'SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1',
                        [p.userId],
                    );
                    return {
                        id: p.id, userId: p.userId, name: p.name, role: null as Role | null, alignment: null as Alignment | null,
                        isHost: p.isHost, hasVoted: false, status: 'CONNECTED' as const,
                        selectedTitle: customizations?.selected_title, selectedBorder: customizations?.selected_border || '',
                        selectedIcon: customizations?.selected_icon, selectedBackground: customizations?.selected_background,
                    };
                }),
        );

        const newGameState = this.createInitialGameState(roomCode);
        newGameState.players = originalPlayerInfos;
        newGameState.chat = preservedChat;
        newGameState.gameLog = preservedLog;
        newGameState.cpuConfig = cpuConfig ?? null;

        this.reassignHostIfNeeded(newGameState);

        this.games.set(roomCode, newGameState);
        this.broadcastState(newGameState);
    }

    handlePlayerReadyForNextGame(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.phase !== GamePhase.END_GAME) return;

        if (!gameState.endGameReadyPlayers.includes(playerId)) {
            gameState.endGameReadyPlayers.push(playerId);
        }

        const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
        if (connectedPlayers.length > 0 && gameState.endGameReadyPlayers.length === connectedPlayers.length) {
            this.restartGameByRoomCode(roomCode);
        } else {
            this.broadcastState(gameState);
        }
    }

    private handleReconnectTimeout(roomCode: string): void {
        const gameState = this.games.get(roomCode);
        if (!gameState || !gameState.reconnectingPlayer) return;

        const { name, userId } = gameState.reconnectingPlayer;
        logger.info('Reconnect timeout', { name, roomCode });
        const disconnectedPlayer = gameState.players.find((p) => p.userId === userId);
        if (disconnectedPlayer) {
            this.io.to(roomCode).emit('voice:user-left', { socketId: disconnectedPlayer.id });
        }
        this.reconnectionTimers.delete(roomCode);

        if (gameState.phase === GamePhase.LOBBY || gameState.phase === GamePhase.DRAGONS_BREATH) {
            if (gameState.players.some((p) => p.userId === userId)) {
                this.socialService.updateUserStatus(userId, false, undefined);
            }
            gameState.players = gameState.players.filter((p) => p.userId !== userId);
            this.io.to(roomCode).emit('chatMessage', { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${name} left the lobby.` });
            this.addLog(gameState, `${name} left the lobby.`, 'system');

            if (this.deleteRoomIfNoHumans(roomCode, gameState)) return;
            this.reassignHostIfNeeded(gameState);
            gameState.reconnectingPlayer = null;

            if (gameState.phase === GamePhase.DRAGONS_BREATH) {
                this.restartGameByRoomCode(roomCode);
            } else {
                this.broadcastState(gameState);
            }
        } else {
            this.abortGameForReconnectFailure(roomCode);
        }
    }

    private abortGameForReconnectFailure(roomCode: string): void {
        const gameState = this.games.get(roomCode);
        if (gameState?.reconnectingPlayer) {
            this.endGame(gameState, null, `${gameState.reconnectingPlayer.name} failed to reconnect. The game has been aborted.`);
        }
    }

    handleDisconnect(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;

        const disconnectedPlayer = this.getPlayer(gameState, playerId);
        if (!disconnectedPlayer) return;

        this.io.to(roomCode).emit('voice:user-left', { socketId: playerId });
        disconnectedPlayer.status = 'DISCONNECTED';
        this.addLog(gameState, `${disconnectedPlayer.name} has disconnected.`, 'system');

        if (gameState.phase === GamePhase.END_GAME) {
            gameState.endGameReadyPlayers = gameState.endGameReadyPlayers.filter((id) => id !== playerId);
            const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
            if (connectedPlayers.length > 0 && gameState.endGameReadyPlayers.length === connectedPlayers.length) {
                this.restartGameByRoomCode(roomCode);
            } else {
                this.broadcastState(gameState);
            }
            return;
        }

        if (gameState.reconnectingPlayer) {
            this.broadcastState(gameState);
            return;
        }

        const endsAt = Date.now() + RECONNECT_TIMEOUT;
        gameState.reconnectingPlayer = { userId: disconnectedPlayer.userId, name: disconnectedPlayer.name, endsAt };

        if (gameState.phase === GamePhase.LOBBY && disconnectedPlayer.isHost) {
            const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
            if (connectedPlayers.length > 0) connectedPlayers[0].isHost = true;
        }

        const timer = setTimeout(() => {
            const currentGameState = this.games.get(roomCode);
            if (currentGameState?.reconnectingPlayer?.userId === disconnectedPlayer.userId) {
                this.handleReconnectTimeout(roomCode);
            }
        }, RECONNECT_TIMEOUT);

        this.reconnectionTimers.set(roomCode, timer);
        this.broadcastState(gameState);
        logger.info('Player disconnected, starting reconnect timer', { name: disconnectedPlayer.name, roomCode });
    }

    private assignRoles(gameState: GameState, rolesToAssign: Role[]): void {
        const shuffled = [...rolesToAssign];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        gameState.players.forEach((player, index) => {
            player.role = shuffled[index];
            player.alignment = ROLES[shuffled[index]].alignment;
        });
    }

    private setupQuests(gameState: GameState): void {
        const playerCount = gameState.players.length;
        gameState.questHistory = QUEST_CONFIGURATIONS[playerCount as keyof typeof QUEST_CONFIGURATIONS].map((config, i) => ({
            questNumber: i + 1, teamSize: config.teamSize, failsRequired: config.failsRequired,
            status: 'PENDING' as const, team: [], votes: [], results: [], pastVotes: [], questLeader: null, approvedVote: null,
        }));
        gameState.questHistory[0].status = 'ACTIVE';
    }

    handleUpdatePendingTeam(playerId: string, teamPlayerIds: string[]): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.leader?.id !== playerId || gameState.phase !== GamePhase.TEAM_SELECTION) return;
        gameState.pendingTeam = teamPlayerIds;
        this.broadcastState(gameState);
    }

    handleSelectTeam(playerId: string, teamPlayerIds: string[]): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.reconnectingPlayer) return;

        if (roomCode.startsWith('TUTORIAL-') && gameState.tutorial?.step === 3) {
            const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
            if (teamPlayerIds.length !== currentQuest.teamSize) return;
            currentQuest.team = gameState.players.filter((p) => teamPlayerIds.includes(p.id));
            gameState.phase = GamePhase.TEAM_VOTE;
            gameState.tutorial = TUTORIAL_STEPS.find((s) => s.step === 4);
            this.broadcastState(gameState);
            setTimeout(() => {
                if (!this.games.has(roomCode)) return;
                const currentGameState = this.games.get(roomCode)!;
                const bots = currentGameState.players.filter((p) => p.id !== playerId);
                const quest = currentGameState.questHistory[currentGameState.currentQuest - 1];
                bots.forEach((bot) => quest.votes.push({ playerId: bot.id, vote: 'APPROVE' }));
                this.broadcastState(currentGameState);
            }, 1000);
            return;
        }

        if (gameState.leader?.id !== playerId || gameState.phase !== GamePhase.TEAM_SELECTION) return;

        const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
        if (teamPlayerIds.length !== currentQuest.teamSize) {
            this.io.sockets.sockets.get(playerId)?.emit('error', `You must select ${currentQuest.teamSize} players for this quest.`);
            return;
        }

        currentQuest.team = gameState.players.filter((p) => teamPlayerIds.includes(p.id));
        currentQuest.votes = [];
        gameState.phase = GamePhase.TEAM_VOTE;
        gameState.players.forEach((p) => (p.hasVoted = false));
        gameState.pendingTeam = null;
        this.addLog(gameState, `${gameState.leader!.name} has proposed a team: ${currentQuest.team.map((p) => p.name).join(', ')}.`, 'team');
        this.broadcastState(gameState);
    }

    handleVoteOnTeam(playerId: string, vote: 'APPROVE' | 'REJECT'): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.reconnectingPlayer) return;

        const player = this.getPlayer(gameState, playerId);
        if (!player || player.hasVoted || gameState.phase !== GamePhase.TEAM_VOTE) return;

        const currentQuest = gameState.questHistory[gameState.currentQuest - 1];

        if (roomCode.startsWith('TUTORIAL-') && gameState.tutorial?.step === 4) {
            currentQuest.votes.push({ playerId, vote });
            player.hasVoted = true;
            this.processTeamVote(gameState);
            return;
        }

        currentQuest.votes.push({ playerId, vote });
        player.hasVoted = true;
        this.broadcastState(gameState);

        const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
        if (currentQuest.votes.length === connectedPlayers.length) {
            this.processTeamVote(gameState);
        }
    }

    private processTeamVote(gameState: GameState): void {
        const roomCode = gameState.roomCode!;
        const currentQuest = gameState.questHistory[gameState.currentQuest - 1];

        if (roomCode.startsWith('TUTORIAL-')) {
            gameState.phase = GamePhase.QUEST_VOTE;
            gameState.voteTrack = 0;
            currentQuest.questLeader = gameState.leader;
            currentQuest.approvedVote = { team: currentQuest.team, votes: currentQuest.votes };
            gameState.tutorial = TUTORIAL_STEPS.find((s) => s.step === 5);
            gameState.players.forEach((p) => (p.hasVoted = false));
            this.addLog(gameState, 'Team Approved.', 'vote');
            this.broadcastState(gameState);
            return;
        }

        const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
        const approvals = currentQuest.votes.filter((v) => v.vote === 'APPROVE').length;
        const rejections = connectedPlayers.length - approvals;

        if (approvals > connectedPlayers.length / 2) {
            this.addLog(gameState, `Team Approved. Votes: ${approvals} Approve, ${rejections} Reject.`, 'vote');
            gameState.phase = GamePhase.QUEST_VOTE;
            gameState.voteTrack = 0;
            currentQuest.questLeader = gameState.leader;
            currentQuest.approvedVote = { team: currentQuest.team, votes: currentQuest.votes };
        } else {
            gameState.voteTrack++;
            this.addLog(gameState, `Team Rejected. Votes: ${approvals} Approve, ${rejections} Reject. Vote Track is now ${gameState.voteTrack}/5.`, 'vote');
            currentQuest.pastVotes.push({ leader: gameState.leader, team: currentQuest.team, votes: currentQuest.votes });

            if (gameState.voteTrack >= 5) {
                this.endGame(gameState, Alignment.EVIL, 'Five consecutive teams were rejected. The kingdom falls into chaos.');
                return;
            }
            this.advanceLeader(gameState);
            this.addLog(gameState, `${gameState.leader!.name} is the new Quest Leader.`, 'leader');
            gameState.phase = GamePhase.TEAM_SELECTION;
            gameState.pendingTeam = null;
        }

        currentQuest.team = approvals > connectedPlayers.length / 2 ? currentQuest.team : [];
        currentQuest.votes = [];
        gameState.players.forEach((p) => (p.hasVoted = false));
        this.broadcastState(gameState);
    }

    handleVoteOnQuest(playerId: string, vote: 'SUCCESS' | 'FAIL'): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.reconnectingPlayer) return;

        const player = this.getPlayer(gameState, playerId);
        const currentQuest = gameState.questHistory[gameState.currentQuest - 1];

        if (!player || player.hasVoted || !currentQuest.team.some((p) => p.id === playerId) || gameState.phase !== GamePhase.QUEST_VOTE) return;

        if (roomCode.startsWith('TUTORIAL-') && gameState.tutorial?.step === 5) {
            currentQuest.results.push({ playerId, vote });
            player.hasVoted = true;
            const botOnTeam = currentQuest.team.find((p) => p.id !== playerId);
            if (botOnTeam) currentQuest.results.push({ playerId: botOnTeam.id, vote: 'SUCCESS' });
            this.processQuestResult(gameState);
            return;
        }

        if (player.alignment === Alignment.GOOD && vote === 'FAIL') {
            this.io.sockets.sockets.get(playerId)?.emit('error', 'Loyal servants cannot vote to fail a quest.');
            return;
        }

        currentQuest.results.push({ playerId, vote });
        player.hasVoted = true;
        this.broadcastState(gameState);

        if (currentQuest.results.length === currentQuest.team.length) {
            this.processQuestResult(gameState);
        }
    }

    private processQuestResult(gameState: GameState): void {
        const currentQuest = gameState.questHistory[gameState.currentQuest - 1];

        if (gameState.roomCode?.startsWith('TUTORIAL-')) {
            currentQuest.status = 'PASSED';
            this.addLog(gameState, 'Quest 1 has Succeeded.', 'quest');
            gameState.phase = GamePhase.QUEST_RESULT;
            gameState.tutorial = TUTORIAL_STEPS.find((s) => s.step === 6);
            this.broadcastState(gameState);
            return;
        }

        const failVotes = currentQuest.results.filter((r) => r.vote === 'FAIL').length;
        if (failVotes >= currentQuest.failsRequired) {
            currentQuest.status = 'FAILED';
            this.addLog(gameState, `Quest ${gameState.currentQuest} has Failed with ${failVotes} fail vote(s).`, 'quest');
        } else {
            currentQuest.status = 'PASSED';
            this.addLog(gameState, `Quest ${gameState.currentQuest} has Succeeded.`, 'quest');
        }

        gameState.phase = GamePhase.QUEST_RESULT;
        this.broadcastState(gameState);
        setTimeout(() => this.checkForGameOver(gameState), 8000);
    }

    private checkForGameOver(gameState: GameState): void {
        if (!gameState.roomCode || gameState.reconnectingPlayer) return;
        // Only ever advance out of QUEST_RESULT once, no matter how many
        // timers were armed (reconnects re-arm one as a recovery path).
        if (gameState.phase !== GamePhase.QUEST_RESULT) return;

        if (gameState.roomCode.startsWith('TUTORIAL-')) {
            gameState.tutorial = TUTORIAL_STEPS.find((s) => s.step === 7);
            this.broadcastState(gameState);
            return;
        }

        const passedQuests = gameState.questHistory.filter((q) => q.status === 'PASSED').length;
        const failedQuests = gameState.questHistory.filter((q) => q.status === 'FAILED').length;

        if (failedQuests >= 3) {
            this.endGame(gameState, Alignment.EVIL, 'Three quests have failed. The forces of Evil have triumphed.');
            return;
        }
        if (passedQuests >= 3) {
            this.addLog(gameState, 'Three quests have passed! The Assassin prepares to strike...', 'assassination');
            gameState.phase = GamePhase.ASSASSINATION;
            this.broadcastState(gameState);
            return;
        }

        gameState.currentQuest++;
        gameState.questHistory[gameState.currentQuest - 1].status = 'ACTIVE';
        this.advanceLeader(gameState);
        this.addLog(gameState, `Starting Quest ${gameState.currentQuest}. ${gameState.leader!.name} is the Quest Leader.`, 'leader');
        gameState.phase = GamePhase.TEAM_SELECTION;
        gameState.players.forEach((p) => (p.hasVoted = false));
        this.broadcastState(gameState);
    }

    handleUpdateAssassinationTarget(assassinId: string, targetId: string | null): void {
        const roomCode = this.findRoomByPlayerId(assassinId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const assassin = this.getPlayer(gameState, assassinId);
        if (!assassin || assassin.role !== Role.ASSASSIN || gameState.phase !== GamePhase.ASSASSINATION) return;
        gameState.assassinationTargetId = targetId;
        this.broadcastState(gameState);
    }

    async handleAssassinate(assassinId: string, targetId: string): Promise<void> {
        const roomCode = this.findRoomByPlayerId(assassinId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (gameState.reconnectingPlayer) return;

        const assassin = this.getPlayer(gameState, assassinId);
        if (!assassin || assassin.role !== Role.ASSASSIN || gameState.phase !== GamePhase.ASSASSINATION) return;

        const target = this.getPlayer(gameState, targetId);
        this.addLog(gameState, `The Assassin has targeted ${target!.name}.`, 'assassination');
        if (target?.role === Role.MERLIN) {
            await db.run('UPDATE users SET assassin_kills = assassin_kills + 1 WHERE id = $1', [assassin.userId]);
            this.endGame(gameState, Alignment.EVIL, 'The Assassin has slain Merlin! Evil wins!');
        } else {
            this.endGame(gameState, Alignment.GOOD, 'The Assassin chose poorly. Merlin survives! The kingdom is safe.');
        }
    }

    handleSendMessage(playerId: string, messageText: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const player = this.getPlayer(gameState, playerId);
        if (!player) return;

        const message: Message = { senderId: playerId, senderUserId: player.userId, senderName: player.name, text: messageText };
        gameState.chat.push(message);
        if (gameState.chat.length > 100) gameState.chat.shift();
        this.io.to(roomCode).emit('chatMessage', message);
        this.botEngine?.onChatMessage(message, gameState);
    }

    handleSendEmote(playerId: string, emote: string): void {
        if (!ALLOWED_EMOTES.has(emote)) return;
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (!this.getPlayer(gameState, playerId)) return;

        this.io.to(roomCode).emit('emote', { playerId, emote });
    }

    private advanceLeader(gameState: GameState): void {
        if (!gameState.leader) return;
        const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
        if (connectedPlayers.length === 0) return;
        const currentIndex = connectedPlayers.findIndex((p) => p.id === gameState.leader?.id);
        gameState.leader = connectedPlayers[(currentIndex + 1) % connectedPlayers.length];
    }

    handleInitiateRestart(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const player = this.getPlayer(gameState, playerId);
        const socket = this.io.sockets.sockets.get(playerId);

        if (!player?.isHost) { socket?.emit('error', 'Only the host can initiate a restart.'); return; }
        if (gameState.restartVote) { socket?.emit('error', 'A restart vote is already in progress.'); return; }

        const now = Date.now();
        if (gameState.lastRestartInitiatedAt && now - gameState.lastRestartInitiatedAt < RESTART_COOLDOWN) {
            socket?.emit('error', 'Restart can only be initiated every 2 minutes.');
            return;
        }

        gameState.lastRestartInitiatedAt = now;
        gameState.restartVote = { initiatorId: player.id, initiatorName: player.name, votes: { [player.id]: 'yes' }, endsAt: now + RESTART_VOTE_DURATION };
        this.addLog(gameState, `${player.name} has initiated a vote to restart the game.`, 'system');
        const timer = setTimeout(() => this.processRestartVote(gameState), RESTART_VOTE_DURATION);
        this.restartVoteTimers.set(roomCode, timer);
        this.broadcastState(gameState);
    }

    handleVoteOnRestart(playerId: string, vote: 'yes' | 'no'): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        if (!gameState.restartVote || gameState.restartVote.votes[playerId]) return;

        gameState.restartVote.votes[playerId] = vote;
        const connectedPlayers = gameState.players.filter((p) => p.status === 'CONNECTED');
        if (Object.keys(gameState.restartVote.votes).length === connectedPlayers.length) {
            const timer = this.restartVoteTimers.get(roomCode);
            if (timer) clearTimeout(timer);
            this.processRestartVote(gameState);
        } else {
            this.broadcastState(gameState);
        }
    }

    private processRestartVote(gameState: GameState): void {
        if (!gameState.restartVote || !gameState.roomCode) return;
        const { votes } = gameState.restartVote;
        const roomCode = gameState.roomCode;
        const connectedPlayersCount = gameState.players.filter((p) => p.status === 'CONNECTED').length;
        const yesVotes = Object.values(votes).filter((v) => v === 'yes').length;

        if (yesVotes > connectedPlayersCount / 2) {
            this.addLog(gameState, 'Restart vote passed. The game will return to the lobby.', 'system');
            this.io.to(roomCode).emit('chatMessage', { senderId: 'system', senderUserId: 0, senderName: 'System', text: 'Vote passed! The game will now restart.' });
            this.restartGameByRoomCode(roomCode);
        } else {
            this.addLog(gameState, 'Restart vote failed. The game will continue.', 'system');
            this.io.to(roomCode).emit('chatMessage', { senderId: 'system', senderUserId: 0, senderName: 'System', text: 'Vote failed. The game will continue.' });
            gameState.restartVote = null;
            this.broadcastState(gameState);
        }
        this.restartVoteTimers.delete(roomCode);
    }

    handleLeaveRoom(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;

        if (roomCode.startsWith('TUTORIAL-')) {
            const socket = this.io.sockets.sockets.get(playerId);
            if (socket) { socket.emit('kicked', 'You have left the tutorial.'); socket.leave(roomCode); }
            this.games.delete(roomCode);
            return;
        }

        const gameState = this.games.get(roomCode)!;
        if (gameState.phase !== GamePhase.LOBBY) { this.handleDisconnect(playerId); return; }

        const leavingPlayer = this.getPlayer(gameState, playerId);
        if (!leavingPlayer) return;

        this.socialService.updateUserStatus(leavingPlayer.userId, false, undefined);
        this.io.to(roomCode).emit('voice:user-left', { socketId: playerId });
        const socket = this.io.sockets.sockets.get(playerId);
        if (socket) { socket.emit('kicked', 'You have left the lobby.'); socket.leave(roomCode); }

        gameState.players = gameState.players.filter((p) => p.id !== playerId);
        if (this.deleteRoomIfNoHumans(roomCode, gameState)) return;
        this.reassignHostIfNeeded(gameState);

        this.broadcastState(gameState);
        this.io.to(roomCode).emit('chatMessage', { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${leavingPlayer.name} has left the lobby.` });
    }

    handleKickPlayer(hostId: string, playerIdToKick: string): void {
        const roomCode = this.findRoomByPlayerId(hostId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;

        const host = this.getPlayer(gameState, hostId);
        const playerToKick = this.getPlayer(gameState, playerIdToKick);

        if (!host?.isHost) { this.io.sockets.sockets.get(hostId)?.emit('error', 'Only the host can kick players.'); return; }
        if (!playerToKick) { this.io.sockets.sockets.get(hostId)?.emit('error', 'Player to kick not found.'); return; }
        if (hostId === playerIdToKick) { this.io.sockets.sockets.get(hostId)?.emit('error', 'You cannot kick yourself.'); return; }

        const kickedPlayerName = playerToKick.name;
        const kickedSocket = this.io.sockets.sockets.get(playerIdToKick);
        this.io.to(roomCode).emit('voice:user-left', { socketId: playerIdToKick });

        if (kickedSocket) { kickedSocket.emit('kicked', 'You have been kicked from the game by the host.'); kickedSocket.leave(roomCode); }

        if (gameState.phase === GamePhase.LOBBY) {
            if (playerToKick.userId > 0) {
                this.socialService.updateUserStatus(playerToKick.userId, false, undefined);
            } else if (gameState.cpuConfig) {
                gameState.cpuConfig.personas = gameState.cpuConfig.personas.filter((pe) => pe.name !== playerToKick.name);
            }
            gameState.players = gameState.players.filter((p) => p.id !== playerIdToKick);
            this.addLog(gameState, `${kickedPlayerName} was kicked by the host.`, 'system');
            this.io.to(roomCode).emit('chatMessage', { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${kickedPlayerName} was kicked by the host.` });
            this.broadcastState(gameState);
        } else {
            playerToKick.status = 'DISCONNECTED';
            this.endGame(gameState, null, `${kickedPlayerName} was kicked by the host. The game has been aborted.`);
        }
    }

    updatePlayerCustomization(userId: number, customizations: { title: string | null; border: string | null; icon: string | null; background: string | null }): void {
        const gameInfo = this.findGameByPlayerUserId(userId);
        if (!gameInfo) return;
        const [roomCode, gameState] = gameInfo;
        const playerInGame = gameState.players.find((p) => p.userId === userId);
        if (playerInGame) {
            playerInGame.selectedTitle = customizations.title;
            playerInGame.selectedBorder = customizations.border;
            playerInGame.selectedIcon = customizations.icon;
            playerInGame.selectedBackground = customizations.background;
            this.broadcastState(gameState);
            logger.info('Real-time customization update', { name: playerInGame.name, roomCode });
        }
    }

    updatePlayerUsername(userId: number, newUsername: string): void {
        const gameInfo = this.findGameByPlayerUserId(userId);
        if (!gameInfo) return;
        const [roomCode, gameState] = gameInfo;
        const playerInGame = gameState.players.find((p) => p.userId === userId);
        if (playerInGame) {
            const oldUsername = playerInGame.name;
            playerInGame.name = newUsername;
            if (gameState.leader?.userId === userId) gameState.leader.name = newUsername;
            this.broadcastState(gameState);
            this.io.to(roomCode).emit('chatMessage', { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${oldUsername} is now known as ${newUsername}.` });
        }
    }

    // --- Dragon's Breath ---

    private _createDragonsBreathGame(gameState: GameState): void {
        const [player1, player2] = gameState.players;
        const baseDeck: DragonCardType[] = [
            DragonCardType.ATTACK, DragonCardType.ATTACK, DragonCardType.SKIP, DragonCardType.SKIP,
            DragonCardType.SEE_THE_FUTURE, DragonCardType.SEE_THE_FUTURE, DragonCardType.SHUFFLE,
            DragonCardType.EMBERDRAKE_HATCHLING, DragonCardType.GLIMMERING_WHELP, DragonCardType.SUNSTONE_DRAKE,
            DragonCardType.EMBERDRAKE_HATCHLING, DragonCardType.GLIMMERING_WHELP, DragonCardType.SUNSTONE_DRAKE,
            DragonCardType.DEFUSE, DragonCardType.DEFUSE,
        ];
        const hands: { [playerId: string]: DragonCard[] } = { [player1.id]: [], [player2.id]: [] };
        const fullDeck: DragonCard[] = baseDeck.map((type) => ({ id: `${type}-${Math.random()}`, type }));
        this._shuffleArray(fullDeck);
        for (let i = 0; i < 5; i++) {
            if (fullDeck.length > 0) hands[player1.id].push(fullDeck.pop()!);
            if (fullDeck.length > 0) hands[player2.id].push(fullDeck.pop()!);
        }
        fullDeck.push({ id: 'dragon-breath', type: DragonCardType.DRAGON_BREATH });
        this._shuffleArray(fullDeck);
        const startingPlayer = Math.random() < 0.5 ? player1 : player2;
        gameState.dragonsBreathState = { deck: fullDeck, hands, discardPile: [], currentPlayerId: startingPlayer.id, turnsToTake: 1, isViewingFuture: null, futureCards: [], isPlacingDragon: null, winner: null, loser: null };
    }

    private _shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private _advanceDBTurn(gameState: GameState): void {
        const dbState = gameState.dragonsBreathState!;
        const currentIndex = gameState.players.findIndex((p) => p.id === dbState.currentPlayerId);
        const nextIndex = (currentIndex + 1) % gameState.players.length;
        dbState.currentPlayerId = gameState.players[nextIndex].id;
        dbState.turnsToTake = 1;
        this.addLog(gameState, `${gameState.players[nextIndex].name}'s turn.`, 'dragonsBreath');
    }

    private async _saveDragonsBreathResult(winnerUserId: number, loserUserId: number): Promise<void> {
        try {
            await db.run('INSERT INTO dragons_breath_matches (winner_user_id, loser_user_id) VALUES ($1, $2)', [winnerUserId, loserUserId]);
        } catch (err) {
            logger.error("Failed to save Dragon's Breath match result", { error: String(err) });
        }
    }

    handleStartDragonsBreath(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const player = this.getPlayer(gameState, playerId);
        if (!player?.isHost || gameState.players.length !== 2) {
            this.io.to(playerId).emit('error', "Dragon's Breath can only be started by the host in a 2-player lobby.");
            return;
        }
        this._createDragonsBreathGame(gameState);
        gameState.phase = GamePhase.DRAGONS_BREATH;
        const startingPlayer = gameState.players.find((p) => p.id === gameState.dragonsBreathState!.currentPlayerId);
        this.addLog(gameState, `A game of Dragon's Breath has begun! ${startingPlayer?.name || 'A player'} starts.`, 'dragonsBreath');
        this.broadcastState(gameState);
    }

    handleDrawCard(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const dbState = gameState.dragonsBreathState;
        const player = this.getPlayer(gameState, playerId);
        if (!dbState || !player || dbState.currentPlayerId !== playerId || dbState.isPlacingDragon || dbState.isViewingFuture) return;

        if (dbState.deck.length === 0) { this.io.to(playerId).emit('error', 'The deck is empty!'); return; }

        const drawnCard = dbState.deck.pop()!;
        this.addLog(gameState, `${player.name} draws a card...`, 'dragonsBreath');

        if (drawnCard.type === DragonCardType.DRAGON_BREATH) {
            const defuseIndex = dbState.hands[playerId].findIndex((c) => c.type === DragonCardType.DEFUSE);
            if (defuseIndex !== -1) {
                if (player.userId) db.run('UPDATE users SET db_defuses = db_defuses + 1 WHERE id = $1', [player.userId]);
                const defuseCard = dbState.hands[playerId].splice(defuseIndex, 1)[0];
                dbState.discardPile.push(defuseCard);
                dbState.isPlacingDragon = playerId;
                this.addLog(gameState, `...it's the Dragon's Breath! But ${player.name} defuses it!`, 'dragonsBreath');
            } else {
                const winner = gameState.players.find((p) => p.id !== playerId)!;
                dbState.loser = playerId;
                dbState.winner = winner.id;
                this.addLog(gameState, `...it's the Dragon's Breath! ${player.name} is eliminated! ${winner.name} wins!`, 'dragonsBreath');
                if (winner.userId && player.userId) this._saveDragonsBreathResult(winner.userId, player.userId);
            }
        } else {
            dbState.hands[playerId].push(drawnCard);
        }

        dbState.turnsToTake--;
        if (dbState.turnsToTake <= 0 && !dbState.isPlacingDragon && !dbState.winner) {
            this._advanceDBTurn(gameState);
        }
        this.broadcastState(gameState);
    }

    async handlePlayCard(playerId: string, cardId: string): Promise<void> {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const dbState = gameState.dragonsBreathState;
        const player = this.getPlayer(gameState, playerId);
        if (!dbState || !player || dbState.currentPlayerId !== playerId) return;

        const cardIndex = dbState.hands[playerId].findIndex((c) => c.id === cardId);
        if (cardIndex === -1) return;

        const card = dbState.hands[playerId].splice(cardIndex, 1)[0];
        dbState.discardPile.push(card);
        this.addLog(gameState, `${player.name} played ${card.type}.`, 'dragonsBreath');

        switch (card.type) {
            case DragonCardType.ATTACK:
                if (player.userId) await db.run('UPDATE users SET db_attacks_played = db_attacks_played + 1 WHERE id = $1', [player.userId]);
                this._advanceDBTurn(gameState);
                dbState.turnsToTake = 2;
                this.addLog(gameState, `${gameState.players.find((p) => p.id === dbState.currentPlayerId)?.name} must now take 2 turns.`, 'dragonsBreath');
                break;
            case DragonCardType.SKIP:
                this._advanceDBTurn(gameState);
                break;
            case DragonCardType.SEE_THE_FUTURE:
                if (player.userId) await db.run('UPDATE users SET db_futures_played = db_futures_played + 1 WHERE id = $1', [player.userId]);
                dbState.isViewingFuture = playerId;
                dbState.futureCards = dbState.deck.slice(-3).reverse();
                break;
            case DragonCardType.SHUFFLE:
                this._shuffleArray(dbState.deck);
                this.addLog(gameState, 'The deck has been shuffled.', 'dragonsBreath');
                break;
            case DragonCardType.EMBERDRAKE_HATCHLING:
            case DragonCardType.GLIMMERING_WHELP:
            case DragonCardType.SUNSTONE_DRAKE:
                if (player.userId) await db.run('UPDATE users SET db_fillers_played = db_fillers_played + 1 WHERE id = $1', [player.userId]);
                break;
        }
        this.broadcastState(gameState);
    }

    handlePlaceDragonCard(playerId: string, index: number): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const dbState = gameState.dragonsBreathState;
        if (!dbState || dbState.isPlacingDragon !== playerId) return;

        const deckSize = dbState.deck.length;
        if (index < 0 || index > deckSize) { this.io.to(playerId).emit('error', 'Invalid placement index.'); return; }

        dbState.deck.splice(deckSize - index, 0, { id: 'dragon-breath', type: DragonCardType.DRAGON_BREATH });
        dbState.isPlacingDragon = null;
        this._advanceDBTurn(gameState);
        this.addLog(gameState, `${this.getPlayer(gameState, playerId)!.name} placed the Dragon's Breath back in the deck...`, 'dragonsBreath');
        this.broadcastState(gameState);
    }

    handleEndFutureView(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        const gameState = this.games.get(roomCode)!;
        const dbState = gameState.dragonsBreathState;
        if (!dbState || dbState.isViewingFuture !== playerId) return;
        dbState.isViewingFuture = null;
        dbState.futureCards = [];
        this.broadcastState(gameState);
    }

    handleReturnToLobby(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode) return;
        this.restartGameByRoomCode(roomCode);
    }

    handleAdvanceTutorial(playerId: string): void {
        const roomCode = this.findRoomByPlayerId(playerId);
        if (!roomCode || !roomCode.startsWith('TUTORIAL-')) return;
        const gameState = this.games.get(roomCode)!;
        if (!gameState.tutorial) return;

        const currentStepIndex = TUTORIAL_STEPS.findIndex((s) => s.step === gameState.tutorial!.step);
        if (currentStepIndex === -1 || currentStepIndex + 1 >= TUTORIAL_STEPS.length) return;
        gameState.tutorial = TUTORIAL_STEPS[currentStepIndex + 1];
        this.broadcastState(gameState);
    }

    // --- Admin ---

    getRoomCount(): number { return this.games.size; }

    getAllRooms() {
        return Array.from(this.games.values()).map((state) => ({
            roomCode: state.roomCode,
            playerCount: state.players.length,
            phase: state.phase,
            players: state.players.map((p) => ({ name: p.name, status: p.status })),
        }));
    }

    forceCloseRoom(roomCode: string): void {
        const code = roomCode.toUpperCase();
        const gameState = this.games.get(code);
        if (gameState) {
            this.io.to(code).emit('kicked', 'This room has been closed by an administrator.');
            this.io.in(code).disconnectSockets(true);
            this.games.delete(code);
            logger.info('Admin forced room close', { roomCode: code });
        }
    }

    forceRemoveUserByUserId(userId: number): void {
        const gameInfo = this.findGameByPlayerUserId(userId);
        if (gameInfo) {
            const [roomCode, gameState] = gameInfo;
            const player = gameState.players.find((p) => p.userId === userId);
            if (player) {
                const socket = this.io.sockets.sockets.get(player.id);
                if (socket) {
                    socket.emit('kicked', 'You have been removed from the game by an administrator.');
                    socket.leave(roomCode);
                    socket.disconnect(true);
                }
                this.handleDisconnect(player.id);
                logger.info('Admin forced user removal', { userId, roomCode });
            }
        }
    }
}

