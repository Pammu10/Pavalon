import {
  GameState,
  GamePhase,
  Player,
  Role,
  Alignment,
  Quest,
  DragonCard,
  DragonCardType,
} from "./types";

// Server-side source of truth for role visibility. Ports the rules previously
// computed client-side in client/hooks/usePlayerVision.ts, so that hidden
// information never leaves the server in the first place.

export type VisibleAs = "Evil" | "Mystic";

// What (if anything) does `viewer` know about `target` mid-game?
export function computeVisibleAs(
  viewer: Player,
  target: Player
): VisibleAs | null {
  if (viewer.id === target.id) return null;
  switch (viewer.role) {
    case Role.MERLIN:
      // Merlin sees all evil except Mordred.
      return target.alignment === Alignment.EVIL && target.role !== Role.MORDRED
        ? "Evil"
        : null;
    case Role.PERCIVAL:
      // Percival sees Merlin and Morgana, but must not know which is which.
      return target.role === Role.MERLIN || target.role === Role.MORGANA
        ? "Mystic"
        : null;
    case Role.MORGANA:
    case Role.ASSASSIN:
    case Role.MORDRED:
    case Role.MINION:
      // Evil (except Oberon) see each other, but not Oberon.
      return target.alignment === Alignment.EVIL && target.role !== Role.OBERON
        ? "Evil"
        : null;
    default:
      // Loyal Servants and Oberon see no one.
      return null;
  }
}

// A fresh, fully redacted copy of a player. Note: Player objects are shared
// by reference between gameState.players and nested structures (leader,
// quest.team, ...), so redaction must always REPLACE with copies rather than
// mutate in place.
function redactedCopy(p: Player): Player {
  const copy: Player = { ...p, role: null, alignment: null };
  delete copy.visibleAs;
  return copy;
}

function maskedCards(count: number, prefix: string): DragonCard[] {
  // Preserves array lengths (the client renders counts from .length) while
  // hiding card identities. "Hidden" is not a real DragonCardType; the client
  // never reads the type of masked cards.
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    type: "Hidden" as DragonCardType,
  }));
}

// Returns a deep copy of `gameState` containing only what the player behind
// `viewerId` is entitled to see. Never mutates the input.
export function redactGameStateFor(
  gameState: GameState,
  viewerId: string
): GameState {
  const state = structuredClone(gameState);
  // DRAGONS_BREATH is a post-game minigame reached from the end screen, so
  // roles from the concluded Avalon game are already public.
  const revealAll =
    state.phase === GamePhase.END_GAME ||
    state.phase === GamePhase.DRAGONS_BREATH;

  const viewer = gameState.players.find((p) => p.id === viewerId);

  if (!revealAll) {
    // players[]: keep the viewer's own role; mark what they know about others.
    state.players = state.players.map((p) => {
      if (p.id === viewerId) {
        const self = { ...p };
        delete self.visibleAs;
        return self;
      }
      const visibleAs = viewer ? computeVisibleAs(viewer, p) : null;
      const copy = redactedCopy(p);
      if (visibleAs) copy.visibleAs = visibleAs;
      return copy;
    });

    // Player objects nested elsewhere in the state carry roles too.
    if (state.leader) state.leader = redactedCopy(state.leader);
    for (const quest of state.questHistory) {
      redactQuestPlayers(quest);
    }
  }

  redactVotesInProgress(state);
  redactDragonsBreath(state, viewerId);

  return state;
}

function redactQuestPlayers(quest: Quest): void {
  if (quest.questLeader) quest.questLeader = redactedCopy(quest.questLeader);
  quest.team = quest.team.map(redactedCopy);
  for (const past of quest.pastVotes) {
    if (past.leader) past.leader = redactedCopy(past.leader);
    past.team = past.team.map(redactedCopy);
  }
  if (quest.approvedVote) {
    quest.approvedVote.team = quest.approvedVote.team.map(redactedCopy);
  }
}

function redactVotesInProgress(state: GameState): void {
  if (
    state.phase === GamePhase.END_GAME ||
    state.phase === GamePhase.DRAGONS_BREATH
  )
    return;
  const current = state.questHistory[state.currentQuest - 1];

  if (current && state.phase === GamePhase.TEAM_VOTE) {
    // Team votes are public in Avalon, but only revealed simultaneously.
    // Hide them while voting is still open. (Who has voted is already
    // conveyed by Player.hasVoted.)
    current.votes = [];
  }

  if (current && state.phase === GamePhase.QUEST_VOTE) {
    // Quest votes are secret while being cast.
    current.results = [];
  }

  // Once cast, only the tally of quest results is public — never who played
  // FAIL. Anonymize and sort so neither ids nor submission order leak.
  for (const quest of state.questHistory) {
    quest.results = quest.results
      .map((r) => ({ playerId: "", vote: r.vote }))
      .sort((a, b) => a.vote.localeCompare(b.vote));
  }
}

function redactDragonsBreath(state: GameState, viewerId: string): void {
  const db = state.dragonsBreathState;
  if (!db) return;

  // Opponents' hands: mask contents, preserve size.
  for (const playerId of Object.keys(db.hands)) {
    if (playerId !== viewerId) {
      db.hands[playerId] = maskedCards(db.hands[playerId].length, `hand-${playerId}`);
    }
  }

  // Deck order is hidden information; only its size is public.
  db.deck = maskedCards(db.deck.length, "deck");

  // Future cards are visible only to the player currently viewing them.
  if (db.isViewingFuture !== viewerId) {
    db.futureCards = [];
  }
}
