import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

/** Reuse Next's actual self-hosted font files. Never claim a shim is font evidence. */
export function pilotFonts() {
    const root = path.resolve(".next/static");
    const chunks = path.join(root, "chunks");
    const faces = readdirSync(chunks).filter(file => file.endsWith(".css"))
        .flatMap(file => readFileSync(path.join(chunks, file), "utf8").match(/@font-face\{[^}]+\}/g) ?? [])
        .filter(face => /src:url/.test(face) && !/Fallback|fallback/.test(face));
    const assets = new Map<string, Buffer>();
    const css = faces.map(face => face.replace(/url\((?:\.\.\/media\/|\/[_]next\/static\/media\/)([^)]+)\)/g, (_, file: string) => {
        if (!/^[\w.~\-]+\.woff2$/.test(file)) throw new Error("Unexpected build font filename");
        assets.set(`/pilot-fonts/${file}`, readFileSync(path.join(root, "media", file)));
        return `url(/pilot-fonts/${file})`;
    })).join("\n");
    for (const family of ["Inter", "Playfair Display", "Noto Sans Devanagari"]) {
        if (!css.includes(`font-family:${family};`)) throw new Error(`Missing ${family}: run pnpm build before the synthetic preview.`);
    }
    const variables = `body { --font-inter: 'Inter'; --font-manrope: 'Manrope'; --font-geist-mono: 'Geist Mono'; --font-devanagari: 'Noto Sans Devanagari'; }
        .pilot-public-display-font { --font-public-display: 'Playfair Display'; }`;
    return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
        if (request.url === "/pilot-fonts.css") {
            response.setHeader("Content-Type", "text/css"); response.end(css + variables); return;
        }
        const font = assets.get(request.url ?? "");
        if (font) { response.setHeader("Content-Type", "font/woff2"); response.end(font); return; }
        next();
    };
}
