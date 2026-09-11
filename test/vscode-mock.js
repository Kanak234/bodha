'use strict';

const Module = require('module');

class MockRange {
  constructor(startLine, startCol, endLine, endCol) {
    this.start = { line: startLine, character: startCol };
    this.end = { line: endLine, character: endCol };
  }
}

class MockDiagnostic {
  constructor(range, message, severity) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}

class MockThemeIcon {
  constructor(id) {
    this.id = id;
  }
}

const vscodeMock = {
  Range: MockRange,
  Diagnostic: MockDiagnostic,
  ThemeIcon: MockThemeIcon,
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Beside: -2,
  },
  Uri: {
    file: (fsPath) => ({
      scheme: 'file',
      fsPath,
      path: fsPath,
      toString: () => `file://${fsPath}`,
    }),
    parse: (uriStr) => ({
      scheme: uriStr.split(':')[0] || 'file',
      fsPath: uriStr.replace(/^[a-zA-Z]+:\/\//, ''),
      toString: () => uriStr,
    }),
  },
  window: {
    activeTextEditor: null,
    visibleTextEditors: [],
    terminals: [],
    createOutputChannel: (name) => ({
      name,
      appendLine: () => {},
      append: () => {},
      clear: () => {},
      show: () => {},
      dispose: () => {},
    }),
    createWebviewPanel: (viewType, title, showOptions, options) => {
      const listeners = [];
      return {
        viewType,
        title,
        webview: {
          html: '',
          onDidReceiveMessage: (fn) => {
            listeners.push(fn);
            return { dispose: () => {} };
          },
          postMessage: async () => true,
        },
        reveal: () => {},
        dispose: () => {},
        onDidDispose: (fn) => ({ dispose: () => {} }),
      };
    },
    createTerminal: (options) => {
      const term = {
        name: typeof options === 'string' ? options : (options && options.name) || 'terminal',
        sendText: () => {},
        show: () => {},
        dispose: () => {},
      };
      vscodeMock.window.terminals.push(term);
      return term;
    },
    showInformationMessage: async () => {},
    showWarningMessage: async () => {},
    showErrorMessage: async () => {},
    showSaveDialog: async () => undefined,
    showTextDocument: async () => {},
    onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
    onDidChangeVisibleTextEditors: () => ({ dispose: () => {} }),
    onDidCloseTerminal: () => ({ dispose: () => {} }),
  },
  workspace: {
    getConfiguration: (section) => {
      const configMap = {};
      return {
        get: (key, defaultValue) => {
          if (configMap[key] !== undefined) return configMap[key];
          return defaultValue;
        },
        update: (key, value) => {
          configMap[key] = value;
          return Promise.resolve();
        },
      };
    },
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    onDidCloseTextDocument: () => ({ dispose: () => {} }),
    openTextDocument: async (file) => ({
      uri: vscodeMock.Uri.file(typeof file === 'string' ? file : file.fsPath),
      fileName: typeof file === 'string' ? file : file.fsPath,
      getText: () => '',
    }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => {},
  },
  languages: {
    createDiagnosticCollection: (name) => ({
      name,
      set: () => {},
      delete: () => {},
      clear: () => {},
      dispose: () => {},
    }),
  },
  debug: {
    registerDebugAdapterTrackerFactory: () => ({ dispose: () => {} }),
  },
};

// Intercept require('vscode')
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'vscode') return 'vscode';
  return origResolve.apply(this, arguments);
};

const m = new Module('vscode');
m.exports = vscodeMock;
m.loaded = true;
require.cache['vscode'] = m;

module.exports = vscodeMock;
