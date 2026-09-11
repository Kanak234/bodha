# Security Policy

## Supported Versions

Only the latest release of BODHA receives active security maintenance and updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| < 0.4.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability within BODHA, please disclose it responsibly. Do not open public issues for security vulnerabilities.

### Reporting Process
1. Email security reports to **kanakprabhakar2@gmail.com** or open a private security advisory on GitHub: `https://github.com/Kanak234/bodha/security/advisories/new`.
2. Include detailed steps to reproduce, affected versions, and a proof of concept where applicable.
3. Acknowledgement is typically provided within 48 hours, followed by a remediation timeline.

---

## Threat Model & Security Architecture

BODHA operates inside the VS Code Extension Host and interacts with host compiler toolchains to visualize compiler internals.

### 1. Local Toolchain Execution Sandboxing
- BODHA executes user-configured compiler binaries (`gcc`, `g++`, `javac`, `python3`) on the local developer machine.
- Process invocations use parameterized argument arrays (`child_process.spawn`) without shell interpolation (`shell: false`) wherever possible, mitigating arbitrary shell command injection.
- Compiler path lookup strictly validates existence before execution; missing or unauthorized binaries are reported as `TOOLCHAIN NOT FOUND`.

### 2. Webview Content Security Policy (CSP)
- BODHA's visualization panels are rendered in isolated VS Code Webviews.
- Strict Content Security Policies (`Content-Security-Policy`) prevent loading untrusted remote scripts or styles.
- State communication between the extension host and webviews occurs exclusively through structured `postMessage` exchanges with schema validation.

### 3. Container Security
- Container images run under an unprivileged user (`node`, UID 1000).
- Root filesystem execution is prevented in containerized test environments.
- Build stages separate compilation dependencies from runtime verification layers.
