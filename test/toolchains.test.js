'use strict';

const { test, assertEqual } = require('./harness');

console.log('\nBODHA Toolchain Detector Tests');

// Mock function mirroring ToolchainDetector strict lookup logic
function detectToolchainCommand(configuredCmd, installedMap) {
  if (installedMap[configuredCmd]) {
    return {
      command: configuredCmd,
      version: installedMap[configuredCmd],
      status: 'AVAILABLE'
    };
  }
  return {
    command: configuredCmd,
    status: 'TOOLCHAIN NOT FOUND'
  };
}

test('Toolchain Detection - GCC Available', () => {
  const installed = { gcc: 'gcc (Ubuntu 11.4.0) 11.4.0' };
  const res = detectToolchainCommand('gcc', installed);
  assertEqual(res.status, 'AVAILABLE');
  assertEqual(res.command, 'gcc');
});

test('Toolchain Detection - Missing Toolchain returns TOOLCHAIN NOT FOUND', () => {
  const installed = { gcc: 'gcc 11.4' }; // non_existent_compiler is not installed
  const res = detectToolchainCommand('non_existent_compiler', installed);
  assertEqual(res.status, 'TOOLCHAIN NOT FOUND');
});

test('Toolchain Detection - Java / javac Available', () => {
  const installed = { javac: 'javac 17.0.8' };
  const res = detectToolchainCommand('javac', installed);
  assertEqual(res.status, 'AVAILABLE');
  assertEqual(res.command, 'javac');
});

test('Toolchain Detection - Python3 Available', () => {
  const installed = { python3: 'Python 3.10.12' };
  const res = detectToolchainCommand('python3', installed);
  assertEqual(res.status, 'AVAILABLE');
});

console.log('Toolchain tests completed.');
