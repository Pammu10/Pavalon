import { GameState, GamePhase, Message, Role } from '../types';
import { IBotGameActions, BotPersona } from './types';
import { ALL_PERSONAS } from './personas';
import { maybeSendChat, handleIncomingChatMessage } from './chat';
import { selectTeam } from './decisions/teamSelection';
import { decideTeamVote } from './decisions/teamVote';
import { decideQuestVote } from './decisions/questVote';
import { decideAssassination } from './decisions/assassination';

function jitter(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function isPhaseActive(gameState: GameState, phase: GamePhase): boolean {
    return gameState.phase === phase;
}

function getPersona(name: string, gameState: GameState): BotPersona | undefined {
    return ALL_PERSONAS.find((p) => p.name === name);
}

export class BotEngine {
    private processedKeys = new Set<string>();

    constructor(private gameService: IBotGameActions) {}

    onPhaseChange(gameState: GameState): void {
        const bots = gameState.players.filter((p) => p.userId < 0);
        if (bots.length === 0) return;

        // Idempotency: each phase/quest/voteTrack combo fires bot actions once
        const key = `${gameState.roomCode}:${gameState.phase}:${gameState.currentQuest}:${gameState.voteTrack}`;
        if (this.processedKeys.has(key)) return;
        this.processedKeys.add(key);

        switch (gameState.phase) {
            case GamePhase.ROLE_REVEAL:
                this.handleRoleReveal(gameState, bots);
                break;
            case GamePhase.TEAM_SELECTION:
                this.handleTeamSelection(gameState, bots);
                break;
            case GamePhase.TEAM_VOTE:
                this.handleTeamVote(gameState, bots);
                break;
            case GamePhase.QUEST_VOTE:
                this.handleQuestVote(gameState, bots);
                break;
            case GamePhase.ASSASSINATION:
                this.handleAssassination(gameState, bots);
                break;
            case GamePhase.END_GAME:
                this.handleEndGame(gameState, bots);
                this.cleanupRoom(gameState.roomCode!);
                break;
        }
    }

    onChatMessage(message: Message, gameState: GameState): void {
        const bots = gameState.players.filter((p) => p.userId < 0);
        if (bots.length === 0 || message.senderUserId < 0) return;

        const personas = bots
            .map((b) => getPersona(b.name, gameState))
            .filter((p): p is BotPersona => !!p);

        handleIncomingChatMessage(message, bots, gameState, personas, this.gameService);
    }

    /**
     * Bot actions dispatched while a player was mid-reconnect get dropped by
     * the reconnectingPlayer guards, but the phase is already marked
     * processed — the game would hang. Clearing the room's keys lets the
     * post-reconnect broadcast re-run the phase; every bot action is
     * idempotent (hasVoted / phase guards), so re-firing is safe.
     */
    onPlayerReconnected(roomCode: string): void {
        this.cleanupRoom(roomCode);
    }

    private cleanupRoom(roomCode: string): void {
        for (const key of this.processedKeys) {
            if (key.startsWith(`${roomCode}:`)) this.processedKeys.delete(key);
        }
    }

    private handleRoleReveal(gameState: GameState, bots: typeof gameState.players): void {
        let firstBot = true;
        bots.forEach((bot, i) => {
            const persona = getPersona(bot.name, gameState);
            if (!persona) return;
            const [min, max] = persona.timing.ready;
            const delay = jitter(min, max) + i * persona.timing.readyStagger;

            setTimeout(() => {
                if (!isPhaseActive(gameState, GamePhase.ROLE_REVEAL)) return;
                if (firstBot) {
                    maybeSendChat(persona, 'game_start', bot.id, this.gameService);
                    firstBot = false;
                }
                this.gameService.handlePlayerReady(bot.id);
            }, delay);
        });
    }

    private handleTeamSelection(gameState: GameState, bots: typeof gameState.players): void {
        const leaderBot = bots.find((b) => b.id === gameState.leader?.id);
        if (!leaderBot) return; // human is leader

        const persona = getPersona(leaderBot.name, gameState);
        if (!persona) return;
        const [min, max] = persona.timing.teamSelect;

        setTimeout(() => {
            if (!isPhaseActive(gameState, GamePhase.TEAM_SELECTION)) return;
            if (gameState.leader?.id !== leaderBot.id) return;
            const quest = gameState.questHistory[gameState.currentQuest - 1];
            if (!quest) return;
            const teamIds = selectTeam(leaderBot, gameState, quest.teamSize);
            maybeSendChat(persona, 'became_leader', leaderBot.id, this.gameService, undefined, 0);
            this.gameService.handleSelectTeam(leaderBot.id, teamIds);
        }, jitter(min, max));
    }

    private handleTeamVote(gameState: GameState, bots: typeof gameState.players): void {
        bots.forEach((bot, i) => {
            const persona = getPersona(bot.name, gameState);
            if (!persona) return;
            const delay = persona.timing.voteBase + i * persona.timing.voteStagger + Math.random() * 400;

            setTimeout(() => {
                if (!isPhaseActive(gameState, GamePhase.TEAM_VOTE)) return;
                const currentBot = gameState.players.find((p) => p.id === bot.id);
                if (!currentBot || currentBot.hasVoted) return;

                const quest = gameState.questHistory[gameState.currentQuest - 1];
                const onTeam = quest?.team.some((p) => p.id === bot.id);
                maybeSendChat(persona, onTeam ? 'on_the_team' : 'not_on_team', bot.id, this.gameService);
                if (gameState.voteTrack >= 4) {
                    maybeSendChat(persona, 'vote_track_critical', bot.id, this.gameService, undefined, 200);
                }

                const vote = decideTeamVote(bot, gameState);
                this.gameService.handleVoteOnTeam(bot.id, vote);
            }, delay);
        });
    }

    private handleQuestVote(gameState: GameState, bots: typeof gameState.players): void {
        const quest = gameState.questHistory[gameState.currentQuest - 1];
        if (!quest) return;
        const botsOnTeam = bots.filter((b) => quest.team.some((t) => t.id === b.id));

        botsOnTeam.forEach((bot, i) => {
            const persona = getPersona(bot.name, gameState);
            if (!persona) return;
            const [min, max] = persona.timing.questVote;
            const delay = jitter(min, max) + i * 300;

            setTimeout(() => {
                if (!isPhaseActive(gameState, GamePhase.QUEST_VOTE)) return;
                const currentBot = gameState.players.find((p) => p.id === bot.id);
                if (!currentBot || currentBot.hasVoted) return;
                const vote = decideQuestVote(bot, gameState);
                this.gameService.handleVoteOnQuest(bot.id, vote);
            }, delay);
        });
    }

    private handleAssassination(gameState: GameState, bots: typeof gameState.players): void {
        const assassinBot = bots.find((b) => b.role === Role.ASSASSIN);
        if (!assassinBot) return; // human is the Assassin

        const persona = getPersona(assassinBot.name, gameState);
        if (!persona) return;
        const [min, max] = persona.timing.assassination;

        maybeSendChat(persona, 'assassination_phase', assassinBot.id, this.gameService, undefined, 1200);

        // Extra 8s floor: humans are still watching the quest-result reveal when
        // this phase starts — an instant kill reads as victory-then-defeat whiplash.
        setTimeout(async () => {
            if (!isPhaseActive(gameState, GamePhase.ASSASSINATION)) return;
            const targetId = decideAssassination(assassinBot, gameState);
            if (targetId) await this.gameService.handleAssassinate(assassinBot.id, targetId);
        }, 8000 + jitter(min, max));
    }

    private handleEndGame(gameState: GameState, bots: typeof gameState.players): void {
        const winner = gameState.winner;
        const trigger = winner === 'Good' ? 'game_over_good_wins' : 'game_over_evil_wins';

        bots.forEach((bot, i) => {
            const persona = getPersona(bot.name, gameState);
            if (persona) maybeSendChat(persona, trigger, bot.id, this.gameService, undefined, 1500 + i * 400);

            // Auto-ready for next game so human can trigger restart
            setTimeout(() => {
                this.gameService.handlePlayerReadyForNextGame(bot.id);
            }, 5000 + i * 350);
        });
    }
}
