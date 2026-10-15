/**
 * Lightweight, zero-dependency parameterized HTTP router for AWS Lambda API Gateway v2
 * Supports patterns like "GET /routes/{id}", "POST /routes/{id}/share", etc.
 */

import type { ApiGatewayEvent, ApiResponse } from "./http";
import { notFound, handlePreflight } from "./http";

export type RouteHandler = (event: ApiGatewayEvent) => Promise<ApiResponse>;

interface CompiledRoute {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private exactRoutes = new Map<string, RouteHandler>();
  private compiledRoutes: CompiledRoute[] = [];

  /**
   * Register a route handler.
   * e.g. router.register("GET", "/routes/{id}", handleGetRoute)
   * or router.add("GET /routes/{id}", handleGetRoute)
   */
  add(routeKey: string, handler: RouteHandler): this {
    const parts = routeKey.trim().split(/\s+/);
    if (parts.length !== 2) {
      throw new Error(`Invalid routeKey format. Expected 'METHOD /path', got: ${routeKey}`);
    }
    return this.register(parts[0].toUpperCase(), parts[1], handler);
  }

  register(method: string, path: string, handler: RouteHandler): this {
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (!normalizedPath.includes("{")) {
      // Exact route without path parameters
      this.exactRoutes.set(`${normalizedMethod} ${normalizedPath}`, handler);
      return this;
    }

    // Parameterized route: extract param names and build regex
    const paramNames: string[] = [];
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

  /**
   * Dispatches the API Gateway event to the matching route handler.
   * Injects parsed parameters into event.pathParameters.
   */
  async dispatch(event: ApiGatewayEvent): Promise<ApiResponse> {
    const method = event.requestContext?.http?.method?.toUpperCase() || "GET";
    const path =
      (event.requestContext?.http?.path || event.rawPath || "/").replace(/\/$/, "") || "/";

    if (method === "OPTIONS") {
      return handlePreflight();
    }

    // 1. Check exact match
    const exactKey = `${method} ${path}`;
    const exactHandler = this.exactRoutes.get(exactKey);
    if (exactHandler) {
      return exactHandler(event);
    }

    // 2. Check parameterized routes
    for (const route of this.compiledRoutes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (match) {
        const pathParameters: Record<string, string | undefined> = {
          ...(event.pathParameters || {}),
        };
        route.paramNames.forEach((name, index) => {
          pathParameters[name] = decodeURIComponent(match[index + 1]);
        });

        // Mutate or enrich event with extracted path parameters
        event.pathParameters = pathParameters;
        return route.handler(event);
      }
    }

    return notFound(`Uç nokta bulunamadı: ${method} ${path}`);
  }
}
