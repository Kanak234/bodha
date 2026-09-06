'use strict';

const { test, assertEqual } = require('./harness');

console.log('\nBODHA Diagnostic Parser Tests');

// Helper function mirroring parseAndShowDiagnostics pattern logic
function parseDiagnostics(output, sourceFile, language) {
  const diagnostics = [];
  const lines = output.split('\n');

  const gccPattern = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/;
  const javaPattern = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.+)$/;
  const pythonPattern = /^\s*File "(.+?)", line (\d+)/;
  const pythonSyntaxPattern = /^\s*(.+?\.py):(\d+):(\d+):\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let match = line.match(gccPattern);
    if (match) {
      const [, file, lineNum, colNum, severity, message] = match;
      diagnostics.push({
        file,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        severity,
        message
      });
      continue;
    }

    match = line.match(javaPattern);
    if (match) {
      const [, file, lineNum, severity, message] = match;
      diagnostics.push({
        file,
        line: parseInt(lineNum, 10),
        column: 1,
        severity,
        message
      });
      continue;
    }

    match = line.match(pythonSyntaxPattern);
    if (match) {
      const [, file, lineNum, colNum, message] = match;
      diagnostics.push({
        file,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        severity: 'error',
        message
      });
      continue;
    }

    match = line.match(pythonPattern);
    if (match) {
      const [, file, lineNum] = match;
      let message = 'Error at this location';
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const rawLine = lines[j];
        const errLine = rawLine.trim();
        if (errLine && !errLine.startsWith('File ') && !errLine.startsWith('^')) {
          // If unindented or matches Error pattern, take it
          if (rawLine.search(/\S/) === 0 || errLine.includes('Error:') || errLine.includes('Exception:')) {
            message = errLine;
            break;
          }
        }
      }
      diagnostics.push({
        file,
        line: parseInt(lineNum, 10),
        column: 1,
        severity: 'error',
        message
      });
      continue;
    }
  }

  return diagnostics;
}

test('GCC/Clang error parsing', () => {
  const sample = 'main.c:15:8: error: expected ‘;’ before ‘return’';
  const result = parseDiagnostics(sample, 'main.c', 'c');
  assertEqual(result.length, 1);
  assertEqual(result[0].line, 15);
  assertEqual(result[0].column, 8);
  assertEqual(result[0].severity, 'error');
  assertEqual(result[0].message, 'expected ‘;’ before ‘return’');
});

test('GCC/Clang warning parsing', () => {
  const sample = 'foo.cpp:42:12: warning: unused variable ‘x’';
  const result = parseDiagnostics(sample, 'foo.cpp', 'cpp');
  assertEqual(result.length, 1);
  assertEqual(result[0].line, 42);
  assertEqual(result[0].column, 12);
  assertEqual(result[0].severity, 'warning');
});

test('Java compiler error parsing', () => {
  const sample = 'Main.java:7: error: cannot find symbol';
  const result = parseDiagnostics(sample, 'Main.java', 'java');
  assertEqual(result.length, 1);
  assertEqual(result[0].line, 7);
  assertEqual(result[0].severity, 'error');
  assertEqual(result[0].message, 'cannot find symbol');
});

test('Python traceback parsing', () => {
  const sample = `Traceback (most recent call last):
  File "app.py", line 12, in <module>
    res = divide(10, 0)
ZeroDivisionError: division by zero`;
  const result = parseDiagnostics(sample, 'app.py', 'python');
  assertEqual(result.length, 1);
  assertEqual(result[0].line, 12);
  assertEqual(result[0].message, 'ZeroDivisionError: division by zero');
});

console.log('Diagnostic tests completed.');
