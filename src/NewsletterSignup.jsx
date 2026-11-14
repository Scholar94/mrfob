import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "./firebase.js";
import { useAuth } from "./AuthProvider.jsx";

export default function NewsletterSignup() {
  const { user, claims } = useAuth();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [subscribers, setSubscribers] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  async function subscribe(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (honeypot) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!consent) {
      setError("Please confirm that you agree to receive occasional company updates.");
      return;
    }
    if (!firebaseReady || !db) {
      setError("Newsletter sign-up is temporarily unavailable. Please contact us on WhatsApp.");
      return;
    }
    setBusy(true);
    try {
      if (!globalThis.crypto?.subtle) throw new Error("secure_hash_unavailable");
      const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizedEmail));
      const subscriberId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      await setDoc(doc(db, "newsletterSubscribers", subscriberId), {
        email: normalizedEmail,
        consent: true,
        status: "subscribed",
        source: "public_website",
        createdAt: serverTimestamp()
      });
      setEmail("");
      setConsent(false);
      setMessage("Thank you. Your email has been added to the MR FOP updates list.");
    } catch (err) {
      setError(err.code === "permission-denied"
        ? "We could not save your subscription. Please try again later."
        : "Your subscription could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSubscribers() {
    if (!claims.superAdmin || !db) return;
    setLoadingSubscribers(true);
    try {
      const snapshot = await getDocs(query(collection(db, "newsletterSubscribers")));
      setSubscribers(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch {
      setError("Newsletter subscriber records could not be loaded.");
    } finally {
      setLoadingSubscribers(false);
    }
  }

  function exportSubscribers() {
    const rows = [["Email", "Status", "Consent", "Created"]];
    subscribers.forEach(item => rows.push([
      item.email || "", item.status || "", item.consent ? "Yes" : "No",
      item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : ""
    ]));
    const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "MR-FOP-Newsletter-Subscribers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (claims.superAdmin) loadSubscribers();
  }, [claims.superAdmin]);

  return <section className="newsletter-section" id="newsletter">
    <div className="newsletter-copy">
      <p className="eyebrow"><i/> STAY CONNECTED</p>
      <h2>Fresh ideas. Thoughtful updates.</h2>
      <p>Receive occasional updates about new collections, bespoke services, training opportunities and company news. You can opt out at any time by contacting us.</p>
    </div>
    <form className="newsletter-form" onSubmit={subscribe}>
      <label htmlFor="newsletter-email">Email address</label>
      <div className="newsletter-input-row">
        <input id="newsletter-email" type="email" autoComplete="email" maxLength={254}
          placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required />
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Subscribe"}</button>
      </div>
      <label className="newsletter-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
        <span>I agree to receive occasional MR FOP FASHIONS updates by email.</span>
      </label>
      <label className="newsletter-honeypot" aria-hidden="true">Leave this field empty<input tabIndex="-1" autoComplete="off" value={honeypot} onChange={event => setHoneypot(event.target.value)} /></label>
      {message && <p className="newsletter-success" role="status">{message}</p>}
      {error && <p className="newsletter-error" role="alert">{error}</p>}
      <small>Your email is used for company updates and is not displayed publicly.</small>
    </form>
    {claims.superAdmin && <div className="newsletter-admin">
      <div><strong>Newsletter subscribers</strong><span>{subscribers.length} records</span></div>
      <button type="button" onClick={loadSubscribers} disabled={loadingSubscribers}>{loadingSubscribers ? "Refreshing…" : "Refresh list"}</button>
      <button type="button" onClick={exportSubscribers} disabled={!subscribers.length}>Export CSV</button>
      {subscribers.length > 0 && <ul>{subscribers.slice(0, 8).map(item => <li key={item.id}>{item.email} <small>{item.status || "subscribed"}</small></li>)}</ul>}
    </div>}
  </section>;
}
