'use strict';

const { test, assertEqual, assertThrows } = require('./harness');
const vscodeMock = require('./vscode-mock');
const { CodeRunner } = require('../out/runner/CodeRunner');

console.log('\nBODHA CodeRunner Tests (Real Module)');

test('CodeRunner builds correct compile and run commands for C', () => {
  const res = CodeRunner.getCompileAndRunCommand('c', '/workspace/main.c');
  assertEqual(res.cwd, '/workspace');
  assertEqual(res.compileCmd.includes('gcc -g "main.c"'), true);
  assertEqual(res.runCmd.includes('main.out') || res.runCmd.includes('main.exe'), true);
});

test('CodeRunner builds correct compile and run commands for C++', () => {
  const res = CodeRunner.getCompileAndRunCommand('cpp', '/workspace/app.cpp');
  assertEqual(res.cwd, '/workspace');
  assertEqual(res.compileCmd.includes('g++ -g "app.cpp"'), true);
  assertEqual(res.runCmd.includes('app.out') || res.runCmd.includes('app.exe'), true);
});

test('CodeRunner builds correct compile and run commands for Java', () => {
  const res = CodeRunner.getCompileAndRunCommand('java', '/workspace/Main.java');
  assertEqual(res.cwd, '/workspace');
  assertEqual(res.compileCmd, 'javac "Main.java"');
  assertEqual(res.runCmd, 'java -cp . "Main"');
});

test('CodeRunner builds correct run command for Python', () => {
  const res = CodeRunner.getCompileAndRunCommand('python', '/workspace/script.py');
  assertEqual(res.cwd, '/workspace');
  assertEqual(res.compileCmd, undefined);
  assertEqual(res.runCmd, 'python3 -u "script.py"');
});

test('CodeRunner throws error on unsupported language', () => {
  assertThrows(() => {
    CodeRunner.getCompileAndRunCommand('ruby', '/workspace/script.rb');
  });
});

test('CodeRunner.getTerminal creates and caches terminal', () => {
  const term1 = CodeRunner.getTerminal();
  const term2 = CodeRunner.getTerminal();
  assertEqual(term1, term2);
  assertEqual(term1.name, 'BODHA Terminal');
});

test('CodeRunner.runInTerminal sends cd and run commands', () => {
  let sentCommands = [];
  const term = CodeRunner.getTerminal();
  term.sendText = (text) => { sentCommands.push(text); };

  CodeRunner.runInTerminal('python', '/workspace/test.py');
  assertEqual(sentCommands.length >= 2, true);
  assertEqual(sentCommands[0].includes('cd'), true);
  assertEqual(sentCommands[1].includes('python3 -u "test.py"'), true);
});

test('CodeRunner.executeProcess runs command and captures output', async () => {
  const res = await CodeRunner.executeProcess('echo', ['"Hello BODHA"'], process.cwd());
  assertEqual(res.exitCode, 0);
  assertEqual(res.stdout.trim(), 'Hello BODHA');
  assertEqual(res.durationMs >= 0, true);
});

test('CodeRunner.stopActiveProcess stops process and returns false when idle', () => {
  CodeRunner.stopActiveProcess();
  const stoppedAgain = CodeRunner.stopActiveProcess();
  assertEqual(stoppedAgain, false);
});

console.log('CodeRunner tests completed.');
