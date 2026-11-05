// GA3-11 R-4 (governance-alignment-rel-v0.3-plan step 3): `workflow list` of the pinned CLI on this
// repository's own `.wingfoil/` (as committed at HEAD) reports exactly the diagnostics of a committed
// baseline, counted per file and code. A new diagnostic — or one more of a code already there —
// fails, so that known warnings cannot hide a new one; a diagnostic that went away fails too, until
// the baseline says so in the same change. Since task-049 (the procedures folded into directives)
// the baseline is the two warnings of `service-ingest.yaml`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pinnedCli, REPO_ROOT } from '../harness/cli.js';
import { run } from '../harness/run.js';

const BASELINE = path.join(REPO_ROOT, 'test', 'governance', 'workflow-diagnostics.baseline.json');

/** One baseline row: how many diagnostics of `code` `workflow list` reports for `file`. */
export interface DiagnosticCount {
  file: string;
  code: string;
  severity: string;
  count: number;
}

interface Diagnostic {
  file?: string;
  code: string;
  severity: string;
}

/** The diagnostics counted per file, code and severity, in a stable order. */
export function countDiagnostics(diagnostics: readonly Diagnostic[]): DiagnosticCount[] {
  const counts = new Map<string, DiagnosticCount>();
  for (const d of diagnostics) {
    const file = d.file ?? '';
    const key = `${file}\u0000${d.code}\u0000${d.severity}`;
    const row = counts.get(key) ?? { file, code: d.code, severity: d.severity, count: 0 };
    row.count += 1;
    counts.set(key, row);
  }
  return [...counts.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.code.localeCompare(b.code) || a.severity.localeCompare(b.severity),
  );
}

/** What differs from the baseline: rows with more diagnostics than it (`added`), and with fewer (`gone`). */
export function compareWithBaseline(
  actual: readonly DiagnosticCount[],
  baseline: readonly DiagnosticCount[],
): { added: string[]; gone: string[] } {
  const key = (r: DiagnosticCount) => `${r.file} ${r.code} (${r.severity})`;
  const base = new Map(baseline.map((r) => [key(r), r.count]));
  const now = new Map(actual.map((r) => [key(r), r.count]));
  const added: string[] = [];
  const gone: string[] = [];
  for (const [k, n] of now) if (n > (base.get(k) ?? 0)) added.push(`${k}: ${base.get(k) ?? 0} → ${n}`);
  for (const [k, n] of base) if (n > (now.get(k) ?? 0)) gone.push(`${k}: ${n} → ${now.get(k) ?? 0}`);
  return { added, gone };
}

const row = (file: string, code: string, count: number, severity = 'warning'): DiagnosticCount => ({
  file,
  code,
  severity,
  count,
});

describe('compareWithBaseline', () => {
  const baseline = [row('workflows/custom/service-ingest.yaml', 'W_WORKFLOW_UNBOUND_TOKEN', 2)];

  it('accepts the baseline itself', () => {
    expect(compareWithBaseline(baseline, baseline)).toEqual({ added: [], gone: [] });
  });

  it('reports a diagnostic of a new code, of a new file, and one more of a known code', () => {
    const actual = countDiagnostics([
      { file: 'workflows/custom/service-ingest.yaml', code: 'W_WORKFLOW_UNBOUND_TOKEN', severity: 'warning' },
      { file: 'workflows/custom/service-ingest.yaml', code: 'W_WORKFLOW_UNBOUND_TOKEN', severity: 'warning' },
      { file: 'workflows/custom/service-ingest.yaml', code: 'W_WORKFLOW_UNBOUND_TOKEN', severity: 'warning' },
      { file: 'workflows/custom/service-ingest.yaml', code: 'W_PHASE_ACTION_UNTARGETED', severity: 'warning' },
      { file: 'workflows/built-in/sprint.yaml', code: 'E_WORKFLOW_DUPLICATE_NAME', severity: 'error' },
    ]);
    expect(compareWithBaseline(actual, baseline).added).toEqual([
      'workflows/built-in/sprint.yaml E_WORKFLOW_DUPLICATE_NAME (error): 0 → 1',
      'workflows/custom/service-ingest.yaml W_PHASE_ACTION_UNTARGETED (warning): 0 → 1',
      'workflows/custom/service-ingest.yaml W_WORKFLOW_UNBOUND_TOKEN (warning): 2 → 3',
    ]);
  });

  it('reports a diagnostic that went away', () => {
    expect(
      compareWithBaseline([row('workflows/custom/service-ingest.yaml', 'W_WORKFLOW_UNBOUND_TOKEN', 1)], baseline),
    ).toEqual({
      added: [],
      gone: ['workflows/custom/service-ingest.yaml W_WORKFLOW_UNBOUND_TOKEN (warning): 2 → 1'],
    });
  });
});

describe('this repository’s `.wingfoil/` under the pinned CLI (GA3-11 R-4)', () => {
  it('`workflow list` exits 0 with no error and exactly the baseline’s diagnostics', async () => {
    // Read-only: no git variable inherited (a hook's GIT_INDEX_FILE), and no optional index refresh
    // by the `git status` of `workflow list` (task-046 D46-5).
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
    for (const k of Object.keys(env)) if (k.startsWith('GIT_') && k !== 'GIT_OPTIONAL_LOCKS') delete env[k];
    const result = await run(process.execPath, [pinnedCli().script, 'workflow', 'list', '--format', 'json'], {
      cwd: REPO_ROOT,
      env,
      allowFailure: true,
    });
    expect(result.code, result.stderr).toBe(0);
    const diagnostics = (JSON.parse(result.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
    expect(diagnostics.filter((d) => d.severity !== 'warning')).toEqual([]);
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as DiagnosticCount[];
    // `workflow list` reads `.wingfoil/` as committed: commit a change before running this test
    // (W-24); `W_UNCOMMITTED_INPUTS` otherwise shows as an added diagnostic.
    expect(
      compareWithBaseline(countDiagnostics(diagnostics), baseline),
      'update test/governance/workflow-diagnostics.baseline.json in the same change, with the reason',
    ).toEqual({ added: [], gone: [] });
  }, 60_000);
});
