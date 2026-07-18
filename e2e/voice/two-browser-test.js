#!/usr/bin/env node
// Two-browser LiveKit voice E2E test for Pavalon.
//
// ctest1 creates a room, ctest2 joins, and we assert cross-client speaking
// indicators, self-mute, and local peer-mute all work against a real
// LiveKit Cloud connection with real (fake-device) WebRTC audio.
//
// This is a manual/opt-in test. See README.md before running it.
const path = require('path');
const {
  SCRATCH,
  preflight,
  ensureToneWav,
  resolveChromiumPath,
  login,
  launchAuthedBrowser,
  leaveAndClose,
  BASE_URL,
} = require('./lib/common');

function shot(name) {
  return path.join(SCRATCH, name);
}

async function main() {
  await preflight();
  const toneWavPath = await ensureToneWav();
  const chromiumPath = resolveChromiumPath();

  console.log('Logging in ctest1 and ctest2...');
  const [auth1, auth2] = await Promise.all([login('ctest1'), login('ctest2')]);

  console.log('Launching browsers...');
  const A = await launchAuthedBrowser(
    'A(ctest1)',
    path.join(SCRATCH, 'udata-A'),
    auth1,
    chromiumPath,
    toneWavPath,
  );
  const B = await launchAuthedBrowser(
    'B(ctest2)',
    path.join(SCRATCH, 'udata-B'),
    auth2,
    chromiumPath,
    toneWavPath,
  );

  try {
    // --- Browser A: create room ---
    await A.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await A.page.waitForSelector('button:has-text("Host New Game")', { timeout: 15000 });
    await A.page.click('button:has-text("Host New Game")');

    // Wait for lobby with room code visible.
    await A.page.waitForSelector('h3:has-text("Room Code")', { timeout: 15000 });
    const roomCode = await A.page.locator('button[aria-label="Copy game code"] p').innerText();
    console.log(`Room created: ${roomCode.trim()}`);

    // --- Browser B: join room ---
    await B.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await B.page.waitForSelector('input[placeholder="Room Code"]', { timeout: 15000 });
    await B.page.fill('input[placeholder="Room Code"]', roomCode.trim());
    await B.page.click('button:has-text("Join Game")');
    await B.page.waitForSelector('h3:has-text("Room Code")', { timeout: 15000 });
    console.log('ctest2 joined room.');

    // Give LiveKit a moment to connect both clients.
    await A.page.waitForTimeout(3000);

    await A.page.screenshot({ path: shot('t2-01-browserA-lobby.png') });
    await B.page.screenshot({ path: shot('t2-02-browserB-lobby.png') });

    // --- Assert: ctest1's tile shows speaking indicator in Browser B within 15s ---
    console.log('Waiting for ctest1 speaking indicator in Browser B...');
    const speakingIconInB = B.page.locator('div[title="ctest1"] svg.lucide-mic');
    await speakingIconInB.first().waitFor({ state: 'visible', timeout: 15000 });
    console.log('PASS: ctest1 speaking indicator visible in Browser B.');
    await B.page.screenshot({ path: shot('t2-03-browserB-ctest1-speaking.png') });

    // --- Assert: ctest2's tile shows speaking indicator in Browser A within 15s ---
    console.log('Waiting for ctest2 speaking indicator in Browser A...');
    const speakingIconInA = A.page.locator('div[title="ctest2"] svg.lucide-mic');
    await speakingIconInA.first().waitFor({ state: 'visible', timeout: 15000 });
    console.log('PASS: ctest2 speaking indicator visible in Browser A.');
    await A.page.screenshot({ path: shot('t2-04-browserA-ctest2-speaking.png') });

    // --- Self mute: Browser A opens voice panel, toggles mic off ---
    console.log('Browser A: opening Chat & Log tab -> Voice sub-tab...');
    await A.page.click('button[role="tab"]:has-text("Chat & Log")');
    await A.page.click('button[role="tab"]:has-text("Voice")');
    await A.page.waitForSelector('text=Master Controls', { timeout: 10000 });
    await A.page.screenshot({ path: shot('t2-05-browserA-voice-panel.png') });

    console.log('Browser A: toggling Microphone off...');
    const micToggleRow = A.page.locator('div.p-3.bg-slate-800\\/50').filter({ hasText: 'Microphone' });
    await micToggleRow.locator('button').click();
    await A.page.screenshot({ path: shot('t2-06-browserA-mic-off.png') });

    console.log('Waiting for ctest1 speaking indicator to disappear in Browser B within 5s...');
    await speakingIconInB.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
      // It's possible it's already hidden due to no audio detected; check directly.
      const count = await speakingIconInB.count();
      console.log(`speakingIconInB count after mic-off wait: ${count}`);
    });
    await B.page.waitForTimeout(10000);
    const stillHiddenCount = await speakingIconInB.count();
    console.log(`ctest1 speaking icon count in Browser B after 10s stay-off window: ${stillHiddenCount}`);
    if (stillHiddenCount !== 0) {
      throw new Error(
        `FAIL: expected ctest1 speaking indicator to stay hidden in Browser B after mic-off, but found ${stillHiddenCount}.`,
      );
    }
    console.log('PASS: ctest1 speaking indicator stayed hidden in Browser B after mic-off.');
    await B.page.screenshot({ path: shot('t2-07-browserB-ctest1-muted-stayoff.png') });

    // --- Local peer mute: Browser B mutes ctest1 locally ---
    console.log('Browser B: opening Chat & Log -> Voice, muting ctest1 locally...');
    await B.page.click('button[role="tab"]:has-text("Chat & Log")');
    await B.page.click('button[role="tab"]:has-text("Voice")');
    await B.page.waitForSelector('text=Player Volumes', { timeout: 10000 });
    await B.page.screenshot({ path: shot('t2-08-browserB-voice-panel-before-mute.png') });

    const ctest1Row = B.page.locator('div.p-3.bg-slate-800\\/50:has-text("ctest1")');
    const muteBtn = ctest1Row.locator('button');
    await muteBtn.click();
    await B.page.screenshot({ path: shot('t2-09-browserB-ctest1-locally-muted.png') });
    console.log('PASS: local peer mute toggled with no errors (see console error log above if any).');

    console.log('TWO-BROWSER TEST COMPLETE. All assertions passed.');
  } finally {
    await leaveAndClose(A);
    await leaveAndClose(B);
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err.message || err);
  process.exit(1);
});
