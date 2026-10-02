import { GameState, GamePhase, Message, Role } from '../types';
import { IBotGameActions, BotPersona } from './types';
import { ALL_PERSONAS } from './personas';
import { maybeSendChat, handleIncomingChatMessage } from './chat';
import { selectTeam } from './decisions/teamSelection';
import { decideTeamVote } from './decisions/teamVote';
import { decideQuestVote } from './decisions/questVote';
import { decideAssassination } from './decisions/assassination';
import {
    composeAssassinationThought,
    composeQuestResultThought,
    composeTeamSelectionThought,
    composeTeamVoteThought,
    speakThought,
} from './thoughts';

function jitter(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function isPhaseActive(gameState: GameState, phase: GamePhase): boolean {
    return gameState.phase === phase;
}

function pickOne<T>(arr: T[]): T | undefined {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getPersona(name: string): BotPersona | undefined {
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
            case GamePhase.QUEST_RESULT:
                this.handleQuestResult(gameState, bots);
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
            .map((b) => getPersona(b.name))
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
            const persona = getPersona(bot.name);
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
        // A rejection just sent us back here: one non-leader bot reacts.
        if (gameState.voteTrack > 0) {
            const reactor = pickOne(bots.filter((b) => b.id !== leaderBot?.id));
            const p = reactor && getPersona(reactor.name);
            if (p) maybeSendChat(p, 'team_rejected', reactor.id, this.gameService, undefined, 900);
        }
        if (!leaderBot) return; // human is leader

        const persona = getPersona(leaderBot.name);
        if (!persona) return;
        const [min, max] = persona.timing.teamSelect;
        maybeSendChat(persona, 'became_leader', leaderBot.id, this.gameService, undefined, 1500);

        setTimeout(() => {
            if (!isPhaseActive(gameState, GamePhase.TEAM_SELECTION)) return;
            if (gameState.leader?.id !== leaderBot.id) return;
            const quest = gameState.questHistory[gameState.currentQuest - 1];
            if (!quest) return;
            const teamIds = selectTeam(leaderBot, gameState, quest.teamSize);
            // Explain the pick out loud (public-facts reasoning) before proposing.
            speakThought(leaderBot, persona, gameState,
                composeTeamSelectionThought(leaderBot, gameState, teamIds),
                this.gameService, 300);
            this.gameService.handleSelectTeam(leaderBot.id, teamIds);
        }, jitter(min, max));
    }

    private handleTeamVote(gameState: GameState, bots: typeof gameState.players): void {
        bots.forEach((bot, i) => {
            const persona = getPersona(bot.name);
            if (!persona) return;
            const delay = persona.timing.voteBase + i * persona.timing.voteStagger + Math.random() * 400;

            setTimeout(() => {
                if (!isPhaseActive(gameState, GamePhase.TEAM_VOTE)) return;
                const currentBot = gameState.players.find((p) => p.id === bot.id);
                if (!currentBot || currentBot.hasVoted) return;

                if (gameState.voteTrack >= 4) {
                    maybeSendChat(persona, 'vote_track_critical', bot.id, this.gameService, undefined, 200);
                }

                const vote = decideTeamVote(bot, gameState);
                // Argue the vote in chat: honest evidence for Good bots,
                // a plausible cover story for Evil ones.
                speakThought(bot, persona, gameState,
                    composeTeamVoteThought(bot, gameState, vote),
                    this.gameService, 400 + i * 350);
                this.gameService.handleVoteOnTeam(bot.id, vote);
            }, delay);
        });
    }

    private handleQuestVote(gameState: GameState, bots: typeof gameState.players): void {
        const quest = gameState.questHistory[gameState.currentQuest - 1];
        if (!quest) return;
        const botsOnTeam = bots.filter((b) => quest.team.some((t) => t.id === b.id));
        const cheerer = pickOne(botsOnTeam);
        const cheerPersona = cheerer && getPersona(cheerer.name);
        if (cheerPersona) maybeSendChat(cheerPersona, 'on_the_team', cheerer.id, this.gameService, undefined, 700);

        botsOnTeam.forEach((bot, i) => {
            const persona = getPersona(bot.name);
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

    /** The quest card flip: one bot reacts; on a fail, another points at the team. */
    private handleQuestResult(gameState: GameState, bots: typeof gameState.players): void {
        const quest = gameState.questHistory[gameState.currentQuest - 1];
        if (!quest) return;
        const [first, second] = [...bots].sort(() => Math.random() - 0.5);
        const firstPersona = first && getPersona(first.name);
        if (firstPersona) {
            const trigger = quest.status === 'PASSED' ? 'quest_passed' : 'quest_failed';
            maybeSendChat(firstPersona, trigger, first.id, this.gameService, undefined, 2500);
        }
        // Prefer a bot that was on the failed team: "it wasn't me" is the natural reply.
        const accuser = bots.find((b) => quest.team.some((t) => t.id === b.id)) ?? second;
        const accuserPersona = accuser && getPersona(accuser.name);
        if (accuserPersona && quest.status === 'FAILED') {
            speakThought(accuser, accuserPersona, gameState,
                composeQuestResultThought(accuser, gameState), this.gameService, 4500);
        }
    }

    private handleAssassination(gameState: GameState, bots: typeof gameState.players): void {
        const assassinBot = bots.find((b) => b.role === Role.ASSASSIN);
        if (!assassinBot) return; // human is the Assassin

        const persona = getPersona(assassinBot.name);
        if (!persona) return;
        const [min, max] = persona.timing.assassination;

        maybeSendChat(persona, 'assassination_phase', assassinBot.id, this.gameService, undefined, 1200);

        // Extra 8s floor: humans are still watching the quest-result reveal when
        // this phase starts — an instant kill reads as victory-then-defeat whiplash.
        setTimeout(async () => {
            if (!isPhaseActive(gameState, GamePhase.ASSASSINATION)) return;
            const targetId = decideAssassination(assassinBot, gameState);
            if (!targetId) return;
            // Announce the deduction, let it land, then strike.
            speakThought(assassinBot, persona, gameState,
                composeAssassinationThought(assassinBot, gameState, targetId),
                this.gameService, 0);
            setTimeout(async () => {
                if (!isPhaseActive(gameState, GamePhase.ASSASSINATION)) return;
                await this.gameService.handleAssassinate(assassinBot.id, targetId);
            }, 2500);
        }, 8000 + jitter(min, max));
    }

    private handleEndGame(gameState: GameState, bots: typeof gameState.players): void {
        const winner = gameState.winner;
        const trigger = winner === 'Good' ? 'game_over_good_wins' : 'game_over_evil_wins';

        bots.forEach((bot, i) => {
            const persona = getPersona(bot.name);
            if (persona) maybeSendChat(persona, trigger, bot.id, this.gameService, undefined, 1500 + i * 400);

            // Auto-ready for next game so human can trigger restart
            setTimeout(() => {
                this.gameService.handlePlayerReadyForNextGame(bot.id);
            }, 5000 + i * 350);
        });
    }
}
