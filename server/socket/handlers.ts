import { Server } from 'socket.io';
import { logger } from '../logger';
import { authMiddlewareSocket } from '../auth';
import { ClientToServerEvents, ServerToClientEvents, User } from '../types';
import type { GameService } from '../services/gameService';
import type { SocialService } from '../services/socialService';

interface AuthSocket {
    id: string;
    user: User;
    join: (room: string) => void;
    leave: (room: string) => void;
    to: (room: string) => { emit: (event: string, ...args: unknown[]) => void };
    broadcast: { to: (room: string) => { emit: (event: string, ...args: unknown[]) => void } };
    emit: (event: string, ...args: unknown[]) => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    disconnect: (close?: boolean) => void;
}

export function registerSocketHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    gameService: GameService,
    socialService: SocialService,
): void {
    io.use(authMiddlewareSocket);

    io.on('connection', (socket) => {
        const authed = socket as unknown as AuthSocket;
        const { user } = authed;

        logger.info('User connected', { username: user.username, socketId: socket.id });
        socialService.addUser(authed);

        let throttleWindowStart = Date.now();
        let throttleCount = 0;
        const throttled = (handler: (...args: unknown[]) => void) => (...args: unknown[]) => {
            const now = Date.now();
            if (now - throttleWindowStart > 5000) {
                throttleWindowStart = now;
                throttleCount = 0;
            }
            if (++throttleCount > 20) return;
            handler(...args);
        };

        const existingGame = gameService.findGameByPlayerUserId(user.id);
        if (existingGame) {
            gameService.handleReconnect(authed as Parameters<GameService['handleReconnect']>[0], user, existingGame);
        }

        socket.on('joinRoom', ({ roomCode }) => gameService.handleJoinRoom(authed as Parameters<GameService['handleJoinRoom']>[0], user, roomCode));
        socket.on('leaveRoom', () => gameService.handleLeaveRoom(socket.id));
        socket.on('startGame', (data) => gameService.handleStartGame(socket.id, data.selectedRoles));
        socket.on('updateSelectedRoles', (roles) => gameService.handleUpdateSelectedRoles(socket.id, roles));
        socket.on('playerReady', () => gameService.handlePlayerReady(socket.id));
        socket.on('playerReadyForNextGame', () => gameService.handlePlayerReadyForNextGame(socket.id));
        socket.on('selectTeam', throttled((teamPlayerIds) => gameService.handleSelectTeam(socket.id, teamPlayerIds as string[])));
        socket.on('updatePendingTeam', throttled((teamPlayerIds) => gameService.handleUpdatePendingTeam(socket.id, teamPlayerIds as string[])));
        socket.on('updateAssassinationTarget', (targetId) => gameService.handleUpdateAssassinationTarget(socket.id, targetId as string | null));
        socket.on('voteOnTeam', throttled((vote) => gameService.handleVoteOnTeam(socket.id, vote as 'APPROVE' | 'REJECT')));
        socket.on('voteOnQuest', throttled((vote) => gameService.handleVoteOnQuest(socket.id, vote as 'SUCCESS' | 'FAIL')));
        socket.on('assassinate', (targetId) => gameService.handleAssassinate(socket.id, targetId as string));
        socket.on('sendMessage', throttled((message) => gameService.handleSendMessage(socket.id, message as string)));
        socket.on('sendEmote', throttled((emote) => gameService.handleSendEmote(socket.id, emote as string)));
        socket.on('initiateRestart', () => gameService.handleInitiateRestart(socket.id));
        socket.on('voteOnRestart', (vote) => gameService.handleVoteOnRestart(socket.id, vote as 'yes' | 'no'));
        socket.on('kickPlayer', (playerIdToKick) => gameService.handleKickPlayer(socket.id, playerIdToKick as string));

        socket.on('startDragonsBreath', () => gameService.handleStartDragonsBreath(socket.id));
        socket.on('drawCard', () => gameService.handleDrawCard(socket.id));
        socket.on('playCard', (cardId) => gameService.handlePlayCard(socket.id, cardId as string));
        socket.on('placeDragonCard', (index) => gameService.handlePlaceDragonCard(socket.id, index as number));
        socket.on('endFutureView', () => gameService.handleEndFutureView(socket.id));
        socket.on('returnToLobby', () => gameService.handleReturnToLobby(socket.id));
        socket.on('advanceTutorial', () => gameService.handleAdvanceTutorial(socket.id));
        socket.on('startCPUGame', (data) =>
            gameService.handleStartCPUGame(socket as any, user, data as { difficulty: 'easy' | 'medium' | 'hard'; playerCount: number }),
        );

        socket.on('social:invite_to_game', ({ friendId }) => socialService.handleGameInvite(user, friendId as number));

        socket.on('voice:offer', ({ targetId, sdp }) => socket.to(targetId as string).emit('voice:offer', { fromId: socket.id, sdp }));
        socket.on('voice:answer', ({ targetId, sdp }) => socket.to(targetId as string).emit('voice:answer', { fromId: socket.id, sdp }));
        socket.on('voice:ice-candidate', ({ targetId, candidate }) => socket.to(targetId as string).emit('voice:ice-candidate', { fromId: socket.id, candidate }));

        socket.on('disconnect', () => {
            logger.info('User disconnected', { username: user.username, socketId: socket.id });
            socialService.removeUser(authed);
            gameService.handleDisconnect(socket.id);
        });
    });
}
