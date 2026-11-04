// The `test-results.md` asset of the GitHub Release (`.github/workflows/publish.yml`, job `gate`;
// task-052 D52-7): a summary of the gate's suite run built from Vitest's JSON results with fixed
// fields only. Vitest names every file by its absolute path and records test titles and failure
// messages; none of them is written (dl-005). What is written: fixed text, numbers, the package
// version, the commit, the run URL — each checked against a pattern — and suite names: the first
// folder under `test/` of a file's path relative to the working directory, kept only when it
// matches SUITE; any other file counts under `other`.
//
//   node scripts/test-results.mjs <vitest-results.json> --commit <40-hex sha> --run-url <url>
//
// Run in the repository's top folder (the version is the root `package.json`'s). Prints the Markdown
// on stdout; a malformed input is one `refused:` line on stderr and exit 1; exit 2 on a usage error.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const USAGE = 'usage: node scripts/test-results.mjs <vitest-results.json> --commit <sha> --run-url <url>';
const SUITE = /^[a-z][a-z0-9-]{0,39}$/;
const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/(\d+)$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const NAME = /^[a-z][a-z0-9-]*$/;
/** Vitest's test statuses (and Jest's `disabled`), by column. */
const COLUMN = {
  passed: 'passed',
  failed: 'failed',
  skipped: 'skipped',
  pending: 'skipped',
  todo: 'skipped',
  disabled: 'skipped',
};
/** Vitest's file statuses: whether the file failed. */
const FILE_FAILED = { passed: false, failed: true, skipped: false, pending: false, todo: false };

class Refused extends Error {}

function parseArgs(argv) {
  if (argv.length !== 5 || argv[1] !== '--commit' || argv[3] !== '--run-url') {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  return { file: argv[0], commit: argv[2], runUrl: argv[4] };
}

/** The suite of a test file: its first folder under `test/`, or `other`. */
function suiteOf(name) {
  const relative = path.relative(process.cwd(), path.resolve(name));
  const parts = relative.split(path.sep);
  if (path.isAbsolute(relative) || parts[0] !== 'test' || parts.length < 3) return 'other';
  return SUITE.test(parts[1]) ? parts[1] : 'other';
}

function manifest() {
  try {
    const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
    if (typeof name === 'string' && NAME.test(name) && typeof version === 'string' && VERSION.test(version)) {
      return { name, version };
    }
  } catch {
    // reported below
  }
  throw new Refused('package.json has no plain name and X.Y.Z version');
}

function summarise(results, commit, runUrl) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Refused('the commit is not 40 hexadecimal digits');
  const run = RUN_URL.exec(runUrl);
  if (!run) throw new Refused('the run URL is not a run of a GitHub repository');
  const { name, version } = manifest();
  if (typeof results !== 'object' || results === null || !Array.isArray(results.testResults)) {
    throw new Refused('the results have no testResults list');
  }
  const suites = new Map();
  for (const [i, file] of results.testResults.entries()) {
    if (typeof file?.name !== 'string') throw new Refused(`testResults[${i}] has no file name`);
    if (!Object.hasOwn(FILE_FAILED, file.status)) throw new Refused(`testResults[${i}] has an unknown status`);
    if (!Array.isArray(file.assertionResults)) throw new Refused(`testResults[${i}] has no assertionResults list`);
    const suite = suiteOf(file.name);
    const row = suites.get(suite) ?? { files: 0, filesFailed: 0, passed: 0, failed: 0, skipped: 0 };
    row.files += 1;
    if (FILE_FAILED[file.status]) row.filesFailed += 1;
    for (const [j, test] of file.assertionResults.entries()) {
      const column = Object.hasOwn(COLUMN, test?.status) ? COLUMN[test.status] : undefined;
      if (!column) throw new Refused(`testResults[${i}].assertionResults[${j}] has an unknown status`);
      row[column] += 1;
    }
    suites.set(suite, row);
  }
  const total = { files: 0, filesFailed: 0, passed: 0, failed: 0, skipped: 0 };
  const lines = [
    `# Test results of ${name} ${version}`,
    '',
    `The gate job's suite run (\`npm run test:coverage\`, Vitest), [run ${run[1]}](${runUrl}).`,
    `Commit \`${commit}\`.`,
    '',
    'Counts per suite, the first folder under `test` of each file; `other` is every other file.',
    '',
    '| Suite | Files | Files failed | Tests passed | Tests failed | Tests skipped |',
    '|-------|------:|-------------:|-------------:|-------------:|--------------:|',
  ];
  for (const suite of [...suites.keys()].sort()) {
    const r = suites.get(suite);
    for (const key of Object.keys(total)) total[key] += r[key];
    lines.push(`| ${suite} | ${r.files} | ${r.filesFailed} | ${r.passed} | ${r.failed} | ${r.skipped} |`);
  }
  const t = total;
  lines.push(
    `| **total** | **${t.files}** | **${t.filesFailed}** | **${t.passed}** | **${t.failed}** | **${t.skipped}** |`,
    '',
    `Result: **${t.failed + t.filesFailed === 0 ? 'passed' : 'failed'}**`,
    '',
  );
  return lines.join('\n');
}

const { file, commit, runUrl } = parseArgs(process.argv.slice(2));
try {
  let results;
  try {
    results = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Refused('the results cannot be read as JSON');
  }
  process.stdout.write(summarise(results, commit, runUrl));
} catch (error) {
  if (!(error instanceof Refused)) throw error;
  process.stderr.write(`refused: ${error.message}\n`);
  process.exit(1);
}
