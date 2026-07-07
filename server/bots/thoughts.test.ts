import { describe, it, expect } from 'vitest';
import { GameState, GamePhase, Player, Role, Alignment } from '../types';
import {
    buildSuspicionScores,
    getPublicFacts,
    topSuspicionFact,
} from './decisions/knowledge';
import {
    composeAssassinationThought,
    composeTeamSelectionThought,
    composeTeamVoteThought,
    leaksHiddenInfo,
} from './thoughts';

const player = (id: string, name: string, role: Role, alignment: Alignment): Player => ({
    id, userId: id.startsWith('cpu') ? -1 : 1, name, role, alignment,
    isHost: false, hasVoted: false, status: 'CONNECTED',
});

// 5-player game: Quest 1 failed with Rupert+Alice aboard (led by Rupert),
// Quest 2 passed with Bob+Carol+Dave after Alice rejected the passing team.
function fixture(): GameState {
    const rupert = player('cpu-1', 'Rupert', Role.ASSASSIN, Alignment.EVIL);
    const alice = player('p-alice', 'Alice', Role.MORGANA, Alignment.EVIL);
    const bob = player('p-bob', 'Bob', Role.MERLIN, Alignment.GOOD);
    const carol = player('cpu-2', 'Carol', Role.LOYAL_SERVANT, Alignment.GOOD);
    const dave = player('p-dave', 'Dave', Role.PERCIVAL, Alignment.GOOD);
    const players = [rupert, alice, bob, carol, dave];

    return {
        roomCode: 'TEST42',
        players,
        phase: GamePhase.TEAM_VOTE,
        currentQuest: 3,
        questHistory: [
            {
                questNumber: 1, teamSize: 2, status: 'FAILED',
                team: [rupert, alice], votes: [], results: [],
                failsRequired: 1, questLeader: rupert, pastVotes: [], approvedVote: null,
            },
            {
                questNumber: 2, teamSize: 3, status: 'PASSED',
                team: [bob, carol, dave], votes: [], results: [],
                failsRequired: 1, questLeader: bob,
                pastVotes: [
                    {
                        leader: carol,
                        team: [bob, carol, dave],
                        votes: [{ playerId: 'p-alice', vote: 'REJECT' }],
                    },
                ],
                approvedVote: null,
            },
            {
                questNumber: 3, teamSize: 2, status: 'ACTIVE',
                team: [rupert, bob], votes: [], results: [],
                failsRequired: 1, questLeader: null, pastVotes: [], approvedVote: null,
            },
        ],
        leader: bob,
        voteTrack: 0,
        winner: null,
        endGameReason: '',
        chat: [],
        gameLog: [],
        readyPlayers: [],
        endGameReadyPlayers: [],
        reconnectingPlayer: null,
        restartVote: null,
        lastRestartInitiatedAt: null,
        pendingTeam: null,
        dragonsBreathState: null,
        assassinationTargetId: null,
        selectedRoles: [],
    };
}

describe('public facts & suspicion', () => {
    it('scores failed-quest members above clean players', () => {
        const gs = fixture();
        const scores = buildSuspicionScores(gs);
        expect(scores.get('cpu-1')!).toBeGreaterThan(scores.get('cpu-2') ?? 0);
        expect(scores.get('p-alice')!).toBeGreaterThan(scores.get('p-dave') ?? 0);
    });

    it("bot chat shapes other bots' suspicion, at lower weight than human chat", () => {
        const base = buildSuspicionScores(fixture()).get('p-dave') ?? 0;

        const botAccused = fixture();
        botAccused.chat = [{
            senderId: 'cpu-2', senderUserId: -1, senderName: 'Carol',
            text: "I'm rejecting this — Dave was on Quest 1 when it failed.",
        }];
        const afterBot = buildSuspicionScores(botAccused).get('p-dave') ?? 0;
        expect(afterBot).toBeGreaterThan(base);

        const humanAccused = fixture();
        humanAccused.chat = [{
            senderId: 'p-bob', senderUserId: 1, senderName: 'Bob',
            text: "I'm rejecting this — Dave was on Quest 1 when it failed.",
        }];
        const afterHuman = buildSuspicionScores(humanAccused).get('p-dave') ?? 0;
        expect(afterHuman).toBeGreaterThan(afterBot);

        const botVouched = fixture();
        botVouched.chat = [{
            senderId: 'cpu-2', senderUserId: -1, senderName: 'Carol',
            text: 'Approving — Dave helped pass Quest 2, that\'s good enough for me.',
        }];
        expect(buildSuspicionScores(botVouched).get('p-dave') ?? 0).toBeLessThan(base);
    });

    it('produces citable facts for quest outcomes', () => {
        const facts = getPublicFacts(fixture());
        expect(topSuspicionFact(facts, 'cpu-1')!.text).toContain('Quest 1 when it failed');
        // Rupert also led the failed quest
        expect(facts.get('cpu-1')!.some((f) => f.text.includes('picked the team'))).toBe(true);
        // Alice rejected the team that passed Quest 2
        expect(facts.get('p-alice')!.some((f) => f.text.includes('went on to pass'))).toBe(true);
        // Carol helped pass Quest 2 (trust fact, negative weight)
        expect(facts.get('cpu-2')!.some((f) => f.weight < 0)).toBe(true);
    });
});

describe('spoken thoughts', () => {
    it('a good bot rejecting cites the public evidence against Rupert', () => {
        const gs = fixture();
        const carol = gs.players.find((p) => p.name === 'Carol')!;
        const thought = composeTeamVoteThought(carol, gs, 'REJECT')!;
        expect(thought).toContain('Rupert');
        expect(thought).toMatch(/failed|feels off|gut feeling|don't like/);
        expect(leaksHiddenInfo(carol, gs, thought)).toBe(false);
    });

    it("an evil bot's approve reads like a loyal player and never leaks", () => {
        const gs = fixture();
        // Team for quest 3 contains Rupert himself and Bob
        const rupert = gs.players.find((p) => p.name === 'Rupert')!;
        for (let i = 0; i < 25; i++) {
            const thought = composeTeamVoteThought(rupert, gs, 'APPROVE');
            if (!thought) continue;
            expect(leaksHiddenInfo(rupert, gs, thought)).toBe(false);
            expect(thought.toLowerCase()).not.toContain('evil');
            expect(thought.toLowerCase()).not.toContain('ally');
        }
    });

    it('team selection thought names the chosen players', () => {
        const gs = fixture();
        const bob = gs.players.find((p) => p.name === 'Bob')!;
        const thought = composeTeamSelectionThought(bob, gs, ['p-bob', 'cpu-2', 'p-dave'])!;
        expect(thought).toContain('Carol');
        expect(thought).toContain('Dave');
        expect(leaksHiddenInfo(bob, gs, thought)).toBe(false);
    });

    it('assassination thought names the target', () => {
        const gs = fixture();
        const rupert = gs.players.find((p) => p.name === 'Rupert')!;
        const thought = composeAssassinationThought(rupert, gs, 'p-bob')!;
        expect(thought).toContain('Bob');
    });

    it('leak guard catches explicit role reveals', () => {
        const gs = fixture();
        const rupert = gs.players.find((p) => p.name === 'Rupert')!;
        expect(leaksHiddenInfo(rupert, gs, "I'm evil and proud")).toBe(true);
        expect(leaksHiddenInfo(rupert, gs, 'Alice is evil, trust me')).toBe(true);
        expect(leaksHiddenInfo(rupert, gs, 'Alice was on the failed quest')).toBe(false);
    });
});
