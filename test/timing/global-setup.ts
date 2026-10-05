/**
 * Global setup of the timing suite (`npm run test:timing`, bug-001): the same `server/` build as
 * the default suite, and the load average printed before any measurement.
 */
import buildServer from '../global-setup.js';
import { loadAverage } from './load.js';

export default function setup(): void {
  buildServer();
  console.info(`timing suite start — ${loadAverage()}`);
}
