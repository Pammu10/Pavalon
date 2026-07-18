import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { mintVoiceToken, VoiceTokenError, type VoiceGameLookup } from './voice';

const fakeGames = (players: { userId: number }[]): VoiceGameLookup => ({
    getGameByRoomCode: (roomCode: string) =>
        roomCode === 'ROOM1' ? ({ players } as any) : undefined,
});

describe('mintVoiceToken', () => {
    beforeEach(() => {
        process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
        process.env.LIVEKIT_API_KEY = 'testkey';
        process.env.LIVEKIT_API_SECRET = 'testsecret-testsecret-testsecret';
    });

    it('mints a token with room grant and userId identity', async () => {
        const { url, token } = await mintVoiceToken(fakeGames([{ userId: 42 }]), 42, 'ROOM1');
        expect(url).toBe('wss://test.livekit.cloud');
        const decoded = jwt.decode(token) as any;
        expect(decoded.sub).toBe('42');
        expect(decoded.video).toMatchObject({ room: 'ROOM1', roomJoin: true });
    });

    it('rejects when the room does not exist', async () => {
        await expect(mintVoiceToken(fakeGames([{ userId: 42 }]), 42, 'NOPE'))
            .rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('rejects when the user is not a player in the room', async () => {
        await expect(mintVoiceToken(fakeGames([{ userId: 42 }]), 99, 'ROOM1'))
            .rejects.toMatchObject({ code: 'NOT_IN_ROOM' });
    });

    it('rejects when LiveKit is not configured', async () => {
        delete process.env.LIVEKIT_URL;
        await expect(mintVoiceToken(fakeGames([{ userId: 42 }]), 42, 'ROOM1'))
            .rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    });
});
