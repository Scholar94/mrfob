import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ArrowLeft, LogOut, ShieldCheck, UserRound, Users, KeyRound } from "lucide-react";
import { auth, db, functions } from "./firebase.js";
import { useAuth } from "./AuthProvider.jsx";

export default function Portal({ onClose }) {
  const { user, claims, loading, configured } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState("manager");

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await setDoc(doc(db, "users", credential.user.uid), {
          uid: credential.user.uid, displayName: name.trim(), email: email.trim().toLowerCase(),
          accountType: "customer", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await sendEmailVerification(credential.user);
        setMessage("Your customer account has been created. Please check your email to verify your address.");
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) { setError(err.message || "Unable to complete your request."); }
    finally { setBusy(false); }
  }

  async function addStaff(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const callable = httpsCallable(functions, "setStaffRole");
      await callable({ email: staffEmail.trim().toLowerCase(), staffRole });
      setMessage("Staff permissions updated. The staff member should sign out and sign in again.");
      setStaffEmail("");
    } catch (err) { setError(err.message || "Could not update staff permissions."); }
    finally { setBusy(false); }
  }

  if (!configured) return <div className="portal-backdrop"><section className="portal-card"><button className="portal-close" onClick={onClose}><ArrowLeft/> Back to website</button><div className="portal-brand">MR FOP <span>ACCOUNT PORTAL</span></div><h2>Account services are being configured.</h2><p>Firebase authentication has not been connected yet. The public website remains available. The administrator must complete the Firebase setup before customers can register or sign in.</p><p className="portal-hint">No passwords or personal information should be submitted until this setup is complete.</p></section></div>;

  return <div className="portal-backdrop"><section className="portal-card">
    <button className="portal-close" onClick={onClose}><ArrowLeft/> Back to website</button>
    <div className="portal-brand">MR FOP <span>ACCOUNT PORTAL</span></div>
    {loading ? <p>Checking your account…</p> : user ? <>
      <div className="portal-welcome"><span className="portal-avatar"><UserRound/></span><div><small>WELCOME</small><h2>{user.displayName || user.email}</h2><p>{user.email}</p></div></div>
      <div className="portal-role"><ShieldCheck/><span>{claims.superAdmin ? "Super Administrator" : claims.staffRole ? "Staff · " + claims.staffRole : "Customer account"}</span></div>
      {claims.superAdmin && <form className="portal-form staff-form" onSubmit={addStaff}><h3><Users/> Manage staff access</h3><label>Staff email<input type="email" required value={staffEmail} onChange={e=>setStaffEmail(e.target.value)} placeholder="staff@example.com"/></label><label>Permission level<select value={staffRole} onChange={e=>setStaffRole(e.target.value)}><option value="manager">Manager</option><option value="sales">Sales</option><option value="tailor">Production / Tailor</option><option value="institute">Institute staff</option></select></label><button className="portal-submit" disabled={busy}>{busy ? "Please wait…" : "Save staff permissions"}</button></form>}
      <div className="portal-notice">{claims.superAdmin ? "You have full platform administration access." : claims.staffRole ? "Your staff permissions are active. Available tools will follow your assigned role." : "Your customer account is ready. Customer order and measurement tools will be added in the next development steps."}</div>
      <button className="portal-submit secondary" onClick={()=>signOut(auth)}><LogOut size={16}/> Sign out</button>
    </> : <>
      <h2>{mode === "register" ? "Create your customer account" : "Welcome back"}</h2>
      <p className="portal-subtitle">{mode === "register" ? "Register to access your MR FOP customer account." : "Sign in to continue to your account."}</p>
      <form className="portal-form" onSubmit={submit}>
        {mode === "register" && <label>Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your full name"/></label>}
        <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"/></label>
        <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters"/></label>
        <button className="portal-submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
      {error && <p className="portal-error">{error}</p>}{message && <p className="portal-success">{message}</p>}
      <p className="portal-switch">{mode === "register" ? "Already registered?" : "New to MR FOP?"} <button onClick={()=>{setMode(mode === "register" ? "login" : "register");setError("");setMessage("");}}>{mode === "register" ? "Sign in" : "Create an account"}</button></p>
      <p className="portal-hint"><KeyRound size={14}/> Passwords are handled by Firebase Authentication, not stored in the website database.</p>
    </>}
  </section></div>;
}
