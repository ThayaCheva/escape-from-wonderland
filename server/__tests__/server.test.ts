import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import WebSocket from 'ws';
import { startServer } from '../index';
import type { ServerMsg } from '../../src/net/protocol';

let server: { port: number; close(): Promise<void> };

beforeAll(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'ew-dist-'));
  writeFileSync(join(dist, 'index.html'), '<html>wonderland</html>');
  server = await startServer({ port: 0, distDir: dist });
});
afterAll(() => server.close());

function get(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
  const msgs: ServerMsg[] = [];
  const waiters: Array<() => void> = [];
  ws.on('message', (data) => {
    msgs.push(JSON.parse(String(data)));
    waiters.splice(0).forEach((w) => w());
  });
  const next = async <T extends ServerMsg['t']>(t: T): Promise<Extract<ServerMsg, { t: T }>> => {
    for (;;) {
      const found = msgs.find((m) => m.t === t);
      if (found) {
        msgs.splice(msgs.indexOf(found), 1);
        return found as Extract<ServerMsg, { t: T }>;
      }
      await new Promise<void>((r) => waiters.push(r));
    }
  };
  const open = new Promise<void>((r) => ws.on('open', () => r()));
  return { ws, next, open, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe('server', () => {
  it('serves health, the page, and refuses path escapes', async () => {
    expect(await get('/health')).toEqual({ status: 200, body: 'ok' });
    expect((await get('/')).body).toContain('wonderland');
    expect((await get('/some/route')).body).toContain('wonderland');
    expect((await get('/../package.json')).status).toBe(404);
  });

  it('two players create, join and start over WebSockets with private hands', async () => {
    const a = client();
    const b = client();
    await Promise.all([a.open, b.open]);
    a.send({ t: 'create', name: 'Ann' });
    const { room } = await a.next('joined');
    b.send({ t: 'join', room, name: 'Bo' });
    await b.next('joined');
    a.send({ t: 'start' });
    const va = await a.next('view');
    const vb = await b.next('view');
    expect(va.seat).toBe(0);
    expect(vb.seat).toBe(1);
    const bJson = JSON.stringify(vb.view);
    for (const c of va.view.players[0].hand) expect(bJson).not.toContain(`"${c.id}"`);
    a.ws.close();
    b.ws.close();
  });
});
