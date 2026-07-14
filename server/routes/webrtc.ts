import { Router } from 'express';
import { authMiddleware } from '../auth';
import { logger } from '../logger';

const router = Router();

router.get('/ice-servers', authMiddleware, (_req, res) => {
    const iceServers = [
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:global.relay.metered.ca:80', username: '8a39f11c76e7dbfb7d7f0590', credential: 'mYo4f31l+5Sn72MG' },
        { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '8a39f11c76e7dbfb7d7f0590', credential: 'mYo4f31l+5Sn72MG' },
        { urls: 'turn:global.relay.metered.ca:443', username: '8a39f11c76e7dbfb7d7f0590', credential: 'mYo4f31l+5Sn72MG' },
        { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '8a39f11c76e7dbfb7d7f0590', credential: 'mYo4f31l+5Sn72MG' },
    ];
    logger.debug('Providing TURN server configuration');
    res.json({ iceServers });
});

export default router;
