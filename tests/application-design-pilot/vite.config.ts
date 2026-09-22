import path from "node:path";
import { createSyntheticApiMiddleware } from "./synthetic-api";

const root = path.resolve("tests/application-design-pilot");
const sourceRoot = process.env.PILOT_SOURCE_ROOT
    ? path.resolve(process.env.PILOT_SOURCE_ROOT)
    : path.resolve(".");

const config = {
    root,
    resolve: {
        alias: [
            { find: "@/lib/applicationDesignPilot", replacement: path.resolve(root, "pilot-design-mode.ts") },
            { find: "next/link", replacement: path.resolve(root, "next-link.tsx") },
            { find: "next/navigation", replacement: path.resolve(root, "next-navigation.ts") },
            { find: "next/script", replacement: path.resolve(root, "next-script.tsx") },
            { find: "next/font/google", replacement: path.resolve(root, "next-font-google.ts") },
            { find: "@clerk/nextjs", replacement: path.resolve(root, "clerk-nextjs.tsx") },
            { find: "@", replacement: sourceRoot },
        ],
    },
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 4187, strictPort: true },
    plugins: [{
        name: "lab-lords-synthetic-design-pilot",
        configureServer(server: { middlewares: { use: (middleware: ReturnType<typeof createSyntheticApiMiddleware>) => void } }) {
            // Register before Vite's HTML fallback so an unhandled API can never reach Next, a DB, or a provider.
            server.middlewares.use(createSyntheticApiMiddleware());
        },
    }],
};

export default config;
