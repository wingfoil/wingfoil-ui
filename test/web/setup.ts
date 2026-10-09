/**
 * Vitest setup of every test file (`vitest.config.ts` `setupFiles`). In the jsdom component tests
 * (`test/web/`), Testing Library's async queries (`findBy…`, `waitFor`) wait up to 10 s instead of
 * 1 s: the first render of a file under external load took longer than 1 s (bug-004, task-018's
 * "shows the element…"). A wrong value still fails, only later.
 */
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/react');
  configure({ asyncUtilTimeout: 10_000 });
}
