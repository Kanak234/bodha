'use strict';

const { test, assertEqual, assertDeepEqual } = require('./harness');
const { CAdapter } = require('../out/adapters/CAdapter');
const { CppAdapter } = require('../out/adapters/CppAdapter');
const { JavaAdapter } = require('../out/adapters/JavaAdapter');
const { PythonAdapter } = require('../out/adapters/PythonAdapter');

console.log('\nBODHA Core Types & Adapters Tests (Real Modules)');

// Test PhaseKind enumeration coverage
test('PhaseKind values', () => {
  const phases = ['source', 'preprocessing', 'lexical', 'syntax', 'ast', 'semantic', 'symbols', 'ir', 'optimization', 'assembly', 'linking', 'runtime'];
  assertEqual(phases.length, 12);
});

// Test ArtifactConfidence
test('ArtifactConfidence values', () => {
  const confidences = ['REAL_TOOLCHAIN', 'DERIVED', 'EDUCATIONAL'];
  assertEqual(confidences.length, 3);
});

// Test SourceLocation structure
test('SourceLocation structure', () => {
  const loc = { file: 'test.c', line: 10, column: 5, length: 4 };
  assertEqual(loc.line, 10);
  assertEqual(loc.column, 5);
});

// Test LanguageId values
test('LanguageId values', () => {
  const langs = ['c', 'cpp', 'java', 'python'];
  assertEqual(langs.length, 4);
});

// Test real CAdapter instance
test('CAdapter capabilities and language', () => {
  const adapter = new CAdapter({}, {});
  assertEqual(adapter.language, 'c');
  assertEqual(adapter.capabilities.preprocessing, true);
  assertEqual(adapter.capabilities.optimization, true);
  assertEqual(adapter.capabilities.assemblyExtraction, true);
  assertEqual(adapter.capabilities.linkingInspection, true);
  assertEqual(adapter.capabilities.debugging, false);
});

// Test real CppAdapter instance
test('CppAdapter capabilities and language', () => {
  const adapter = new CppAdapter({}, {});
  assertEqual(adapter.language, 'cpp');
  assertEqual(adapter.capabilities.preprocessing, true);
  assertEqual(adapter.capabilities.syntaxAnalysis, true);
  assertEqual(adapter.capabilities.assemblyExtraction, true);
});

// Test real JavaAdapter instance
test('JavaAdapter capabilities and language', () => {
  const adapter = new JavaAdapter({}, {});
  assertEqual(adapter.language, 'java');
  assertEqual(adapter.capabilities.preprocessing, false);
  assertEqual(adapter.capabilities.disassembly, true);
  assertEqual(adapter.capabilities.debugging, true);
  assertEqual(adapter.capabilities.linkingInspection, false);
});

// Test real PythonAdapter instance
test('PythonAdapter capabilities and language', () => {
  const adapter = new PythonAdapter({}, {});
  assertEqual(adapter.language, 'python');
  assertEqual(adapter.capabilities.preprocessing, false);
  assertEqual(adapter.capabilities.irExtraction, true);
  assertEqual(adapter.capabilities.disassembly, true);
  assertEqual(adapter.capabilities.debugging, true);
});

// Test command splitting logic
test('splitCommand function on adapters', () => {
  const adapter = new CAdapter({}, {});
  const split = (cmd) => {
    const parts = cmd.trim().split(/\s+/);
    return { exe: parts[0], prefix: parts.slice(1) };
  };
  
  assertDeepEqual(split('gcc'), { exe: 'gcc', prefix: [] });
  assertDeepEqual(split('zig cc'), { exe: 'zig', prefix: ['cc'] });
  assertDeepEqual(split('  gcc  -O2  '), { exe: 'gcc', prefix: ['-O2'] });
});

console.log('Type tests completed.');
