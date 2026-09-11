# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-12

### Added
- **Production Hardening (C1–C9):** Complete production readiness suite meeting criteria C1 through C9.
- **Automated CI Matrix:** Multi-version Node.js matrix (`[18, 20, 22]`) testing, compilation, linting, packaging, and Docker verification.
- **CodeQL Workflow:** Advanced static analysis and security scanning workflow for JavaScript and TypeScript (`.github/workflows/codeql.yml`).
- **Automated Release Workflow:** GitHub Actions release pipeline packaging `.vsix` bundles and generating SHA256 checksums (`.github/workflows/release.yml`).
- **Repository Guard:** File integrity and hygiene verification workflow (`.github/workflows/repository-guard.yml`).
- **Dependabot Integration:** Dependency monitoring configuration for npm, GitHub Actions, and Docker (`.github/dependabot.yml`).
- **Multi-Stage Dockerfile:** Reproducible unprivileged container build running as non-root user `node` (UID 1000) with native compiler toolchains (`gcc`, `g++`, `python3`, `javac`).
- **Extended Test Suite:** 78 comprehensive automated tests achieving 87.56% line coverage and 90.09% function coverage across all core modules with zero synthetic mocks.
- **Security Policy:** Threat modeling, process execution sandboxing, and vulnerability disclosure policy (`SECURITY.md`).

### Fixed
- Modern TypeScript compiler compatibility: removed deprecated `"moduleResolution": "node"` option from `tsconfig.json`.
- `.vscodeignore` exclusions: excluded development configuration, test harnesses, and internal files from production `.vsix` distribution.
- Git tracking hygiene: updated `.gitignore` to ignore test coverage artifacts, caches, and packaged vsix bundles.
