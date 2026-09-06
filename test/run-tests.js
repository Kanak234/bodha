'use strict';

const path = require('path');
const { getSummary } = require('./harness');

const SUITES = ['types', 'diagnostics', 'activeDocument', 'toolchains', 'validationPrograms'];

async function main() {
  let anyError = false;
  for (const name of SUITES) {
    const mod = path.join(__dirname, name + '.test.js');
    try {
      await require(mod);
    } catch (e) {
      anyError = true;
      console.error(`\nSuite "${name}" failed to run:`, e.stack || e);
    }
  }

  const s = getSummary();
  console.log(`\n${s.passes} passed, ${s.failures} failed`);
  if (anyError || s.failures > 0) {
    process.exit(1);
  }
}

main();