import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { BrowserQRCodeReader } from "@zxing/browser";
describe("attendance QR generation and software decoding", () => {
    it("round-trips an opaque identifier through actual generation and ZXing decoding", async () => {
        const code = "19d8dc40-25f4-4c52-8baa-b6e28b08b3ef", modules = QRCode.create(code, { errorCorrectionLevel: "M" }).modules;
        const scale = 6, margin = 4, width = (modules.size + margin * 2) * scale;
        const data = new Uint8ClampedArray(width * width * 4).fill(255);
        for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
            const row = Math.floor(y / scale) - margin, col = Math.floor(x / scale) - margin;
            if (row >= 0 && col >= 0 && row < modules.size && col < modules.size && modules.get(row, col)) {
                const offset = (y * width + x) * 4; data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0;
            }
        }
        // In-memory canvas pixels, actual QR algorithms; no camera or native BarcodeDetector.
        const canvas = { width, height: width, getContext: () => ({ getImageData: () => ({ data }) }) } as unknown as HTMLCanvasElement;
        expect(new BrowserQRCodeReader().decodeFromCanvas(canvas).getText()).toBe(code);
        expect(await QRCode.toDataURL(code)).toMatch(/^data:image\/png;base64,/);
    });
});
