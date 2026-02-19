import * as vscode from 'vscode';
import type { LogLevel } from '../types';

let outputChannel: vscode.OutputChannel | null = null;
const logQueue: Array<() => void> = [];
let processing = false;

function getLevelOrder(): Record<LogLevel, number> {
  return { debug: 0, info: 1, warn: 2, error: 3 };
}

function getCurrentLevel(): LogLevel {
  try {
    const cfg = vscode.workspace.getConfiguration('autoCommit');
    return (cfg.get<string>('logLevel', 'info') || 'info') as LogLevel;
  } catch {
    return 'info';
  }
}

function getChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('AutoCommit');
  }
  return outputChannel;
}

function processQueue(): void {
  if (processing || logQueue.length === 0) {return;}
  processing = true;
  const next = logQueue.shift();
  if (next) {
    next();
  }
  processing = false;
  if (logQueue.length > 0) {
    setImmediate(processQueue);
  }
}

function enqueueLog(fn: () => void): void {
  logQueue.push(fn);
  setImmediate(processQueue);
}

export const logger = {
  shouldLog(level: LogLevel): boolean {
    const order = getLevelOrder();
    const current = getCurrentLevel();
    return order[level] >= order[current];
  },

  debug(msg: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) {return;}
    enqueueLog(() => {
      const text = `[DEBUG ${new Date().toLocaleTimeString()}] ${msg}`;
      getChannel().appendLine(text);
      console.debug(text, ...args);
    });
  },

  info(msg: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) {return;}
    enqueueLog(() => {
      const text = `[INFO  ${new Date().toLocaleTimeString()}] ${msg}`;
      getChannel().appendLine(text);
      console.log(text, ...args);
    });
  },

  warn(msg: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) {return;}
    enqueueLog(() => {
      const text = `[WARN  ${new Date().toLocaleTimeString()}] ${msg}`;
      getChannel().appendLine(text);
      console.warn(text, ...args);
    });
  },

  error(msg: string | Error, ...args: unknown[]): void {
    enqueueLog(() => {
      const message = typeof msg === 'string' ? msg : (msg as Error).message || String(msg);
      const text = `[ERROR ${new Date().toLocaleTimeString()}] ${message}`;
      getChannel().appendLine(text);
      console.error(text, ...args);
    });
  },

  show(): void {
    getChannel().show(true);
  },
};

export default logger;
