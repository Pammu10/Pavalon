import { Player, GameState, Alignment } from '../types';
import { BotPersona, IBotGameActions } from './types';
import {
    buildSuspicionScores,
    getKnownEvil,
    getPublicFacts,
    topSuspicionFact,
} from './decisions/knowledge';
import { ollamaClient } from './llm';

/**
 * Spoken bot reasoning. Every thought is composed from PUBLIC information
 * only (quest outcomes, team membership, revealed votes), so nothing hidden
 * can leak:
 *  - Good bots explain their real reasoning and cite the evidence.
 *  - Evil bots say something plausible for the same action — deflecting onto
 *    whoever already looks suspicious, or vouching for "clean" teams —
 *    never their true motive.
 * Quest votes are secret, so bots never talk about those.
 */

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function mostSuspect(
    candidates: Player[],
    scores: Map<string, number>,
): Player | undefined {
    return [...candidates].sort(
        (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0),
    )[0];
}

function cleanest(candidates: Player[], scores: Map<string, number>): Player | undefined {
    return [...candidates].sort(
        (a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0),
    )[0];
}

export function composeTeamVoteThought(
    bot: Player,
    gameState: GameState,
    vote: 'APPROVE' | 'REJECT',
): string | null {
    const quest = gameState.questHistory[gameState.currentQuest - 1];
    if (!quest) return null;
    const teammates = quest.team.filter((p) => p.id !== bot.id);
    if (teammates.length === 0) return null;

    const scores = buildSuspicionScores(gameState);
    const facts = getPublicFacts(gameState);
    const isEvil = bot.alignment === Alignment.EVIL;

    if (vote === 'REJECT') {
        // Both alignments accuse whoever already looks worst on public
        // evidence — honest deduction for Good, deflection for Evil.
        const target = mostSuspect(teammates, scores);
        if (!target) return null;
        const fact = topSuspicionFact(facts, target.id);
        if (fact) {
            return pick([
                `I'm rejecting this — ${target.name} ${fact.text}.`,
                `No from me. ${target.name} ${fact.text}, and that's not nothing.`,
                `Can't approve while ${target.name} is on it. They ${fact.text}.`,
            ]);
        }
        // No hard evidence to cite: keep it as a hunch so nothing leaks.
        return pick([
            `Something feels off about ${target.name}. I'm voting no.`,
            `Rejecting. I can't put my finger on it, but I don't like this mix.`,
            `Not this team. Call it a gut feeling about ${target.name}.`,
        ]);
    }

    // APPROVE
    const trusted = cleanest(teammates, scores);
    const trustedFact = trusted
        ? (facts.get(trusted.id) ?? []).filter((f) => f.weight < 0)[0]
        : undefined;
    if (trusted && trustedFact) {
        return pick([
            `Approving — ${trusted.name} ${trustedFact.text}, that's good enough for me.`,
            `Yes from me. ${trusted.name} ${trustedFact.text}; I'll back this group.`,
        ]);
    }
    if (isEvil) {
        // Cover story: sound like a trusting Good player.
        return pick([
            `This group looks fine to me. Approving.`,
            `No reason to doubt anyone here — I'm in.`,
            `Approving. We need to make progress.`,
        ]);
    }
    return pick([
        `No red flags for me. Approving.`,
        `I'm giving this team the benefit of the doubt.`,
        `Approving — nothing in the record against these knights.`,
    ]);
}

export function composeTeamSelectionThought(
    bot: Player,
    gameState: GameState,
    teamIds: string[],
): string | null {
    const chosen = gameState.players.filter(
        (p) => teamIds.includes(p.id) && p.id !== bot.id,
    );
    if (chosen.length === 0) return null;

    const scores = buildSuspicionScores(gameState);
    const facts = getPublicFacts(gameState);
    const names = chosen.map((p) => p.name).join(' and ');
    const anchor = cleanest(chosen, scores);
    const anchorFact = anchor
        ? (facts.get(anchor.id) ?? []).filter((f) => f.weight < 0)[0]
        : undefined;

    if (anchor && anchorFact) {
        return pick([
            `I'm taking ${names} — ${anchor.name} ${anchorFact.text}.`,
            `${names} it is. ${anchor.name} ${anchorFact.text}, so I trust them.`,
        ]);
    }
    return pick([
        `Going with ${names} — cleanest records I can see so far.`,
        `I'll take ${names}. Nobody's given me a reason to doubt them yet.`,
        `${names} — that's my pick. Judge me by the result.`,
    ]);
}

export function composeAssassinationThought(
    bot: Player,
    gameState: GameState,
    targetId: string,
): string | null {
    const target = gameState.players.find((p) => p.id === targetId);
    if (!target) return null;
    return pick([
        `It has to be ${target.name}. They always knew which teams to trust.`,
        `${target.name}. Nobody plays that cleanly without seeing the board.`,
        `My blade finds ${target.name} — they steered every vote just right.`,
    ]);
}

function rephrasePrompt(bot: Player, persona: BotPersona): string {
    const style = {
        easy: 'excitable and casual, maybe an exclamation mark',
        medium: 'thoughtful and measured',
        hard: 'terse and cold, as few words as possible',
    }[persona.difficulty];
    return `You are ${bot.name}, a player in a social deduction game. Rephrase the sentence you are given in your own voice (${style}).
Rules: ONE short sentence. Keep every name and every fact exactly. Add NO new information, roles, or accusations. No emojis, no quotes, no stage directions.`;
}

/**
 * Say the thought in chat, in-character. Uses the local LLM to phrase it in
 * the persona's voice when available; otherwise the scripted line is already
 * natural enough to send as-is.
 */
export function speakThought(
    bot: Player,
    persona: BotPersona,
    gameState: GameState,
    thought: string | null,
    gameService: IBotGameActions,
    delayMs: number,
): void {
    if (!thought) return;
    // Reasoning should be visible often — that's the point — but hard
    // personas stay characteristically quiet.
    const chance = Math.min(0.9, persona.chatFrequency + 0.35);
    if (Math.random() > chance) return;

    setTimeout(async () => {
        if (!gameState.roomCode) return;
        let text = thought;
        const llm = await ollamaClient.generate(
            rephrasePrompt(bot, persona),
            `Rephrase: "${thought}"`,
        );
        if (llm && llm.length > 2 && llm.length < 220) {
            text = llm.replace(/^["']|["']$/g, '');
        }
        gameService.handleSendMessage(bot.id, text);
    }, delayMs);
}

/**
 * Sanity guard used by tests: a spoken line must never contain hidden-role
 * vocabulary that could leak a bot's private knowledge.
 */
export function leaksHiddenInfo(bot: Player, gameState: GameState, line: string): boolean {
    const lower = line.toLowerCase();
    if (/(i'?m|i am)\s+(evil|a minion|the assassin|morgana|mordred|oberon|merlin)/.test(lower)) {
        return true;
    }
    // Naming a KNOWN evil teammate as evil would leak the bot's own alignment
    // (or Merlin's sight); composers never do this, but keep the guard hot.
    const knownEvil = getKnownEvil(bot, gameState.players);
    return knownEvil.some((p) =>
        new RegExp(`${p.name.toLowerCase()}[^.]{0,20}(is|as)\\s+(evil|the traitor)`).test(lower));
}
