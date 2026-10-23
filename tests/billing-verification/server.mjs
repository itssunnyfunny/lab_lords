import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const server = await createServer({
  configFile: "tests/application-design-pilot/vite.config.ts",
  cacheDir: path.resolve(".next/billing-browser-vite"),
  server: { host: "127.0.0.1", port: 4189, strictPort: true },
});
await server.listen();
server.printUrls();
