import path from "node:path";
import existing from "../application-design-pilot/vite.config";

// Real navigation/language components; only Next, identity and APIs are synthetic.
const config = {
    ...existing,
    resolve: { ...existing.resolve, alias: [
        ...["next/navigation", "./next-navigation"].map(find => ({ find, replacement: path.resolve("tests/visual-consistency/navigation.ts") })),
        ...["OrganizationPreview", "store", "navigation", "transport"].map(module => ({ find: `./organization-preview/${module}`, replacement: path.resolve("tests/visual-consistency/preview-isolation.tsx") })),
        ...existing.resolve.alias.filter(alias => ![
        "@/components/layout/WorkspaceSwitcher", "@/components/settings/LanguageControls", "@/lib/applicationDesignPilot",
    ].includes(alias.find)).map(alias => alias.find === "@" ? { ...alias, replacement: path.resolve(".") } : alias)] },
    server: { host: "127.0.0.1", port: 4193, strictPort: true },
};

export default config;
