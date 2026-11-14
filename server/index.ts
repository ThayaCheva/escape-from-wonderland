// The game server: serves the built web page, /health, and the live game connection at /ws.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { RoomManager, type Conn } from './rooms';
import type { ClientMsg } from '../src/net/protocol';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

async function serveStatic(distDir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let path: string;
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    path = '';
  }
  // reject anything trying to climb out of dist (check the raw URL too: URL() normalises "..")
  if (!path || path.includes('..') || (req.url ?? '').includes('..')) {
    res.writeHead(404).end('not found');
    return;
  }
  const root = resolve(distDir);
  const file = path === '/' ? join(root, 'index.html') : join(root, path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    if (extname(path)) {
      res.writeHead(404).end('not found');
      return;
    }
    // client-side routes (e.g. /?room=ABCD handled by the page) fall back to the page
    const body = await readFile(join(root, 'index.html'));
    res.writeHead(200, { 'content-type': TYPES['.html'] }).end(body);
  }
}

export async function startServer(opts: { port: number; distDir: string }): Promise<{ port: number; close(): Promise<void> }> {
  const manager = new RoomManager({ now: () => Date.now(), randomInt: (max) => randomInt(max) });

  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    serveStatic(opts.distDir, req, res).catch(() => res.writeHead(500).end('error'));
  });

  // small messages only; a bad frame from one client must never take the process down
  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('error', (e) => console.error('websocket server error', e));
  wss.on('connection', (ws: WebSocket) => {
    ws.on('error', () => ws.terminate());
    const conn: Conn = {
      id: randomUUID(),
      send: (msg) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      },
    };
    ws.on('message', (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      try {
        manager.handle(conn, msg);
      } catch (e) {
        console.error('error handling message', e);
      }
    });
    ws.on('close', () => manager.disconnect(conn));
  });

  const sweeper = setInterval(() => manager.sweep(), 60_000);

  await new Promise<void>((r) => http.listen(opts.port, r));
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;

  return {
    port,
    close: () =>
      new Promise<void>((r) => {
        clearInterval(sweeper);
        for (const client of wss.clients) client.terminate();
        wss.close();
        http.close(() => r());
      }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8080);
  startServer({ port, distDir: resolve('dist') }).then((s) => console.log(`Escape from Wonderland server on port ${s.port}`));
}
