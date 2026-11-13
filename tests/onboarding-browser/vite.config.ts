import path from "node:path";
import { pilotFonts } from "../application-design-pilot/fonts";
import type { IncomingMessage, ServerResponse } from "node:http";
const config = {
    root: path.resolve("tests/onboarding-browser"), publicDir: path.resolve("public"),
    resolve: { alias: [
        { find: "@clerk/nextjs", replacement: path.resolve("tests/onboarding-browser/clerk.tsx") },
        { find: "next/navigation", replacement: path.resolve("tests/onboarding-browser/navigation.ts") },
        { find: "next/link", replacement: path.resolve("tests/localization-browser/next-link.tsx") },
        { find: "next/font/google", replacement: path.resolve("tests/application-design-pilot/next-font-google.ts") },
        { find: "next/image", replacement: path.resolve("tests/application-design-pilot/next-image.tsx") },
        { find: "@", replacement: path.resolve(".") },
    ] }, esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 4193, strictPort: true },
    plugins: [{ name: "onboarding-fixture-no-application-api", configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void) => void } }) {
        server.middlewares.use(pilotFonts());
        server.middlewares.use((request, response, next) => {
            if (!request.url?.startsWith("/api/")) { next(); return; }
            response.statusCode = 503;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: "No application API exists in the isolated component fixture." }));
        });
    } }],
};
export default config;
