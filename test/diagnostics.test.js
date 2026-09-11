'use strict';

const { test, assertEqual } = require('./harness');
const { DiagnosticParser } = require('../out/diagnostics/DiagnosticParser');

console.log('\nBODHA Diagnostic Parser Tests (Real Module)');

test('GCC/Clang error parsing', () => {
  const sample = 'main.c:15:8: error: expected ‘;’ before ‘return’';
  const result = DiagnosticParser.parseDiagnostics(sample, 'main.c', 'c');
  assertEqual(result.length, 1);
  assertEqual(result[0].file, 'main.c');
  assertEqual(result[0].line, 15);
  assertEqual(result[0].column, 8);
  assertEqual(result[0].severity, 'error');
  assertEqual(result[0].message, 'expected ‘;’ before ‘return’');
  assertEqual(result[0].suggestedCheck, 'Add missing semicolon (;) at the end of the statement.');
});

test('GCC/Clang warning with error flag parsing', () => {
  const sample = 'foo.cpp:42:12: warning: unused variable ‘x’ [-Wunused-variable]';
  const result = DiagnosticParser.parseDiagnostics(sample, 'foo.cpp', 'cpp');
  assertEqual(result.length, 1);
  assertEqual(result[0].line, 42);
  assertEqual(result[0].column, 12);
  assertEqual(result[0].severity, 'warning');
  assertEqual(result[0].errorCode, '-Wunused-variable');
});

test('GCC/Clang note parsing', () => {
  const sample = 'main.c:20:5: note: previous declaration of ‘foo’ was here';
  const result = DiagnosticParser.parseDiagnostics(sample, 'main.c', 'c');
  assertEqual(result.length, 1);
  assertEqual(result[0].severity, 'info');
});

test('GCC fatal error preprocessor parsing', () => {
  const sample = 'main.c:2:10: fatal error: failed to include non_existent.h';
  const result = DiagnosticParser.parseDiagnostics(sample, 'main.c', 'c');
  assertEqual(result.length, 1);
  assertEqual(result[0].severity, 'error');
  assertEqual(result[0].failedStage, 'preprocessing');
  assertEqual(result[0].suggestedCheck, 'Verify header file path and preprocessor #include / #define directives.');
});

test('Java compiler error parsing', () => {
  const sample = 'Main.java:7: error: cannot find symbol';
  const result = DiagnosticParser.parseDiagnostics(sample, 'Main.java', 'java');
  assertEqual(result.length, 1);
  assertEqual(result[0].file, 'Main.java');
  assertEqual(result[0].line, 7);
  assertEqual(result[0].severity, 'error');
  assertEqual(result[0].message, 'cannot find symbol');
  assertEqual(result[0].failedStage, 'semantic');
  assertEqual(result[0].suggestedCheck, 'Ensure the variable or function is properly declared before use and header files are included.');
});

test('Java compiler warning parsing', () => {
  const sample = 'Main.java:12: warning: [deprecation] show() has been deprecated';
  const result = DiagnosticParser.parseDiagnostics(sample, 'Main.java', 'java');
  assertEqual(result.length, 1);
  assertEqual(result[0].severity, 'warning');
});

test('Python syntax error parsing', () => {
  const sample = 'test.py:10:5: invalid syntax';
  const result = DiagnosticParser.parseDiagnostics(sample, 'test.py', 'python');
  assertEqual(result.length, 1);
  assertEqual(result[0].file, 'test.py');
  assertEqual(result[0].line, 10);
  assertEqual(result[0].column, 5);
  assertEqual(result[0].severity, 'error');
  assertEqual(result[0].failedStage, 'syntax');
  assertEqual(result[0].suggestedCheck, 'Check for missing colon, unmatched brackets, or indentation errors.');
});

test('Python traceback parsing', () => {
  const sample = `Traceback (most recent call last):
  File "app.py", line 12, in <module>
    res = divide(10, 0)
ZeroDivisionError: division by zero`;
  const result = DiagnosticParser.parseDiagnostics(sample, 'app.py', 'python');
  assertEqual(result.length, 1);
  assertEqual(result[0].file, 'app.py');
  assertEqual(result[0].line, 12);
  assertEqual(result[0].message, 'ZeroDivisionError: division by zero');
  assertEqual(result[0].failedStage, 'runtime');
  assertEqual(result[0].suggestedCheck, 'Review call stack and check for zero-division, type mismatches, or key errors.');
});

test('Stage inference: lexical, linking, and unknown', () => {
  const lexicalSample = 'main.c:5:1: error: stray ‘\\342’ in program';
  const lexResult = DiagnosticParser.parseDiagnostics(lexicalSample, 'main.c', 'c');
  assertEqual(lexResult[0].failedStage, 'lexical');

  const linkerSample = 'main.c:1:1: error: undefined reference to `main`';
  const linkResult = DiagnosticParser.parseDiagnostics(linkerSample, 'main.c', 'c');
  assertEqual(linkResult[0].failedStage, 'linking');
  assertEqual(linkResult[0].suggestedCheck, 'Verify implementation function exists and required libraries are linked (-l flag).');

  const unknownSample = 'main.c:1:1: error: internal compiler crash';
  const unkResult = DiagnosticParser.parseDiagnostics(unknownSample, 'main.c', 'c');
  assertEqual(unkResult[0].failedStage, 'unknown');
  assertEqual(unkResult[0].stageNotice, 'Exact compiler stage unavailable from toolchain output.');
});

test('Remediation suggestion for unbalanced parenthesis', () => {
  const sample = 'main.c:8:14: error: expected ‘)’ before token';
  const result = DiagnosticParser.parseDiagnostics(sample, 'main.c', 'c');
  assertEqual(result[0].suggestedCheck, 'Check parenthesis balance in condition or function parameters.');
});

test('DiagnosticParser handles empty and blank lines gracefully', () => {
  const result = DiagnosticParser.parseDiagnostics('\n\n   \n\t\n', 'main.c', 'c');
  assertEqual(result.length, 0);
});

console.log('Diagnostic tests completed.');
