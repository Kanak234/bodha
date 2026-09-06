/**
 * BODHA Code Runner & Terminal Engine
 * Authoritative terminal execution engine supporting Code Runner & VYUHA workflow patterns.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { LanguageId } from '../types';

export interface ExecutionResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class CodeRunner {
  private static terminal: vscode.Terminal | null = null;
  private static currentProcess: cp.ChildProcess | null = null;

  /**
   * Get or create the authoritative BODHA VS Code Integrated Terminal
   */
  public static getTerminal(): vscode.Terminal {
    if (this.terminal) {
      const activeTerminals = vscode.window.terminals;
      if (activeTerminals.includes(this.terminal)) {
        return this.terminal;
      }
      this.terminal = null;
    }

    this.terminal = vscode.window.createTerminal({
      name: 'BODHA Terminal',
      iconPath: new vscode.ThemeIcon('play'),
    });
    return this.terminal;
  }

  /**
   * Build compiler and execution commands for supported languages
   */
  public static getCompileAndRunCommand(
    language: LanguageId,
    filePath: string,
    toolchainConfig?: { c?: string; cpp?: string; java?: string; python?: string }
  ): { compileCmd?: string; runCmd: string; fullCmd: string; cwd: string; executablePath?: string } {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    const cCompiler = toolchainConfig?.c || 'gcc';
    const cppCompiler = toolchainConfig?.cpp || 'g++';
    const javacCmd = toolchainConfig?.java || 'javac';
    const pythonCmd = toolchainConfig?.python || 'python3';

    if (language === 'c') {
      const outExe = process.platform === 'win32' ? `${baseName}.exe` : `./${baseName}.out`;
      const compileCmd = `${cCompiler} -g "${fileName}" -o "${outExe}"`;
      const runCmd = `${outExe}`;
      return {
        compileCmd,
        runCmd,
        fullCmd: `${compileCmd} && ${runCmd}`,
        cwd: dir,
        executablePath: path.join(dir, outExe),
      };
    } else if (language === 'cpp') {
      const outExe = process.platform === 'win32' ? `${baseName}.exe` : `./${baseName}.out`;
      const compileCmd = `${cppCompiler} -g "${fileName}" -o "${outExe}"`;
      const runCmd = `${outExe}`;
      return {
        compileCmd,
        runCmd,
        fullCmd: `${compileCmd} && ${runCmd}`,
        cwd: dir,
        executablePath: path.join(dir, outExe),
      };
    } else if (language === 'java') {
      const compileCmd = `${javacCmd} "${fileName}"`;
      const runCmd = `java -cp . "${baseName}"`;
      return {
        compileCmd,
        runCmd,
        fullCmd: `${compileCmd} && ${runCmd}`,
        cwd: dir,
        executablePath: path.join(dir, `${baseName}.class`),
      };
    } else if (language === 'python') {
      const runCmd = `${pythonCmd} -u "${fileName}"`;
      return {
        runCmd,
        fullCmd: runCmd,
        cwd: dir,
      };
    }

    throw new Error(`Unsupported language for execution: ${language}`);
  }

  /**
   * Run code in the VS Code Integrated Terminal (Authoritative Terminal Execution)
   */
  public static runInTerminal(
    language: LanguageId,
    filePath: string,
    toolchainConfig?: { c?: string; cpp?: string; java?: string; python?: string }
  ): void {
    const { fullCmd, cwd } = this.getCompileAndRunCommand(language, filePath, toolchainConfig);
    const terminal = this.getTerminal();
    terminal.show(true);

    // Send CD command to ensure correct working directory before executing command
    if (process.platform === 'win32') {
      terminal.sendText(`cd /d "${cwd}"`);
    } else {
      terminal.sendText(`cd "${cwd}"`);
    }

    terminal.sendText(fullCmd);
  }

  /**
   * Execute command programmatically in child process for analysis & timing
   */
  public static async executeProcess(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;

      const child = cp.spawn(command, args, { cwd, shell: true });
      this.currentProcess = child;

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          child.kill('SIGTERM');
          stderr += '\n[BODHA Execution Timed Out]';
        }, timeoutMs);
      }

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        resolve({
          command: `${command} ${args.join(' ')}`,
          cwd,
          exitCode: code ?? -1,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
        });
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        this.currentProcess = null;
        resolve({
          command: `${command} ${args.join(' ')}`,
          cwd,
          exitCode: -1,
          stdout,
          stderr: stderr + '\n' + err.message,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Stop active running background execution process
   */
  public static stopActiveProcess(): boolean {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL');
      this.currentProcess = null;
      return true;
    }
    return false;
  }
}
