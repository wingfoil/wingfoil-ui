/** Command-line options of `wingfoil-ui` (spec-007 §1). */

/** What the command line asks for. */
export type LauncherCommand =
  { kind: 'start'; port: number | undefined; open: boolean } | { kind: 'version' } | { kind: 'help' };

/** A malformed command line (exit 2): the catalogue key and arguments of the reason. */
export class UsageError extends Error {
  constructor(
    readonly key: string,
    readonly args: Record<string, string>,
  ) {
    super(`${key} ${JSON.stringify(args)}`);
    this.name = 'UsageError';
  }
}

const MIN_PORT = 1024;
const MAX_PORT = 65535;

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) throw new UsageError('launcher.usage.invalidPort', { value });
  const port = Number(value);
  if (port < MIN_PORT || port > MAX_PORT) throw new UsageError('launcher.usage.invalidPort', { value });
  return port;
}

/** Parse `argv` (without the node and script paths). `--help` and `--version` win over the rest. */
export function parseOptions(argv: readonly string[]): LauncherCommand {
  let port: number | undefined;
  let open = true;
  let help = false;
  let version = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const eq = arg.indexOf('=');
    const name = arg.startsWith('--') && eq > 0 ? arg.slice(0, eq) : arg;
    const inline = arg.startsWith('--') && eq > 0 ? arg.slice(eq + 1) : undefined;
    switch (name) {
      case '--port': {
        const value = inline ?? argv[++i];
        if (value === undefined || value === '')
          throw new UsageError('launcher.usage.missingValue', { option: '--port' });
        port = parsePort(value);
        break;
      }
      case '--no-open':
      case '--help':
      case '--version':
        if (inline !== undefined) throw new UsageError('launcher.usage.unexpectedValue', { option: name });
        if (name === '--no-open') open = false;
        else if (name === '--help') help = true;
        else version = true;
        break;
      default:
        throw new UsageError('launcher.usage.unknownOption', { option: arg });
    }
  }
  if (help) return { kind: 'help' };
  if (version) return { kind: 'version' };
  return { kind: 'start', port, open };
}
