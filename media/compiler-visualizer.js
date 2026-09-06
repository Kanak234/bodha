/**
 * BODHA Compiler Visualizer - Webview Script (Second Edition)
 * Handles 2D/3D Visualizations, Compiler Pipeline, Debugger Frames, Data Structures, and Source Mapping
 */

(function() {
  const vscode = acquireVsCodeApi();

  // State
  let currentResult = null;
  let currentLanguage = '';
  let currentPhase = 'source';
  let timelineFrames = [];
  let currentFrameIndex = 0;
  let isPlaying = false;
  let playInterval = null;
  let is3DMode = false;
  let engine3D = null;
  let activeDocState = null;

  // DOM Elements
  const app = document.getElementById('app');
  const phaseTabs = document.getElementById('phaseTabs');
  const mainViewer = document.getElementById('mainViewer');
  const bodha3dContainer = document.getElementById('bodha3dContainer');
  const timelineFramesEl = document.getElementById('timelineFrames');
  const timelineScrubber = document.getElementById('timelineScrubber');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const statusLanguage = document.getElementById('statusLanguage');
  const statusPhase = document.getElementById('statusPhase');
  const statusConfidence = document.getElementById('statusConfidence');
  const statusMessage = document.getElementById('statusMessage');

  // Toolbar Buttons
  const btnRunCode = document.getElementById('btnRunCode');
  const btnAnalyze = document.getElementById('btnAnalyze');
  const btnStop = document.getElementById('btnStop');
  const btnToggle3D = document.getElementById('btnToggle3D');
  const btnUserGuide = document.getElementById('btnUserGuide');
  const btnExport = document.getElementById('btnExport');

  // 3D Overlay Buttons
  const btnReset3D = document.getElementById('btnReset3D');
  const btn3DFlow = document.getElementById('btn3DFlow');
  const btn3DAST = document.getElementById('btn3DAST');
  const btn3DDS = document.getElementById('btn3DDS');

  // Phase Definitions
  const PHASES = [
    { id: 'source', label: 'Source', icon: '📄' },
    { id: 'preprocessing', label: 'Preprocess', icon: '🔧' },
    { id: 'lexical', label: 'Tokens', icon: '🔤' },
    { id: 'syntax', label: 'Syntax', icon: '🌳' },
    { id: 'ast', label: 'AST', icon: '🌲' },
    { id: 'semantic', label: 'Semantic', icon: '🔍' },
    { id: 'symbols', label: 'Symbols', icon: '📋' },
    { id: 'ir', label: 'IR/TAC', icon: '⚙️' },
    { id: 'optimization', label: 'Optimize', icon: '⚡' },
    { id: 'assembly', label: 'Assembly', icon: '📝' },
    { id: 'linking', label: 'Linking', icon: '🔗' },
    { id: 'runtime', label: 'Runtime', icon: '▶️' },
  ];

  // Initialize
  function init() {
    renderPhaseTabs();
    renderMainViewer();
    setupEventListeners();
    init3DEngine();
    vscode.postMessage({ type: 'ready' });
  }

  function init3DEngine() {
    const el = document.getElementById('canvas3DElement');
    if (el && window.Bodha3DEngine) {
      engine3D = new window.Bodha3DEngine(el);
      engine3D.onNodeSelect = (node) => {
        if (statusMessage) {
          statusMessage.textContent = `Selected 3D Node: ${node.label} (${node.type})`;
        }
      };
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Toolbar
    btnRunCode?.addEventListener('click', () => vscode.postMessage({ type: 'runCode' }));
    btnAnalyze?.addEventListener('click', () => vscode.postMessage({ type: 'analyzeCode' }));
    btnStop?.addEventListener('click', () => vscode.postMessage({ type: 'stopExecution' }));
    btnToggle3D?.addEventListener('click', toggle3DMode);
    btnUserGuide?.addEventListener('click', showUserGuide);
    btnExport?.addEventListener('click', () => vscode.postMessage({ type: 'export', format: 'json' }));

    // 3D Overlay
    btnReset3D?.addEventListener('click', () => engine3D?.resetCamera());
    btn3DFlow?.addEventListener('click', () => engine3D?.setProgramFlowData());
    btn3DAST?.addEventListener('click', () => {
      const astArtifact = getArtifactByPhase('ast') || getArtifactByPhase('syntax');
      let astData = null;
      if (astArtifact?.content) {
        try { astData = typeof astArtifact.content === 'string' ? JSON.parse(astArtifact.content) : astArtifact.content; } catch {}
      }
      if (!astData) {
        astData = {
          type: 'TranslationUnit',
          name: 'MainProgram',
          children: [
            { type: 'FunctionDecl', name: 'main()', children: [{ type: 'ReturnStmt', name: 'return 0' }] }
          ]
        };
      }
      engine3D?.setTreeData(astData);
    });
    btn3DDS?.addEventListener('click', () => {
      const symbolArtifact = getArtifactByPhase('symbols') || getArtifactByPhase('semantic');
      let vars = [];
      if (symbolArtifact && Array.isArray(symbolArtifact.content)) {
        vars = symbolArtifact.content.map(s => `${s.name} (${s.type || s.kind || 'var'})`);
      }
      engine3D?.setDataStructureData('array', vars);
      if (statusMessage && engine3D) {
        statusMessage.textContent = `3D Mode: ${engine3D.getRendererMode()}`;
      }
    });

    // Timeline controls
    playPauseBtn?.addEventListener('click', togglePlay);
    prevBtn?.addEventListener('click', prevFrame);
    nextBtn?.addEventListener('click', nextFrame);
    timelineScrubber?.addEventListener('input', scrubTimeline);

    // Window messages
    window.addEventListener('message', handleMessage);
  }

  function toggle3DMode() {
    is3DMode = !is3DMode;
    const modeIcon = document.getElementById('modeIcon');
    const modeLabel = document.getElementById('modeLabel');

    if (is3DMode) {
      if (mainViewer) mainViewer.style.display = 'none';
      if (bodha3dContainer) bodha3dContainer.style.display = 'flex';
      if (modeIcon) modeIcon.textContent = '🖥️';
      if (modeLabel) modeLabel.textContent = '2D View';
      if (btnToggle3D) btnToggle3D.classList.add('active');

      if (engine3D) {
        engine3D.resize();
        engine3D.startAnimation();
        engine3D.setProgramFlowData();
      }
    } else {
      if (mainViewer) mainViewer.style.display = 'flex';
      if (bodha3dContainer) bodha3dContainer.style.display = 'none';
      if (modeIcon) modeIcon.textContent = '📐';
      if (modeLabel) modeLabel.textContent = '3D Mode';
      if (btnToggle3D) btnToggle3D.classList.remove('active');
      if (engine3D) engine3D.stopAnimation();
    }
  }

  function handleMessage(event) {
    const msg = event.data;
    switch (msg.type) {
      case 'analysisResult':
        currentResult = msg.result;
        currentLanguage = msg.result.language || '';
        timelineFrames = msg.result.timeline || [];
        updateLanguageStatus();
        updateTimeline();
        renderPhaseTabs();

        if (currentResult.errors && currentResult.errors.length > 0) {
          renderErrorBreakdown(currentResult.errors[0]);
        } else {
          showPhase(currentPhase);
        }
        break;
      case 'activeDocument':
        handleActiveDocument(msg.docState);
        break;
      case 'debugFrame':
        handleDebugFrame(msg.debugData);
        break;
      case 'languageContext':
        currentLanguage = msg.language;
        updateLanguageStatus();
        break;
      case 'showPhase':
        showPhase(msg.phase);
        break;
      case 'startTimeline':
        togglePlay();
        break;
    }
  }

  function handleActiveDocument(docState) {
    const prevFsPath = activeDocState?.fsPath;
    activeDocState = docState;

    if (!docState || !docState.fsPath) {
      currentResult = null;
      timelineFrames = [];
      updateLanguageStatus();
      renderPhaseTabs();
      renderMainViewer([], currentPhase);
      return;
    }

    if (prevFsPath && prevFsPath !== docState.fsPath) {
      currentResult = null;
      timelineFrames = [];
    }

    currentLanguage = docState.languageId || '';
    updateLanguageStatus();
    renderPhaseTabs();

    if (!currentResult) {
      renderMainViewer([], currentPhase);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Debugger Integration Handler
  function handleDebugFrame(debugData) {
    if (!debugData || !debugData.frames) return;
    const stackNames = debugData.frames.map(f => `${f.name} (${f.source}:${f.line})`);

    // Add frame to timeline
    timelineFrames.push({
      phase: 'runtime',
      label: `Debug Breakpoint: ${debugData.sessionName}`,
      description: `Call Stack: ${stackNames.join(' → ')}`,
      timestamp: debugData.timestamp,
      data: debugData
    });

    updateTimeline();

    if (is3DMode && engine3D) {
      engine3D.setCallStackData(stackNames);
    }
  }

  // Phase Tabs
  function renderPhaseTabs() {
    if (!phaseTabs) return;

    phaseTabs.innerHTML = PHASES.map(p => {
      const active = p.id === currentPhase ? 'active' : '';
      const enabled = isPhaseEnabled(p.id) ? '' : 'disabled';
      return `
        <button class="phase-tab ${active} ${enabled}" data-phase="${p.id}">
          <span class="phase-icon">${p.icon}</span>
          <span class="phase-label">${p.label}</span>
        </button>
      `;
    }).join('');

    phaseTabs.querySelectorAll('.phase-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const phaseId = e.currentTarget.getAttribute('data-phase');
        if (isPhaseEnabled(phaseId)) {
          showPhase(phaseId);
        }
      });
    });
  }

  function isPhaseEnabled(phaseId) {
    if (!currentResult) return true;
    return currentResult.phases.some(p => p.kind === phaseId);
  }

  function showPhase(phaseId) {
    currentPhase = phaseId;
    renderPhaseTabs();

    if (!currentResult) {
      renderMainViewer([], phaseId);
      return;
    }

    const phase = currentResult.phases.find(p => p.kind === phaseId);
    const artifact = getArtifactByPhase(phaseId);

    updatePhaseStatus(phase);
    renderMainViewer(artifact ? [artifact] : [], phaseId);
  }

  function getArtifactByPhase(phaseId) {
    if (!currentResult?.artifacts) return null;
    const artifacts = Array.isArray(currentResult.artifacts) ? currentResult.artifacts : [];
    return artifacts.find(a => a.phase === phaseId) || null;
  }

  // Main Viewer
  function renderMainViewer(artifacts = [], phaseId = 'source') {
    if (!mainViewer) return;

    if (!currentResult) {
      if (!activeDocState || !activeDocState.fsPath) {
        mainViewer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <h3>Open a source file first (C, C++, Java, or Python).</h3>
            <p class="hint">Open a supported source file in the editor to activate BODHA Compiler Visualizer.</p>
          </div>
        `;
        return;
      }

      if (!activeDocState.isSupported) {
        const langName = (activeDocState.unsupportedLang || activeDocState.languageId || 'Unknown').toUpperCase();
        const fileName = activeDocState.fsPath.split('/').pop() || activeDocState.fsPath;
        mainViewer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Unsupported File Type: ${escapeHtml(langName)}</h3>
            <p>File: <code>${escapeHtml(fileName)}</code></p>
            <p class="hint">BODHA supports <strong>C (.c)</strong>, <strong>C++ (.cpp)</strong>, <strong>Java (.java)</strong>, and <strong>Python (.py)</strong> files.</p>
          </div>
        `;
        return;
      }

      const fileName = activeDocState.fsPath.split('/').pop() || activeDocState.fsPath;
      mainViewer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <h3>Active Source: ${escapeHtml(fileName)}</h3>
          <p>Language: <strong>${escapeHtml(activeDocState.languageId.toUpperCase())}</strong> | Path: <code>${escapeHtml(activeDocState.fsPath)}</code></p>
          <p class="hint">Click <strong>Analyze</strong> or <strong>Run</strong> in the toolbar to inspect the compiler pipeline.</p>
        </div>
      `;
      return;
    }

    if (artifacts.length === 0) {
      mainViewer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${getPhaseIcon(phaseId)}</div>
          <h3>No Artifact Output Available for ${phaseId.toUpperCase()}</h3>
          <p>This phase has no output artifact in current run.</p>
          <p class="hint">Press <strong>Analyze</strong> or <strong>Run</strong> to generate artifacts.</p>
        </div>
      `;
      return;
    }

    const artifact = artifacts[0];
    mainViewer.innerHTML = renderArtifact(artifact, phaseId);
  }

  function renderArtifact(artifact, phaseId) {
    if (!artifact) return '<div class="empty-state">No artifact</div>';

    const confidenceClass = `confidence-${artifact.confidence || 'REAL_TOOLCHAIN'}`;
    const header = `
      <div class="artifact-header">
        <span class="artifact-phase">${artifact.phase.toUpperCase()}</span>
        <span class="confidence-badge ${confidenceClass}">${(artifact.confidence || 'REAL_TOOLCHAIN').replace('_', ' ')}</span>
        ${artifact.toolchain ? `<span class="artifact-toolchain">Compiler: ${artifact.toolchain}</span>` : ''}
      </div>
    `;

    let content = '';
    switch (phaseId) {
      case 'lexical':
        content = renderTokens(artifact.content);
        break;
      case 'ast':
      case 'syntax':
        content = renderAST(artifact.content);
        break;
      case 'symbols':
        content = renderSymbolTable(artifact.content);
        break;
      case 'ir':
        content = renderIR(artifact.content);
        break;
      case 'optimization':
        content = renderOptimization(artifact.content);
        break;
      case 'assembly':
        content = renderAssembly(artifact.content);
        break;
      default:
        content = `<pre class="artifact-viewer">${escapeHtml(typeof artifact.content === 'string' ? artifact.content : JSON.stringify(artifact.content, null, 2))}</pre>`;
    }

    return `${header}<div class="artifact-viewer">${content}</div>`;
  }

  function renderTokens(content) {
    if (Array.isArray(content)) {
      return content.map(t => `
        <span class="token token-${t.type}" onclick="vscode.postMessage({type:'sourceClick', location:{line:${t.line || 1}, column:${t.column || 1}}})">
          ${escapeHtml(t.value || t.text)}
        </span>
      `).join(' ');
    }
    return `<pre class="artifact-viewer">${escapeHtml(content)}</pre>`;
  }

  function renderAST(content) {
    let data = content;
    if (typeof content === 'string') {
      try { data = JSON.parse(content); } catch { return `<pre class="artifact-viewer">${escapeHtml(content)}</pre>`; }
    }
    return `<div class="ast-tree">${renderASTNode(data)}</div>`;
  }

  function renderASTNode(node, depth = 0) {
    if (!node || typeof node !== 'object') return `<span class="ast-val">${escapeHtml(String(node))}</span>`;

    if (Array.isArray(node)) {
      return node.map(n => renderASTNode(n, depth)).join('');
    }

    const type = node.type || node.name || 'ASTNode';
    const lineno = node.lineno || node.line;
    const hasChildren = Object.keys(node).some(k => k !== 'type' && k !== 'name' && k !== 'lineno' && typeof node[k] === 'object');

    let html = `
      <div class="ast-node expanded" data-depth="${depth}">
        <div class="ast-node-header" ${lineno ? `onclick="vscode.postMessage({type:'sourceClick', location:{line:${lineno}, column:1}})"` : ''}>
          <span class="ast-toggle">${hasChildren ? '▼' : '●'}</span>
          <span class="ast-node-type">${escapeHtml(type)}</span>
          ${lineno ? `<span class="ast-node-meta">(line ${lineno})</span>` : ''}
        </div>
    `;

    if (hasChildren) {
      html += '<div class="ast-children">';
      for (const [key, value] of Object.entries(node)) {
        if (key === 'type' || key === 'lineno' || key === 'col_offset') continue;
        if (typeof value === 'object' && value !== null) {
          html += `<div class="ast-node-prop"><span class="ast-prop-key">${escapeHtml(key)}:</span> ${renderASTNode(value, depth + 1)}</div>`;
        }
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderSymbolTable(content) {
    let symbols = [];
    if (typeof content === 'string') {
      try { symbols = JSON.parse(content); } catch { return `<pre>${escapeHtml(content)}</pre>`; }
    } else if (Array.isArray(content)) {
      symbols = content;
    }

    if (!symbols || !symbols.length) return '<div class="empty-state">No symbols extracted</div>';

    return `
      <table class="symbol-table">
        <thead>
          <tr><th>Name</th><th>Kind</th><th>Type</th><th>Scope</th></tr>
        </thead>
        <tbody>
          ${symbols.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.name || '')}</strong></td>
              <td>${escapeHtml(s.kind || '')}</td>
              <td><code>${escapeHtml(s.type || s.dataType || '')}</code></td>
              <td>${escapeHtml(s.scope || 'global')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderIR(content) {
    return `<pre class="ir-code">${escapeHtml(typeof content === 'string' ? content : JSON.stringify(content, null, 2))}</pre>`;
  }

  function renderOptimization(content) {
    return `<pre class="ir-code">${escapeHtml(typeof content === 'string' ? content : JSON.stringify(content, null, 2))}</pre>`;
  }

  function renderAssembly(content) {
    if (typeof content !== 'string') content = JSON.stringify(content, null, 2);
    const lines = content.split('\n');
    return `
      <pre class="asm-code">
        ${lines.map(line => `<span class="asm-line">${escapeHtml(line)}</span>`).join('\n')}
      </pre>
    `;
  }

  // Educational Error Breakdown Card
  function renderErrorBreakdown(errorObj) {
    if (!mainViewer) return;
    const msg = errorObj.message || 'Compiler diagnostic error';
    const phase = errorObj.phase || currentPhase || 'compilation';
    const loc = errorObj.location ? `Line ${errorObj.location.line}, Column ${errorObj.location.column}` : 'Unknown location';

    mainViewer.innerHTML = `
      <div class="error-breakdown-card">
        <div class="error-card-header">
          <span class="error-badge">⚠️ COMPILER DIAGNOSTIC</span>
          <span class="error-stage-badge">${phase.toUpperCase()} STAGE</span>
        </div>
        <div class="error-card-title">${escapeHtml(msg)}</div>

        <div class="error-section">
          <h4>❓ WHAT HAPPENED?</h4>
          <p>The compiler or interpreter encountered a structural flaw during execution.</p>
        </div>

        <div class="error-section">
          <h4>📍 WHERE?</h4>
          <p><code>${escapeHtml(loc)}</code> in source file.</p>
        </div>

        <div class="error-section">
          <h4>🔍 WHY?</h4>
          <p>Common causes include missing semicolons, unclosed brackets, undeclared variables, or type mismatches.</p>
        </div>

        <div class="error-section">
          <h4>💡 WHAT SHOULD I CHECK?</h4>
          <ul>
            <li>Verify syntax around line boundary.</li>
            <li>Check imported modules and variable definitions.</li>
            <li>Inspect diagnostic underlines in editor panel.</li>
          </ul>
        </div>

        <div class="error-actions">
          <button class="hero-btn primary" onclick="vscode.postMessage({type:'explainError', error: ${JSON.stringify(errorObj)}})">💡 Request Educational Explanation</button>
        </div>
      </div>
    `;
  }

  // Interactive User Guide
  function showUserGuide() {
    if (!mainViewer) return;
    mainViewer.innerHTML = `
      <div class="user-guide-container">
        <h2>📘 BODHA — Visual Developer Environment User Guide</h2>

        <div class="guide-card">
          <h3>⚡ Quick Keyboard Shortcuts</h3>
          <ul>
            <li><code>Ctrl + Alt + B</code> — Analyze Full Compiler Pipeline</li>
            <li><code>Ctrl + Alt + R</code> — Run Code in Integrated Terminal</li>
            <li><code>Ctrl + Alt + S</code> — Stop Active Execution Process</li>
          </ul>
        </div>

        <div class="guide-card">
          <h3>🔄 The Compiler Execution Pipeline</h3>
          <ol>
            <li><strong>Source:</strong> Raw user source code file.</li>
            <li><strong>Preprocess:</strong> Includes macros, header expansion, preprocessor directives.</li>
            <li><strong>Tokens (Lexical):</strong> Lexical scanner breaks code into tokens (Keywords, Identifiers, Literals).</li>
            <li><strong>AST (Syntax):</strong> Abstract Syntax Tree representing structural hierarchy.</li>
            <li><strong>IR / TAC:</strong> Intermediate Representation & Three-Address Code.</li>
            <li><strong>Assembly / Bytecode:</strong> Low-level machine architecture instructions.</li>
            <li><strong>Runtime:</strong> Live execution output in integrated BODHA Terminal.</li>
          </ol>
        </div>

        <div class="guide-card">
          <h3>📐 3D Spatial Visualization Mode</h3>
          <p>Click <strong>3D Mode</strong> in the toolbar to enter full WebGL spatial view. Drag with mouse to orbit rotate, scroll to zoom, and select nodes to inspect hierarchy.</p>
        </div>
      </div>
    `;
  }

  // Timeline
  function updateTimeline() {
    if (!timelineFramesEl) return;
    if (!timelineFrames.length) {
      timelineFramesEl.innerHTML = '<div class="empty-state" style="padding:16px;">No timeline frames</div>';
      return;
    }

    timelineFramesEl.innerHTML = timelineFrames.map((frame, i) => `
      <div class="timeline-frame ${i === currentFrameIndex ? 'active' : ''}" data-index="${i}">
        <span class="timeline-frame-index">${i + 1}</span>
        <div class="timeline-frame-content">
          <div class="timeline-frame-phase">${escapeHtml(frame.label || frame.phase)}</div>
          <div class="timeline-frame-desc">${escapeHtml(frame.description || '')}</div>
        </div>
      </div>
    `).join('');

    timelineFramesEl.querySelectorAll('.timeline-frame').forEach(el => {
      el.addEventListener('click', () => jumpToFrame(parseInt(el.dataset.index)));
    });

    updateScrubber();
  }

  function updateScrubber() {
    if (timelineScrubber) {
      timelineScrubber.max = Math.max(0, timelineFrames.length - 1);
      timelineScrubber.value = currentFrameIndex;
    }
  }

  function jumpToFrame(index) {
    if (index < 0 || index >= timelineFrames.length) return;
    currentFrameIndex = index;
    const frame = timelineFrames[index];
    if (frame) {
      showPhase(frame.phase);
    }
    updateTimeline();
  }

  function scrubTimeline(e) {
    jumpToFrame(parseInt(e.target.value));
  }

  function prevFrame() {
    jumpToFrame(Math.max(0, currentFrameIndex - 1));
  }

  function nextFrame() {
    jumpToFrame(Math.min(timelineFrames.length - 1, currentFrameIndex + 1));
  }

  function togglePlay() {
    if (isPlaying) {
      clearInterval(playInterval);
      isPlaying = false;
    } else {
      isPlaying = true;
      playInterval = setInterval(() => {
        if (currentFrameIndex < timelineFrames.length - 1) {
          nextFrame();
        } else {
          togglePlay();
        }
      }, 1000);
    }
    if (playPauseBtn) playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
  }

  function updateLanguageStatus() {
    if (statusLanguage) statusLanguage.textContent = (currentLanguage || 'SOURCE').toUpperCase();
  }

  function updatePhaseStatus(phase) {
    if (statusPhase) statusPhase.textContent = phase?.name || currentPhase.toUpperCase();
    if (statusConfidence) statusConfidence.textContent = 'REAL TOOLCHAIN';
  }

  function getPhaseIcon(phaseId) {
    const phase = PHASES.find(p => p.id === phaseId);
    return phase?.icon || '📄';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();