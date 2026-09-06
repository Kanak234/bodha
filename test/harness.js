'use strict';

/**
 * BODHA Test Harness
 * Dependency-free test runner
 */

let passes = 0;
let failures = 0;

function test(name, fn) {
  try {
    fn();
    passes++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    if (e.stack) console.log(`    ${e.stack.split('\n')[1]?.trim()}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, msg) {
  try {
    fn();
    throw new Error(`${msg || 'Expected throw'}: function did not throw`);
  } catch (e) {
    if (e.message.includes('Expected throw')) throw e;
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || 'Deep equal failed'}: expected ${e}, got ${a}`);
  }
}

module.exports = { test, assertEqual, assertThrows, assertDeepEqual, 
  getSummary: () => ({ passes, failures }) };