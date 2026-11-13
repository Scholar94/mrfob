import React from "react";

export default function AIMeasurementAssistant() {
  return <section className="ai-measurement-module" aria-labelledby="ai-measurement-title">
    <div className="ai-measurement-heading">
      <span className="ai-measurement-kicker">Optional smart fitting feature</span>
      <span className="ai-measurement-status">Future integration</span>
    </div>
    <h3 id="ai-measurement-title">AI Body Measurement Assistant</h3>
    <p className="ai-measurement-intro">Photo-based measurement analysis is not enabled in this release. MR FOP will not ask you to upload body photographs or present invented AI measurements.</p>
    <div className="ai-measurement-notice" role="status">
      <strong><span aria-hidden="true">ⓘ</span> Manual measurement is available now</strong>
      <p>Use the garment-specific measurement form below, request an in-person fitting, or ask an MR FOP designer to record your measurements. A designer must verify measurements before production.</p>
      <a href="#measurement-manual-entry">Go to manual measurement form</a>
    </div>
    <div className="ai-measurement-roadmap">
      <strong>What a future free-tier integration must support</strong>
      <ol>
        <li>Choose a body profile and garment, enter height, and read clear front- and side-photo instructions.</li>
        <li>Give explicit consent before any image processing; keep images private and provide a deletion request route.</li>
        <li>Only if a reliable no-cost model becomes available, show clearly labelled estimates, calibration details and confidence information where supported.</li>
        <li>Flag unsuitable photographs for retakes and never approve estimated values for cutting or production.</li>
        <li>Allow a qualified designer to edit, measure and professionally verify the final profile.</li>
      </ol>
    </div>
    <p className="ai-measurement-footnote">No photographs are requested, uploaded, analysed or stored by this placeholder. It does not perform computer vision and does not generate measurement estimates.</p>
  </section>;
}
