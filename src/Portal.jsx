import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, reload } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { ArrowLeft, LogOut, ShieldCheck, UserRound, Users, KeyRound } from "lucide-react";
import { auth, db } from "./firebase.js";
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
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerForm, setCustomerForm] = useState({ displayName: "", phone: "", address: "" });

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

  async function resendVerification() {
    if (!user) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await sendEmailVerification(user);
      setMessage("A new verification email has been sent. Check your inbox and spam folder.");
    } catch (err) { setError(err.message || "Could not send the verification email."); }
    finally { setBusy(false); }
  }

  async function refreshVerification() {
    if (!user) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        setMessage("Your email is verified. Thank you.");
        window.location.reload();
      } else setMessage("Firebase has not detected verification yet. Open the link in your email, then try again.");
    } catch (err) { setError(err.message || "Could not refresh verification status."); }
    finally { setBusy(false); }
  }

  async function loadCustomers() {
    if (!claims.superAdmin) return;
    setCustomerLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "users"));
      setCustomers(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (a.displayName || "").localeCompare(b.displayName || "")));
    } catch (err) { setError(err.message || "Could not load customer accounts."); }
    finally { setCustomerLoading(false); }
  }

  async function openCustomer(customer) {
    setSelectedCustomer(customer);
    setCustomerForm({ displayName: customer.displayName || "", phone: customer.phone || "", address: customer.address || "" });
    setCustomerOrders([]); setError("");
    try {
      const snapshot = await getDocs(query(collection(db, "orders"), where("customerUid", "==", customer.uid)));
      setCustomerOrders(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    } catch (err) { setError("Customer profile opened, but order history could not be loaded: " + (err.message || "permission error")); }
  }

  async function saveCustomer(e) {
    e.preventDefault();
    if (!claims.superAdmin || !selectedCustomer) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "users", selectedCustomer.uid), { ...customerForm, updatedAt: serverTimestamp() });
      setCustomers(items => items.map(item => item.uid === selectedCustomer.uid ? { ...item, ...customerForm } : item));
      setSelectedCustomer(current => ({ ...current, ...customerForm }));
      setMessage("Customer information updated successfully.");
    } catch (err) { setError(err.message || "Could not update customer information."); }
    finally { setBusy(false); }
  }

  async function loadStaff() {
    if (!claims.superAdmin) return;
    setStaffLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "roles"));
      setStaffMembers(snapshot.docs.map(item => item.data()).filter(item => item.uid && item.role && item.role !== "customer" && item.role !== "superAdmin"));
    } catch (err) { setError(err.message || "Could not load staff accounts."); }
    finally { setStaffLoading(false); }
  }

  async function removeStaff(uid) {
    if (!claims.superAdmin || !uid || uid === user.uid) return;
    if (!window.confirm("Remove this staff member’s access? Their customer account will remain active.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await deleteDoc(doc(db, "roles", uid));
      setStaffMembers(items => items.filter(item => item.uid !== uid));
      setMessage("Staff access removed. Their account remains a customer account.");
    } catch (err) { setError(err.message || "Could not remove staff access."); }
    finally { setBusy(false); }
  }

  async function addStaff(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await getDocs(query(collection(db, "users"), where("email", "==", staffEmail.trim().toLowerCase())));
      if (result.empty) throw new Error("No customer account was found for that email. Ask the staff member to register first.");
      const target = result.docs[0].data();
      if (target.uid === user.uid) throw new Error("You cannot change your own Super Admin access.");
      await setDoc(doc(db, "roles", target.uid), { uid: target.uid, email: target.email, role: staffRole, updatedAt: serverTimestamp() });
      setMessage("Staff permission saved. Ask the staff member to sign out and sign in again.");
      setStaffEmail("");
    } catch (err) { setError(err.message || "Could not update staff permissions."); }
    finally { setBusy(false); }
  }

  React.useEffect(() => { if (claims.superAdmin) { loadStaff(); loadCustomers(); } }, [claims.superAdmin]);

  if (!configured) return <div className="portal-backdrop"><section className="portal-card"><button className="portal-close" onClick={onClose}><ArrowLeft/> Back to website</button><div className="portal-brand">MR FOP <span>ACCOUNT PORTAL</span></div><h2>Account services are being configured.</h2><p>Firebase authentication has not been connected yet. The public website remains available. The administrator must complete the Firebase setup before customers can register or sign in.</p><p className="portal-hint">No passwords or personal information should be submitted until this setup is complete.</p></section></div>;

  return <div className="portal-backdrop"><section className="portal-card">
    <button className="portal-close" onClick={onClose}><ArrowLeft/> Back to website</button>
    <div className="portal-brand">MR FOP <span>ACCOUNT PORTAL</span></div>
    {loading ? <p>Checking your account…</p> : user ? <>
      <div className="portal-welcome"><span className="portal-avatar"><UserRound/></span><div><small>WELCOME</small><h2>{user.displayName || user.email}</h2><p>{user.email}</p></div></div>
      {!user.emailVerified && <div className="verification-panel"><strong>Email verification pending</strong><p>We sent a verification link to <b>{user.email}</b>. Check your inbox and spam folder. Open the link, then return here and refresh your status.</p><div className="verification-actions"><button type="button" onClick={resendVerification} disabled={busy}>{busy ? "Please wait…" : "Resend verification email"}</button><button type="button" onClick={refreshVerification} disabled={busy}>I've verified — refresh</button></div></div>}
      {user.emailVerified && <div className="verification-confirmed">Email address verified</div>}
      {error && <p className="portal-error" role="alert">{error}</p>}{message && <p className="portal-success" role="status">{message}</p>}
      <div className="portal-role"><ShieldCheck/><span>{claims.superAdmin ? "Super Administrator" : claims.staffRole ? "Staff · " + claims.staffRole : "Customer account"}</span></div>
      <h3 className="dashboard-title">{claims.superAdmin ? "Administration overview" : claims.staffRole ? "Staff workspace" : "My customer dashboard"}</h3>
      <div className="dashboard-grid">
        {(claims.superAdmin ? [["Customers","Customer accounts"],["Orders","Order management"],["Measurements","Customer measurement records"],["Institute","Training enquiries"]] : claims.staffRole ? [["My work","Tasks assigned to your role"],["Orders","Role-permitted orders"],["Updates","Work status and updates"]] : [["My profile","Your contact information"],["My orders","Order history and status"],["My measurements","Saved fitting details"],["Training","Fashion Institute enquiries"]]).map(([title,desc])=><article className="dashboard-tile" key={title}><strong>{title}</strong><span>{desc}</span><small>Available in the next build step</small></article>)}
      </div>
      {claims.superAdmin && <section className="customer-management">
        <div className="customer-management-heading"><div><h3>Customer Management</h3><p>View and update registered customer profiles</p></div><button type="button" onClick={loadCustomers} disabled={customerLoading}>{customerLoading ? "Loading…" : "Refresh customers"}</button></div>
        <input className="customer-search" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Search by name, email or phone"/>
        {customerLoading ? <p className="staff-empty">Loading customer accounts…</p> : <div className="customer-list">
          {customers.filter(item => [item.displayName,item.email,item.phone].some(value => (value || "").toLowerCase().includes(customerSearch.toLowerCase()))).map(customer=><article className="customer-row" key={customer.uid}><div><strong>{customer.displayName || "Name not provided"}</strong><span>{customer.email}</span><small>{customer.phone || "No phone number"}</small></div><button type="button" onClick={()=>openCustomer(customer)}>View profile</button></article>)}
          {customers.length === 0 && <p className="staff-empty">No customer accounts found yet.</p>}
        </div>}
      </section>}
      {claims.superAdmin && selectedCustomer && <section className="customer-detail">
        <div className="customer-detail-heading"><h3>Customer profile</h3><button type="button" onClick={()=>setSelectedCustomer(null)}>Close</button></div>
        <form className="portal-form" onSubmit={saveCustomer}>
          <label>Full name<input value={customerForm.displayName} onChange={e=>setCustomerForm({...customerForm,displayName:e.target.value})} required/></label>
          <label>Email address<input value={selectedCustomer.email || ""} disabled/></label>
          <label>Phone number<input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})} placeholder="Customer phone"/></label>
          <label>Address<textarea value={customerForm.address} onChange={e=>setCustomerForm({...customerForm,address:e.target.value})} placeholder="Customer address"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Saving…" : "Save customer changes"}</button>
        </form>
        <h4>Order history</h4>
        {customerOrders.length ? customerOrders.map(order=><article className="customer-order" key={order.id}><strong>{order.orderNumber || order.id}</strong><span>{order.status || "Status not set"}</span><small>{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : "Date not recorded"}</small></article>) : <p className="staff-empty">No orders found for this customer yet.</p>}
      </section>}
      {claims.superAdmin && <section className="staff-management"><div className="staff-management-heading"><h3><Users/> Staff directory</h3><button type="button" onClick={loadStaff} disabled={staffLoading}>{staffLoading ? "Loading…" : "Refresh list"}</button></div>{staffMembers.length ? <div className="staff-list">{staffMembers.map(member=><article className="staff-member" key={member.uid}><div><strong>{member.email || "Staff account"}</strong><span>{member.role}</span></div><button type="button" onClick={()=>removeStaff(member.uid)} disabled={busy}>Remove access</button></article>)}</div> : <p className="staff-empty">No staff permissions are listed yet. Add your first staff member below.</p>}</section>}
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
