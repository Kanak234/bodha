/**
 * BODHA Debugger State Tracker
 * Real VS Code Debug Adapter Protocol (DAP) integration
 */

import * as vscode from 'vscode';
import { DebuggerStateFrame } from '../types';

export class DebuggerTracker {
  private static activeFrames: DebuggerStateFrame[] = [];
  private static onDebugFrameCallback: ((sessionName: string, frames: DebuggerStateFrame[]) => void) | null = null;

  /**
   * Register debug adapter tracker factory across all DAP sessions (* wild card)
   */
  public static register(context: vscode.ExtensionContext, onFrame: (sessionName: string, frames: DebuggerStateFrame[]) => void): void {
    this.onDebugFrameCallback = onFrame;

    const factory: vscode.DebugAdapterTrackerFactory = {
      createDebugAdapterTracker(session: vscode.DebugSession) {
        return {
          onDidSendMessage: async (message: any) => {
            if (message && message.type === 'event' && message.event === 'stopped') {
              await DebuggerTracker.captureSessionState(session);
            }
          }
        };
      }
    };

    context.subscriptions.push(
      vscode.debug.registerDebugAdapterTrackerFactory('*', factory)
    );
  }

  /**
   * Capture stack frames, scopes, and variable values from active debug session
   */
  public static async captureSessionState(session: vscode.DebugSession): Promise<DebuggerStateFrame[]> {
    const frames: DebuggerStateFrame[] = [];
    try {
      // Execute stackTrace request via VS Code debug API
      const stackTrace = await session.customRequest('stackTrace', { threadId: 1 });
      if (stackTrace && stackTrace.stackFrames) {
        for (const frame of stackTrace.stackFrames.slice(0, 5)) {
          const vars: { name: string; value: string; type: string }[] = [];
          
          try {
            const scopesRes = await session.customRequest('scopes', { frameId: frame.id });
            if (scopesRes && scopesRes.scopes && scopesRes.scopes.length > 0) {
              const localScope = scopesRes.scopes[0];
              const varsRes = await session.customRequest('variables', { variablesReference: localScope.variablesReference });
              if (varsRes && varsRes.variables) {
                for (const v of varsRes.variables.slice(0, 10)) {
                  vars.push({
                    name: v.name,
                    value: String(v.value),
                    type: v.type || 'unknown'
                  });
                }
              }
            }
          } catch {
            // Scopes/variables request might fail if thread resumed
          }

          frames.push({
            name: frame.name || 'anonymous',
            source: frame.source ? pathBasename(frame.source.path || frame.source.name || '') : 'unknown',
            line: frame.line || 1,
            column: frame.column || 1,
            variables: vars
          });
        }
      }
    } catch {
      // Stacktrace custom request unsupported or thread unavailable
    }

    this.activeFrames = frames;
    if (this.onDebugFrameCallback && frames.length > 0) {
      this.onDebugFrameCallback(session.name, frames);
    }
    return frames;
  }

  public static getActiveFrames(): DebuggerStateFrame[] {
    return this.activeFrames;
  }
}

function pathBasename(p: string): string {
  if (!p) return '';
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1];
}
