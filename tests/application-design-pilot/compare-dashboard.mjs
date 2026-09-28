import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

// Compose actual browser captures and the supplied reference at one displayed
// dashboard width. Images are scaled uniformly by the browser; no pixels are
// cropped, stretched independently, or redrawn as a mockup.
const desktopWidth = 1440;
const defaultDirectory = path.resolve("docs/redesign/dashboard-correction-evidence");
const argumentsList = process.argv.slice(2);
const options = {};
const allowedOptions = new Set(["target", "current", "before", "after", "output-dir", "ribbon-px"]);

for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) {
        if (options.target) throw new Error(`Unexpected positional argument: ${argument}`);
        options.target = argument; // Preserve the original positional target path.
        continue;
    }
    const name = argument.slice(2);
    if (!allowedOptions.has(name)) throw new Error(`Unknown option: ${argument}`);
    const value = argumentsList[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    options[name] = value;
}

const directory = path.resolve(options["output-dir"] ?? defaultDirectory);
const before = path.resolve(options.before ?? path.join(defaultDirectory, "before-desktop.png"));
const after = path.resolve(options.after ?? path.join(defaultDirectory, "desktop-1440/dashboard-en.png"));
const current = path.resolve(options.current ?? path.join(defaultDirectory, "desktop-1440/busy.png"));
const target = options.target ? path.resolve(options.target) : null;
const ribbonPixels = Number(options["ribbon-px"] ?? 21);
if (!Number.isInteger(ribbonPixels) || ribbonPixels < 0 || ribbonPixels > 100) {
    throw new Error("--ribbon-px must be an integer between 0 and 100");
}

function readPng(file) {
    const bytes = fs.readFileSync(file);
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        || bytes.toString("ascii", 12, 16) !== "IHDR") {
        throw new Error(`Expected a PNG image: ${file}`);
    }
    return {
        source: `data:image/png;base64,${bytes.toString("base64")}`,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
    };
}

function browserCapture(file) {
    const png = readPng(file);
    if (png.width !== desktopWidth) {
        throw new Error(`Expected a ${desktopWidth}px-wide desktop browser capture, got ${png.width}px: ${file}`);
    }
    return png;
}

const beforeImage = browserCapture(before);
const afterImage = browserCapture(after);
const currentImage = target ? browserCapture(current) : null;
const targetImage = target ? readPng(target) : null;
fs.mkdirSync(directory, { recursive: true });

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 2928, height: 1100 }, deviceScaleFactor: 1 });

    async function compare({ left, right, leftLabel, rightLabel, leftNote, rightNote, offset = 0, output }) {
        await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
            *{box-sizing:border-box}body{margin:0;padding:16px;background:#f6f7f3;color:#163d30;font:16px/1.35 Arial,sans-serif}
            h1{font-size:21px;margin:0 0 8px}p{margin:0 0 14px;color:#455b52}
            main{display:grid;grid-template-columns:1440px 1440px;gap:16px}
            figure{margin:0;min-width:0}figcaption{min-height:60px;padding:8px 0 10px}
            strong,small{display:block}strong{font-size:17px}small{color:#455b52;font-size:13px}
            .ribbon-offset{height:${offset}px;border:0;position:relative}
            img{display:block;width:${desktopWidth}px;height:auto;outline:1px solid #dce4df}
            </style></head><body>
            <h1>Dashboard design comparison</h1>
            <p>Equal displayed dashboard width: ${desktopWidth}px. Original image proportions preserved.</p>
            <main>
              <figure><figcaption><strong>${leftLabel}</strong><small>${leftNote}</small></figcaption>
                <div class="ribbon-offset"></div><img src="${left.source}" alt="${leftLabel}"></figure>
              <figure><figcaption><strong>${rightLabel}</strong><small>${rightNote}</small></figcaption>
                <img src="${right.source}" alt="${rightLabel}"></figure>
            </main></body></html>`);

        const rendered = await page.locator("img").evaluateAll(async (images) => {
            await Promise.all(images.map((image) => image.decode()));
            return images.map((image) => ({
                width: image.getBoundingClientRect().width,
                height: image.getBoundingClientRect().height,
            }));
        });
        for (const [index, source] of [left, right].entries()) {
            const expectedHeight = source.height * desktopWidth / source.width;
            if (rendered[index].width !== desktopWidth || Math.abs(rendered[index].height - expectedHeight) > 1) {
                throw new Error(`Image ${index + 1} was not rendered proportionally at ${desktopWidth}px`);
            }
        }
        await page.screenshot({ path: path.join(directory, output), fullPage: true });
    }

    await compare({
        left: beforeImage,
        right: afterImage,
        leftLabel: "Before correction · small-library fixture",
        rightLabel: "Current correction · same small-library fixture",
        leftNote: `Browser capture ${beforeImage.width} × ${beforeImage.height}px; synthetic ribbon included.`,
        rightNote: `Browser capture ${afterImage.width} × ${afterImage.height}px; synthetic ribbon included.`,
        output: "before-after-desktop.png",
    });

    if (targetImage && currentImage) {
        await compare({
            left: targetImage,
            right: currentImage,
            leftLabel: "Supplied target reference · illustrative data",
            rightLabel: "Current browser render · populated fixture",
            leftNote: `Original ${targetImage.width} × ${targetImage.height}px; proportionally scaled to ${desktopWidth}px. ${ribbonPixels}px spacer aligns app tops.`,
            rightNote: `Capture ${currentImage.width} × ${currentImage.height}px; synthetic preview ribbon included.`,
            offset: ribbonPixels,
            output: "target-current-desktop.png",
        });
    }
} finally {
    await browser.close();
}
