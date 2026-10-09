/**
 * Timeouts of the tests that spawn processes or lint the whole repository, sized for the worst
 * external load measured on the development machine (bug-004: load 57–99 on 12 cores, other
 * projects' builds): a loaded machine makes these tests slower, never failed. The default gates
 * stay load-independent; timing budgets live in `test:timing` (bug-001).
 */

/** The bin's start up to its running line (≈ 1 s idle; the 10 s default timed out at load 57–99). */
export const BIN_START_MS = 60_000;

/** A test that starts the bin itself (start, requests, stop). */
export const BIN_TEST_MS = 120_000;

/** Building the fixtures with the real CLI and git, or linting the whole repository (34 s at load 30). */
export const HEAVY_MS = 600_000;
