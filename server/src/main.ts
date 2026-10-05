/**
 * Entry point of the `wingfoil-ui` process, loaded by the package `bin` after its Node.js check.
 *
 * @packageDocumentation
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { message } from './i18n/messages.js';
import { EXIT, runLauncher } from './launcher/start.js';
import { resolveStateDir } from './state/location.js';

/** Run the console with the command-line arguments `argv`. */
export async function main(argv: readonly string[]): Promise<void> {
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  try {
    const code = await runLauncher(argv, {
      stdout: (line) => process.stdout.write(`${line}\n`),
      stderr: (line) => process.stderr.write(`${line}\n`),
      version,
      staticDir: fileURLToPath(new URL('../../web/dist/', import.meta.url)),
      stateDir: resolveStateDir({ env: process.env, platform: process.platform, homedir: homedir() }),
      platform: process.platform,
      onSignal: (handler) => {
        process.on('SIGINT', handler);
        process.on('SIGTERM', handler);
      },
      exit: (code) => process.exit(code),
    });
    if (code !== undefined) process.exitCode = code;
  } catch (error) {
    process.stderr.write(`${message('launcher.unexpected', { message: (error as Error).message })}\n`);
    process.exitCode = EXIT.unexpected;
  }
}
