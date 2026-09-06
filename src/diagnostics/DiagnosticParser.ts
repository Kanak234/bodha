/**
 * BODHA Compiler Diagnostic Parser
 * Parses compiler errors and warnings from GCC, Clang, Javac, and Python toolchains.
 */

import { PhaseKind } from '../types';

export interface ParsedDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  errorCode?: string;
  failedStage: PhaseKind | 'unknown';
  stageNotice?: string;
  suggestedCheck: string;
}

export class DiagnosticParser {
  /**
   * Parse raw stdout/stderr output into structured compiler error diagnostics
   */
  public static parseDiagnostics(
    output: string,
    _sourceFilePath: string,
    _languageId: string
  ): ParsedDiagnostic[] {
    const diagnostics: ParsedDiagnostic[] = [];
    const lines = output.split(/\r?\n/);

    // GCC / Clang format: path/to/file.c:line:col: error: message [-Werror-flag]
    const gccClangPattern = /^(.+?):(\d+):(\d+):\s*(error|fatal error|warning|note):\s*(.+)$/;

    // Java javac format: path/to/File.java:line: error: message
    const javaPattern = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.+)$/;

    // Python syntax error format: File "path/to/script.py", line line, col col
    const pythonSyntaxPattern = /^\s*(.+?\.py):(\d+):(\d+):\s*(.+)$/;
    const pythonTracebackPattern = /^\s*File "(.+?)", line (\d+)(?:, in (.+))?/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 1. Check GCC / Clang
      let match = line.match(gccClangPattern);
      if (match) {
        const [, file, lineStr, colStr, sevStr, rawMsg] = match;
        const lineNum = parseInt(lineStr, 10);
        const colNum = parseInt(colStr, 10);
        const severity: 'error' | 'warning' | 'info' =
          sevStr.includes('error') ? 'error' : sevStr === 'warning' ? 'warning' : 'info';

        // Extract error code if present, e.g. [-Wunused-variable]
        let errorCode: string | undefined;
        const message = rawMsg;
        const codeMatch = rawMsg.match(/\[-W(.+)\]/);
        if (codeMatch) {
          errorCode = `-W${codeMatch[1]}`;
        }

        const failedStage = this.inferCompilerStage(rawMsg, 'c');
        const stageNotice = failedStage === 'unknown' ? 'Exact compiler stage unavailable from toolchain output.' : undefined;
        const suggestedCheck = this.getSuggestedCheck(message, failedStage);

        diagnostics.push({
          file,
          line: lineNum,
          column: colNum,
          severity,
          message,
          errorCode,
          failedStage,
          stageNotice,
          suggestedCheck,
        });
        continue;
      }

      // 2. Check Java
      match = line.match(javaPattern);
      if (match) {
        const [, file, lineStr, sevStr, message] = match;
        const lineNum = parseInt(lineStr, 10);
        const severity = sevStr === 'error' ? 'error' : 'warning';
        const failedStage = this.inferCompilerStage(message, 'java');
        const stageNotice = failedStage === 'unknown' ? 'Exact compiler stage unavailable from toolchain output.' : undefined;
        const suggestedCheck = this.getSuggestedCheck(message, failedStage);

        diagnostics.push({
          file,
          line: lineNum,
          column: 1,
          severity,
          message,
          failedStage,
          stageNotice,
          suggestedCheck,
        });
        continue;
      }

      // 3. Check Python Syntax Error
      match = line.match(pythonSyntaxPattern);
      if (match) {
        const [, file, lineStr, colStr, message] = match;
        diagnostics.push({
          file,
          line: parseInt(lineStr, 10),
          column: parseInt(colStr, 10),
          severity: 'error',
          message,
          failedStage: 'syntax',
          suggestedCheck: 'Check for missing colon, unmatched brackets, or indentation errors.',
        });
        continue;
      }

      // 4. Check Python Traceback
      match = line.match(pythonTracebackPattern);
      if (match) {
        const [, file, lineStr] = match;
        let errorMsg = 'Python Runtime Exception';

        // Peek next lines for exception class & details
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const subLine = lines[j].trim();
          if (subLine && (subLine.includes('Error:') || subLine.includes('Exception:') || /^[A-Z]\w+Error:/.test(subLine))) {
            errorMsg = subLine;
            break;
          }
        }

        diagnostics.push({
          file,
          line: parseInt(lineStr, 10),
          column: 1,
          severity: 'error',
          message: errorMsg,
          failedStage: 'runtime',
          suggestedCheck: 'Review call stack and check for zero-division, type mismatches, or key errors.',
        });
        continue;
      }
    }

    return diagnostics;
  }

  /**
   * Determine exact compiler stage if explicitly present in output, or return unknown
   */
  private static inferCompilerStage(message: string, _lang: string): PhaseKind | 'unknown' {
    const msg = message.toLowerCase();
    if (msg.includes('include') || msg.includes('macro') || msg.includes('preprocessor')) {
      return 'preprocessing';
    }
    if (msg.includes('token') || msg.includes('stray') || msg.includes('illegal character')) {
      return 'lexical';
    }
    if (msg.includes('expected') || msg.includes('syntax error') || msg.includes('parse error') || msg.includes('before')) {
      return 'syntax';
    }
    if (msg.includes('type') || msg.includes('undeclared') || msg.includes('cannot find symbol') || msg.includes('incompatible')) {
      return 'semantic';
    }
    if (msg.includes('undefined reference') || msg.includes('linker') || msg.includes('symbol(s) not found')) {
      return 'linking';
    }
    return 'unknown';
  }

  /**
   * Generate actionable remediation suggestion based on diagnostic message & stage
   */
  private static getSuggestedCheck(message: string, stage: PhaseKind | 'unknown'): string {
    const msg = message.toLowerCase();
    if (msg.includes('expected ‘;’') || msg.includes('expected \';\'')) {
      return 'Add missing semicolon (;) at the end of the statement.';
    }
    if (msg.includes('undeclared') || msg.includes('cannot find symbol')) {
      return 'Ensure the variable or function is properly declared before use and header files are included.';
    }
    if (msg.includes('expected ‘)’') || msg.includes('expected \')\'')) {
      return 'Check parenthesis balance in condition or function parameters.';
    }
    if (stage === 'preprocessing') {
      return 'Verify header file path and preprocessor #include / #define directives.';
    }
    if (stage === 'linking') {
      return 'Verify implementation function exists and required libraries are linked (-l flag).';
    }
    return 'Review line syntax, variable scope, and type declarations.';
  }
}
