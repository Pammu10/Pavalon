import { Router } from 'express';
import db from '../db';
import { authMiddleware, adminMiddleware } from '../auth';
import { ALL_ACHIEVEMENTS } from '../achievements';
import type { GameService } from '../services/gameService';

export function createAdminRouter(gameService: GameService) {
    const router = Router();
    router.use(authMiddleware, adminMiddleware);

    router.get('/dashboard', async (_req, res) => {
        const [userCount, matchCount] = await Promise.all([
            db.get<{ count: string }>('SELECT COUNT(*) FROM users'),
            db.get<{ count: string }>('SELECT COUNT(*) FROM matches'),
        ]);
        res.json({
            userCount: parseInt(userCount?.count || '0', 10),
            matchCount: parseInt(matchCount?.count || '0', 10),
            roomCount: gameService.getRoomCount(),
        });
    });

    router.get('/users', async (_req, res) => {
        const users = await db.all('SELECT id, username, created_at, is_admin FROM users ORDER BY created_at DESC');
        res.json(users);
    });

    router.delete('/users/:id', async (req, res) => {
        const userId = parseInt(req.params.id, 10);
        try {
            await gameService.forceRemoveUserByUserId(userId);
            await db.run('DELETE FROM player_performance WHERE user_id = $1', [userId]);
            await db.run('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
            await db.run('DELETE FROM dragons_breath_matches WHERE winner_user_id = $1 OR loser_user_id = $1', [userId]);
            await db.run('DELETE FROM users WHERE id = $1', [userId]);
            res.json({ success: true, message: 'User deleted successfully.' });
        } catch {
            res.status(500).json({ message: 'Failed to delete user.' });
        }
    });

    router.get('/users/:id/stats', async (req, res) => {
        const userId = parseInt(req.params.id, 10);
        try {
            const stats = await db.get(`
                SELECT win_streak, highest_win_streak, assassin_kills, total_games, total_wins,
                       good_games, good_wins, evil_games, evil_wins,
                       db_defuses, db_futures_played, db_attacks_played, db_fillers_played
                FROM users WHERE id = $1
            `, [userId]);
            if (!stats) return res.status(404).json({ message: 'User not found.' });
            res.json(stats);
        } catch {
            res.status(500).json({ message: 'Failed to fetch user stats.' });
        }
    });

    router.put('/users/:id/stats', async (req, res) => {
        const userId = parseInt(req.params.id, 10);
        const {
            win_streak, highest_win_streak, assassin_kills, total_games, total_wins,
            good_games, good_wins, evil_games, evil_wins,
            db_defuses, db_futures_played, db_attacks_played, db_fillers_played,
        } = req.body;
        try {
            await db.run(`
                UPDATE users SET
                    win_streak = $1, assassin_kills = $2, total_games = $3, total_wins = $4,
                    good_games = $5, good_wins = $6, evil_games = $7, evil_wins = $8,
                    highest_win_streak = $10,
                    db_defuses = $11, db_futures_played = $12,
                    db_attacks_played = $13, db_fillers_played = $14
                WHERE id = $9
            `, [win_streak, assassin_kills, total_games, total_wins, good_games, good_wins, evil_games, evil_wins, userId, highest_win_streak, db_defuses, db_futures_played, db_attacks_played, db_fillers_played]);
            res.json({ success: true, message: 'Stats updated.' });
        } catch {
            res.status(500).json({ message: 'Failed to update stats.' });
        }
    });

    router.get('/rooms', (_req, res) => {
        res.json(gameService.getAllRooms());
    });

    router.delete('/rooms/:roomCode', (req, res) => {
        gameService.forceCloseRoom(req.params.roomCode);
        res.json({ success: true, message: `Room ${req.params.roomCode} has been closed.` });
    });

    router.get('/achievements', (_req, res) => {
        res.json(ALL_ACHIEVEMENTS.map(({ check, ...rest }) => { void check; return rest; }));
    });

    router.post('/achievements/grant', async (req, res) => {
        const { userId, achievementId } = req.body;
        try {
            const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === achievementId);
            if (!achievement) return res.status(404).json({ message: 'Achievement not found.' });
            await db.run(
                'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT(user_id, achievement_id) DO NOTHING',
                [userId, achievementId],
            );
            res.json({ success: true, message: `Achievement '${achievement.name}' granted.` });
        } catch {
            res.status(500).json({ message: 'Failed to grant achievement.' });
        }
    });

    router.get('/matches', async (req, res) => {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 15;
        const offset = (page - 1) * limit;
        try {
            const [matchesResult, totalResult] = await Promise.all([
                db.all(`
                    SELECT m.id, m.winner, m.played_at,
                        (SELECT json_agg(u.username) FROM player_performance pp JOIN users u ON pp.user_id = u.id WHERE pp.match_id = m.id) as players
                    FROM matches m ORDER BY m.played_at DESC LIMIT $1 OFFSET $2
                `, [limit, offset]),
                db.get<{ count: string }>('SELECT COUNT(*) FROM matches'),
            ]);
            res.json({
                matches: matchesResult,
                totalPages: Math.ceil(parseInt(totalResult?.count || '0', 10) / limit),
                currentPage: page,
            });
        } catch {
            res.status(500).json({ message: 'Failed to fetch matches.' });
        }
    });

    router.delete('/matches/:id', async (req, res) => {
        const matchId = parseInt(req.params.id, 10);
        if (isNaN(matchId)) return res.status(400).json({ message: 'Invalid match ID.' });
        try {
            await db.transaction(async (client) => {
                const performancesRes = await client.query('SELECT user_id FROM player_performance WHERE match_id = $1', [matchId]);
                if (performancesRes.rows.length === 0) throw new Error('Match not found.');
                const userIds = [...new Set(performancesRes.rows.map((p) => p.user_id))];

                await client.query('DELETE FROM player_performance WHERE match_id = $1', [matchId]);
                await client.query('DELETE FROM matches WHERE id = $1', [matchId]);

                for (const userId of userIds) {
                    const allPerfsRes = await client.query(
                        'SELECT pp.*, m.played_at FROM player_performance pp JOIN matches m ON pp.match_id = m.id WHERE pp.user_id = $1 ORDER BY m.played_at ASC',
                        [userId],
                    );
                    const perfs = allPerfsRes.rows;

                    const total_games = perfs.length;
                    const total_wins = perfs.filter((p) => p.won).length;
                    const good_games = perfs.filter((p) => p.alignment === 'Good').length;
                    const good_wins = perfs.filter((p) => p.alignment === 'Good' && p.won).length;
                    const evil_games = perfs.filter((p) => p.alignment === 'Evil').length;
                    const evil_wins = perfs.filter((p) => p.alignment === 'Evil' && p.won).length;
                    const assassin_kills = perfs.filter((p) => p.role === 'Assassin' && p.won).length;

                    let current_win_streak = 0;
                    let highest_win_streak = 0;
                    for (const perf of perfs) {
                        if (perf.won) {
                            if (++current_win_streak > highest_win_streak) highest_win_streak = current_win_streak;
                        } else {
                            current_win_streak = 0;
                        }
                    }

                    await client.query(
                        `UPDATE users SET
                            total_games = $1, total_wins = $2, good_games = $3, good_wins = $4,
                            evil_games = $5, evil_wins = $6, assassin_kills = $7, win_streak = $8,
                            highest_win_streak = $10
                         WHERE id = $9`,
                        [total_games, total_wins, good_games, good_wins, evil_games, evil_wins, assassin_kills, current_win_streak, userId, highest_win_streak],
                    );

                    await client.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
                    const grantedAchievements = new Set<string>();
                    const statsForCheck = { totalGames: total_games, totalWins: total_wins, goodWins: good_wins, evilWins: evil_wins };

                    for (const ach of ALL_ACHIEVEMENTS) {
                        if (ach.check(statsForCheck, null)) grantedAchievements.add(ach.id);
                        for (const perf of perfs) {
                            if (ach.check(null, { role: perf.role, alignment: perf.alignment, won: perf.won })) {
                                grantedAchievements.add(ach.id);
                            }
                        }
                    }

                    for (const achievementId of grantedAchievements) {
                        await client.query(
                            'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT(user_id, achievement_id) DO NOTHING',
                            [userId, achievementId],
                        );
                    }
                }
            });
            res.json({ success: true, message: 'Match deleted and user data resynchronized.' });
        } catch {
            res.status(500).json({ message: 'Failed to delete match. The operation was rolled back.' });
        }
    });

    router.get('/friendships', async (_req, res) => {
        try {
            const friendships = await db.all(`
                SELECT f.id, u1.username as user1, u2.username as user2, f.status, f.created_at
                FROM friends f JOIN users u1 ON f.user1_id = u1.id JOIN users u2 ON f.user2_id = u2.id
                ORDER BY f.id DESC
            `);
            res.json(friendships);
        } catch {
            res.status(500).json({ message: 'Failed to fetch friendships.' });
        }
    });

    router.delete('/friendships/:id', async (req, res) => {
        const friendshipId = parseInt(req.params.id, 10);
        if (isNaN(friendshipId)) return res.status(400).json({ message: 'Invalid friendship ID.' });
        try {
            await db.run('DELETE FROM friends WHERE id = $1', [friendshipId]);
            res.json({ success: true, message: 'Friendship deleted.' });
        } catch {
            res.status(500).json({ message: 'Failed to delete friendship.' });
        }
    });

    return router;
}
