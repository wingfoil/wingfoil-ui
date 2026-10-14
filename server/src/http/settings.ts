/**
 * `GET /api/settings` and `PUT /api/settings` (spec-004 §3, spec-006 §2; REQ-STATE-09, C4): the UI
 * settings of the local state, global to every project. `GET` re-reads the state first, so a page
 * sees a change made through another console (D30-3), and answers the effective settings (a
 * missing or invalid stored value reads as its default, unknown keys are not returned, RP-39).
 * `PUT` takes the whole object (RP-28), validated strictly by
 * `contracts/api/settings.schema.json` (no type coercion; a key missing, a wrong type, an
 * out-of-range integer or an extra key → 400 `invalid-request`, nothing stored); it stores it under
 * the state lock — trimming the action log when the cap is lowered (RP-38) —, sends one `settings`
 * event and answers 200 with the stored settings. A local-state write with no project: only rows
 * 1, 2 and 4 of spec-004 §4 apply, and no process is started.
 */
import type { FastifyInstance } from 'fastify';
import type { UiSettings } from '@wingfoil-ui/contracts';
import type { EventBus } from '../events/bus.js';
import { SETTINGS_SCHEMA, validateSettings } from '../state/settings.js';
import type { StateStore } from '../state/store.js';

/** Path of both routes. */
export const SETTINGS_PATH = '/api/settings';

/** What the routes need. */
export interface SettingsRouteOptions {
  /** The local state, where the settings live. */
  store: StateStore;
  /** Where the `settings` event is published (spec-004 §6). */
  bus: EventBus;
}

/** Register `GET /api/settings` and `PUT /api/settings`. */
export function registerSettingsRoutes(app: FastifyInstance, options: SettingsRouteOptions): void {
  const { store, bus } = options;
  app.get(SETTINGS_PATH, async () => {
    await store.reload();
    return store.settings();
  });
  app.put<{ Body: UiSettings }>(SETTINGS_PATH, {
    schema: { body: SETTINGS_SCHEMA },
    // Strict on this route: Fastify's default validator coerces types and drops extra properties.
    validatorCompiler: () => validateSettings,
    handler: async (request) => {
      const stored = await store.putSettings(request.body);
      bus.publish({ event: 'settings', data: {} });
      return stored;
    },
  });
}
