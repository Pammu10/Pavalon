import { Player, GameState, Alignment, Role } from '../../types';
import { getKnownEvil, resolveBotDifficulty } from './knowledge';

export function decideAssassination(bot: Player, gameState: GameState): string | null {
    const difficulty = resolveBotDifficulty(gameState, bot);
    const knownEvilIds = new Set(getKnownEvil(bot, gameState.players).map((p) => p.id));

    // Candidates: non-Evil players (Assassin would never target known allies)
    const candidates = gameState.players.filter(
        (p) => p.id !== bot.id && !knownEvilIds.has(p.id),
    );

    if (candidates.length === 0) return null;

    if (difficulty === 'easy') {
        return candidates[Math.floor(Math.random() * candidates.length)].id;
    }

    // Score candidates by how much they've contributed to passed quests
    function scoreCandidate(p: Player): number {
        let score = 0;
        for (const q of gameState.questHistory) {
            if (q.status === 'PASSED') {
                if (q.team.some((t) => t.id === p.id)) score += 1.5;
                if (q.questLeader?.id === p.id) score += 2;
            }
        }
        return score;
    }

    if (difficulty === 'medium') {
        const scored = candidates.map((p) => ({ p, score: scoreCandidate(p) }));
        scored.sort((a, b) => b.score - a.score);
        // 70% chance to pick the top suspect; 30% random (medium isn't perfect)
        return Math.random() < 0.70 ? scored[0].p.id : candidates[Math.floor(Math.random() * candidates.length)].id;
    }

    // Hard: Merlin behavior scoring
    function hardScore(p: Player): number {
        let score = scoreCandidate(p);

        // Reject votes on teams that had Evil players → strategic intel awareness (Merlin-like)
        for (const q of gameState.questHistory) {
            if (q.status === 'FAILED') continue;
            for (const pv of q.pastVotes) {
                const hasEvil = pv.team.some((t) => knownEvilIds.has(t.id));
                if (hasEvil) {
                    const rejected = pv.votes.find((v) => v.playerId === p.id && v.vote === 'REJECT');
                    if (rejected) score += 1;
                }
            }
        }

        // Chatty players early in the game are less likely to be Merlin (Merlin stays cautious)
        const earlyMessages = gameState.chat.filter(
            (m) => m.senderUserId === p.userId,
        ).length;
        score -= earlyMessages * 0.3;

        return score;
    }

    const scored = candidates.map((p) => ({ p, score: hardScore(p) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].p.id;
}
