import https from 'https';
import db from './db';
import { User } from './types';

const ADJECTIVES = ['Brave', 'Cunning', 'Noble', 'Swift', 'Wise', 'Fierce', 'Silent', 'Ancient', 'Shadow', 'Golden'];
const NOUNS = ['Knight', 'Ranger', 'Mage', 'Scribe', 'Dragon', 'Wolf', 'Lion', 'Serpent', 'Eagle', 'Thorne'];

export async function generateUniqueUsername(base: string): Promise<string> {
    let attempts = 0;
    let username = base.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);

    let existingUser = await db.get('SELECT id FROM users WHERE username = $1', [username]);
    if (!existingUser && username.length >= 3) {
        return username;
    }

    while (attempts < 20) {
        attempts++;
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const num = Math.floor(Math.random() * 900) + 100;
        let potentialUsername = `${adj}${noun}${num}`;
        if (potentialUsername.length > 10) {
            potentialUsername = `${adj}${noun}`.substring(0, 7) + num;
        }
        existingUser = await db.get('SELECT id FROM users WHERE username = $1', [potentialUsername]);
        if (!existingUser) {
            return potentialUsername;
        }
    }

    return `User${Date.now()}`.substring(0, 10);
}

export async function getFullUser(userId: number): Promise<User | null> {
    const row = await db.get<{
        id: number;
        username: string;
        is_admin: boolean;
        selected_title: string | null;
        selected_border: string | null;
        selected_icon: string | null;
        selected_background: string | null;
        google_id: string | null;
        username_last_changed_at: string | null;
    }>(
        'SELECT id, username, is_admin, selected_title, selected_border, selected_icon, selected_background, google_id, username_last_changed_at FROM users WHERE id = $1',
        [userId],
    );

    if (!row) return null;

    return {
        id: row.id,
        username: row.username,
        is_admin: row.is_admin,
        selectedTitle: row.selected_title,
        selectedBorder: row.selected_border || '',
        selectedIcon: row.selected_icon,
        selectedBackground: row.selected_background,
        isGoogleLinked: !!row.google_id,
        usernameLastChangedAt: row.username_last_changed_at ?? undefined,
    };
}

export function getGoogleUserInfo(accessToken: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'www.googleapis.com',
                path: '/oauth2/v3/userinfo',
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data) as Record<string, unknown>;
                        if (res.statusCode !== 200) {
                            reject(new Error((parsed.error_description as string) || 'Failed to get user info from Google.'));
                        } else {
                            resolve(parsed);
                        }
                    } catch {
                        reject(new Error('Failed to parse Google user info response.'));
                    }
                });
            },
        );
        req.on('error', () => reject(new Error('Request to Google user info endpoint failed.')));
        req.end();
    });
}
