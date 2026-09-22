import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const timeoutMs = Number(process.env.STATUS_TIMEOUT_MS || 5000);
const cacheMs = Number(process.env.STATUS_CACHE_MS || 30000);
const probes = [
  ['onedrip-web', 'OneDrip Web', process.env.STATUS_WEB_URL || 'https://onedrip.com.br/release.json'],
  ['onedrip-api', 'OneDrip API', process.env.STATUS_API_URL || 'https://api.kuky.solutions/api/health'],
  ['database-auth', 'Banco e autenticação', process.env.STATUS_AUTH_URL || 'https://db.kuky.solutions/auth/v1/health'],
  ['drippy-studio', 'Drippy Studio', process.env.STATUS_STUDIO_URL || 'https://studio.kuky.solutions/component/releases/latest.json'],
];

let cached;
let cachedAt = 0;

async function probe([id, name, url]) {
  const started = performance.now();
  try {
    const headers = { 'user-agent': 'Kuky-Status/1.0' };
    if (id === 'database-auth' && (process.env.STATUS_AUTH_KEY || process.env.VITE_SUPABASE_ANON_KEY)) headers.apikey = process.env.STATUS_AUTH_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
    if (!response.ok) throw new Error(String(response.status));
    return { id, name, status: 'operational', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { id, name, status: 'down', latencyMs: Math.round(performance.now() - started) };
  }
}

export async function getStatus(now = Date.now()) {
  if (cached && now - cachedAt < cacheMs) return cached;
  const services = await Promise.all(probes.map(probe));
  const failed = services.filter(service => service.status === 'down');
  const overall = failed.some(service => service.id === 'onedrip-web') || failed.length >= 2 ? 'outage' : failed.length ? 'degraded' : 'operational';
  cachedAt = now;
  cached = { overall, checkedAt: new Date(now).toISOString(), services };
  return cached;
}

export function resetStatusCache() {
  cached = undefined;
  cachedAt = 0;
}

export function createStatusServer() {
  return createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    if (request.url?.split('?')[0] === '/api/status') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(await getStatus()));
      return;
    }
    const pathname = request.url?.split('?')[0] || '/';
    const files = {
      '/': [join(root, 'index.html'), 'text/html; charset=utf-8'],
      '/styles.css': [join(root, 'styles.css'), 'text/css; charset=utf-8'],
    };
    const file = files[pathname];
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store' });
    createReadStream(file[0]).pipe(response);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4174);
  createStatusServer().listen(port, host, () => console.log(`Kuky Status: http://${host}:${port}`));
}
