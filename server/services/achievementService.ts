import { Server } from 'socket.io';
import db from '../db';
import { logger } from '../logger';
import { ALL_ACHIEVEMENTS } from '../achievements';
import {
    Role,
    Alignment,
    ClientToServerEvents,
    ServerToClientEvents,
    GameState,
    UserAchievement,
    Achievement as ClientAchievement,
    PlayerStats,
} from '../types';

export class AchievementService {
    async checkAndGrantAchievements(
        userId: number,
        performance: { role: Role; alignment: Alignment; won: boolean },
        io: Server<ClientToServerEvents, ServerToClientEvents>,
        gameState: GameState,
        stats: PlayerStats,
    ): Promise<void> {
        const userAchievements = await db.all<UserAchievement>(
            'SELECT achievement_id FROM user_achievements WHERE user_id = $1',
            [userId],
        );
        const unlockedIds = new Set(userAchievements.map((ua) => ua.achievement_id));

        for (const achievement of ALL_ACHIEVEMENTS) {
            if (!unlockedIds.has(achievement.id) && achievement.check(stats, performance)) {
                await this.grantAchievement(userId, achievement.id, io, gameState);
            }
        }
    }

    private async grantAchievement(
        userId: number,
        achievementId: string,
        io: Server,
        gameState: GameState,
    ): Promise<void> {
        try {
            await db.run(
                'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
                [userId, achievementId],
            );
            logger.info('Achievement unlocked', { userId, achievementId });

            const playerInGame = gameState.players.find((p) => p.userId === userId);
            if (playerInGame) {
                const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === achievementId);
                if (achievement) {
                    const { check, ...payload } = achievement;
                    void check; // suppress unused variable
                    const unlockedPayload: ClientAchievement = {
                        ...payload,
                        unlocked: true,
                        unlocked_at: new Date().toISOString(),
                    };
                    io.to(playerInGame.id).emit('achievementUnlocked', unlockedPayload);
                }
            }
        } catch (err) {
            const e = err as { code?: string };
            if (e.code !== '23505') {
                logger.error('Failed to grant achievement', { userId, achievementId, error: String(err) });
            }
        }
    }
}
