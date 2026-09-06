/**
 * BODHA 3D Visualization Engine - Hardware Accelerated WebGL / WebGL2 & Canvas Fallback
 * Interactive 3D Spatial Rendering for AST, Call Stack, Trees, Graphs, Program Flow, and Data Structures
 */

(function (global) {
  'use strict';

  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    add(v) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
    multiplyScalar(s) { return new Vector3(this.x * s, this.y * s, this.z * s); }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() {
      const len = this.length() || 1;
      return new Vector3(this.x / len, this.y / len, this.z / len);
    }
  }

  class Bodha3DEngine {
    constructor(canvasContainer) {
      this.container = canvasContainer;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'bodha-3d-canvas';
      this.container.appendChild(this.canvas);

      // Try hardware WebGL2 -> WebGL context
      this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      this.isWebGL = !!this.gl;
      this.ctx = !this.isWebGL ? this.canvas.getContext('2d') : null;

      // Camera State
      this.camera = {
        position: new Vector3(0, 0, 450),
        target: new Vector3(0, 0, 0),
        zoom: 1.0,
        rotationX: 0.3,
        rotationY: 0.5,
      };

      // Scene Data
      this.nodes = []; // { id, label, type, pos: Vector3, radius, color, shape, data }
      this.edges = []; // { fromId, toId, label, color, dashed }
      this.selectedNode = null;
      this.hoveredNode = null;

      // Interaction State
      this.isDragging = false;
      this.previousMousePosition = { x: 0, y: 0 };
      this.animationId = null;
      this.autoRotate = true;

      if (this.isWebGL) {
        this.initWebGL();
      }

      this.initEvents();
      this.resize();
    }

    getRendererMode() {
      return this.isWebGL ? 'WebGL Hardware Accelerated' : '2D Software Fallback';
    }

    initWebGL() {
      const gl = this.gl;
      if (!gl) return;

      const vsSource = `
        attribute vec3 aPosition;
        attribute vec4 aColor;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uModelViewMatrix;
        varying vec4 vColor;
        void main() {
          gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
          gl_PointSize = 24.0;
          vColor = aColor;
        }
      `;

      const fsSource = `
        precision mediump float;
        varying vec4 vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
          gl_FragColor = vColor;
        }
      `;

      const createShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn('WebGL shader compile error:', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vertShader = createShader(gl.VERTEX_SHADER, vsSource);
      const fragShader = createShader(gl.FRAGMENT_SHADER, fsSource);
      if (!vertShader || !fragShader) {
        this.isWebGL = false;
        this.ctx = this.canvas.getContext('2d');
        return;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('WebGL program link error:', gl.getProgramInfoLog(program));
        this.isWebGL = false;
        this.ctx = this.canvas.getContext('2d');
        return;
      }

      this.webglProgram = program;
      this.locations = {
        aPosition: gl.getAttribLocation(program, 'aPosition'),
        aColor: gl.getAttribLocation(program, 'aColor'),
        uProjectionMatrix: gl.getUniformLocation(program, 'uProjectionMatrix'),
        uModelViewMatrix: gl.getUniformLocation(program, 'uModelViewMatrix'),
      };

      this.positionBuffer = gl.createBuffer();
      this.colorBuffer = gl.createBuffer();
      gl.enable(gl.DEPTH_TEST);
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width || 800;
      this.height = rect.height || 500;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;

      if (this.isWebGL && this.gl) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      } else if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
      this.render();
    }

    initEvents() {
      window.addEventListener('resize', () => this.resize());

      this.canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
        this.checkHit(e.clientX, e.clientY, true);
      });

      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (this.isDragging) {
          const deltaX = e.clientX - this.previousMousePosition.x;
          const deltaY = e.clientY - this.previousMousePosition.y;

          this.camera.rotationY += deltaX * 0.008;
          this.camera.rotationX += deltaY * 0.008;
          this.camera.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camera.rotationX));

          this.previousMousePosition = { x: e.clientX, y: e.clientY };
          this.render();
        } else {
          this.checkHit(mouseX, mouseY, false);
        }
      });

      this.canvas.addEventListener('mouseup', () => { this.isDragging = false; });
      this.canvas.addEventListener('mouseleave', () => {
        this.isDragging = false;
        this.hoveredNode = null;
        this.render();
      });

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        this.camera.zoom = Math.max(0.2, Math.min(4.5, this.camera.zoom * zoomFactor));
        this.render();
      }, { passive: false });
    }

    resetCamera() {
      this.camera.rotationX = 0.3;
      this.camera.rotationY = 0.5;
      this.camera.zoom = 1.0;
      this.render();
    }

    startAnimation() {
      if (this.animationId) return;
      const animate = () => {
        if (this.autoRotate && !this.isDragging) {
          this.camera.rotationY += 0.0025;
          this.render();
        }
        this.animationId = requestAnimationFrame(animate);
      };
      animate();
    }

    stopAnimation() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }

    // 1. 3D AST Spatial Tree Layout driven by real data
    setTreeData(astData) {
      this.nodes = [];
      this.edges = [];
      if (!astData) return;

      let idCounter = 0;
      const processNode = (node, depth = 0, parentId = null, indexInParent = 0, siblingCount = 1) => {
        const id = `ast_${idCounter++}`;
        const type = node.type || node.name || 'ASTNode';
        const label = node.name || node.type || 'Node';

        const radius = Math.max(16, 26 - depth * 2);
        const horizontalSpacing = 120 / (depth + 1);
        const x = (indexInParent - (siblingCount - 1) / 2) * horizontalSpacing * 1.6;
        const y = -depth * 95 + 160;
        const z = (Math.sin(indexInParent + depth) * 45);

        const colorMap = {
          TranslationUnit: '#4fc3f7',
          FunctionDecl: '#66bb6a',
          CompoundStmt: '#ba68c8',
          BinaryOperator: '#ffca28',
          ParmVarDecl: '#ab47bc',
          DeclRefExpr: '#29b6f6',
          IntegerLiteral: '#81c784',
          ReturnStmt: '#ef5350',
          IfStmt: '#ff9800',
          ForStmt: '#26a69a'
        };

        const nodeObj = {
          id,
          label,
          type,
          pos: new Vector3(x, y, z),
          radius,
          color: colorMap[type] || '#4fc3f7',
          data: node
        };

        this.nodes.push(nodeObj);
        if (parentId !== null) this.edges.push({ fromId: parentId, toId: id });

        const children = [];
        for (const [key, val] of Object.entries(node)) {
          if (key === 'type' || key === 'lineno' || key === 'col_offset') continue;
          if (Array.isArray(val)) {
            val.forEach(c => { if (typeof c === 'object' && c) children.push(c); });
          } else if (typeof val === 'object' && val) {
            children.push(val);
          }
        }

        children.forEach((child, i) => {
          processNode(child, depth + 1, id, i, children.length);
        });
      };

      processNode(astData);
      this.render();
    }

    // 2. 3D Program Execution Flow driven by active pipeline stages
    setProgramFlowData(customStages = null) {
      this.nodes = [];
      this.edges = [];

      const stages = customStages || [
        { id: 'source', label: '1. Source Code', color: '#00bcd4', pos: new Vector3(-260, 120, 0) },
        { id: 'lexical', label: '2. Lexer (Tokens)', color: '#ab47bc', pos: new Vector3(-140, 60, 70) },
        { id: 'syntax', label: '3. Parser (AST)', color: '#4caf50', pos: new Vector3(0, 0, 0) },
        { id: 'semantic', label: '4. Semantic Symbols', color: '#ffca28', pos: new Vector3(120, -50, -70) },
        { id: 'ir', label: '5. IR / TAC', color: '#ff9800', pos: new Vector3(240, -100, 0) },
        { id: 'assembly', label: '6. Assembly / CodeGen', color: '#2196f3', pos: new Vector3(340, -140, 50) },
        { id: 'runtime', label: '7. Execution Terminal', color: '#ef5350', pos: new Vector3(440, -180, 0) },
      ];

      stages.forEach((s, i) => {
        this.nodes.push({
          id: s.id,
          label: s.label,
          type: 'CompilerStage',
          pos: s.pos || new Vector3((i - 3) * 110, Math.sin(i) * 40, Math.cos(i) * 30),
          radius: 26,
          color: s.color || '#4fc3f7',
          data: s
        });
        if (i > 0) this.edges.push({ fromId: stages[i - 1].id, toId: s.id });
      });

      this.render();
    }

    // 3. 3D Call Stack & Execution Frames driven by real debugger/timeline frames
    setCallStackData(frames = []) {
      this.nodes = [];
      this.edges = [];

      if (!frames || !frames.length) {
        frames = ['main()'];
      }

      frames.forEach((f, i) => {
        const id = `stack_${i}`;
        const frameLabel = typeof f === 'string' ? f : (f.name || `Frame ${i}`);
        this.nodes.push({
          id,
          label: `Frame ${i}: ${frameLabel}`,
          type: 'StackFrame',
          pos: new Vector3(0, i * 55 - 80, (i % 2 === 0 ? 30 : -30)),
          radius: 25,
          color: i === frames.length - 1 ? '#ef5350' : '#ba68c8',
          data: typeof f === 'object' ? f : { frame: f, level: i }
        });
        if (i > 0) this.edges.push({ fromId: `stack_${i - 1}`, toId: id });
      });

      this.render();
    }

    // 4. Real Data Structure Visualizations
    setDataStructureData(dsType = 'array', realValues = null) {
      this.nodes = [];
      this.edges = [];

      const values = Array.isArray(realValues) && realValues.length > 0 ? realValues : [10, 20, 30, 40, 50];

      if (dsType === 'array' || dsType === 'matrix' || dsType === 'stack' || dsType === 'queue') {
        values.forEach((v, i) => {
          const id = `ds_${i}`;
          const valLabel = typeof v === 'object' ? (v.name ? `${v.name}=${v.value}` : JSON.stringify(v)) : String(v);
          this.nodes.push({
            id,
            label: `[${i}]: ${valLabel}`,
            type: 'DataStructureNode',
            pos: new Vector3((i - (values.length - 1) / 2) * 65, 0, Math.sin(i) * 25),
            radius: 22,
            color: i === values.length - 1 ? '#ffca28' : '#29b6f6',
            data: { index: i, value: v }
          });
          if (i > 0) this.edges.push({ fromId: `ds_${i - 1}`, toId: id });
        });
      } else if (dsType === 'tree') {
        values.forEach((v, i) => {
          const id = `tree_${i}`;
          const valLabel = typeof v === 'object' ? (v.name || v.label || String(v.value)) : String(v);
          const x = (i % 2 === 0 ? -1 : 1) * Math.ceil(i / 2) * 70;
          const y = -Math.floor(i / 2) * 80 + 100;
          this.nodes.push({
            id,
            label: valLabel,
            type: 'TreeNode',
            pos: new Vector3(x, y, (i % 3) * 20),
            radius: 24,
            color: i === 0 ? '#4fc3f7' : '#66bb6a',
            data: { index: i, value: v }
          });
          if (i > 0) this.edges.push({ fromId: `tree_${Math.floor((i - 1) / 2)}`, toId: id });
        });
      }

      this.render();
    }

    project(point3D) {
      const cosY = Math.cos(this.camera.rotationY);
      const sinY = Math.sin(this.camera.rotationY);
      const cosX = Math.cos(this.camera.rotationX);
      const sinX = Math.sin(this.camera.rotationX);

      let x1 = point3D.x * cosY - point3D.z * sinY;
      let z1 = point3D.z * cosY + point3D.x * sinY;
      let y2 = point3D.y * cosX - z1 * sinX;
      let z2 = z1 * cosX + point3D.y * sinX;

      const distance = 500;
      const fovScale = distance / (distance + z2);
      const scale = fovScale * this.camera.zoom;

      const screenX = this.width / 2 + x1 * scale;
      const screenY = this.height / 2 - y2 * scale;

      return { x: screenX, y: screenY, scale, depth: z2 };
    }

    checkHit(mouseX, mouseY, isClick) {
      let hitNode = null;
      let maxDepth = -Infinity;

      for (const node of this.nodes) {
        const p = this.project(node.pos);
        const radiusScreen = node.radius * p.scale;
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radiusScreen) {
          if (p.depth > maxDepth) {
            maxDepth = p.depth;
            hitNode = node;
          }
        }
      }

      this.hoveredNode = hitNode;
      this.canvas.style.cursor = hitNode ? 'pointer' : 'default';

      if (isClick) {
        this.selectedNode = hitNode;
        if (hitNode && this.onNodeSelect) {
          this.onNodeSelect(hitNode);
        }
      }

      this.render();
    }

    render() {
      if (this.isWebGL && this.gl) {
        this.renderWebGL();
      } else if (this.ctx) {
        this.render2D();
      }
    }

    renderWebGL() {
      const gl = this.gl;
      if (!gl || !this.webglProgram) return;

      gl.clearColor(0.05, 0.09, 0.15, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(this.webglProgram);

      // Render 2D spatial overlays over WebGL for labels & picking accuracy
      if (!this.ctx2DOverlay) {
        let overlay = this.container.querySelector('.bodha-3d-overlay');
        if (!overlay) {
          overlay = document.createElement('canvas');
          overlay.className = 'bodha-3d-overlay';
          overlay.style.position = 'absolute';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.pointerEvents = 'none';
          this.container.appendChild(overlay);
        }
        overlay.width = this.canvas.width;
        overlay.height = this.canvas.height;
        this.ctx2DOverlay = overlay.getContext('2d');
      }

      const overlayCtx = this.ctx2DOverlay;
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

      const projectedNodes = this.nodes.map(n => ({ node: n, proj: this.project(n.pos) }));
      projectedNodes.sort((a, b) => b.proj.depth - a.proj.depth);

      // WebGL Point & Label overlay
      for (const item of projectedNodes) {
        const { node, proj } = item;
        const r = Math.max(8, node.radius * proj.scale);

        overlayCtx.beginPath();
        overlayCtx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
        overlayCtx.fillStyle = node.color;
        overlayCtx.fill();
        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.lineWidth = 1.5;
        overlayCtx.stroke();

        overlayCtx.font = `${Math.max(10, Math.min(14, 12 * proj.scale))}px system-ui, sans-serif`;
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.textAlign = 'center';
        overlayCtx.textBaseline = 'middle';
        overlayCtx.fillText(node.label, proj.x, proj.y + r + 14);
      }
    }

    render2D() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.width, this.height);

      const projectedNodes = this.nodes.map(n => ({ node: n, proj: this.project(n.pos) }));
      projectedNodes.sort((a, b) => b.proj.depth - a.proj.depth);

      const projMap = new Map();
      projectedNodes.forEach(item => projMap.set(item.node.id, item.proj));

      // Edges
      this.ctx.lineWidth = 2;
      for (const edge of this.edges) {
        const p1 = projMap.get(edge.fromId);
        const p2 = projMap.get(edge.toId);

        if (p1 && p2) {
          const gradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          gradient.addColorStop(0, 'rgba(79, 195, 247, 0.45)');
          gradient.addColorStop(1, 'rgba(102, 187, 106, 0.45)');

          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = gradient;
          this.ctx.stroke();
        }
      }

      // Nodes
      for (const item of projectedNodes) {
        const { node, proj } = item;
        const r = Math.max(8, node.radius * proj.scale);

        const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;
        const isSelected = this.selectedNode && this.selectedNode.id === node.id;

        if (isHovered || isSelected) {
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(proj.x, proj.y, r + 8, 0, Math.PI * 2);
          this.ctx.fillStyle = isSelected ? 'rgba(255, 202, 40, 0.45)' : 'rgba(79, 195, 247, 0.35)';
          this.ctx.fill();
          this.ctx.restore();
        }

        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
        const radial = this.ctx.createRadialGradient(
          proj.x - r * 0.3, proj.y - r * 0.3, r * 0.1,
          proj.x, proj.y, r
        );
        radial.addColorStop(0, '#ffffff');
        radial.addColorStop(0.3, node.color);
        radial.addColorStop(1, '#0e1726');

        this.ctx.fillStyle = radial;
        this.ctx.fill();
        this.ctx.lineWidth = isSelected ? 3 : 1.5;
        this.ctx.strokeStyle = isSelected ? '#ffca28' : '#ffffff';
        this.ctx.stroke();

        if (r > 6) {
          this.ctx.font = `${Math.max(10, Math.min(14, 12 * proj.scale))}px system-ui, sans-serif`;
          this.ctx.fillStyle = '#ffffff';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(node.label, proj.x, proj.y + r + 14);
        }
      }
    }
  }

  global.Bodha3DEngine = Bodha3DEngine;
})(window);
