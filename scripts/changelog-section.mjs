// The notes of the GitHub Release (`.github/workflows/publish.yml`, job `gate` on a tag; task-052
// D52-2): a short preface, then the `CHANGELOG.md` section of the tag's version — from its
// `## [X.Y.Z]` heading (dropped) to the next `## ` heading or the version link definitions — with
// every relative link made absolute to the tag, as in the hand-made `v0.2.0` Release
// (`[README](README.md#x)` → `[README](https://github.com/<owner>/<repo>/blob/vX.Y.Z/README.md#x)`).
// URLs with a scheme, `#anchors` and root-relative targets are left as they are.
//
//   node scripts/changelog-section.mjs <vX.Y.Z> --run-url <url>
//
// Run in the repository's top folder (it reads `CHANGELOG.md` and the root `package.json`, whose
// `repository.url` gives the GitHub base). A missing or empty section, a tag that is not `vX.Y.Z`,
// or a run URL that is not a GitHub Actions run is one `refused:` line on stderr and exit 1; exit 2
// on a usage error. Run in the gate, so a tag with no section fails before anything is staged.
import { readFileSync } from 'node:fs';

const USAGE = 'usage: node scripts/changelog-section.mjs <vX.Y.Z> --run-url <url>';
const TAG = /^v(\d+\.\d+\.\d+)$/;
const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/(\d+)$/;
const REPOSITORY = /^(?:git\+)?(https:\/\/github\.com\/[\w.-]+\/[\w.-]+?)(?:\.git)?$/;
/** A target with a scheme (`https:`, `mailto:`), an anchor or a root-relative path stays as it is. */
const KEEP = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;
/** The end of a version's section: the next heading of its level, or the version link definitions. */
const END = /^(?:## |\[(?:Unreleased|\d+\.\d+\.\d+)\]:)/;

class Refused extends Error {}

function parseArgs(argv) {
  if (argv.length !== 3 || argv[1] !== '--run-url') {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  return { tag: argv[0], runUrl: argv[2] };
}

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    throw new Refused(`${file} cannot be read`);
  }
}

function manifest() {
  let parsed;
  try {
    parsed = JSON.parse(read('package.json'));
  } catch (error) {
    throw error instanceof Refused ? error : new Refused('package.json is not JSON');
  }
  const url = typeof parsed.repository === 'string' ? parsed.repository : parsed.repository?.url;
  const base = REPOSITORY.exec(typeof url === 'string' ? url : '');
  if (!base) throw new Refused('package.json repository.url is not a GitHub repository URL');
  if (typeof parsed.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(parsed.name)) {
    throw new Refused('package.json has no plain name');
  }
  return { name: parsed.name, base: base[1] };
}

function section(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(`^## \\[${version.replaceAll('.', '\\.')}\\](?:\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) throw new Refused(`CHANGELOG.md has no section [${version}]`);
  let end = lines.findIndex((line, i) => i > start && END.test(line));
  if (end < 0) end = lines.length;
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
  if (body === '') throw new Refused(`the section [${version}] of CHANGELOG.md is empty`);
  return `${body}\n`;
}

function absolute(text, blob) {
  const fix = (target) => (KEEP.test(target) ? target : `${blob}/${target.replace(/^\.\//, '')}`);
  return text
    .replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, target, title) => `](${fix(target)}${title})`)
    .replace(/^(\s*\[[^\]]+\]:\s*)(\S+)/gm, (_, label, target) => `${label}${fix(target)}`);
}

const { tag, runUrl } = parseArgs(process.argv.slice(2));
try {
  const version = TAG.exec(tag)?.[1];
  if (!version) throw new Refused('the tag is not v<major>.<minor>.<patch>');
  const run = RUN_URL.exec(runUrl);
  if (!run) throw new Refused('the run URL is not a run of a GitHub repository');
  const { name, base } = manifest();
  const notes = absolute(section(read('CHANGELOG.md'), version), `${base}/blob/${tag}`);
  const preface =
    `WingFoil UI ${tag}. Install: \`npx ${name}@${version}\` ([npm](https://www.npmjs.com/package/${name}/v/${version})). ` +
    `Built, tested, smoked and staged by [run ${run[1]}](${runUrl}); attached: the tarball staged on npm, ` +
    '`coverage-totals.json` and `test-results.md` from that run.';
  process.stdout.write(`${preface}\n\n---\n\n${notes}`);
} catch (error) {
  if (!(error instanceof Refused)) throw error;
  process.stderr.write(`refused: ${error.message}\n`);
  process.exit(1);
}
