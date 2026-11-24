import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc, startAfter, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";

const MANAGEABLE_COLLECTIONS = [
  ["users", "Customer profiles"],
  ["orders", "Orders and production"],
  ["appointments", "Appointments"],
  ["appointmentSlots", "Appointment slots"],
  ["notifications", "Notifications"],
  ["supportTickets", "Support tickets"],
  ["paymentDeclarations", "Payment declarations"],
  ["payments", "Verified payments"],
  ["refunds", "Refund requests"],
  ["expenses", "Expenses"],
  ["sales", "Sales and receipts"],
  ["reviews", "Customer reviews"],
  ["products", "Products"],
  ["inventoryMovements", "Inventory movements"],
  ["measurements", "Measurement records"],
  ["trainingEnquiries", "Training enquiries"],
  ["instituteCourses", "Institute courses"],
  ["trainingWindows", "Training windows"],
  ["instituteApplications", "Institute applications"],
  ["instituteEnrollments", "Institute enrollments"],
  ["instituteAssignments", "Institute assignments"],
  ["instituteSubmissions", "Institute submissions"],
  ["instituteLessons", "Institute lessons"],
  ["instituteLessonProgress", "Lesson progress"],
  ["instituteAnnouncements", "Institute announcements"],
  ["instituteCompletionApprovals", "Completion approvals"],
  ["instituteCertificates", "Certificates"],
  ["publicCertificateVerifications", "Certificate verification records"],
  ["instituteSessionSlots", "Institute session slots"],
  ["instituteSessions", "Institute sessions"],
  ["instituteAttendance", "Institute attendance"],
  ["instituteAssessments", "Institute assessments"],
  ["instituteAssessmentAnswerKeys", "Assessment answer keys"],
  ["instituteAssessmentSubmissions", "Assessment submissions"],
  ["instituteInstructorProfiles", "Instructor profiles"],
  ["instituteInstructorAssignments", "Instructor assignments"],
  ["siteMedia", "Website media records"],
  ["customerBenefits", "Customer benefits"],
  ["loyaltyTransactions", "Loyalty transactions"],
  ["publicFAQs", "Website FAQs"],
  ["corporateRequests", "Corporate requests"],
  ["referralClaims", "Referral claims"],
  ["fabrics", "Fabric catalogue"],
  ["privacyRequests", "Privacy requests"],
  ["newsletterSubscribers", "Newsletter subscribers"]
];

const PAGE_SIZE = 100;
const safeText = value => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value?.toDate) return value.toDate().toLocaleString();
  try { return JSON.stringify(value); } catch { return "[Complex value]"; }
};
const recordTitle = item => item.name || item.title || item.customerName || item.displayName || item.orderNumber || item.receiptNumber || item.email || item.subject || item.applicationRef || item.id;

export default function SystemControlCentre({ user, claims }) {
  const [section, setSection] = useState("records");
  const [selectedCollection, setSelectedCollection] = useState("orders");
  const [rows, setRows] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [binRows, setBinRows] = useState([]);
  const [binLastDoc, setBinLastDoc] = useState(null);
  const [binHasMore, setBinHasMore] = useState(false);

  const collectionLabel = MANAGEABLE_COLLECTIONS.find(([id]) => id === selectedCollection)?.[1] || selectedCollection;
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(item => [item.id, ...Object.values(item)].map(safeText).join(" ").toLowerCase().includes(needle));
  }, [rows, search]);

  async function loadRecords(reset = true) {
    if (!claims?.superAdmin) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const base = collection(db, selectedCollection);
      const pageQuery = reset || !lastDoc ? query(base, limit(PAGE_SIZE)) : query(base, startAfter(lastDoc), limit(PAGE_SIZE));
      const snap = await getDocs(pageQuery);
      const mapped = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRows(current => reset ? mapped : [...current, ...mapped]);
      setLastDoc(snap.docs.at(-1) || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      setError(e.message || "Could not load this information. Check the administrator access rules.");
    } finally { setLoading(false); }
  }

  async function loadRecycleBin(reset = true) {
    if (!claims?.superAdmin) return;
    setLoading(true); setError("");
    try {
      const q = reset || !binLastDoc
        ? query(collection(db, "adminRecycleBin"), limit(PAGE_SIZE))
        : query(collection(db, "adminRecycleBin"), startAfter(binLastDoc), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      setBinRows(current => reset ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [...current, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      setBinLastDoc(snap.docs.at(-1) || null);
      setBinHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) { setError(e.message || "Could not load the Recycle Bin."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (section === "records") { setRows([]); setLastDoc(null); loadRecords(true); }
    if (section === "recycle") { setBinRows([]); setBinLastDoc(null); loadRecycleBin(true); }
  }, [section, selectedCollection, claims?.superAdmin]);

  async function confirmDelete() {
    if (!claims?.superAdmin || !pending || confirmation !== "DELETE") return;
    if (pending.collectionName === "users" && pending.id === user?.uid) {
      setError("You cannot delete your own administrator profile here.");
      return;
    }
    setWorking(pending.id); setError(""); setNotice("");
    try {
      const archiveId = pending.collectionName + "__" + pending.id + "__" + Date.now();
      const batch = writeBatch(db);
      batch.set(doc(db, "adminRecycleBin", archiveId), {
        collectionName: pending.collectionName,
        originalId: pending.id,
        recordTitle: recordTitle(pending),
        recordData: Object.fromEntries(Object.entries(pending).filter(([key]) => key !== "id")),
        deletedByUid: user.uid,
        deletedByEmail: user.email || "",
        deletedAt: serverTimestamp()
      });
      batch.delete(doc(db, pending.collectionName, pending.id));
      await batch.commit();
      await recordAuditEvent({ user, claims, action: "system_record_deleted", entityType: "systemRecord", entityId: pending.id, summary: "Moved " + pending.collectionName + " record to the Recycle Bin." });
      setRows(current => current.filter(item => item.id !== pending.id));
      setNotice("Record moved to the Recycle Bin. It can be restored by a Super Admin.");
      setPending(null); setConfirmation("");
    } catch (e) { setError(e.message || "The record could not be deleted."); }
    finally { setWorking(""); }
  }

  async function restoreRecord(item) {
    if (!claims?.superAdmin || !item?.collectionName || !item?.originalId || !item?.recordData) return;
    if (MANAGEABLE_COLLECTIONS.every(([name]) => name !== item.collectionName)) {
      setError("This record type is not eligible for restoration from this screen."); return;
    }
    setWorking(item.id); setError(""); setNotice("");
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, item.collectionName, item.originalId), item.recordData);
      batch.delete(doc(db, "adminRecycleBin", item.id));
      await batch.commit();
      await recordAuditEvent({ user, claims, action: "system_record_restored", entityType: "systemRecord", entityId: item.originalId, summary: "Restored " + item.collectionName + " record from the Recycle Bin." });
      setBinRows(current => current.filter(row => row.id !== item.id));
      setNotice("Record restored successfully.");
    } catch (e) { setError(e.message || "The record could not be restored."); }
    finally { setWorking(""); }
  }

  if (!claims?.superAdmin) return null;

  return <section className="system-control-centre">
    <div className="system-control-heading">
      <div><span className="system-control-eyebrow">SUPER ADMIN ONLY</span><h2>System Control Centre</h2><p>Central administration for company information stored in the MR FOP platform.</p></div>
      <span className="system-control-secure"> <span aria-hidden="true">●</span> Restricted access</span>
    </div>
    <div className="system-control-tabs">
      <button type="button" className={section === "records" ? "active" : ""} onClick={() => setSection("records")}>Information management</button>
      <button type="button" className={section === "recycle" ? "active" : ""} onClick={() => setSection("recycle")}>Recycle Bin</button>
    </div>
    {error && <p className="system-control-error" role="alert">{error}</p>}
    {notice && <p className="system-control-notice" role="status">{notice}</p>}
    {section === "records" ? <>
      <div className="system-control-toolbar">
        <label>Information category<select value={selectedCollection} onChange={e => { setSelectedCollection(e.target.value); setSearch(""); setRows([]); setLastDoc(null); }} >{MANAGEABLE_COLLECTIONS.map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select></label>
        <label>Search records<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search names, IDs or details"/></label>
        <button type="button" onClick={() => loadRecords(true)} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>
      <div className="system-control-list-heading"><strong>{collectionLabel}</strong><span>{filteredRows.length} shown · maximum 100 per page</span></div>
      {loading && !rows.length ? <p className="system-control-empty">Loading records…</p> : filteredRows.length ? <div className="system-control-table-wrap"><table className="system-control-table"><thead><tr><th>Record</th><th>Record ID</th><th>Details</th><th>Action</th></tr></thead><tbody>{filteredRows.map(item => <tr key={item.id}><td><strong>{safeText(recordTitle(item)) || "Untitled record"}</strong></td><td><code>{item.id}</code></td><td><span>{Object.entries(item).filter(([key]) => key !== "id").slice(0,4).map(([key,value]) => key + ": " + safeText(value).slice(0,100)).join(" · ")}</span></td><td><button type="button" className="system-control-delete" onClick={() => { setPending({ ...item, collectionName: selectedCollection }); setConfirmation(""); }}>Move to Recycle Bin</button></td></tr>)}</tbody></table></div> : <p className="system-control-empty">No records found in this category.</p>}
      {hasMore && <button type="button" className="system-control-more" onClick={() => loadRecords(false)} disabled={loading}>Load next 100 records</button>}
    </> : <>
      <div className="system-control-list-heading"><strong>Recoverable deleted records</strong><button type="button" onClick={() => loadRecycleBin(true)} disabled={loading}>Refresh Recycle Bin</button></div>
      {binRows.length ? <div className="system-control-table-wrap"><table className="system-control-table"><thead><tr><th>Record</th><th>Category</th><th>Deleted</th><th>Action</th></tr></thead><tbody>{binRows.map(item => <tr key={item.id}><td><strong>{safeText(item.recordTitle) || item.originalId}</strong><small>{item.originalId}</small></td><td>{item.collectionName}</td><td>{safeText(item.deletedAt)}</td><td><button type="button" onClick={() => restoreRecord(item)} disabled={!!working}>Restore</button></td></tr>)}</tbody></table></div> : <p className="system-control-empty">The Recycle Bin is empty.</p>}
      {binHasMore && <button type="button" className="system-control-more" onClick={() => loadRecycleBin(false)} disabled={loading}>Load next 100 records</button>}
    </>}
    {pending && <div className="system-control-modal-backdrop" role="presentation"><div className="system-control-modal" role="dialog" aria-modal="true" aria-labelledby="system-delete-title">
      <h3 id="system-delete-title">Confirm record deletion</h3>
      <p>You are moving <strong>{safeText(recordTitle(pending)) || pending.id}</strong> from <strong>{collectionLabel}</strong> to the Recycle Bin. This removes it from the active platform but keeps a recoverable copy.</p>
      <p>Type <strong>DELETE</strong> to confirm.</p>
      <input autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Type DELETE"/>
      <div><button type="button" onClick={() => { setPending(null); setConfirmation(""); }}>Cancel</button><button type="button" className="system-control-delete" disabled={confirmation !== "DELETE" || !!working} onClick={confirmDelete}>{working ? "Processing…" : "Confirm move"}</button></div>
    </div></div>}
    <p className="system-control-footnote">Security: this console is visible only to Super Admin accounts. Staff roles, audit logs and core Drive integration settings are protected from deletion here. User profile deletion does not disable the separate Firebase Authentication login. Files in Google Drive and nested subcollections require their dedicated management workflows.</p>
  </section>;
}
