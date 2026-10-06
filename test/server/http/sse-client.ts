/**
 * A minimal Server-Sent Events client for the tests of `GET /api/events` (spec-004 §6): raw
 * `http` (so the tests set `Host`/`Origin`/`Sec-Fetch-Site` like a browser would), the frames parsed
 * as they arrive.
 */
import http from 'node:http';

/** One parsed frame: an event, or a comment line (heartbeat). */
export type SseFrame = { event: string; data: unknown } | { comment: string };

/** An open stream. */
export interface SseStream {
  status: number;
  headers: http.IncomingHttpHeaders;
  /** Every frame received so far. */
  frames: SseFrame[];
  /** The events received so far. */
  events(): { event: string; data: unknown }[];
  /** Resolves once the server ended the stream. */
  ended: Promise<void>;
  close(): void;
}

/** Open `GET <path>` on `127.0.0.1:<port>` with `headers`; resolves once the response head is in. */
export function openSse(port: number, path: string, headers: Record<string, string>): Promise<SseStream> {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port,
        path,
        headers: { host: `127.0.0.1:${port}`, accept: 'text/event-stream', ...headers },
      },
      (response) => {
        const frames: SseFrame[] = [];
        let buffer = '';
        let endedResolve!: () => void;
        const ended = new Promise<void>((r) => (endedResolve = r));
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          buffer += chunk;
          let at: number;
          while ((at = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, at);
            buffer = buffer.slice(at + 2);
            let event = 'message';
            const data: string[] = [];
            for (const line of block.split('\n')) {
              if (line.startsWith(':')) frames.push({ comment: line.slice(1).trim() });
              else if (line.startsWith('event:')) event = line.slice(6).trim();
              else if (line.startsWith('data:')) data.push(line.slice(5).trim());
            }
            if (data.length > 0) frames.push({ event, data: JSON.parse(data.join('\n')) as unknown });
          }
        });
        response.on('end', () => endedResolve());
        response.on('close', () => endedResolve());
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          frames,
          events: () => frames.filter((f): f is { event: string; data: unknown } => 'event' in f),
          ended,
          close: () => request.destroy(),
        });
      },
    );
    request.on('error', reject);
  });
}
