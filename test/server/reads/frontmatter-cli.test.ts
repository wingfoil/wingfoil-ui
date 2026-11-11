// bug-037, task-075 AC-2 (D75-10) — the pinned CLI and the server agree on which files are elements,
// in both directions, on a copy of the kanban fixture (working-tree edits, no commit): an element with
// `1:` and `"1":` is left out by `memory search` (`W_MEMORY_UNREADABLE … duplicated mapping key`) and
// refused by the server's parse as a duplicate key; one with `2026-01-01:` and `"2026-01-01":` is
// listed by the CLI and read by the server.
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import { parseElement } from '../../../server/src/reads/element.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots } from '../snapshot/support.js';

let ws: TempWorkspace;
let template: Fixture;
const registries: Snapshots[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-075-keys-');
  template = await buildFixture('kanban', { root: path.join(await realpath(ws.dir), 'template') });
}, HEAVY_MS);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws?.dispose();
});

/** Add `lines` right after the opening `---` of the file at `file`. */
async function addKeys(file: string, lines: string): Promise<string> {
  const text = (await readFile(file, 'utf8')).replace(/^---\r?\n/, `---\n${lines}`);
  await writeFile(file, text);
  return text;
}

it(
  'AC-2 the pinned CLI leaves out the `1:`/`"1":` element and lists the date one; the server agrees',
  async () => {
    const fx = await copyFixture(template, path.join(await realpath(ws.dir), 'copy'));
    const audited = auditedSnapshots(fx.env);
    registries.push(audited.snapshots);
    const snapshot = await audited.snapshots.open('p1', fx.dir);
    const [numbers, dates] = (await (await snapshot.view()).elements()).matches.map((m) => m.match);
    expect(numbers && dates).toBeTruthy();

    const numbersText = await addKeys(path.join(fx.dir, numbers!.path), '1: one\n"1": two\n');
    await addKeys(path.join(fx.dir, dates!.path), '2026-01-01: day\n"2026-01-01": text\n');
    await snapshot.check();
    const view = await snapshot.view();
    const list = await view.elements();
    const ids = list.matches.map((m) => m.match.id);

    // The CLI: the first file left out with its warning, the second listed.
    expect(ids).not.toContain(numbers!.id);
    expect(list.warnings.join('\n')).toMatch(/duplicated mapping key/);
    expect(ids).toContain(dates!.id);

    // The server: the first refused as a duplicate key, the second read.
    expect(() => parseElement(numbersText, numbers!.path)).toThrow(DirectReadError);
    expect(() => parseElement(numbersText, numbers!.path)).toThrow(/duplicate key "1" \(line 2, column 1\)/);
    const read = await view.element(dates!.id);
    expect(read?.content.frontmatter.id).toBe(dates!.id);
  },
  HEAVY_MS,
);
