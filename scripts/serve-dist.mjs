import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname === "/" ? "/browser/index.html" : url.pathname);
  const target = resolve(root, "." + normalize(pathname));
  if (!target.startsWith(root)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = readFileSync(target);
    response.writeHead(200, {
      "content-type": types[extname(target)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log(`browser test server: http://127.0.0.1:${port}`);
});
