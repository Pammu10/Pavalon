import { describe, it, expect } from 'vitest';
import { Alignment, GameState, Player, Role } from '../../types';
import { decideAssassination } from './assassination';

const player = (i: number, role: Role): Player => ({
    id: `p${i}`, userId: -1 - i, name: `Bot${i}`, role,
    alignment: [Role.MORGANA, Role.ASSASSIN].includes(role) ? Alignment.EVIL : Alignment.GOOD,
    isHost: false, hasVoted: false, status: 'CONNECTED',
});

describe('hard assassination', () => {
    it("targets the player showing Merlin's tells", () => {
        const [merlin, percival, loyal, morgana, assassin] = [
            player(0, Role.MERLIN), player(1, Role.PERCIVAL), player(2, Role.LOYAL_SERVANT),
            player(3, Role.MORGANA), player(4, Role.ASSASSIN),
        ];
        const votes = (approvers: Player[]) => [merlin, percival, loyal, morgana, assassin]
            .map((p) => ({ playerId: p.id, vote: approvers.includes(p) ? 'APPROVE' as const : 'REJECT' as const }));
        const gs = {
            players: [merlin, percival, loyal, morgana, assassin],
            chat: [],
            cpuConfig: { difficulty: 'hard', personas: [{ name: assassin.name, difficulty: 'hard' }] },
            questHistory: [{
                // Loyal proposed a team carrying Morgana; Merlin voted it down...
                pastVotes: [{ leader: loyal, team: [loyal, morgana], votes: votes([percival, loyal, morgana]) }],
                // ...then led a clean team that passed.
                questLeader: merlin,
                approvedVote: { team: [merlin, percival], votes: votes([merlin, percival, loyal, morgana, assassin]) },
                team: [merlin, percival], status: 'PASSED',
            }],
        } as unknown as GameState;

        expect(decideAssassination(assassin, gs)).toBe(merlin.id);
    });
});
