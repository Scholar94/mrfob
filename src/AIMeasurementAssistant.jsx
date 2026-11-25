import React, { useEffect, useRef, useState } from "react";

const VISION_VERSION = "0.10.14";
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + VISION_VERSION + "/wasm";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
let poseLandmarkerPromise;

function loadPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const vision = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
      return vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" },
        runningMode: "IMAGE",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
    })().catch(error => {
      poseLandmarkerPromise = null;
      throw error;
    });
  }
  return poseLandmarkerPromise;
}

const distance = (a, b, width, height) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function AIMeasurementAssistant({ onApplyEstimates, garmentType = "selected garment" }) {
  const [consent, setConsent] = useState(false);
  const [height, setHeight] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [estimates, setEstimates] = useState(null);
  const [quality, setQuality] = useState("");
  const inputRef = useRef(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setPhoto(null);
    setEstimates(null);
    setQuality("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function choosePhoto(event) {
    const selected = event.target.files?.[0];
    setError("");
    setStatus("");
    setEstimates(null);
    setQuality("");
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Choose a JPG, PNG or WebP photograph.");
      event.target.value = "";
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      setError("Choose an image smaller than 8 MB.");
      event.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function analysePhoto() {
    if (!consent) {
      setError("Please read and accept the private, on-device processing notice first.");
      return;
    }
    const heightCm = Number(height);
    if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230) {
      setError("Enter your height in centimetres (120–230 cm).");
      return;
    }
    if (!photo || !preview) {
      setError("Choose a clear, full-length front-view photograph.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Loading the on-device pose model…");
    setEstimates(null);
    let landmarker;
    try {
      const image = new Image();
      image.src = preview;
      await image.decode();
      if (image.naturalWidth < 480 || image.naturalHeight < 640) {
        throw new Error("The photo is too small. Use a clear image at least 480 × 640 pixels.");
      }
      landmarker = await loadPoseLandmarker();
      setStatus("Analysing body pose locally on this device…");
      const result = landmarker.detect(image);
      const points = result.poseLandmarks?.[0];
      if (!points || points.length < 29) {
        throw new Error("A complete body pose was not detected. Retake the photo with your head, arms and feet visible.");
      }
      const ids = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      const minimumVisibility = Math.min(...ids.map(index => Number(points[index].visibility ?? 0)));
      if (minimumVisibility < 0.45) {
        throw new Error("Some body landmarks are hidden or unclear. Improve the lighting and keep both arms and legs visible.");
      }
      const [nose, ls, rs, le, re, lw, rw, lh, rh, lk, rk, la, ra] = ids.map(index => points[index]);
      const shoulderCentre = midpoint(ls, rs);
      const hipCentre = midpoint(lh, rh);
      const ankleCentre = midpoint(la, ra);
      const shoulderSpanPx = distance(ls, rs, image.naturalWidth, image.naturalHeight);
      const noseToAnklePx = distance(nose, ankleCentre, image.naturalWidth, image.naturalHeight);
      if (shoulderSpanPx < 25 || noseToAnklePx < 200) {
        throw new Error("The detected pose is too small in the image. Move the camera farther back and include the full body.");
      }
      const shoulderTilt = Math.abs(ls.y - rs.y) * image.naturalHeight;
      const hipTilt = Math.abs(lh.y - rh.y) * image.naturalHeight;
      if (shoulderTilt > shoulderSpanPx * 0.45 || hipTilt > shoulderSpanPx * 0.55) {
        throw new Error("The pose is too tilted for a useful estimate. Stand upright, face the camera and retake the photo.");
      }

      // Pose landmarks do not include the crown of the head. The 0.88 factor
      // is an approximate calibration, not a validated anthropometric model.
      const cmPerPixel = (heightCm * 0.88) / noseToAnklePx;
      const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
      const sleevePx = average([
        distance(ls, le, image.naturalWidth, image.naturalHeight) + distance(le, lw, image.naturalWidth, image.naturalHeight),
        distance(rs, re, image.naturalWidth, image.naturalHeight) + distance(re, rw, image.naturalWidth, image.naturalHeight)
      ]);
      const outseamPx = average([
        distance(lh, lk, image.naturalWidth, image.naturalHeight) + distance(lk, la, image.naturalWidth, image.naturalHeight),
        distance(rh, rk, image.naturalWidth, image.naturalHeight) + distance(rk, ra, image.naturalWidth, image.naturalHeight)
      ]);
      const torsoPx = distance(shoulderCentre, hipCentre, image.naturalWidth, image.naturalHeight);
      const round = value => Number((value * cmPerPixel).toFixed(1));
      const next = {
        shoulder: round(shoulderSpanPx),
        sleeve: round(sleevePx),
        outseam: round(outseamPx)
      };
      if (Object.values(next).some(value => !Number.isFinite(value) || value < 5 || value > 180)) {
        throw new Error("The resulting estimates are outside a sensible range. Retake the photo with the camera level and your full body visible.");
      }
      setEstimates(next);
      setQuality(minimumVisibility >= 0.72 ? "Clear pose detected" : "Pose detected — check carefully");
      setStatus("Analysis complete. These are approximate pose-based estimates, not tape measurements.");
    } catch (err) {
      setError(err.message || "The pose analysis could not be completed. Please try another photograph.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function applyEstimates() {
    if (!estimates || typeof onApplyEstimates !== "function") return;
    onApplyEstimates(estimates);
    setStatus("Estimates copied into the manual measurement form as unverified draft values. Confirm each one with a tape measure.");
  }

  return <section className="ai-measurement-module" aria-labelledby="ai-measurement-title">
    <div className="ai-measurement-heading">
      <span className="ai-measurement-kicker">On-device AI fitting support</span>
      <span className="ai-measurement-status">Preview · estimates only</span>
    </div>
    <h3 id="ai-measurement-title">AI Body Measurement Assistant</h3>
    <p className="ai-measurement-intro">Use a full-length front photo and your height to detect body landmarks. The pose model runs in your browser. It can estimate a few visible lengths and spans; it cannot reliably measure body circumference.</p>

    <div className="ai-measurement-privacy">
      <strong>Privacy first — your photograph stays on this device</strong>
      <p>The selected photo is processed locally in your browser. It is not uploaded to MR FOP, Firebase or Google Drive, and it is not saved to your account. Clearing this panel removes the local preview. The AI model files are downloaded from public model/CDN hosts when first used.</p>
      <label className="ai-measurement-consent"><input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); setError(""); }}/> I understand and consent to on-device analysis of the photo I select.</label>
    </div>

    <div className="ai-measurement-instructions">
      <strong>Before taking your photo</strong>
      <ol>
        <li>Wear close-fitting clothing and stand naturally, facing the camera.</li>
        <li>Keep your head, both shoulders, hands, legs and feet visible.</li>
        <li>Stand upright with a little space between your arms and body.</li>
        <li>Use bright, even lighting and place the camera level, several steps away.</li>
        <li>Enter your height accurately. Perspective, posture and clothing can affect results.</li>
      </ol>
    </div>

    <div className="ai-measurement-inputs">
      <label>Your height (cm)<input type="number" min="120" max="230" step="0.1" value={height} onChange={event => setHeight(event.target.value)} placeholder="e.g. 172.5"/></label>
      <label>Full-length front photograph<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={!consent}/></label>
    </div>
    {preview && <div className="ai-measurement-preview"><img src={preview} alt="Your selected photo for local pose analysis"/><button type="button" onClick={clearPhoto}>Clear photo</button></div>}
    <div className="ai-measurement-actions">
      <button type="button" className="ai-measurement-primary" onClick={analysePhoto} disabled={busy || !photo || !consent}>{busy ? "Analysing…" : "Analyse pose on this device"}</button>
      {photo && <button type="button" onClick={clearPhoto} disabled={busy}>Remove photo</button>}
    </div>
    {error && <p className="ai-measurement-error" role="alert">{error}</p>}
    {status && <p className="ai-measurement-status-message" role="status">{status}</p>}
    {estimates && <div className="ai-measurement-results">
      <div className="ai-measurement-results-heading"><strong>AI-assisted estimates</strong><span>{quality}</span></div>
      <p>For: {garmentType}. All values are approximate centimetres and must be checked with a flexible tape.</p>
      <dl>
        <div><dt>Shoulder span</dt><dd>{estimates.shoulder} cm</dd></div>
        <div><dt>Sleeve path (both arms averaged)</dt><dd>{estimates.sleeve} cm</dd></div>
        <div><dt>Hip-to-ankle leg path</dt><dd>{estimates.outseam} cm</dd></div>
      </dl>
      <button type="button" className="ai-measurement-primary" onClick={applyEstimates}>Copy estimates to manual form</button>
      <small>Copying does not save or verify measurements. Review every value and replace estimates with tape-measured values before requesting production.</small>
    </div>}
    <div className="ai-measurement-limits">
      <strong>What this assistant cannot measure</strong>
      <p>Chest, bust, waist, hip, neck, arm, thigh and other circumferences are not measured. The photo is two-dimensional, and the height calibration is approximate. Do not use these estimates for cutting, sewing or final garment production without a professional tape measurement and designer verification.</p>
    </div>
  </section>;
}
