/**
 * Global setup of the launch smoke (`npm run test:smoke`): the run's temporary root only (task-026,
 * `harness/temp-root.ts`) — the smoke builds through `prepack` itself.
 */
import { setUpTempRoot } from '../harness/temp-root.js';

export default function setup(): () => void {
  return setUpTempRoot();
}
