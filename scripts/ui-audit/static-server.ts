/**
 * apps/web/out statik export'unu yerel olarak sunan minimal HTTP sunucusu.
 * next.config trailingSlash: true → "/about" isteği "/about/"a yönlendirilir, "/about/" → about/index.html.
 * Yalnızca 127.0.0.1'e bağlanır; kök dizin dışına çıkan yollar reddedilir.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
};

export async function serveStatic(
  rootDir: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(rootDir);
  if (!existsSync(join(root, "index.html"))) {
    throw new Error(
      `Statik export bulunamadı: ${root}/index.html — önce "npm run build" çalıştırın.`,
    );
  }

  const server: Server = createServer((req, res) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const target = normalize(join(root, pathname));
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }

    let file = target;
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!pathname.endsWith("/")) {
        res.writeHead(308, { Location: pathname + "/" }).end();
        return;
      }
      file = join(file, "index.html");
    } else if (!existsSync(file) && existsSync(`${file}.html`)) {
      file = `${file}.html`;
    }

    if (!existsSync(file) || !statSync(file).isFile()) {
      const notFound = join(root, "404.html");
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      if (existsSync(notFound)) createReadStream(notFound).pipe(res);
      else res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });

  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}
