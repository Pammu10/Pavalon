# Design: Bots in real games, tutorial audit, and priority bug fixes

Date: 2026-07-06
Branch: `major-refractor-test-claude`
Mode: autonomous run — decisions below were made from codebase evidence; each records its rationale so they can be revisited.

## Scope

1. **Bug 1 (top priority):** In a room with >1 player, nobody can leave — leaving or being kicked snaps the player back into the room ("auto reconnect kicking in").
2. **Bug 2 (top priority):** When quest results are announced, a victory-type sound is followed by a defeat-type sound.
3. **Bots in real games:** e.g. 3 humans + 2 bots in a normal (non-CPU) room.
4. **Tutorial system for new and returning players:** audit + fix; the system already exists.
5. **Code polish:** surgical fixes for defects found while reading the codebase.

## Bug 1 — leave/kick auto-rejoin

**Root cause (client):** `client/app/game/[roomCode]/page.tsx` has a deep-link effect: *"if I'm on `/game/XYZ` and have no room state, join XYZ."* It re-fires whenever `gameState.roomCode` becomes `null` while the page is still mounted — exactly what happens right after a leave/kick (`kicked` handler resets state; navigation to `/` hasn't unmounted the page yet). The rejoin succeeds whenever the room still exists, i.e. whenever ≥1 other player remains — matching the report. With 1 player the room is already deleted server-side, so the rejoin errors and the bug is invisible.

**Fix:** make the deep-link join one-shot per page mount (`useRef` guard). Once we have been in the room (or one join attempt was made), a `roomCode → null` transition routes home instead of re-joining. Also: if the single join attempt errors (room gone), route home instead of spinning forever.

**Secondary fixes in the same flow:**
- Tutorial rooms are named `TUTORIAL-<socketId>`; leaving the tutorial hits the same rejoin race (join of a deleted room → error toast + stuck spinner). The one-shot guard fixes this too.
- `handleKicked` toast says "You have been removed from the game." even for voluntary leaves; use neutral messaging for `You have left…` reasons.

## Bug 2 — conflicting result sounds

Sound inventory: quest reveal plays `quest-success`(good.mp3)/`quest-fail`(evil.mp3); game end plays `victory`(good_victory.mp3)/`defeat`(evil_victory.mp3). Defects found:

1. **Double end-game sound:** `EndGameScreen` plays the victory/defeat sting in its own effect *and* mounts `GameEndOverlay`, which plays it again. Fix: single owner — the screen keeps the BGM sequencing (stop → sting → lobby music); the overlay stops playing audio.
2. **Overlapping reveal overlays (bot games):** bots finish quest votes in ~1.5–3 s, so `QUEST_RESULT` arrives while the team-vote reveal is still animating; the committed code (`show={true}`) plays the quest sting on top of the vote reveal — a positive "team approved" moment chased by a fail sting reads exactly as "victory sound then defeat sound." Fix: when the phase reaches `QUEST_RESULT` (or the game ends), close/clear the team-vote reveal immediately and let the quest reveal own the screen. The working tree's deferral (`show={!teamVoteReveal}`) stays as a belt-and-braces guard.
3. **Stale reveal blocks next game:** if the game ends straight from a team vote (5th rejection), the captured reveal is never shown or cleared, and with the deferral it would suppress the next game's quest overlay. Clearing on phase transitions (END_GAME/LOBBY/ROLE_REVEAL) fixes this.
4. **Quest-result timing mismatch:** client auto-closes the reveal at 8.5 s but the server advances at 8.0 s, so `markQuestResultAsViewed` never fires (phase already moved) — a tab switch during the reveal replays the whole overlay+sound. Fix: client auto-close at 7.5 s.
5. **Compressed assassination (bot assassin):** quest 3 passes (triumphant sting) → 8 s later ASSASSINATION → bot kills in as little as 3.8 s → defeat sting. Raise the bot assassination delay floor so the phase is readable (≥ 8 s after the phase starts).

Verification: instrument `HTMLAudioElement.play` in a live browser session and observe the actual play sequence around quest results and game end.

## Bots in real games

Existing engine already keys off `player.userId < 0` and is driven by `broadcastState` — reuse it wholesale.

**Server:**
- New socket event `addBot(difficulty)`: host-only, LOBBY phase only, non-tutorial, `players.length < 10`. Creates a bot `Player` (`id: cpu-<room>-<n>`, unique negative `userId`) using a persona of the requested difficulty not already in the room (falls back to other difficulties before ever duplicating a name). Appends the persona to `gameState.cpuConfig.personas` so restarts reconstruct it and decisions know its difficulty.
- Removal: existing `kickPlayer` works for bots (no socket → no-op emits); also drop the persona from `cpuConfig`.
- **Per-bot difficulty:** decision modules currently read the game-wide `cpuConfig.difficulty`. Add `resolveBotDifficulty(gameState, bot)` (persona lookup by name → game difficulty → 'easy') and use it in teamVote/questVote/teamSelection/assassination.
- **Host & room lifecycle with bots:** host reassignment must prefer humans (a bot host can never start a game), and a room whose last human leaves/disconnects must be deleted even if bots remain. Applies to leave, kick, lobby-switch, and reconnect-timeout paths.
- **Reconnect resilience:** bot actions are swallowed while `reconnectingPlayer` is set, and `BotEngine.processedKeys` marks the phase as done — the game would hang after the human reconnects. Add `BotEngine.onPlayerReconnected(gameState)`: clear the room's processed keys and re-run `onPhaseChange` (all bot actions are idempotent-guarded).

**Client:**
- `addBot` in socket event types + `GameContext`.
- Lobby (host only, players < 10): difficulty segmented control + "Add Bot" button in the Players section. Kick buttons already render for bots.
- `PlayerTile`: small Bot chip for `userId < 0` so bots are recognizable everywhere.

**Non-goals:** bots never fill mid-game (join/leave during an active game), never count as humans for stats/achievements (already guarded by `userId > 0`), no Dragon's Breath bots.

## Tutorial (new + returning players)

Already implemented end-to-end: interactive server-driven TUTORIAL room (7 steps), home-screen prompt for new players and returning players (>60 days via `pavalon_tutorial_seen_at`), "How to Play" home button, Settings replay. Work here is an audit + fixes:
- Leaving/finishing the tutorial currently trips the Bug-1 rejoin race (see above) — fixed by the Bug-1 change.
- Verify the 7-step flow, highlights, and completion path live; fix whatever breaks.

## Polish list (each traces to a defect seen while reading)

- `handleStartCPUGame`: delete the misleading dead `assignRoles` call on a spread copy.
- `selectPersonasForSlots`: avoid duplicate personas (hard pool has 2; a 10-player hard game would clone names) by falling back across difficulty pools.
- `AudioContext.playSound`: remove the event-listener leak (whichever of ended/error doesn't fire stays attached forever).
- `checkForGameOver` stuck game: if a player is mid-reconnect when the 8 s timer fires, nothing ever re-schedules the phase advance; re-arm it after a successful reconnect.
- `forceCloseRoom`: emits to the non-uppercased room code.
- `.gitignore`: `client/tsconfig.tsbuildinfo`.

## Testing / verification

- Server: `npx tsc --noEmit` + `vitest run` (existing redaction tests) + new unit tests for persona selection & per-bot difficulty (pure functions).
- Client: `next build` type-checks the app.
- Live: run server + client; Playwright session covering — lobby leave & kick with 2+ players (Bug 1), tutorial enter/leave/finish, add-bots-to-lobby then play a quest (bots in real game), CPU game quest result with audio instrumentation (Bug 2).
