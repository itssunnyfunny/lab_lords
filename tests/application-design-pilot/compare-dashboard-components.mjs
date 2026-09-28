import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import regions from "./dashboard-component-regions.json" with { type: "json" };

const targetPath = process.argv[2];
if (!targetPath) throw new Error("Pass the original target PNG path as the first argument.");

const output = path.resolve("docs/redesign/dashboard-component-evidence");
const reference = path.resolve(targetPath);
const targetWidth = 1491;
const targetHeight = 1055;
const displayScale = 1440 / targetWidth;

function readPng(file) {
    const bytes = fs.readFileSync(file);
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error(`Expected PNG: ${file}`);
    return {
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        source: `data:image/png;base64,${bytes.toString("base64")}`,
    };
}

const target = readPng(reference);
if (target.width !== targetWidth || target.height !== targetHeight) {
    throw new Error(`Use the original ${targetWidth} × ${targetHeight} target, got ${target.width} × ${target.height}`);
}
const geometry = JSON.parse(fs.readFileSync(path.join(output, "geometry.json"), "utf8"));
if (geometry.viewport?.width !== 1440 || geometry.pixelRatio !== 1 || geometry.zoom !== 1) {
    throw new Error("Render crops must come from a 1440px, 100% zoom browser capture.");
}
fs.mkdirSync(path.join(output, "target"), { recursive: true });
fs.mkdirSync(path.join(output, "pairs"), { recursive: true });

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await page.setContent(`<img id="original" src="${target.source}" alt="" style="display:none">`);
    const crops = new Map();
    for (const region of regions) {
        const { x, y, width, height } = region.target;
        if (x < 0 || y < 0 || x + width > targetWidth || y + height > targetHeight) {
            throw new Error(`Out-of-bounds target crop: ${region.key}`);
        }
        const crop = await page.evaluate(async ({ x, y, width, height }) => {
            const original = document.querySelector("#original");
            await original.decode();
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas context unavailable");
            context.drawImage(original, x, y, width, height, 0, 0, width, height);
            return canvas.toDataURL("image/png");
        }, region.target);
        crops.set(region.key, crop);
        fs.writeFileSync(path.join(output, "target", `${region.key}.png`), Buffer.from(crop.split(",")[1], "base64"));
    }

    const comparison = [];
    for (const region of regions) {
        const render = readPng(path.join(output, "render", `${region.key}.png`));
        const measured = geometry.regions.find(item => item.key === region.key);
        if (!measured || Math.abs(measured.viewport.width - render.width) > 2 || Math.abs(measured.viewport.height - render.height) > 2) {
            throw new Error(`Rendered crop does not match browser geometry: ${region.key}`);
        }
        const displayWidth = Math.round(region.target.width * displayScale);
        const displayHeight = Math.round(region.target.height * displayScale);
        const pageWidth = displayWidth + render.width + 48;
        const pageHeight = Math.max(displayHeight, render.height) + 90;
        await page.setViewportSize({ width: pageWidth, height: pageHeight });
        await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
            *{box-sizing:border-box}body{margin:0;padding:12px;background:#f4f6f2;color:#173f30;font:13px/1.35 Arial,sans-serif}
            h1{font-size:16px;margin:0 0 4px}p{margin:0 0 10px;color:#50635a}
            main{display:grid;grid-template-columns:${displayWidth}px ${render.width}px;gap:24px;align-items:start}
            figure{margin:0;min-width:0}figcaption{height:27px;font-size:12px;font-weight:700}
            img{display:block;height:auto;outline:1px solid #ccd9d0}
            .reference{width:${displayWidth}px}.render{width:${render.width}px}
        </style></head><body>
            <h1>${region.key} · original target / current browser render</h1>
            <p>Target crop taken at native 1491 × 1055 coordinates, uniformly displayed at ${displayScale.toFixed(6)}×; browser crop is 1 CSS pixel to 1 image pixel. Illustrative and synthetic values differ.</p>
            <main><figure><figcaption>Original reference</figcaption><img class="reference" src="${crops.get(region.key)}" alt=""></figure>
            <figure><figcaption>Current pilot</figcaption><img class="render" src="${render.source}" alt=""></figure></main>
        </body></html>`);
        await page.locator("img").evaluateAll(async images => Promise.all(images.map(image => image.decode())));
        await page.screenshot({ path: path.join(output, "pairs", `${region.key}.png`), fullPage: true });
        comparison.push({
            key: region.key,
            originalTargetCrop: region.target,
            targetDisplayed: { width: displayWidth, height: displayHeight },
            actualRender: { width: render.width, height: render.height },
            appPositionWithoutRibbon: measured.app,
        });
    }
    fs.writeFileSync(path.join(output, "comparison.json"), JSON.stringify({
        originalTarget: { width: targetWidth, height: targetHeight },
        browserWidth: 1440,
        targetDisplayScale: displayScale,
        syntheticRibbonHeight: geometry.syntheticRibbonHeight,
        regions: comparison,
    }, null, 2));
} finally {
    await browser.close();
}
