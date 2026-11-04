import path from "node:path";
const config = {
    root: path.resolve("tests/import-browser"), publicDir: path.resolve("public"),
    resolve: { alias: [
        { find: "@clerk/nextjs", replacement: path.resolve("tests/onboarding-browser/clerk.tsx") },
        { find: "next/navigation", replacement: path.resolve("tests/onboarding-browser/navigation.ts") },
        { find: "next/link", replacement: path.resolve("tests/localization-browser/next-link.tsx") },
        { find: "next/image", replacement: path.resolve("tests/application-design-pilot/next-image.tsx") },
        { find: "@", replacement: path.resolve(".") },
    ] }, esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 4194, strictPort: true,
        proxy: { "/api": { target: process.env.IMPORT_FIXTURE_API, changeOrigin: false } } },
};

export default config;
