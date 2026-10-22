/**
 * Live selfie capture for AML/KYC — uses getUserMedia when available,
 * with a file-input fallback for environments without camera permission.
 */
import { useEffect, useRef, useState } from "react";

export default function LivePhotoCapture({ onCapture, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setErr("Camera access was blocked. You can upload a live selfie photo instead.");
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setErr("Could not capture photo");
        const file = new File([blob], `aml-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreview(URL.createObjectURL(blob));
        stop();
        onCapture?.(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onCapture?.(file);
  };

  return (
    <div className="space-y-3" data-testid="aml-live-photo">
      {!preview && (
        <div className="rounded-xl border border-[#E3E7E4] bg-[#0B1A12] overflow-hidden aspect-video flex items-center justify-center relative">
          <video ref={videoRef} playsInline muted className={`max-h-full ${cameraOn ? "block" : "hidden"}`} />
          {!cameraOn && (
            <p className="text-sm text-white/80 px-6 text-center">
              Start your camera to take a live photo for identity verification.
            </p>
          )}
        </div>
      )}
      {preview && (
        <img src={preview} alt="Captured selfie" className="rounded-xl border border-[#E3E7E4] max-h-72 mx-auto" />
      )}
      <div className="flex flex-wrap gap-2">
        {!cameraOn && !preview && (
          <button
            type="button"
            data-testid="aml-camera-start"
            disabled={disabled}
            onClick={start}
            className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-sm font-semibold disabled:opacity-50"
          >
            Start camera
          </button>
        )}
        {cameraOn && (
          <button
            type="button"
            data-testid="aml-camera-snap"
            disabled={disabled}
            onClick={snap}
            className="px-4 py-2 rounded-lg bg-[#078A4B] text-white text-sm font-semibold"
          >
            Capture photo
          </button>
        )}
        {(preview || cameraOn) && (
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-sm font-semibold"
            onClick={() => {
              setPreview(null);
              stop();
            }}
          >
            Retake
          </button>
        )}
        <label className="px-4 py-2 rounded-lg border border-[#E3E7E4] text-sm font-semibold cursor-pointer">
          Upload selfie instead
          <input
            data-testid="aml-selfie-file"
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            disabled={disabled}
            onChange={onFile}
          />
        </label>
      </div>
      {err && <p className="text-sm text-[#B77A12]">{err}</p>}
    </div>
  );
}
