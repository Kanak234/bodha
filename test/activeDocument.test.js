'use strict';

const { test, assertEqual } = require('./harness');

console.log('\nBODHA Active Document Detection Tests');

const SUPPORTED_LANGUAGES = ['c', 'cpp', 'java', 'python'];

// Authoritative document detection logic mirroring activeDocumentManager.ts
function resolveActiveDocumentState(vscodeMock) {
  let editor = vscodeMock.window.activeTextEditor;

  if (!editor || !editor.document || editor.document.uri.scheme !== 'file') {
    const visible = (vscodeMock.window.visibleTextEditors || []).filter(
      e => e.document && e.document.uri.scheme === 'file'
    );
    if (visible.length > 0) {
      editor = visible[0];
    }
  }

  if (!editor || !editor.document || editor.document.uri.scheme !== 'file') {
    return {
      editor: null,
      document: null,
      fsPath: null,
      languageId: '',
      isSupported: false,
      text: '',
    };
  }

  const langId = editor.document.languageId;
  const isSupported = SUPPORTED_LANGUAGES.includes(langId);

  return {
    editor,
    document: editor.document,
    fsPath: editor.document.uri.fsPath,
    languageId: langId,
    isSupported,
    unsupportedLang: isSupported ? undefined : langId,
    text: editor.document.getText(),
  };
}

test('Active document detection - C file', () => {
  const mock = {
    window: {
      activeTextEditor: {
        document: {
          uri: { scheme: 'file', fsPath: '/path/to/main.c' },
          languageId: 'c',
          getText: () => 'int main() { return 0; }'
        }
      }
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'c');
  assertEqual(res.fsPath, '/path/to/main.c');
  assertEqual(res.text, 'int main() { return 0; }');
});

test('Active document detection - C++ file', () => {
  const mock = {
    window: {
      activeTextEditor: {
        document: {
          uri: { scheme: 'file', fsPath: '/path/to/app.cpp' },
          languageId: 'cpp',
          getText: () => '#include <iostream>\nint main() {}'
        }
      }
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'cpp');
  assertEqual(res.fsPath, '/path/to/app.cpp');
});

test('Active document detection - Java file', () => {
  const mock = {
    window: {
      activeTextEditor: {
        document: {
          uri: { scheme: 'file', fsPath: '/path/to/Main.java' },
          languageId: 'java',
          getText: () => 'public class Main { public static void main(String[] args) {} }'
        }
      }
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'java');
});

test('Active document detection - Python file', () => {
  const mock = {
    window: {
      activeTextEditor: {
        document: {
          uri: { scheme: 'file', fsPath: '/path/to/script.py' },
          languageId: 'python',
          getText: () => 'print("Hello BODHA")'
        }
      }
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'python');
});

test('Active document detection - No active editor', () => {
  const mock = {
    window: {
      activeTextEditor: null,
      visibleTextEditors: []
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, false);
  assertEqual(res.fsPath, null);
  assertEqual(res.languageId, '');
});

test('Active document detection - Fallback to visible editor when webview focused', () => {
  const mock = {
    window: {
      activeTextEditor: undefined,
      visibleTextEditors: [
        {
          document: {
            uri: { scheme: 'file', fsPath: '/workspace/foo.c' },
            languageId: 'c',
            getText: () => 'int foo = 42;'
          }
        }
      ]
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, true);
  assertEqual(res.languageId, 'c');
  assertEqual(res.fsPath, '/workspace/foo.c');
});

test('Active document detection - Unsupported file type', () => {
  const mock = {
    window: {
      activeTextEditor: {
        document: {
          uri: { scheme: 'file', fsPath: '/path/to/config.json' },
          languageId: 'json',
          getText: () => '{ "key": "val" }'
        }
      }
    }
  };
  const res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, false);
  assertEqual(res.languageId, 'json');
  assertEqual(res.unsupportedLang, 'json');
});

test('Active document detection - Switching between source files', () => {
  const docC = { uri: { scheme: 'file', fsPath: '/src/main.c' }, languageId: 'c', getText: () => 'int a;' };
  const docJava = { uri: { scheme: 'file', fsPath: '/src/App.java' }, languageId: 'java', getText: () => 'class App {}' };

  const mock = { window: { activeTextEditor: { document: docC } } };
  let res = resolveActiveDocumentState(mock);
  assertEqual(res.fsPath, '/src/main.c');
  assertEqual(res.languageId, 'c');

  // Switch to Java
  mock.window.activeTextEditor = { document: docJava };
  res = resolveActiveDocumentState(mock);
  assertEqual(res.fsPath, '/src/App.java');
  assertEqual(res.languageId, 'java');
});

test('Active document detection - Editing active source file', () => {
  let sourceText = 'int a = 1;';
  const doc = {
    uri: { scheme: 'file', fsPath: '/src/main.c' },
    languageId: 'c',
    getText: () => sourceText
  };
  const mock = { window: { activeTextEditor: { document: doc } } };

  let res = resolveActiveDocumentState(mock);
  assertEqual(res.text, 'int a = 1;');

  // Edit document
  sourceText = 'int a = 1;\nint b = 2;';
  res = resolveActiveDocumentState(mock);
  assertEqual(res.text, 'int a = 1;\nint b = 2;');
});

test('Active document detection - Closing active source file', () => {
  const mock = {
    window: {
      activeTextEditor: {
        document: {
          uri: { scheme: 'file', fsPath: '/src/main.c' },
          languageId: 'c',
          getText: () => 'int x;'
        }
      },
      visibleTextEditors: []
    }
  };
  let res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, true);

  // Close file
  mock.window.activeTextEditor = null;
  mock.window.visibleTextEditors = [];
  res = resolveActiveDocumentState(mock);
  assertEqual(res.isSupported, false);
  assertEqual(res.fsPath, null);
});

console.log('Active document tests completed.');
