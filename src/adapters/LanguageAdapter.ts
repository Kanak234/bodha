/**
 * Language Adapter Base Class
 * Abstract base for language-specific compiler pipeline adapters
 */

import * as vscode from 'vscode';
import {
  LanguageAdapter as ILanguageAdapter,
  LanguageId,
  AdapterCapabilities,
  PipelineResult,
  CompilerArtifact,
  CompilerPhase,
  PhaseKind,
  CompilerError,
  ToolchainInfo,
} from '../types';

export { ILanguageAdapter as LanguageAdapter };

export abstract class BaseLanguageAdapter implements ILanguageAdapter {
  abstract readonly language: LanguageId;
  abstract readonly capabilities: AdapterCapabilities;

  protected context: vscode.ExtensionContext;
  protected toolchainDetector: any; // ToolchainDetector
  protected toolchainInfo: ToolchainInfo | null = null;

  constructor(context: vscode.ExtensionContext, toolchainDetector: any) {
    this.context = context;
    this.toolchainDetector = toolchainDetector;
  }

  detect(document: vscode.TextDocument): boolean {
    return document.languageId === this.language;
  }

  async analyze(document: vscode.TextDocument): Promise<PipelineResult> {
    const phases: CompilerPhase[] = [];
    const artifacts = new Map<string, CompilerArtifact>();
    const errors: CompilerError[] = [];

    const sourceArtifact = this.createArtifact('source', 'source', 'REAL_TOOLCHAIN', document.getText(), {
      file: document.uri.fsPath,
    });
    artifacts.set(sourceArtifact.id, sourceArtifact);

    // Run each enabled phase
    const enabledPhases = this.getEnabledPhases();
    for (const phaseKind of enabledPhases) {
      const phase = await this.runPhase(phaseKind, document, artifacts);
      phases.push(phase);
      if (phase.error) {
        errors.push({
          phase: phaseKind,
          message: phase.error,
          severity: 'error',
        });
      }
    }

    return {
      sourceFile: document.uri.fsPath,
      language: this.language,
      phases,
      artifacts,
      sourceMappings: [],
      timeline: phases.map((p, i) => ({
        index: i,
        phase: p.kind,
        label: p.name,
        description: p.description,
        artifactIds: p.outputArtifacts,
        timestamp: Date.now(),
      })),
      errors,
    };
  }

  public abstract getEnabledPhases(): PhaseKind[];
  public abstract runPhase(
    phase: PhaseKind,
    document: vscode.TextDocument,
    artifacts: Map<string, CompilerArtifact>
  ): Promise<CompilerPhase>;

  protected createArtifact(
    phase: PhaseKind,
    kind: string,
    confidence: 'REAL_TOOLCHAIN' | 'DERIVED' | 'EDUCATIONAL',
    content: string | object,
    metadata?: Record<string, unknown>
  ): CompilerArtifact {
    return {
      id: `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      phase,
      confidence,
      content,
      metadata,
      timestamp: Date.now(),
    };
  }

  protected async runCommand(cmd: string, args: string[], cwd?: string): Promise<{ code: number; out: string; err: string }> {
    return new Promise((resolve) => {
      const child = require('child_process').spawn(cmd, args, {
        cwd,
        shell: false,
        env: { ...process.env, BODHA_PIPELINE: '1' }
      });
      let out = '', err = '';
      child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
      child.on('close', (code: number) => resolve({ code, out, err }));
      child.on('error', (e: Error) => {
        const msg = e.message.includes('ENOENT') ? `TOOLCHAIN NOT FOUND: ${cmd}` : e.message;
        resolve({ code: -1, out: '', err: msg });
      });
    });
  }

  abstract getPhaseCommand(phase: PhaseKind): string | null;

  protected getPhaseName(phase: PhaseKind): string {
    const names: Record<PhaseKind, string> = {
      source: 'Source Code',
      preprocessing: 'Preprocessing',
      lexical: 'Lexical Analysis (Tokens)',
      syntax: 'Syntax Analysis',
      ast: 'Abstract Syntax Tree (AST)',
      semantic: 'Semantic Analysis & Symbol Table',
      symbols: 'Symbol Table & Metadata',
      ir: 'Intermediate Representation (IR)',
      optimization: 'Optimization Passes',
      assembly: 'Assembly Code Generation',
      linking: 'Object Linking & Binary',
      runtime: 'Runtime Execution & State',
    };
    return names[phase] || phase;
  }

  protected getPhaseDescription(phase: PhaseKind): string {
    const descriptions: Record<PhaseKind, string> = {
      source: 'Raw source input document text',
      preprocessing: 'Macro expansion, header inclusion, comment removal',
      lexical: 'Tokenization into lexical stream',
      syntax: 'Grammatical parsing and rule verification',
      ast: 'Hierarchical tree structure of language constructs',
      semantic: 'Type checking, scope resolution, and symbol mapping',
      symbols: 'Exported and internal variable/function symbol signatures',
      ir: 'Machine-independent intermediate compiler format',
      optimization: 'Loop unrolling, dead code elimination, constant folding',
      assembly: 'Target platform machine assembly instructions',
      linking: 'Combining object files and dynamic libraries',
      runtime: 'Step execution, stack frames, call trees, and variable values',
    };
    return descriptions[phase] || phase;
  }
}