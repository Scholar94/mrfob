import React, { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, where, doc } from "firebase/firestore";
import { db } from "./firebase.js";

const REQUEST_TYPES = [
  ["access", "Request a copy of my personal data"],
  ["correction", "Request correction of my personal data"],
  ["deletion", "Request deletion of my personal data"]
];
const REQUEST_STATUSES = ["received", "reviewing", "completed", "unable_to_fulfil"];

export default function PrivacyRequestCenter({ user, claims }) {
  const [items, setItems] = useState([]);
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [staffNotes, setStaffNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isAdmin = !!claims?.superAdmin;

  async function refresh() {
    if (!user || !db) return;
    setLoading(true);
    setError("");
    try {
      const source = isAdmin
        ? collection(db, "privacyRequests")
        : query(collection(db, "privacyRequests"), where("customerUid", "==", user.uid));
      const snapshot = await getDocs(source);
      setItems(snapshot.docs.map(row => ({ id: row.id, ...row.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      setError(err.message || "Could not load privacy requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [user?.uid, isAdmin]);

  async function submit(event) {
    event.preventDefault();
    if (!user || isAdmin) return;
    const cleanDetails = details.trim();
    if (cleanDetails.length < 10 || cleanDetails.length > 1500) {
      setError("Please describe your request in 10 to 1,500 characters.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await addDoc(collection(db, "privacyRequests"), {
        customerUid: user.uid,
        customerEmail: user.email || "",
        requestType,
        details: cleanDetails,
        status: "received",
        staffNote: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setDetails("");
      setNotice("Your privacy request has been recorded. The company will review it and update its status here. Submitting a request does not immediately delete account data.");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not submit your privacy request.");
    } finally {
      setBusy(false);
    }
  }

  async function updateRequest(item, status) {
    if (!isAdmin || !item?.id || !REQUEST_STATUSES.includes(status)) return;
    const staffNote = String(staffNotes[item.id] ?? item.staffNote ?? "").trim();
    if (staffNote.length > 1500) { setError("The staff note must be 1,500 characters or fewer."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "privacyRequests", item.id), {
        status,
        staffNote,
        reviewedBy: user.uid,
        updatedAt: serverTimestamp()
      });
      setItems(current => current.map(row => row.id === item.id ? { ...row, status, staffNote } : row));
      setNotice("Privacy request status updated.");
    } catch (err) {
      setError(err.message || "Could not update the privacy request.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="privacy-request-center customer-management">
    <div className="customer-management-heading">
      <div><h3>{isAdmin ? "Customer privacy requests" : "Privacy and personal-data requests"}</h3>
        <p>{isAdmin ? "Review access, correction and deletion requests. Record the outcome after checking all relevant systems." : "Ask MR FOP FASHIONS to provide, correct or delete personal information associated with your account."}</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading || busy}>{loading ? "Loading…" : "Refresh requests"}</button>
    </div>
    {!isAdmin && <form className="portal-form privacy-request-form" onSubmit={submit}>
      <label>Request type<select value={requestType} onChange={event => setRequestType(event.target.value)}>{REQUEST_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Details<textarea required minLength={10} maxLength={1500} rows={4} value={details} onChange={event => setDetails(event.target.value)} placeholder="Tell us which records or corrections your request concerns. Do not include passwords or bank PINs."/></label>
      <p className="portal-hint">A deletion request is reviewed before action. Some records may need to be retained for legal, accounting or security reasons, and copies in Google Drive or other systems must be reviewed separately.</p>
      <button className="portal-submit" disabled={busy}>{busy ? "Submitting…" : "Submit privacy request"}</button>
    </form>}
    {error && <p className="portal-error" role="alert">{error}</p>}
    {notice && <p className="portal-success" role="status">{notice}</p>}
    {loading ? <p className="staff-empty">Loading privacy requests…</p> : items.length ? <div className="privacy-request-list">
      {items.map(item => <article className="privacy-request-card" key={item.id}>
        <div className="privacy-request-card-top"><strong>{REQUEST_TYPES.find(([value]) => value === item.requestType)?.[1] || "Privacy request"}</strong><span className={"privacy-request-status status-" + String(item.status || "received").replaceAll("_", "-")}>{String(item.status || "received").replaceAll("_", " ")}</span></div>
        {isAdmin && <small>{item.customerEmail || item.customerUid} · {item.customerUid}</small>}
        <p>{item.details}</p>
        <small>Submitted: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("en-NG") : "Just now"}</small>
        {item.staffNote && <p className="privacy-request-note"><strong>Company response:</strong> {item.staffNote}</p>}
        {isAdmin && <div className="privacy-request-admin">
          <label>Staff response<textarea rows={2} maxLength={1500} value={staffNotes[item.id] ?? item.staffNote ?? ""} onChange={event => setStaffNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Explain the review outcome or next step"/></label>
          <label>Request status<select value={item.status || "received"} onChange={event => updateRequest(item, event.target.value)} disabled={busy}>{REQUEST_STATUSES.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        </div>}
      </article>)}
    </div> : <p className="staff-empty">{isAdmin ? "There are no privacy requests to review." : "You have not submitted a privacy request."}</p>}
  </section>;
}
