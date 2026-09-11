'use strict';

const path = require('path');
const { getSummary, waitForAsyncTests } = require('./harness');

const SUITES = [
  'types',
  'diagnostics',
  'activeDocument',
  'toolchains',
  'validationPrograms',
  'adapters',
  'runner',
  'debugger',
  'pipeline'
];

async function main() {
  let anyError = false;
  for (const name of SUITES) {
    const mod = path.join(__dirname, name + '.test.js');
    try {
      await require(mod);
      await waitForAsyncTests();
    } catch (e) {
      anyError = true;
      console.error(`\nSuite "${name}" failed to run:`, e.stack || e);
    }
  }

  await waitForAsyncTests();
  const s = getSummary();
  console.log(`\n${s.passes} passed, ${s.failures} failed`);
  if (anyError || s.failures > 0) {
    process.exit(1);
  }
}

main();
