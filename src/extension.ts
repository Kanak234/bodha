/**
 * BODHA — Compiler Visualizer
 * Main extension entry point
 * Integrated Terminal execution + Compiler Visualizer
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { ToolchainDetector } from './toolchains/ToolchainDetector';
import { PipelineOrchestrator } from './pipeline/PipelineOrchestrator';
import { CompilerVisualizerPanel } from './visualization/webview/CompilerVisualizerPanel';
import { CAdapter } from './adapters/CAdapter';
import { CppAdapter } from './adapters/CppAdapter';
import { JavaAdapter } from './adapters/JavaAdapter';
import { PythonAdapter } from './adapters/PythonAdapter';
import { LanguageAdapter, LanguageId } from './types';
import { getActiveSourceDocument } from './activeDocumentManager';

let compilerVisualizerPanel: CompilerVisualizerPanel | null = null;
let detector: ToolchainDetector | null = null;
let orchestrator: PipelineOrchestrator | null = null;
let currentAdapter: LanguageAdapter | null = null;
let diagnosticCollection: vscode.DiagnosticCollection | null = null;
let terminal: vscode.Terminal | null = null;
let runningProcess: cp.ChildProcess | null = null;

const TERMINAL_NAME = 'BODHA Terminal';

export function activate(context: vscode.ExtensionContext) {
  console.log('BODHA Compiler Visualizer activating...');

  detector = new ToolchainDetector(context);
  orchestrator = new PipelineOrchestrator(context);

  compilerVisualizerPanel = new CompilerVisualizerPanel(context);
  diagnosticCollection = vscode.languages.createDiagnosticCollection('bodha');

  context.subscriptions.push(diagnosticCollection);

  // Register adapters
  const adapters: Map<LanguageId, LanguageAdapter> = new Map();
  adapters.set('c', new CAdapter(context, detector));
  adapters.set('cpp', new CppAdapter(context, detector));
  adapters.set('java', new JavaAdapter(context, detector));
  adapters.set('python', new PythonAdapter(context, detector));

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bodha.analyze', async () => {
      await analyzeCurrentFile(context, adapters);
    }),
    vscode.commands.registerCommand('bodha.runPipeline', async () => {
      if (currentAdapter) {
        await runPipeline(currentAdapter);
      }
    }),
    vscode.commands.registerCommand('bodha.runCode', async () => {
      await runCodeInTerminal(context, adapters);
    }),
    vscode.commands.registerCommand('bodha.stopExecution', async () => {
      await stopExecution();
    }),
    vscode.commands.registerCommand('bodha.compilerVisualizer', () => {
      compilerVisualizerPanel?.reveal();
      syncActiveDocumentToPanel();
    }),
    vscode.commands.registerCommand('bodha.clearDiagnostics', () => {
      clearDiagnostics();
    }),
    vscode.commands.registerCommand('bodha.explainCompilerError', (error: { message: string; location?: { file: string; line: number; column: number } }) => {
      explainError(error);
    }),
    vscode.commands.registerCommand('bodha.detectToolchains', async () => {
      await detector?.detectAndShow();
    }),
    vscode.commands.registerCommand('bodha.configureToolchain', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'bodha.toolchains');
    }),
    vscode.commands.registerCommand('bodha.exportReport', () => compilerVisualizerPanel?.exportReport()),
    vscode.commands.registerCommand('bodha.showTokens', async () => {
      await analyzeAndShowPhase(context, adapters, 'lexical');
    }),
    vscode.commands.registerCommand('bodha.showAST', async () => {
      await analyzeAndShowPhase(context, adapters, 'ast');
    }),
    vscode.commands.registerCommand('bodha.showSymbolTable', async () => {
      await analyzeAndShowPhase(context, adapters, 'symbols');
    }),
    vscode.commands.registerCommand('bodha.showIR', async () => {
      await analyzeAndShowPhase(context, adapters, 'ir');
    }),
    vscode.commands.registerCommand('bodha.showOptimizations', async () => {
      await analyzeAndShowPhase(context, adapters, 'optimization');
    }),
    vscode.commands.registerCommand('bodha.showCFG', async () => {
      await analyzeAndShowPhase(context, adapters, 'syntax');
    }),
    vscode.commands.registerCommand('bodha.showDataFlow', async () => {
      await analyzeAndShowPhase(context, adapters, 'semantic');
    }),
    vscode.commands.registerCommand('bodha.showAssembly', async () => {
      await analyzeAndShowPhase(context, adapters, 'assembly');
    }),
    vscode.commands.registerCommand('bodha.showRuntime', async () => {
      await analyzeAndShowPhase(context, adapters, 'runtime');
    }),
    vscode.commands.registerCommand('bodha.startTimeline', () => {
      compilerVisualizerPanel?.startTimeline();
    }),
    vscode.commands.registerCommand('bodha.compareStages', () => {
      compilerVisualizerPanel?.compareStages();
    }),

    // Track active editor & document state changes
    vscode.window.onDidChangeActiveTextEditor(() => {
      syncActiveDocumentToPanel();
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      syncActiveDocumentToPanel();
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const activeState = getActiveSourceDocument();
      if (activeState.document && e.document.uri.toString() === activeState.document.uri.toString()) {
        syncActiveDocumentToPanel();
      }
    }),
    vscode.workspace.onDidCloseTextDocument(() => {
      syncActiveDocumentToPanel();
    }),

    // Listen for terminal close
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === terminal) {
        terminal = null;
      }
    }),

    // Debugger Integration Tracker
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker(session: vscode.DebugSession) {
        return {
          onDidSendMessage: (message: any) => {
            if (message && message.type === 'event' && message.event === 'stopped') {
              captureDebugState(session);
            }
          }
        };
      }
    }),
  );

  // Detect toolchains on startup (fire-and-forget)
  detector.detect().catch(console.error);
}

async function captureDebugState(session: vscode.DebugSession): Promise<void> {
  try {
    const threadResponse = await session.customRequest('threads');
    const threads = threadResponse?.threads || [];
    if (!threads.length) return;

    const threadId = threads[0].id;
    const stackResponse = await session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 10 });
    const stackFrames = stackResponse?.stackFrames || [];

    const capturedFrames = [];
    for (const frame of stackFrames) {
      let vars = [];
      try {
        const scopesRes = await session.customRequest('scopes', { frameId: frame.id });
        const scopes = scopesRes?.scopes || [];
        if (scopes.length > 0) {
          const varsRes = await session.customRequest('variables', { variablesReference: scopes[0].variablesReference });
          vars = (varsRes?.variables || []).map((v: any) => ({ name: v.name, value: v.value, type: v.type }));
        }
      } catch {
        vars = [{ name: 'Status', value: 'Unavailable from debugger', type: 'string' }];
      }

      capturedFrames.push({
        id: frame.id,
        name: frame.name,
        source: frame.source?.path || 'unknown',
        line: frame.line,
        column: frame.column,
        variables: vars
      });
    }

    if (compilerVisualizerPanel) {
      compilerVisualizerPanel.pushDebugFrame({
        sessionName: session.name,
        frames: capturedFrames,
        timestamp: Date.now()
      });
    }
  } catch (err) {
    console.warn('Debug state capture notice:', err);
  }
}

function syncActiveDocumentToPanel(): void {
  const activeState = getActiveSourceDocument();
  if (compilerVisualizerPanel) {
    compilerVisualizerPanel.setActiveDocument({
      fsPath: activeState.fsPath,
      languageId: activeState.languageId,
      text: activeState.text,
      isSupported: activeState.isSupported,
      unsupportedLang: activeState.unsupportedLang,
    });
  }
}

async function analyzeAndShowPhase(
  context: vscode.ExtensionContext,
  adapters: Map<LanguageId, LanguageAdapter>,
  targetPhase: string
): Promise<void> {
  const activeState = getActiveSourceDocument();
  if (!activeState.document) {
    vscode.window.showWarningMessage('Open a source file first (C, C++, Java, or Python).');
    return;
  }

  if (!activeState.isSupported) {
    vscode.window.showErrorMessage(`Unsupported file type: ${activeState.languageId}. BODHA supports C, C++, Java, and Python.`);
    return;
  }

  const langId = activeState.languageId as LanguageId;
  const adapter = adapters.get(langId);

  if (!adapter) {
    vscode.window.showErrorMessage(`Language ${langId} not supported yet.`);
    return;
  }

  if (activeState.document.isDirty) {
    const saved = await activeState.document.save();
    if (!saved) { return; }
  }

  currentAdapter = adapter;
  compilerVisualizerPanel?.reveal();
  syncActiveDocumentToPanel();

  try {
    const result = await adapter.analyze(activeState.document);
    compilerVisualizerPanel?.setAnalysisResult(result);
    compilerVisualizerPanel?.showPhase(targetPhase);
    compilerVisualizerPanel?.setLanguageContext(langId);
    vscode.commands.executeCommand('setContext', 'bodha.panelVisible', true);
  } catch (error) {
    vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
    console.error(error);
  }
}

function getOrCreateTerminal(): vscode.Terminal {
  // Reuse existing terminal if it's still alive
  if (terminal) {
    // Check if terminal is still in the list
    const found = vscode.window.terminals.find(t => t === terminal);
    if (found) {
      return terminal;
    }
    terminal = null;
  }

  terminal = vscode.window.createTerminal({
    name: TERMINAL_NAME,
    iconPath: new vscode.ThemeIcon('play'),
  });
  return terminal;
}

async function runCodeInTerminal(context: vscode.ExtensionContext, adapters: Map<LanguageId, LanguageAdapter>): Promise<void> {
  const activeState = getActiveSourceDocument();
  if (!activeState.document) {
    vscode.window.showWarningMessage('Open a source file first (C, C++, Java, or Python).');
    return;
  }

  if (!activeState.isSupported) {
    vscode.window.showErrorMessage(`Unsupported file type: ${activeState.languageId}. BODHA supports C, C++, Java, and Python.`);
    return;
  }

  const langId = activeState.languageId as LanguageId;
  const adapter = adapters.get(langId);

  if (!adapter) {
    vscode.window.showErrorMessage(`Language ${langId} not supported yet.`);
    return;
  }

  if (activeState.document.isDirty) {
    const saved = await activeState.document.save();
    if (!saved) { return; }
  }

  const filePath = activeState.document.uri.fsPath;
  const cwd = path.dirname(filePath);
  const fileName = path.basename(filePath);

  // Build compile + run command for terminal
  let command: string;

  switch (langId) {
    case 'c': {
      const compiler = vscode.workspace.getConfiguration('bodha.toolchains').get<string>('c', 'gcc');
      command = `cd "${cwd}" && ${compiler} -g -Wall "${fileName}" -o a.out && echo "\\n--- BODHA: Running ---\\n" && ./a.out`;
      break;
    }
    case 'cpp': {
      const compiler = vscode.workspace.getConfiguration('bodha.toolchains').get<string>('cpp', 'g++');
      command = `cd "${cwd}" && ${compiler} -g -Wall "${fileName}" -o a.out && echo "\\n--- BODHA: Running ---\\n" && ./a.out`;
      break;
    }
    case 'java': {
      const javac = vscode.workspace.getConfiguration('bodha.toolchains').get<string>('java', 'javac');
      const java = vscode.workspace.getConfiguration('bodha.toolchains').get<string>('javaRuntime', 'java');
      const className = path.basename(filePath, '.java');
      command = `cd "${cwd}" && ${javac} "${fileName}" && echo "\\n--- BODHA: Running ---\\n" && ${java} ${className}`;
      break;
    }
    case 'python': {
      const python = vscode.workspace.getConfiguration('bodha.toolchains').get<string>('python', 'python3');
      command = `cd "${cwd}" && echo "--- BODHA: Running ---\\n" && ${python} "${fileName}"`;
      break;
    }
    default:
      vscode.window.showErrorMessage(`Language ${langId} not supported for terminal execution.`);
      return;
  }

  // Use integrated terminal for execution
  const term = getOrCreateTerminal();
  term.show(true);
  term.sendText(command);

  vscode.window.showInformationMessage(`BODHA: Running ${fileName} in ${TERMINAL_NAME}`);

  // Also run compilation in the background to capture diagnostics
  await captureCompilerDiagnostics(langId, filePath, cwd);

  // Update context
  vscode.commands.executeCommand('setContext', 'bodha.panelVisible', true);
}

async function captureCompilerDiagnostics(
  langId: LanguageId,
  filePath: string,
  cwd: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration('bodha.toolchains');
  let compileCmd: string;
  let compileArgs: string[];

  switch (langId) {
    case 'c': {
      const compiler = config.get<string>('c', 'gcc');
      compileCmd = compiler;
      compileArgs = ['-fsyntax-only', '-Wall', '-Wextra', filePath];
      break;
    }
    case 'cpp': {
      const compiler = config.get<string>('cpp', 'g++');
      compileCmd = compiler;
      compileArgs = ['-fsyntax-only', '-Wall', '-Wextra', filePath];
      break;
    }
    case 'java': {
      const javac = config.get<string>('java', 'javac');
      compileCmd = javac;
      compileArgs = ['-Xlint:all', filePath];
      break;
    }
    case 'python': {
      const python = config.get<string>('python', 'python3');
      compileCmd = python;
      compileArgs = ['-m', 'py_compile', filePath];
      break;
    }
    default:
      return;
  }

  try {
    const result = await runCommandAsync(compileCmd, compileArgs, cwd);
    const combinedOutput = result.stdout + '\n' + result.stderr;
    parseAndShowDiagnostics(combinedOutput, filePath, langId);
  } catch {
    // Ignore — compilation errors are expected and handled via output parsing
  }
}

function runCommandAsync(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = cp.spawn(cmd, args, { cwd, shell: false });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code: number) => resolve({ stdout, stderr, code: code ?? -1 }));
    child.on('error', (e: Error) => resolve({ stdout: '', stderr: e.message, code: -1 }));
  });
}

function parseAndShowDiagnostics(output: string, sourceFile: string, _language: LanguageId): void {
  const diagnostics: vscode.Diagnostic[] = [];
  const uri = vscode.Uri.file(sourceFile);

  const lines = output.split('\n');

  // GCC/Clang pattern: file.c:line:column: error/warning: message
  const gccPattern = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/;
  // Java pattern: file.java:line: error: message
  const javaPattern = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.+)$/;
  // Python pattern: File "file.py", line N
  const pythonPattern = /^\s*File "(.+?)", line (\d+)/;
  // Python SyntaxError: file.py:line:column: SyntaxError: message
  const pythonSyntaxPattern = /^\s*(.+?\.py):(\d+):(\d+):\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { continue; }

    let match: RegExpExecArray | RegExpMatchArray | null;

    // GCC/Clang format
    match = line.match(gccPattern);
    if (match) {
      const [, , lineNum, colNum, severity, message] = match;
      const lineIdx = Math.max(0, parseInt(lineNum, 10) - 1);
      const colIdx = Math.max(0, parseInt(colNum, 10) - 1);

      const range = new vscode.Range(lineIdx, colIdx, lineIdx, colIdx + 1);
      const sev = severity === 'error' ? vscode.DiagnosticSeverity.Error
        : severity === 'warning' ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

      const diag = new vscode.Diagnostic(range, message, sev);
      diag.source = 'BODHA';
      diagnostics.push(diag);
      continue;
    }

    // Java format
    match = line.match(javaPattern);
    if (match) {
      const [, , lineNum, severity, message] = match;
      const lineIdx = Math.max(0, parseInt(lineNum, 10) - 1);

      const range = new vscode.Range(lineIdx, 0, lineIdx, 1);
      const sev = severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;

      const diag = new vscode.Diagnostic(range, message, sev);
      diag.source = 'BODHA';
      diagnostics.push(diag);
      continue;
    }

    // Python SyntaxError format
    match = line.match(pythonSyntaxPattern);
    if (match) {
      const [, , lineNum, colNum, message] = match;
      const lineIdx = Math.max(0, parseInt(lineNum, 10) - 1);
      const colIdx = Math.max(0, parseInt(colNum, 10) - 1);
      const range = new vscode.Range(lineIdx, colIdx, lineIdx, colIdx + 1);
      const diag = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
      diag.source = 'BODHA';
      diagnostics.push(diag);
      continue;
    }

    // Python traceback
    match = line.match(pythonPattern);
    if (match) {
      const [, , lineNum] = match;
      const lineIdx = Math.max(0, parseInt(lineNum, 10) - 1);
      let message = 'Error at this location';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const rawLine = lines[j];
        const errLine = rawLine.trim();
        if (errLine && !errLine.startsWith('File ') && !errLine.startsWith('^')) {
          if (rawLine.search(/\S/) === 0 || errLine.includes('Error:') || errLine.includes('Exception:')) {
            message = errLine;
            break;
          }
        }
      }

      const range = new vscode.Range(lineIdx, 0, lineIdx, 1);
      const diag = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
      diag.source = 'BODHA';
      diagnostics.push(diag);
      continue;
    }
  }

  // Set diagnostics on the file URI
  if (diagnosticCollection) {
    diagnosticCollection.set(uri, diagnostics);
  }
}

function clearDiagnostics(): void {
  if (diagnosticCollection) {
    diagnosticCollection.clear();
  }
}

async function stopExecution(): Promise<void> {
  // Kill running background process if any
  if (runningProcess && !runningProcess.killed) {
    runningProcess.kill('SIGTERM');
    runningProcess = null;
    vscode.window.showInformationMessage('BODHA: Process terminated.');
    return;
  }

  // Send Ctrl+C to the terminal
  if (terminal) {
    terminal.sendText('\x03', false); // Send Ctrl+C
    vscode.window.showInformationMessage('BODHA: Sent interrupt signal to terminal.');
  } else {
    vscode.window.showWarningMessage('No process currently running.');
  }
}

function explainError(error: { message: string; location?: { file: string; line: number; column: number } }): void {
  // Create a detailed output channel with explanation
  const output = vscode.window.createOutputChannel('BODHA Error Explanation');
  output.show(true);

  output.appendLine('═══════════════════════════════════════════════');
  output.appendLine('  BODHA — Compiler Error Explanation');
  output.appendLine('═══════════════════════════════════════════════');
  output.appendLine('');
  output.appendLine(`  Error: ${error.message}`);

  if (error.location) {
    output.appendLine(`  Location: ${error.location.file}:${error.location.line}:${error.location.column}`);
    output.appendLine('');
    output.appendLine('  What happened:');
    output.appendLine(`    The compiler encountered an error at line ${error.location.line}, column ${error.location.column}.`);
    output.appendLine('');
    output.appendLine('  Suggested actions:');
    output.appendLine('    1. Check the indicated line for syntax errors');
    output.appendLine('    2. Look for missing semicolons, brackets, or parentheses');
    output.appendLine('    3. Verify variable/function declarations');
    output.appendLine('    4. Check for type mismatches');
  } else {
    output.appendLine('');
    output.appendLine('  No location information available.');
    output.appendLine('  This may be a linker error or configuration issue.');
  }

  output.appendLine('');
  output.appendLine('═══════════════════════════════════════════════');
}

async function analyzeCurrentFile(
  context: vscode.ExtensionContext,
  adapters: Map<LanguageId, LanguageAdapter>
): Promise<void> {
  const activeState = getActiveSourceDocument();
  if (!activeState.document) {
    vscode.window.showWarningMessage('Open a source file first (C, C++, Java, or Python).');
    return;
  }

  if (!activeState.isSupported) {
    vscode.window.showErrorMessage(`Unsupported file type: ${activeState.languageId}. BODHA supports C, C++, Java, and Python.`);
    return;
  }

  const langId = activeState.languageId as LanguageId;
  const adapter = adapters.get(langId);

  if (!adapter) {
    vscode.window.showErrorMessage(`Language ${langId} not supported yet.`);
    return;
  }

  if (activeState.document.isDirty) {
    const saved = await activeState.document.save();
    if (!saved) { return; }
  }

  currentAdapter = adapter;
  compilerVisualizerPanel?.reveal();
  syncActiveDocumentToPanel();

  try {
    const result = await adapter.analyze(activeState.document);
    compilerVisualizerPanel?.setAnalysisResult(result);
    compilerVisualizerPanel?.setLanguageContext(langId);
    vscode.commands.executeCommand('setContext', 'bodha.panelVisible', true);

    // Also capture diagnostics
    const filePath = activeState.document.uri.fsPath;
    const cwd = path.dirname(filePath);
    await captureCompilerDiagnostics(langId, filePath, cwd);

    // Show errors from the pipeline
    if (result.errors.length > 0) {
      const errorDiags: vscode.Diagnostic[] = result.errors
        .filter(e => e.location)
        .map(e => {
          const lineIdx = Math.max(0, (e.location!.line || 1) - 1);
          const colIdx = Math.max(0, (e.location!.column || 1) - 1);
          const range = new vscode.Range(lineIdx, colIdx, lineIdx, colIdx + 1);
          const sev = e.severity === 'error' ? vscode.DiagnosticSeverity.Error
            : e.severity === 'warning' ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information;
          const diag = new vscode.Diagnostic(range, `[${e.phase}] ${e.message}`, sev);
          diag.source = 'BODHA';
          return diag;
        });

      if (errorDiags.length > 0 && diagnosticCollection) {
        const uri = vscode.Uri.file(filePath);
        const existing = diagnosticCollection.get(uri) || [];
        diagnosticCollection.set(uri, [...existing, ...errorDiags]);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
    console.error(error);
  }
}

async function runPipeline(adapter: LanguageAdapter): Promise<void> {
  if (!orchestrator) { return; }
  try {
    const result = await orchestrator.run(adapter);
    compilerVisualizerPanel?.setPipelineArtifacts(result.artifacts);
  } catch (error) {
    vscode.window.showErrorMessage(`Pipeline failed: ${(error as Error).message}`);
    console.error(error);
  }
}

export function deactivate() {
  if (compilerVisualizerPanel) {
    compilerVisualizerPanel.dispose();
    compilerVisualizerPanel = null;
  }
  if (diagnosticCollection) {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
    diagnosticCollection = null;
  }
  if (runningProcess && !runningProcess.killed) {
    runningProcess.kill('SIGTERM');
    runningProcess = null;
  }
}