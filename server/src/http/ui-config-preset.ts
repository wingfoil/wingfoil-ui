/**
 * The preset write route of spec-004 §3 (v0.3, task-060):
 *
 * | Route | Request (`contracts/api/`) | 200 | Refusals |
 * |-------|----------------------------|-----|----------|
 * | `POST /api/p/:pid/ui-config/preset` | `ui-config.preset.request.schema.json` `{preset}` | `write.response.schema.json`, `result` `{file, preset}` | `ui-config.preset.refusal.schema.json` |
 *
 * An unknown `:pid` → 404 before the body is read (spec-004 §4 row 3); a body failing its schema →
 * 400 `invalid-request` (row 4, strict: no coercion, no extra key); the rest is {@link PresetWrites}.
 * The write goes on when the client leaves: a commit is never left half-made.
 */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import type { UiConfigPresetRequest } from '@wingfoil-ui/contracts';
import type { UiPresetName } from '../presets/ui-config.js';
import { PresetWrites, type PresetWritesOptions } from '../writes/preset.js';
import { envelope } from './app.js';

/** The route's path. */
export const UI_CONFIG_PRESET_PATH = '/api/p/:pid/ui-config/preset';

// Read like every contract at load (same depth from `src` and `dist`).
const REQUEST_SCHEMA = JSON.parse(
  readFileSync(new URL('../../../contracts/api/ui-config.preset.request.schema.json', import.meta.url), 'utf8'),
) as object;
const validate = new Ajv({ allErrors: true }).compile(REQUEST_SCHEMA);

/** What the route needs: the list of projects and {@link PresetWritesOptions}. */
export type UiConfigPresetRouteOptions = PresetWritesOptions;

/** Register the route. */
export function registerUiConfigPresetRoute(app: FastifyInstance, options: UiConfigPresetRouteOptions): void {
  const { store } = options;
  const writes = new PresetWrites(options);
  app.post<{ Params: { pid: string }; Body: UiConfigPresetRequest }>(UI_CONFIG_PRESET_PATH, {
    schema: { body: REQUEST_SCHEMA },
    validatorCompiler: () => validate,
    // spec-004 §4 row 3 before row 4: the project is looked up before the body is parsed.
    onRequest: async (request, reply) => {
      if (store.get(request.params.pid) === undefined) return reply.code(404).send(envelope('not-found', 'Not found'));
    },
    handler: async (request, reply) => {
      const entry = store.get(request.params.pid);
      if (entry === undefined) return reply.code(404).send(envelope('not-found', 'Not found'));
      const outcome = await writes.apply(
        entry,
        { pid: entry.id, preset: request.body.preset as UiPresetName },
        request.log,
      );
      return reply.code(outcome.status).send(outcome.body);
    },
  });
}
