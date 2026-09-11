/** Each camera session delivers at most one code and owns every acquired track,
 * including a stream that resolves after the operator closes the scanner. */
export function startAttendanceCamera(video: HTMLVideoElement, deviceId: string, onCode: (code: string) => void,
    onDevices: (devices: MediaDeviceInfo[]) => void, onError: () => void) {
    let stopped = false, delivered = false, stream: MediaStream | undefined, controls: { stop: () => void } | undefined;
    const release = () => { controls?.stop(); stream?.getTracks().forEach(track => track.stop()); video.srcObject = null; };
    const stop = () => { stopped = true; release(); };
    const ready = (async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
            const { BrowserQRCodeReader } = await import("@zxing/browser");
            if (stopped) return;
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } } });
            if (stopped) { release(); return; }
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (stopped) { release(); return; }
            onDevices(devices.filter(device => device.kind === "videoinput"));
            controls = await new BrowserQRCodeReader().decodeFromStream(stream, video, result => {
                if (!result || stopped || delivered) return;
                delivered = true; release(); onCode(result.getText());
            });
            if (stopped || delivered) release();
        } catch { release(); if (!stopped) onError(); }
    })();
    return { stop, ready };
}
