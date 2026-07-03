import { Player, GameState, Alignment } from '../types';
import { BotPersona } from './types';
import { getKnownEvil } from './decisions/knowledge';
import { logger } from '../logger';

const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'gemma2:2b';
const TIMEOUT_MS = 3500;

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
        return this.available ?? false;
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
            if (!res.ok) return null;
            const data = (await res.json()) as { response?: string };
            return data.response?.trim() ?? null;
        } catch {
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

    return `You are ${bot.name}, a player in Pavalon, a social deduction game similar to Avalon.
${alignmentContext}
${difficultyStyle}
Current game: Quest ${gameState.currentQuest}/5. ${passed} passed, ${failed} failed. You are ${onTeam ? 'ON' : 'NOT on'} the current quest team.
Rules: Keep reply to 1-2 sentences max. Sound like a real player chatting in a game. Never mention game mechanics by name. No emojis, no asterisks, no stage directions.`;
}
