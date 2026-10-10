/**
 * A git "dumb HTTP" remote on 127.0.0.1 for the e2e suites, offline (task-014): the bare
 * repositories under `base` served as files (`git update-server-info` run on each by
 * {@link bareRepository}). With `credentials`, a request without that Basic authorization is
 * answered 401 (a refused authentication, S-07.3). With `hold`, every request waits until
 * {@link GitHttpRemote.release} (a clone in progress, W4-11).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import path from 'node:path';
import { git } from '../../harness/run.js';

/** Options of {@link startGitHttpRemote}. */
export interface GitHttpOptions {
  /** `user:password` required by every request. */
  credentials?: string;
  /** Hold every request until `release()`. */
  hold?: boolean;
}

/** A running remote. */
export interface GitHttpRemote {
  /** `http://127.0.0.1:<port>`. */
  origin: string;
  /** Answers the held requests and stops holding. */
  release(): void;
  /** Requests received so far. */
  requests(): number;
  close(): Promise<void>;
}

/** Start the remote serving `base`. */
export async function startGitHttpRemote(base: string, options: GitHttpOptions = {}): Promise<GitHttpRemote> {
  let holding = options.hold ?? false;
  let received = 0;
  const held: (() => void)[] = [];
  const sockets = new Set<Socket>();
  const answer = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const expected = options.credentials ? `Basic ${Buffer.from(options.credentials).toString('base64')}` : undefined;
    if (expected && req.headers.authorization !== expected) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="test"' }).end();
      return;
    }
    const file = path.join(base, decodeURIComponent((req.url ?? '/').split('?')[0]!));
    if (!file.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    readFile(file).then(
      (data) => res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(data),
      () => res.writeHead(404).end(),
    );
  };
  const server = http.createServer((req, res) => {
    received += 1;
    if (holding) held.push(() => answer(req, res));
    else answer(req, res);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    release: () => {
      holding = false;
      for (const go of held.splice(0)) go();
    },
    requests: () => received,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/**
 * A bare repository `<base>/<name>.git` holding one commit of `files` (a plain repository built
 * next to it first), ready to be served over dumb HTTP or cloned as `file://`.
 */
export async function bareRepository(
  base: string,
  name: string,
  files: Record<string, string>,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const work = path.join(base, 'work', name);
  await mkdir(work, { recursive: true });
  await git(work, ['init', '-q'], env);
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(work, file)), { recursive: true });
    await writeFile(path.join(work, file), content);
  }
  await git(work, ['add', '-A'], env);
  await git(work, ['-c', 'user.name=T', '-c', 'user.email=t@example.test', 'commit', '-qm', 'init'], env);
  const bare = path.join(base, `${name}.git`);
  await git(base, ['clone', '-q', '--bare', work, bare], env);
  await git(bare, ['update-server-info'], env);
  return bare;
}
