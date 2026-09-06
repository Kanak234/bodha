/**
 * Python Language Adapter
 * Supports CPython toolchain: ast, dis, compile
 */

import * as vscode from 'vscode';
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

export class PythonAdapter extends BaseLanguageAdapter {
  readonly language: LanguageId = 'python';
  readonly capabilities: AdapterCapabilities = {
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

  private python: string = 'python3';

  async analyze(document: vscode.TextDocument): Promise<PipelineResult> {
    await this.resolveTools();
    return super.analyze(document);
  }

  private async resolveTools(): Promise<void> {
    const config = vscode.workspace.getConfiguration('bodha.toolchains');
    this.python = config.get<string>('python', 'python3');
  }

  getEnabledPhases(): PhaseKind[] {
    return [
      'source',
      'lexical',
      'syntax',
      'ast',
      'symbols',
      'ir',
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
      toolchain: `python3 (CPython)`,
      durationMs: Date.now() - startTime,
      success: !error,
      error,
    };
  }

  private async tokenize(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const script = `
import tokenize
import sys

with open(sys.argv[1], 'rb') as f:
    tokens = list(tokenize.tokenize(f.readline))
    for tok in tokens:
        print(f"{tok.type:10} {tokenize.tok_name.get(tok.type, tok.type):15} {tok.string!r:20} {tok.start} {tok.end}")
`;

    const result = await this.runCommand(this.python, ['-c', script, file]);

    if (result.code !== 0) {
      return this.createEducationalPythonTokens(document);
    }

    return this.createArtifact('lexical', 'tokens', 'REAL_TOOLCHAIN', result.out, {
      tool: 'tokenize module',
      file,
    });
  }

  private createEducationalPythonTokens(document: vscode.TextDocument): CompilerArtifact {
    const text = document.getText();
    const resultTokens: any[] = [];

    const patterns = [
      { pattern: /\b(def|class|if|else|elif|while|for|return|import|from|as|try|except|finally|with|lambda|yield|global|nonlocal|pass|break|continue|raise|assert|del|in|is|not|and|or)\b/g, type: 'KEYWORD' },
      { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, type: 'NAME' },
      { pattern: /\b([0-9]+)\b/g, type: 'NUMBER' },
      { pattern: /["']([^"']*)["']/g, type: 'STRING' },
      { pattern: /[+\-*/%=<>&|^!~]/g, type: 'OP' },
      { pattern: /[;,(){}[\].:]/g, type: 'PUNCTUATION' },
    ];

    const tokens: any[] = [];
    let pos = 0;
    while (pos < text.length) {
      if (/\s/.test(text[pos])) { pos++; continue; }
      if (text.startsWith('#', pos)) { pos = text.indexOf('\n', pos); if (pos === -1) break; pos++; continue; }

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
      note: 'Educational tokenization (using simple regex)',
    });
  }

  private async generateAST(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const script = `
import ast
import sys
import json

with open(sys.argv[1], 'r') as f:
    code = f.read()

tree = ast.parse(code)

def node_to_dict(node):
    if isinstance(node, ast.AST):
        result = {'type': node.__class__.__name__}
        for field, value in ast.iter_fields(node):
            result[field] = node_to_dict(value)
        if hasattr(node, 'lineno'):
            result['lineno'] = node.lineno
        if hasattr(node, 'col_offset'):
            result['col_offset'] = node.col_offset
        return result
    elif isinstance(node, list):
        return [node_to_dict(item) for item in node]
    else:
        return node

print(json.dumps(node_to_dict(tree), indent=2))
`;

    const result = await this.runCommand(this.python, ['-c', script, file]);

    if (result.code !== 0) {
      return this.createEducationalPythonAST(document);
    }

    return this.createArtifact('ast', 'ast', 'REAL_TOOLCHAIN', result.out, {
      tool: 'ast module',
      file,
      format: 'JSON',
    });
  }

  private createEducationalPythonAST(document: vscode.TextDocument): CompilerArtifact {
    const text = document.getText();
    const ast: any = { type: 'Module', body: [] };

    const imports = text.match(/^(?:from\s+\S+\s+)?import\s+.+/gm) || [];
    const functions = text.match(/^def\s+\w+\s*\([^)]*\):/gm) || [];
    const classes = text.match(/^class\s+\w+(?:\s*\([^)]*\))?:/gm) || [];

    ast.body = [
      ...imports.map(i => ({ type: 'Import', text: i.trim() })),
      ...classes.map(c => ({ type: 'ClassDef', name: c.match(/class\s+(\w+)/)?.[1] })),
      ...functions.map(f => ({ type: 'FunctionDef', name: f.match(/def\s+(\w+)/)?.[1] })),
    ];

    return this.createArtifact('ast', 'ast', 'EDUCATIONAL', ast, {
      note: 'Educational Python AST (simplified)',
    });
  }

  private async extractSymbols(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const script = `
import ast
import sys

with open(sys.argv[1], 'r') as f:
    code = f.read()

tree = ast.parse(code)

symbols = []

class SymbolVisitor(ast.NodeVisitor):
    def visit_FunctionDef(self, node):
        symbols.append({
            'name': node.name,
            'kind': 'function',
            'lineno': node.lineno,
            'args': [arg.arg for arg in node.args.args],
        })
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        symbols.append({
            'name': node.name,
            'kind': 'class',
            'lineno': node.lineno,
            'bases': [base.id if isinstance(base, ast.Name) else str(base) for base in node.bases],
        })
        self.generic_visit(node)

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Store):
            symbols.append({
                'name': node.id,
                'kind': 'variable',
                'lineno': node.lineno,
            })

SymbolVisitor().visit(tree)

import json
print(json.dumps(symbols, indent=2))
`;

    const result = await this.runCommand(this.python, ['-c', script, file]);

    if (result.code !== 0) {
      return this.createEducationalPythonSymbols(document);
    }

    return this.createArtifact('symbols', 'symbols', 'REAL_TOOLCHAIN', result.out, {
      tool: 'ast module (symbol extraction)',
      file,
    });
  }

  private createEducationalPythonSymbols(document: vscode.TextDocument): CompilerArtifact {
    const text = document.getText();
    const symbols: any[] = [];

    const funcMatches = text.match(/^def\s+(\w+)\s*\(/gm) || [];
    for (const m of funcMatches) {
      symbols.push({ name: m.replace('def ', '').replace('(', ''), kind: 'function' });
    }

    const classMatches = text.match(/^class\s+(\w+)/gm) || [];
    for (const m of classMatches) {
      symbols.push({ name: m.replace('class ', ''), kind: 'class' });
    }

    return this.createArtifact('symbols', 'symbols', 'EDUCATIONAL', symbols, {
      note: 'Educational symbol extraction',
    });
  }

  private async generateBytecode(document: vscode.TextDocument): Promise<CompilerArtifact> {
    const file = document.uri.fsPath;
    const script = `
import dis
import sys

with open(sys.argv[1], 'r') as f:
    code = f.read()

dis.dis(code)
`;

    const result = await this.runCommand(this.python, ['-c', script, file]);

    if (result.code !== 0) {
      throw new Error(`Bytecode generation failed: ${result.err}`);
    }

    return this.createArtifact('ir', 'bytecode', 'REAL_TOOLCHAIN', result.out, {
      tool: 'dis module',
      file,
      format: 'CPython Bytecode',
    });
  }

  private async runtimeInfo(_document: vscode.TextDocument): Promise<CompilerArtifact> {
    const result = await this.runCommand(this.python, ['--version']);
    const versionInfo = result.out || result.err;

    return this.createArtifact('runtime', 'runtime', 'REAL_TOOLCHAIN', {
      interpreter: versionInfo.trim(),
      implementation: 'CPython',
      note: 'Run with `python -m trace --trace` for execution trace',
    }, { tool: 'python' });
  }

  getPhaseName(phase: PhaseKind): string {
    const names: Record<PhaseKind, string> = {
      source: 'Python Source',
      preprocessing: 'No Preprocessing (Python)',
      lexical: 'Lexical Analysis (tokenize)',
      syntax: 'Syntax Analysis',
      ast: 'Abstract Syntax Tree (ast)',
      semantic: 'Semantic Analysis',
      symbols: 'Symbol Table (ast)',
      ir: 'CPython Bytecode (dis)',
      optimization: 'Optimization (peephole)',
      assembly: 'Bytecode',
      linking: 'Module Loading',
      runtime: 'CPython VM',
    };
    return names[phase] || phase;
  }

  getPhaseDescription(phase: PhaseKind): string {
    const desc: Record<PhaseKind, string> = {
      source: 'Python source code (.py)',
      preprocessing: 'No preprocessing phase in Python',
      lexical: 'Character stream → tokens (tokenize module)',
      syntax: 'Token stream → parse tree (ast.parse)',
      ast: 'Structural representation (ast module JSON)',
      semantic: 'Name resolution, type hints (not enforced at runtime)',
      symbols: 'Functions, classes, variables from AST',
      ir: 'CPython bytecode (stack-based VM instructions)',
      optimization: 'Peephole optimizer (compile-time)',
      assembly: 'Bytecode disassembly (dis module)',
      linking: 'Import system, module resolution',
      runtime: 'CPython VM: interpreter → bytecode execution',
    };
    return desc[phase] || '';
  }

  getPhaseCommand(phase: PhaseKind): string | null {
    return createPhaseCommands({
      preprocessing: null,
      lexical: `${this.python} -m tokenize`,
      syntax: `${this.python} -m py_compile`,
      ast: `${this.python} -c "import ast; print(ast.dump(ast.parse(open('file').read())))"`,
      semantic: null,
      symbols: `${this.python} -c "import ast; ..."`,
      ir: `${this.python} -m dis`,
      optimization: `${this.python} -O`,
      assembly: `${this.python} -m dis`,
      linking: null,
      runtime: `${this.python}`,
      source: null,
    })[phase];
  }
}