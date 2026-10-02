import { Player, GameState } from '../../types';
import { getKnownEvil, buildSuspicionScores, evilProbabilities, resolveBotDifficulty } from './knowledge';

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function selectTeam(bot: Player, gameState: GameState, teamSize: number): string[] {
    const difficulty = resolveBotDifficulty(gameState, bot);
    const allPlayers = gameState.players;
    const knownEvil = getKnownEvil(bot, allPlayers);
    const knownEvilIds = new Set(knownEvil.map((p) => p.id));

    const others = allPlayers.filter((p) => p.id !== bot.id);

    if (difficulty === 'easy') {
        // Random selection, includes self ~50% of the time
        const includesSelf = Math.random() < 0.5;
        const pool = includesSelf ? allPlayers : others;
        return shuffle(pool)
            .slice(0, teamSize)
            .map((p) => p.id);
    }

    if (difficulty === 'medium') {
        if (bot.alignment === 'Evil') {
            // Include self + one known ally when not too early or too suspicious
            const allies = knownEvil.filter((p) => p.id !== bot.id);
            const voteTrack = gameState.voteTrack;

            if (voteTrack >= 3 || gameState.currentQuest === 1) {
                // Forced to pick clean-looking team — avoid raising suspicion
                const scores = buildSuspicionScores(gameState);
                const sorted = [...allPlayers].sort(
                    (a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0),
                );
                return sorted.slice(0, teamSize).map((p) => p.id);
            }

            const team = [bot.id];
            if (allies.length > 0) team.push(allies[0].id);
            const fill = shuffle(others.filter((p) => !team.includes(p.id)));
            while (team.length < teamSize && fill.length > 0) team.push(fill.pop()!.id);
            return team;
        } else {
            // Good bot: pick self + avoid known-Evil players; weight low-suspicion players
            const scores = buildSuspicionScores(gameState);
            const safePool = others.filter((p) => !knownEvilIds.has(p.id));
            const sorted = shuffle(safePool).sort(
                (a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0),
            );
            const team = [bot.id, ...sorted.map((p) => p.id)].slice(0, teamSize);
            return team;
        }
    }

    // Hard
    if (bot.alignment === 'Evil') {
        // Always lead with self (a leader leaving themselves off looks odd) —
        // one Evil is enough to fail most quests. Fill with the cleanest-looking
        // Good players for cover; bring one ally only when two fails are needed.
        const scores = buildSuspicionScores(gameState);
        const byCleanest = (ps: Player[]) =>
            [...ps].sort((a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0));
        const allies = byCleanest(knownEvil);
        const team = [bot.id];
        if (gameState.questHistory[gameState.currentQuest - 1].failsRequired === 2 && allies.length > 0) {
            team.push(allies[0].id);
        }
        for (const p of [...byCleanest(others.filter((p) => !knownEvilIds.has(p.id))), ...allies]) {
            if (team.length >= teamSize) break;
            if (!team.includes(p.id)) team.push(p.id);
        }
        return team;
    } else {
        // Hard Good: rank by deduction; Merlin also drops the Evil he can see.
        const scores = evilProbabilities(bot, gameState);
        const safePool = bot.role === 'Merlin'
            ? others.filter((p) => !knownEvilIds.has(p.id))
            : others;
        const sorted = [...safePool].sort(
            (a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0),
        );
        const team = [bot.id, ...sorted.map((p) => p.id)].slice(0, teamSize);
        return team;
    }
}
