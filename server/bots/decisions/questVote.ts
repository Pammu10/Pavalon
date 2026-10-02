import { Player, GameState, Alignment } from '../../types';
import { getKnownEvil, resolveBotDifficulty } from './knowledge';

export function decideQuestVote(bot: Player, gameState: GameState): 'SUCCESS' | 'FAIL' {
    // Good players are server-blocked from voting FAIL — this function is only
    // meaningful for Evil bots, but we return SUCCESS safely for any Good bot.
    if (bot.alignment === Alignment.GOOD) return 'SUCCESS';

    const difficulty = resolveBotDifficulty(gameState, bot);
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
    if (failsRequired === 2) return evilCount >= 2 ? 'FAIL' : 'SUCCESS'; // Can't reach threshold alone
    // One fail is enough: only the first known Evil in seating order fails
    // (allies all agree on who that is), so a double fail doesn't expose two.
    const designated = quest.team.find((p) => p.id === bot.id || knownEvil.some((e) => e.id === p.id));
    if (designated?.id !== bot.id) return 'SUCCESS';
    // Tuned in sim/rust: bluffing on Quest 1 cost more than the cover it bought.
    return 'FAIL';
}
