// Headless bot-vs-bot Avalon simulator. Drives the real bot decision code
// through the same rules as gameService, minus sockets/timers/DB.
//
//   npx ts-node --transpile-only sim/simulate.ts [gamesPerCell=10000] [players=7] [seed=1]
//
// Prints a Good-difficulty x Evil-difficulty matrix: if hard Good doesn't beat
// easy Good against the same Evil, the "smarter" logic isn't helping.

import { Alignment, BotDifficulty, GameState, GamePhase, Player, Role } from '../types';
import { ROLES, ROLE_CONFIGURATIONS, QUEST_CONFIGURATIONS } from '../constants';
import { selectTeam } from '../bots/decisions/teamSelection';
import { decideTeamVote } from '../bots/decisions/teamVote';
import { decideQuestVote } from '../bots/decisions/questVote';
import { decideAssassination } from '../bots/decisions/assassination';

type EndReason = 'threeFails' | 'fiveRejects' | 'merlinKilled' | 'merlinSurvived';

// Bot code calls Math.random directly; a seeded PRNG makes runs reproducible.
export function mulberry32(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function playGame(playerCount: number, good: BotDifficulty, evil: BotDifficulty): EndReason {
    const roles = shuffle([...ROLE_CONFIGURATIONS[playerCount]]);
    // Bots never chat here, so speech-driven suspicion is absent.
    // ponytail: no chat/thoughts; port bots/thoughts.ts if chat-weighted suspicion matters.
    const players: Player[] = roles.map((role, i) => ({
        id: `p${i}`, userId: -101 - i, name: `Bot${i}`, role, alignment: ROLES[role].alignment,
        isHost: false, hasVoted: false, status: 'CONNECTED',
    }));
    const gs = {
        roomCode: 'SIM', players, phase: GamePhase.TEAM_SELECTION, currentQuest: 1,
        questHistory: QUEST_CONFIGURATIONS[playerCount].map((c, i) => ({
            questNumber: i + 1, teamSize: c.teamSize, failsRequired: c.failsRequired,
            status: i === 0 ? 'ACTIVE' : 'PENDING', team: [], votes: [], results: [],
            pastVotes: [], questLeader: null, approvedVote: null,
        })),
        leader: players[Math.floor(Math.random() * playerCount)],
        voteTrack: 0, chat: [],
        cpuConfig: {
            difficulty: 'easy',
            personas: players.map((p) => ({ name: p.name, difficulty: p.alignment === Alignment.GOOD ? good : evil })),
        },
    } as unknown as GameState;

    const nextLeader = () => {
        gs.leader = players[(players.indexOf(gs.leader!) + 1) % playerCount];
    };

    for (;;) {
        const quest = gs.questHistory[gs.currentQuest - 1];

        // Team selection + vote (gameService.handleSelectTeam / processTeamVote)
        const teamIds = selectTeam(gs.leader!, gs, quest.teamSize);
        quest.team = players.filter((p) => teamIds.includes(p.id));
        if (quest.team.length !== quest.teamSize) throw new Error(`bot proposed ${quest.team.length}/${quest.teamSize} players`);
        gs.phase = GamePhase.TEAM_VOTE;
        quest.votes = players.map((p) => ({ playerId: p.id, vote: decideTeamVote(p, gs) }));
        const approvals = quest.votes.filter((v) => v.vote === 'APPROVE').length;

        if (approvals <= playerCount / 2) {
            gs.voteTrack++;
            quest.pastVotes.push({ leader: gs.leader, team: quest.team, votes: quest.votes });
            quest.team = [];
            quest.votes = [];
            if (gs.voteTrack >= 5) return 'fiveRejects';
            nextLeader();
            gs.phase = GamePhase.TEAM_SELECTION;
            continue;
        }

        gs.voteTrack = 0;
        quest.questLeader = gs.leader;
        quest.approvedVote = { team: quest.team, votes: quest.votes };
        quest.votes = [];

        // Quest vote (Good can't fail — server rejects it)
        gs.phase = GamePhase.QUEST_VOTE;
        quest.results = quest.team.map((p) => ({
            playerId: p.id,
            vote: p.alignment === Alignment.GOOD ? 'SUCCESS' : decideQuestVote(p, gs),
        }));
        const fails = quest.results.filter((r) => r.vote === 'FAIL').length;
        quest.status = fails >= quest.failsRequired ? 'FAILED' : 'PASSED';

        // checkForGameOver
        const failed = gs.questHistory.filter((q) => q.status === 'FAILED').length;
        const passed = gs.questHistory.filter((q) => q.status === 'PASSED').length;
        if (failed >= 3) return 'threeFails';
        if (passed >= 3) {
            gs.phase = GamePhase.ASSASSINATION;
            const assassin = players.find((p) => p.role === Role.ASSASSIN)!;
            const target = decideAssassination(assassin, gs);
            return players.find((p) => p.id === target)?.role === Role.MERLIN ? 'merlinKilled' : 'merlinSurvived';
        }
        gs.currentQuest++;
        gs.questHistory[gs.currentQuest - 1].status = 'ACTIVE';
        nextLeader();
        gs.phase = GamePhase.TEAM_SELECTION;
    }
}

export function runCell(games: number, playerCount: number, good: BotDifficulty, evil: BotDifficulty): Record<EndReason, number> {
    const c: Record<EndReason, number> = { threeFails: 0, fiveRejects: 0, merlinKilled: 0, merlinSurvived: 0 };
    for (let i = 0; i < games; i++) c[playGame(playerCount, good, evil)]++;
    return c;
}

if (require.main === module) {
    const [games = 10000, playerCount = 7, seed = 1] = process.argv.slice(2).map(Number);
    if (!ROLE_CONFIGURATIONS[playerCount]) throw new Error('players must be 5-10');
    Math.random = mulberry32(seed);

    const levels: BotDifficulty[] = ['easy', 'medium', 'hard'];
    const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`.padStart(6);
    console.log(`${games} games per cell, ${playerCount} players, seed ${seed}\n`);
    console.log('good   evil   | Good win | 3 fails  5 rejects  Merlin hit  Merlin safe | assassin accuracy');

    const start = process.hrtime.bigint();
    for (const good of levels) {
        for (const evil of levels) {
            const c = runCell(games, playerCount, good, evil);
            const assassinations = c.merlinKilled + c.merlinSurvived;
            console.log(
                `${good.padEnd(6)} ${evil.padEnd(6)} |  ${pct(c.merlinSurvived, games)}  | ` +
                `${pct(c.threeFails, games)}   ${pct(c.fiveRejects, games)}     ${pct(c.merlinKilled, games)}      ${pct(c.merlinSurvived, games)}  | ` +
                `${assassinations ? pct(c.merlinKilled, assassinations) : '   n/a'}`,
            );
        }
    }
    const secs = Number(process.hrtime.bigint() - start) / 1e9;
    const goodCount = ROLE_CONFIGURATIONS[playerCount].filter((r) => ROLES[r].alignment === Alignment.GOOD).length;
    console.log(`\nRandom assassin baseline: ${pct(1, goodCount).trim()} (1 of ${goodCount} Good players)`);
    console.log(`${(9 * games).toLocaleString()} games in ${secs.toFixed(2)}s = ${Math.round((9 * games) / secs).toLocaleString()} games/sec`);
}
