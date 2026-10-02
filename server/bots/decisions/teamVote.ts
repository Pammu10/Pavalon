import { Player, GameState } from '../../types';
import { getKnownEvil, buildSuspicionScores, evilProbabilities, resolveBotDifficulty } from './knowledge';

export function decideTeamVote(bot: Player, gameState: GameState): 'APPROVE' | 'REJECT' {
    const difficulty = resolveBotDifficulty(gameState, bot);
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
        // Any Evil aboard (self included) can fail it.
        if (teamIds.has(bot.id) || knownEvil.some((p) => teamIds.has(p.id))) return 'APPROVE';
        // All-Good team: always block the one that would hand Good its third
        // pass; otherwise only reject a quest's first proposal, while it's cheap.
        const passedQuests = gameState.questHistory.filter((q) => q.status === 'PASSED').length;
        if (passedQuests === 2) return 'REJECT';
        return voteTrack === 0 ? 'REJECT' : 'APPROVE';
    } else {
        // Hard Good
        const evilAboard = knownEvil.filter((p) => teamIds.has(p.id));
        if (evilAboard.length > 0) {
            // Merlin: rejecting a team nobody else has a public reason to doubt
            // paints a target for the Assassin, so go along with it (tuned in
            // sim/rust); Merlin's sight still steers the teams he proposes.
            const publicScores = buildSuspicionScores(gameState);
            const noPublicCase = evilAboard.every((p) => (publicScores.get(p.id) ?? 0) <= 0);
            return noPublicCase ? 'APPROVE' : 'REJECT';
        }
        // Reject when anyone aboard looks clearly worse than a random other player.
        const pEvil = evilProbabilities(bot, gameState);
        const evilCount = gameState.players.filter((p) => p.alignment === 'Evil').length;
        const baseRate = evilCount / (gameState.players.length - 1);
        const worst = Math.max(...quest.team.map((p) => pEvil.get(p.id) ?? 0));
        return worst > baseRate * 1.05 ? 'REJECT' : 'APPROVE';
    }
}
