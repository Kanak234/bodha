/**
 * Toolchain Detector
 * Discovers local compilers, interpreters, and debuggers.
 * Strictly enforces configured toolchain validation and reports "TOOLCHAIN NOT FOUND" if unavailable.
 */

import * as vscode from 'vscode';
import { ToolchainInfo } from '../types';

function splitCommand(cmd: string): { exe: string; prefix: string[] } {
  const parts = cmd.trim().split(/\s+/);
  return { exe: parts[0], prefix: parts.slice(1) };
}

async function runCommand(exe: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const { exe: bin, prefix } = splitCommand(exe);
    const child = require('child_process').spawn(bin, prefix.concat(args), { shell: false });
    let out = '', err = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('close', (code: number) => resolve({ code, out, err }));
    child.on('error', (e: Error) => resolve({ code: -1, out: '', err: e.message }));
  });
}

function resolveWithPath(cmd: string, configuredPath: string): string {
  if (!configuredPath) return cmd;
  const fs = require('fs');
  const path = require('path');
  let stat: any = null;
  try { stat = fs.statSync(configuredPath); } catch { stat = null; }
  if (stat && stat.isFile()) return configuredPath;
  const { exe } = splitCommand(cmd);
  const candidate = path.join(configuredPath, exe);
  if (fs.existsSync(candidate)) return candidate;
  return cmd;
}

export class ToolchainDetector {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async detectAndShow(): Promise<ToolchainInfo> {
    const info = await this.detect();
    await this.showResults(info);
    return info;
  }

  async detect(): Promise<ToolchainInfo> {
    const config = vscode.workspace.getConfiguration('bodha.toolchains');
    const compilerPath = config.get<string>('compilerPath', '');

    const c = await this.findExactCompiler(config.get<string>('c', 'gcc'), compilerPath);
    const cpp = await this.findExactCompiler(config.get<string>('cpp', 'g++'), compilerPath);
    const java = await this.findExactCompiler(config.get<string>('java', 'javac'), compilerPath);
    const javaRuntime = await this.findExactCompiler(config.get<string>('javaRuntime', 'java'), compilerPath);
    const javap = await this.findExactCompiler(config.get<string>('javap', 'javap'), compilerPath);
    const python = await this.findExactCompiler(config.get<string>('python', 'python3'), compilerPath);

    return { c, cpp, java, python, javaRuntime, javap };
  }

  /**
   * Strictly check configured compiler binary. Returns undefined (TOOLCHAIN NOT FOUND) if binary is unavailable.
   */
  private async findExactCompiler(
    configured: string,
    compilerPath: string
  ): Promise<{ command: string; version: string; path: string } | undefined> {
    const resolved = resolveWithPath(configured, compilerPath);
    const r = await runCommand(resolved, ['--version']);
    if (r.code === 0) {
      const version = (r.out || r.err).split('\n')[0].trim();
      const { exe } = splitCommand(resolved);
      return { command: resolved, version, path: exe };
    }
    return undefined;
  }

  private async showResults(info: ToolchainInfo): Promise<void> {
    const lines = ['BODHA Toolchain Detection', '========================='];
    for (const [key, value] of Object.entries(info)) {
      if (value) {
        lines.push(`✓ ${key.toUpperCase()}: ${value.command} (${value.version})`);
      } else {
        lines.push(`✗ ${key.toUpperCase()}: TOOLCHAIN NOT FOUND`);
      }
    }
    const output = vscode.window.createOutputChannel('BODHA Toolchains');
    output.show(true);
    output.appendLine(lines.join('\n'));
  }
}