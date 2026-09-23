import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

// Compose already-rendered, real UI captures in a browser. This does not alter
// screenshot pixels or recreate the application with a mockup.
const directory = path.resolve("docs/redesign/dashboard-correction-evidence");
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 2928, height: 1100 } });
    async function compare(left, right, leftLabel, rightLabel, output) {
        const source = file => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
        await page.setContent(`<!doctype html><html><head><style>
            *{box-sizing:border-box}body{margin:0;padding:16px;background:#f6f7f3;color:#163d30;font:18px Arial,sans-serif}
            main{display:grid;grid-template-columns:1440px 1440px;gap:16px}h1{font-size:22px;margin:0 0 12px}
            figure{margin:0}figcaption{padding:12px 0}img{display:block;width:1440px;height:auto}
            </style></head><body><h1>Dashboard design review · local synthetic preview · approval pending</h1><main>
            <figure><figcaption>${leftLabel}</figcaption><img src="${source(left)}"></figure>
            <figure><figcaption>${rightLabel}</figcaption><img src="${source(right)}"></figure>
            </main></body></html>`);
        await page.locator("img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await page.screenshot({ path: path.join(directory, output), fullPage: true });
    }
    await compare(path.join(directory, "before-desktop.png"), path.join(directory, "desktop-1440/dashboard-en.png"),
        "Before correction · small library · 1440px", "After correction · same fixture and viewport", "before-after-desktop.png");
    if (process.argv[2]) await compare(path.resolve(process.argv[2]), path.join(directory, "desktop-1440/busy.png"),
        "Target reference · illustrative data; photo and quotes excluded from scope", "Corrected dashboard · coherent busy-library fixture · 1440px", "target-after-desktop.png");
} finally { await browser.close(); }
