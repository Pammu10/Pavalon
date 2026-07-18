# Pavalon voice chat E2E verification

Manual, opt-in end-to-end verification of Pavalon's LiveKit voice chat.
These scripts drive real headless Chromium browsers with fake microphone audio through a real LiveKit Cloud project, and assert that cross-client speaking indicators, self-mute, and local peer-mute all work from genuine WebRTC audio.

This is **not** wired into `npm test`, CI, or either app's `package.json`.
It needs real LiveKit Cloud credentials that CI does not have, so it can only ever be run by a human (or an agent acting on a human's behalf) against a real dev stack.

## Prerequisites

- `ffmpeg` installed and on `PATH` (used to synthesize the fake microphone audio at runtime).
- The Pavalon server running on port 3001 (`cd server && npm start`).
- The Pavalon client running on port 3000 (`cd client && npm run dev`).
- `server/.env` populated with real `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` values pointing at a real LiveKit Cloud project.
- The `ctest1`, `ctest2`, and `ctest3` test users already existing in the dev database, each with password `testpass123` (per project convention).
- A Chromium binary available for `playwright-core` to launch (see below).

These scripts do not start or stop the server or client.
That is on you, same as any other manual dev workflow.

## Install

```
cd e2e/voice
npm install
```

`npm install` only fetches `playwright-core`, it does not download a browser.
If you don't already have a Chromium binary that `playwright-core` can find (check with `node -e "console.log(require('playwright-core').chromium.executablePath())"`), install one:

```
npx playwright-core install chromium
```

If that's not possible in your environment (e.g. a locked-down machine), set `PLAYWRIGHT_CHROMIUM_PATH` to point at any existing Chromium or Chrome binary instead, and the scripts will use that.

## Run

Run both scripts back to back:

```
npm test
```

Or run either one individually:

```
node two-browser-test.js
node three-browser-test.js
```

Each script fails fast with a readable error (not a bare timeout) if `ffmpeg` is missing, the server or client isn't reachable, or the LiveKit env vars aren't set in `server/.env`.

### What a pass looks like

**`two-browser-test.js`** logs ctest1 and ctest2 in, has ctest1 host a room and ctest2 join it, then asserts, in order:

1. ctest1's speaking indicator lights up in ctest2's browser within 15 seconds (proves audio actually flows ctest1 to the LiveKit SFU to active-speaker detection to ctest2's UI).
2. ctest2's speaking indicator lights up in ctest1's browser within 15 seconds (same proof, the other direction).
3. After ctest1 toggles their microphone off, their speaking indicator disappears from ctest2's browser and stays gone for a 10 second observation window.
4. ctest2 can locally mute ctest1 in their own Player Volumes panel with no console errors.

Console output ends with `TWO-BROWSER TEST COMPLETE. All assertions passed.` on success, or `TEST FAILED: <reason>` with a non-zero exit code on failure.

**`three-browser-test.js`** has ctest1 host a room, ctest2 and ctest3 both join, and asserts that all three clients see a live speaking indicator for both of the other two participants within 15 seconds (six checks total).
This is the regression check for "voice breaks with more than two people", which was a real problem under the old P2P mesh; since voice now runs through a single LiveKit SFU room there is structurally no N-squared connection graph left to break, and this test corroborates that.

Console output ends with `THREE-BROWSER SMOKE TEST COMPLETE. All assertions passed...` on success.

Screenshots are written to the gitignored `.scratch/` directory at each assertion point, for debugging a failure.
They are not committed and not required reading for a normal pass.

## Gotcha: the 60 second reconnect timer

The server holds a disconnected player's seat open for 60 seconds before releasing it (`reconnectTimeout` in `server/config.ts`).
If you close a browser context without leaving the room first, and then quickly log back in as the same test user, the server can auto-rejoin you to the stale room instead of taking you to the home screen, which looks exactly like a test failure (a `Host New Game` button that never appears).

Both scripts in this directory click the room's "Leave" button before closing each browser context specifically to avoid this, and `npm test` runs the two scripts sequentially against the same `ctest1`/`ctest2` accounts relying on that.
If you interrupt a run (e.g. `Ctrl+C`) before it reaches that cleanup step, or you're running these scripts manually against test users already mid-run elsewhere, you may hit the 60 second window anyway.
If a script fails with a `Host New Game` timeout right after a previous run, either wait 60 seconds, or restart the server (`cd server && npm start`) to clear its in-memory room state, before trying again.

## Why the tone.wav is generated, not committed

`playwright-core`'s fake audio capture needs an actual WAV file to play as the "microphone".
A plain sine tone does not work: Chrome's default `noiseSuppression` (which `livekit-client` requests for microphone tracks) treats a constant, unvarying tone as stationary noise and silently gates it out after 1-2 seconds, which stops `ActiveSpeakersChanged` from firing and makes the speaking-indicator assertions hang or fail.
The scripts generate a vibrato+tremolo modulated tone instead, which noise suppression doesn't gate out:

```
ffmpeg -f lavfi -i "sine=frequency=220:duration=60" -af "vibrato=f=5:d=0.9,tremolo=f=4:d=0.8" -ar 48000 -ac 1 tone.wav
```

This is generated once per `.scratch/` directory (deleted and regenerated automatically if missing), so the 5+ MB WAV never has to live in the repo.
