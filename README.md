# BODHA — Compiler Visualizer

**बोध** — *Understanding. Knowledge. Awakening.*

Visualize what your compiler actually does. Transform source code into tokens, AST, IR, assembly, and runtime — all inside VS Code.

[![CI](https://github.com/Kanak234/bodha/actions/workflows/ci.yml/badge.svg)](https://github.com/Kanak234/bodha/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Kanak234/bodha/actions/workflows/codeql.yml/badge.svg)](https://github.com/Kanak234/bodha/actions/workflows/codeql.yml)
[![Version](https://img.shields.io/badge/version-0.4.0-blue)](https://github.com/Kanak234/bodha/releases)
[![Coverage](https://img.shields.io/badge/coverage-87.56%25-brightgreen)](https://github.com/Kanak234/bodha)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.txt)
[![VS Code](https://img.shields.io/badge/VS_Code-%5E1.85.0-blue)](https://marketplace.visualstudio.com)

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
- Step forward/backward through compiler stages
- Jump directly to any phase
- Compare artifact states across optimization passes

---

## Getting Started

### Prerequisites
- VS Code `^1.85.0`
- Node.js 18, 20, or 22
- Local toolchains installed on PATH:
  - C/C++: `gcc` / `g++` or `clang` / `clang++`
  - Java: OpenJDK (`javac`, `java`, `javap`)
  - Python: `python3`

### Development & Testing

```bash
# Install dependencies
npm ci

# Compile TypeScript
npm run compile

# Run full test suite
npm test

# Run tests with code coverage
npm run test:coverage

# Lint source files
npm run lint

# Package extension bundle (.vsix)
npm run package
```

### Containerized Testing

```bash
# Build verification Docker container
docker build -t bodha:smoke .

# Run containerized smoke test
docker run --rm bodha:smoke
```

---

## Security

- All toolchain execution is **local** — no source code or compiler output leaves your machine.
- Process sandboxing: argument array execution without shell interpolation where possible.
- Webview isolation: strict Content Security Policy (CSP) on all visualization panels.
- For vulnerability reports, see [SECURITY.md](SECURITY.md).

---

## Privacy

- **Zero telemetry** by default
- No source code uploaded
- No compiler output uploaded
- Fully offline capable

---

## License

MIT — See [LICENSE.txt](LICENSE.txt) for details.

---

**Made with 🧠 for compiler learners everywhere.**
