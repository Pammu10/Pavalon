import { Player, Role, Alignment, GameState, BotDifficulty } from '../../types';

/**
 * Difficulty for one bot. Lobby-added bots can each have their own
 * difficulty (carried on their persona ref in cpuConfig); CPU games set a
 * game-wide difficulty as the fallback.
 */
export function resolveBotDifficulty(gameState: GameState, bot: Player): BotDifficulty {
    const persona = gameState.cpuConfig?.personas.find((p) => p.name === bot.name);
    return persona?.difficulty ?? gameState.cpuConfig?.difficulty ?? 'easy';
}

const SUSPICION_WORDS = ['sus', 'suspicious', 'evil', 'traitor', 'lying', 'liar', 'lied', 'fake', "don't trust", 'dont trust', 'distrust', 'minion', 'vote him out', 'vote her out', 'vote them out'];
const TRUST_WORDS = ['trust', 'loyal', 'believe', 'good guy', 'clean', 'innocent'];

/** Suspicion score per player, blending vote-track rejections with chat accusations/vouches from humans. */
export function buildSuspicionScores(gameState: GameState): Map<string, number> {
    const scores = new Map<string, number>();

    for (const q of gameState.questHistory) {
        if (q.status !== 'PASSED') continue;
        for (const pv of q.pastVotes) {
            for (const v of pv.votes) {
                if (v.vote === 'REJECT') {
                    scores.set(v.playerId, (scores.get(v.playerId) ?? 0) + 1);
                }
            }
        }
    }

    for (const msg of gameState.chat) {
        if (msg.senderUserId < 0) continue; // only human chat shapes bot suspicion
        const text = msg.text.toLowerCase();
        for (const player of gameState.players) {
            if (player.id === msg.senderId || !text.includes(player.name.toLowerCase())) continue;
            if (SUSPICION_WORDS.some((w) => text.includes(w))) {
                scores.set(player.id, (scores.get(player.id) ?? 0) + 0.75);
            } else if (TRUST_WORDS.some((w) => text.includes(w))) {
                scores.set(player.id, (scores.get(player.id) ?? 0) - 0.5);
            }
        }
    }

    return scores;
}

/** What this bot's role lets it know about other players */
export function getKnownEvil(bot: Player, players: Player[]): Player[] {
    switch (bot.role) {
        case Role.MERLIN:
            // Merlin sees all Evil except Mordred
            return players.filter(
                (p) => p.id !== bot.id && p.alignment === Alignment.EVIL && p.role !== Role.MORDRED,
            );
        case Role.MORGANA:
        case Role.ASSASSIN:
        case Role.MORDRED:
        case Role.MINION:
            // Evil team sees each other, except Oberon is invisible to them
            return players.filter(
                (p) => p.id !== bot.id && p.alignment === Alignment.EVIL && p.role !== Role.OBERON,
            );
        default:
            // Loyal Servant, Percival, Oberon see nobody as Evil
            return [];
    }
}

/** Percival sees Merlin + Morgana as indistinguishable "Mystics" */
export function getKnownMystics(bot: Player, players: Player[]): Player[] {
    if (bot.role !== Role.PERCIVAL) return [];
    return players.filter((p) => p.role === Role.MERLIN || p.role === Role.MORGANA);
}

export function isBot(player: Player): boolean {
    return player.userId < 0;
}
