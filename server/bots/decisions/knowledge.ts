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

const SUSPICION_WORDS = ['sus', 'suspicious', 'evil', 'traitor', 'lying', 'liar', 'lied', 'fake', "don't trust", 'dont trust', 'distrust', 'minion', 'vote him out', 'vote her out', 'vote them out', 'failed', 'voted against', 'feels off', 'gut feeling'];
const TRUST_WORDS = ['trust', 'loyal', 'believe', 'good guy', 'clean', 'innocent', 'helped pass', 'cleanest'];

/**
 * One piece of public evidence about a player, phrased so a bot can say it
 * out loud without leaking hidden information. Positive weight = suspicious.
 */
export interface PublicFact {
    text: string;
    weight: number;
}

/**
 * Public evidence per player id, derived only from information every player
 * can see: quest outcomes, team membership, leaders, and revealed team votes.
 * This drives both the suspicion scores and the bots' spoken reasoning.
 */
export function getPublicFacts(gameState: GameState): Map<string, PublicFact[]> {
    const facts = new Map<string, PublicFact[]>();
    const add = (playerId: string, text: string, weight: number) => {
        const list = facts.get(playerId) ?? [];
        list.push({ text, weight });
        facts.set(playerId, list);
    };

    for (const q of gameState.questHistory) {
        if (q.status === 'FAILED') {
            for (const member of q.team) {
                add(member.id, `was on Quest ${q.questNumber} when it failed`, 2);
            }
            if (q.questLeader) {
                add(q.questLeader.id, `picked the team that failed Quest ${q.questNumber}`, 1);
            }
        }
        if (q.status === 'PASSED') {
            for (const member of q.team) {
                add(member.id, `helped pass Quest ${q.questNumber}`, -0.75);
            }
            // Rejecting a team that went on to pass reads as obstruction.
            for (const pv of q.pastVotes) {
                for (const v of pv.votes) {
                    if (v.vote === 'REJECT') {
                        add(v.playerId, `voted against a team that went on to pass Quest ${q.questNumber}`, 1);
                    }
                }
            }
        }
    }

    return facts;
}

/** Strongest incriminating fact about a player, if any. */
export function topSuspicionFact(
    facts: Map<string, PublicFact[]>,
    playerId: string,
): PublicFact | undefined {
    return (facts.get(playerId) ?? [])
        .filter((f) => f.weight > 0)
        .sort((a, b) => b.weight - a.weight)[0];
}

/** Suspicion score per player: public evidence + chat accusations/vouches. */
export function buildSuspicionScores(gameState: GameState): Map<string, number> {
    const scores = new Map<string, number>();

    for (const [playerId, list] of getPublicFacts(gameState)) {
        scores.set(playerId, list.reduce((sum, f) => sum + f.weight, 0));
    }

    for (const msg of gameState.chat) {
        // Bots read each other's spoken thoughts too, but at reduced weight:
        // a bot accusation is itself derived from the public record, so a
        // full-weight echo would double-count the same evidence.
        const fromBot = msg.senderUserId < 0;
        const text = msg.text.toLowerCase();
        for (const player of gameState.players) {
            if (player.id === msg.senderId || !text.includes(player.name.toLowerCase())) continue;
            if (SUSPICION_WORDS.some((w) => text.includes(w))) {
                scores.set(player.id, (scores.get(player.id) ?? 0) + (fromBot ? 0.4 : 0.75));
            } else if (TRUST_WORDS.some((w) => text.includes(w))) {
                scores.set(player.id, (scores.get(player.id) ?? 0) - (fromBot ? 0.25 : 0.5));
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
