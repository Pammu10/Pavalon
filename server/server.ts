import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { logger } from './logger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import webrtcRoutes from './routes/webrtc';
import { createUserRouter } from './routes/user';
import { createSocialRouter } from './routes/social';
import { createAdminRouter } from './routes/admin';
import { createVoiceRouter } from './routes/voice';
import { registerSocketHandlers } from './socket/handlers';
import { GameService } from './services/gameService';
import { SocialService } from './services/socialService';
import { AchievementService } from './services/achievementService';
import { BotEngine } from './bots';
import { ollamaClient } from './bots/llm';
import db from './db';
import { ClientToServerEvents, ServerToClientEvents } from './types';

const app = express();
app.use(cors(config.corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, { cors: config.corsOptions });

const achievementService = new AchievementService();
const socialService = new SocialService(io);
const gameService = new GameService(io, socialService, achievementService);
const botEngine = new BotEngine(gameService);
gameService.setBotEngine(botEngine);
ollamaClient.probe(); // non-blocking — logs availability, enables LLM chat if running
socialService.setGameService(gameService);

app.use('/api', authRoutes);
app.use('/api', createUserRouter(gameService));
app.use('/api/social', createSocialRouter(socialService));
app.use('/api/admin', createAdminRouter(gameService));
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/voice', createVoiceRouter(gameService));

app.use(errorHandler);

registerSocketHandlers(io, gameService, socialService);

const cleanupStaleFriendRequests = async () => {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const result = await db.run("DELETE FROM friends WHERE status = 'pending' AND created_at < $1", [oneDayAgo]);
        if (result.rowCount && result.rowCount > 0) {
            logger.info('Cleaned up stale friend requests', { count: result.rowCount });
        }
    } catch (err) {
        logger.error('Error cleaning up stale friend requests', { error: String(err) });
    }
};
setInterval(cleanupStaleFriendRequests, 60 * 60 * 1000);

const PORT = config.port;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`, { env: config.nodeEnv }));
