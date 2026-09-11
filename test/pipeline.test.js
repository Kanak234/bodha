'use strict';

const { test, assertEqual, assertThrows } = require('./harness');
const vscodeMock = require('./vscode-mock');
const { PipelineOrchestrator } = require('../out/pipeline/PipelineOrchestrator');
const { CAdapter } = require('../out/adapters/CAdapter');

console.log('\nBODHA PipelineOrchestrator Tests (Real Module)');

test('PipelineOrchestrator throws if no active document for single phase', async () => {
  vscodeMock.window.activeTextEditor = null;
  const orchestrator = new PipelineOrchestrator({});
  const adapter = new CAdapter({}, {});

  let threw = false;
  try {
    await orchestrator.runSinglePhase(adapter, 'tokens');
  } catch (e) {
    threw = true;
    assertEqual(e.message, 'No active document');
  }
  assertEqual(threw, true);
});

test('PipelineOrchestrator runSinglePhase maps phase names and calls adapter runPhase', async () => {
  let invokedPhase = null;
  const mockAdapter = {
    runPhase: async (phase, doc, artifacts) => {
      invokedPhase = phase;
      return { kind: phase, name: 'Tokens', outputArtifacts: [] };
    }
  };

  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/path/to/main.c'),
      languageId: 'c',
      getText: () => 'int x = 1;'
    }
  };

  const orchestrator = new PipelineOrchestrator({});
  const res = await orchestrator.runSinglePhase(mockAdapter, 'tokens');
  assertEqual(invokedPhase, 'lexical');
  assertEqual(res.kind, 'lexical');

  await orchestrator.runSinglePhase(mockAdapter, 'bytecode');
  assertEqual(invokedPhase, 'ir');
});

test('PipelineOrchestrator run coordinates full adapter analyze', async () => {
  let analyzedDoc = null;
  const mockAdapter = {
    analyze: async (doc) => {
      analyzedDoc = doc;
      return {
        sourceFile: doc.uri.fsPath,
        language: 'c',
        phases: [],
        artifacts: new Map(),
        sourceMappings: [],
        timeline: [],
        errors: []
      };
    }
  };

  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/workspace/test.c'),
      languageId: 'c',
      getText: () => 'int main() { return 0; }'
    }
  };

  const orchestrator = new PipelineOrchestrator({});
  const result = await orchestrator.run(mockAdapter);
  assertEqual(result.sourceFile, '/workspace/test.c');
  assertEqual(result.language, 'c');
  assertEqual(analyzedDoc.uri.fsPath, '/workspace/test.c');
});

console.log('PipelineOrchestrator tests completed.');
