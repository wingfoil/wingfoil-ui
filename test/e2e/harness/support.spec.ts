// Self-test of the shared e2e support (task-013, Wave 3): a console seeded with a fixture copy, the
// page's session, and the SSE wait helper — a commit made outside the UI reaches the page as a
// `repo` event of that project, an add through the API as a `projects` event.
import { openConsole } from '../support/console.js';
import { commitFile, mutateAndWait, recordServerEvents } from '../support/events.js';
import { expect, test } from '../support/fixtures.js';

// The fixtures of this spec, built before its first test (shared support, bug-004).
test.use({ prebuild: ['kanban'] });

test('seeds the console, opens the page and waits for repo and projects events', async ({
  page,
  fixtures,
  consoles,
}) => {
  test.setTimeout(240_000);
  const kanban = await fixtures.copy('kanban');
  const c = await consoles.start({ projects: [kanban] });
  await recordServerEvents(page);
  await openConsole(page, c);
  const list = await page.evaluate(
    async () => (await (await fetch('/api/projects')).json()) as { projects: { id: string; name: string }[] },
  );
  expect(list.projects.map((p) => [p.id, p.name])).toEqual([[c.pids[0], 'kanban']]);
  // Open the project once so that the console watches it.
  expect(await page.evaluate(async (pid) => (await fetch(`/api/p/${pid}`)).status, c.pids[0]!)).toBe(200);

  const event = await mutateAndWait(
    page,
    () => commitFile(kanban, 'NOTES.md', 'outside the UI\n', 'docs: a commit outside the UI'),
    {
      event: 'repo',
      pid: c.pids[0]!,
    },
  );
  expect(event.data['state']).toMatch(/^[0-9a-f]{40}\.[0-9a-f]{16}$/);

  const other = await fixtures.copy('kanban');
  await mutateAndWait(
    page,
    () =>
      page.evaluate(
        async (dir) =>
          (
            await fetch('/api/projects', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ path: dir }),
            })
          ).status,
        other.dir,
      ),
    { event: 'projects' },
  );
});

// task-038 (C2) and its review R4: `settings` is written into the seeded `state.json`; given with a
// raw `stateFile` or a `stateDir` that already holds a `state.json`, it is refused, never ignored.
test('startConsole({ settings }) seeds the settings and refuses what it would ignore', async ({
  page,
  fixtures,
  consoles,
}, testInfo) => {
  const kanban = await fixtures.copy('kanban');
  const c = await consoles.start({ projects: [kanban], settings: { autoPush: true, autoFetch: false } });
  await openConsole(page, c);
  const settings = await page.evaluate(
    async () => (await (await fetch('/api/settings')).json()) as Record<string, unknown>,
  );
  expect(settings).toMatchObject({ autoPush: true, autoFetch: false });

  await expect(consoles.start({ stateFile: '{}', settings: { autoPush: true } })).rejects.toThrow(
    /settings.*stateFile/,
  );
  const stateDir = testInfo.outputPath('seeded-state');
  const first = await consoles.start({ projects: [kanban], stateDir });
  await first.stop();
  await expect(consoles.start({ stateDir, settings: { autoPush: true } })).rejects.toThrow(/settings.*state\.json/);
});
