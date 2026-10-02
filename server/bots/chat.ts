import { Player, GameState, Message } from '../types';
import { BotPersona, ChatTrigger, IBotGameActions } from './types';
import { ollamaClient, buildSystemPrompt, buildChatPrompt } from './llm';
import { cleanLlmLine, composeReply } from './thoughts';

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
 * Called when a human sends a chat message. At most one bot answers: the one
 * named, else (sometimes) a random one. LLM reply when available, otherwise a
 * scripted answer from public evidence; silence beats an off-topic line.
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
    const personaOf = (b: Player) => personas.find((p) => p.name === b.name);
    let bot = bots.find((b) => text.includes(b.name.toLowerCase()));
    if (!bot) {
        const candidate = bots[Math.floor(Math.random() * bots.length)];
        const chance = message.text.includes('?') ? 0.6 : (personaOf(candidate)?.chatFrequency ?? 0) * 0.3;
        if (!candidate || Math.random() >= chance) return;
        bot = candidate;
    }
    const persona = personaOf(bot);
    if (!persona) return;
    const responder = bot;

    setTimeout(async () => {
        if (!gameState.roomCode) return; // game over
        const llm = await ollamaClient.generate(
            buildSystemPrompt(responder, gameState, persona),
            buildChatPrompt(gameState, message),
        );
        const reply = cleanLlmLine(responder, gameState, llm)
            ?? composeReply(responder, gameState, message.text, message.senderId);
        if (reply) gameService.handleSendMessage(responder.id, reply);
    }, 1400 + Math.random() * 1200);
}
