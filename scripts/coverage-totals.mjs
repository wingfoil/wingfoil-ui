// The coverage asset of the GitHub Release (`.github/workflows/publish.yml`, job `gate`; task-052
// D52-2): the `total` figures of a Vitest `json-summary` report, rebuilt from an allow-list of keys.
// The report itself also holds one entry per source file, keyed by its absolute path (the runner's,
// or a developer's machine's — dl-005): nothing is copied by iterating over the input, so no such
// entry and no string can reach the output.
//
//   node scripts/coverage-totals.mjs <coverage-summary.json> --commit <40-hex sha>
//
// Prints the JSON on stdout: `source` (a fixed text), `commit`, `total` with `lines`, `statements`,
// `functions`, `branches`, each `covered`, `total`, `skipped`, `pct` (finite numbers). Any missing
// or malformed value is one `refused:` line on stderr and exit 1; exit 2 on a usage error.
import { readFileSync } from 'node:fs';

const USAGE = 'usage: node scripts/coverage-totals.mjs <coverage-summary.json> --commit <sha>';
const METRICS = ['lines', 'statements', 'functions', 'branches'];
const FIELDS = ['covered', 'total', 'skipped', 'pct'];
const SOURCE = 'npm run test:coverage (Vitest, v8 provider) in the gate job of the publish workflow';

class Refused extends Error {}

function parseArgs(argv) {
  if (argv.length !== 3 || argv[1] !== '--commit') {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  return { file: argv[0], commit: argv[2] };
}

function totals(summary, commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Refused('the commit is not 40 hexadecimal digits');
  const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isMap(summary) || !isMap(summary.total)) throw new Refused('the summary has no total');
  const total = {};
  for (const metric of METRICS) {
    const source = summary.total[metric];
    if (!isMap(source)) throw new Refused(`the total has no ${metric}`);
    const figures = {};
    for (const field of FIELDS) {
      const value = source[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Refused(`total.${metric}.${field} is not a number`);
      }
      figures[field] = value;
    }
    total[metric] = figures;
  }
  return { source: SOURCE, commit, total };
}

const { file, commit } = parseArgs(process.argv.slice(2));
try {
  let summary;
  try {
    summary = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Refused('the summary cannot be read as JSON');
  }
  process.stdout.write(`${JSON.stringify(totals(summary, commit), null, 2)}\n`);
} catch (error) {
  if (!(error instanceof Refused)) throw error;
  process.stderr.write(`refused: ${error.message}\n`);
  process.exit(1);
}
