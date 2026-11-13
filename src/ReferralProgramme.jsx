import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, doc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";

const STATES = ["pending", "contacted", "qualified", "rewarded", "declined"];

export default function ReferralProgramme({ user, claims }) {
  const isAdmin = !!claims?.superAdmin;
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [reviewNotes, setReviewNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const referralCode = useMemo(() => user?.uid ? "MFF-" + user.uid.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase() : "", [user?.uid]);

  async function refresh() {
    if (!user || !db) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const source = isAdmin ? collection(db, "referralClaims") : query(collection(db, "referralClaims"), where("customerUid", "==", user.uid));
      const snapshot = await getDocs(source);
      setRows(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load referral records."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [user?.uid, isAdmin]);

  async function submit(event) {
    event.preventDefault();
    if (!user || isAdmin) return;
    const name = form.name.trim(), email = form.email.trim().toLowerCase(), phone = form.phone.trim(), note = form.note.trim();
    if (name.length < 2 || name.length > 100) { setError("Enter the referred person's name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address for the person you are referring."); return; }
    if (email === String(user.email || "").toLowerCase()) { setError("You cannot refer your own email address."); return; }
    if (phone.length > 30 || note.length > 500) { setError("Check the phone number and note lengths."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await addDoc(collection(db, "referralClaims"), {
        customerUid: user.uid,
        referrerEmail: user.email || "",
        referralCode,
        referredName: name,
        referredEmail: email,
        referredPhone: phone,
        note,
        status: "pending",
        reviewNote: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setForm({ name: "", email: "", phone: "", note: "" });
      setNotice("Referral submitted for review. Rewards are not issued automatically; the team will verify eligibility first.");
      await refresh();
    } catch (err) { setError(err.message || "Could not submit this referral."); }
    finally { setBusy(false); }
  }

  async function review(item, status) {
    if (!isAdmin || !STATES.includes(status)) return;
    const reviewNote = String(reviewNotes[item.id] ?? item.reviewNote ?? "").trim();
    if (reviewNote.length > 500) { setError("Review notes must be 500 characters or fewer."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "referralClaims", item.id), { status, reviewNote, reviewedBy: user.uid, updatedAt: serverTimestamp() });
      await recordAuditEvent({ user, claims, action: "referral_reviewed", entityType: "referral", entityId: item.id, summary: "Referral status changed to " + status + "." });
      setRows(current => current.map(row => row.id === item.id ? { ...row, status, reviewNote } : row));
      setNotice("Referral status updated. If a reward is due, record it in the customer's loyalty benefits after verifying the qualifying purchase.");
    } catch (err) { setError(err.message || "Could not update this referral."); }
    finally { setBusy(false); }
  }

  return <section className="referral-programme customer-management">
    <div className="customer-management-heading"><div><h3>{isAdmin ? "Referral programme" : "Refer someone to MR FOP"}</h3><p>{isAdmin ? "Review referrals, confirm eligibility and record the decision. Award any approved points separately in Customer loyalty and VIP benefits." : "Share your referral code with friends, colleagues or organisations who may need our fashion services."}</p></div><button type="button" onClick={refresh} disabled={loading || busy}>{loading ? "Loading…" : "Refresh referrals"}</button></div>
    {!isAdmin && <>
      <div className="referral-code-panel"><span>Your referral code</span><strong>{referralCode}</strong><button type="button" onClick={() => { if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(referralCode).then(()=>setNotice("Referral code copied."),()=>setError("Could not copy automatically. Please select and copy the code.")); }}>Copy code</button></div>
      <form className="portal-form referral-form" onSubmit={submit}>
        <h4>Submit a referral</h4>
        <label>Referred person's name<input required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Email address<input required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Telephone number (optional)<input maxLength={30} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>Additional context (optional)<textarea maxLength={500} rows={3} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="What service might they be interested in?"/></label>
        <p className="portal-hint">Only submit contact details you are authorised to share. Referral eligibility and any reward are subject to company verification and published programme terms.</p>
        <button className="portal-submit" disabled={busy}>{busy ? "Submitting…" : "Submit referral"}</button>
      </form>
    </>}
    {error && <p className="portal-error" role="alert">{error}</p>}{notice && <p className="portal-success" role="status">{notice}</p>}
    {loading ? <p className="staff-empty">Loading referrals…</p> : rows.length ? <div className="referral-list">{rows.map(item=><article className="referral-card" key={item.id}>
      <div className="referral-card-heading"><strong>{item.referredName}</strong><span className={"referral-status referral-"+item.status}>{String(item.status || "pending").replaceAll("_"," ")}</span></div>
      <p>{item.referredEmail}{item.referredPhone ? " · "+item.referredPhone : ""}</p>
      {isAdmin && <p>Referrer: {item.referrerEmail || item.customerUid} · Code: {item.referralCode}</p>}
      {item.note && <p>{item.note}</p>}{item.reviewNote && <p className="referral-review-note"><strong>Review note:</strong> {item.reviewNote}</p>}
      <small>Submitted: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("en-NG") : "Recently"}</small>
      {isAdmin && <div className="referral-review-actions"><label>Review note<textarea maxLength={500} rows={2} value={reviewNotes[item.id] ?? item.reviewNote ?? ""} onChange={e=>setReviewNotes(current=>({...current,[item.id]:e.target.value}))}/></label><label>Status<select value={item.status || "pending"} disabled={busy} onChange={e=>review(item,e.target.value)}>{STATES.map(state=><option key={state} value={state}>{state}</option>)}</select></label></div>}
    </article>)}</div> : <p className="staff-empty">{isAdmin ? "No referrals have been submitted." : "You have not submitted a referral yet."}</p>}
  </section>;
}
