import net from 'node:net';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
});

function asPort(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`invalid port: ${value}`);
  }
  return parsed;
}

function asPositiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`invalid positive integer: ${value}`);
  }
  return parsed;
}

export function probeTcp({ host, port, timeoutMs }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (ready) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ready);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

export async function probeQdrant({ baseUrl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL('/healthz', baseUrl);
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function readinessSnapshot(config) {
  const [postgresReady, qdrantReady] = await Promise.all([
    probeTcp({
      host: config.postgresHost,
      port: config.postgresPort,
      timeoutMs: config.probeTimeoutMs,
    }),
    probeQdrant({
      baseUrl: config.qdrantBaseUrl,
      timeoutMs: config.probeTimeoutMs,
    }),
  ]);

  if (postgresReady && qdrantReady) {
    return {
      ok: true,
      body: {
        status: 'ready',
        postgres: 'ok',
        qdrant: 'ok',
      },
    };
  }

  return {
    ok: false,
    body: {
      status: 'not-ready',
      postgres: postgresReady ? 'ok' : 'unavailable',
      qdrant: qdrantReady ? 'ok' : 'unavailable',
    },
  };
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(`${JSON.stringify(body)}\n`);
}

export function createHealthServer(options = {}) {
  const config = Object.freeze({
    host: options.host ?? '127.0.0.1',
    port: asPort(options.port, 3000),
    postgresHost: options.postgresHost ?? '127.0.0.1',
    postgresPort: asPort(options.postgresPort, 5432),
    qdrantBaseUrl: options.qdrantBaseUrl ?? 'http://127.0.0.1:6333',
    probeTimeoutMs: asPositiveInteger(options.probeTimeoutMs, 1500),
  });

  const server = createServer(async (request, response) => {
    if (request.method !== 'GET') {
      writeJson(response, 405, { status: 'method-not-allowed' });
      return;
    }

    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (requestUrl.pathname === '/health/live') {
      writeJson(response, 200, { status: 'ok' });
      return;
    }

    if (requestUrl.pathname === '/health/ready') {
      const snapshot = await readinessSnapshot(config);
      writeJson(response, snapshot.ok ? 200 : 503, snapshot.body);
      return;
    }

    writeJson(response, 404, { status: 'not-found' });
  });

  return {
    config,
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => {
          server.off('error', reject);
          resolve();
        });
      });
      return server.address();
    },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function runCli() {
  const health = createHealthServer({
    host: process.env.API_HOST ?? '127.0.0.1',
    port: process.env.API_PORT ?? '3000',
    postgresHost: process.env.POSTGRES_HOST ?? '127.0.0.1',
    postgresPort: process.env.POSTGRES_PORT ?? '5432',
    qdrantBaseUrl: process.env.QDRANT_URL ?? `http://127.0.0.1:${process.env.QDRANT_HTTP_PORT ?? '6333'}`,
    probeTimeoutMs: process.env.HEALTH_PROBE_TIMEOUT_MS ?? '1500',
  });

  await health.start();
  const address = health.server.address();
  const display = typeof address === 'object' && address ? `${address.address}:${address.port}` : String(address);
  console.log(`AI Editor health API listening on ${display}`);

  const shutdown = async () => {
    await health.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
