'use strict';

/**
 * BODHA Test Harness
 * Dependency-free test runner supporting synchronous and asynchronous tests.
 */

// Initialize VS Code mock before running any tests
require('./vscode-mock');

let passes = 0;
let failures = 0;
const asyncQueue = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      const p = result
        .then(() => {
          passes++;
          console.log(`  ✓ ${name}`);
        })
        .catch((e) => {
          failures++;
          console.log(`  ✗ ${name}`);
          console.log(`    ${e.message}`);
          if (e.stack) console.log(`    ${e.stack.split('\n')[1]?.trim()}`);
        });
      asyncQueue.push(p);
      return;
    }
    passes++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    if (e.stack) console.log(`    ${e.stack.split('\n')[1]?.trim()}`);
  }
}

async function waitForAsyncTests() {
  while (asyncQueue.length > 0) {
    const next = asyncQueue.shift();
    await next;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, msg) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`${msg || 'Expected throw'}: function did not throw`);
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || 'Deep equal failed'}: expected ${e}, got ${a}`);
  }
}

module.exports = {
  test,
  assertEqual,
  assertThrows,
  assertDeepEqual,
  waitForAsyncTests,
  getSummary: () => ({ passes, failures }),
};
