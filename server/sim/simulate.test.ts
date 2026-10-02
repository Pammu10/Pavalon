import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mulberry32, runCell } from './simulate';

// Seeded, so deterministic. Guards the property the bots lost before:
// a higher difficulty must actually play better.
const GAMES = 400;
const goodWin = (c: ReturnType<typeof runCell>) => c.merlinSurvived / GAMES;

describe('bot difficulty ordering (7 players)', () => {
    const realRandom = Math.random;
    beforeAll(() => { Math.random = mulberry32(7); });
    afterAll(() => { Math.random = realRandom; });

    it('hard Good beats medium Good against hard Evil', () => {
        expect(goodWin(runCell(GAMES, 7, 'hard', 'hard'))).toBeGreaterThan(goodWin(runCell(GAMES, 7, 'medium', 'hard')) + 0.1);
    });

    it('hard Evil beats medium Evil against hard Good', () => {
        expect(goodWin(runCell(GAMES, 7, 'hard', 'hard'))).toBeLessThan(goodWin(runCell(GAMES, 7, 'hard', 'medium')) - 0.1);
    });

});
