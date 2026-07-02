import { Router } from 'express';
import db from '../db';
import { authMiddleware } from '../auth';
import { User } from '../types';
import type { SocialService } from '../services/socialService';

export function createSocialRouter(socialService: SocialService) {
    const router = Router();
    router.use(authMiddleware);

    router.get('/friends', async (req, res) => {
        try {
            const friends = await socialService.getFriendsOfUser(req.user.id);
            res.json(friends);
        } catch {
            res.status(500).json({ message: 'Failed to fetch friends.' });
        }
    });

    router.get('/requests', async (req, res) => {
        try {
            const requests = await db.all<{ id: number; username: string }>(`
                SELECT u.id, u.username
                FROM friends f JOIN users u ON f.action_user_id = u.id
                WHERE (f.user1_id = $1 OR f.user2_id = $1) AND f.status = 'pending' AND f.action_user_id != $1
            `, [req.user.id]);
            res.json(requests);
        } catch {
            res.status(500).json({ message: 'Failed to fetch friend requests.' });
        }
    });

    router.get('/requests/sent', async (req, res) => {
        try {
            const requests = await db.all<{ id: number; username: string }>(`
                SELECT u.id, u.username
                FROM friends f
                JOIN users u ON u.id = (CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END)
                WHERE f.action_user_id = $1 AND f.status = 'pending'
            `, [req.user.id]);
            res.json(requests);
        } catch {
            res.status(500).json({ message: 'Failed to fetch sent friend requests.' });
        }
    });

    router.get('/suggestions', async (req, res) => {
        try {
            const suggestions = await db.all<{ id: number; username: string; mutual_friends: string }>(`
                WITH user_friends AS (
                    SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END AS friend_id
                    FROM friends WHERE (user1_id = $1 OR user2_id = $1) AND status = 'accepted'
                ),
                friends_of_friends AS (
                    SELECT
                        CASE WHEN f.user1_id = uf.friend_id THEN f.user2_id ELSE f.user1_id END AS fof_id,
                        uf.friend_id as mutual_friend_id
                    FROM friends f JOIN user_friends uf ON (f.user1_id = uf.friend_id OR f.user2_id = uf.friend_id)
                    WHERE f.status = 'accepted'
                )
                SELECT fof.fof_id as id, u.username, COUNT(DISTINCT fof.mutual_friend_id) as mutual_friends
                FROM friends_of_friends fof JOIN users u ON u.id = fof.fof_id
                WHERE fof.fof_id != $1
                    AND fof.fof_id NOT IN (SELECT friend_id FROM user_friends)
                    AND NOT EXISTS (
                        SELECT 1 FROM friends
                        WHERE status = 'pending' AND (
                            (user1_id = $1 AND user2_id = fof.fof_id) OR
                            (user1_id = fof.fof_id AND user2_id = $1)
                        )
                    )
                GROUP BY fof.fof_id, u.username
                ORDER BY mutual_friends DESC, u.username ASC
                LIMIT 10
            `, [req.user.id]);
            res.json(suggestions.map((s) => ({ ...s, mutual_friends: parseInt(s.mutual_friends, 10) })));
        } catch {
            res.status(500).json({ message: 'Failed to fetch friend suggestions.' });
        }
    });

    router.post('/add', async (req, res) => {
        const { username } = req.body;
        if (!username) return res.status(400).json({ message: 'Username is required.' });
        try {
            const targetUser = await db.get<User>('SELECT id, username FROM users WHERE username = $1', [username]);
            if (!targetUser) return res.status(404).json({ message: 'User not found.' });
            if (targetUser.id === req.user.id) return res.status(400).json({ message: 'You cannot add yourself as a friend.' });
            const user1_id = Math.min(req.user.id, targetUser.id);
            const user2_id = Math.max(req.user.id, targetUser.id);
            const existing = await db.get<{ status: string }>('SELECT status FROM friends WHERE user1_id = $1 AND user2_id = $2', [user1_id, user2_id]);
            if (existing) {
                const msg = existing.status === 'accepted' ? 'You are already friends with this user.' : 'A friend request is already pending.';
                return res.status(409).json({ message: msg });
            }
            await db.run("INSERT INTO friends (user1_id, user2_id, status, action_user_id) VALUES ($1, $2, 'pending', $3)", [user1_id, user2_id, req.user.id]);
            socialService.notifyFriendRequest(req.user.id, req.user.username, targetUser.id);
            res.status(201).json({ message: 'Friend request sent.', sentRequest: { id: targetUser.id, username: targetUser.username } });
        } catch {
            res.status(500).json({ message: 'Server error while sending friend request.' });
        }
    });

    router.post('/respond', async (req, res) => {
        const { requesterId, action } = req.body;
        if (!requesterId || !['accept', 'decline'].includes(action)) {
            return res.status(400).json({ message: 'Invalid request.' });
        }
        try {
            const user1_id = Math.min(req.user.id, requesterId);
            const user2_id = Math.max(req.user.id, requesterId);
            if (action === 'accept') {
                await db.run(
                    "UPDATE friends SET status = 'accepted', action_user_id = $1 WHERE user1_id = $2 AND user2_id = $3 AND status = 'pending'",
                    [req.user.id, user1_id, user2_id],
                );
                socialService.notifyFriendAccepted(req.user.id, requesterId);
                res.json({ message: 'Friend request accepted.' });
            } else {
                await db.run("DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 AND status = 'pending'", [user1_id, user2_id]);
                res.json({ message: 'Friend request declined.' });
            }
        } catch {
            res.status(500).json({ message: 'Server error while responding to friend request.' });
        }
    });

    router.delete('/remove/:friendId', async (req, res) => {
        const friendId = parseInt(req.params.friendId, 10);
        if (isNaN(friendId)) return res.status(400).json({ message: 'Invalid friend ID.' });
        try {
            const user1_id = Math.min(req.user.id, friendId);
            const user2_id = Math.max(req.user.id, friendId);
            await db.run("DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 AND status = 'accepted'", [user1_id, user2_id]);
            socialService.notifyFriendRemoved(req.user.id, friendId);
            res.json({ message: 'Friend removed.' });
        } catch {
            res.status(500).json({ message: 'Server error while removing friend.' });
        }
    });

    router.delete('/request/cancel/:recipientId', async (req, res) => {
        const recipientId = parseInt(req.params.recipientId, 10);
        if (isNaN(recipientId)) return res.status(400).json({ message: 'Invalid recipient ID.' });
        try {
            const user1_id = Math.min(req.user.id, recipientId);
            const user2_id = Math.max(req.user.id, recipientId);
            await db.run(
                "DELETE FROM friends WHERE user1_id = $1 AND user2_id = $2 AND status = 'pending' AND action_user_id = $3",
                [user1_id, user2_id, req.user.id],
            );
            socialService.notifyFriendRequestCancelled(req.user.id, recipientId);
            res.json({ message: 'Friend request cancelled.' });
        } catch {
            res.status(500).json({ message: 'Server error while cancelling friend request.' });
        }
    });

    return router;
}
