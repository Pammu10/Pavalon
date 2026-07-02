import { Router } from 'express';
import db from '../db';
import { authMiddleware, generateToken } from '../auth';
import { getFullUser } from '../helpers';
import { ALL_ACHIEVEMENTS } from '../achievements';
import { DEFAULT_ICONS, DEFAULT_BACKGROUNDS } from '../constants';
import { UserAchievement } from '../types';
import type { GameService } from '../services/gameService';

export function createUserRouter(gameService: GameService) {
    const router = Router();
    router.use(authMiddleware);

    router.get('/stats', async (req, res) => {
        try {
            const stats = await gameService.getPlayerStats(req.user.id);
            res.json(stats);
        } catch {
            res.status(500).json({ message: 'Failed to fetch player stats.' });
        }
    });

    router.get('/stats/dragons-breath', async (req, res) => {
        try {
            const stats = await gameService.getDragonsBreathStats(req.user.id);
            res.json(stats);
        } catch {
            res.status(500).json({ message: "Failed to fetch Dragon's Breath stats." });
        }
    });

    router.get('/leaderboard', async (_req, res) => {
        try {
            const data = await gameService.getLeaderboard();
            res.json(data);
        } catch {
            res.status(500).json({ message: 'Failed to fetch leaderboard data.' });
        }
    });

    router.get('/leaderboard/dragons-breath', async (_req, res) => {
        try {
            const [mostWins, mostDefuses, mostSees, mostAttacks, mostFillers] = await Promise.all([
                db.all<{ username: string; value: string }>(`
                    SELECT u.username, COUNT(m.id) as value
                    FROM users u JOIN dragons_breath_matches m ON u.id = m.winner_user_id
                    GROUP BY u.id ORDER BY value DESC LIMIT 10
                `),
                db.all<{ username: string; value: number }>('SELECT username, db_defuses as value FROM users WHERE db_defuses > 0 ORDER BY value DESC LIMIT 10'),
                db.all<{ username: string; value: number }>('SELECT username, db_futures_played as value FROM users WHERE db_futures_played > 0 ORDER BY value DESC LIMIT 10'),
                db.all<{ username: string; value: number }>('SELECT username, db_attacks_played as value FROM users WHERE db_attacks_played > 0 ORDER BY value DESC LIMIT 10'),
                db.all<{ username: string; value: number }>('SELECT username, db_fillers_played as value FROM users WHERE db_fillers_played > 0 ORDER BY value DESC LIMIT 10'),
            ]);
            res.json({
                mostWins: mostWins.map((e) => ({ ...e, value: parseInt(e.value, 10) })),
                mostDefuses, mostSees, mostAttacks, mostFillers,
            });
        } catch {
            res.status(500).json({ message: "Failed to fetch Dragon's Breath leaderboard data." });
        }
    });

    router.get('/match/:id', async (req, res) => {
        try {
            const performances = await db.all(
                'SELECT u.username, pp.role, pp.alignment, pp.won FROM player_performance pp JOIN users u ON pp.user_id = u.id WHERE pp.match_id = $1 ORDER BY u.username',
                [req.params.id],
            );
            if (!performances || performances.length === 0) {
                return res.status(404).json({ message: 'Match not found.' });
            }
            res.json(performances);
        } catch {
            res.status(500).json({ message: 'Failed to fetch match details.' });
        }
    });

    router.get('/achievements', async (req, res) => {
        try {
            const userAchievements = await db.all<UserAchievement>(
                'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1',
                [req.user.id],
            );
            const unlockedIds = new Set(userAchievements.map((ua) => ua.achievement_id));
            const fullAchievementData = ALL_ACHIEVEMENTS
                .filter((ach) => !ach.hidden || unlockedIds.has(ach.id))
                .map((ach) => {
                    const { check, ...rest } = ach;
                    void check;
                    return {
                        ...rest,
                        unlocked: unlockedIds.has(ach.id),
                        unlocked_at: userAchievements.find((ua) => ua.achievement_id === ach.id)?.unlocked_at,
                    };
                });
            res.json(fullAchievementData);
        } catch {
            res.status(500).json({ message: 'Failed to fetch achievements.' });
        }
    });

    router.post('/user/customize', async (req, res) => {
        const { title, border, icon, background } = req.body;
        if (title && typeof title === 'string' && title.length > 10) {
            return res.status(400).json({ message: 'Title cannot be more than 10 characters.' });
        }
        try {
            const userAchievements = await db.all<{ achievement_id: string }>(
                'SELECT achievement_id FROM user_achievements WHERE user_id = $1',
                [req.user.id],
            );
            const unlockedRewards = new Set<string>();
            DEFAULT_ICONS.forEach((i) => unlockedRewards.add(i));
            DEFAULT_BACKGROUNDS.forEach((i) => unlockedRewards.add(i));
            userAchievements.forEach((ua) => {
                const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === ua.achievement_id);
                achievement?.rewards.forEach((reward) => unlockedRewards.add(reward.value));
            });
            if (border && !unlockedRewards.has(border)) return res.status(403).json({ message: 'You have not unlocked this border.' });
            if (icon && !unlockedRewards.has(icon)) return res.status(403).json({ message: 'You have not unlocked this icon.' });
            if (background && !unlockedRewards.has(background)) return res.status(403).json({ message: 'You have not unlocked this theme.' });

            await db.run(
                'UPDATE users SET selected_title = $1, selected_border = $2, selected_icon = $3, selected_background = $4 WHERE id = $5',
                [title, border, icon, background, req.user.id],
            );
            gameService.updatePlayerCustomization(req.user.id, { title, border, icon, background });
            res.json({ success: true, message: 'Customizations updated.' });
        } catch {
            res.status(500).json({ message: 'Failed to update customizations.' });
        }
    });

    router.post('/user/username', async (req, res) => {
        const oldUsername = req.user.username;
        const { username } = req.body;
        if (!username || typeof username !== 'string' || username.length < 3 || username.length > 10) {
            return res.status(400).json({ message: 'Username must be between 3 and 10 characters.' });
        }
        if (username === oldUsername) {
            return res.status(400).json({ message: 'This is already your username.' });
        }
        try {
            const userRecord = await db.get<{ username_last_changed_at: string | null }>(
                'SELECT username_last_changed_at FROM users WHERE id = $1',
                [req.user.id],
            );
            if (userRecord?.username_last_changed_at) {
                const lastChanged = new Date(userRecord.username_last_changed_at).getTime();
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - lastChanged < sevenDays) {
                    const timeLeft = sevenDays - (Date.now() - lastChanged);
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    let message = 'You can change your username again in ';
                    if (days > 0) message += `${days} day(s) `;
                    if (hours > 0 && days < 1) message += `${hours} hour(s).`;
                    if (days === 0 && hours === 0) message += `${Math.ceil(timeLeft / (1000 * 60))} minute(s).`;
                    return res.status(429).json({ message });
                }
            }
            const existing = await db.get('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.user.id]);
            if (existing) return res.status(409).json({ message: 'Username is already taken.' });
            await db.run('UPDATE users SET username = $1, username_last_changed_at = CURRENT_TIMESTAMP WHERE id = $2', [username, req.user.id]);
            gameService.updatePlayerUsername(req.user.id, username);
            const fullUser = await getFullUser(req.user.id);
            if (!fullUser) return res.status(404).json({ message: 'Failed to retrieve updated user profile.' });
            const token = generateToken({ id: fullUser.id, username: fullUser.username, is_admin: fullUser.is_admin });
            res.json({ success: true, message: 'Username updated successfully.', user: fullUser, token });
        } catch {
            res.status(500).json({ message: 'Server error during username update.' });
        }
    });

    return router;
}
