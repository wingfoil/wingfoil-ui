// spec-007 §1 — options of the wingfoil-ui command line.
import { describe, expect, it } from 'vitest';
import { parseOptions, UsageError } from '../../../server/src/launcher/options.js';

describe('parseOptions', () => {
  it.each([
    [[], { kind: 'start', port: undefined, open: true }],
    [['--no-open'], { kind: 'start', port: undefined, open: false }],
    [['--port', '8080'], { kind: 'start', port: 8080, open: true }],
    [['--port=1024'], { kind: 'start', port: 1024, open: true }],
    [['--port', '65535', '--no-open'], { kind: 'start', port: 65535, open: false }],
    [['--version'], { kind: 'version' }],
    [['--help'], { kind: 'help' }],
    [['--no-open', '--help'], { kind: 'help' }],
  ])('%j → %j', (argv, expected) => {
    expect(parseOptions(argv)).toEqual(expected);
  });

  it.each([
    [['--verbose']],
    [['serve']],
    [['--port']],
    [['--port', 'abc']],
    [['--port', '1023']],
    [['--port', '65536']],
    [['--port', '80.5']],
    [['--port=']],
    [['--no-open=yes']],
    [['-p', '8080']],
  ])('%j is a usage error', (argv) => {
    expect(() => parseOptions(argv)).toThrow(UsageError);
  });
});
