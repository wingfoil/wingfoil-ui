/**
 * REQ-SEC-05 probe values shared by the tests that pass user input to processes (task-001 harness
 * clone; task-008 `POST /api/projects/clone`; later the decision-log title of v0.3).
 */
import { existsSync } from 'node:fs';

/** A shell payload: harmless when passed as an argument, creates {@link PWNED_PATH} through a shell. */
export const SHELL_PAYLOAD = '"; touch /tmp/pwned; "';

/** The file the payload would create (SARD REQ-SEC-05 fit criterion). */
export const PWNED_PATH = '/tmp/pwned';

/** Whether the payload ran. Check it is `false` before the probe too, or the result means nothing. */
export function pwned(): boolean {
  return existsSync(PWNED_PATH);
}
