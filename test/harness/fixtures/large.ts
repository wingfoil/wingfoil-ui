/**
 * The large fixture of the SARD reference environment (`00_sard.md`): the custom fixture plus 500
 * generated Memory elements (tasks, bugs, decision-logs in every state of their type) and 2 000
 * commits (task-021, W5-7, decided by the user 2026-10-10). Used by the performance run only
 * (TT-PERF-04); it is not a {@link FixtureKind}, so the suites that iterate the kinds do not build it.
 *
 * The elements are written as files, each a copy of an element the CLI created in the custom fixture
 * with its `id`, `title` and `status` changed (no CLI call per element); the history is written by
 * `git fast-import` — one commit adding the 500 files, then commits revising them in turn, so that
 * every element has a history of a few commits.
 */
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { git } from '../run.js';
import { buildFixture, type BuildOptions, type Fixture } from './builder.js';

/** Generated elements and total commits of the large fixture (SARD reference environment). */
export const LARGE_ELEMENTS = 500;
export const LARGE_COMMITS = 2_000;

/** A generated type: where the custom fixture keeps one, its id prefix, its states, its share. */
interface GeneratedType {
  type: string;
  dir: string;
  prefix: string;
  states: string[];
  count: number;
}

/** The states of the custom fixture's `memory.yaml` (this repository's governance). */
const TYPES: GeneratedType[] = [
  {
    type: 'task',
    dir: 'docs/04_memory/v0.1',
    prefix: 'task',
    states: ['draft', 'pending', 'backlog', 'in-progress', 'in-review', 'approved', 'done'],
    count: 300,
  },
  {
    type: 'bug',
    dir: 'docs/04_memory/bugs',
    prefix: 'bug',
    states: ['draft', 'open', 'triaged', 'planned', 'in-progress', 'in-review', 'resolved', 'closed'],
    count: 120,
  },
  {
    type: 'decision-log',
    dir: 'docs/04_memory/design/dls',
    prefix: 'dl',
    states: ['draft', 'in-discussion', 'ready'],
    count: 80,
  },
];

/** A generated element. */
export interface LargeElement {
  id: string;
  type: string;
  title: string;
  status: string;
  /** Repository-relative path. */
  path: string;
}

/** The custom fixture plus its generated elements. */
export interface LargeFixture extends Fixture {
  elements: LargeElement[];
}

/** `content` (an element file) with `id`, `title` and `status` replaced in its frontmatter. */
function retitled(content: string, id: string, title: string, status: string): string {
  return content
    .replace(/^id: .*$/m, `id: ${id}`)
    .replace(/^title: .*$/m, `title: "${title}"`)
    .replace(/^status: .*$/m, `status: ${status}`);
}

/** Run `git fast-import` in `dir` on `stream`. */
function fastImport(dir: string, env: NodeJS.ProcessEnv, stream: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['fast-import', '--quiet'], { cwd: dir, env, stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`git fast-import: ${code} ${stderr}`))));
    child.stdin.end(stream);
  });
}

/** One fast-import `data` block. */
const data = (text: string) => `data ${Buffer.byteLength(text)}\n${text}\n`;

/** Build the large fixture under `options.root` (the custom fixture, then the generated part). */
export async function buildLargeFixture(options: BuildOptions): Promise<LargeFixture> {
  const fx = await buildFixture('custom', options);
  const elements: LargeElement[] = [];
  const files = new Map<string, string>();
  for (const t of TYPES) {
    const dir = path.join(fx.dir, t.dir);
    const model = (await readdir(dir)).find((f) => f.startsWith(`${t.prefix}-`) && f.endsWith('.md'));
    if (!model) throw new Error(`the custom fixture has no ${t.type} in ${t.dir}`);
    const content = await readFile(path.join(dir, model), 'utf8');
    for (let i = 0; i < t.count; i++) {
      const n = String(100 + i).padStart(3, '0');
      const id = `${t.prefix}-${n}-generated-${t.type}-${i + 1}`;
      const title = `Generated ${t.type} ${i + 1}`;
      const status = t.states[i % t.states.length]!;
      const rel = `${t.dir}/${id}.md`;
      elements.push({ id, type: t.type, title, status, path: rel });
      files.set(rel, retitled(content, id, title, status));
    }
  }
  // One commit adding every element, then revisions in turn up to LARGE_COMMITS in all.
  const head = (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
  const existing = Number((await git(fx.dir, ['rev-list', '--count', 'HEAD'], fx.env)).stdout.trim());
  const start = Math.floor(fx.now.getTime() / 1000) - 2 * 86_400 - LARGE_COMMITS;
  const who = 'Jordan <jordan@example.test>';
  let stream = `commit refs/heads/main\nmark :1\ncommitter ${who} ${start} +0000\n`;
  stream += data('chore(fixture): add the generated Memory elements of the large fixture');
  stream += `from ${head}\n`;
  for (const [rel, content] of files) stream += `M 100644 inline ${rel}\n${data(content)}`;
  stream += '\n';
  const revisions = LARGE_COMMITS - existing - 1;
  for (let k = 0; k < revisions; k++) {
    const el = elements[k % elements.length]!;
    const revised = `${files.get(el.path)!}\n<!-- revision ${k + 1} -->\n`;
    files.set(el.path, revised);
    stream += `commit refs/heads/main\ncommitter ${who} ${start + k + 1} +0000\n`;
    stream += data(`docs(${el.type}): revise ${el.id} (generated revision ${k + 1})`);
    stream += `M 100644 inline ${el.path}\n${data(revised)}\n`;
  }
  await fastImport(fx.dir, fx.env, stream);
  await git(fx.dir, ['reset', '--hard', '-q', 'main'], fx.env);
  await git(fx.dir, ['push', '-q', 'origin', 'main'], fx.env);
  return { ...fx, elements };
}
