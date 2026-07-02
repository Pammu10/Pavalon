import { describe, it, expect } from "vitest";
import { redactGameStateFor, computeVisibleAs } from "./redaction";
import {
  GameState,
  GamePhase,
  Player,
  Role,
  Alignment,
  Quest,
  DragonCardType,
} from "./types";
import { QUEST_CONFIGURATIONS } from "./constants";

// --- helpers ---------------------------------------------------------------

function makePlayer(id: string, role: Role, alignment: Alignment): Player {
  return {
    id,
    userId: Number(id.replace(/\D/g, "")) || 1,
    name: `Player ${id}`,
    role,
    alignment,
    isHost: id === "p1",
    hasVoted: false,
    status: "CONNECTED",
  };
}

// Standard 5-player setup: Merlin, Percival, Servant / Morgana, Assassin
function makeGame(phase: GamePhase = GamePhase.TEAM_SELECTION): GameState {
  const players = [
    makePlayer("p1", Role.MERLIN, Alignment.GOOD),
    makePlayer("p2", Role.PERCIVAL, Alignment.GOOD),
    makePlayer("p3", Role.LOYAL_SERVANT, Alignment.GOOD),
    makePlayer("p4", Role.MORGANA, Alignment.EVIL),
    makePlayer("p5", Role.ASSASSIN, Alignment.EVIL),
  ];
  const quest: Quest = {
    questNumber: 1,
    teamSize: 2,
    status: "ACTIVE",
    team: [players[0], players[3]],
    votes: [
      { playerId: "p1", vote: "APPROVE" },
      { playerId: "p4", vote: "REJECT" },
    ],
    results: [
      { playerId: "p4", vote: "FAIL" },
      { playerId: "p1", vote: "SUCCESS" },
    ],
    failsRequired: 1,
    questLeader: players[0],
    pastVotes: [
      {
        leader: players[1],
        team: [players[1], players[2]],
        votes: [{ playerId: "p3", vote: "REJECT" }],
      },
    ],
    approvedVote: {
      team: [players[0], players[3]],
      votes: [{ playerId: "p2", vote: "APPROVE" }],
    },
  };
  return {
    roomCode: "TEST01",
    players,
    phase,
    currentQuest: 1,
    questHistory: [quest],
    leader: players[3], // evil leader: their nested copy must be redacted too
    voteTrack: 0,
    winner: null,
    endGameReason: "",
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

const rolesVisibleTo = (state: GameState, exceptSelf: string) =>
  state.players.filter((p) => p.id !== exceptSelf && p.role !== null);

// --- role/alignment redaction ------------------------------------------------

describe("mid-game role redaction", () => {
  it("a Loyal Servant sees no other player's role or alignment", () => {
    const view = redactGameStateFor(makeGame(), "p3");
    expect(rolesVisibleTo(view, "p3")).toHaveLength(0);
    for (const p of view.players.filter((p) => p.id !== "p3")) {
      expect(p.alignment).toBeNull();
      expect(p.visibleAs).toBeUndefined();
    }
  });

  it("every player always sees their own role", () => {
    for (const id of ["p1", "p2", "p3", "p4", "p5"]) {
      const view = redactGameStateFor(makeGame(), id);
      const self = view.players.find((p) => p.id === id)!;
      expect(self.role).not.toBeNull();
      expect(self.alignment).not.toBeNull();
    }
  });

  it("Merlin sees evil players marked as Evil, but never their actual roles", () => {
    const view = redactGameStateFor(makeGame(), "p1");
    const morgana = view.players.find((p) => p.id === "p4")!;
    const assassin = view.players.find((p) => p.id === "p5")!;
    expect(morgana.visibleAs).toBe("Evil");
    expect(assassin.visibleAs).toBe("Evil");
    expect(morgana.role).toBeNull();
    expect(assassin.role).toBeNull();
    // and good players are unmarked
    expect(view.players.find((p) => p.id === "p2")!.visibleAs).toBeUndefined();
  });

  it("Merlin does NOT see Mordred", () => {
    const state = makeGame();
    state.players[4] = makePlayer("p5", Role.MORDRED, Alignment.EVIL);
    const view = redactGameStateFor(state, "p1");
    expect(view.players.find((p) => p.id === "p5")!.visibleAs).toBeUndefined();
  });

  it("Percival sees Merlin and Morgana as indistinguishable Mystics", () => {
    const view = redactGameStateFor(makeGame(), "p2");
    const merlin = view.players.find((p) => p.id === "p1")!;
    const morgana = view.players.find((p) => p.id === "p4")!;
    expect(merlin.visibleAs).toBe("Mystic");
    expect(morgana.visibleAs).toBe("Mystic");
    // The leak this refactor fixes: Percival must not know which is which.
    expect(merlin.role).toBeNull();
    expect(morgana.role).toBeNull();
    expect(merlin.alignment).toBeNull();
    expect(morgana.alignment).toBeNull();
  });

  it("evil players see each other, but not Oberon", () => {
    const state = makeGame();
    state.players.push(makePlayer("p6", Role.OBERON, Alignment.EVIL));
    const view = redactGameStateFor(state, "p5"); // Assassin's view
    expect(view.players.find((p) => p.id === "p4")!.visibleAs).toBe("Evil");
    expect(view.players.find((p) => p.id === "p6")!.visibleAs).toBeUndefined();
  });

  it("Oberon sees no one", () => {
    const state = makeGame();
    state.players.push(makePlayer("p6", Role.OBERON, Alignment.EVIL));
    const view = redactGameStateFor(state, "p6");
    expect(view.players.filter((p) => p.visibleAs)).toHaveLength(0);
  });

  it("redacts Player objects nested in leader and questHistory", () => {
    const view = redactGameStateFor(makeGame(), "p3");
    expect(view.leader!.role).toBeNull();
    const quest = view.questHistory[0];
    expect(quest.questLeader!.role).toBeNull();
    for (const p of quest.team) expect(p.role).toBeNull();
    for (const p of quest.pastVotes[0].team) expect(p.role).toBeNull();
    expect(quest.pastVotes[0].leader!.role).toBeNull();
    for (const p of quest.approvedVote!.team) expect(p.role).toBeNull();
  });

  it("reveals all roles at END_GAME", () => {
    const view = redactGameStateFor(makeGame(GamePhase.END_GAME), "p3");
    for (const p of view.players) expect(p.role).not.toBeNull();
  });

  it("keeps roles revealed during post-game DRAGONS_BREATH", () => {
    const view = redactGameStateFor(makeGame(GamePhase.DRAGONS_BREATH), "p3");
    for (const p of view.players) expect(p.role).not.toBeNull();
  });

  it("never mutates the input state", () => {
    const state = makeGame();
    const before = JSON.stringify(state);
    redactGameStateFor(state, "p3");
    expect(JSON.stringify(state)).toBe(before);
  });
});

// --- vote redaction ----------------------------------------------------------

describe("vote redaction", () => {
  it("hides in-progress team votes during TEAM_VOTE", () => {
    const view = redactGameStateFor(makeGame(GamePhase.TEAM_VOTE), "p3");
    expect(view.questHistory[0].votes).toHaveLength(0);
  });

  it("reveals team votes once voting has closed (they are public in Avalon)", () => {
    const view = redactGameStateFor(makeGame(GamePhase.QUEST_VOTE), "p3");
    // current quest's team votes are visible, results are not
    expect(view.questHistory[0].votes.length).toBeGreaterThan(0);
  });

  it("hides in-progress quest results during QUEST_VOTE", () => {
    const view = redactGameStateFor(makeGame(GamePhase.QUEST_VOTE), "p3");
    expect(view.questHistory[0].results).toHaveLength(0);
  });

  it("anonymizes quest results mid-game: tallies visible, identities not", () => {
    const view = redactGameStateFor(makeGame(GamePhase.QUEST_RESULT), "p3");
    const results = view.questHistory[0].results;
    expect(results).toHaveLength(2);
    expect(results.filter((r) => r.vote === "FAIL")).toHaveLength(1);
    for (const r of results) expect(r.playerId).toBe("");
  });

  it("restores quest result identities at END_GAME", () => {
    const view = redactGameStateFor(makeGame(GamePhase.END_GAME), "p3");
    const ids = view.questHistory[0].results.map((r) => r.playerId);
    expect(ids).toContain("p4");
    expect(ids).toContain("p1");
  });
});

// --- Dragon's Breath redaction -------------------------------------------------

describe("Dragon's Breath redaction", () => {
  function withDragonsBreath(state: GameState): GameState {
    state.phase = GamePhase.DRAGONS_BREATH;
    state.dragonsBreathState = {
      deck: [
        { id: "d1", type: DragonCardType.DRAGON_BREATH },
        { id: "d2", type: DragonCardType.SKIP },
      ],
      hands: {
        p1: [{ id: "h1", type: DragonCardType.DEFUSE }],
        p2: [
          { id: "h2", type: DragonCardType.ATTACK },
          { id: "h3", type: DragonCardType.SHUFFLE },
        ],
      },
      discardPile: [{ id: "disc1", type: DragonCardType.SKIP }],
      currentPlayerId: "p1",
      turnsToTake: 1,
      isViewingFuture: "p1",
      futureCards: [{ id: "f1", type: DragonCardType.DRAGON_BREATH }],
      isPlacingDragon: null,
      winner: null,
      loser: null,
    };
    return state;
  }

  it("a player sees their own hand but only the size of the opponent's", () => {
    const view = redactGameStateFor(withDragonsBreath(makeGame()), "p1");
    const db = view.dragonsBreathState!;
    expect(db.hands["p1"][0].type).toBe(DragonCardType.DEFUSE);
    expect(db.hands["p2"]).toHaveLength(2);
    for (const card of db.hands["p2"]) {
      expect(card.type).not.toBe(DragonCardType.ATTACK);
      expect(card.type).not.toBe(DragonCardType.SHUFFLE);
    }
  });

  it("masks deck contents but preserves deck size", () => {
    const view = redactGameStateFor(withDragonsBreath(makeGame()), "p2");
    const db = view.dragonsBreathState!;
    expect(db.deck).toHaveLength(2);
    for (const card of db.deck) {
      expect(card.type).not.toBe(DragonCardType.DRAGON_BREATH);
      expect(card.type).not.toBe(DragonCardType.SKIP);
    }
  });

  it("only the viewing player receives future cards", () => {
    const state = withDragonsBreath(makeGame());
    const viewerView = redactGameStateFor(state, "p1");
    const otherView = redactGameStateFor(state, "p2");
    expect(viewerView.dragonsBreathState!.futureCards).toHaveLength(1);
    expect(otherView.dragonsBreathState!.futureCards).toHaveLength(0);
  });

  it("leaves the public discard pile intact", () => {
    const view = redactGameStateFor(withDragonsBreath(makeGame()), "p2");
    expect(view.dragonsBreathState!.discardPile[0].type).toBe(
      DragonCardType.SKIP
    );
  });
});

// --- computeVisibleAs unit coverage -------------------------------------------

describe("computeVisibleAs", () => {
  const merlin = makePlayer("m", Role.MERLIN, Alignment.GOOD);
  const oberon = makePlayer("o", Role.OBERON, Alignment.EVIL);
  const minion = makePlayer("mi", Role.MINION, Alignment.EVIL);

  it("Merlin sees Oberon (Oberon is hidden from evil, not from Merlin)", () => {
    expect(computeVisibleAs(merlin, oberon)).toBe("Evil");
  });

  it("a player never has vision of themselves", () => {
    expect(computeVisibleAs(merlin, merlin)).toBeNull();
  });

  it("evil sees fellow evil", () => {
    expect(computeVisibleAs(minion, makePlayer("a", Role.ASSASSIN, Alignment.EVIL))).toBe("Evil");
  });
});

// --- quest configuration rules -------------------------------------------------

describe("quest configurations (Avalon rules)", () => {
  it("the 4th quest requires two fails at 7+ players, one fail below", () => {
    for (const count of [5, 6]) {
      expect(QUEST_CONFIGURATIONS[count][3].failsRequired).toBe(1);
    }
    for (const count of [7, 8, 9, 10]) {
      expect(QUEST_CONFIGURATIONS[count][3].failsRequired).toBe(2);
    }
  });

  it("all other quests require exactly one fail", () => {
    for (const count of [5, 6, 7, 8, 9, 10]) {
      for (const questIdx of [0, 1, 2, 4]) {
        expect(QUEST_CONFIGURATIONS[count][questIdx].failsRequired).toBe(1);
      }
    }
  });

  it("every player count defines exactly five quests", () => {
    for (const count of [5, 6, 7, 8, 9, 10]) {
      expect(QUEST_CONFIGURATIONS[count]).toHaveLength(5);
    }
  });
});
