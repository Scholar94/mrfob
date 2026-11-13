import React, { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export default function CertificateVerification() {
  const [reference, setReference] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(e) {
    e.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!/^MFO-CERT-[A-Z0-9]+$/.test(value)) {
      setError("Enter a valid MR FOP certificate reference.");
      setResult(null);
      return;
    }
    if (!db) {
      setError("Certificate verification is temporarily unavailable. Please contact the Institute.");
      return;
    }
    setBusy(true); setError(""); setResult(null);
    try {
      const snap = await getDoc(doc(db, "publicCertificateVerifications", value));
      if (!snap.exists()) {
        setError("No certificate record was found for that reference. Check the characters or contact the Institute.");
      } else {
        setResult({ id: snap.id, ...snap.data() });
      }
    } catch (e) {
      setError("We could not complete verification right now. Please try again later or contact the Institute.");
    } finally { setBusy(false); }
  }

  return <section className="certificate-verification section-pad" id="certificate-verification">
    <div className="certificate-verification-copy">
      <p className="eyebrow"><i/> FASHION INSTITUTE</p>
      <h2>Verify a <em>certificate.</em></h2>
      <p>Check whether a certificate reference has a matching record in the MR FOP FASHIONS Institute verification register.</p>
      <form onSubmit={verify} className="certificate-verification-form">
        <label htmlFor="certificate-reference">Certificate reference</label>
        <input id="certificate-reference" value={reference} onChange={e=>setReference(e.target.value)} placeholder="e.g. MFO-CERT-..." autoCapitalize="characters" maxLength={50} required/>
        <button type="submit" disabled={busy}>{busy?"Checking…":"Verify certificate"}</button>
      </form>
      {error&&<p className="certificate-verify-error" role="alert">{error}</p>}
      {result&&<div className={result.status==="issued"?"certificate-verify-result":"certificate-verify-result is-revoked"} role="status">
        <strong>{result.status==="issued"?"Record found — ISSUED":"Record found — REVOKED"}</strong>
        <dl><div><dt>Certificate reference</dt><dd>{result.certificateRef}</dd></div><div><dt>Student</dt><dd>{result.studentName}</dd></div><div><dt>Course</dt><dd>{result.courseTitle}</dd></div>{result.windowTitle&&<div><dt>Intake</dt><dd>{result.windowTitle}</dd></div>}<div><dt>Issue date</dt><dd>{result.issuedAt?.toDate?result.issuedAt.toDate().toLocaleDateString():"Recorded"}</dd></div>{result.status==="revoked"&&<div><dt>Revocation reason</dt><dd>{result.revocationReason||"Contact the Institute for details."}</dd></div>}</dl>
        <p>This result confirms the status in the online register at the time of checking. For formal confirmation, contact MR FOP FASHIONS directly.</p>
      </div>}
    </div>
  </section>;
}
