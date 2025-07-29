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
  LogEntry,
  Match,
  DragonCardType,
  DragonCard,
  DragonsBreathState,
  DragonsBreathStats,
  OnlineUser,
  GameInvite,
  Friend
} from "./types";
import { EVIL_PLAYER_COUNT, QUEST_CONFIGURATIONS, ROLES, DEFAULT_ICONS } from "./constants";
import db from "./db";
import { authMiddleware, generateToken, authMiddlewareSocket, adminMiddleware } from "./auth";
import { ALL_ACHIEVEMENTS, Achievement } from "./achievements";

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
    'http://localhost:3000', // For local development
    'https://pavalononline.pramodhthetechguy.site',
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
    res.status(201).json({ token, user: { ...user, selectedTitle: null, selectedBorder: null, selectedIcon: null, selectedBackground: null } });
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
        selected_background: string | null;
    }>(
      "SELECT id, username, password_hash, is_admin, selected_title, selected_border, selected_icon, selected_background FROM users WHERE username = $1",
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
        selectedBackground: userRow.selected_background,
    };
    const token = generateToken({ id: user.id, username: user.username, is_admin: user.is_admin });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Server error during login." });
  }
});

app.get("/api/verify-token", authMiddleware, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const userRow = await db.get<{
            id: number;
            username: string;
            is_admin: boolean;
            selected_title: string | null;
            selected_border: string | null;
            selected_icon: string | null;
            selected_background: string | null;
        }>(
            "SELECT id, username, is_admin, selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1",
            [userId]
        );

        if (!userRow) {
            return res.status(404).json({ message: "User not found." });
        }

        const user: User = { 
            id: userRow.id, 
            username: userRow.username,
            is_admin: userRow.is_admin,
            selectedTitle: userRow.selected_title,
            selectedBorder: userRow.selected_border,
            selectedIcon: userRow.selected_icon,
            selectedBackground: userRow.selected_background,
        };
        res.json({ user });

    } catch (error) {
        res.status(500).json({ message: "Server error during token verification." });
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

app.get("/api/stats/dragons-breath", authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const stats = await gameService.getDragonsBreathStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("Failed to fetch Dragon's Breath stats:", error);
    res.status(500).json({ message: "Failed to fetch Dragon's Breath stats." });
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

app.get("/api/leaderboard/dragons-breath", authMiddleware, async (req, res) => {
    try {
        const [
            mostWins,
            mostDefuses,
            mostSees,
            mostAttacks,
            mostFillers
        ] = await Promise.all([
            db.all<{ username: string; value: string }>(`
                SELECT u.username, COUNT(m.id) as value 
                FROM users u 
                JOIN dragons_breath_matches m ON u.id = m.winner_user_id 
                GROUP BY u.id 
                ORDER BY value DESC 
                LIMIT 10
            `),
            db.all<{ username: string; value: number }>(`
                SELECT username, db_defuses as value 
                FROM users 
                WHERE db_defuses > 0 
                ORDER BY value DESC 
                LIMIT 10
            `),
            db.all<{ username: string; value: number }>(`
                SELECT username, db_futures_played as value 
                FROM users 
                WHERE db_futures_played > 0 
                ORDER BY value DESC 
                LIMIT 10
            `),
            db.all<{ username: string; value: number }>(`
                SELECT username, db_attacks_played as value 
                FROM users 
                WHERE db_attacks_played > 0 
                ORDER BY value DESC 
                LIMIT 10
            `),
            db.all<{ username: string; value: number }>(`
                SELECT username, db_fillers_played as value 
                FROM users 
                WHERE db_fillers_played > 0 
                ORDER BY value DESC 
                LIMIT 10
            `)
        ]);

        res.json({
            mostWins: mostWins.map(e => ({...e, value: parseInt(e.value, 10)})),
            mostDefuses,
            mostSees,
            mostAttacks,
            mostFillers
        });

    } catch (error) {
        console.error("Failed to fetch Dragon's Breath leaderboard:", error);
        res.status(500).json({ message: "Failed to fetch Dragon's Breath leaderboard data." });
    }
});

app.get("/api/match/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const performances = await db.all<MatchPlayerPerformance>(
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
        const userAchievements = await db.all<UserAchievement>(
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
    const { title, border, icon, background } = req.body;
    
    if (title && typeof title === 'string' && title.length > 10) {
        return res.status(400).json({ message: "Title cannot be more than 10 characters." });
    }

    try {
        const userAchievements = await db.all<{ achievement_id: string }>(
            "SELECT achievement_id FROM user_achievements WHERE user_id = $1",
            [userId]
        );

        const unlockedRewards = new Set<string>();

        // Default icons are always unlocked
        DEFAULT_ICONS.forEach(i => unlockedRewards.add(i));

        userAchievements.forEach(ua => {
            const achievement = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievement_id);
            achievement?.rewards.forEach(reward => {
                unlockedRewards.add(reward.value);
            });
        });
        
        if (border && !unlockedRewards.has(border)) {
            return res.status(403).json({ message: "You have not unlocked this border." });
        }
        if (icon && !unlockedRewards.has(icon)) {
            return res.status(403).json({ message: "You have not unlocked this icon." });
        }
        
        await db.run("UPDATE users SET selected_title = $1, selected_border = $2, selected_icon = $3, selected_background = $4 WHERE id = $5", [title, border, icon, background, userId]);
        
        // Update player in any active game session for real-time changes
        gameService.updatePlayerCustomization(userId, { title, border, icon, background });

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
        
        const userRow = await db.get<{ is_admin: boolean; selected_title: string | null; selected_border: string | null; selected_icon: string | null; selected_background: string | null; }>(
             "SELECT is_admin, selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1",
             [userId]
        );

        const fullUserObject: User = {
            id: userId,
            username,
            is_admin: userRow?.is_admin,
            selectedTitle: userRow?.selected_title,
            selectedBorder: userRow?.selected_border,
            selectedIcon: userRow?.selected_icon,
            selectedBackground: userRow?.selected_background
        };
        
        const token = generateToken({ id: fullUserObject.id, username: fullUserObject.username, is_admin: fullUserObject.is_admin });

        res.json({ success: true, message: "Username updated successfully.", user: fullUserObject, token });

    } catch (error) {
        console.error("Failed to update username:", error);
        res.status(500).json({ message: "Server error during username update." });
    }
});

// --- SOCIAL ROUTES ---
const socialRouter = express.Router();
socialRouter.use(authMiddleware);

socialRouter.get('/friends', async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const friends = await socialService.getFriendsOfUser(userId);
        res.json(friends);
    } catch (error) {
        console.error("Failed to fetch friends:", error);
        res.status(500).json({ message: "Failed to fetch friends." });
    }
});

socialRouter.get('/requests', async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const requests = await db.all<{ id: number, username: string }>(`
            SELECT u.id, u.username 
            FROM friends f 
            JOIN users u ON f.action_user_id = u.id 
            WHERE (f.user1_id = $1 OR f.user2_id = $1) AND f.status = 'pending' AND f.action_user_id != $1
        `, [userId]);
        res.json(requests);
    } catch (error) {
        console.error("Failed to fetch friend requests:", error);
        res.status(500).json({ message: "Failed to fetch friend requests." });
    }
});

socialRouter.get('/requests/sent', async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const requests = await db.all<{ id: number, username: string }>(`
            SELECT 
                u.id, 
                u.username 
            FROM friends f 
            JOIN users u ON u.id = (CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END)
            WHERE f.action_user_id = $1 AND f.status = 'pending'
        `, [userId]);
        res.json(requests);
    } catch (error) {
        console.error("Failed to fetch sent friend requests:", error);
        res.status(500).json({ message: "Failed to fetch sent friend requests." });
    }
});

socialRouter.post('/add', async (req, res) => {
    const userId = (req as any).user.id;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: "Username is required." });
    }

    try {
        const targetUser = await db.get<User>("SELECT id, username FROM users WHERE username = $1", [username]);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }
        if (targetUser.id === userId) {
            return res.status(400).json({ message: "You cannot add yourself as a friend." });
        }

        const user1_id = Math.min(userId, targetUser.id);
        const user2_id = Math.max(userId, targetUser.id);

        const existingFriendship = await db.get<{ status: string }>("SELECT status FROM friends WHERE user1_id = $1 AND user2_id = $2", [user1_id, user2_id]);
        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(409).json({ message: "You are already friends with this user." });
            } else {
                return res.status(409).json({ message: "A friend request is already pending." });
            }
        }

        await db.run(
            "INSERT INTO friends (user1_id, user2_id, status, action_user_id) VALUES ($1, $2, 'pending', $3)",
            [user1_id, user2_id, userId]
        );
        
        socialService.notifyFriendRequest(userId, (req as any).user.username, targetUser.id);
        
        res.status(201).json({ message: "Friend request sent.", sentRequest: { id: targetUser.id, username: targetUser.username } });
    } catch (error) {
        console.error("Error sending friend request:", error);
        res.status(500).json({ message: "Server error while sending friend request." });
    }
});

socialRouter.post('/respond', async (req, res) => {
    const userId = (req as any).user.id;
    const { requesterId, action } = req.body; // action: 'accept' or 'decline'

    if (!requesterId || !['accept', 'decline'].includes(action)) {
        return res.status(400).json({ message: "Invalid request." });
    }

    try {
        const user1_id = Math.min(userId, requesterId);
        const user2_id = Math.max(userId, requesterId);
        
        if (action === 'accept') {
            await db.run(
                "UPDATE friends SET status = 'accepted', action_user_id = $1 WHERE user1_id = $2 AND user2_id = $3 AND status = 'pending'",
                [userId, user1_id, user2_id]
            );
            socialService.notifyFriendAccepted(userId, requesterId);
            res.json({ message: "Friend request accepted." });
        } else { // decline
            await db.run(
                "DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 AND status = 'pending'",
                [user1_id, user2_id]
            );
            res.json({ message: "Friend request declined." });
        }
    } catch (error) {
        console.error("Error responding to friend request:", error);
        res.status(500).json({ message: "Server error while responding to friend request." });
    }
});

socialRouter.delete('/remove/:friendId', async (req, res) => {
    const userId = (req as any).user.id;
    const friendId = parseInt(req.params.friendId, 10);

    if (isNaN(friendId)) {
        return res.status(400).json({ message: "Invalid friend ID." });
    }
    
    try {
        const user1_id = Math.min(userId, friendId);
        const user2_id = Math.max(userId, friendId);
        
        await db.run(
            "DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 AND status = 'accepted'",
            [user1_id, user2_id]
        );

        socialService.notifyFriendRemoved(userId, friendId);
        res.json({ message: "Friend removed." });
    } catch (error) {
        console.error("Error removing friend:", error);
        res.status(500).json({ message: "Server error while removing friend." });
    }
});

socialRouter.delete('/request/cancel/:recipientId', async (req, res) => {
    const userId = (req as any).user.id;
    const recipientId = parseInt(req.params.recipientId, 10);
     if (isNaN(recipientId)) {
        return res.status(400).json({ message: "Invalid recipient ID." });
    }

    try {
        const user1_id = Math.min(userId, recipientId);
        const user2_id = Math.max(userId, recipientId);
        
        await db.run(
            "DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 AND status = 'pending' AND action_user_id = $3",
            [user1_id, user2_id, userId]
        );
        res.json({ message: 'Friend request cancelled.' });
    } catch (error) {
        console.error("Error cancelling friend request:", error);
        res.status(500).json({ message: "Server error while cancelling friend request." });
    }
});

app.use('/api/social', socialRouter);


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

        // Manually delete records from tables with foreign keys to users.id
        // This is necessary to prevent foreign key constraint violations if ON DELETE CASCADE is not set.
        await db.run("DELETE FROM player_performance WHERE user_id = $1", [userId]);
        await db.run("DELETE FROM user_achievements WHERE user_id = $1", [userId]);
        await db.run("DELETE FROM dragons_breath_matches WHERE winner_user_id = $1 OR loser_user_id = $1", [userId]);


        // Now it is safe to delete the user.
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
                win_streak, highest_win_streak, assassin_kills, total_games, total_wins, 
                good_games, good_wins, evil_games, evil_wins,
                db_defuses, db_futures_played, db_attacks_played, db_fillers_played
            FROM users WHERE id = $1`, [userId]);
        if (!stats) return res.status(404).json({ message: 'User not found.' });
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch user stats.' });
    }
});

adminRouter.put('/users/:id/stats', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const { 
        win_streak, highest_win_streak, assassin_kills, total_games, total_wins, 
        good_games, good_wins, evil_games, evil_wins,
        db_defuses, db_futures_played, db_attacks_played, db_fillers_played
    } = req.body;
    try {
        await db.run(`
            UPDATE users SET 
                win_streak = $1, assassin_kills = $2, total_games = $3, total_wins = $4,
                good_games = $5, good_wins = $6, evil_games = $7, evil_wins = $8,
                highest_win_streak = $10,
                db_defuses = $11, db_futures_played = $12, 
                db_attacks_played = $13, db_fillers_played = $14
            WHERE id = $9`, 
            [
                win_streak, assassin_kills, total_games, total_wins, good_games, good_wins, evil_games, evil_wins, userId, highest_win_streak,
                db_defuses, db_futures_played, db_attacks_played, db_fillers_played
            ]
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

// --- Game Management Routes ---
adminRouter.get('/matches', async (req, res) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 15;
    const offset = (page - 1) * limit;

    try {
        const matchesQuery = `
            SELECT 
                m.id, 
                m.winner, 
                m.played_at,
                (SELECT json_agg(u.username) 
                 FROM player_performance pp 
                 JOIN users u ON pp.user_id = u.id 
                 WHERE pp.match_id = m.id) as players
            FROM matches m
            ORDER BY m.played_at DESC
            LIMIT $1 OFFSET $2
        `;
        const totalQuery = 'SELECT COUNT(*) FROM matches';

        const [matchesResult, totalResult] = await Promise.all([
            db.all(matchesQuery, [limit, offset]),
            db.get<{ count: string }>(totalQuery)
        ]);

        const total = parseInt(totalResult?.count || '0', 10);

        res.json({
            matches: matchesResult,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch matches.' });
    }
});

adminRouter.delete('/matches/:id', async (req, res) => {
    const matchId = parseInt(req.params.id, 10);
    if (isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match ID.' });
    }

    try {
        await db.transaction(async (client) => {
            const performancesRes = await client.query('SELECT user_id FROM player_performance WHERE match_id = $1', [matchId]);
            if (performancesRes.rows.length === 0) throw new Error('Match not found.');
            const userIds = [...new Set(performancesRes.rows.map(p => p.user_id))];

            await client.query('DELETE FROM player_performance WHERE match_id = $1', [matchId]);
            await client.query('DELETE FROM matches WHERE id = $1', [matchId]);

            for (const userId of userIds) {
                const allUserPerfsRes = await client.query(
                    'SELECT pp.*, m.played_at FROM player_performance pp JOIN matches m ON pp.match_id = m.id WHERE pp.user_id = $1 ORDER BY m.played_at ASC',
                    [userId]
                );
                const allUserPerfs = allUserPerfsRes.rows;

                const total_games = allUserPerfs.length;
                const total_wins = allUserPerfs.filter(p => p.won).length;
                const good_games = allUserPerfs.filter(p => p.alignment === 'Good').length;
                const good_wins = allUserPerfs.filter(p => p.alignment === 'Good' && p.won).length;
                const evil_games = allUserPerfs.filter(p => p.alignment === 'Evil').length;
                const evil_wins = allUserPerfs.filter(p => p.alignment === 'Evil' && p.won).length;
                const assassin_kills = allUserPerfs.filter(p => p.role === 'Assassin' && p.won).length;
                
                let current_win_streak = 0;
                let highest_win_streak = 0;
                for (const perf of allUserPerfs) {
                    if (perf.won) {
                        current_win_streak++;
                    } else {
                        current_win_streak = 0;
                    }
                    if (current_win_streak > highest_win_streak) {
                        highest_win_streak = current_win_streak;
                    }
                }

                await client.query(
                    `UPDATE users SET 
                        total_games = $1, total_wins = $2, good_games = $3, good_wins = $4, 
                        evil_games = $5, evil_wins = $6, assassin_kills = $7, win_streak = $8,
                        highest_win_streak = $10
                     WHERE id = $9`,
                    [total_games, total_wins, good_games, good_wins, evil_games, evil_wins, assassin_kills, current_win_streak, userId, highest_win_streak]
                );

                await client.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);

                const newStatsForCheck = { totalGames: total_games, totalWins: total_wins, goodWins: good_wins, evilWins: evil_wins };
                const grantedAchievements = new Set<string>();

                for (const ach of ALL_ACHIEVEMENTS) {
                    if (ach.check(newStatsForCheck, null)) {
                        grantedAchievements.add(ach.id);
                    }
                    for (const perf of allUserPerfs) {
                         if (ach.check(null, { role: perf.role, alignment: perf.alignment, won: perf.won })) {
                            grantedAchievements.add(ach.id);
                        }
                    }
                }
                
                for (const achievementId of grantedAchievements) {
                    await client.query(
                        "INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT(user_id, achievement_id) DO NOTHING",
                        [userId, achievementId]
                    );
                }
            }
        });
        res.json({ success: true, message: 'Match deleted and user data resynchronized.' });
    } catch (e) {
        console.error('Error deleting match:', e);
        res.status(500).json({ message: 'Failed to delete match. The operation was rolled back.' });
    }
});

// --- Friend Management Routes ---
adminRouter.get('/friendships', async (req, res) => {
    try {
        const friendships = await db.all(`
            SELECT f.id, u1.username as user1, u2.username as user2, f.status, f.created_at
            FROM friends f
            JOIN users u1 ON f.user1_id = u1.id
            JOIN users u2 ON f.user2_id = u2.id
            ORDER BY f.id DESC
        `);
        res.json(friendships);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch friendships." });
    }
});

adminRouter.delete('/friendships/:id', async (req, res) => {
    const friendshipId = parseInt(req.params.id, 10);
    if (isNaN(friendshipId)) {
        return res.status(400).json({ message: 'Invalid friendship ID.' });
    }
    try {
        await db.run("DELETE FROM friends WHERE id = $1", [friendshipId]);
        res.json({ success: true, message: 'Friendship deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete friendship.' });
    }
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
      const userAchievements = await db.all<UserAchievement>("SELECT achievement_id FROM user_achievements WHERE user_id = $1", [userId]);
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

// --- Social Service ---
class SocialService {
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    private onlineUsers: Map<number, OnlineUser> = new Map();
    private gameService?: GameService;

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
    }
    
    setGameService(service: GameService) {
        this.gameService = service;
    }

    async addUser(socket: any, user: User) {
        this.onlineUsers.set(user.id, { socketId: socket.id, roomCode: null });
        socket.join(`user-${user.id}`);
        console.log(`[+] User ${user.username} (ID: ${user.id}) connected and joined room user-${user.id}`);
        await this.broadcastStatusToFriends(user.id, true, false);
    }

    async removeUser(socket: any) {
        const user = socket.user;
        if (user && this.onlineUsers.has(user.id)) {
            this.onlineUsers.delete(user.id);
            console.log(`[-] User ${user.username} (ID: ${user.id}) disconnected.`);
            await this.broadcastStatusToFriends(user.id, false, false, null);
        }
    }

    async updateUserStatus(userId: number, isInGame: boolean, roomCode?: string) {
        const user = this.onlineUsers.get(userId);
        if (user) {
            user.roomCode = roomCode || null;
            this.onlineUsers.set(userId, user);
            const friendGame = roomCode && this.gameService ? this.gameService.getGameByRoomCode(roomCode) : undefined;
            await this.broadcastStatusToFriends(userId, true, isInGame, friendGame?.phase);
        }
    }

    private async broadcastStatusToFriends(userId: number, isOnline: boolean, isInGame: boolean, gamePhase?: GamePhase | null) {
        const friends = await this.getFriendIds(userId);
        for (const friendId of friends) {
            if (this.isUserOnline(friendId)) {
                this.io.to(`user-${friendId}`).emit('social:status', { userId, isOnline, isInGame, gamePhase: gamePhase ?? null });
            }
        }
    }

    private async getFriendIds(userId: number): Promise<number[]> {
        const results = await db.all<{ friend_id: number }>(`
            SELECT CASE
                WHEN user1_id = $1 THEN user2_id
                ELSE user1_id
            END as friend_id
            FROM friends
            WHERE (user1_id = $1 OR user2_id = $1) AND status = 'accepted'
        `, [userId]);
        return results.map(r => r.friend_id);
    }
    
    async getFriendsOfUser(userId: number) {
        const friendsData = await db.all<{ id: number; username: string; selected_title: string; selected_border: string; selected_icon: string; selected_background: string; }>(`
            SELECT u.id, u.username, u.selected_title, u.selected_border, u.selected_icon, u.selected_background
            FROM users u
            JOIN friends f ON (u.id = f.user1_id OR u.id = f.user2_id)
            WHERE (f.user1_id = $1 OR f.user2_id = $1) AND f.status = 'accepted' AND u.id != $1
        `, [userId]);
        
        return friendsData.map(f => {
            const onlineInfo = this.onlineUsers.get(f.id);
            const friendGame = onlineInfo?.roomCode && this.gameService
                ? this.gameService.getGameByRoomCode(onlineInfo.roomCode)
                : undefined;

            return {
                id: f.id,
                username: f.username,
                selectedTitle: f.selected_title,
                selectedBorder: f.selected_border,
                selectedIcon: f.selected_icon,
                selectedBackground: f.selected_background,
                isOnline: !!onlineInfo,
                isInGame: !!onlineInfo?.roomCode,
                gamePhase: friendGame?.phase || null
            };
        });
    }

    isUserOnline(userId: number): boolean {
        return this.onlineUsers.has(userId);
    }
    
    getUserSocketId(userId: number): string | undefined {
        return this.onlineUsers.get(userId)?.socketId;
    }

    notifyFriendRequest(fromUserId: number, fromUsername: string, toUserId: number) {
        if (this.isUserOnline(toUserId)) {
            this.io.to(`user-${toUserId}`).emit('social:request_received', {
                id: fromUserId,
                username: fromUsername,
            });
        }
    }

    async notifyFriendAccepted(acceptedByUserId: number, requesterId: number) {
        const [acceptedByUser, requester] = await Promise.all([
            db.get<User>('SELECT id, username, selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1', [acceptedByUserId]),
            db.get<User>('SELECT id, username, selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1', [requesterId])
        ]);

        const createPayload = (friendUser: User): Friend => {
            const onlineInfo = this.onlineUsers.get(friendUser.id);
            const friendGame = onlineInfo?.roomCode && this.gameService
                ? this.gameService.getGameByRoomCode(onlineInfo.roomCode)
                : undefined;

            return {
                id: friendUser.id,
                username: friendUser.username,
                selectedTitle: friendUser.selectedTitle,
                selectedBorder: friendUser.selectedBorder,
                selectedIcon: friendUser.selectedIcon,
                selectedBackground: friendUser.selectedBackground,
                isOnline: this.isUserOnline(friendUser.id),
                isInGame: !!onlineInfo?.roomCode,
                gamePhase: friendGame?.phase || null
            };
        };

        if (this.isUserOnline(requesterId) && acceptedByUser) {
            this.io.to(`user-${requesterId}`).emit('social:request_accepted', createPayload(acceptedByUser));
        }
        if (this.isUserOnline(acceptedByUserId) && requester) {
             this.io.to(`user-${acceptedByUserId}`).emit('social:request_accepted', createPayload(requester));
        }
    }

    notifyFriendRemoved(removedByUserId: number, removedUserId: number) {
        if (this.isUserOnline(removedUserId)) {
            this.io.to(`user-${removedUserId}`).emit('social:friend_removed', { friendId: removedByUserId });
        }
    }

    handleGameInvite(fromUser: User, toFriendId: number) {
        const friendSocketId = this.getUserSocketId(toFriendId);
        const fromUserRoomCode = this.onlineUsers.get(fromUser.id)?.roomCode;
        const fromUserSocketId = this.getUserSocketId(fromUser.id);

        if (friendSocketId && fromUserRoomCode && fromUserSocketId) {
            // Server-side validation: Ensure the person inviting is in a lobby state
            const fromUserGame = this.gameService?.getGameByRoomCode(fromUserRoomCode);
            if (fromUserGame?.phase !== GamePhase.LOBBY) {
                this.io.to(fromUserSocketId).emit('error', 'You can only invite friends while you are in a lobby.');
                return;
            }

            const friendUser = this.onlineUsers.get(toFriendId);
            if (friendUser?.roomCode) {
                 if (!this.gameService) {
                    this.io.to(fromUserSocketId).emit('error', 'Server is initializing, please try again.');
                    return;
                }
                const friendGameState = this.gameService.getGameByRoomCode(friendUser.roomCode);
                
                const nonInvitablePhases = [
                    GamePhase.ROLE_REVEAL,
                    GamePhase.TEAM_SELECTION,
                    GamePhase.TEAM_VOTE,
                    GamePhase.QUEST_VOTE,
                    GamePhase.QUEST_RESULT,
                    GamePhase.ASSASSINATION,
                ];

                if (friendGameState && nonInvitablePhases.includes(friendGameState.phase)) {
                    this.io.to(fromUserSocketId).emit('error', 'Your friend is in an active game and cannot be invited right now.');
                    return;
                }
            }
            const invitePayload: GameInvite = { from: fromUser, roomCode: fromUserRoomCode };
            this.io.to(friendSocketId).emit('social:invite_received', invitePayload);
        } else if (fromUserSocketId) {
            this.io.to(fromUserSocketId).emit('error', 'Could not send invite. Friend is offline or you are not in a lobby.');
        }
    }
}

// --- Game Service ---
class GameService {
  private games: Map<string, GameState> = new Map();
  private reconnectionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private restartVoteTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private socialService: SocialService;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>, socialService: SocialService) {
    this.io = io;
    this.socialService = socialService;
  }
  
  public getGameByRoomCode(roomCode: string): GameState | undefined {
    return this.games.get(roomCode.toUpperCase());
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
      dragonsBreathState: null,
      assassinationTargetId: null,
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
    const existingGameInfo = this.findGameByPlayerUserId(user.id);
    const upperRoomCode = roomCode?.toUpperCase();

    // Handle lobby switching
    if (existingGameInfo && upperRoomCode && existingGameInfo[0] !== upperRoomCode) {
        const [oldRoomCode, oldGameState] = existingGameInfo;
        const oldPlayer = oldGameState.players.find(p => p.userId === user.id);
        
        const switchablePhases = [GamePhase.LOBBY, GamePhase.END_GAME, GamePhase.DRAGONS_BREATH];
        if (oldPlayer && switchablePhases.includes(oldGameState.phase)) {
            console.log(`[SWITCH] User ${user.username} is switching from lobby ${oldRoomCode} to ${upperRoomCode}`);
            
            // Remove player from the old lobby
            oldGameState.players = oldGameState.players.filter(p => p.userId !== user.id);
            
            // Handle host reassignment if the leaving player was the host
            if (oldPlayer.isHost && oldGameState.players.length > 0) {
                oldGameState.players[0].isHost = true;
            }
            
            // If the old lobby is now empty, delete it. Otherwise, update remaining players.
            if (oldGameState.players.length === 0) {
                this.games.delete(oldRoomCode);
                console.log(`Lobby ${oldRoomCode} is empty after switch, deleting.`);
            } else {
                this.addLog(oldGameState, `${user.username} has left to join another game.`, 'system');
                this.io.to(oldRoomCode).emit("updateGameState", oldGameState);
            }
        } else if (oldPlayer) {
             socket.emit("error", "You cannot switch rooms while in an active game.");
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
        socket.emit("error", "Room not found or game already in progress.");
        return;
      }
      if (gameState.players.some(p => p.userId === user.id)) {
        console.log(`[+] User ${user.username} (ID: ${user.id}) is already in room ${code}. Forcing reconnect.`);
        this.handleReconnect(socket, user, [code, gameState]);
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
    
    const userCustomizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string; selected_background: string; }>(
        "SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1",
        [user.id]
    );
    
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
      selectedBackground: userCustomizations?.selected_background,
    };
    gameState.players.push(newPlayer);
    this.socialService.updateUserStatus(user.id, true, code);
    
    // Notify other clients that a new user joined for WebRTC setup
    socket.broadcast.to(code).emit('voice:user-joined', { socketId: socket.id });

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
    
    const userCustomizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string; selected_background: string; }>(
        "SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1",
        [user.id]
    );
    
    // Notify other clients about the reconnected user for WebRTC
    socket.broadcast.to(roomCode).emit('voice:user-joined', { socketId: socket.id });

    const oldPlayerId = player.id;
    const newPlayerId = socket.id;
    
    // Do nothing if ID hasn't changed (e.g., dev server hot reload without client reconnect)
    if (oldPlayerId === newPlayerId) {
        player.status = "CONNECTED";
        socket.join(roomCode);
        this.io.to(roomCode).emit("updateGameState", gameState);
        console.log(`User ${user.username} re-established connection with same socket ID ${newPlayerId}`);
        return;
    }

    player.selectedTitle = userCustomizations?.selected_title;
    player.selectedBorder = userCustomizations?.selected_border;
    player.selectedIcon = userCustomizations?.selected_icon;
    player.selectedBackground = userCustomizations?.selected_background;

    player.id = newPlayerId;
    player.status = "CONNECTED";
    
    // --- Comprehensive State Migration from oldPlayerId to newPlayerId ---

    // 1. Ready players lists
    gameState.readyPlayers = gameState.readyPlayers.map(id => id === oldPlayerId ? newPlayerId : id);
    gameState.endGameReadyPlayers = gameState.endGameReadyPlayers.map(id => id === oldPlayerId ? newPlayerId : id);

    // 2. Pending team
    if (gameState.pendingTeam) {
        gameState.pendingTeam = gameState.pendingTeam.map(id => id === oldPlayerId ? newPlayerId : id);
    }
    
    // 3. Quest history (votes and results)
    gameState.questHistory.forEach(quest => {
        quest.votes.forEach(vote => {
            if (vote.playerId === oldPlayerId) vote.playerId = newPlayerId;
        });
        quest.results.forEach(result => {
            if (result.playerId === oldPlayerId) result.playerId = newPlayerId;
        });
        quest.pastVotes.forEach(pastVote => {
            pastVote.votes.forEach(vote => {
                 if (vote.playerId === oldPlayerId) vote.playerId = newPlayerId;
            });
        });
        if(quest.approvedVote) {
             quest.approvedVote.votes.forEach(vote => {
                 if (vote.playerId === oldPlayerId) vote.playerId = newPlayerId;
            });
        }
    });

    // 4. Restart vote
    if (gameState.restartVote) {
        if (gameState.restartVote.initiatorId === oldPlayerId) {
            gameState.restartVote.initiatorId = newPlayerId;
        }
        if (gameState.restartVote.votes[oldPlayerId]) {
            gameState.restartVote.votes[newPlayerId] = gameState.restartVote.votes[oldPlayerId];
            delete gameState.restartVote.votes[oldPlayerId];
        }
    }
    
    // 5. Dragon's Breath State
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

    // 6. Assassination Target
    if (gameState.assassinationTargetId === oldPlayerId) {
        gameState.assassinationTargetId = newPlayerId;
    }
    // --- End State Migration ---
    
    socket.join(roomCode);
    this.io.to(roomCode).emit("updateGameState", gameState);
    console.log(`Successfully reconnected user ${user.username}. Migrated state from ${oldPlayerId} to new socket ID ${newPlayerId}`);
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

    const recentMatches = await db.all<Match>(
      "SELECT m.id, m.winner, pp.role, pp.won, m.played_at AS \"playedAt\" FROM matches m JOIN player_performance pp ON m.id = pp.match_id WHERE pp.user_id = $1 ORDER BY m.played_at DESC LIMIT 10",
      [userId]
    );
    const achievements = await db.all<UserAchievement>(
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
        playedAt: m.playedAt,
      })),
      achievements: achievements,
    };
  }

  async getDragonsBreathStats(userId: number): Promise<DragonsBreathStats> {
    // Total Games
    const totalGamesResult = await db.get<{ count: string }>(
      "SELECT COUNT(*) FROM dragons_breath_matches WHERE winner_user_id = $1 OR loser_user_id = $1",
      [userId]
    );
    const totalGames = parseInt(totalGamesResult?.count || '0', 10);

    // Total Wins
    const totalWinsResult = await db.get<{ count: string }>(
      "SELECT COUNT(*) FROM dragons_breath_matches WHERE winner_user_id = $1",
      [userId]
    );
    const totalWins = parseInt(totalWinsResult?.count || '0', 10);

    // Opponent Stats
    const opponentData = await db.all<{
      opponent_id: number;
      opponent_name: string;
      games_played: string; // count returns string
      wins: string; // sum returns string
    }>(`
      SELECT
        opponent.id as opponent_id,
        opponent.username as opponent_name,
        COUNT(*) as games_played,
        SUM(CASE WHEN m.winner_user_id = $1 THEN 1 ELSE 0 END) as wins
      FROM dragons_breath_matches m
      JOIN users opponent ON (CASE
        WHEN m.winner_user_id = $1 THEN m.loser_user_id
        ELSE m.winner_user_id
      END) = opponent.id
      WHERE m.winner_user_id = $1 OR m.loser_user_id = $1
      GROUP BY opponent.id, opponent.username
      ORDER BY games_played DESC
    `, [userId]);

    const opponentStats = opponentData.map(o => {
        const gamesPlayed = parseInt(o.games_played, 10);
        const wins = parseInt(o.wins, 10);
        return {
            opponentId: o.opponent_id,
            opponentName: o.opponent_name,
            gamesPlayed,
            wins,
            winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
        };
    });

    // Match History
    const matchHistoryData = await db.all<{
      id: number;
      opponent_name: string;
      won: boolean;
      played_at: string;
    }>(`
      SELECT
        m.id,
        opponent.username as opponent_name,
        (m.winner_user_id = $1) as won,
        m.played_at
      FROM dragons_breath_matches m
      JOIN users opponent ON (CASE
        WHEN m.winner_user_id = $1 THEN m.loser_user_id
        ELSE m.winner_user_id
      END) = opponent.id
      WHERE m.winner_user_id = $1 OR m.loser_user_id = $1
      ORDER BY m.played_at DESC
      LIMIT 20
    `, [userId]);

    return {
      totalGames,
      totalWins,
      opponentStats,
      matchHistory: matchHistoryData.map(m => ({
          id: m.id,
          opponentName: m.opponent_name,
          won: m.won,
          playedAt: m.played_at,
      })),
    };
}


  async getLeaderboard(): Promise<LeaderboardData> {
     const allUsers: { 
        id: number;
        username: string; 
        highest_win_streak: number; 
        assassin_kills: number;
        total_games: number;
        total_wins: number;
        good_wins: number;
        evil_wins: number;
    }[] = await db.all(`
        SELECT id, username, highest_win_streak, assassin_kills, 
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
        leaderboard.winStreaks.push({ username: user.username, value: user.highest_win_streak });
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
    gameState.assassinationTargetId = null;

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
                highest_win_streak = CASE WHEN $1 = 1 THEN GREATEST(highest_win_streak, win_streak + 1) ELSE highest_win_streak END,
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
    const originalPlayerInfos = await Promise.all(
        gameState.players
            .filter(p => p.status === 'CONNECTED') // Filter out disconnected players before mapping
            .map(async (p) => {
                const customizations = await db.get<{ selected_title: string; selected_border: string; selected_icon: string; selected_background: string; }>(
                    "SELECT selected_title, selected_border, selected_icon, selected_background FROM users WHERE id = $1", [p.userId]
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
                    selectedBackground: customizations?.selected_background,
                };
            })
    );


    const newGameState = this.createInitialGameState(roomCode);
    newGameState.players = originalPlayerInfos;
    newGameState.chat = preservedChat;
    newGameState.gameLog = preservedLog;
    newGameState.pendingTeam = null;
    newGameState.dragonsBreathState = null;
    newGameState.assassinationTargetId = null;

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
    this.io.to(roomCode).emit('voice:user-left', { socketId: gameState.players.find(p => p.userId === userId)!.id });
    
    this.reconnectionTimers.delete(roomCode);
  
    if (gameState.phase === GamePhase.LOBBY || gameState.phase === GamePhase.DRAGONS_BREATH) {
      if (gameState.players.some(p => p.userId === userId)) {
        this.socialService.updateUserStatus(userId, false, undefined);
      }
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
      // If a player leaves a dragon's breath game, it aborts.
      if(gameState.phase === GamePhase.DRAGONS_BREATH) {
        this.restartGameByRoomCode(roomCode);
      } else {
        this.io.to(roomCode).emit("updateGameState", gameState);
      }
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
    
    this.io.to(roomCode).emit('voice:user-left', { socketId: playerId });

    disconnectedPlayer.status = "DISCONNECTED";
    this.addLog(gameState, `${disconnectedPlayer.name} has disconnected.`, 'system');
    

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

  handleUpdateAssassinationTarget(assassinId: string, targetId: string | null) {
    const roomCode = this.findRoomByPlayerId(assassinId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const assassin = this.getPlayer(gameState, assassinId);

    if (!assassin || assassin.role !== Role.ASSASSIN || gameState.phase !== GamePhase.ASSASSINATION) {
      return;
    }

    gameState.assassinationTargetId = targetId;
    this.io.to(roomCode).emit("updateGameState", gameState);
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

    this.socialService.updateUserStatus(leavingPlayer.userId, false, undefined);
    this.io.to(roomCode).emit('voice:user-left', { socketId: playerId });
    const socket = this.io.sockets.sockets.get(playerId);
    if (socket) {
        // Explicitly tell the leaving client to reset its state.
        socket.emit("kicked", "You have left the lobby.");
        socket.leave(roomCode);
    }
    
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
    
    this.io.to(roomCode).emit('voice:user-left', { socketId: playerIdToKick });

    if (kickedSocket) {
        // Let the kicked player know they were kicked and should reset state
        kickedSocket.emit("kicked", "You have been kicked from the game by the host.");
        kickedSocket.leave(roomCode);
    }
    

    if (gameState.phase === GamePhase.LOBBY) {
        this.socialService.updateUserStatus(playerToKick.userId, false, undefined);
        gameState.players = gameState.players.filter(p => p.id !== playerIdToKick);
        this.addLog(gameState, `${kickedPlayerName} was kicked by the host.`, 'system');
        this.io.to(roomCode).emit("chatMessage", { senderId: 'system', senderUserId: 0, senderName: 'System', text: `${kickedPlayerName} was kicked by the host.` });
        this.io.to(roomCode).emit("updateGameState", gameState);
    } else {
        // In game, kicking aborts the game
        playerToKick.status = 'DISCONNECTED';
        this.endGame(
            gameState,
            null,
            `${kickedPlayerName} was kicked by the host. The game has been aborted.`
        );
    }
  }

  updatePlayerCustomization(userId: number, customizations: { title: string | null; border: string | null; icon: string | null; background: string | null; }) {
    const gameInfo = this.findGameByPlayerUserId(userId);
    if (gameInfo) {
      const [roomCode, gameState] = gameInfo;
      const playerInGame = gameState.players.find(p => p.userId === userId);
      if (playerInGame) {
        playerInGame.selectedTitle = customizations.title;
        playerInGame.selectedBorder = customizations.border;
        playerInGame.selectedIcon = customizations.icon;
        playerInGame.selectedBackground = customizations.background;
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
  
  // --- Dragon's Breath Mini-game Logic ---

  private _createDragonsBreathGame(gameState: GameState) {
    const [player1, player2] = gameState.players;

    // Add Defuse cards to the base deck
    const baseDeck: DragonCardType[] = [
        DragonCardType.ATTACK, DragonCardType.ATTACK,
        DragonCardType.SKIP, DragonCardType.SKIP,
        DragonCardType.SEE_THE_FUTURE, DragonCardType.SEE_THE_FUTURE,
        DragonCardType.SHUFFLE,
        DragonCardType.EMBERDRAKE_HATCHLING, DragonCardType.GLIMMERING_WHELP, DragonCardType.SUNSTONE_DRAKE,
        DragonCardType.EMBERDRAKE_HATCHLING, DragonCardType.GLIMMERING_WHELP, DragonCardType.SUNSTONE_DRAKE,
        DragonCardType.DEFUSE, DragonCardType.DEFUSE,
    ];
    
    // Initialize empty hands
    const hands: { [playerId: string]: DragonCard[] } = { 
        [player1.id]: [], 
        [player2.id]: [] 
    };

    const fullDeck: DragonCard[] = baseDeck.map(type => ({ id: `${type}-${Math.random()}`, type }));
    this._shuffleArray(fullDeck);
    
    // Deal 5 cards to each player
    for (let i = 0; i < 5; i++) {
        if(fullDeck.length > 0) hands[player1.id].push(fullDeck.pop()!);
        if(fullDeck.length > 0) hands[player2.id].push(fullDeck.pop()!);
    }
    
    // Add Dragon's Breath to the remaining deck
    fullDeck.push({ id: 'dragon-breath', type: DragonCardType.DRAGON_BREATH });
    this._shuffleArray(fullDeck);

    const startingPlayer = Math.random() < 0.5 ? player1 : player2;

    gameState.dragonsBreathState = {
        deck: fullDeck,
        hands: hands,
        discardPile: [],
        currentPlayerId: startingPlayer.id,
        turnsToTake: 1,
        isViewingFuture: null,
        futureCards: [],
        isPlacingDragon: null,
        winner: null,
        loser: null,
    };
  }
  
  private _shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  private _advanceDBTurn(gameState: GameState) {
    const dbState = gameState.dragonsBreathState!;
    const currentPlayerIndex = gameState.players.findIndex(p => p.id === dbState.currentPlayerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
    dbState.currentPlayerId = gameState.players[nextPlayerIndex].id;
    dbState.turnsToTake = 1;
    this.addLog(gameState, `${gameState.players[nextPlayerIndex].name}'s turn.`, 'dragonsBreath');
  }

  private async _saveDragonsBreathResult(winnerUserId: number, loserUserId: number) {
    try {
        await db.run(
            "INSERT INTO dragons_breath_matches (winner_user_id, loser_user_id) VALUES ($1, $2)",
            [winnerUserId, loserUserId]
        );
        console.log(`Dragon's Breath match saved: Winner ${winnerUserId}, Loser ${loserUserId}`);
    } catch (error) {
        console.error("Failed to save Dragon's Breath match result:", error);
    }
  }

  handleStartDragonsBreath(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const player = this.getPlayer(gameState, playerId);

    if (!player?.isHost || gameState.players.length !== 2) {
      return this.io.to(playerId).emit('error', "Dragon's Breath can only be started by the host in a 2-player lobby.");
    }
    
    this._createDragonsBreathGame(gameState);
    gameState.phase = GamePhase.DRAGONS_BREATH;
    const startingPlayer = gameState.players.find(p => p.id === gameState.dragonsBreathState!.currentPlayerId);
    this.addLog(gameState, `A game of Dragon's Breath has begun! ${startingPlayer?.name || 'A player'} starts.`, 'dragonsBreath');
    this.io.to(roomCode).emit('updateGameState', gameState);
  }

  handleDrawCard(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const dbState = gameState.dragonsBreathState;
    const player = this.getPlayer(gameState, playerId);
    
    if (!dbState || !player || dbState.currentPlayerId !== playerId || dbState.isPlacingDragon || dbState.isViewingFuture) return;

    if (dbState.deck.length === 0) {
        this.io.to(playerId).emit('error', 'The deck is empty!');
        return;
    }

    const drawnCard = dbState.deck.pop()!;
    this.addLog(gameState, `${player.name} draws a card...`, 'dragonsBreath');
    
    if (drawnCard.type === DragonCardType.DRAGON_BREATH) {
        const defuseIndex = dbState.hands[playerId].findIndex(c => c.type === DragonCardType.DEFUSE);
        if (defuseIndex !== -1) {
            if (player.userId) {
                db.run('UPDATE users SET db_defuses = db_defuses + 1 WHERE id = $1', [player.userId]);
            }
            const defuseCard = dbState.hands[playerId].splice(defuseIndex, 1)[0];
            dbState.discardPile.push(defuseCard);
            dbState.isPlacingDragon = playerId;
            this.addLog(gameState, `...it's the Dragon's Breath! But ${player.name} defuses it!`, 'dragonsBreath');
        } else {
            dbState.loser = playerId;
            const winner = gameState.players.find(p => p.id !== playerId)!;
            dbState.winner = winner.id;
            this.addLog(gameState, `...it's the Dragon's Breath! ${player.name} is eliminated! ${winner.name} wins!`, 'dragonsBreath');
            
            // Save match result
            if (winner.userId && player.userId) {
                this._saveDragonsBreathResult(winner.userId, player.userId);
            }
        }
    } else {
        dbState.hands[playerId].push(drawnCard);
    }
    
    dbState.turnsToTake--;
    if(dbState.turnsToTake <= 0) {
        if (!dbState.isPlacingDragon && !dbState.winner) {
            this._advanceDBTurn(gameState);
        }
    }

    this.io.to(roomCode).emit('updateGameState', gameState);
  }

  async handlePlayCard(playerId: string, cardId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    const gameState = this.games.get(roomCode)!;
    const dbState = gameState.dragonsBreathState;
    const player = this.getPlayer(gameState, playerId);

    if (!dbState || !player || dbState.currentPlayerId !== playerId) return;

    const cardIndex = dbState.hands[playerId].findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = dbState.hands[playerId].splice(cardIndex, 1)[0];
    dbState.discardPile.push(card);
    this.addLog(gameState, `${player.name} played ${card.type}.`, 'dragonsBreath');

    switch (card.type) {
        case DragonCardType.ATTACK:
            if (player.userId) await db.run('UPDATE users SET db_attacks_played = db_attacks_played + 1 WHERE id = $1', [player.userId]);
            this._advanceDBTurn(gameState);
            dbState.turnsToTake = 2;
            const attackedPlayer = gameState.players.find(p => p.id === dbState.currentPlayerId);
            if (attackedPlayer) {
              this.addLog(gameState, `${attackedPlayer.name} must now take 2 turns.`, 'dragonsBreath');
            }
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
            this.addLog(gameState, `The deck has been shuffled.`, 'dragonsBreath');
            break;
        case DragonCardType.EMBERDRAKE_HATCHLING:
        case DragonCardType.GLIMMERING_WHELP:
        case DragonCardType.SUNSTONE_DRAKE:
             if (player.userId) await db.run('UPDATE users SET db_fillers_played = db_fillers_played + 1 WHERE id = $1', [player.userId]);
             // No game state change for these cards
             break;
    }
    
    this.io.to(roomCode).emit('updateGameState', gameState);
  }

  handlePlaceDragonCard(playerId: string, index: number) {
      const roomCode = this.findRoomByPlayerId(playerId);
      if (!roomCode) return;
      const gameState = this.games.get(roomCode)!;
      const dbState = gameState.dragonsBreathState;

      if (!dbState || dbState.isPlacingDragon !== playerId) return;

      const deckSizeBeforePlacing = dbState.deck.length;
      if (index < 0 || index > deckSizeBeforePlacing) {
          this.io.to(playerId).emit('error', 'Invalid placement index.');
          return;
      }
      
      // The user sees "position 0" as the top of the deck (drawn next).
      // The deck is drawn from the end using .pop().
      // So, "position 0" from the user means we should place it at the end of the array.
      // "position deck.length" means we should place it at the beginning.
      const placementIndex = deckSizeBeforePlacing - index;
      
      dbState.deck.splice(placementIndex, 0, { id: 'dragon-breath', type: DragonCardType.DRAGON_BREATH });
      
      dbState.isPlacingDragon = null;
      this._advanceDBTurn(gameState);
      
      this.addLog(gameState, `${this.getPlayer(gameState, playerId)!.name} placed the Dragon's Breath back in the deck...`, 'dragonsBreath');
      this.io.to(roomCode).emit('updateGameState', gameState);
  }

  handleEndFutureView(playerId: string) {
      const roomCode = this.findRoomByPlayerId(playerId);
      if (!roomCode) return;
      const gameState = this.games.get(roomCode)!;
      const dbState = gameState.dragonsBreathState;
      if (!dbState || dbState.isViewingFuture !== playerId) return;

      dbState.isViewingFuture = null;
      dbState.futureCards = [];
      this.io.to(roomCode).emit('updateGameState', gameState);
  }

  handleReturnToLobby(playerId: string) {
    const roomCode = this.findRoomByPlayerId(playerId);
    if (!roomCode) return;
    this.restartGameByRoomCode(roomCode);
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

const socialService = new SocialService(io);
const gameService = new GameService(io, socialService);
socialService.setGameService(gameService);

io.use(authMiddlewareSocket);

io.on("connection", (socket: any) => {
  console.log(`A user connected: ${socket.id}, username: ${socket.user.username}`);
  socialService.addUser(socket, socket.user);

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
  socket.on("updateAssassinationTarget", (targetId) => gameService.handleUpdateAssassinationTarget(socket.id, targetId));
  socket.on("voteOnTeam", (vote) => gameService.handleVoteOnTeam(socket.id, vote));
  socket.on("voteOnQuest", (vote) => gameService.handleVoteOnQuest(socket.id, vote));
  socket.on("assassinate", (targetId) => gameService.handleAssassinate(socket.id, targetId));
  socket.on("sendMessage", (message) => gameService.handleSendMessage(socket.id, message));
  socket.on("initiateRestart", () => gameService.handleInitiateRestart(socket.id));
  socket.on("voteOnRestart", (vote) => gameService.handleVoteOnRestart(socket.id, vote));
  socket.on("kickPlayer", (playerIdToKick) => gameService.handleKickPlayer(socket.id, playerIdToKick));

  // --- Dragon's Breath Events ---
  socket.on('startDragonsBreath', () => gameService.handleStartDragonsBreath(socket.id));
  socket.on('drawCard', () => gameService.handleDrawCard(socket.id));
  socket.on('playCard', (cardId) => gameService.handlePlayCard(socket.id, cardId));
  socket.on('placeDragonCard', (index) => gameService.handlePlaceDragonCard(socket.id, index));
  socket.on('endFutureView', () => gameService.handleEndFutureView(socket.id));
  socket.on('returnToLobby', () => gameService.handleReturnToLobby(socket.id));

  // --- Social Events ---
  socket.on('social:invite_to_game', ({ friendId }) => socialService.handleGameInvite(socket.user, friendId));

  // --- Voice Chat Signaling ---
  socket.on('voice:offer', ({ targetId, sdp }) => {
    socket.to(targetId).emit('voice:offer', { fromId: socket.id, sdp });
  });
  socket.on('voice:answer', ({ targetId, sdp }) => {
    socket.to(targetId).emit('voice:answer', { fromId: socket.id, sdp });
  });
  socket.on('voice:ice-candidate', ({ targetId, candidate }) => {
    socket.to(targetId).emit('voice:ice-candidate', { fromId: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    socialService.removeUser(socket);
    gameService.handleDisconnect(socket.id);
  });
});

const cleanupStaleFriendRequests = async () => {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const result = await db.run(
            "DELETE FROM friends WHERE status = 'pending' AND created_at < $1",
            [oneDayAgo]
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log(`Cleaned up ${result.rowCount} stale friend requests.`);
        }
    } catch (err) {
        console.error('Error cleaning up stale friend requests:', err);
    }
}

setInterval(cleanupStaleFriendRequests, 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))