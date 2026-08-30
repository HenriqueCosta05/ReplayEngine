import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

export interface StaticServer {
  /** e.g. `http://127.0.0.1:52341` - no trailing slash. */
  readonly origin: string;
  close(): Promise<void>;
}

/**
 * Serves a directory of static HTML over loopback on an OS-assigned free port
 * (`listen(0)`), using only `node:http` - the fixture pages have to come from
 * a real origin because `file://` URLs behave differently across the three
 * browser engines, and a fixed port would make the suite flaky on a busy
 * machine.
 */
export async function startStaticServer(rootDir: string): Promise<StaticServer> {
  const server = http.createServer((request, response) => {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;
    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.join(rootDir, relative);

    // Never serve outside the fixture directory, even from a test helper.
    if (!filePath.startsWith(rootDir)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    void stat(filePath).then(
      () => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        createReadStream(filePath).pipe(response);
      },
      () => {
        response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      },
    );
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        // Browsers hold keep-alive sockets open; without this the close
        // callback never fires and the suite hangs at teardown.
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
