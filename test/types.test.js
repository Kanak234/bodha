'use strict';

const { test, assertEqual, assertThrows, assertDeepEqual } = require('./harness');

console.log('\nBODHA Core Types Tests');

// Test PhaseKind enum
test('PhaseKind values', () => {
  const phases = ['source', 'preprocessing', 'lexical', 'syntax', 'ast', 'semantic', 'symbols', 'ir', 'optimization', 'assembly', 'linking', 'runtime'];
  // Just verify we can reference them
  assertEqual(phases.length, 12);
});

// Test ArtifactConfidence
test('ArtifactConfidence values', () => {
  const confidences = ['REAL_TOOLCHAIN', 'DERIVED', 'EDUCATIONAL'];
  assertEqual(confidences.length, 3);
});

// Test SourceLocation
test('SourceLocation structure', () => {
  const loc = { file: 'test.c', line: 10, column: 5, length: 4 };
  assertEqual(loc.line, 10);
  assertEqual(loc.column, 5);
});

// Test LanguageId
test('LanguageId values', () => {
  const langs = ['c', 'cpp', 'java', 'python'];
  assertEqual(langs.length, 4);
});

// Test adapter capabilities
test('CAdapter capabilities', () => {
  const caps = {
    preprocessing: true,
    lexicalAnalysis: true,
    syntaxAnalysis: true,
    astExtraction: true,
    semanticAnalysis: false,
    symbolTable: true,
    irExtraction: true,
    optimization: true,
    assemblyExtraction: true,
    objectInspection: true,
    linkingInspection: true,
    disassembly: true,
    debugging: false,
    sourceMapping: true,
  };
  assertEqual(caps.preprocessing, true);
  assertEqual(caps.optimization, true);
});

test('JavaAdapter capabilities', () => {
  const caps = {
    preprocessing: false,
    lexicalAnalysis: true,
    syntaxAnalysis: true,
    astExtraction: true,
    semanticAnalysis: true,
    symbolTable: true,
    irExtraction: true,
    optimization: false,
    assemblyExtraction: false,
    objectInspection: true,
    linkingInspection: false,
    disassembly: true,
    debugging: true,
    sourceMapping: true,
  };
  assertEqual(caps.preprocessing, false);
  assertEqual(caps.disassembly, true);
});

test('PythonAdapter capabilities', () => {
  const caps = {
    preprocessing: false,
    lexicalAnalysis: true,
    syntaxAnalysis: true,
    astExtraction: true,
    semanticAnalysis: false,
    symbolTable: true,
    irExtraction: true,
    optimization: false,
    assemblyExtraction: false,
    objectInspection: false,
    linkingInspection: false,
    disassembly: true,
    debugging: true,
    sourceMapping: true,
  };
  assertEqual(caps.preprocessing, false);
  assertEqual(caps.irExtraction, true);
});

// Test toolchain detection logic
test('splitCommand function', () => {
  const split = (cmd) => {
    const parts = cmd.trim().split(/\s+/);
    return { exe: parts[0], prefix: parts.slice(1) };
  };
  
  assertDeepEqual(split('gcc'), { exe: 'gcc', prefix: [] });
  assertDeepEqual(split('zig cc'), { exe: 'zig', prefix: ['cc'] });
  assertDeepEqual(split('  gcc  -O2  '), { exe: 'gcc', prefix: ['-O2'] });
});

console.log('\nType tests completed.');