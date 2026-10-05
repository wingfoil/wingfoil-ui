/**
 * Loopback listeners (spec-007 §3.3, REQ-SEC-01): `127.0.0.1:<port>`, then `[::1]:<port>` on the
 * same port; IPv4 only when IPv6 is not available. Without a given port, a refusal on `::1` of the
 * port chosen for `127.0.0.1` closes both and tries a new free port.
 */
import http from 'node:http';
import type net from 'node:net';

/** Binds `server` to `host:port` and resolves with the bound port (injected by tests). */
export type Binder = (server: http.Server, host: string, port: number) => Promise<number>;

/** The open listeners. */
export interface LoopbackListeners {
  port: number;
  /** Bound addresses, `127.0.0.1` first. */
  addresses: string[];
  /** Stop accepting new connections; the open ones go on (see {@link LoopbackListeners.drain}). */
  stopAccepting(): void;
  /**
   * Wait for the open requests to finish, at most `timeoutMs`; then every remaining connection
   * is destroyed.
   */
  drain(timeoutMs: number): Promise<void>;
  /** `stopAccepting()` then `drain(timeoutMs)` (default 5 s). */
  close(timeoutMs?: number): Promise<void>;
}

/** Options of {@link listenLoopback}. */
export interface ListenOptions {
  /** The `--port`; default: a free port chosen by the OS. */
  port?: number | undefined;
  /** Tries without a given port (default 5). */
  maxTries?: number;
  bind?: Binder;
  /** Called with an error a listening server reports after the bind (e.g. `EMFILE`). */
  onError?: (error: Error) => void;
}

/** A given port is already in use on `127.0.0.1` or `::1` (exit 3). */
export class PortInUseError extends Error {
  constructor(readonly port: number) {
    super(`port ${port} in use`);
    this.name = 'PortInUseError';
  }
}

/** No port free on both addresses after the allowed tries (exit 3). */
export class NoFreePortError extends Error {
  constructor(readonly tries: number) {
    super(`no free port after ${tries} tries`);
    this.name = 'NoFreePortError';
  }
}

const NO_IPV6 = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EPROTONOSUPPORT']);

const defaultBind: Binder = (server, host, port) =>
  new Promise((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once('error', onError);
    server.listen({ host, port, exclusive: true }, () => {
      server.off('error', onError);
      resolve((server.address() as net.AddressInfo).port);
    });
  });

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
    server.closeIdleConnections();
  });
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/** Listen with `handler` on the loopback addresses. */
export async function listenLoopback(
  handler: http.RequestListener,
  options: ListenOptions,
): Promise<LoopbackListeners> {
  const bind = options.bind ?? defaultBind;
  const tries = options.port === undefined ? (options.maxTries ?? 5) : 1;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const v4 = http.createServer(handler);
    let port: number;
    try {
      port = await bind(v4, '127.0.0.1', options.port ?? 0);
    } catch (error) {
      if (errorCode(error) === 'EADDRINUSE' && options.port !== undefined) throw new PortInUseError(options.port);
      throw error;
    }
    const v6 = http.createServer(handler);
    try {
      await bind(v6, '::1', port);
      return listeners(port, [v4, v6], ['127.0.0.1', '::1'], options.onError);
    } catch (error) {
      const code = errorCode(error);
      if (code !== undefined && NO_IPV6.has(code)) return listeners(port, [v4], ['127.0.0.1'], options.onError);
      await closeServer(v4);
      if (code !== 'EADDRINUSE') throw error;
      if (options.port !== undefined) throw new PortInUseError(options.port);
    }
  }
  throw new NoFreePortError(tries);
}

function listeners(
  port: number,
  servers: http.Server[],
  addresses: string[],
  onError: ((error: Error) => void) | undefined,
): LoopbackListeners {
  for (const server of servers) server.on('error', (error: Error) => onError?.(error));
  let closed: Promise<void> | undefined;
  const result: LoopbackListeners = {
    port,
    addresses,
    stopAccepting: () => {
      closed ??= Promise.all(servers.map(closeServer)).then(() => undefined);
    },
    drain: async (timeoutMs) => {
      result.stopAccepting();
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      });
      const outcome = await Promise.race([closed, timeout]);
      clearTimeout(timer);
      if (outcome === 'timeout') {
        for (const server of servers) server.closeAllConnections();
        await closed;
      }
    },
    close: (timeoutMs = 5_000) => result.drain(timeoutMs),
  };
  return result;
}
