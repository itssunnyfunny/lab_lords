import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require=createRequire(import.meta.url),vitestRequire=createRequire(require.resolve("vitest/package.json"));
const {createServer}=await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const server=await createServer({configFile:"tests/onboarding-browser/vite.config.ts",server:{host:"127.0.0.1",port:4197,strictPort:true}});
await server.listen();server.printUrls();
