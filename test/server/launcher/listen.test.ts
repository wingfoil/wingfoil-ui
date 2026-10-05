// spec-007 §3.3 — loopback listeners on 127.0.0.1 and ::1 with the same port (REQ-SEC-01).
import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listenLoopback,
  NoFreePortError,
  PortInUseError,
  type Binder,
  type LoopbackListeners,
} from '../../../server/src/launcher/listen.js';

const handler: http.RequestListener = (_req, res) => {
  res.end('ok');
};
const opened: LoopbackListeners[] = [];
const blockers: net.Server[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((l) => l.close()));
  await Promise.all(blockers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

async function block(host: string, port = 0): Promise<number> {
  const server = net.createServer();
  blockers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host, port }, resolve);
  });
  return (server.address() as net.AddressInfo).port;
}

async function get(host: string, port: number): Promise<string> {
  const res = await fetch(`http://${host.includes(':') ? `[${host}]` : host}:${port}/`);
  return res.text();
}

describe('listenLoopback', () => {
  it('listens on 127.0.0.1 and ::1 with the same free port', async () => {
    const l = await listenLoopback(handler, {});
    opened.push(l);
    expect(l.addresses).toEqual(['127.0.0.1', '::1']);
    expect(await get('127.0.0.1', l.port)).toBe('ok');
    expect(await get('::1', l.port)).toBe('ok');
  });

  it('listens on the given port', async () => {
    const port = await block('127.0.0.1');
    blockers.pop()!.close();
    await new Promise((r) => setTimeout(r, 50));
    const l = await listenLoopback(handler, { port });
    opened.push(l);
    expect(l.port).toBe(port);
  });

  it.each(['127.0.0.1', '::1'])('refuses a given port already in use on %s', async (host) => {
    const port = await block(host);
    await expect(listenLoopback(handler, { port })).rejects.toThrow(PortInUseError);
  });

  it('tries another port when ::1 refuses the one chosen for 127.0.0.1', async () => {
    const attempts: string[] = [];
    let refused = 0;
    const bind: Binder = async (server, host, port) => {
      attempts.push(`${host}:${port}`);
      if (host === '::1' && refused < 2) {
        refused += 1;
        throw Object.assign(new Error('in use'), { code: 'EADDRINUSE' });
      }
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host, port }, () => resolve((server.address() as net.AddressInfo).port));
      });
    };
    const l = await listenLoopback(handler, { bind });
    opened.push(l);
    expect(attempts.filter((a) => a.startsWith('127.0.0.1'))).toHaveLength(3);
    expect(l.addresses).toEqual(['127.0.0.1', '::1']);
  });

  it('gives up after 5 tries', async () => {
    const bind: Binder = async (server, host, port) => {
      if (host === '::1') throw Object.assign(new Error('in use'), { code: 'EADDRINUSE' });
      return new Promise((resolve) =>
        server.listen({ host, port }, () => resolve((server.address() as net.AddressInfo).port)),
      );
    };
    await expect(listenLoopback(handler, { bind })).rejects.toThrow(NoFreePortError);
  });

  it('continues on IPv4 only when IPv6 is not available', async () => {
    const bind: Binder = async (server, host, port) => {
      if (host === '::1') throw Object.assign(new Error('no ipv6'), { code: 'EADDRNOTAVAIL' });
      return new Promise((resolve) =>
        server.listen({ host, port }, () => resolve((server.address() as net.AddressInfo).port)),
      );
    };
    const l = await listenLoopback(handler, { bind });
    opened.push(l);
    expect(l.addresses).toEqual(['127.0.0.1']);
  });
});
