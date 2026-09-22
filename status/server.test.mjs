import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const down = new Set();
const upstream = (await import('node:http')).createServer((request, response) => {
  response.writeHead(down.has(request.url) ? 503 : 200);
  response.end('ok');
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
const port = upstream.address().port;
process.env.STATUS_WEB_URL = `http://127.0.0.1:${port}/web`;
process.env.STATUS_API_URL = `http://127.0.0.1:${port}/api`;
process.env.STATUS_AUTH_URL = `http://127.0.0.1:${port}/auth`;
process.env.STATUS_STUDIO_URL = `http://127.0.0.1:${port}/studio`;
const { createStatusServer, getStatus, resetStatusCache } = await import('./server.mjs');
let server;
before(async () => { server = createStatusServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); });
after(async () => { await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => upstream.close(resolve))]); });

test('returns the public status contract', async () => {
  down.clear();
  resetStatusCache();
  const status = await getStatus();
  assert.equal(status.overall, 'operational');
  assert.equal(status.services.length, 4);
  assert.ok(status.services.every(service => service.status === 'operational'));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/status`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).overall, 'operational');
});

test('classifies one secondary failure as degraded', async () => {
  down.clear(); down.add('/studio'); resetStatusCache();
  assert.equal((await getStatus()).overall, 'degraded');
});

test('classifies web or two failures as outage', async () => {
  down.clear(); down.add('/web'); resetStatusCache();
  assert.equal((await getStatus()).overall, 'outage');
  down.clear(); down.add('/api'); down.add('/auth'); resetStatusCache();
  assert.equal((await getStatus()).overall, 'outage');
});
