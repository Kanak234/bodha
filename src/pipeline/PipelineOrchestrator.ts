/**
 * Pipeline Orchestrator
 * Coordinates multi-phase compilation pipeline execution
 */

import * as vscode from 'vscode';
import { LanguageAdapter, PipelineResult } from '../types';

export class PipelineOrchestrator {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async run(adapter: LanguageAdapter): Promise<PipelineResult> {
    // The adapter's analyze method runs the full pipeline
    return adapter.analyze(
      vscode.window.activeTextEditor!.document
    );
  }

  async runSinglePhase(
    adapter: LanguageAdapter,
    phase: string
  ): Promise<any> {
    const document = vscode.window.activeTextEditor?.document;
    if (!document) throw new Error('No active document');

    const artifacts = new Map<string, any>();
    const sourceArtifact = {
      id: 'source',
      content: document.getText(),
    };
    artifacts.set(sourceArtifact.id, sourceArtifact);

    // Map phase string to PhaseKind
    const phaseMap: Record<string, any> = {
      'tokens': 'lexical',
      'ast': 'ast',
      'symbols': 'symbols',
      'ir': 'ir',
      'optimization': 'optimization',
      'assembly': 'assembly',
      'bytecode': 'ir',
      'runtime': 'runtime',
    };

    const phaseKind = phaseMap[phase] || phase;
    // Call the protected method via reflection (simplified)
    return adapter['runPhase'](phaseKind, document, artifacts);
  }
}