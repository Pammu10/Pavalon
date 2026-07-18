import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authMiddleware } from '../auth';
import { GameState } from '../types';
import { logger } from '../logger';

export interface VoiceGameLookup {
    getGameByRoomCode(roomCode: string): GameState | undefined;
}

export class VoiceTokenError extends Error {
    constructor(public code: 'NOT_CONFIGURED' | 'ROOM_NOT_FOUND' | 'NOT_IN_ROOM') {
        super(code);
    }
}

export async function mintVoiceToken(
    games: VoiceGameLookup,
    userId: number,
    roomCode: string,
): Promise<{ url: string; token: string }> {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) throw new VoiceTokenError('NOT_CONFIGURED');

    const game = games.getGameByRoomCode(roomCode);
    if (!game) throw new VoiceTokenError('ROOM_NOT_FOUND');

    const player = game.players.find((p) => p.userId === userId);
    if (!player) throw new VoiceTokenError('NOT_IN_ROOM');

    const at = new AccessToken(apiKey, apiSecret, {
        identity: String(userId),
        name: player.name,
        ttl: '6h',
    });
    at.addGrant({ room: roomCode, roomJoin: true, canPublish: true, canSubscribe: true });
    return { url, token: await at.toJwt() };
}

export function createVoiceRouter(games: VoiceGameLookup): Router {
    const router = Router();

    router.get('/token', authMiddleware, async (req, res) => {
        const roomCode = req.query.roomCode;
        if (typeof roomCode !== 'string' || !roomCode) {
            return res.status(400).json({ message: 'roomCode is required' });
        }
        const userId = (req as any).user.id as number;
        try {
            const result = await mintVoiceToken(games, userId, roomCode);
            res.json(result);
        } catch (err) {
            if (err instanceof VoiceTokenError) {
                const status =
                    err.code === 'NOT_CONFIGURED' ? 503 : err.code === 'ROOM_NOT_FOUND' ? 404 : 403;
                return res.status(status).json({ message: err.code });
            }
            logger.error('Failed to mint voice token', { err });
            res.status(500).json({ message: 'Failed to mint voice token' });
        }
    });

    return router;
}
