import { Player, GameState, Message } from '../types';
import { BotPersona, ChatTrigger, IBotGameActions } from './types';
import { ollamaClient, buildSystemPrompt } from './llm';

export function maybeSendChat(
    persona: BotPersona,
    trigger: ChatTrigger,
    botId: string,
    gameService: IBotGameActions,
    contextName?: string,
    delayMs?: number,
): void {
    if (Math.random() > persona.chatFrequency) return;
    const pool = persona.chatPool[trigger];
    if (!pool?.length) return;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    const final = contextName ? msg.replace('{name}', contextName) : msg;
    setTimeout(() => gameService.handleSendMessage(botId, final), delayMs ?? 800);
}

/**
 * Called when a human sends a chat message.
 * Decides which bot (if any) should reply, then tries LLM → falls back to scripted.
 */
export async function handleIncomingChatMessage(
    message: Message,
    bots: Player[],
    gameState: GameState,
    personas: BotPersona[],
    gameService: IBotGameActions,
): Promise<void> {
    if (message.senderUserId < 0) return; // ignore bot messages

    const text = message.text.toLowerCase();
    const isQuestion = message.text.includes('?');

    for (const bot of bots) {
        const persona = personas.find((p) => p.name === bot.name);
        if (!persona) continue;

        const mentioned = text.includes(bot.name.toLowerCase());
        const shouldReply =
            mentioned ||
            (isQuestion && Math.random() < 0.5) ||
            Math.random() < persona.chatFrequency * 0.3;

        if (!shouldReply) continue;

        const delay = 1400 + bots.indexOf(bot) * 700 + Math.random() * 600;

        setTimeout(async () => {
            // Guard: don't reply if game is over
            if (!gameState.roomCode) return;

            const systemPrompt = buildSystemPrompt(bot, gameState, persona);
            const llmReply = await ollamaClient.generate(systemPrompt, message.text);

            if (llmReply) {
                gameService.handleSendMessage(bot.id, llmReply);
            } else {
                // Scripted fallback
                const trigger: ChatTrigger = (() => {
                    const quest = gameState.questHistory[gameState.currentQuest - 1];
                    if (quest?.team.some((p) => p.id === bot.id)) return 'on_the_team';
                    return 'not_on_team';
                })();
                maybeSendChat(persona, trigger, bot.id, gameService, message.senderName, 0);
            }
        }, delay);

        break; // only one bot replies per message
    }
}
