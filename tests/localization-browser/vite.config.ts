import path from "node:path";
const config = {
    root: path.resolve("tests/localization-browser"),
    resolve: { alias: { "@": path.resolve("."), "next/link": path.resolve("tests/localization-browser/next-link.tsx") } },
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 4179, strictPort: true },
};
export default config;
