import { describe, it, expect } from 'vitest';
import { ALL_PERSONAS, selectPersonasForSlots, selectPersonaForLobby } from './personas';
import { resolveBotDifficulty } from './decisions/knowledge';
import { GameState, Player, BotDifficulty } from '../types';

const alignments = (n: number) =>
    Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'good' as const : 'evil' as const));

describe('selectPersonasForSlots', () => {
    it('never duplicates personas while unused ones remain, even across difficulties', () => {
        // hard has only 2 personas; 7 slots must borrow from other pools
        const picked = selectPersonasForSlots('hard', alignments(7));
        const names = picked.map((p) => p.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('prefers the requested difficulty first', () => {
        const picked = selectPersonasForSlots('medium', alignments(3));
        expect(picked.every((p) => p.difficulty === 'medium')).toBe(true);
    });
});

describe('selectPersonaForLobby', () => {
    it('prefers the requested difficulty', () => {
        const p = selectPersonaForLobby('hard', new Set());
        expect(p?.difficulty).toBe('hard');
    });

    it('falls back to other difficulties instead of duplicating names', () => {
        const hardNames = ALL_PERSONAS.filter((p) => p.difficulty === 'hard').map((p) => p.name);
        const p = selectPersonaForLobby('hard', new Set(hardNames));
        expect(p).not.toBeNull();
        expect(hardNames).not.toContain(p!.name);
    });

    it('returns null when every persona is taken', () => {
        const all = new Set(ALL_PERSONAS.map((p) => p.name));
        expect(selectPersonaForLobby('easy', all)).toBeNull();
    });
});

describe('resolveBotDifficulty', () => {
    const bot = (name: string): Player => ({
        id: 'cpu-x-1', userId: -101, name,
        role: null, alignment: null, isHost: false, hasVoted: false, status: 'CONNECTED',
    });
    const state = (cpuConfig: GameState['cpuConfig']): GameState =>
        ({ cpuConfig } as unknown as GameState);

    it("uses the bot's own persona difficulty when present", () => {
        const gs = state({
            difficulty: 'easy' as BotDifficulty,
            personas: [{ name: 'Cressida', difficulty: 'hard' as BotDifficulty }],
        });
        expect(resolveBotDifficulty(gs, bot('Cressida'))).toBe('hard');
    });

    it('falls back to the game-wide difficulty', () => {
        const gs = state({ difficulty: 'medium' as BotDifficulty, personas: [] });
        expect(resolveBotDifficulty(gs, bot('Unknown'))).toBe('medium');
    });

    it('defaults to easy without any cpuConfig', () => {
        expect(resolveBotDifficulty(state(null), bot('Anyone'))).toBe('easy');
    });
});
