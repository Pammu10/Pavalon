import { Player, GameState, Alignment } from '../../types';
import { getKnownEvil } from './knowledge';

export function decideQuestVote(bot: Player, gameState: GameState): 'SUCCESS' | 'FAIL' {
    // Good players are server-blocked from voting FAIL — this function is only
    // meaningful for Evil bots, but we return SUCCESS safely for any Good bot.
    if (bot.alignment === Alignment.GOOD) return 'SUCCESS';

    const difficulty = gameState.cpuConfig?.difficulty ?? 'easy';
    const quest = gameState.questHistory[gameState.currentQuest - 1];
    const failedQuests = gameState.questHistory.filter((q) => q.status === 'FAILED').length;
    const failsRequired = quest.failsRequired;

    // Count how many known-Evil bots are also on this quest team
    const knownEvil = getKnownEvil(bot, gameState.players);
    const evilOnTeam = quest.team.filter(
        (p) => p.id === bot.id || knownEvil.some((e) => e.id === p.id),
    );
    const evilCount = evilOnTeam.length;

    if (difficulty === 'easy') {
        return Math.random() < 0.3 ? 'FAIL' : 'SUCCESS';
    }

    if (difficulty === 'medium') {
        // If this FAIL would win the game:
        if (failedQuests === 2) return Math.random() < 0.85 ? 'FAIL' : 'SUCCESS';

        // Quest 4 requires 2 fails — only sabotage if another evil is also on team
        if (failsRequired === 2) {
            return evilCount >= 2 ? (Math.random() < 0.75 ? 'FAIL' : 'SUCCESS') : 'SUCCESS';
        }

        // Standard quest:
        const failChance = failedQuests === 0 ? 0.4 : 0.65;
        return Math.random() < failChance ? 'FAIL' : 'SUCCESS';
    }

    // Hard
    if (failedQuests === 2) return 'FAIL'; // Always fail if it wins the game
    if (failedQuests === 1 && Math.random() < 0.92) return 'FAIL'; // Almost always take the win
    if (failsRequired === 2 && evilCount < 2) return 'SUCCESS'; // Can't reach threshold alone
    // Occasional strategic fail to spread suspicion, but not obvious
    return Math.random() < 0.30 ? 'FAIL' : 'SUCCESS';
}
