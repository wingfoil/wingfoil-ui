// The spec list of the `own-specs` job of `.github/workflows/gates.yml` (task-071 AC-2; D71-6, D71-7):
// the e2e spec files a task runs on Firefox and WebKit.
//
//   SPECS='<space-separated spec files>' node scripts/e2e-own-specs.mjs --base <ref>
//
// - `SPECS` (the `specs` input of a dispatch, read from the environment, never from the command line)
//   wins when it holds anything but whitespace; otherwise the spec files the checked-out HEAD changes
//   against its merge-base with `<ref>` (added, modified, renamed — the new path; not deleted).
// - Every token and every path git prints must be a plain spec path under `test/e2e/` (letters,
//   digits, `_`, `-`, `.`; no `.` or `..` segment) naming an existing regular file, else one
//   `refused:` line with the token JSON-escaped and exit 1 — never a silent skip. A path that passes
//   holds no shell metacharacter, no whitespace and no option, so the job can read the list with
//   `mapfile` and hand it to Playwright as an array.
// - stdout: the accepted list, sorted, one per line (empty when there is none). stderr: one line on
//   the source of the list, "no own e2e spec: …" when it is empty, and a `notice:` line naming the
//   changed e2e support files and Playwright config, which select no spec (the wave scope covers them).
//   No line starts with `::`, so none can be read as a workflow command.
// - exit 2 on a usage error.
import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';

const USAGE = 'usage: SPECS=<files> node scripts/e2e-own-specs.mjs --base <ref>';
const SPEC = /^test\/e2e\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.spec\.ts$/;
const REF = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;
const SUPPORT = (p) => p.startsWith('test/e2e/support/') || p === 'playwright.config.ts';

class Refused extends Error {}

/** A token as one printable line: JSON escapes control characters and quotes; bounded. */
const shown = (token) => JSON.stringify(token.length > 200 ? `${token.slice(0, 200)}…` : token).slice(1, -1);

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--base') {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  return argv[1];
}

function accept(token) {
  if (!SPEC.test(token) || token.split('/').some((seg) => seg === '.' || seg === '..'))
    throw new Refused(`not a spec file under test/e2e/: "${shown(token)}"`);
  let stat;
  try {
    stat = lstatSync(token);
  } catch {
    throw new Refused(`no such spec file: "${shown(token)}"`);
  }
  if (!stat.isFile()) throw new Refused(`not a regular file: "${shown(token)}"`);
  return token;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function changed(base) {
  if (!REF.test(base) || base.includes('..')) throw new Refused(`not a branch name: "${shown(base)}"`);
  let mergeBase;
  try {
    mergeBase = git(['merge-base', base, 'HEAD']).trim();
  } catch {
    throw new Refused(`no merge-base with "${shown(base)}" (is the branch fetched?)`);
  }
  const paths = git(['diff', '-z', '--name-only', '--diff-filter=d', mergeBase, 'HEAD', '--'])
    .split('\0')
    .filter(Boolean);
  const support = paths.filter(SUPPORT);
  if (support.length > 0)
    process.stderr.write(
      `notice: changed e2e support, no spec selected for it (the wave scope covers it): ${support.map((p) => `"${shown(p)}"`).join(' ')}\n`,
    );
  return paths.filter((p) => p.startsWith('test/e2e/') && p.endsWith('.spec.ts'));
}

const base = parseArgs(process.argv.slice(2));
try {
  const input = (process.env.SPECS ?? '').trim();
  const fromInput = input !== '';
  const tokens = fromInput ? input.split(/\s+/) : changed(base);
  const specs = [...new Set(tokens.map(accept))].sort();
  const source = fromInput ? 'from the specs input' : `changed against the merge-base with ${base}`;
  process.stderr.write(
    specs.length === 0
      ? `no own e2e spec (${source}): nothing to run\n`
      : `own e2e specs (${source}): ${specs.length}\n`,
  );
  process.stdout.write(specs.map((s) => `${s}\n`).join(''));
} catch (error) {
  if (!(error instanceof Refused)) throw error;
  process.stderr.write(`refused: ${error.message}\n`);
  process.exit(1);
}
