/**
 * C++ Language Adapter
 * Extends CAdapter with C++-specific capabilities
 */

import * as vscode from 'vscode';
import { CAdapter } from './CAdapter';
import {
  LanguageId,
  PhaseKind,
  AdapterCapabilities,
} from '../types';

export class CppAdapter extends CAdapter {
  readonly language: LanguageId = 'cpp';
  readonly capabilities: AdapterCapabilities = {
    preprocessing: true,
    lexicalAnalysis: true,
    syntaxAnalysis: true,
    astExtraction: true,
    semanticAnalysis: true,
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

  protected async resolveCompiler(): Promise<void> {
    const config = vscode.workspace.getConfiguration('bodha.toolchains');
    this.compiler = config.get<string>('cpp', 'g++');
    this.compilerPath = config.get<string>('compilerPath', '');
    this.isClang = this.compiler.includes('clang');
  }

  getEnabledPhases(): PhaseKind[] {
    return [
      'source',
      'preprocessing',
      'lexical',
      'syntax',
      'ast',
      'semantic',
      'symbols',
      'ir',
      'optimization',
      'assembly',
    ];
  }

  getPhaseCommand(phase: PhaseKind): string | null {
    const commands: Record<PhaseKind, string | null> = {
      preprocessing: `${this.compiler} -E`,
      lexical: this.isClang ? `${this.compiler} -Xclang -dump-tokens` : null,
      syntax: null,
      ast: this.isClang ? `${this.compiler} -Xclang -ast-dump` : `${this.compiler} -fdump-tree-original`,
      semantic: null,
      symbols: `${this.compiler} -g -c && nm`,
      ir: this.isClang ? `${this.compiler} -S -emit-llvm` : `${this.compiler} -fdump-tree-gimple`,
      optimization: `${this.compiler} -O2 -S`,
      assembly: `${this.compiler} -O2 -S`,
      linking: `${this.compiler} -o`,
      runtime: `./a.out`,
      source: null,
    };
    return commands[phase] ?? null;
  }

  getPhaseName(phase: PhaseKind): string {
    const names: Record<PhaseKind, string> = {
      source: 'Source Code (C++)',
      preprocessing: 'Preprocessing',
      lexical: 'Lexical Analysis',
      syntax: 'Syntax Analysis',
      ast: 'Abstract Syntax Tree',
      semantic: 'Semantic Analysis',
      symbols: 'Symbol Table',
      ir: 'Intermediate Representation',
      optimization: 'Optimization',
      assembly: 'Assembly Generation',
      linking: 'Linking',
      runtime: 'Runtime',
    };
    return names[phase] || phase;
  }

  getPhaseDescription(phase: PhaseKind): string {
    const desc: Record<PhaseKind, string> = {
      source: 'Original C++ source code',
      preprocessing: 'Header expansion, macro substitution, template instantiation',
      lexical: 'Character stream → tokens (including C++ operators, templates)',
      syntax: 'Token stream → parse tree (templates, classes, overloads)',
      ast: 'Structural representation with C++ constructs',
      semantic: 'Type checking, template resolution, overload resolution',
      symbols: 'Identifier declarations (classes, templates, functions)',
      ir: 'Machine-independent intermediate code (GIMPLE/LLVM IR)',
      optimization: 'Code transformations (inlining, devirtualization, etc.)',
      assembly: 'Target-specific assembly code',
      linking: 'Object files → executable (template instantiation, vtables)',
      runtime: 'Program execution with C++ runtime',
    };
    return desc[phase] || '';
  }
}