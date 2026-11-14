import React, { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";

const STATUS_OPTIONS = ["requested", "reviewing", "approved", "rejected", "paid"];
export default function RefundManagement({ user, claims = {} }) {
  const finance = !!(claims.superAdmin || claims.staffRole === "finance");
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState({});
  const [references, setReferences] = useState({});
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    if (!user || !db) return;
    setLoading(true); setError("");
    try {
      const paymentQuery = finance ? collection(db, "payments") : query(collection(db, "payments"), where("customerUid", "==", user.uid));
      const refundQuery = finance ? collection(db, "refunds") : query(collection(db, "refunds"), where("customerUid", "==", user.uid));
      const [paymentSnapshot, refundSnapshot] = await Promise.all([getDocs(paymentQuery), getDocs(refundQuery)]);
      setPayments(paymentSnapshot.docs.map(row => ({ id: row.id, ...row.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      setRefunds(refundSnapshot.docs.map(row => ({ id: row.id, ...row.data() })).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
    } catch (err) { setError(err.message || "Could not load refund records."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [user?.uid, finance]);

  const paidRefunds = refunds.filter(item => item.status === "paid");
  const openRefunds = refunds.filter(item => ["requested", "reviewing", "approved"].includes(item.status));
  const paidRefundTotal = paidRefunds.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const openRefundTotal = openRefunds.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const requestedPaymentIds = new Set(refunds.map(item => item.paymentId));
  const availablePayments = payments.filter(item => !requestedPaymentIds.has(item.id));
  const selectedPayment = payments.find(item => item.id === paymentId);
  async function submit(event) {
    event.preventDefault();
    if (finance || !selectedPayment || selectedPayment.customerUid !== user.uid) return;
    const refundAmount = Number(amount);
    const cleanReason = reason.trim();
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > Number(selectedPayment.amount || 0)) { setError("Enter a refund amount greater than zero and no more than the verified payment amount."); return; }
    if (cleanReason.length < 10 || cleanReason.length > 1200) { setError("Explain the reason in 10 to 1,200 characters."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await setDoc(doc(db, "refunds", selectedPayment.id), {
        paymentId: selectedPayment.id, orderId: selectedPayment.orderId || "",
        orderNumber: selectedPayment.orderNumber || "", customerUid: user.uid,
        customerEmail: user.email || "", amount: refundAmount, currency: "NGN",
        reason: cleanReason, status: "requested", reviewNote: "",
        refundReference: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setAmount(""); setReason(""); setPaymentId("");
      setNotice("Your refund request has been submitted. This is a request only; no money has been transferred or approved.");
      await refresh();
    } catch (err) { setError(err.message || "Could not submit the refund request."); }
    finally { setBusy(false); }
  }

  async function updateRefund(item) {
    if (!finance || !item?.id) return;
    const status = statuses[item.id] || item.status;
    const reviewNote = String(notes[item.id] ?? item.reviewNote ?? "").trim();
    const refundReference = String(references[item.id] ?? item.refundReference ?? "").trim();
    if (!STATUS_OPTIONS.includes(status) || reviewNote.length > 1200 || refundReference.length > 120) { setError("Check the refund status, review note and transfer reference."); return; }
    if (status === "paid" && (!refundReference || item.status !== "approved")) { setError("Mark a refund as paid only after it was approved and the actual bank transfer reference has been entered."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const patch = { status, reviewNote, refundReference, updatedAt: serverTimestamp(), reviewedBy: user.uid };
      if (status === "paid") patch.processedAt = serverTimestamp();
      await updateDoc(doc(db, "refunds", item.id), patch);
      await recordAuditEvent({ user, claims, action: "refund_status_updated", entityType: "refund", entityId: item.id, summary: "Updated refund request " + item.id + " to " + status + "." });
      setRefunds(rows => rows.map(row => row.id === item.id ? { ...row, status, reviewNote, refundReference } : row));
      setNotice("Refund request record updated. Confirm the bank transfer independently; this app does not move money.");
    } catch (err) { setError(err.message || "Could not update refund request."); }
    finally { setBusy(false); }
  }

  return <section className="customer-management refund-management">
    <div className="customer-management-heading"><div><h3>{finance ? "Refund requests and records" : "Refund requests"}</h3><p>{finance ? "Review customer refund requests and record a transfer only after it has actually been completed." : "Request a review of a verified payment. A request is not a payment approval or a bank transfer."}</p></div><button type="button" onClick={refresh} disabled={loading || busy}>{loading ? "Loading…" : "Refresh refunds"}</button></div>
    {finance && <div className="refund-summary-grid" aria-label="Refund financial summary">
      <article><span>Paid refunds recorded</span><strong>₦{paidRefundTotal.toLocaleString("en-NG")}</strong><small>{paidRefunds.length} completed transfer record(s)</small></article>
      <article><span>Open refund exposure</span><strong>₦{openRefundTotal.toLocaleString("en-NG")}</strong><small>{openRefunds.length} requested, reviewing or approved case(s)</small></article>
    </div>}
    {!finance && <form className="portal-form refund-request-form" onSubmit={submit}>
      <label>Verified payment<select required value={paymentId} onChange={event=>setPaymentId(event.target.value)}><option value="">Choose a payment</option>{availablePayments.map(item=><option key={item.id} value={item.id}>{item.orderNumber || item.orderId || "Payment"} · ₦{Number(item.amount||0).toLocaleString("en-NG")} · {item.reference || item.id}</option>)}</select></label>
      <label>Requested refund amount (₦)<input type="number" min="0.01" step="0.01" max={selectedPayment?.amount || undefined} required value={amount} onChange={event=>setAmount(event.target.value)}/></label>
      <label>Reason for refund<textarea rows={3} minLength={10} maxLength={1200} required value={reason} onChange={event=>setReason(event.target.value)} placeholder="Explain the reason for your request."/></label>
      <button className="portal-submit" disabled={busy || !payments.length}>{busy ? "Submitting…" : "Submit refund request"}</button>
      {!availablePayments.length && <p className="portal-hint">{payments.length ? "A refund request has already been recorded for each verified payment. Contact support if you need to discuss an existing request." : "No verified payment is available for a refund request yet. Contact the team if you believe a payment is missing."}</p>}
    </form>}
    {error && <p className="portal-error" role="alert">{error}</p>}{notice && <p className="portal-success" role="status">{notice}</p>}
    {loading ? <p className="staff-empty">Loading refund records…</p> : refunds.length ? <div className="refund-record-list">{refunds.map(item=><article className="refund-record-card" key={item.id}>
      <div className="refund-record-heading"><strong>{item.orderNumber || item.orderId || "Order refund"}</strong><span className={"refund-status refund-"+item.status}>{String(item.status || "requested").replaceAll("_"," ")}</span></div>
      {finance && <small>{item.customerEmail || item.customerUid} · {item.customerUid}</small>}
      <p><strong>Amount requested:</strong> ₦{Number(item.amount||0).toLocaleString("en-NG")}</p>
      <p>{item.reason}</p>
      {item.reviewNote && <p className="refund-review-note"><strong>Team response:</strong> {item.reviewNote}</p>}
      {item.refundReference && <p><strong>Transfer reference:</strong> {item.refundReference}</p>}
      <small>Submitted: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("en-NG") : "Recently"}</small>
      {finance && <div className="refund-admin-controls">
        <label>Status<select value={statuses[item.id] ?? item.status ?? "requested"} disabled={busy} onChange={event=>setStatuses(current=>({...current,[item.id]:event.target.value}))}>{STATUS_OPTIONS.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
        <label>Transfer reference (required before marking paid)<input maxLength={120} value={references[item.id] ?? item.refundReference ?? ""} onChange={event=>setReferences(current=>({...current,[item.id]:event.target.value}))}/></label>
        <label>Review note<textarea rows={2} maxLength={1200} value={notes[item.id] ?? item.reviewNote ?? ""} onChange={event=>setNotes(current=>({...current,[item.id]:event.target.value}))}/></label>
        <button type="button" disabled={busy} onClick={()=>updateRefund(item)}>Save refund update</button>
      </div>}
    </article>)}</div> : <p className="staff-empty">No refund requests have been recorded.</p>}
    <p className="portal-hint">Refunds are processed manually outside this application. A status of “paid” records a transfer that staff say has already occurred; the platform does not initiate or verify bank transfers. Refund amounts are not yet netted from POS or statutory financial reports.</p>
  </section>;
}
