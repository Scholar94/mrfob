import React, { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Private append-only conversation thread for an existing support ticket.
 * Parent ticket access is enforced again by Firestore rules; this component
 * never exposes messages through public website routes.
 */
export default function SupportConversation({ ticket, user, canManageSupport, senderRole }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!expanded || !ticket?.id || !user?.uid) return undefined;
    const source = query(collection(db, "supportTickets", ticket.id, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(source, snapshot => {
      setMessages(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
      setError("");
    }, err => setError(err.message || "Could not load this conversation."));
  }, [expanded, ticket?.id, user?.uid]);

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || body.length > 2000 || sending) return;
    setSending(true);
    setError("");
    try {
      await addDoc(collection(db, "supportTickets", ticket.id, "messages"), {
        senderUid: user.uid,
        senderRole: canManageSupport ? "staff" : "customer",
        senderName: user.displayName || user.email || (canManageSupport ? "MR FOP team" : "Customer"),
        body,
        createdAt: serverTimestamp()
      });
      setDraft("");
    } catch (err) {
      setError(err.message || "Your message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return <div className="support-conversation">
    <button type="button" className="support-conversation-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? "Hide conversation" : "Open conversation"} <span>{messages.length ? messages.length + " message(s)" : "Private message thread"}</span>
    </button>
    {expanded && <>
      <div className="support-conversation-messages" aria-live="polite">
        {messages.length ? messages.map(message => <article key={message.id} className={"support-conversation-message " + (message.senderRole === "customer" ? "from-customer" : "from-staff")}>
          <strong>{message.senderRole === "customer" ? "Customer" : "MR FOP team"}</strong>
          <p>{message.body}</p>
          <small>{message.createdAt?.toDate ? message.createdAt.toDate().toLocaleString("en-GB") : "Just sent"}</small>
        </article>) : <p className="staff-empty">No follow-up messages yet. Use this private thread to continue the conversation.</p>}
      </div>
      {ticket.status !== "closed" && <form className="support-conversation-compose" onSubmit={sendMessage}>
        <label htmlFor={"support-message-" + ticket.id}>Your message</label>
        <textarea id={"support-message-" + ticket.id} rows="3" maxLength="2000" required value={draft} onChange={event => setDraft(event.target.value)} placeholder="Write a reply. Do not include passwords, PINs or one-time codes."/>
        <div><small>{draft.length}/2000 characters</small><button type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send message"}</button></div>
      </form>}
      {ticket.status === "closed" && <p className="support-thread-closed">This request is closed. Contact the team to open a new request if you need further help.</p>}
      {error && <p className="support-thread-error" role="alert">{error}</p>}
    </>}
  </div>;
}
