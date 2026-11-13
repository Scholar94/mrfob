import React, { useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { recordAuditEvent } from "./auditLog.js";

const blank = { question: "", answer: "", order: "10", active: true };

export default function FAQManager({ user, claims }) {
  const canManage = !!claims?.superAdmin || claims?.staffRole === "manager";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    if (!canManage || !db) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "publicFAQs"));
      setItems(snapshot.docs.map(row => ({ id: row.id, ...row.data() })).sort((a,b) => Number(a.order || 0) - Number(b.order || 0)));
    } catch (err) { setError(err.message || "Could not load FAQs."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [canManage]);

  async function save(event) {
    event.preventDefault();
    if (!canManage || !user) return;
    const question = form.question.trim(), answer = form.answer.trim(), order = Number(form.order);
    if (question.length < 8 || question.length > 180) { setError("Question must be 8 to 180 characters."); return; }
    if (answer.length < 15 || answer.length > 1800) { setError("Answer must be 15 to 1,800 characters."); return; }
    if (!Number.isInteger(order) || order < 0 || order > 999) { setError("Display order must be a whole number between 0 and 999."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (editingId) {
        await updateDoc(doc(db, "publicFAQs", editingId), { question, answer, order, active: !!form.active, updatedAt: serverTimestamp() });
        await recordAuditEvent({ user, claims, action: "faq_updated", entityType: "faq", entityId: editingId, summary: "Updated FAQ: " + question });
        setNotice("FAQ updated.");
      } else {
        const ref = await addDoc(collection(db, "publicFAQs"), { question, answer, order, active: !!form.active, createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp() });
        await recordAuditEvent({ user, claims, action: "faq_created", entityType: "faq", entityId: ref.id, summary: "Created FAQ: " + question });
        setNotice("FAQ added to the public website.");
      }
      setForm(blank); setEditingId(""); await refresh();
    } catch (err) { setError(err.message || "Could not save FAQ."); }
    finally { setBusy(false); }
  }

  function edit(item) {
    setEditingId(item.id);
    setForm({ question: item.question || "", answer: item.answer || "", order: String(item.order ?? 10), active: item.active !== false });
  }

  async function archive(item) {
    if (!canManage || !window.confirm("Hide this FAQ from the public website?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await updateDoc(doc(db, "publicFAQs", item.id), { active: false, updatedAt: serverTimestamp() });
      await recordAuditEvent({ user, claims, action: "faq_archived", entityType: "faq", entityId: item.id, summary: "Archived FAQ: " + item.question });
      setNotice("FAQ hidden from the public website."); await refresh();
    } catch (err) { setError(err.message || "Could not archive FAQ."); }
    finally { setBusy(false); }
  }

  return <section className="faq-manager customer-management">
    <div className="customer-management-heading"><div><h3>Website FAQ management</h3><p>Publish, edit and archive customer questions and answers shown on the public homepage.</p></div><button type="button" onClick={refresh} disabled={loading || busy}>{loading ? "Loading…" : "Refresh FAQs"}</button></div>
    <form className="portal-form faq-manager-form" onSubmit={save}>
      <h4>{editingId ? "Edit FAQ" : "Add a public FAQ"}</h4>
      <label>Question<input required minLength={8} maxLength={180} value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/></label>
      <label>Answer<textarea required minLength={15} maxLength={1800} rows={4} value={form.answer} onChange={e=>setForm({...form,answer:e.target.value})}/></label>
      <label>Display order<input type="number" min="0" max="999" step="1" value={form.order} onChange={e=>setForm({...form,order:e.target.value})}/></label>
      <label className="faq-active-toggle"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Publish on public website</label>
      <div className="faq-manager-actions"><button className="portal-submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save FAQ" : "Add FAQ"}</button>{editingId && <button type="button" disabled={busy} onClick={()=>{setEditingId("");setForm(blank);}}>Cancel edit</button>}</div>
    </form>
    {error && <p className="portal-error" role="alert">{error}</p>}{notice && <p className="portal-success" role="status">{notice}</p>}
    {loading ? <p className="staff-empty">Loading FAQs…</p> : items.length ? <div className="faq-manager-list">{items.map(item=><article key={item.id}><div><strong>{item.question}</strong><span>{item.active ? "Published" : "Archived"} · Order {item.order ?? 10}</span><p>{item.answer}</p></div><div><button type="button" disabled={busy} onClick={()=>edit(item)}>Edit</button>{item.active && <button type="button" disabled={busy} onClick={()=>archive(item)}>Archive</button>}</div></article>)}</div> : <p className="staff-empty">No custom FAQs have been added. The public site will continue showing its built-in FAQ list.</p>}
  </section>;
}
