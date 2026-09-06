/**
 * Compiler Visualizer Panel
 * Main webview-based UI for the visualizer
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { PipelineResult, CompilerArtifact } from '../../types';

export class CompilerVisualizerPanel {
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;
  private currentResult: PipelineResult | null = null;
  private currentLanguage: string = '';
  private currentActiveDoc: any = null;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  reveal(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'bodha.visualizer',
      'BODHA — Compiler Visualizer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
        ]
      }
    );

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), null, this.disposables);

    this.panel.onDidDispose(() => {
      this.panel = null;
      vscode.commands.executeCommand('setContext', 'bodha.panelVisible', false);
    }, null, this.disposables);

    vscode.commands.executeCommand('setContext', 'bodha.panelVisible', true);
  }

  setAnalysisResult(result: PipelineResult): void {
    this.currentResult = result;
    this.currentLanguage = result.language;
    this.postMessage({
      type: 'analysisResult',
      result: this.serializeResult(result),
    });
  }

  setPipelineArtifacts(artifacts: Map<string, CompilerArtifact>): void {
    if (this.currentResult) {
      this.currentResult.artifacts = artifacts;
    }
    this.postMessage({
      type: 'pipelineArtifacts',
      artifacts: this.serializeArtifacts(artifacts),
    });
  }

  setActiveDocument(docState: {
    fsPath: string | null;
    languageId: string;
    text: string;
    isSupported: boolean;
    unsupportedLang?: string;
  }): void {
    this.currentActiveDoc = docState;
    this.postMessage({
      type: 'activeDocument',
      docState,
    });
  }

  setLanguageContext(languageId: string): void {
    this.currentLanguage = languageId;
    this.postMessage({ type: 'languageContext', language: languageId });
  }

  showPhase(phase: string): void {
    this.postMessage({ type: 'showPhase', phase });
  }

  startTimeline(): void {
    this.postMessage({ type: 'startTimeline' });
  }

  pushDebugFrame(debugData: any): void {
    this.postMessage({
      type: 'debugFrame',
      debugData,
    });
  }

  compareStages(): void {
    this.postMessage({ type: 'compareStages' });
  }

  exportReport(): void {
    if (!this.currentResult) return;
    this.postMessage({ type: 'exportReport', result: this.serializeResult(this.currentResult) });
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.panel?.dispose();
    this.panel = null;
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'ready':
        if (this.currentActiveDoc) {
          this.postMessage({
            type: 'activeDocument',
            docState: this.currentActiveDoc,
          });
        }
        if (this.currentResult) {
          this.postMessage({
            type: 'analysisResult',
            result: this.serializeResult(this.currentResult),
          });
        }
        break;
      case 'runCode':
        vscode.commands.executeCommand('bodha.runCode');
        break;
      case 'analyzeCode':
        vscode.commands.executeCommand('bodha.analyze');
        break;
      case 'stopExecution':
        vscode.commands.executeCommand('bodha.stopExecution');
        break;
      case 'explainError':
        vscode.commands.executeCommand('bodha.explainCompilerError', message.error || { message: 'Compiler diagnostic error' });
        break;
      case 'export':
        this.handleExport(message.format || 'json');
        break;
      case 'sourceClick':
        this.handleSourceClick(message.location);
        break;
      case 'artifactClick':
        this.handleArtifactClick(message.artifactId, message.location);
        break;
    }
  }

  private handleSourceClick(location: { file: string; line: number; column: number }): void {
    if (!location || !location.file) return;
    vscode.workspace.openTextDocument(vscode.Uri.file(location.file))
      .then(doc => vscode.window.showTextDocument(doc, {
        selection: new vscode.Range(location.line - 1, location.column - 1, location.line - 1, location.column),
      }));
  }

  private handleArtifactClick(artifactId: string, location: any): void {
    if (location?.file) {
      this.handleSourceClick(location);
    }
  }

  private async handleExport(format: string): Promise<void> {
    if (!this.currentResult) return;

    const uri = await vscode.window.showSaveDialog({
      filters: {
        'JSON': ['json'],
        'Markdown': ['md'],
        'HTML': ['html'],
        'All Files': ['*'],
      },
      defaultUri: vscode.Uri.file(`bodha-report.${format}`),
    });

    if (!uri) return;

    let content: string;
    switch (format) {
      case 'json':
        content = JSON.stringify(this.serializeResult(this.currentResult), null, 2);
        break;
      case 'md':
        content = this.generateMarkdownReport(this.currentResult);
        break;
      case 'html':
        content = this.generateHtmlReport(this.currentResult);
        break;
      default:
        content = JSON.stringify(this.currentResult, null, 2);
    }

    require('fs').writeFileSync(uri.fsPath, content);
    vscode.window.showInformationMessage(`Report exported to ${uri.fsPath}`);
  }

  private serializeResult(result: PipelineResult): any {
    return {
      sourceFile: result.sourceFile,
      language: result.language,
      phases: result.phases,
      artifacts: this.serializeArtifacts(result.artifacts),
      timeline: result.timeline,
      errors: result.errors,
    };
  }

  private serializeArtifacts(artifacts: Map<string, CompilerArtifact>): any[] {
    return Array.from(artifacts.values()).map(a => ({
      id: a.id,
      phase: a.phase,
      confidence: a.confidence,
      toolchain: a.toolchain,
      toolVersion: a.toolVersion,
      content: typeof a.content === 'string' ? a.content : JSON.stringify(a.content, null, 2),
      metadata: a.metadata,
      timestamp: a.timestamp,
    }));
  }

  private generateMarkdownReport(result: PipelineResult): string {
    const lines = [
      `# BODHA Compiler Visualization Report`,
      ``,
      `**Source File:** ${result.sourceFile}`,
      `**Language:** ${result.language}`,
      `**Generated:** ${new Date().toISOString()}`,
      ``,
      `## Pipeline Phases`,
      ``,
    ];

    for (const phase of result.phases) {
      lines.push(`### ${phase.name}`);
      lines.push(`- **Toolchain:** ${phase.toolchain || 'N/A'}`);
      lines.push(`- **Duration:** ${phase.durationMs}ms`);
      lines.push(`- **Success:** ${phase.success ? '✓' : '✗'}`);
      if (phase.error) lines.push(`- **Error:** ${phase.error}`);
      lines.push(`- **Description:** ${phase.description}`);
      lines.push(``);
    }

    if (result.errors.length > 0) {
      lines.push(`## Errors`);
      for (const err of result.errors) {
        lines.push(`- [${err.phase}] ${err.message}`);
      }
      lines.push(``);
    }

    return lines.join('\n');
  }

  private generateHtmlReport(result: PipelineResult): string {
    return `<!DOCTYPE html>
<html><head><title>BODHA Report</title>
<style>body{font-family:system-ui;margin:2rem;} .phase{border:1px solid #ccc;padding:1rem;margin:1rem 0;}</style>
</head><body>
<h1>BODHA Compiler Visualization Report</h1>
<p><strong>Source:</strong> ${result.sourceFile}</p>
<p><strong>Language:</strong> ${result.language}</p>
${result.phases.map(p => `<div class="phase"><h2>${p.name}</h2><p>${p.description}</p><p>Toolchain: ${p.toolchain}</p><p>Duration: ${p.durationMs}ms</p></div>`).join('')}
</body></html>`;
  }

  private getHtml(): string {
    const nonce = this.getNonce();
    const logoUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icon.png'))
    );
    const script3dUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'bodha-3d.js'))
    );
    const scriptUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'compiler-visualizer.js'))
    );
    const styleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'compiler-visualizer.css'))
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${this.panel!.webview.cspSource} 'nonce-${nonce}' 'unsafe-inline'; img-src ${this.panel!.webview.cspSource} data:; font-src ${this.panel!.webview.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleUri}">
<title>BODHA — Compiler Visualizer</title>
</head>
<body>
<div id="app">
  <div class="toolbar">
    <div class="toolbar-brand">
      <img src="${logoUri}" alt="Bodha Logo" class="brand-logo">
      <span class="brand-title">BODHA</span>
      <span class="brand-subtitle">Visual Toolchain</span>
    </div>

    <div class="toolbar-actions">
      <button class="toolbar-btn primary" id="btnRunCode" title="Run Code in Integrated Terminal">
        <span>🚀</span> <span class="label">Run</span>
      </button>
      <button class="toolbar-btn" id="btnAnalyze" title="Analyze Compiler Pipeline">
        <span>🔬</span> <span class="label">Analyze</span>
      </button>
      <button class="toolbar-btn danger" id="btnStop" title="Stop Execution">
        <span>⏹️</span> <span class="label">Stop</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn mode-toggle" id="btnToggle3D" title="Toggle 2D / 3D Spatial Visualization">
        <span id="modeIcon">📐</span> <span class="label" id="modeLabel">3D Mode</span>
      </button>
      <button class="toolbar-btn" id="btnUserGuide" title="Open Interactive User Guide">
        <span>📘</span> <span class="label">User Guide</span>
      </button>
      <button class="toolbar-btn" id="btnExport" title="Export Pipeline Analysis Report">
        <span>📤</span> <span class="label">Export</span>
      </button>
    </div>

    <div class="toolbar-status">
      <span id="statusLanguage" class="status-badge lang-badge">—</span>
      <span id="statusPhase" class="status-badge phase-badge">—</span>
      <span id="statusConfidence" class="confidence-badge"></span>
    </div>
  </div>

  <div class="phase-tabs" id="phaseTabs"></div>

  <div class="main-content">
    <div class="main-panel">
      <!-- 2D Main Viewer -->
      <div class="panel-section-content" id="mainViewer">
        <div class="welcome-hero">
          <img src="${logoUri}" alt="BODHA Logo" class="hero-logo">
          <h2>BODHA — Next-Gen Compiler Visualizer</h2>
          <p class="hero-desc">Understand toolchain internals through live integrated terminal execution and deep 2D/3D visualizations.</p>
          <div class="hero-actions">
            <button class="hero-btn primary" onclick="vscode.postMessage({type:'analyzeCode'})">🔬 Analyze Current File (Ctrl+Alt+B)</button>
            <button class="hero-btn" onclick="vscode.postMessage({type:'runCode'})">🚀 Run in Terminal (Ctrl+Alt+R)</button>
          </div>
          <div class="hero-pipeline">
            <span class="p-step">Source Code</span> →
            <span class="p-step">Tokens</span> →
            <span class="p-step">AST</span> →
            <span class="p-step">IR / TAC</span> →
            <span class="p-step">Assembly</span> →
            <span class="p-step">Runtime</span>
          </div>
        </div>
      </div>

      <!-- 3D Spatial Viewer Canvas Container -->
      <div id="bodha3dContainer" class="bodha-3d-container" style="display: none;">
        <div class="canvas-overlay-controls">
          <button class="canvas-btn" id="btnReset3D" title="Reset Camera">🔄 Reset Camera</button>
          <button class="canvas-btn" id="btn3DFlow" title="Show 3D Program Flow">🌐 Program Flow</button>
          <button class="canvas-btn" id="btn3DAST" title="Show 3D AST Spatial Tree">🌲 3D AST</button>
          <button class="canvas-btn" id="btn3DDS" title="Show 3D Data Structures">📊 Data Structures</button>
        </div>
        <div id="canvas3DElement" style="width: 100%; height: 100%;"></div>
      </div>
    </div>

    <!-- Side Panel / Timeline / Error Explanations / User Guide -->
    <div class="side-panel">
      <div class="side-panel-header" id="sidePanelHeader">Timeline & Diagnostics</div>
      <div class="side-panel-content" id="sidePanelContent">
        <div class="timeline-container">
          <div class="timeline-header">
            <div class="timeline-controls">
              <button class="timeline-btn" id="prevBtn" title="Previous Frame">◀</button>
              <button class="timeline-btn" id="playPauseBtn" title="Play/Pause Timeline">▶</button>
              <button class="timeline-btn" id="nextBtn" title="Next Frame">▶</button>
            </div>
            <input type="range" class="timeline-scrubber" id="timelineScrubber" min="0" max="0" value="0">
          </div>
          <div class="timeline-frames" id="timelineFrames">
            <div class="empty-state" style="height:auto;padding:16px;">No timeline frames yet</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="status-bar">
    <div class="status-left">
      <span id="confidenceBadge"></span>
      <span id="statusMessage" style="margin-left: 8px;">Ready</span>
    </div>
    <div class="status-right">
      <span style="font-size:10px;opacity:0.8;font-weight:600;">BODHA v0.3.0</span>
    </div>
  </div>
</div>
<script nonce="${nonce}" src="${script3dUri}"></script>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body></html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private postMessage(msg: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(msg);
    }
  }
}