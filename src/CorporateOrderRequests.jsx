import React, { useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";

const TYPES = ["Corporate uniforms", "School uniforms", "Church / ministry outfits", "Wedding party clothing", "Event clothing", "Bulk bespoke garments", "Other institutional order"];
const STATUSES = ["pending", "in_review", "quotation_preparation", "quoted", "accepted", "declined", "completed"];

export default function CorporateOrderRequests({ user, claims }) {
  const canManage = !!claims?.superAdmin || claims?.staffRole === "manager";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ organisation: "", contactName: "", phone: "", type: TYPES[0], quantity: "10", dueDate: "", location: "", details: "" });
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    if (!user || !db) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const source = canManage ? collection(db, "corporateRequests") : query(collection(db, "corporateRequests"), where("customerUid", "==", user.uid));
      const snapshot = await getDocs(source);
      setItems(snapshot.docs.map(row => ({ id: row.id, ...row.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load institutional requests."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [user?.uid, canManage]);

  async function submit(event) {
    event.preventDefault();
    if (!user || canManage) return;
    const organisation = form.organisation.trim(), contactName = form.contactName.trim(), phone = form.phone.trim(), details = form.details.trim(), location = form.location.trim();
    const quantity = Number(form.quantity);
    if (organisation.length < 2 || organisation.length > 160 || contactName.length < 2 || contactName.length > 100) { setError("Enter the organisation and contact person's name."); return; }
    if (!Number.isInteger(quantity) || quantity < 2 || quantity > 10000) { setError("Bulk quantity must be between 2 and 10,000 outfits."); return; }
    if (phone.length < 7 || phone.length > 30 || details.length < 10 || details.length > 2000 || location.length > 200) { setError("Check the telephone number, location and project description."); return; }
    if (form.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) { setError("Enter a valid preferred completion date."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await addDoc(collection(db, "corporateRequests"), {
        customerUid: user.uid, customerEmail: user.email || "", customerName: user.displayName || "",
        organisation, contactName, phone, requestType: form.type, quantity, preferredDueDate: form.dueDate,
        location, details, status: "pending", staffNote: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setForm({ organisation: "", contactName: "", phone: "", type: TYPES[0], quantity: "10", dueDate: "", location: "", details: "" });
      setNotice("Your institutional order enquiry has been submitted. The team will review the requirements and contact you about a quotation.");
      await refresh();
    } catch (err) { setError(err.message || "Could not submit the institutional request."); }
    finally { setBusy(false); }
  }

  async function updateRequest(item, status) {
    if (!canManage || !STATUSES.includes(status)) return;
    const staffNote = String(edits[item.id]?.staffNote ?? item.staffNote ?? "").trim();
    if (staffNote.length > 1500) { setError("The response must be 1,500 characters or fewer."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "corporateRequests", item.id), { status, staffNote, updatedBy: user.uid, updatedAt: serverTimestamp() });
      setItems(current => current.map(row => row.id === item.id ? { ...row, status, staffNote } : row));
      setNotice("Institutional request updated.");
    } catch (err) { setError(err.message || "Could not update this request."); }
    finally { setBusy(false); }
  }

  return <section className="corporate-request-centre customer-management">
    <div className="customer-management-heading"><div><h3>{canManage ? "Corporate and bulk order enquiries" : "Corporate and bulk orders"}</h3><p>{canManage ? "Review uniform, event and institutional production requests before preparing a quotation." : "Request uniforms, coordinated outfits or bulk garment production for your organisation or event."}</p></div><button type="button" onClick={refresh} disabled={loading || busy}>{loading ? "Loading…" : "Refresh requests"}</button></div>
    {!canManage && <form className="portal-form corporate-request-form" onSubmit={submit}>
      <label>Organisation / group name<input required minLength={2} maxLength={160} value={form.organisation} onChange={e=>setForm({...form,organisation:e.target.value})} placeholder="Company, school, church, group or event"/></label>
      <label>Contact person's name<input required minLength={2} maxLength={100} value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})}/></label>
      <label>Telephone number<input required minLength={7} maxLength={30} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
      <label>Request type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
      <label>Estimated quantity<input type="number" min="2" max="10000" step="1" required value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></label>
      <label>Preferred completion date (not confirmed)<input type="date" min={new Date().toISOString().slice(0,10)} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>
      <label>Organisation / delivery location<input maxLength={200} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
      <label>Project requirements<textarea required minLength={10} maxLength={2000} rows={4} value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder="Describe garment types, sizes, fabric preferences, colours, branding, sample requirements and timeline."/></label>
      <p className="portal-hint">This is a quotation request, not an accepted order or confirmed delivery commitment. Final price, capacity and timeline are confirmed after review.</p>
      <button className="portal-submit" disabled={busy}>{busy ? "Submitting…" : "Submit bulk-order enquiry"}</button>
    </form>}
    {error && <p className="portal-error" role="alert">{error}</p>}{notice && <p className="portal-success" role="status">{notice}</p>}
    {loading ? <p className="staff-empty">Loading requests…</p> : items.length ? <div className="corporate-request-list">{items.map(item=><article className="corporate-request-card" key={item.id}>
      <div className="corporate-request-heading"><strong>{item.organisation}</strong><span className={"corporate-request-status status-"+String(item.status || "pending").replaceAll("_","-")}>{String(item.status || "pending").replaceAll("_"," ")}</span></div>
      <p>{item.requestType} · {Number(item.quantity || 0).toLocaleString("en-NG")} outfits</p>
      <p>Contact: {item.contactName} · {item.phone}{canManage ? " · "+(item.customerEmail || item.customerUid) : ""}</p>
      {item.preferredDueDate && <p>Preferred date: {item.preferredDueDate} (subject to confirmation)</p>}
      {item.location && <p>Location: {item.location}</p>}<p>{item.details}</p>
      {item.staffNote && <p className="corporate-request-note"><strong>MR FOP response:</strong> {item.staffNote}</p>}
      {canManage && <div className="corporate-request-admin"><label>Team response<textarea rows={3} maxLength={1500} value={edits[item.id]?.staffNote ?? item.staffNote ?? ""} onChange={e=>setEdits(current=>({...current,[item.id]:{...current[item.id],staffNote:e.target.value}}))}/></label><label>Request status<select value={item.status || "pending"} disabled={busy} onChange={e=>updateRequest(item,e.target.value)}>{STATUSES.map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></label></div>}
      <small>Reference: {item.id} · {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString("en-NG") : "Recently submitted"}</small>
    </article>)}</div> : <p className="staff-empty">{canManage ? "No corporate or bulk-order enquiries have been received." : "You have not submitted a bulk-order enquiry."}</p>}
  </section>;
}
