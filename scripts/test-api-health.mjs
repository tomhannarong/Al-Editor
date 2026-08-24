import assert from 'node:assert/strict';
import net from 'node:net';
import { createServer } from 'node:http';
import { createHealthServer } from '../apps/api/health-server.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(url, options) {
  const response = await fetch(url, options);
  return { status: response.status, body: await response.json() };
}

const postgres = net.createServer((socket) => socket.end());
const postgresPort = await listen(postgres);

const qdrant = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }
  response.writeHead(404);
  response.end();
});
const qdrantPort = await listen(qdrant);

const health = createHealthServer({
  host: '127.0.0.1',
  port: 0,
  postgresHost: '127.0.0.1',
  postgresPort,
  qdrantBaseUrl: `http://127.0.0.1:${qdrantPort}`,
  probeTimeoutMs: 300,
});
const healthAddress = await health.start();
assert.ok(healthAddress && typeof healthAddress === 'object');
const baseUrl = `http://127.0.0.1:${healthAddress.port}`;

try {
  assert.deepEqual(await readJson(`${baseUrl}/health/live`), {
    status: 200,
    body: { status: 'ok' },
  });

  assert.deepEqual(await readJson(`${baseUrl}/health/ready`), {
    status: 200,
    body: { status: 'ready', postgres: 'ok', qdrant: 'ok' },
  });

  assert.deepEqual(await readJson(`${baseUrl}/health/live`, { method: 'POST' }), {
    status: 405,
    body: { status: 'method-not-allowed' },
  });

  assert.deepEqual(await readJson(`${baseUrl}/missing`), {
    status: 404,
    body: { status: 'not-found' },
  });

  await close(qdrant);
  assert.deepEqual(await readJson(`${baseUrl}/health/ready`), {
    status: 503,
    body: { status: 'not-ready', postgres: 'ok', qdrant: 'unavailable' },
  });

  await close(postgres);
  assert.deepEqual(await readJson(`${baseUrl}/health/ready`), {
    status: 503,
    body: { status: 'not-ready', postgres: 'unavailable', qdrant: 'unavailable' },
  });

  console.log('PASS: API liveness/readiness contract and fail-closed dependency behavior');
} finally {
  await health.stop();
  await close(qdrant);
  await close(postgres);
}
