import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase.js";

const DEFAULT_BENEFITS = { points: 0, tier: "standard", discountPercent: 0, prioritySupport: false };
const TIERS = ["standard", "silver", "gold", "vip"];

export default function CustomerBenefits({ user, claims, customers = [] }) {
  const isAdmin = !!claims?.superAdmin;
  const [selectedUid, setSelectedUid] = useState(isAdmin ? "" : user?.uid || "");
  const [benefits, setBenefits] = useState(DEFAULT_BENEFITS);
  const [transactions, setTransactions] = useState([]);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isAdmin && !selectedUid && customers.length) setSelectedUid(customers[0].uid);
  }, [isAdmin, selectedUid, customers]);

  async function refresh() {
    if (!user || !db || !selectedUid) return;
    setLoading(true); setError("");
    try {
      const [benefitSnapshot, transactionSnapshot] = await Promise.all([
        getDoc(doc(db, "customerBenefits", selectedUid)),
        getDocs(query(collection(db, "loyaltyTransactions"), where("customerUid", "==", selectedUid)))
      ]);
      setBenefits(benefitSnapshot.exists() ? { ...DEFAULT_BENEFITS, ...benefitSnapshot.data() } : DEFAULT_BENEFITS);
      setTransactions(transactionSnapshot.docs.map(row => ({ id: row.id, ...row.data() }))
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 12));
      setDelta("0"); setReason("");
    } catch (err) {
      setError(err.message || "Could not load the customer's benefits.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, [selectedUid, user?.uid, isAdmin]);

  async function save(event) {
    event.preventDefault();
    if (!isAdmin || !selectedUid) return;
    const pointsDelta = Number(delta);
    const discount = Number(benefits.discountPercent);
    if (!Number.isInteger(pointsDelta) || Math.abs(pointsDelta) > 100000) { setError("Enter a whole-number points adjustment between -100,000 and 100,000."); return; }
    if (!Number.isFinite(discount) || discount < 0 || discount > 50) { setError("Discount must be between 0% and 50%."); return; }
    if (pointsDelta !== 0 && reason.trim().length < 5) { setError("Give a reason of at least five characters for the points adjustment."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const benefitRef = doc(db, "customerBenefits", selectedUid);
      const transactionRef = doc(collection(db, "loyaltyTransactions"));
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(benefitRef);
        const current = snapshot.exists() ? snapshot.data() : DEFAULT_BENEFITS;
        const nextPoints = Number(current.points || 0) + pointsDelta;
        if (nextPoints < 0) throw new Error("This adjustment would make the customer's points balance negative.");
        transaction.set(benefitRef, {
          customerUid: selectedUid,
          points: nextPoints,
          tier: benefits.tier,
          discountPercent: discount,
          prioritySupport: !!benefits.prioritySupport,
          createdAt: snapshot.exists() ? current.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        if (pointsDelta !== 0) transaction.set(transactionRef, {
          customerUid: selectedUid,
          pointsDelta,
          reason: reason.trim(),
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      });
      setNotice("Customer benefits saved. The points adjustment has been recorded in the loyalty history.");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not save customer benefits.");
    } finally {
      setBusy(false);
    }
  }

  const customer = customers.find(item => item.uid === selectedUid);
  return <section className="customer-benefits-center customer-management">
    <div className="customer-management-heading">
      <div><h3>{isAdmin ? "Customer loyalty and VIP benefits" : "My loyalty and VIP benefits"}</h3>
        <p>{isAdmin ? "Assign customer tiers, approved discounts, priority support and auditable loyalty-point adjustments." : "View your current loyalty points, customer tier, approved discount and support benefits."}</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading || !selectedUid}>{loading ? "Loading…" : "Refresh benefits"}</button>
    </div>
    {isAdmin ? <label className="benefits-customer-select">Customer<select value={selectedUid} onChange={event=>setSelectedUid(event.target.value)}><option value="">Select customer</option>{customers.map(item=><option key={item.uid} value={item.uid}>{item.displayName || item.email || item.uid} · {item.email || item.uid}</option>)}</select></label> : null}
    {selectedUid && <>
      <div className="benefits-summary-grid">
        <article><span>Available loyalty points</span><strong>{Number(benefits.points || 0).toLocaleString("en-NG")}</strong></article>
        <article><span>Customer tier</span><strong>{String(benefits.tier || "standard").toUpperCase()}</strong></article>
        <article><span>Approved discount</span><strong>{Number(benefits.discountPercent || 0)}%</strong></article>
        <article><span>Priority support</span><strong>{benefits.prioritySupport ? "Enabled" : "Standard"}</strong></article>
      </div>
      {isAdmin && <form className="portal-form benefits-admin-form" onSubmit={save}>
        <h4>Update benefits {customer ? "for " + (customer.displayName || customer.email) : ""}</h4>
        <label>Customer tier<select value={benefits.tier || "standard"} onChange={event=>setBenefits(current=>({...current,tier:event.target.value}))}>{TIERS.map(tier=><option key={tier} value={tier}>{tier.toUpperCase()}</option>)}</select></label>
        <label>Approved discount (%)<input type="number" min="0" max="50" step="0.5" value={benefits.discountPercent ?? 0} onChange={event=>setBenefits(current=>({...current,discountPercent:event.target.value}))}/></label>
        <label className="benefits-priority-toggle"><input type="checkbox" checked={!!benefits.prioritySupport} onChange={event=>setBenefits(current=>({...current,prioritySupport:event.target.checked}))}/> Enable priority customer support</label>
        <label>Points adjustment (positive to award, negative to correct)<input type="number" min="-100000" max="100000" step="1" value={delta} onChange={event=>setDelta(event.target.value)}/></label>
        <label>Reason for points adjustment<textarea maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Required when awarding or correcting points"/></label>
        <button className="portal-submit" disabled={busy || !selectedUid}>{busy ? "Saving…" : "Save customer benefits"}</button>
        <p className="portal-hint">Points are currently awarded or corrected manually by the Super Admin. The platform does not yet calculate automatic purchase or referral rewards.</p>
      </form>}
      <div className="benefits-history"><h4>Recent loyalty-point activity</h4>
        {loading ? <p>Loading loyalty history…</p> : transactions.length ? transactions.map(item=><article key={item.id}><strong>{item.pointsDelta > 0 ? "+" : ""}{item.pointsDelta} points</strong><span>{item.reason}</span><small>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("en-NG") : "Recently recorded"}</small></article>) : <p className="staff-empty">No loyalty-point adjustments have been recorded yet.</p>}
      </div>
    </>}
    {error && <p className="portal-error" role="alert">{error}</p>}{notice && <p className="portal-success" role="status">{notice}</p>}
  </section>;
}
