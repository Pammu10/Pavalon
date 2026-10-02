import { Player, GameState, Alignment, Message } from '../types';
import { BotPersona } from './types';
import { getKnownEvil, buildSuspicionScores, getPublicFacts, topSuspicionFact } from './decisions/knowledge';
import { logger } from '../logger';

const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b-instruct';
const TIMEOUT_MS = 6000;

class OllamaClient {
    private available: boolean | null = null;

    async probe(): Promise<boolean> {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
                signal: AbortSignal.timeout(2000),
            });
            this.available = res.ok;
        } catch {
            this.available = false;
        }
        logger.info(`[BotEngine] Ollama ${this.available ? `available at ${OLLAMA_BASE} (model: ${MODEL})` : `not available at ${OLLAMA_BASE} — using scripted chat`}`);

        if (this.available) this.warmup();
        return this.available ?? false;
    }

    /** Fire-and-forget: loads the model into memory now so the first real chat reply isn't hit with cold-start latency. */
    private warmup(): void {
        fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 7B cold load takes ~22s on the 6GB laptop GPU — keep headroom.
            body: JSON.stringify({ model: MODEL, prompt: 'hi', stream: false, options: { num_predict: 1 } }),
            signal: AbortSignal.timeout(60000),
        })
            .then((res) => logger.info(`[BotEngine] Ollama model ${MODEL} warmed up (${res.ok ? 'ok' : res.status})`))
            .catch((e) => logger.warn(`[BotEngine] Ollama warmup failed: ${e}`));
    }

    async generate(systemPrompt: string, userMessage: string): Promise<string | null> {
        if (!this.available) return null;
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: MODEL,
                    system: systemPrompt,
                    prompt: userMessage,
                    stream: false,
                    options: { num_predict: 80, temperature: 0.8 },
                }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!res.ok) {
                logger.error(`[BotEngine] Ollama generate failed: ${res.status} ${res.statusText} (model: ${MODEL})`);
                return null;
            }
            const data = (await res.json()) as { response?: string };
            return data.response?.trim() ?? null;
        } catch (e) {
            logger.error(`[BotEngine] Ollama generate error: ${e}`);
            return null;
        }
    }
}

export const ollamaClient = new OllamaClient();

export function buildSystemPrompt(bot: Player, gameState: GameState, persona: BotPersona): string {
    const quest = gameState.questHistory[gameState.currentQuest - 1];
    const passed = gameState.questHistory.filter((q) => q.status === 'PASSED').length;
    const failed = gameState.questHistory.filter((q) => q.status === 'FAILED').length;
    const onTeam = quest?.team.some((p) => p.id === bot.id) ?? false;

    const alignmentContext =
        bot.alignment === Alignment.GOOD
            ? 'You are a loyal Good knight. You genuinely want to help Good win.'
            : 'You are secretly Evil, but you MUST pretend to be a loyal Good knight. Never reveal or hint at your true alignment.';

    const difficultyStyle = {
        easy: "You're enthusiastic, emotional, and somewhat naive. Use casual language. React strongly.",
        medium: "You're thoughtful and analytical. Make brief observations. Occasionally be slightly suspicious of others.",
        hard: "You're an expert player. Be terse and strategic. One sentence max. Never show strong emotion.",
    }[persona.difficulty];

    // Public record only — the model must never see hidden roles or Merlin's sight.
    const record = gameState.questHistory
        .filter((q) => q.status === 'PASSED' || q.status === 'FAILED')
        .map((q) => {
            const fails = q.results.filter((r) => r.vote === 'FAIL').length;
            return `Quest ${q.questNumber}: ${q.questLeader?.name ?? 'someone'} picked ${q.team.map((p) => p.name).join(', ')}; it ${q.status === 'PASSED' ? 'passed' : `failed (${fails} fail vote${fails === 1 ? '' : 's'})`}.`;
        });
    const scores = buildSuspicionScores(gameState);
    const facts = getPublicFacts(gameState);
    const suspect = gameState.players
        .filter((p) => p.id !== bot.id)
        .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))[0];
    const suspectFact = suspect && topSuspicionFact(facts, suspect.id);

    return `You are ${bot.name}, a player in Pavalon, a social deduction game similar to Avalon.
${alignmentContext}
${difficultyStyle}
Players: ${gameState.players.map((p) => p.name).join(', ')}.
Current game: Quest ${gameState.currentQuest}/5. ${passed} passed, ${failed} failed. You are ${onTeam ? 'ON' : 'NOT on'} the current quest team${quest?.team.length ? ` (${quest.team.map((p) => p.name).join(', ')})` : ''}.
What everyone has seen so far:
${record.length ? record.join('\n') : 'No quests played yet.'}
${suspectFact ? `Your current read: ${suspect.name} looks worst, they ${suspectFact.text}.` : 'Your current read: no one stands out yet.'}
Rules: Reply with ONE short line, 1-2 sentences. Only cite facts listed above; never invent events. Never claim or reveal a role. Sound like a real player chatting. No emojis, no asterisks, no stage directions, no name prefix.`;
}

/** The user turn for a chat reply: recent conversation, then who to answer. */
export function buildChatPrompt(gameState: GameState, message: Message): string {
    const recent = gameState.chat.slice(-8).map((m) => `${m.senderName}: ${m.text}`).join('\n');
    return `Recent chat:\n${recent}\n\nReply to ${message.senderName}'s last message.`;
}
