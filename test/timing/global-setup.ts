/**
 * Global setup of the timing suite (`npm run test:timing`, bug-001): the same `server/` build as
 * the default suite (and its temporary root, task-026), and the load average printed before any
 * measurement.
 */
import setup from '../global-setup.js';
import { loadAverage } from './load.js';

export default function timingSetup(): () => void {
  const teardown = setup();
  console.info(`timing suite start — ${loadAverage()}`);
  return teardown;
}
