import React, { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "./firebase.js";

export default function AuditLogViewer() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const snapshot = await getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(150)));
      setItems(snapshot.docs.map(row => ({ id: row.id, ...row.data() })));
    } catch (err) { setError(err.message || "Could not load audit events."); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const visible = items.filter(item => [item.action, item.entityType, item.entityId, item.actorUid, item.actorRole, item.summary]
    .some(value => String(value || "").toLowerCase().includes(search.trim().toLowerCase())));

  return <section className="audit-log-viewer customer-management">
    <div className="customer-management-heading"><div><h3>System audit log</h3><p>Append-only record of selected privileged account and operational changes. The latest 150 events are shown.</p></div><button type="button" onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh audit log"}</button></div>
    <label className="audit-log-search">Search events<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Action, record, staff UID or summary"/></label>
    {error && <p className="portal-error" role="alert">{error}</p>}
    {loading ? <p className="staff-empty">Loading audit history…</p> : visible.length ? <div className="audit-log-list">{visible.map(item=><article className="audit-log-item" key={item.id}>
      <div className="audit-log-item-heading"><strong>{String(item.action || "Event").replaceAll("_"," ")}</strong><span>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("en-NG") : "Time pending"}</span></div>
      <p>{item.summary || "No summary supplied."}</p>
      <small>{item.entityType || "record"} · {item.entityId || "—"} · {item.actorRole || "staff"} · {item.actorUid || "unknown actor"}</small>
    </article>)}</div> : <p className="staff-empty">No audit events match this search.</p>}
    <p className="portal-hint">This is an application-level audit trail for the actions instrumented in the interface. It is not a tamper-proof external ledger and is not a substitute for Firebase/GitHub administrative logs.</p>
  </section>;
}
