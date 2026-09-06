/**
 * Core types for BODHA Compiler Visualizer
 */

import * as vscode from 'vscode';

export type LanguageId = 'c' | 'cpp' | 'java' | 'python';

export type PhaseKind =
  | 'source'
  | 'preprocessing'
  | 'lexical'
  | 'syntax'
  | 'ast'
  | 'semantic'
  | 'symbols'
  | 'ir'
  | 'optimization'
  | 'assembly'
  | 'linking'
  | 'runtime';

export type ArtifactConfidence = 'REAL_TOOLCHAIN' | 'DERIVED' | 'EDUCATIONAL';

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  length?: number;
}

export interface CompilerArtifact {
  id: string;
  phase: PhaseKind;
  confidence: ArtifactConfidence;
  toolchain?: string;
  toolVersion?: string;
  content: string | object;
  sourceMapping?: SourceMapping[];
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface SourceMapping {
  source: SourceLocation;
  artifact: { start: number; end: number }; // byte/char offset in artifact
  description?: string;
}

export interface CompilerPhase {
  kind: PhaseKind;
  name: string;
  description: string;
  inputArtifacts: string[]; // artifact IDs
  outputArtifacts: string[]; // artifact IDs
  toolchain?: string;
  command?: string;
  durationMs?: number;
  success: boolean;
  error?: string;
}

export interface PipelineResult {
  sourceFile: string;
  language: LanguageId;
  phases: CompilerPhase[];
  artifacts: Map<string, CompilerArtifact>;
  sourceMappings: SourceMapping[];
  timeline: TimelineFrame[];
  errors: CompilerError[];
}

export interface CompilerError {
  phase: PhaseKind;
  message: string;
  location?: SourceLocation;
  severity: 'error' | 'warning' | 'info';
  errorCode?: string;
  errorStage?: string;
  suggestedCheck?: string;
}

export interface TimelineFrame {
  index: number;
  phase: PhaseKind;
  label: string;
  description: string;
  artifactIds: string[];
  timestamp: number;
  data?: any;
}

export interface DebuggerStateFrame {
  name: string;
  source: string;
  line: number;
  column: number;
  variables: { name: string; value: string; type: string }[];
}

export interface ProgramFlowStep {
  id: string;
  caller: string;
  callee: string;
  line: number;
  type: 'call' | 'return' | 'statement' | 'branch';
  isStatic?: boolean;
}

export interface ToolchainInfo {
  c?: { command: string; version: string; path: string };
  cpp?: { command: string; version: string; path: string };
  java?: { command: string; version: string; path: string };
  python?: { command: string; version: string; path: string };
  javaRuntime?: { command: string; version: string; path: string };
  javap?: { command: string; version: string; path: string };
  debugger?: { command: string; version: string; path: string };
}

export interface AdapterCapabilities {
  preprocessing: boolean;
  lexicalAnalysis: boolean;
  syntaxAnalysis: boolean;
  astExtraction: boolean;
  semanticAnalysis: boolean;
  symbolTable: boolean;
  irExtraction: boolean;
  optimization: boolean;
  assemblyExtraction: boolean;
  objectInspection: boolean;
  linkingInspection: boolean;
  disassembly: boolean;
  debugging: boolean;
  sourceMapping: boolean;
}

export interface LanguageAdapter {
  readonly language: LanguageId;
  readonly capabilities: AdapterCapabilities;
  detect(document: vscode.TextDocument): boolean;
  analyze(document: vscode.TextDocument): Promise<PipelineResult>;
  getPhaseCommand(phase: PhaseKind): string | null;
  runPhase(
    phase: PhaseKind,
    document: vscode.TextDocument,
    artifacts: Map<string, CompilerArtifact>
  ): Promise<CompilerPhase>;
}