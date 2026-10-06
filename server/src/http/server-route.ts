/**
 * `GET /api/server` (spec-004 §3, `contracts/api/server.schema.json`): the UI version, the
 * supported WingFoil range (`{min, max}` only, adr-001 D3), the capability table of this release and
 * the shell warnings of the local state (spec-006 §4). Reads no project and starts no process.
 */
import type { FastifyInstance } from 'fastify';
import type { ServerInfo } from '@wingfoil-ui/contracts';
import { CAPABILITIES } from '../cli/capabilities.js';
import { supportedRange } from '../cli/version.js';
import type { StateStore } from '../state/store.js';

/** Path of the route. */
export const SERVER_PATH = '/api/server';

/** What the route needs. */
export interface ServerRouteOptions {
  /** The local state, for its warnings. */
  store: StateStore;
  /** The WingFoil UI package version. */
  version: string;
}

/** The body of `GET /api/server`. */
export function serverInfo(options: ServerRouteOptions): ServerInfo {
  const { min, max } = supportedRange();
  return {
    version: options.version,
    range: { min, max },
    capabilities: CAPABILITIES.map((c) => ({ ...c, conditions: [...c.conditions] })),
    warnings: options.store.warnings().map((w) => ({ key: w.key, args: { ...w.args } })),
  };
}

/** Register `GET /api/server`. */
export function registerServerRoute(app: FastifyInstance, options: ServerRouteOptions): void {
  app.get(SERVER_PATH, async () => serverInfo(options));
}
