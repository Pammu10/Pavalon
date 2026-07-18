#!/usr/bin/env node
// Runs the two-browser test, then the three-browser test, in sequence.
//
// They run one after another (not in parallel) and each script leaves its
// room explicitly before closing (see lib/common.js leaveAndClose) so the
// second run doesn't get caught by the server's 60s reconnect grace window
// for ctest1/ctest2. See README.md for the manual-run alternative and the
// reconnect-timer gotcha if you ever see a "Host New Game" timeout here.
const { spawnSync } = require('child_process');
const path = require('path');

function run(script) {
  console.log(`\n=== Running ${script} ===\n`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n=== ${script} FAILED (exit code ${result.status}) ===`);
    process.exit(result.status || 1);
  }
  console.log(`\n=== ${script} PASSED ===`);
}

run('two-browser-test.js');
run('three-browser-test.js');

console.log('\nAll voice E2E scripts passed.');
