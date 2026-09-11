'use strict';

const { test, assertEqual } = require('./harness');
const vscodeMock = require('./vscode-mock');
const { ToolchainDetector } = require('../out/toolchains/ToolchainDetector');

console.log('\nBODHA Toolchain Detector Tests (Real Module)');

const mockContext = {
  subscriptions: [],
  extensionPath: '/fake/path',
  asAbsolutePath: (p) => p,
};

test('Toolchain Detection - GCC Available', async () => {
  const detector = new ToolchainDetector(mockContext);
  const res = await detector.findExactCompiler('gcc', '');
  assertEqual(typeof res, 'object');
  assertEqual(res.command, 'gcc');
  assertEqual(typeof res.version, 'string');
});

test('Toolchain Detection - Missing Toolchain returns undefined', async () => {
  const detector = new ToolchainDetector(mockContext);
  const res = await detector.findExactCompiler('non_existent_compiler_xyz_123', '');
  assertEqual(res, undefined);
});

test('Toolchain Detection - Python3 Available', async () => {
  const detector = new ToolchainDetector(mockContext);
  const res = await detector.findExactCompiler('python3', '');
  assertEqual(typeof res, 'object');
  assertEqual(res.command, 'python3');
  assertEqual(typeof res.version, 'string');
});

test('Toolchain Detection - detect() checks all configured languages', async () => {
  const detector = new ToolchainDetector(mockContext);
  const info = await detector.detect();
  assertEqual(typeof info, 'object');
  assertEqual('c' in info, true);
  assertEqual('cpp' in info, true);
  assertEqual('java' in info, true);
  assertEqual('python' in info, true);
  assertEqual('javaRuntime' in info, true);
  assertEqual('javap' in info, true);
});

test('Toolchain Detection - detectAndShow() displays results in output channel', async () => {
  let channelCreated = false;
  let shownText = '';
  const originalCreateOutputChannel = vscodeMock.window.createOutputChannel;
  vscodeMock.window.createOutputChannel = (name) => ({
    name,
    show: () => { channelCreated = true; },
    appendLine: (txt) => { shownText = txt; },
    append: () => {},
    clear: () => {},
    dispose: () => {},
  });

  try {
    const detector = new ToolchainDetector(mockContext);
    const info = await detector.detectAndShow();
    assertEqual(channelCreated, true);
    assertEqual(shownText.includes('BODHA Toolchain Detection'), true);
    assertEqual(typeof info, 'object');
  } finally {
    vscodeMock.window.createOutputChannel = originalCreateOutputChannel;
  }
});

console.log('Toolchain tests completed.');
