import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, reload } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
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
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({ customerUid: "", item: "", description: "", amount: "", dueDate: "" });
  const [myOrders, setMyOrders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ service: "Measurement", appointmentDate: "", appointmentTime: "", purpose: "" });
  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState({ orderId: "", amount: "", method: "Bank transfer", reference: "", note: "" });
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [saleCart, setSaleCart] = useState([]);
  const [saleProductId, setSaleProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [saleForm, setSaleForm] = useState({ customerName: "", paymentMethod: "Cash", amountPaid: "" });
  const [productForm, setProductForm] = useState({ name: "", sku: "", category: "Custom clothing", description: "", price: "", costPrice: "", stock: "0", imageUrl: "" });
  const [stockAdjustments, setStockAdjustments] = useState({});

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

  async function loadOrders() {
    if (!claims.superAdmin && !claims.staffRole) return;
    setOrdersLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "orders"));
      setOrders(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load orders."); }
    finally { setOrdersLoading(false); }
  }

  async function loadMyOrders() {
    if (!user || claims.superAdmin || claims.staffRole) return;
    try {
      const snapshot = await getDocs(query(collection(db, "orders"), where("customerUid", "==", user.uid)));
      setMyOrders(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load your orders."); }
  }

  async function createOrder(e) {
    e.preventDefault();
    if (!claims.superAdmin || !orderForm.customerUid) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const customer = customers.find(item => item.uid === orderForm.customerUid);
      if (!customer) throw new Error("Select a registered customer.");
      const amount = Number(orderForm.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid order amount.");
      const orderNumber = "MFO-" + Date.now().toString().slice(-9);
      const payload = { orderNumber, customerUid: customer.uid, customerName: customer.displayName || "", customerEmail: customer.email || "", item: orderForm.item.trim(), description: orderForm.description.trim(), amount, currency: "NGN", dueDate: orderForm.dueDate || "", status: "received", paymentStatus: "unpaid", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: user.uid };
      await addDoc(collection(db, "orders"), payload);
      setOrderForm({ customerUid: "", item: "", description: "", amount: "", dueDate: "" });
      setMessage("Order " + orderNumber + " created successfully.");
      await loadOrders();
    } catch (err) { setError(err.message || "Could not create the order."); }
    finally { setBusy(false); }
  }

  async function updateOrder(id, changes) {
    if (!claims.superAdmin || !id) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "orders", id), { ...changes, updatedAt: serverTimestamp() });
      setOrders(items => items.map(item => item.id === id ? { ...item, ...changes } : item));
      setMessage("Order updated successfully.");
    } catch (err) { setError(err.message || "Could not update the order."); }
    finally { setBusy(false); }
  }

  async function loadAppointments() {
    if (!user) return;
    setAppointmentsLoading(true); setError("");
    try {
      const source = claims.superAdmin || claims.staffRole ? collection(db, "appointments") : query(collection(db, "appointments"), where("customerUid", "==", user.uid));
      const snapshot = await getDocs(source);
      setAppointments(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (a.appointmentDate || "").localeCompare(b.appointmentDate || "")));
    } catch (err) { setError(err.message || "Could not load appointments."); }
    finally { setAppointmentsLoading(false); }
  }

  async function bookAppointment(e) {
    e.preventDefault();
    if (!user || !appointmentForm.appointmentDate || !appointmentForm.appointmentTime) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await addDoc(collection(db, "appointments"), {
        customerUid: user.uid, customerName: user.displayName || "", customerEmail: user.email || "",
        service: appointmentForm.service, appointmentDate: appointmentForm.appointmentDate,
        appointmentTime: appointmentForm.appointmentTime, purpose: appointmentForm.purpose.trim(),
        status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setAppointmentForm({ service: "Measurement", appointmentDate: "", appointmentTime: "", purpose: "" });
      setMessage("Appointment request submitted. The team will confirm your booking.");
      await loadAppointments();
    } catch (err) { setError(err.message || "Could not submit appointment request."); }
    finally { setBusy(false); }
  }

  async function updateAppointment(id, status) {
    if (!claims.superAdmin || !id) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "appointments", id), { status, updatedAt: serverTimestamp() });
      setAppointments(items => items.map(item => item.id === id ? { ...item, status } : item));
      setMessage("Appointment status updated.");
    } catch (err) { setError(err.message || "Could not update appointment."); }
    finally { setBusy(false); }
  }

  async function loadPayments() {
    if (!user) return;
    try {
      const source = claims.superAdmin || claims.staffRole ? collection(db, "payments") : query(collection(db, "payments"), where("customerUid", "==", user.uid));
      const snapshot = await getDocs(source);
      setPayments(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load payment history."); }
  }

  async function recordPayment(e) {
    e.preventDefault();
    if (!claims.superAdmin || !paymentForm.orderId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const order = orders.find(item => item.id === paymentForm.orderId);
      const amount = Number(paymentForm.amount);
      if (!order) throw new Error("Select an order.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a payment amount greater than zero.");
      await addDoc(collection(db, "payments"), {
        orderId: order.id, orderNumber: order.orderNumber || order.id,
        customerUid: order.customerUid, customerName: order.customerName || "",
        amount, currency: "NGN", method: paymentForm.method,
        reference: paymentForm.reference.trim(), note: paymentForm.note.trim(),
        createdAt: serverTimestamp(), createdBy: user.uid
      });
      setPaymentForm({ orderId: "", amount: "", method: "Bank transfer", reference: "", note: "" });
      setMessage("Payment transaction recorded successfully.");
      await loadPayments();
    } catch (err) { setError(err.message || "Could not record payment."); }
    finally { setBusy(false); }
  }

  async function loadProducts() {
    if (!user) return;
    setProductsLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "products"));
      setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (a.name || "").localeCompare(b.name || "")));
    } catch (err) { setError(err.message || "Could not load products."); }
    finally { setProductsLoading(false); }
  }

  async function createProduct(e) {
    e.preventDefault();
    if (!claims.superAdmin) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const name = productForm.name.trim();
      const sku = productForm.sku.trim();
      const price = Number(productForm.price);
      const stock = Number(productForm.stock);
      if (!name || !sku) throw new Error("Enter both a product name and SKU.");
      const costPrice = Number(productForm.costPrice || 0);
      if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid selling price.");
      if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error("Enter a valid product cost price.");
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Opening stock must be a whole number of zero or more.");
      await addDoc(collection(db, "products"), {
        name, sku, category: productForm.category, description: productForm.description.trim(),
        price, costPrice, currency: "NGN", stock, imageUrl: productForm.imageUrl.trim(), active: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: user.uid
      });
      setProductForm({ name: "", sku: "", category: "Custom clothing", description: "", price: "", costPrice: "", stock: "0", imageUrl: "" });
      setMessage("Product added to inventory successfully.");
      await loadProducts();
    } catch (err) { setError(err.message || "Could not add product."); }
    finally { setBusy(false); }
  }

  async function adjustStock(product, direction) {
    if (!claims.superAdmin || !product?.id) return;
    const quantity = Number(stockAdjustments[product.id] || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("Enter a whole-number quantity greater than zero."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const productRef = doc(db, "products", product.id);
      const movementRef = doc(collection(db, "inventoryMovements"));
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(productRef);
        if (!snapshot.exists()) throw new Error("This product no longer exists.");
        const currentStock = Number(snapshot.data().stock || 0);
        const nextStock = currentStock + (direction === "in" ? quantity : -quantity);
        if (nextStock < 0) throw new Error("There is not enough stock to record this stock-out.");
        transaction.update(productRef, { stock: nextStock, updatedAt: serverTimestamp() });
        transaction.set(movementRef, {
          productId: product.id, productName: product.name, sku: product.sku,
          type: direction, quantity, previousStock: currentStock, newStock: nextStock,
          createdAt: serverTimestamp(), createdBy: user.uid
        });
      });
      setStockAdjustments(current => ({ ...current, [product.id]: "" }));
      setMessage(direction === "in" ? "Stock added successfully." : "Stock issued successfully.");
      await loadProducts();
    } catch (err) { setError(err.message || "Could not update stock."); }
    finally { setBusy(false); }
  }

  async function loadSales() {
    if (!claims.superAdmin) return;
    setSalesLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "sales"));
      setSales(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load sales history."); }
    finally { setSalesLoading(false); }
  }

  function addSaleItem() {
    const product = products.find(item => item.id === saleProductId);
    const quantity = Number(saleQuantity);
    if (!product) { setError("Select a product to add to the sale."); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { setError("Enter a whole-number quantity greater than zero."); return; }
    const existing = saleCart.find(item => item.productId === product.id);
    const nextQuantity = quantity + (existing?.quantity || 0);
    if (nextQuantity > Number(product.stock || 0)) { setError("The requested quantity exceeds the available stock."); return; }
    setError("");
    setSaleCart(current => existing
      ? current.map(item => item.productId === product.id ? { ...item, quantity: nextQuantity } : item)
      : [...current, { productId: product.id, name: product.name, sku: product.sku, price: Number(product.price || 0), quantity }]);
    setSaleProductId(""); setSaleQuantity("1");
  }

  async function completeSale(e) {
    e.preventDefault();
    if (!claims.superAdmin || !saleCart.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const amountPaid = Number(saleForm.amountPaid);
      if (!Number.isFinite(amountPaid) || amountPaid < 0) throw new Error("Enter a valid amount received (zero or more).");
      const saleRef = doc(collection(db, "sales"));
      const receiptNumber = "MFS-" + Date.now().toString().slice(-9);
      await runTransaction(db, async transaction => {
        const productRefs = saleCart.map(item => doc(db, "products", item.productId));
        const snapshots = [];
        for (const productRef of productRefs) snapshots.push(await transaction.get(productRef));
        let subtotal = 0;
        let totalCost = 0;
        const saleItems = [];
        snapshots.forEach((snapshot, index) => {
          if (!snapshot.exists()) throw new Error("A product in this cart no longer exists.");
          const product = snapshot.data();
          const cartItem = saleCart[index];
          const quantity = cartItem.quantity;
          const available = Number(product.stock || 0);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > available) throw new Error("Insufficient stock for " + (product.name || cartItem.name) + ". Refresh inventory and try again.");
          const price = Number(product.price || 0);
          const costPrice = Number(product.costPrice || 0);
          subtotal += price * quantity;
          totalCost += costPrice * quantity;
          saleItems.push({ productId: cartItem.productId, name: product.name || cartItem.name, sku: product.sku || cartItem.sku, quantity, unitPrice: price, unitCost: costPrice, lineTotal: price * quantity });
        });
        const total = subtotal;
        if (amountPaid > total) throw new Error("Amount received cannot exceed the sale total.");
        saleItems.forEach((item, index) => {
          const productRef = productRefs[index];
          const currentStock = Number(snapshots[index].data().stock || 0);
          const nextStock = currentStock - item.quantity;
          transaction.update(productRef, { stock: nextStock, updatedAt: serverTimestamp() });
          const movementRef = doc(collection(db, "inventoryMovements"));
          transaction.set(movementRef, {
            productId: item.productId, productName: item.name, sku: item.sku,
            type: "out", quantity: item.quantity, previousStock: currentStock,
            newStock: nextStock, createdAt: serverTimestamp(), createdBy: user.uid,
            reason: "sale", receiptNumber
          });
        });
        transaction.set(saleRef, {
          receiptNumber, customerName: saleForm.customerName.trim() || "Walk-in customer",
          items: saleItems, subtotal, total, totalCost, grossProfit: total - totalCost,
          amountPaid, balance: total - amountPaid,
          paymentStatus: amountPaid >= total ? "paid" : amountPaid > 0 ? "part_paid" : "unpaid",
          paymentMethod: saleForm.paymentMethod, currency: "NGN",
          createdAt: serverTimestamp(), createdBy: user.uid
        });
      });
      setSaleCart([]); setSaleForm({ customerName: "", paymentMethod: "Cash", amountPaid: "" });
      setMessage("Sale completed. Receipt " + receiptNumber + " has been saved and inventory updated.");
      await Promise.all([loadProducts(), loadSales()]);
    } catch (err) { setError(err.message || "Could not complete the sale."); }
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

  React.useEffect(() => { if (claims.superAdmin) { loadStaff(); loadCustomers(); loadOrders(); loadSales(); } else if (claims.staffRole) loadOrders(); else if (user) loadMyOrders(); if (user) { loadAppointments(); loadPayments(); loadProducts(); } }, [claims.superAdmin, claims.staffRole, user?.uid]);

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
      {(claims.superAdmin || claims.staffRole) && <section className="order-management">
        <div className="customer-management-heading"><div><h3>Order Management</h3><p>Create orders and monitor production and payment</p></div><button type="button" onClick={loadOrders} disabled={ordersLoading}>{ordersLoading ? "Loading…" : "Refresh orders"}</button></div>
        {claims.superAdmin && <form className="portal-form order-create-form" onSubmit={createOrder}>
          <h4>Create a new order</h4>
          <label>Customer<select required value={orderForm.customerUid} onChange={e=>setOrderForm({...orderForm,customerUid:e.target.value})}><option value="">Select a registered customer</option>{customers.map(customer=><option key={customer.uid} value={customer.uid}>{customer.displayName || customer.email} — {customer.email}</option>)}</select></label>
          <label>Item / service<input required value={orderForm.item} onChange={e=>setOrderForm({...orderForm,item:e.target.value})} placeholder="e.g. Custom dress, suit"/></label>
          <label>Order description<textarea value={orderForm.description} onChange={e=>setOrderForm({...orderForm,description:e.target.value})} placeholder="Style, fabric, colour, instructions…"/></label>
          <label>Order amount (₦)<input type="number" min="0" step="0.01" required value={orderForm.amount} onChange={e=>setOrderForm({...orderForm,amount:e.target.value})} placeholder="0.00"/></label>
          <label>Expected delivery date<input type="date" value={orderForm.dueDate} onChange={e=>setOrderForm({...orderForm,dueDate:e.target.value})}/></label>
          <button className="portal-submit" disabled={busy || customers.length===0}>{busy ? "Saving…" : "Create order"}</button>
        </form>}
        {ordersLoading ? <p className="staff-empty">Loading orders…</p> : orders.length ? <div className="order-list">{orders.map(order=><article className="order-card" key={order.id}>
          <div className="order-card-top"><div><strong>{order.orderNumber || order.id}</strong><span>{order.customerName || order.customerEmail || "Customer"}</span></div><b>₦{Number(order.amount || 0).toLocaleString("en-NG")}</b></div>
          <p>{order.item || "Order item"}{order.description ? " — " + order.description : ""}</p>
          <div className="order-meta"><span>Delivery: {order.dueDate || "Not set"}</span><span>Payment: {order.paymentStatus || "unpaid"}</span></div>
          {claims.superAdmin ? <div className="order-controls"><label>Production status<select value={order.status || "received"} disabled={busy} onChange={e=>updateOrder(order.id,{status:e.target.value})}><option value="received">Received</option><option value="confirmed">Confirmed</option><option value="in_production">In production</option><option value="ready">Ready for collection</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label><label>Payment status<select value={order.paymentStatus || "unpaid"} disabled={busy} onChange={e=>updateOrder(order.id,{paymentStatus:e.target.value})}><option value="unpaid">Unpaid</option><option value="deposit_paid">Deposit paid</option><option value="part_paid">Part paid</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select></label></div> : <div className="order-meta"><span>Status: {String(order.status || "received").replaceAll("_"," ")}</span></div>}
        </article>)}</div> : <p className="staff-empty">No orders have been created yet.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="order-management"><div className="customer-management-heading"><div><h3>My Orders</h3><p>Track your orders and payment status</p></div></div>{myOrders.length ? myOrders.map(order=><article className="order-card" key={order.id}><div className="order-card-top"><strong>{order.orderNumber || order.id}</strong><b>₦{Number(order.amount || 0).toLocaleString("en-NG")}</b></div><p>{order.item || "Order"}</p><div className="order-meta"><span>Status: {String(order.status || "received").replaceAll("_"," ")}</span><span>Payment: {String(order.paymentStatus || "unpaid").replaceAll("_"," ")}</span></div></article>) : <p className="staff-empty">You don't have any orders yet.</p>}</section>}
      <section className="appointment-management">
        <div className="customer-management-heading"><div><h3>{claims.superAdmin || claims.staffRole ? "Appointment Management" : "My Appointments"}</h3><p>Book measurements, fittings and consultations</p></div><button type="button" onClick={loadAppointments} disabled={appointmentsLoading}>{appointmentsLoading ? "Loading…" : "Refresh"}</button></div>
        {!claims.staffRole && !claims.superAdmin && <form className="portal-form appointment-form" onSubmit={bookAppointment}>
          <h4>Request an appointment</h4>
          <label>Appointment type<select value={appointmentForm.service} onChange={e=>setAppointmentForm({...appointmentForm,service:e.target.value})}><option>Measurement</option><option>Fitting</option><option>Consultation</option><option>Collection</option></select></label>
          <label>Preferred date<input type="date" min={new Date().toISOString().slice(0,10)} required value={appointmentForm.appointmentDate} onChange={e=>setAppointmentForm({...appointmentForm,appointmentDate:e.target.value})}/></label>
          <label>Preferred time<input type="time" required value={appointmentForm.appointmentTime} onChange={e=>setAppointmentForm({...appointmentForm,appointmentTime:e.target.value})}/></label>
          <label>Additional details<textarea value={appointmentForm.purpose} onChange={e=>setAppointmentForm({...appointmentForm,purpose:e.target.value})} placeholder="Tell us what you need…"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Submitting…" : "Request appointment"}</button>
        </form>}
        {appointmentsLoading ? <p className="staff-empty">Loading appointments…</p> : appointments.length ? <div className="appointment-list">{appointments.map(item=><article className="appointment-card" key={item.id}>
          <div><strong>{item.service}</strong><span>{item.customerName || item.customerEmail || "Customer"}</span></div>
          <p>{item.appointmentDate} at {item.appointmentTime}</p>{item.purpose && <p>{item.purpose}</p>}
          {claims.superAdmin ? <label className="appointment-status">Booking status<select value={item.status || "pending"} disabled={busy} onChange={e=>updateAppointment(item.id,e.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label> : <span className="appointment-status-text">Status: {item.status || "pending"}</span>}
        </article>)}</div> : <p className="staff-empty">No appointments yet.</p>}
      </section>
      {(claims.superAdmin || claims.staffRole) && <section className="payment-management">
        <div className="customer-management-heading"><div><h3>Payment Management</h3><p>Record and review payments linked to customer orders</p></div><button type="button" onClick={loadPayments}>Refresh payments</button></div>
        {claims.superAdmin && <form className="portal-form payment-form" onSubmit={recordPayment}>
          <h4>Record a payment</h4>
          <label>Customer order<select required value={paymentForm.orderId} onChange={e=>setPaymentForm({...paymentForm,orderId:e.target.value})}><option value="">Select an order</option>{orders.map(order=><option key={order.id} value={order.id}>{order.orderNumber || order.id} — {order.customerName || order.customerEmail}</option>)}</select></label>
          <label>Amount received (₦)<input type="number" min="0.01" step="0.01" required value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} placeholder="0.00"/></label>
          <label>Payment method<select value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm,method:e.target.value})}><option>Bank transfer</option><option>Cash</option><option>POS</option><option>Card</option><option>Other</option></select></label>
          <label>Transaction reference<input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm,reference:e.target.value})} placeholder="Optional receipt/reference number"/></label>
          <label>Note<textarea value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})} placeholder="Optional payment note"/></label>
          <button className="portal-submit" disabled={busy || orders.length===0}>{busy ? "Saving…" : "Record payment"}</button>
        </form>}
        {payments.length ? <div className="payment-list">{payments.map(payment=><article className="payment-card" key={payment.id}><div><strong>{payment.orderNumber}</strong><span>{payment.customerName || "Customer"} · {payment.method}</span></div><b>₦{Number(payment.amount || 0).toLocaleString("en-NG")}</b><small>{payment.reference || "No reference"}{payment.createdAt?.toDate ? " · " + payment.createdAt.toDate().toLocaleDateString() : ""}</small></article>)}</div> : <p className="staff-empty">No payment transactions recorded yet.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="payment-management"><div className="customer-management-heading"><div><h3>My Payment History</h3><p>Payments recorded against your orders</p></div><button type="button" onClick={loadPayments}>Refresh</button></div>{payments.length ? <div className="payment-list">{payments.map(payment=><article className="payment-card" key={payment.id}><div><strong>{payment.orderNumber}</strong><span>{payment.method}</span></div><b>₦{Number(payment.amount || 0).toLocaleString("en-NG")}</b><small>{payment.reference || "No reference"}</small></article>)}</div> : <p className="staff-empty">No payment transactions recorded yet.</p>}</section>}
      {claims.superAdmin && <section className="pos-management">
        <div className="customer-management-heading"><div><h3>Sales & Point of Sale</h3><p>Create sales, issue receipts and update stock automatically</p></div><button type="button" onClick={loadSales} disabled={salesLoading}>{salesLoading ? "Loading…" : "Refresh sales"}</button></div>
        <form className="portal-form pos-form" onSubmit={completeSale}>
          <h4>New sale</h4>
          <label>Customer name (optional)<input value={saleForm.customerName} onChange={e=>setSaleForm({...saleForm,customerName:e.target.value})} placeholder="Leave blank for walk-in customer"/></label>
          <div className="pos-add-row"><label>Product<select value={saleProductId} onChange={e=>setSaleProductId(e.target.value)}><option value="">Select product</option>{products.filter(product=>product.active !== false && Number(product.stock || 0) > 0).map(product=><option key={product.id} value={product.id}>{product.name} — {product.sku} · {Number(product.stock || 0)} available</option>)}</select></label><label>Qty<input type="number" min="1" step="1" value={saleQuantity} onChange={e=>setSaleQuantity(e.target.value)}/></label><button type="button" onClick={addSaleItem}>Add item</button></div>
          {saleCart.length ? <div className="pos-cart">{saleCart.map(item=><div className="pos-cart-row" key={item.productId}><div><strong>{item.name}</strong><span>{item.sku} · {item.quantity} × ₦{item.price.toLocaleString("en-NG")}</span></div><b>₦{(item.quantity*item.price).toLocaleString("en-NG")}</b><button type="button" onClick={()=>setSaleCart(items=>items.filter(row=>row.productId!==item.productId))}>Remove</button></div>)}</div> : <p className="staff-empty">No products added to this sale yet.</p>}
          <div className="pos-total"><span>Sale total</span><strong>₦{saleCart.reduce((sum,item)=>sum+item.quantity*item.price,0).toLocaleString("en-NG")}</strong></div>
          <label>Payment method<select value={saleForm.paymentMethod} onChange={e=>setSaleForm({...saleForm,paymentMethod:e.target.value})}><option>Cash</option><option>Bank transfer</option><option>POS</option><option>Card</option><option>Other</option></select></label>
          <label>Amount received (₦)<input type="number" min="0" step="0.01" value={saleForm.amountPaid} onChange={e=>setSaleForm({...saleForm,amountPaid:e.target.value})} placeholder="Enter amount paid"/></label>
          <button className="portal-submit" disabled={busy || !saleCart.length}>{busy ? "Processing sale…" : "Complete sale & generate receipt"}</button>
        </form>
        <div className="pos-report-grid">
          <article><span>Today's sales</span><strong>₦{sales.filter(sale=>sale.createdAt?.toDate && sale.createdAt.toDate().toDateString()===new Date().toDateString()).reduce((sum,sale)=>sum+Number(sale.total||0),0).toLocaleString("en-NG")}</strong></article>
          <article><span>This week's sales</span><strong>₦{sales.filter(sale=>sale.createdAt?.toDate && (Date.now()-sale.createdAt.toDate().getTime())<=7*86400000).reduce((sum,sale)=>sum+Number(sale.total||0),0).toLocaleString("en-NG")}</strong></article>
          <article><span>This month's sales</span><strong>₦{sales.filter(sale=>sale.createdAt?.toDate && sale.createdAt.toDate().getMonth()===new Date().getMonth() && sale.createdAt.toDate().getFullYear()===new Date().getFullYear()).reduce((sum,sale)=>sum+Number(sale.total||0),0).toLocaleString("en-NG")}</strong></article>
          <article><span>Recorded gross profit</span><strong>₦{sales.reduce((sum,sale)=>sum+Number(sale.grossProfit||0),0).toLocaleString("en-NG")}</strong></article>
        </div>
        <h4 className="pos-history-title">Sales history</h4>
        {salesLoading ? <p className="staff-empty">Loading sales…</p> : sales.length ? <div className="pos-history">{sales.map(sale=><article className="pos-sale-card" key={sale.id}><div><strong>{sale.receiptNumber}</strong><span>{sale.customerName} · {sale.paymentMethod}</span></div><b>₦{Number(sale.total||0).toLocaleString("en-NG")}</b><small>{sale.items?.map(item=>item.name+" × "+item.quantity).join(", ")} · {sale.paymentStatus} · Profit ₦{Number(sale.grossProfit||0).toLocaleString("en-NG")}</small></article>)}</div> : <p className="staff-empty">No sales recorded yet.</p>}
      </section>}
      {claims.superAdmin && <section className="inventory-management">
        <div className="customer-management-heading"><div><h3>Inventory & Product Management</h3><p>Add products, monitor stock and record stock movements</p></div><button type="button" onClick={loadProducts} disabled={productsLoading}>{productsLoading ? "Loading…" : "Refresh inventory"}</button></div>
        <form className="portal-form inventory-form" onSubmit={createProduct}>
          <h4>Add a product</h4>
          <label>Product name<input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Senator fabric set"/></label>
          <label>SKU / product code<input required value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="e.g. MFO-001"/></label>
          <label>Category<select value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}><option>Custom clothing</option><option>Ready-to-wear</option><option>Fabrics</option><option>Accessories</option><option>Footwear</option><option>Other</option></select></label>
          <label>Description<textarea value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})} placeholder="Product details, material, colour, sizes…"/></label>
          <label>Selling price (₦)<input type="number" min="0" step="0.01" required value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})} placeholder="0.00"/></label>\n          <label>Product cost price (₦)<input type="number" min="0" step="0.01" required value={productForm.costPrice} onChange={e=>setProductForm({...productForm,costPrice:e.target.value})} placeholder="What the business paid to make or buy it"/></label>
          <label>Opening stock (whole units)<input type="number" min="0" step="1" required value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></label>
          <label>Product image URL (optional)<input type="url" value={productForm.imageUrl} onChange={e=>setProductForm({...productForm,imageUrl:e.target.value})} placeholder="https://…"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Saving…" : "Add product"}</button>
        </form>
        {productsLoading ? <p className="staff-empty">Loading inventory…</p> : products.length ? <div className="inventory-list">{products.map(product=><article className="inventory-card" key={product.id}>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy"/>}
          <div className="inventory-product-info"><strong>{product.name}</strong><span>{product.sku} · {product.category}</span><p>{product.description || "No description added."}</p><b>₦{Number(product.price || 0).toLocaleString("en-NG")}</b><span className={Number(product.stock || 0) <= 5 ? "stock-low" : "stock-ok"}>Stock available: {Number(product.stock || 0)}</span></div>
          <div className="stock-adjust"><input type="number" min="1" step="1" value={stockAdjustments[product.id] || ""} onChange={e=>setStockAdjustments(current=>({...current,[product.id]:e.target.value}))} placeholder="Quantity"/><button type="button" disabled={busy} onClick={()=>adjustStock(product,"in")}>Stock in</button><button type="button" disabled={busy} onClick={()=>adjustStock(product,"out")}>Stock out</button></div>
        </article>)}</div> : <p className="staff-empty">No products added yet. Use the form above to create your first product.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="inventory-management">
        <div className="customer-management-heading"><div><h3>Product Catalogue</h3><p>Browse products and current availability</p></div><button type="button" onClick={loadProducts} disabled={productsLoading}>{productsLoading ? "Loading…" : "Refresh catalogue"}</button></div>
        {productsLoading ? <p className="staff-empty">Loading products…</p> : products.filter(product=>product.active !== false).length ? <div className="inventory-list">{products.filter(product=>product.active !== false).map(product=><article className="inventory-card customer-product-card" key={product.id}>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy"/>}
          <div className="inventory-product-info"><strong>{product.name}</strong><span>{product.category}</span><p>{product.description || "Contact us for more details."}</p><b>₦{Number(product.price || 0).toLocaleString("en-NG")}</b><span className={Number(product.stock || 0) > 0 ? "stock-ok" : "stock-low"}>{Number(product.stock || 0) > 0 ? "In stock" : "Currently out of stock"}</span></div>
        </article>)}</div> : <p className="staff-empty">Our product catalogue is being updated. Please check again soon.</p>}
      </section>}
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
