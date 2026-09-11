'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, assertEqual } = require('./harness');
const vscodeMock = require('./vscode-mock');
const { CAdapter } = require('../out/adapters/CAdapter');
const { CppAdapter } = require('../out/adapters/CppAdapter');
const { JavaAdapter } = require('../out/adapters/JavaAdapter');
const { PythonAdapter } = require('../out/adapters/PythonAdapter');

console.log('\nBODHA Adapters Integration Tests (Real Modules & Toolchains)');

const mockContext = { subscriptions: [] };
const mockDetector = {};

test('CAdapter detect, enabled phases, and phase command resolution', () => {
  const adapter = new CAdapter(mockContext, mockDetector);
  assertEqual(adapter.detect({ languageId: 'c' }), true);
  assertEqual(adapter.detect({ languageId: 'python' }), false);

  const phases = adapter.getEnabledPhases();
  assertEqual(phases.includes('preprocessing'), true);
  assertEqual(phases.includes('assembly'), true);

  const cmd = adapter.getPhaseCommand('preprocessing');
  assertEqual(typeof cmd, 'string');
  assertEqual(cmd.includes('-E'), true);
});

test('CppAdapter detect, enabled phases, and phase command resolution', () => {
  const adapter = new CppAdapter(mockContext, mockDetector);
  assertEqual(adapter.detect({ languageId: 'cpp' }), true);
  assertEqual(adapter.detect({ languageId: 'c' }), false);

  const phases = adapter.getEnabledPhases();
  assertEqual(phases.includes('optimization'), true);
  const cmd = adapter.getPhaseCommand('preprocessing');
  assertEqual(typeof cmd, 'string');
});

test('JavaAdapter detect, enabled phases, and phase command resolution', () => {
  const adapter = new JavaAdapter(mockContext, mockDetector);
  assertEqual(adapter.detect({ languageId: 'java' }), true);
  assertEqual(adapter.detect({ languageId: 'c' }), false);

  const phases = adapter.getEnabledPhases();
  assertEqual(phases.includes('ir'), true);
  assertEqual(phases.includes('preprocessing'), false);
  const cmd = adapter.getPhaseCommand('semantic');
  assertEqual(typeof cmd, 'string');
});

test('PythonAdapter detect, enabled phases, and phase command resolution', () => {
  const adapter = new PythonAdapter(mockContext, mockDetector);
  assertEqual(adapter.detect({ languageId: 'python' }), true);
  assertEqual(adapter.detect({ languageId: 'java' }), false);

  const phases = adapter.getEnabledPhases();
  assertEqual(phases.includes('ast'), true);
  assertEqual(phases.includes('runtime'), true);
  assertEqual(phases.includes('preprocessing'), false);
});

test('CAdapter.analyze runs complete toolchain pipeline on C source', async () => {
  const adapter = new CAdapter(mockContext, mockDetector);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-c-'));
  const tmpFile = path.join(tmpDir, 'hello.c');
  fs.writeFileSync(tmpFile, '#include <stdio.h>\nint main(void) { printf("Hello\\n"); return 0; }\n');

  try {
    const doc = {
      uri: vscodeMock.Uri.file(tmpFile),
      languageId: 'c',
      getText: () => fs.readFileSync(tmpFile, 'utf8')
    };

    const result = await adapter.analyze(doc);
    assertEqual(result.sourceFile, tmpFile);
    assertEqual(result.language, 'c');
    assertEqual(result.phases.length > 5, true);
    assertEqual(result.artifacts.size > 5, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CppAdapter.analyze runs complete toolchain pipeline on C++ source', async () => {
  const adapter = new CppAdapter(mockContext, mockDetector);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-cpp-'));
  const tmpFile = path.join(tmpDir, 'main.cpp');
  fs.writeFileSync(tmpFile, '#include <iostream>\nint main() { std::cout << "Hello C++" << std::endl; return 0; }\n');

  try {
    const doc = {
      uri: vscodeMock.Uri.file(tmpFile),
      languageId: 'cpp',
      getText: () => fs.readFileSync(tmpFile, 'utf8')
    };

    const result = await adapter.analyze(doc);
    assertEqual(result.sourceFile, tmpFile);
    assertEqual(result.language, 'cpp');
    assertEqual(result.phases.length > 5, true);
    assertEqual(result.artifacts.size > 5, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('JavaAdapter.analyze runs complete toolchain pipeline on Java source', async () => {
  const adapter = new JavaAdapter(mockContext, mockDetector);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-java-'));
  const tmpFile = path.join(tmpDir, 'HelloJava.java');
  fs.writeFileSync(tmpFile, 'public class HelloJava { public static void main(String[] args) { System.out.println("Hi"); } }\n');

  try {
    const doc = {
      uri: vscodeMock.Uri.file(tmpFile),
      languageId: 'java',
      getText: () => fs.readFileSync(tmpFile, 'utf8')
    };

    const result = await adapter.analyze(doc);
    assertEqual(result.sourceFile, tmpFile);
    assertEqual(result.language, 'java');
    assertEqual(result.phases.length > 5, true);
    assertEqual(result.artifacts.size > 5, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('PythonAdapter.analyze runs complete toolchain pipeline on Python source', async () => {
  const adapter = new PythonAdapter(mockContext, mockDetector);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodha-py-'));
  const tmpFile = path.join(tmpDir, 'script.py');
  fs.writeFileSync(tmpFile, 'x = 10\ny = 20\nprint(x + y)\n');

  try {
    const doc = {
      uri: vscodeMock.Uri.file(tmpFile),
      languageId: 'python',
      getText: () => fs.readFileSync(tmpFile, 'utf8')
    };

    const result = await adapter.analyze(doc);
    assertEqual(result.sourceFile, tmpFile);
    assertEqual(result.language, 'python');
    assertEqual(result.phases.length >= 6, true);
    assertEqual(result.artifacts.size >= 6, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('BaseLanguageAdapter getPhaseName and getPhaseDescription', () => {
  const adapter = new CAdapter(mockContext, mockDetector);
  assertEqual(adapter.getPhaseName('preprocessing'), 'Preprocessing');
  assertEqual(adapter.getPhaseName('lexical'), 'Lexical Analysis');
  assertEqual(adapter.getPhaseDescription('ast').length > 0, true);
});

console.log('Adapters tests completed.');
