#!/usr/bin/env node
// Three-browser LiveKit voice smoke test for Pavalon.
//
// ctest1 creates a room, ctest2 and ctest3 join. This is the original
// "breaks with multiple people" regression check for the old P2P mesh:
// since voice now runs through a single LiveKit SFU room, there is no
// N^2 connection graph to break as players are added.
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

  console.log('Logging in ctest1, ctest2, ctest3...');
  const [auth1, auth2, auth3] = await Promise.all([
    login('ctest1'),
    login('ctest2'),
    login('ctest3'),
  ]);

  console.log('Launching browsers...');
  const A = await launchAuthedBrowser(
    'A(ctest1)',
    path.join(SCRATCH, 'udata3-A'),
    auth1,
    chromiumPath,
    toneWavPath,
  );
  const B = await launchAuthedBrowser(
    'B(ctest2)',
    path.join(SCRATCH, 'udata3-B'),
    auth2,
    chromiumPath,
    toneWavPath,
  );
  const C = await launchAuthedBrowser(
    'C(ctest3)',
    path.join(SCRATCH, 'udata3-C'),
    auth3,
    chromiumPath,
    toneWavPath,
  );

  try {
    await A.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await A.page.waitForSelector('button:has-text("Host New Game")', { timeout: 15000 });
    await A.page.click('button:has-text("Host New Game")');
    await A.page.waitForSelector('h3:has-text("Room Code")', { timeout: 15000 });
    const roomCode = (await A.page.locator('button[aria-label="Copy game code"] p').innerText()).trim();
    console.log(`Room created: ${roomCode}`);

    await B.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await B.page.waitForSelector('input[placeholder="Room Code"]', { timeout: 15000 });
    await B.page.fill('input[placeholder="Room Code"]', roomCode);
    await B.page.click('button:has-text("Join Game")');
    await B.page.waitForSelector('h3:has-text("Room Code")', { timeout: 15000 });
    console.log('ctest2 joined room.');

    await C.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await C.page.waitForSelector('input[placeholder="Room Code"]', { timeout: 15000 });
    await C.page.fill('input[placeholder="Room Code"]', roomCode);
    await C.page.click('button:has-text("Join Game")');
    await C.page.waitForSelector('h3:has-text("Room Code")', { timeout: 15000 });
    console.log('ctest3 joined room.');

    await A.page.waitForTimeout(3000);
    await A.page.screenshot({ path: shot('t3-01-browserA-lobby-3players.png') });
    await B.page.screenshot({ path: shot('t3-02-browserB-lobby-3players.png') });
    await C.page.screenshot({ path: shot('t3-03-browserC-lobby-3players.png') });

    const checks = [
      { page: A, name: 'A(ctest1)', others: ['ctest2', 'ctest3'] },
      { page: B, name: 'B(ctest2)', others: ['ctest1', 'ctest3'] },
      { page: C, name: 'C(ctest3)', others: ['ctest1', 'ctest2'] },
    ];

    for (const { page, name, others } of checks) {
      for (const other of others) {
        console.log(`Waiting for ${other} speaking indicator in ${name}...`);
        const icon = page.page.locator(`div[title="${other}"] svg.lucide-mic`);
        await icon.first().waitFor({ state: 'visible', timeout: 15000 });
        console.log(`PASS: ${other} speaking indicator visible in ${name}.`);
      }
    }

    await A.page.screenshot({ path: shot('t3-04-browserA-all-speaking.png') });
    await B.page.screenshot({ path: shot('t3-05-browserB-all-speaking.png') });
    await C.page.screenshot({ path: shot('t3-06-browserC-all-speaking.png') });

    console.log('THREE-BROWSER SMOKE TEST COMPLETE. All assertions passed, no mesh-breakage observed with 3 participants.');
  } finally {
    await leaveAndClose(A);
    await leaveAndClose(B);
    await leaveAndClose(C);
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err.message || err);
  process.exit(1);
});
