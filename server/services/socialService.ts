import { Server } from 'socket.io';
import db from '../db';
import { logger } from '../logger';
import { getFullUser } from '../helpers';
import {
    User,
    GamePhase,
    GameState,
    ClientToServerEvents,
    ServerToClientEvents,
    OnlineUser,
    Friend,
    GameInvite,
} from '../types';
import type { GameService } from './gameService';

export class SocialService {
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    private onlineUsers: Map<number, OnlineUser> = new Map();
    private gameService?: GameService;

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
    }

    setGameService(service: GameService): void {
        this.gameService = service;
    }

    async addUser(socket: { id: string; join: (room: string) => void; user: User }): Promise<void> {
        const { user } = socket;
        this.onlineUsers.set(user.id, { socketId: socket.id, roomCode: null });
        socket.join(`user-${user.id}`);
        logger.info('User connected', { username: user.username, userId: user.id, socketId: socket.id });
        await this.broadcastStatusToFriends(user.id, true, false);
    }

    async removeUser(socket: { id: string; user?: User }): Promise<void> {
        const { user } = socket;
        if (user && this.onlineUsers.has(user.id)) {
            this.onlineUsers.delete(user.id);
            logger.info('User disconnected', { username: user.username, userId: user.id });
            await this.broadcastStatusToFriends(user.id, false, false, null);
        }
    }

    async updateUserStatus(userId: number, isInGame: boolean, roomCode?: string): Promise<void> {
        const user = this.onlineUsers.get(userId);
        if (user) {
            user.roomCode = roomCode || null;
            this.onlineUsers.set(userId, user);
            const friendGame = roomCode && this.gameService
                ? this.gameService.getGameByRoomCode(roomCode)
                : undefined;
            await this.broadcastStatusToFriends(userId, true, isInGame, friendGame?.phase);
        }
    }

    private async broadcastStatusToFriends(
        userId: number,
        isOnline: boolean,
        isInGame: boolean,
        gamePhase?: GamePhase | null,
    ): Promise<void> {
        const friends = await this.getFriendIds(userId);
        for (const friendId of friends) {
            if (this.isUserOnline(friendId)) {
                this.io.to(`user-${friendId}`).emit('social:status', {
                    userId,
                    isOnline,
                    isInGame,
                    gamePhase: gamePhase ?? null,
                });
            }
        }
    }

    private async getFriendIds(userId: number): Promise<number[]> {
        const results = await db.all<{ friend_id: number }>(`
            SELECT CASE
                WHEN user1_id = $1 THEN user2_id
                ELSE user1_id
            END as friend_id
            FROM friends
            WHERE (user1_id = $1 OR user2_id = $1) AND status = 'accepted'
        `, [userId]);
        return results.map((r) => r.friend_id);
    }

    async getFriendsOfUser(userId: number): Promise<Friend[]> {
        const friendsData = await db.all<{
            id: number;
            username: string;
            selected_title: string;
            selected_border: string;
            selected_icon: string;
            selected_background: string;
        }>(`
            SELECT u.id, u.username, u.selected_title, u.selected_border, u.selected_icon, u.selected_background
            FROM users u
            JOIN friends f ON (u.id = f.user1_id OR u.id = f.user2_id)
            WHERE (f.user1_id = $1 OR f.user2_id = $1) AND f.status = 'accepted' AND u.id != $1
        `, [userId]);

        return friendsData.map((f) => {
            const onlineInfo = this.onlineUsers.get(f.id);
            const friendGame = onlineInfo?.roomCode && this.gameService
                ? this.gameService.getGameByRoomCode(onlineInfo.roomCode)
                : undefined;

            return {
                id: f.id,
                username: f.username,
                selectedTitle: f.selected_title,
                selectedBorder: f.selected_border,
                selectedIcon: f.selected_icon,
                selectedBackground: f.selected_background,
                isOnline: !!onlineInfo,
                isInGame: !!onlineInfo?.roomCode,
                gamePhase: friendGame?.phase || null,
            };
        });
    }

    isUserOnline(userId: number): boolean {
        return this.onlineUsers.has(userId);
    }

    getUserSocketId(userId: number): string | undefined {
        return this.onlineUsers.get(userId)?.socketId;
    }

    notifyFriendRequest(fromUserId: number, fromUsername: string, toUserId: number): void {
        if (this.isUserOnline(toUserId)) {
            this.io.to(`user-${toUserId}`).emit('social:request_received', {
                id: fromUserId,
                username: fromUsername,
            });
        }
    }

    async notifyFriendAccepted(acceptedByUserId: number, requesterId: number): Promise<void> {
        const [acceptedByUser, requester] = await Promise.all([
            getFullUser(acceptedByUserId),
            getFullUser(requesterId),
        ]);

        const createPayload = (friendUser: User): Friend => {
            const onlineInfo = this.onlineUsers.get(friendUser.id);
            const friendGame = onlineInfo?.roomCode && this.gameService
                ? this.gameService.getGameByRoomCode(onlineInfo.roomCode)
                : undefined;
            return {
                id: friendUser.id,
                username: friendUser.username,
                selectedTitle: friendUser.selectedTitle ?? null,
                selectedBorder: friendUser.selectedBorder ?? null,
                selectedIcon: friendUser.selectedIcon ?? null,
                selectedBackground: friendUser.selectedBackground ?? null,
                isOnline: this.isUserOnline(friendUser.id),
                isInGame: !!onlineInfo?.roomCode,
                gamePhase: friendGame?.phase || null,
            };
        };

        if (this.isUserOnline(requesterId) && acceptedByUser) {
            this.io.to(`user-${requesterId}`).emit('social:request_accepted', createPayload(acceptedByUser));
        }
        if (this.isUserOnline(acceptedByUserId) && requester) {
            this.io.to(`user-${acceptedByUserId}`).emit('social:request_accepted', createPayload(requester));
        }
    }

    notifyFriendRemoved(removedByUserId: number, removedUserId: number): void {
        if (this.isUserOnline(removedUserId)) {
            this.io.to(`user-${removedUserId}`).emit('social:friend_removed', { friendId: removedByUserId });
        }
    }

    notifyFriendRequestCancelled(fromUserId: number, toUserId: number): void {
        if (this.isUserOnline(toUserId)) {
            this.io.to(`user-${toUserId}`).emit('social:request_cancelled', { requesterId: fromUserId });
        }
    }

    handleGameInvite(fromUser: User, toFriendId: number): void {
        const friendSocketId = this.getUserSocketId(toFriendId);
        const fromUserOnlineInfo = this.onlineUsers.get(fromUser.id);
        const fromUserRoomCode = fromUserOnlineInfo?.roomCode;
        const fromUserSocketId = this.getUserSocketId(fromUser.id);

        if (!friendSocketId || !fromUserRoomCode || !fromUserSocketId) {
            if (fromUserSocketId) {
                this.io.to(fromUserSocketId).emit('error', 'Could not send invite. Friend is offline or you are not in a lobby.');
            }
            return;
        }

        const fromUserGame = this.gameService?.getGameByRoomCode(fromUserRoomCode);
        if (fromUserGame?.phase !== GamePhase.LOBBY) {
            this.io.to(fromUserSocketId).emit('error', 'You can only invite friends while you are in a lobby.');
            return;
        }

        const friendUserInfo = this.onlineUsers.get(toFriendId);
        if (friendUserInfo?.roomCode && this.gameService) {
            const friendGameState = this.gameService.getGameByRoomCode(friendUserInfo.roomCode);
            const nonInvitablePhases: GamePhase[] = [
                GamePhase.ROLE_REVEAL,
                GamePhase.TEAM_SELECTION,
                GamePhase.TEAM_VOTE,
                GamePhase.QUEST_VOTE,
                GamePhase.QUEST_RESULT,
                GamePhase.ASSASSINATION,
            ];
            if (friendGameState && nonInvitablePhases.includes(friendGameState.phase)) {
                this.io.to(fromUserSocketId).emit('error', 'Your friend is in an active game and cannot be invited right now.');
                return;
            }
        }

        const invitePayload: GameInvite = { from: fromUser, roomCode: fromUserRoomCode };
        this.io.to(friendSocketId).emit('social:invite_received', invitePayload);
    }

    getGameStateForRoom(roomCode: string): GameState | undefined {
        return this.gameService?.getGameByRoomCode(roomCode);
    }
}
