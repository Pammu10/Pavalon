// Shared helpers for the Pavalon LiveKit voice E2E scripts.
//
// These scripts are manual/opt-in: they talk to a real LiveKit Cloud
// project and assume a human already has the server (port 3001) and
// client (port 3000) running locally. See ../README.md for the full
// prerequisites and gotchas before running anything in this directory.

const { chromium } = require('playwright-core');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execFileAsync = util.promisify(execFile);

const ROOT = path.join(__dirname, '..');
const SCRATCH = path.join(ROOT, '.scratch');
const TONE_WAV = path.join(SCRATCH, 'tone.wav');
const SERVER_ENV_PATH = path.join(ROOT, '..', '..', 'server', '.env');

const BASE_URL = process.env.PAVALON_CLIENT_URL || 'http://localhost:3000';
const API_URL = process.env.PAVALON_SERVER_URL || 'http://localhost:3001';

const TEST_PASSWORD = 'testpass123';

class PreflightError extends Error {}

/**
 * Fail fast with a clear message instead of a cryptic timeout if the
 * environment isn't ready to run a real LiveKit voice test:
 *   - ffmpeg must be installed (used to synthesize the fake mic audio).
 *   - the Pavalon server and client must already be running.
 *   - server/.env must have real LiveKit Cloud credentials configured.
 */
async function preflight() {
  const problems = [];

  try {
    await execFileAsync('ffmpeg', ['-version']);
  } catch {
    problems.push(
      'ffmpeg is not installed or not on PATH. It is required to synthesize the ' +
        'fake microphone audio used by these tests. Install it (e.g. `apt install ffmpeg` ' +
        'or `brew install ffmpeg`) and try again.',
    );
  }

  try {
    const res = await fetch(API_URL);
    if (!res.ok && res.status >= 500) {
      problems.push(`Pavalon server at ${API_URL} responded with HTTP ${res.status}.`);
    }
  } catch {
    problems.push(
      `Pavalon server is not reachable at ${API_URL}. Start it first: ` +
        '`cd server && npm start`.',
    );
  }

  try {
    const res = await fetch(BASE_URL);
    if (!res.ok && res.status >= 500) {
      problems.push(`Pavalon client at ${BASE_URL} responded with HTTP ${res.status}.`);
    }
  } catch {
    problems.push(
      `Pavalon client is not reachable at ${BASE_URL}. Start it first: ` +
        '`cd client && npm run dev`.',
    );
  }

  const missingEnvVars = checkLiveKitEnvVars();
  if (missingEnvVars.length > 0) {
    problems.push(
      `server/.env is missing: ${missingEnvVars.join(', ')}. ` +
        'These must be set to a real LiveKit Cloud project for voice to work ' +
        '(this test can never run against fake/CI credentials).',
    );
  }

  if (problems.length > 0) {
    throw new PreflightError(
      'Preflight checks failed, refusing to start the test:\n' +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
  }
}

function checkLiveKitEnvVars() {
  const required = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
  if (!fs.existsSync(SERVER_ENV_PATH)) {
    return required;
  }
  const contents = fs.readFileSync(SERVER_ENV_PATH, 'utf8');
  return required.filter((name) => {
    const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return !match || match[1].trim() === '';
  });
}

/**
 * Generate the fake-microphone tone WAV into the gitignored scratch dir.
 *
 * This must NOT be a plain sine tone: Chrome's default noiseSuppression
 * (which livekit-client requests for mic tracks) treats a constant,
 * non-varying tone as stationary noise and gates it out after 1-2s of
 * ramp-up, which makes ActiveSpeakersChanged stop firing and the test
 * hang. Vibrato + tremolo modulation keeps it from looking "stationary".
 */
async function ensureToneWav() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  if (fs.existsSync(TONE_WAV)) {
    return TONE_WAV;
  }
  console.log('Generating fake-mic tone.wav via ffmpeg...');
  await execFileAsync('ffmpeg', [
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=220:duration=60',
    '-af',
    'vibrato=f=5:d=0.9,tremolo=f=4:d=0.8',
    '-ar',
    '48000',
    '-ac',
    '1',
    TONE_WAV,
  ]);
  return TONE_WAV;
}

/**
 * Resolve a Chromium executable for playwright-core to launch.
 *
 * playwright-core does not bundle a browser download; one must be
 * installed once per machine via `npx playwright-core install chromium`,
 * which places it in the shared ~/.cache/ms-playwright directory that
 * chromium.executablePath() finds automatically. If that's not
 * available, PLAYWRIGHT_CHROMIUM_PATH can point at any Chromium/Chrome
 * binary instead.
 */
function resolveChromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    if (!fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
      throw new PreflightError(
        `PLAYWRIGHT_CHROMIUM_PATH is set to ${process.env.PLAYWRIGHT_CHROMIUM_PATH} but that file does not exist.`,
      );
    }
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  let defaultPath;
  try {
    defaultPath = chromium.executablePath();
  } catch {
    defaultPath = null;
  }
  if (defaultPath && fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  throw new PreflightError(
    'No Chromium binary found for playwright-core to launch.\n' +
      '  Fix by running: npx playwright-core install chromium\n' +
      '  Or set PLAYWRIGHT_CHROMIUM_PATH to an existing Chromium/Chrome binary.',
  );
}

async function login(username, password = TEST_PASSWORD) {
  const res = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed for ${username}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Launch a headless, authenticated browser context with fake media
 * devices, feeding tone.wav in as the fake microphone capture.
 */
async function launchAuthedBrowser(name, userDataDir, authData, chromiumPath, toneWavPath) {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${toneWavPath}`,
  ];
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: chromiumPath,
    args,
    viewport: { width: 1400, height: 1000 },
  });
  const page = context.pages()[0] || (await context.newPage());
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[${name} console error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[${name} pageerror] ${err.message}`));
  await context.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('authToken', token);
      window.localStorage.setItem('user', JSON.stringify(user));
      window.sessionStorage.setItem('introCompleted', 'true');
      window.sessionStorage.setItem('pavalon_tutorial_prompt_shown', '1');
    },
    { token: authData.token, user: authData.user },
  );
  return { context, page };
}

/**
 * Explicitly leave the room (instead of just closing the browser) so the
 * server doesn't hold the player in its 60s reconnect grace window.
 * Without this, running the next script (or a second run) against the
 * same ctest* users right away can auto-rejoin the stale room instead of
 * landing on the home screen, which looks like a test failure.
 *
 * The "Leave" button lives in LobbyScreen, which only renders under the
 * page-level "Game" tab. If the script left the browser on the "Chat &
 * Log" tab (as both tests here do, to reach the Voice sub-tab), it has
 * to switch back to "Game" first or the Leave button won't be there.
 */
async function leaveAndClose({ context, page }) {
  try {
    const gameTab = page.locator('button[role="tab"]:has-text("Game")');
    if (await gameTab.count()) {
      await gameTab.first().click();
    }
    const leaveButton = page.locator('button:has-text("Leave")');
    await leaveButton.first().waitFor({ state: 'visible', timeout: 5000 });
    await leaveButton.first().click();
    // Confirm the leave actually landed us back on the home screen before
    // closing, so the server processes it instead of racing the context
    // teardown.
    await page.waitForSelector('button:has-text("Host New Game")', { timeout: 5000 });
  } catch (err) {
    console.log(`[leaveAndClose] could not confirm room leave, closing anyway: ${err.message}`);
  }
  await context.close();
}

module.exports = {
  PreflightError,
  BASE_URL,
  API_URL,
  SCRATCH,
  preflight,
  ensureToneWav,
  resolveChromiumPath,
  login,
  launchAuthedBrowser,
  leaveAndClose,
};
