import { Player, GameState } from '../../types';
import { getKnownEvil, buildSuspicionScores } from './knowledge';

export function decideTeamVote(bot: Player, gameState: GameState): 'APPROVE' | 'REJECT' {
    const difficulty = gameState.cpuConfig?.difficulty ?? 'easy';
    const voteTrack = gameState.voteTrack;
    const quest = gameState.questHistory[gameState.currentQuest - 1];
    const teamIds = new Set(quest.team.map((p) => p.id));
    const knownEvil = getKnownEvil(bot, gameState.players);
    const knownEvilIds = new Set(knownEvil.map((p) => p.id));

    // Everyone always approves on voteTrack 4 (5th rejection = instant Evil win)
    if (voteTrack >= 4) return 'APPROVE';

    if (difficulty === 'easy') {
        return Math.random() < 0.6 ? 'APPROVE' : 'REJECT';
    }

    if (difficulty === 'medium') {
        if (bot.alignment === 'Evil') {
            const alliesOnTeam = knownEvil.some((p) => teamIds.has(p.id));
            if (alliesOnTeam) return 'APPROVE';
            // Pure-Good team: reject early to deny quest, but not too aggressively
            return voteTrack <= 1 ? 'REJECT' : 'APPROVE';
        } else {
            // Any known-Evil on team → reject
            if (knownEvil.some((p) => teamIds.has(p.id))) return 'REJECT';
            // Suspicion: reject if team average suspicion is high
            const scores = buildSuspicionScores(gameState);
            const avgSuspicion =
                quest.team.reduce((sum, p) => sum + (scores.get(p.id) ?? 0), 0) / quest.team.length;
            if (avgSuspicion >= 1.5) return Math.random() < 0.7 ? 'REJECT' : 'APPROVE';
            return 'APPROVE';
        }
    }

    // Hard
    if (bot.alignment === 'Evil') {
        const alliesOnTeam = knownEvil.some((p) => teamIds.has(p.id));
        if (alliesOnTeam) return 'APPROVE';
        // Reject selectively only when very safe to do so
        return voteTrack === 0 && Math.random() < 0.3 ? 'REJECT' : 'APPROVE';
    } else {
        // Hard Good
        if (knownEvil.some((p) => teamIds.has(p.id))) return 'REJECT';
        const scores = buildSuspicionScores(gameState);
        const maxSuspicion = Math.max(...quest.team.map((p) => scores.get(p.id) ?? 0));
        if (maxSuspicion >= 2) return Math.random() < 0.8 ? 'REJECT' : 'APPROVE';
        if (maxSuspicion >= 1) return Math.random() < 0.4 ? 'REJECT' : 'APPROVE';
        return 'APPROVE';
    }
}
