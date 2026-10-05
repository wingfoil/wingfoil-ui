/**
 * The server log (spec-007 §5): pino on stderr, level `info`, with the `authorization` and
 * `cookie` request headers redacted (REQ-SEC-02) — the token and the session id are never logged.
 */
import { pino, type Logger } from 'pino';

/** Paths removed from every log line. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

interface LoggedRequest {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
}

/** Create the server logger writing to `stream` (default: stderr). */
export function createLogger(stream: NodeJS.WritableStream = process.stderr): Logger {
  return pino(
    {
      level: 'info',
      redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
      serializers: {
        req: (req: LoggedRequest) => ({ method: req.method, url: req.url, headers: { ...req.headers } }),
      },
    },
    stream,
  );
}
