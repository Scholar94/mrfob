import React, { useEffect, useState } from "react";
import { addDoc, collection, getDoc, getDocs, query, serverTimestamp, updateDoc, where, doc } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";

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
  const [exporting, setExporting] = useState(false);
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

  async function exportPersonalData() {
    if (!user || isAdmin || exporting) return;
    setExporting(true); setError(""); setNotice("");
    const bundle = {
      format: "MR FOP FASHIONS personal data export",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { uid: user.uid, email: user.email || "", displayName: user.displayName || "" },
      data: {},
      omissions: []
    };
    async function readOwnedCollection(key, collectionName, ownerField = "customerUid") {
      try {
        const snapshot = await getDocs(query(collection(db, collectionName), where(ownerField, "==", user.uid)));
        bundle.data[key] = snapshot.docs.map(row => ({ id: row.id, ...row.data() }));
      } catch (err) {
        bundle.data[key] = [];
        bundle.omissions.push({ collection: collectionName, reason: "This dataset could not be retrieved with the current account permissions." });
      }
    }
    try {
      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        bundle.data.profile = profile.exists() ? { id: profile.id, ...profile.data() } : null;
      } catch {
        bundle.data.profile = null;
        bundle.omissions.push({ collection: "users", reason: "Profile record could not be retrieved." });
      }
      const collections = [
        ["orders", "orders", "customerUid"],
        ["appointments", "appointments", "customerUid"],
        ["measurements", "measurements", "customerUid"],
        ["paymentDeclarations", "paymentDeclarations", "customerUid"],
        ["payments", "payments", "customerUid"],
        ["refunds", "refunds", "customerUid"],
        ["notifications", "notifications", "customerUid"],
        ["supportTickets", "supportTickets", "customerUid"],
        ["reviews", "reviews", "customerUid"],
        ["trainingEnquiries", "trainingEnquiries", "customerUid"],
        ["corporateRequests", "corporateRequests", "customerUid"],
        ["referrals", "referralClaims", "customerUid"],
        ["privacyRequests", "privacyRequests", "customerUid"],
        ["instituteApplications", "instituteApplications", "customerUid"],
        ["instituteEnrollments", "instituteEnrollments", "studentUid"],
        ["instituteLessonProgress", "instituteLessonProgress", "studentUid"],
        ["instituteSubmissions", "instituteSubmissions", "studentUid"],
        ["instituteAssessmentSubmissions", "instituteAssessmentSubmissions", "studentUid"],
        ["instituteAttendance", "instituteAttendance", "studentUid"],
        ["instituteCertificates", "instituteCertificates", "studentUid"],
        ["loyaltyTransactions", "loyaltyTransactions", "customerUid"]
      ];
      await Promise.all(collections.map(([key, name, field]) => readOwnedCollection(key, name, field)));
      try {
        const benefits = await getDoc(doc(db, "customerBenefits", user.uid));
        bundle.data.customerBenefits = benefits.exists() ? { id: benefits.id, ...benefits.data() } : null;
      } catch {
        bundle.data.customerBenefits = null;
        bundle.omissions.push({ collection: "customerBenefits", reason: "Benefits record could not be retrieved." });
      }
      try {
        const favourites = await getDocs(collection(db, "customerFavourites", user.uid, "items"));
        bundle.data.favourites = favourites.docs.map(row => ({ id: row.id, ...row.data() }));
      } catch {
        bundle.data.favourites = [];
        bundle.omissions.push({ collection: "customerFavourites", reason: "Saved favourites could not be retrieved." });
      }
      const orders = bundle.data.orders || [];
      await Promise.all(orders.map(async order => {
        order.relatedRecords = {};
        for (const [key, subcollection] of [["productionEvents", "events"], ["productionMedia", "progressUpdates"], ["referenceDesigns", "referenceDesigns"]]) {
          try {
            const snapshot = await getDocs(collection(db, "orders", order.id, subcollection));
            order.relatedRecords[key] = snapshot.docs.map(row => ({ id: row.id, ...row.data() }));
          } catch {
            order.relatedRecords[key] = [];
            bundle.omissions.push({ collection: "orders/" + order.id + "/" + subcollection, reason: "Related order records could not be retrieved." });
          }
        }
      }));
      const tickets = bundle.data.supportTickets || [];
      await Promise.all(tickets.map(async ticket => {
        try {
          const snapshot = await getDocs(collection(db, "supportTickets", ticket.id, "messages"));
          ticket.messages = snapshot.docs.map(row => ({ id: row.id, ...row.data() }));
        } catch {
          ticket.messages = [];
          bundle.omissions.push({ collection: "supportTickets/" + ticket.id + "/messages", reason: "Support conversation messages could not be retrieved." });
        }
      }));
      const normalise = value => {
        if (value && typeof value.toDate === "function") return value.toDate().toISOString();
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(normalise);
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalise(child)]));
        return value;
      };
      const json = JSON.stringify(normalise(bundle), null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mr-fop-personal-data-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(bundle.omissions.length
        ? "Your personal-data export has downloaded, but " + bundle.omissions.length + " dataset(s) could not be retrieved. Review the omissions list inside the exported file and contact the team for assistance."
        : "Your personal-data export has downloaded. Review the file and contact the team if you believe a record is missing.");
    } catch (err) {
      setError(err.message || "Could not prepare your personal-data export. Please try again or submit an access request.");
    } finally {
      setExporting(false);
    }
  }

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
      await recordAuditEvent({ user, claims, action: "privacy_request_updated", entityType: "privacyRequest", entityId: item.id, summary: "Privacy request status changed to " + status + "." });
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
    {!isAdmin && <div className="privacy-export-panel"><div><strong>Download a copy of your personal data</strong><p>Prepare a JSON file containing the account records currently available to your signed-in account, including orders and their timelines, appointments, measurements, payment records, support conversations and Institute records where applicable. Google Drive files themselves are not downloaded.</p></div><button type="button" className="portal-secondary" onClick={exportPersonalData} disabled={exporting || busy}>{exporting ? "Preparing your export…" : "Download my data"}</button></div>}
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
