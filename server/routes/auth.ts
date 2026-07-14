import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db';
import { authMiddleware, generateToken } from '../auth';
import { getFullUser, generateUniqueUsername, getGoogleUserInfo } from '../helpers';
import { authRateLimiter } from '../middleware/rateLimiter';
import { User } from '../types';
import { toErrorMessage } from '../types';

const router = Router();

router.post('/register', authRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || username.length > 10) {
        return res.status(400).json({ message: 'Username must be between 3 and 10 characters.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.run(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, is_admin',
            [username, hashedPassword],
        );
        const { id, is_admin } = result.rows[0];
        const user: User = { id, username, is_admin };
        const token = generateToken(user);
        res.status(201).json({ token, user: { ...user, selectedTitle: null, selectedBorder: '', selectedIcon: null, selectedBackground: null, isGoogleLinked: false } });
    } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
            return res.status(409).json({ message: 'Username already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

router.post('/login', authRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
        const userRow = await db.get<{ id: number; password_hash: string | null }>(
            'SELECT id, password_hash FROM users WHERE username = $1',
            [username],
        );
        if (!userRow || !userRow.password_hash) {
            return res.status(401).json({ message: 'Invalid credentials or account uses Google Sign-In.' });
        }
        const match = await bcrypt.compare(password, userRow.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const user = await getFullUser(userRow.id);
        if (!user) return res.status(404).json({ message: 'User not found after login.' });
        const token = generateToken({ id: user.id, username: user.username, is_admin: user.is_admin });
        res.json({ token, user });
    } catch {
        res.status(500).json({ message: 'Server error during login.' });
    }
});

router.post('/auth/google', async (req, res) => {
    const { accessToken } = req.body;
    try {
        const payload = await getGoogleUserInfo(accessToken);
        if (!payload || !payload.sub || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google token.' });
        }
        const { sub: google_id, email, name } = payload;
        let userRecord = await db.get<{ id: number }>('SELECT id FROM users WHERE google_id = $1', [google_id]);
        let isNewUser = false;
        if (!userRecord) {
            const byEmail = await db.get<{ id: number; google_id: string | null }>('SELECT id, google_id FROM users WHERE email = $1', [email]);
            if (byEmail) {
                if (!byEmail.google_id) await db.run('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, byEmail.id]);
                userRecord = byEmail;
            }
        }
        if (!userRecord) {
            isNewUser = true;
            const finalUsername = await generateUniqueUsername((name as string) || '');
            const result = await db.run('INSERT INTO users (username, email, google_id) VALUES ($1, $2, $3) RETURNING id', [finalUsername, email, google_id]);
            userRecord = { id: result.rows[0].id };
        }
        const user = await getFullUser(userRecord.id);
        if (!user) return res.status(404).json({ message: 'User not found after Google auth.' });
        const token = generateToken({ id: user.id, username: user.username, is_admin: user.is_admin });
        res.json({ token, user, isNewUser });
    } catch (err) {
        res.status(500).json({ message: `Server error during Google authentication: ${toErrorMessage(err)}` });
    }
});

router.get('/user/check-username', async (req, res) => {
    const { username } = req.query;
    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 10) {
        return res.status(400).json({ available: false, message: 'Username must be 3-10 characters.' });
    }
    try {
        const existing = await db.get('SELECT id FROM users WHERE username = $1', [username]);
        if (existing) return res.json({ available: false, message: 'Username is already taken.' });
        return res.json({ available: true });
    } catch {
        return res.status(500).json({ available: false, message: 'Server error during username check.' });
    }
});

router.post('/user/link-google', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { accessToken } = req.body;
    try {
        const payload = await getGoogleUserInfo(accessToken);
        if (!payload || !payload.sub || !payload.email) {
            return res.status(400).json({ message: 'Invalid Google token.' });
        }
        const { sub: google_id, email } = payload;
        const existingLink = await db.get('SELECT id FROM users WHERE google_id = $1 AND id != $2', [google_id, userId]);
        if (existingLink) {
            return res.status(409).json({ message: 'This Google account is already linked to another user.' });
        }
        await db.run('UPDATE users SET google_id = $1, email = COALESCE(email, $2) WHERE id = $3', [google_id, email, userId]);
        res.json({ success: true, message: 'Account linked successfully.' });
    } catch (err) {
        res.status(500).json({ message: `Server error while linking Google account: ${toErrorMessage(err)}` });
    }
});

router.get('/verify-token', authMiddleware, async (req, res) => {
    try {
        const user = await getFullUser(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json({ user });
    } catch {
        res.status(500).json({ message: 'Server error during token verification.' });
    }
});

export default router;
