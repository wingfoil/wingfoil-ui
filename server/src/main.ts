/**
 * Entry point of the `wingfoil-ui` process, loaded by the package `bin` after its Node.js check.
 *
 * @packageDocumentation
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { message } from './i18n/messages.js';
import { EXIT, runLauncher } from './launcher/start.js';
import { LocalProcessRunner } from './process/runner.js';

/** Options of {@link main} (tests). */
export interface MainOptions {
  /** Runner of the `wingfoil` and git processes of a start (default: a new one). */
  processes?: LocalProcessRunner;
}

/**
 * Signals that stop the console (spec-007 §6, amended 2026-10-05): Ctrl-C, `kill`, terminal closed.
 * Node.js emits `SIGHUP` on Windows too, when the console window is closed.
 */
const STOP_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/** Run the console with the command-line arguments `argv`. */
export async function main(argv: readonly string[], options: MainOptions = {}): Promise<void> {
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  try {
    const code = await runLauncher(argv, {
      stdout: (line) => process.stdout.write(`${line}\n`),
      stderr: (line) => process.stderr.write(`${line}\n`),
      version,
      staticDir: fileURLToPath(new URL('../../web/dist/', import.meta.url)),
      platform: process.platform,
      onSignal: (handler) => {
        for (const signal of STOP_SIGNALS) process.on(signal, handler);
      },
      onExit: (handler) => {
        process.on('exit', handler);
      },
      exit: (code) => process.exit(code),
      ...(options.processes ? { processes: options.processes } : {}),
    });
    if (code !== undefined) process.exitCode = code;
  } catch (error) {
    process.stderr.write(`${message('launcher.unexpected', { message: (error as Error).message })}\n`);
    process.exitCode = EXIT.unexpected;
  }
}
