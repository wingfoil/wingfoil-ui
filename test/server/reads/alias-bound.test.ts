// bug-042, task-075 AC-5 — a YAML file with many aliases no longer blocks the server: the `yaml`
// library's `toJS` resolves each alias by scanning the anchors and aliases before it (its
// `Alias.resolve`), a cost that grows with the square of their number; the parse of every
// frontmatter and of `memory.yaml` (`parseYaml`, for the element read, the index and the types)
// counts that scan in the key check's one pass and refuses the file above a bound, before `toJS`.
// The worst case of a direct read (5 MiB, `MAX_DIRECT_READ_BYTES`) runs in a child process on the
// built `server/dist` (Vitest's global setup), so a regression ends at the time bound instead of
// blocking the suite.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_DIRECT_READ_BYTES } from '../../../server/src/reads/confine.js';
import { parseYaml } from '../../../server/src/reads/frontmatter.js';
import { REPO_ROOT } from '../../harness/cli.js';

/** `n` anchors, then `n` distinct alias keys, one per anchor: one alias per anchor stays under `yaml`'s own limit. */
function distinct(n: number): string {
  let text = '';
  for (let i = 0; i < n; i += 1) text += `a${i}: &a${i} v${i}\n`;
  for (let i = 0; i < n; i += 1) text += `*a${i} : ${i}\n`;
  return text;
}

/** The fastest of `runs` timings of `fn`, in ms (the least disturbed by suites running in parallel). */
function fastest(fn: () => void, runs = 3): number {
  let best = Number.POSITIVE_INFINITY;
  for (let r = 0; r < runs; r += 1) {
    const started = performance.now();
    fn();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

const parse = (text: string) => () => {
  try {
    parseYaml(text, 'f.md');
  } catch {
    // refused or read: only the time counts here
  }
};

describe('AC-5 bug-042 many aliases', () => {
  it('a few aliases are read; a file whose alias resolution would scan beyond the bound is refused', () => {
    expect(Object.keys(parseYaml(distinct(100), 'f.md') as object)).toHaveLength(200);
    expect(() => parseYaml(distinct(4_000), 'f.md')).toThrow(
      /^f\.md: invalid YAML \(too many aliases to resolve \(over \d+ steps\)\)$/,
    );
  });

  it('the parse of 4N alias keys costs about four times that of N, not sixteen', () => {
    parse(distinct(2_000))(); // warm-up
    const ratio = fastest(parse(distinct(80_000))) / fastest(parse(distinct(20_000)));
    expect(ratio).toBeLessThan(8);
  }, 300_000);

  it(`a ${MAX_DIRECT_READ_BYTES / 1024 / 1024} MiB file of alias keys is answered within 20 s, in a child process`, () => {
    const script = `
      const { parseYaml } = require(${JSON.stringify(path.join(REPO_ROOT, 'server', 'dist', 'reads', 'frontmatter.js'))});
      let anchors = '', aliases = '', i = 0;
      while (anchors.length + aliases.length < ${MAX_DIRECT_READ_BYTES} - 64) {
        anchors += 'a' + i + ': &a' + i + ' v' + i + '\\n';
        aliases += '*a' + i + ' : ' + i + '\\n';
        i += 1;
      }
      const started = performance.now();
      let outcome = 'read';
      try { parseYaml(anchors + aliases, 'f.md'); } catch (e) { outcome = e.message.slice(0, 120); }
      process.stdout.write(JSON.stringify({ keys: i, ms: performance.now() - started, outcome }));
    `;
    const run = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 20_000 });
    expect(run.signal, 'killed at the 20 s bound').toBeNull();
    const result = JSON.parse(run.stdout) as { keys: number; ms: number; outcome: string };
    expect(result.keys).toBeGreaterThan(100_000);
    expect(result.outcome).toMatch(/too many aliases/);
    expect(result.ms).toBeLessThan(20_000);
  }, 60_000);
});
