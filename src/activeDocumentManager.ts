/**
 * Active Document Manager
 * Authoritative manager for active VS Code source file detection
 */

import * as vscode from 'vscode';
import { LanguageId } from './types';

export interface ActiveDocumentState {
  editor: vscode.TextEditor | null;
  document: vscode.TextDocument | null;
  fsPath: string | null;
  languageId: string;
  isSupported: boolean;
  unsupportedLang?: string;
  text: string;
}

export const SUPPORTED_LANGUAGES: LanguageId[] = ['c', 'cpp', 'java', 'python'];

export function getActiveSourceDocument(): ActiveDocumentState {
  let editor = vscode.window.activeTextEditor;

  // Fallback: If focus is in Webview or secondary panel, check visible text editors
  if (!editor || !editor.document || editor.document.uri.scheme !== 'file') {
    const visible = vscode.window.visibleTextEditors.filter(
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
  const isSupported = SUPPORTED_LANGUAGES.includes(langId as LanguageId);

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
