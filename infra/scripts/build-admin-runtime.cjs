const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { buildSync } = require('../../apps/web/node_modules/esbuild');
const root = path.resolve(__dirname, '../..');
const destination = path.join(root, 'infra/admin-runtime/.build');
fs.mkdirSync(destination, { recursive: true });
for (const domain of ['admin', 'routes', 'operations', 'ai', 'stripe']) {
  const directory = path.join(destination, domain);
  buildSync({ entryPoints: [path.join(root, `infra/lambda/src/${domain}/index.ts`)], bundle: true, platform: 'node', target: 'node22', format: 'cjs', outfile: path.join(directory, 'index.js') });
  // Only the bundled handler is included; no dependency layer or credentials.
  execFileSync('zip', ['-q', '-j', path.join(destination, `${domain}.zip`), path.join(directory, 'index.js')]);
  console.log(`Built ${domain}.zip`);
}

const routeMap = Object.fromEntries(['GET /stripe/plans','GET /stripe/session','GET /stripe/subscription','POST /stripe/checkout','POST /stripe/portal','POST /stripe/webhook','OPTIONS /stripe/{proxy+}'].map(route=>[route,'stripe']));
Object.assign(routeMap, { 'POST /ai/route-planner': 'ai', 'GET /stripe/wallet': 'ai', 'OPTIONS /ai/{proxy+}': 'ai', 'OPTIONS /stripe/wallet': 'ai' });
for (const [domain, files] of Object.entries({ admin: ['admin/index.ts', 'admin/management.ts'], routes: ['routes/index.ts'], operations: ['operations/index.ts'] })) {
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, 'infra/lambda/src', file), 'utf8');
    const pattern = domain === 'admin' ? /"((?:GET|POST|PUT|DELETE) \/admin\/[^"\n]+)":/g : /router\.add\("((?:GET|POST|PUT|DELETE) [^"\n]+)"/g;
    for (const [, route] of source.matchAll(pattern)) {
      if (domain === 'routes' && !route.split(' ')[1].startsWith('/routes')) continue;
      routeMap[route] = domain;
    }
  }
}
for (const [route, domain] of Object.entries({ 'OPTIONS /routes': 'routes', 'OPTIONS /routes/{proxy+}': 'routes', 'OPTIONS /admin/{proxy+}': 'admin', 'OPTIONS /support/{proxy+}': 'operations', 'OPTIONS /system/{proxy+}': 'operations', 'OPTIONS /marketplace/{proxy+}': 'operations', 'OPTIONS /tracker': 'operations', 'OPTIONS /tracker/{proxy+}': 'operations' })) routeMap[route] = domain;
fs.writeFileSync(path.join(root, 'infra/admin-runtime/routes.json'), JSON.stringify(routeMap, null, 2) + '\n');

execFileSync("zip", ["-q", "-j", path.join(destination, "legacy-api.zip"), path.join(root, "infra/lambda/handler.py")]);
