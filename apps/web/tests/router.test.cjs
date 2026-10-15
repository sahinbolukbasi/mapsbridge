const test = require("node:test");
const assert = require("node:assert/strict");

// Re-implement the router logic in CJS test harness to verify regex compilation & parameter extraction
class Router {
  constructor() {
    this.exactRoutes = new Map();
    this.compiledRoutes = [];
  }

  add(routeKey, handler) {
    const parts = routeKey.trim().split(/\s+/);
    return this.register(parts[0].toUpperCase(), parts[1], handler);
  }

  register(method, path, handler) {
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (!normalizedPath.includes("{")) {
      this.exactRoutes.set(`${normalizedMethod} ${normalizedPath}`, handler);
      return this;
    }

    const paramNames = [];
    const regexPattern = normalizedPath.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

    this.compiledRoutes.push({
      method: normalizedMethod,
      pattern: new RegExp(`^${regexPattern}$`),
      paramNames,
      handler,
    });

    return this;
  }

  async dispatch(event) {
    const method = event.requestContext?.http?.method?.toUpperCase() || "GET";
    const path =
      (event.requestContext?.http?.path || event.rawPath || "/").replace(/\/$/, "") || "/";

    if (method === "OPTIONS") {
      return { statusCode: 200, headers: { "access-control-allow-origin": "*" }, body: "" };
    }

    const exactKey = `${method} ${path}`;
    const exactHandler = this.exactRoutes.get(exactKey);
    if (exactHandler) {
      return exactHandler(event);
    }

    for (const route of this.compiledRoutes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (match) {
        const pathParameters = { ...(event.pathParameters || {}) };
        route.paramNames.forEach((name, index) => {
          pathParameters[name] = decodeURIComponent(match[index + 1]);
        });
        event.pathParameters = pathParameters;
        return route.handler(event);
      }
    }

    return { statusCode: 404, body: JSON.stringify({ error: `Not found: ${method} ${path}` }) };
  }
}

test("router matches exact static endpoints correctly", async () => {
  const router = new Router();
  router.add("GET /routes", async (e) => ({
    statusCode: 200,
    body: JSON.stringify({ ok: true, path: "list" }),
  }));

  const res = await router.dispatch({
    requestContext: { http: { method: "GET", path: "/routes" } },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).path, "list");
});

test("router extracts path parameter {id} correctly and does not 404", async () => {
  const router = new Router();
  router.add("GET /routes/{id}", async (e) => ({
    statusCode: 200,
    body: JSON.stringify({ routeId: e.pathParameters.id }),
  }));

  const res = await router.dispatch({
    requestContext: { http: { method: "GET", path: "/routes/rota-kapadokya-101" } },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).routeId, "rota-kapadokya-101");
});

test("router matches multi-parameter routes like /routes/{id}/osrm/{profile}", async () => {
  const router = new Router();
  router.add("GET /routes/{id}/osrm/{profile}", async (e) => ({
    statusCode: 200,
    body: JSON.stringify({
      id: e.pathParameters.id,
      profile: e.pathParameters.profile,
    }),
  }));

  const res = await router.dispatch({
    requestContext: { http: { method: "GET", path: "/routes/xyz-789/osrm/cycling" } },
  });

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.id, "xyz-789");
  assert.equal(body.profile, "cycling");
});

test("router returns 404 for unknown endpoints and 200 for OPTIONS preflight", async () => {
  const router = new Router();
  router.add("GET /routes", async () => ({ statusCode: 200, body: "{}" }));

  const optRes = await router.dispatch({
    requestContext: { http: { method: "OPTIONS", path: "/routes" } },
  });
  assert.equal(optRes.statusCode, 200);

  const notFoundRes = await router.dispatch({
    requestContext: { http: { method: "GET", path: "/unknown/endpoint" } },
  });
  assert.equal(notFoundRes.statusCode, 404);
});
