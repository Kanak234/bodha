'use strict';

const { test, assertEqual } = require('./harness');
const vscodeMock = require('./vscode-mock');
const { getActiveSourceDocument, SUPPORTED_LANGUAGES } = require('../out/activeDocumentManager');

console.log('\nBODHA Active Document Detection Tests (Real Module)');

test('Active document detection - C file', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/path/to/main.c'),
      languageId: 'c',
      getText: () => 'int main() { return 0; }'
    }
  };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'c');
  assertEqual(res.fsPath, '/path/to/main.c');
  assertEqual(res.text, 'int main() { return 0; }');
});

test('Active document detection - C++ file', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/path/to/app.cpp'),
      languageId: 'cpp',
      getText: () => '#include <iostream>\nint main() {}'
    }
  };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'cpp');
  assertEqual(res.fsPath, '/path/to/app.cpp');
});

test('Active document detection - Java file', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/path/to/Main.java'),
      languageId: 'java',
      getText: () => 'public class Main { public static void main(String[] args) {} }'
    }
  };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'java');
  assertEqual(res.fsPath, '/path/to/Main.java');
});

test('Active document detection - Python file', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/path/to/script.py'),
      languageId: 'python',
      getText: () => 'print("Hello BODHA")'
    }
  };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'python');
  assertEqual(res.fsPath, '/path/to/script.py');
});

test('Active document detection - No active editor', () => {
  vscodeMock.window.activeTextEditor = null;
  vscodeMock.window.visibleTextEditors = [];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, false);
  assertEqual(res.fsPath, null);
  assertEqual(res.languageId, '');
  assertEqual(res.editor, null);
  assertEqual(res.document, null);
});

test('Active document detection - Fallback to visible editor when webview focused', () => {
  vscodeMock.window.activeTextEditor = null;
  vscodeMock.window.visibleTextEditors = [
    {
      document: {
        uri: vscodeMock.Uri.file('/workspace/foo.c'),
        languageId: 'c',
        getText: () => 'int foo = 42;'
      }
    }
  ];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'c');
  assertEqual(res.fsPath, '/workspace/foo.c');
  assertEqual(res.text, 'int foo = 42;');
});

test('Active document detection - Unsupported file type', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/path/to/config.json'),
      languageId: 'json',
      getText: () => '{ "key": "val" }'
    }
  };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, false);
  assertEqual(res.languageId, 'json');
  assertEqual(res.unsupportedLang, 'json');
});

test('Active document detection - Non-file URI scheme ignored', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: { scheme: 'output', fsPath: 'output:extension-output' },
      languageId: 'plaintext',
      getText: () => 'log text'
    }
  };
  vscodeMock.window.visibleTextEditors = [];

  const res = getActiveSourceDocument();
  assertEqual(res.isSupported, false);
  assertEqual(res.editor, null);
});

test('Active document detection - Switching between source files', () => {
  const docC = { uri: vscodeMock.Uri.file('/src/main.c'), languageId: 'c', getText: () => 'int a;' };
  const docJava = { uri: vscodeMock.Uri.file('/src/App.java'), languageId: 'java', getText: () => 'class App {}' };

  vscodeMock.window.activeTextEditor = { document: docC };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];
  let res = getActiveSourceDocument();
  assertEqual(res.fsPath, '/src/main.c');
  assertEqual(res.languageId, 'c');

  // Switch to Java
  vscodeMock.window.activeTextEditor = { document: docJava };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];
  res = getActiveSourceDocument();
  assertEqual(res.fsPath, '/src/App.java');
  assertEqual(res.languageId, 'java');
});

test('Active document detection - Editing active source file', () => {
  let sourceText = 'int a = 1;';
  const doc = {
    uri: vscodeMock.Uri.file('/src/main.c'),
    languageId: 'c',
    getText: () => sourceText
  };
  vscodeMock.window.activeTextEditor = { document: doc };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];

  let res = getActiveSourceDocument();
  assertEqual(res.text, 'int a = 1;');

  // Edit document
  sourceText = 'int a = 1;\nint b = 2;';
  res = getActiveSourceDocument();
  assertEqual(res.text, 'int a = 1;\nint b = 2;');
});

test('Active document detection - Closing active source file', () => {
  vscodeMock.window.activeTextEditor = {
    document: {
      uri: vscodeMock.Uri.file('/src/main.c'),
      languageId: 'c',
      getText: () => 'int x;'
    }
  };
  vscodeMock.window.visibleTextEditors = [vscodeMock.window.activeTextEditor];
  let res = getActiveSourceDocument();
  assertEqual(res.isSupported, true);

  // Close file
  vscodeMock.window.activeTextEditor = null;
  vscodeMock.window.visibleTextEditors = [];
  res = getActiveSourceDocument();
  assertEqual(res.isSupported, false);
  assertEqual(res.fsPath, null);
});

test('Supported languages array includes all expected languages', () => {
  assertEqual(SUPPORTED_LANGUAGES.includes('c'), true);
  assertEqual(SUPPORTED_LANGUAGES.includes('cpp'), true);
  assertEqual(SUPPORTED_LANGUAGES.includes('java'), true);
  assertEqual(SUPPORTED_LANGUAGES.includes('python'), true);
  assertEqual(SUPPORTED_LANGUAGES.length, 4);
});

console.log('Active document tests completed.');
