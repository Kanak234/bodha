/**
 * Java Language Adapter
 * Supports javac, java, javap toolchain
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

// Helper to create a properly typed phase command record
function createPhaseCommands(
  commands: Partial<Record<PhaseKind, string | null>>
): Record<PhaseKind, string | null> {
  const allPhases: PhaseKind[] = [
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
    'linking',
    'runtime',
  ];
  const result: Record<PhaseKind, string | null> = {} as Record<PhaseKind, string | null>;
  for (const phase of allPhases) {
    result[phase] = commands[phase] ?? null;
  }
  return result;
}

export class JavaAdapter extends BaseLanguageAdapter {
  readonly language: LanguageId = 'java';
  readonly capabilities: AdapterCapabilities = {
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

  private javac: string = 'javac';
  private java: string = 'java';
  private javap: string = 'javap';

  async analyze(document: vscode.TextDocument): Promise<PipelineResult> {
    await this.resolveTools();
    return super.analyze(document);
  }

  private async resolveTools(): Promise<void> {
    const config = vscode.workspace.getConfiguration('bodha.toolchains');
    this.javac = config.get<string>('java', 'javac');
    this.java = config.get<string>('javaRuntime', 'java');
    this.javap = config.get<string>('javap', 'javap');
  }

  getEnabledPhases(): PhaseKind[] {
    return [
      'source',
      'lexical',
      'syntax',
      'ast',
      'semantic',
      'symbols',
      'ir',
      'assembly',
      'runtime',
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
        case 'lexical': {
          const artifact = await this.extractTokens(document);
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
          const artifact = await this.semanticAnalysis(document);
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
          const artifact = await this.generateBytecode(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'assembly': {
          const artifact = await this.disassemble(document);
          artifacts.set(artifact.id, artifact);
          outputIds.push(artifact.id);
          break;
        }
        case 'runtime': {
          const artifact = await this.runtimeInfo(document);
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
      toolchain: `javac/java/javap`,
      durationMs: Date.now() - startTime,
      success: !error,
      error,
    };
  }

  private async extractTokens(document: vscode.TextDocument): Promise<CompilerArtifact> {
    // Educational tokenization for Java
    const text = document.getText();
    const resultTokens: any[] = [];

    const patterns = [
      { pattern: /\b(public|private|protected|static|final|class|interface|extends|implements|new|this|super|return|if|else|while|for|switch|case|default|break|continue|try|catch|finally|throw|throws|import|package)\b/g, type: 'KEYWORD' },
      { pattern: /\b(int|long|short|byte|float|double|char|boolean|void|String)\b/g, type: 'TYPE' },
      { pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g, type: 'IDENTIFIER' },
      { pattern: /\b([0-9]+[Ll]?|[0-9]*\.[0-9]+[fFdD]?)\b/g, type: 'LITERAL' },
      { pattern: /["']([^"']*)["']/g, type: 'STRING' },
      { pattern: /[+\-*/%=<>&|^!~]/g, type: 'OPERATOR' },
      { pattern: /[;,(){}[\].]/g, type: 'PUNCTUATION' },
    ];

    const tokens: any[] = [];
    let pos = 0;
    while (pos < text.length) {
      if (/\s/.test(text[pos])) { pos++; continue; }
      if (text.startsWith('//', pos)) { pos = text.indexOf('\n', pos); if (pos === -1) break; pos++; continue; }
      if (text.startsWith('/*', pos)) { pos = text.indexOf('*/', pos); if (pos === -1) break; pos += 2; continue; }

      let matched = false;
      for (const { pattern, type } of patterns) {
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

    return this.createArtifact('lexical', 'tokens', 'EDUCATIONAL', resultTokens, {
      note: 'Educational Java tokenization (javac does not expose token stream directly)',
    });
  }

  private async generateAST(document: vscode.TextDocument): Promise<CompilerArtifact> {
    // Java doesn't expose AST directly from javac
    // Use educational model
    const text = document.getText();
    return this.createEducationalJavaAST(text);
  }

  private createEducationalJavaAST(text: string): CompilerArtifact {
    const classes = text.match(/class\s+(\w+)\s*(?:extends\s+\w+)?\s*(?:implements\s+[\w,\s]+)?\s*\{/g) || [];
    const methods = text.match(/(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\([^)]*\)\s*\{/g) || [];

    const ast = {
      type: 'CompilationUnit',
      package: text.match(/package\s+([\w.]+);/)?.[1] || 'default',
      imports: text.match(/import\s+[\w.]+;/g) || [],
      classes: classes.map(c => ({
        type: 'ClassDecl',
        name: c.match(/class\s+(\w+)/)?.[1],
        modifiers: c.match(/(public|private|protected|abstract|final)/g) || [],
        methods: methods.map(m => ({
          type: 'MethodDecl',
          signature: m.trim(),
        }))
      })),
    };

    return this.createArtifact('ast', 'ast', 'EDUCATIONAL', ast, {
      note: 'Educational Java AST (javac does not expose AST directly)',
    });
  }

  private async semanticAnalysis(document: vscode.TextDocument): Promise<CompilerArtifact> {
    // Compile with -g to get debug info
    const file = document.uri.fsPath;
    const dir = path.dirname(file);
    const result = await this.runCommand(this.javac, ['-g', file], dir);

    if (result.code !== 0) {
      return this.createArtifact('semantic', 'semantic', 'EDUCATIONAL', {
        errors: result.err,
      }, { note: 'Compilation failed - educational semantic info only' });
    }

    return this.createArtifact('semantic', 'semantic', 'REAL_TOOLCHAIN', {
      status: 'Compiled successfully with debug info (-g)',
      note: 'Type checking, overload resolution, definite assignment analysis performed by javac',
    }, { compiler: 'javac' });
  }

  private async extractSymbols(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const className = path.basename(file, '.java');
    const dir = path.dirname(file);

    const compileResult = await this.runCommand(this.javac, ['-g', file], dir);
    if (compileResult.code !== 0) {
      return this.createEducationalJavaSymbols(document.getText());
    }

    // Use javap to inspect class file
    const classFile = path.join(dir, `${className}.class`);
    const javapResult = await this.runCommand(this.javap, ['-v', '-p', classFile]);

    if (javapResult.code === 0) {
      return this.createArtifact('symbols', 'symbols', 'REAL_TOOLCHAIN', javapResult.out, {
        tool: 'javap',
        classFile,
      });
    }

    return this.createEducationalJavaSymbols(document.getText());
  }

  private createEducationalJavaSymbols(text: string): CompilerArtifact {
    const symbols: any[] = [];

    // Extract class names
    const classMatches = text.match(/class\s+(\w+)/g) || [];
    for (const m of classMatches) {
      symbols.push({ name: m.replace('class ', ''), kind: 'class', type: 'class' });
    }

    // Extract method signatures
    const methodMatches = text.match(/(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\([^)]*\)/g) || [];
    for (const m of methodMatches) {
      symbols.push({ name: m.trim(), kind: 'method', type: 'method' });
    }

    // Extract fields
    const fieldMatches = text.match(/(private|protected|public)?\s*(static)?\s*(final)?\s*\w+\s+\w+\s*[=;]/g) || [];
    for (const m of fieldMatches) {
      symbols.push({ name: m.trim(), kind: 'field', type: 'field' });
    }

    return this.createArtifact('symbols', 'symbols', 'EDUCATIONAL', symbols, {
      note: 'Educational symbol table (javac does not expose symbol table directly)',
    });
  }

  private async generateBytecode(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const className = path.basename(file, '.java');
    const dir = path.dirname(file);

    const compileResult = await this.runCommand(this.javac, ['-g', file], dir);
    if (compileResult.code !== 0) {
      throw new Error(`Compilation failed: ${compileResult.err}`);
    }

    const classFile = path.join(dir, `${className}.class`);
    const javapResult = await this.runCommand(this.javap, ['-c', '-l', '-p', classFile]);

    if (javapResult.code !== 0) {
      throw new Error(`javap failed: ${javapResult.err}`);
    }

    return this.createArtifact('ir', 'bytecode', 'REAL_TOOLCHAIN', javapResult.out, {
      tool: 'javap',
      classFile,
      format: 'JVM Bytecode',
    });
  }

  private async disassemble(document: vscode.TextDocument): Promise<CompilerArtifact> {
    return this.generateBytecode(document);
  }

  private async runtimeInfo(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const className = path.basename(file, '.java');

    // Run with basic JVM info
    const result = await this.runCommand(this.java, ['-version']);
    const jvmInfo = result.err || result.out;

    return this.createArtifact('runtime', 'runtime', 'REAL_TOOLCHAIN', {
      jvm: jvmInfo.trim(),
      mainClass: className,
      note: 'Run with `java -verbose:class -verbose:gc` for detailed runtime info',
    }, { tool: 'java' });
  }

  getPhaseName(phase: PhaseKind): string {
    const names: Record<PhaseKind, string> = {
      source: 'Java Source',
      preprocessing: 'No Preprocessing (Java)',
      lexical: 'Lexical Analysis',
      syntax: 'Syntax Analysis',
      ast: 'Abstract Syntax Tree',
      semantic: 'Semantic Analysis',
      symbols: 'Symbol Table / Class Info',
      ir: 'JVM Bytecode',
      optimization: 'JIT Optimization (runtime)',
      assembly: 'Bytecode Disassembly',
      linking: 'Class Loading',
      runtime: 'JVM Runtime',
    };
    return names[phase] || phase;
  }

  getPhaseDescription(phase: PhaseKind): string {
    const desc: Record<PhaseKind, string> = {
      source: 'Java source code (.java)',
      preprocessing: 'No preprocessing phase in Java',
      lexical: 'Character stream → Java tokens (keywords, identifiers, literals)',
      syntax: 'Token stream → parse tree (classes, methods, statements)',
      ast: 'Structural representation (compilation unit, classes, methods)',
      semantic: 'Type checking, definite assignment, overload resolution',
      symbols: 'Class, method, field symbols from .class file',
      ir: 'JVM bytecode (.class file) - stack-based instructions',
      optimization: 'JIT compilation, hotspot optimization at runtime',
      assembly: 'Bytecode disassembly (javap -c)',
      linking: 'Dynamic class loading, resolution, verification',
      runtime: 'JVM execution: interpreter → JIT → native code',
    };
    return desc[phase] || '';
  }

  getPhaseCommand(phase: PhaseKind): string | null {
    return createPhaseCommands({
      preprocessing: null,
      lexical: null,
      syntax: null,
      ast: null,
      semantic: `${this.javac} -g`,
      symbols: `${this.javap} -v -p`,
      ir: `${this.javac} && ${this.javap} -c`,
      optimization: null,
      assembly: `${this.javap} -c`,
      linking: null,
      runtime: `${this.java}`,
      source: null,
    })[phase];
  }
}