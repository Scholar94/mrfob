import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

export async function recordAuditEvent({ user, claims, action, entityType, entityId = "", summary = "" }) {
  if (!user?.uid || !db) return false;
  const actorRole = claims?.superAdmin ? "superAdmin" : (claims?.staffRole || claims?.role || "customer");
  try {
    await addDoc(collection(db, "auditLogs"), {
      actorUid: user.uid,
      actorRole,
      action: String(action || "").slice(0, 80),
      entityType: String(entityType || "").slice(0, 80),
      entityId: String(entityId || "").slice(0, 150),
      summary: String(summary || "").slice(0, 500),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Audit event could not be recorded:", error);
    return false;
  }
}
