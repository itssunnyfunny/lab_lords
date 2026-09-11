import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const decoder = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }));
vi.mock("@zxing/browser", () => ({ BrowserQRCodeReader: class { decodeFromStream = decoder.decode; } }));
import { startAttendanceCamera } from "@/lib/attendanceCamera";
describe("attendance camera lifecycle (mock media and decoder)", () => {
    const track = { stop: vi.fn() }, stream = { getTracks: () => [track] } as unknown as MediaStream;
    const media = { getUserMedia: vi.fn(), enumerateDevices: vi.fn() };
    beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("navigator", { mediaDevices: media }); media.getUserMedia.mockResolvedValue(stream); media.enumerateDevices.mockResolvedValue([{ kind: "videoinput", deviceId: "rear" }]); decoder.decode.mockResolvedValue({ stop: decoder.stop }); });
    afterEach(() => vi.unstubAllGlobals());
    it("prefers rear camera, debounces callbacks and releases camera after the first result", async () => {
        const onCode = vi.fn(), onError = vi.fn(), devices = vi.fn();
        const session = startAttendanceCamera({ srcObject: null } as HTMLVideoElement, "", onCode, devices, onError);
        await session.ready;
        expect(media.getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: { ideal: "environment" } } });
        const callback = decoder.decode.mock.calls[0][2];
        callback({ getText: () => "opaque" }); callback({ getText: () => "opaque" }); callback({ getText: () => "another" });
        expect(onCode).toHaveBeenCalledTimes(1); expect(track.stop).toHaveBeenCalled(); expect(decoder.stop).toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
        session.stop();
    });
    it("stops a late stream if closed during the camera permission prompt", async () => {
        let resolve!: (stream: MediaStream) => void;
        media.getUserMedia.mockImplementation(() => new Promise<MediaStream>(r => { resolve = r; }));
        const session = startAttendanceCamera({ srcObject: null } as HTMLVideoElement, "rear", vi.fn(), vi.fn(), vi.fn());
        await vi.waitFor(() => expect(media.getUserMedia).toHaveBeenCalled());
        session.stop(); resolve(stream); await session.ready;
        expect(track.stop).toHaveBeenCalled(); expect(decoder.decode).not.toHaveBeenCalled();
    });
    it("reports denied/unavailable camera without submitting an action", async () => {
        media.getUserMedia.mockRejectedValue(new Error("denied"));
        const code = vi.fn(), error = vi.fn();
        const session = startAttendanceCamera({ srcObject: null } as HTMLVideoElement, "", code, vi.fn(), error);
        await session.ready; expect(error).toHaveBeenCalledTimes(1); expect(code).not.toHaveBeenCalled(); session.stop();
    });
    it("switches to the selected device and releases tracks on teardown", async () => {
        const session = startAttendanceCamera({ srcObject: null } as HTMLVideoElement, "front", vi.fn(), vi.fn(), vi.fn());
        await session.ready; expect(media.getUserMedia).toHaveBeenCalledWith({ audio: false, video: { deviceId: { exact: "front" } } });
        session.stop(); expect(track.stop).toHaveBeenCalled();
    });
});
