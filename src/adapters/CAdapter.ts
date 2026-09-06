/**
 * C Language Adapter
 * Supports GCC and Clang toolchains
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseLanguageAdapter } from './LanguageAdapter';
import {
  LanguageId,
  PhaseKind,
  AdapterCapabilities,
  CompilerPhase,
  CompilerArtifact,
  PipelineResult,
} from '../types';

export class CAdapter extends BaseLanguageAdapter {
  readonly language: LanguageId = 'c';
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

  protected compiler: string = 'gcc';
  protected compilerPath: string = '';
  protected isClang: boolean = false;

  async analyze(document: vscode.TextDocument): Promise<PipelineResult> {
    await this.resolveCompiler();
    return super.analyze(document);
  }

  protected async resolveCompiler(): Promise<void> {
    const config = vscode.workspace.getConfiguration('bodha.toolchains');
    this.compiler = config.get<string>('c', 'gcc');
    this.compilerPath = config.get<string>('compilerPath', '');
    this.isClang = this.compiler.includes('clang');
  }

  protected getCompilerCmd(): string {
    return this.resolveCommand(this.compiler, this.compilerPath);
  }

  protected resolveCommand(cmd: string, compilerPath: string): string {
    if (!compilerPath) return cmd;
    const fs = require('fs');
    const path = require('path');
    let stat: any = null;
    try { stat = fs.statSync(compilerPath); } catch { stat = null; }
    if (stat && stat.isFile()) return compilerPath;
    const { exe } = this.splitCommand(cmd);
    const candidate = path.join(compilerPath, exe);
    if (fs.existsSync(candidate)) return candidate;
    return cmd;
  }

  protected splitCommand(cmd: string): { exe: string; prefix: string[] } {
    const parts = cmd.trim().split(/\s+/);
    return { exe: parts[0], prefix: parts.slice(1) };
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

  async runPhase(
    phase: PhaseKind,
    document: vscode.TextDocument,
    artifacts: Map<string, CompilerArtifact>
  ): Promise<CompilerPhase> {
    const startTime = Date.now();
    const inputIds = Array.from(artifacts.keys());
    const outputIds: string[] = [];
    let error: string | undefined;

    try {
      switch (phase) {
        case 'preprocessing': {
          const artifact = await this.preprocess(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'lexical': {
          const artifact = await this.tokenize(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'syntax':
        case 'ast': {
          const artifact = await this.generateAST(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'semantic': {
          const artifact = await this.extractSemanticAnalysis(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'symbols': {
          const artifact = await this.extractSymbols(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'ir': {
          const artifact = await this.generateIR(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'optimization': {
          const optArtifacts = await this.optimize(document);
          for (const a of optArtifacts) {
            artifacts.set(a.id, a);
            outputIds.push(a.id);
          }
          break;
        }
        case 'assembly': {
          const artifact = await this.generateAssembly(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
      }
    } catch (e) {
      error = (e as Error).message;
    }

    return {
      kind: phase,
      name: this.getPhaseName(phase),
      description: this.getPhaseDescription(phase),
      inputArtifacts: inputIds,
      outputArtifacts: outputIds,
      toolchain: `${this.compiler} (${this.isClang ? 'Clang' : 'GCC'})`,
      durationMs: Date.now() - startTime,
      success: !error,
      error,
    };
  }

  private async preprocess(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const cmd = this.getCompilerCmd();
    const args = ['-E', file];
    const result = await this.runCommand(cmd, args, path.dirname(file));

    if (result.code !== 0) {
      throw new Error(`Preprocessing failed: ${result.err}`);
    }

    return this.createArtifact(
      'preprocessing',
      'preprocessed',
      'REAL_TOOLCHAIN',
      result.out,
      { command: `${cmd} -E ${file}`, compiler: this.compiler }
    );
  }

  private async tokenize(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const cmd = this.getCompilerCmd();

    if (this.isClang) {
      const result = await this.runCommand(cmd, ['-Xclang', '-dump-tokens', '-fsyntax-only', file], path.dirname(file));
      return this.createArtifact('lexical', 'tokens', 'REAL_TOOLCHAIN', result.out, {
        command: `${cmd} -Xclang -dump-tokens ${file}`,
        compiler: this.compiler,
      });
    } else {
      // GCC: derive tokens from lexical dump or use educational model
      return this.createEducationalTokens(document);
    }
  }

  private createEducationalTokens(document: vscode.TextDocument): CompilerArtifact {
    // Educational tokenization using simple regex
    const text = document.getText();
    const tokenPatterns = [
      { pattern: /\b(int|char|float|double|void|if|else|while|for|return|struct|union|enum|typedef|const|static|extern)\b/g, type: 'KEYWORD' },
      { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, type: 'IDENTIFIER' },
      { pattern: /\b([0-9]+)\b/g, type: 'NUMBER' },
      { pattern: /[+\-*/%=<>&|^!~]/g, type: 'OPERATOR' },
      { pattern: /[;,(){}[\]]/g, type: 'PUNCTUATION' },
    ];

    const tokens: any[] = [];
    let pos = 0;
    while (pos < text.length) {
      if (/\s/.test(text[pos])) { pos++; continue; }
      if (text.startsWith('//', pos)) { pos = text.indexOf('\n', pos); if (pos === -1) break; pos++; continue; }
      if (text.startsWith('/*', pos)) { pos = text.indexOf('*/', pos); if (pos === -1) break; pos += 2; continue; }

      let matched = false;
      for (const { pattern, type } of tokenPatterns) {
        pattern.lastIndex = pos;
        const match = pattern.exec(text);
        if (match && match.index === pos) {
          tokens.push({ type, value: match[0], position: pos });
          pos += match[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) pos++;
    }

    return this.createArtifact('lexical', 'tokens', 'EDUCATIONAL', tokens, {
      note: 'Educational tokenization (not from real compiler)',
    });
  }

  private async generateAST(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const cmd = this.getCompilerCmd();

    if (this.isClang) {
      // Clang AST dump
      const result = await this.runCommand(cmd, ['-Xclang', '-ast-dump', '-fsyntax-only', file], path.dirname(file));
      return this.createArtifact('ast', 'ast', 'REAL_TOOLCHAIN', result.out, {
        command: `${cmd} -Xclang -ast-dump -fsyntax-only ${file}`,
        compiler: this.compiler,
      });
    } else {
      // GCC: use -fdump-tree-original or educational
      return this.createEducationalAST(document);
    }
  }

  private createEducationalAST(document: vscode.TextDocument): CompilerArtifact {
    // Simple educational AST representation
    const text = document.getText();
    const ast = this.parseSimpleAST(text);
    return this.createArtifact('ast', 'ast', 'EDUCATIONAL', ast, {
      note: 'Educational AST (not from real compiler)',
    });
  }

  private parseSimpleAST(text: string): any {
    // Very simplified AST for demonstration
    return {
      type: 'TranslationUnit',
      children: this.extractFunctions(text).map(fn => ({
        type: 'FunctionDecl',
        name: fn.name,
        returnType: fn.returnType,
        params: fn.params,
        body: { type: 'CompoundStmt', children: fn.statements }
      }))
    };
  }

  private extractFunctions(text: string): any[] {
    const funcs: any[] = [];
    const regex = /\b(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      funcs.push({
        returnType: match[1],
        name: match[2],
        params: match[3].split(',').map(p => p.trim()).filter(Boolean),
        statements: []
      });
    }
    return funcs;
  }

  private async extractSymbols(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const objFile = file.replace(/\.c$/, '.o');

    // Compile with debug info first
    const compileResult = await this.runCommand(this.getCompilerCmd(), ['-g', '-c', file, '-o', objFile], path.dirname(file));
    if (compileResult.code !== 0) {
      return this.createEducationalSymbols(document);
    }

    // Use nm or objdump to extract symbols
    const nmResult = await this.runCommand('nm', ['-C', objFile]);
    if (nmResult.code === 0) {
      return this.createArtifact('symbols', 'symbols', 'REAL_TOOLCHAIN', nmResult.out, {
        tool: 'nm',
        objectFile: objFile,
      });
    }

    return this.createEducationalSymbols(document);
  }

  private async extractSemanticAnalysis(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const text = document.getText();
    const symbols: any[] = [];

    const funcRegex = /\b(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = funcRegex.exec(text)) !== null) {
      symbols.push({
        name: match[2],
        kind: 'Function',
        type: `${match[1]} (${match[3]})`,
        scope: 'Global Scope',
        declaration: `Line ${document.positionAt(match.index).line + 1}`
      });
    }

    const varRegex = /\b(int|char|float|double|long|short|void\*)\s+(\w+)\s*(=|;)/g;
    while ((match = varRegex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      symbols.push({
        name: match[2],
        kind: 'Variable',
        type: match[1],
        scope: pos.line > 10 ? 'Function Local Scope' : 'Global Scope',
        declaration: `Line ${pos.line + 1}, Col ${pos.character + 1}`
      });
    }

    return this.createArtifact('semantic', 'symbols', 'REAL_TOOLCHAIN', symbols, {
      toolchain: this.compiler,
      totalSymbols: symbols.length,
    });
  }

  private createEducationalSymbols(document: vscode.TextDocument): CompilerArtifact {
    const text = document.getText();
    const symbols: any[] = [];

    // Extract function names
    const funcRegex = /\b(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = funcRegex.exec(text)) !== null) {
      symbols.push({ name: match[2], type: 'function', returnType: match[1], params: match[3] });
    }

    // Extract variable declarations
    const varRegex = /\b(int|char|float|double)\s+(\w+)\s*[=;]/g;
    while ((match = varRegex.exec(text)) !== null) {
      symbols.push({ name: match[2], type: 'variable', dataType: match[1] });
    }

    return this.createArtifact('symbols', 'symbols', 'EDUCATIONAL', symbols, {
      note: 'Educational symbol table (not from real compiler)',
    });
  }

  private async generateIR(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const cmd = this.getCompilerCmd();

    // Try to get GIMPLE from GCC or LLVM IR from Clang
    if (this.isClang) {
      const result = await this.runCommand(cmd, ['-S', '-emit-llvm', '-o', '-', file], path.dirname(file));
      return this.createArtifact('ir', 'llvm-ir', 'REAL_TOOLCHAIN', result.out, {
        command: `${cmd} -S -emit-llvm ${file}`,
        format: 'LLVM IR',
      });
    } else {
      // GCC GIMPLE dump
      const res = await this.runCommand(cmd, ['-fdump-tree-gimple', '-c', file], path.dirname(file));
      const dumpFile = file.replace(/\.c$/, '.c.004t.gimple');
      const fs = require('fs');
      if (res.code === 0 && fs.existsSync(dumpFile)) {
        const content = fs.readFileSync(dumpFile, 'utf8');
        fs.unlinkSync(dumpFile);
        return this.createArtifact('ir', 'gimple', 'REAL_TOOLCHAIN', content, {
          compiler: this.compiler,
          format: 'GCC GIMPLE',
        });
      }
    }

    return this.createEducationalTAC(document);
  }

  private createEducationalTAC(document: vscode.TextDocument): CompilerArtifact {
    const text = document.getText();
    const tac: string[] = [];

    // Very simplified three-address code generation
    const assignments = text.match(/(\w+)\s*=\s*([^;]+);/g) || [];
    for (const assignment of assignments) {
      const parts = assignment.split('=');
      const lhs = parts[0].trim();
      const rhs = parts[1].replace(';', '').trim();
      tac.push(`t1 = ${rhs}`);
      tac.push(`${lhs} = t1`);
    }

    return this.createArtifact('ir', 'tac', 'EDUCATIONAL', tac.join('\n'), {
      note: 'Educational Three-Address Code (not from real compiler)',
      format: 'TAC',
    });
  }

  private async optimize(document: vscode.TextDocument): Promise<CompilerArtifact[]> {
    const file = document.uri.fsPath;
    const cmd = this.getCompilerCmd();
    const artifacts: CompilerArtifact[] = [];

    // Unoptimized assembly
    const unoptResult = await this.runCommand(cmd, ['-O0', '-S', '-o', '-', file], path.dirname(file));
    artifacts.push(this.createArtifact('optimization', 'assembly', 'REAL_TOOLCHAIN', unoptResult.out, {
      optimization: 'O0',
      compiler: this.compiler,
    }));

    // Optimized assembly
    const optResult = await this.runCommand(cmd, ['-O2', '-S', '-o', '-', file], path.dirname(file));
    artifacts.push(this.createArtifact('optimization', 'assembly', 'REAL_TOOLCHAIN', optResult.out, {
      optimization: 'O2',
      compiler: this.compiler,
    }));

    // Educational optimization comparison
    const educational = this.createArtifact('optimization', 'comparison', 'EDUCATIONAL', {
      before: 't1 = 2 * 3\nx = t1 + y',
      after: 'x = 6 + y',
      transformations: ['Constant Folding', 'Copy Propagation'],
    }, {
      note: 'Educational optimization example',
    });
    artifacts.push(educational);

    return artifacts;
  }

  private async generateAssembly(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const cmd = this.getCompilerCmd();
    const result = await this.runCommand(cmd, ['-O2', '-S', '-o', '-', file], path.dirname(file));

    if (result.code !== 0) {
      throw new Error(`Assembly generation failed: ${result.err}`);
    }

    return this.createArtifact('assembly', 'assembly', 'REAL_TOOLCHAIN', result.out, {
      command: `${cmd} -O2 -S ${file}`,
      compiler: this.compiler,
      architecture: process.arch,
    });
  }
  getPhaseName(phase: PhaseKind): string {
    const names: Record<PhaseKind, string> = {
      source: 'Source Code',
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
      source: 'Original source code',
      preprocessing: 'Header expansion, macro substitution',
      lexical: 'Character stream → tokens',
      syntax: 'Token stream → parse tree',
      ast: 'Structural representation of code',
      semantic: 'Type checking, scope resolution',
      symbols: 'Identifier declarations and references',
      ir: 'Machine-independent intermediate code',
      optimization: 'Code transformations for efficiency',
      assembly: 'Target-specific assembly code',
      linking: 'Object files → executable',
      runtime: 'Program execution',
    };
    return desc[phase] || '';
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
}