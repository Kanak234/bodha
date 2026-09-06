# BODHA — Compiler Visualizer

**बोध** — *Understanding. Knowledge. Awakening.*

Visualize what your compiler actually does. Transform source code into tokens, AST, IR, assembly, and runtime — all inside VS Code.

![BODHA Demo](https://img.shields.io/badge/demo-coming_soon-lightgrey)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![VS Code](https://img.shields.io/badge/VS_Code-%5E1.85.0-blue)

---

## Why BODHA?

You write code. The compiler transforms it. But what *actually* happens between your keystrokes and the executable?

BODHA makes the invisible visible:

```
Source Code
    ↓
Preprocessing (REAL: gcc -E)
    ↓
Lexical Analysis (REAL: clang -Xclang -dump-tokens)
    ↓
Syntax Analysis → AST (REAL: clang -Xclang -ast-dump)
    ↓
Semantic Analysis → Symbol Table (REAL: nm, javap -v)
    ↓
Intermediate Representation (REAL: GIMPLE, LLVM IR, Bytecode)
    ↓
Optimization (REAL: -O0 vs -O2 assembly)
    ↓
Assembly (REAL: -S output)
    ↓
Linking → Executable
    ↓
Runtime (REAL: debugger, disassembly)
```

Every visualization is labeled with its **source of truth**:

- 🟢 **[REAL TOOLCHAIN]** — Directly from your local compiler/interpreter
- 🟡 **[DERIVED]** — Reconstructed from artifacts (debug info, bytecode, etc.)
- 🟣 **[EDUCATIONAL]** — Textbook reconstruction when toolchain doesn't expose internals

---

## Features

### Multi-Language Support
| Language | Toolchain | Real Artifacts |
|----------|-----------|----------------|
| **C** | GCC, Clang | Preprocessed, Tokens, AST, GIMPLE, Assembly, Symbols |
| **C++** | G++, Clang++ | All C + templates, classes, vtables |
| **Java** | javac, java, javap | Bytecode, Constant Pool, Class Info, JIT info |
| **Python** | CPython | AST (ast module), Tokens (tokenize), Bytecode (dis), Symbols |

### Visualizations
- **Token Stream** — Interactive, color-coded, clickable
- **AST** — Expandable tree, source↔node sync
- **Symbol Table** — Sortable, filterable, scoped
- **IR / TAC** — Three-address code, quadruples
- **Optimization** — Before/after with transformation labels
- **Control Flow Graph** — Basic blocks, edges, dominance
- **Assembly** — Source-mapped, syntax highlighted
- **Runtime** — Call stack, activation records, bytecode

### Timeline Controller
- Frame-by-frame playback
- Scrubber for jumping to any phase
- Source highlighting per frame
- Artifact panel per frame

### Source Mapping
Click any token, AST node, IR instruction, or assembly line → highlights source code. Click source → highlights artifact.

### Modes
- **Educational** — Textbook reconstructions with explanations
- **Real Toolchain** — Only what your local compiler exposes
- **Compare** — Side-by-side: source↔tokens, AST↔IR, IR↔Assembly, -O0↔-O2

### Export
- PNG / SVG diagrams
- JSON (full pipeline data)
- Markdown / HTML reports

---

## Installation

### From VSIX (Recommended)
```bash
code --install-extension bodha-0.1.0.vsix
```

### From Source
```bash
git clone https://github.com/Kanak234/bodha
cd bodha
npm install
npm run compile
code --install-extension .
```

---

## Quick Start

1. Open a C, C++, Java, or Python file
2. Press `Ctrl+Alt+B` (or `Cmd+Alt+B` on Mac)
3. BODHA panel opens beside your editor
4. Click phase tabs: **Tokens → AST → Symbols → IR → Assembly → Runtime**
5. Use timeline scrubber to animate compilation
4. Click any artifact element to highlight source

---

## Requirements

### Toolchains (Auto-detected)
| Language | Required Tools |
|----------|----------------|
| C | `gcc` or `clang` |
| C++ | `g++` or `clang++` |
| Java | `javac`, `java`, `javap` |
| Python | `python3` (CPython) |

Run **BODHA: Detect Toolchains** to verify.

### Configure Custom Paths
```json
"bodha.toolchains": {
  "compilerPath": "C:\\msys64\\ucrt64\\bin",
  "c": "gcc",
  "cpp": "g++",
  "java": "javac",
  "javaRuntime": "java",
  "javap": "javap",
  "python": "python3"
}
```

---

## Architecture

```
src/
├── extension.ts              # Entry point, commands, adapter registry
├── adapters/                 # Language-specific pipelines
│   ├── LanguageAdapter.ts    # Abstract base
│   ├── CAdapter.ts           # GCC/Clang pipeline
│   ├── CppAdapter.ts         # C++ extensions
│   ├── JavaAdapter.ts        # javac/java/javap
│   └── PythonAdapter.ts      # ast/tokenize/dis
├── pipeline/
│   └── PipelineOrchestrator.ts
├── toolchains/
│   └── ToolchainDetector.ts  # Auto-discovery
├── visualization/
│   └── webview/
│       ├── CompilerVisualizerPanel.ts
│       ├── compiler-visualizer.css
│       └── compiler-visualizer.js
├── types/
│   └── index.ts              # Core type definitions
└── utils/
```

### Key Design Principles
1. **Honest visualization** — Every artifact tagged REAL/DERIVED/EDUCATIONAL
2. **Local-first** — No network calls, no telemetry
3. **Adapter pattern** — Add languages without touching core
4. **Security** — Timeouts, output limits, process isolation
5. **Performance** — Lazy rendering, virtualized trees, capped nodes

---

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Run tests
npm test

# Package VSIX
npm run package

# Lint
npm run lint
```

---

## Security

- All execution is **local** — no code leaves your machine
- Process sandboxing: timeouts, output limits, child process cleanup
- No shell injection — commands spawned directly
- Respects VS Code workspace trust

---

## Privacy

- **Zero telemetry** by default
- No source code uploaded
- No compiler output uploaded
- Fully offline capable

---

## Roadmap

- [ ] Rust adapter (`rustc --emit=llvm-ir,asm`)
- [ ] Go adapter (`go tool compile -S`)
- [ ] JavaScript/TypeScript adapter (Babel, SWC, V8 bytecode)
- [ ] 3D CFG/AST visualization
- [ ] Collaborative timeline sharing
- [ ] Compiler Explorer integration
- [ ] Custom phase plugins

---

## Name Origin

**BODHA (बोध)** — Sanskrit for *understanding, knowledge, awakening*.

The compiler transforms code. BODHA transforms confusion into understanding.

---

## License

MIT — See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Inspired by [VYUHA](https://marketplace.visualstudio.com/items?itemName=KANAKPRABHAKAR.vyuha) for timeline/visualization UX concepts
- Compiler Design course material (RVKT sir's notes)
- LLVM/Clang, GCC, OpenJDK, CPython teams for exposing internals
- VS Code team for the extension platform

---

**Made with 🧠 for compiler learners everywhere.**