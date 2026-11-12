import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, sendPasswordResetEmail, reload } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, LogOut, ShieldCheck, UserRound, Users, KeyRound } from "lucide-react";
import { auth, db } from "./firebase.js";
import { useAuth } from "./AuthProvider.jsx";
import InstituteWorkspace from "./InstituteWorkspace.jsx";

const PRODUCTION_STAGES = [
  ["received", "Order received"],
  ["designer_review", "Designer review"],
  ["awaiting_measurements", "Awaiting measurements"],
  ["measurements_completed", "Measurements completed"],
  ["awaiting_quotation_approval", "Awaiting quotation approval"],
  ["awaiting_deposit", "Awaiting deposit"],
  ["confirmed", "Order confirmed"],
  ["fabric_preparation", "Fabric preparation"],
  ["cutting", "Cutting"],
  ["sewing", "Sewing"],
  ["finishing", "Finishing"],
  ["quality_control", "Quality control"],
  ["ready_for_fitting", "Ready for fitting"],
  ["alterations", "Alterations"],
  ["completed", "Production completed"],
  ["ready_for_collection", "Ready for collection"],
  ["dispatched", "Dispatched"],
  ["delivered", "Delivered"]
];

const MEASUREMENT_PROFILES = {
  "General body profile": [["chest","Chest"],["waist","Waist"],["hip","Hip"],["shoulder","Shoulder"],["neck","Neck"]],
  "Men’s shirt": [["chest","Chest"],["waist","Waist"],["shoulder","Shoulder"],["neck","Neck"],["sleeve","Sleeve length"],["bicep","Bicep"],["wrist","Wrist"],["armhole","Armhole"],["shirtLength","Shirt length"],["acrossBack","Across back"]],
  "Trousers": [["waist","Waist"],["hip","Hip"],["inseam","Inside leg"],["outseam","Outside leg"],["thigh","Thigh"],["knee","Knee"],["ankle","Ankle opening"],["frontRise","Front rise"],["backRise","Back rise"]],
  "Dress / Gown": [["bust","Bust"],["underBust","Under bust"],["waist","Waist"],["hip","Hip"],["shoulder","Shoulder"],["sleeve","Sleeve length"],["armhole","Armhole"],["bustPoint","Bust point"],["dressLength","Dress length"]],
  "Skirt": [["waist","Waist"],["hip","Hip"],["waistToHip","Waist to hip"],["skirtLength","Skirt length"]],
  "Jacket": [["chest","Chest"],["waist","Waist"],["shoulder","Shoulder"],["sleeve","Sleeve length"],["neck","Neck"],["bicep","Bicep"],["wrist","Wrist"],["armhole","Armhole"],["jacketLength","Jacket length"],["acrossBack","Across back"]],
  "Blouse": [["bust","Bust"],["waist","Waist"],["shoulder","Shoulder"],["sleeve","Sleeve length"],["neck","Neck"],["armhole","Armhole"],["blouseLength","Blouse length"]]
};
const ALL_MEASUREMENT_FIELDS = [...new Set(Object.values(MEASUREMENT_PROFILES).flat().map(([key]) => key))];

const MEASUREMENT_FIELD_GUIDANCE = {
  chest: "circumference", waist: "circumference", hip: "circumference", neck: "circumference",
  bust: "circumference", underBust: "circumference", bicep: "circumference", wrist: "circumference",
  thigh: "circumference", knee: "circumference", ankle: "circumference",
  shoulder: "span", acrossBack: "span", armhole: "circumference",
  sleeve: "length", length: "length", inseam: "length", outseam: "length",
  shirtLength: "length", dressLength: "length", skirtLength: "length", jacketLength: "length",
  blouseLength: "length", waistToHip: "length", frontRise: "length", backRise: "length", bustPoint: "length"
};
function getMeasurementWarnings(form) {
  const fields = MEASUREMENT_PROFILES[form.garmentType] || MEASUREMENT_PROFILES["General body profile"];
  return fields.flatMap(([key, label]) => {
    const raw = String(form[key] ?? "").trim();
    if (!raw || !Number.isFinite(Number(raw)) || Number(raw) <= 0) return [];
    const cm = Number(form.unit === "in" ? Number(raw) * 2.54 : raw);
    const kind = MEASUREMENT_FIELD_GUIDANCE[key] || "length";
    const limits = kind === "circumference" ? [20, 220] : kind === "span" ? [5, 100] : [5, 220];
    if (cm < limits[0] || cm > limits[1]) return [`${label} (${cm.toFixed(1)} cm) looks unusual. Please check the tape position, unit and entry.`];
    return [];
  });
}



function productionStageLabel(value) {
  return PRODUCTION_STAGES.find(([stage]) => stage === value)?.[1] || String(value || "Order received").replaceAll("_", " ");
}

function productionStageProgress(value) {
  const index = PRODUCTION_STAGES.findIndex(([stage]) => stage === (value || "received"));
  const safeIndex = Math.max(0, index);
  return { current: safeIndex + 1, total: PRODUCTION_STAGES.length, percent: Math.round(((safeIndex + 1) / PRODUCTION_STAGES.length) * 100) };
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const QUOTE_LINE_ITEMS = ["Garment / agreed scope", "Fabric", "Labour", "Design", "Accessories", "Delivery"];

export default function Portal({ onClose }) {
  const { user, claims, loading, configured } = useAuth();
  const canUpdateProduction = !!(claims.superAdmin || ["manager", "sales", "tailor"].includes(claims.staffRole));
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
  const [quoteEdits, setQuoteEdits] = useState({});
  const [deliveryDateEdits, setDeliveryDateEdits] = useState({});
  const [myOrders, setMyOrders] = useState([]);
  const [customerOrderForm, setCustomerOrderForm] = useState({ category: "Men’s clothing", item: "", fabric: "", colour: "", quantity: "1", instructions: "", measurementMethod: "I need a measurement appointment", preferredDate: "", deliveryMethod: "Collection at the studio" });
  const [profileForm, setProfileForm] = useState({ displayName: "", phone: "", address: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({ profileName: "My measurements", garmentType: "General body profile", chest: "", waist: "", hip: "", shoulder: "", sleeve: "", length: "", neck: "", inseam: "", bicep: "", wrist: "", armhole: "", shirtLength: "", acrossBack: "", outseam: "", thigh: "", knee: "", ankle: "", frontRise: "", backRise: "", bust: "", underBust: "", bustPoint: "", dressLength: "", waistToHip: "", skirtLength: "", jacketLength: "", blouseLength: "", unit: "cm", notes: "" });
  const [measurements, setMeasurements] = useState([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(false);
  const [trainingForm, setTrainingForm] = useState({ course: "Fashion Design", mode: "Onsite practical training", message: "" });
  const [trainingEnquiries, setTrainingEnquiries] = useState([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [allMeasurements, setAllMeasurements] = useState([]);
  const [allTrainingEnquiries, setAllTrainingEnquiries] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ service: "Measurement", appointmentDate: "", appointmentTime: "", purpose: "" });
  const [appointmentEdits, setAppointmentEdits] = useState({});
  const [payments, setPayments] = useState([]);
  const [paymentDeclarations, setPaymentDeclarations] = useState([]);
  const [declarationForm, setDeclarationForm] = useState({ orderId: "", amount: "", reference: "", transferDate: localDateString(), payerName: "", note: "" });
  const [declarationsLoading, setDeclarationsLoading] = useState(false);
  const [declarationReviewNotes, setDeclarationReviewNotes] = useState({});
  const [paymentForm, setPaymentForm] = useState({ orderId: "", amount: "", method: "Bank transfer", reference: "", note: "" });
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ title: "", category: "Operations", amount: "", expenseDate: localDateString(), method: "Cash", note: "" });
  const [expenseEditingId, setExpenseEditingId] = useState("");
  const [financePeriod, setFinancePeriod] = useState("month");
  const [financeStart, setFinanceStart] = useState(localDateString(new Date(new Date().getFullYear(),new Date().getMonth(),1)));
  const [financeEnd, setFinanceEnd] = useState(localDateString());
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");
  const [saleCart, setSaleCart] = useState([]);
  const [saleProductId, setSaleProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [saleForm, setSaleForm] = useState({ customerName: "", paymentMethod: "Cash", amountPaid: "" });
  const [editingProductId, setEditingProductId] = useState("");
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

  async function sendPasswordReset() {
    setBusy(true); setError(""); setMessage("");
    try {
      const address = email.trim();
      if (!address) throw new Error("Enter the email address registered to your account.");
      await sendPasswordResetEmail(auth, address);
      setMessage("If an account exists for this email, Firebase has sent a password-reset link. Check your inbox and spam folder.");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setMessage("If an account exists for this email, Firebase has sent a password-reset link. Check your inbox and spam folder.");
      } else setError(err.message || "Could not send the password-reset email.");
    } finally { setBusy(false); }
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
      const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      const enriched = await Promise.all(rows.map(async order => {
        const events = await getDocs(query(collection(db, "orders", order.id, "events")));
        return { ...order, events: events.docs.map(event => ({ id: event.id, ...event.data() })).sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) };
      }));
      setOrders(enriched.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load orders."); }
    finally { setOrdersLoading(false); }
  }

  async function loadMyOrders() {
    if (!user || claims.superAdmin || claims.staffRole) return;
    try {
      const snapshot = await getDocs(query(collection(db, "orders"), where("customerUid", "==", user.uid)));
      const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      const enriched = await Promise.all(rows.map(async order => {
        const events = await getDocs(query(collection(db, "orders", order.id, "events")));
        return { ...order, events: events.docs.map(event => ({ id: event.id, ...event.data() })).sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) };
      }));
      setMyOrders(enriched.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load your orders."); }
  }

  async function loadMyProfile() {
    if (!user || claims.superAdmin || claims.staffRole) return;
    setProfileLoading(true);
    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      const data = snapshot.exists() ? snapshot.data() : {};
      setProfileForm({ displayName: data.displayName || user.displayName || "", phone: data.phone || "", address: data.address || "" });
    } catch (err) { setError(err.message || "Could not load your profile."); }
    finally { setProfileLoading(false); }
  }

  async function saveMyProfile(e) {
    e.preventDefault();
    if (!user || claims.superAdmin || claims.staffRole) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const displayName = profileForm.displayName.trim();
      if (!displayName) throw new Error("Enter your full name.");
      await updateDoc(doc(db, "users", user.uid), { displayName, phone: profileForm.phone.trim(), address: profileForm.address.trim(), updatedAt: serverTimestamp() });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName });
      setMessage("Your profile has been updated successfully.");
    } catch (err) { setError(err.message || "Could not update your profile."); }
    finally { setBusy(false); }
  }

  async function loadMeasurements() {
    if (!user || claims.superAdmin || claims.staffRole) return;
    setMeasurementsLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "measurements"), where("customerUid", "==", user.uid)));
      setMeasurements(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load your measurement records."); }
    finally { setMeasurementsLoading(false); }
  }

  async function saveMeasurement(e) {
    e.preventDefault();
    if (!user || claims.superAdmin || claims.staffRole) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const values = {};
      ALL_MEASUREMENT_FIELDS.forEach(key => {
        const raw = String(measurementForm[key] ?? "").trim();
        if (raw && (!Number.isFinite(Number(raw)) || Number(raw) <= 0)) throw new Error("Enter a positive number for " + key + " or leave it blank.");
        values[key] = raw ? Number((measurementForm.unit === "in" ? Number(raw) * 2.54 : Number(raw)).toFixed(1)) : null;
      });
      const activeFields = MEASUREMENT_PROFILES[measurementForm.garmentType] || MEASUREMENT_PROFILES["General body profile"];
      if (!activeFields.some(([key]) => values[key] !== null)) throw new Error("Enter at least one measurement for this garment profile.");
      const profileName = measurementForm.profileName.trim() || measurementForm.garmentType;
      await addDoc(collection(db, "measurements"), {
        customerUid: user.uid, customerName: user.displayName || profileForm.displayName || "",
        profileName, garmentType: measurementForm.garmentType, ...values,
        notes: measurementForm.notes.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setMeasurementForm(current => ({ ...current, profileName: "My measurements", ...Object.fromEntries(ALL_MEASUREMENT_FIELDS.map(key => [key, ""])), unit: "cm", notes: "" }));
      setMessage("Your garment measurement profile has been saved. Values are stored in centimetres.");
      await loadMeasurements();
    } catch (err) { setError(err.message || "Could not save your measurements."); }
    finally { setBusy(false); }
  }

  function reuseMeasurementProfile(item) {
    const values = Object.fromEntries(ALL_MEASUREMENT_FIELDS.map(key => [key, item[key] == null ? "" : String(item[key])]));
    setMeasurementForm(current => ({ ...current, ...values, profileName: (item.profileName || item.garmentType || "Saved profile") + " (copy)", garmentType: item.garmentType || "General body profile", unit: "cm", notes: item.notes || "" }));
    setMessage("Saved measurements loaded into the form. Review and save to create a new profile.");
  }

  async function loadTrainingEnquiries() {
    if (!user || claims.superAdmin || claims.staffRole) return;
    setTrainingLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "trainingEnquiries"), where("customerUid", "==", user.uid)));
      setTrainingEnquiries(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load your training enquiries."); }
    finally { setTrainingLoading(false); }
  }

  async function submitTrainingEnquiry(e) {
    e.preventDefault();
    if (!user || claims.superAdmin || claims.staffRole) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await addDoc(collection(db, "trainingEnquiries"), { customerUid: user.uid, customerName: user.displayName || profileForm.displayName || "", customerEmail: user.email || "", course: trainingForm.course, mode: trainingForm.mode, message: trainingForm.message.trim(), status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setTrainingForm({ course: "Fashion Design", mode: "Onsite practical training", message: "" });
      setMessage("Your Fashion Institute enquiry has been submitted.");
      await loadTrainingEnquiries();
    } catch (err) { setError(err.message || "Could not submit your training enquiry."); }
    finally { setBusy(false); }
  }

  async function loadAdminCustomerServices() {
    if (!(claims.superAdmin || ["manager", "tailor"].includes(claims.staffRole))) return;
    try {
      const [measurementSnapshot, trainingSnapshot] = await Promise.all([getDocs(collection(db, "measurements")), getDocs(collection(db, "trainingEnquiries"))]);
      setAllMeasurements(measurementSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setAllTrainingEnquiries(trainingSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load customer measurement and training records."); }
  }

  async function reviewMeasurement(id, verificationStatus, verificationNote) {
    if (!(claims.superAdmin || ["manager", "tailor"].includes(claims.staffRole)) || !id) return;
    if (!["pending", "verified", "revision-needed"].includes(verificationStatus)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const reviewedAt = serverTimestamp();
      await updateDoc(doc(db, "measurements", id), {
        verificationStatus, verificationNote: String(verificationNote || "").trim().slice(0,1000),
        verifiedByUid: user.uid, verifiedByName: user.displayName || user.email || "Authorized staff",
        verifiedAt: reviewedAt, updatedAt: serverTimestamp()
      });
      setAllMeasurements(items => items.map(item => item.id === id ? { ...item, verificationStatus, verificationNote: String(verificationNote || "").trim().slice(0,1000), verifiedByUid: user.uid, verifiedByName: user.displayName || user.email || "Authorized staff" } : item));
      setMessage("Measurement review saved.");
    } catch (err) { setError(err.message || "Could not save the measurement review."); }
    finally { setBusy(false); }
  }

  async function updateTrainingStatus(id, status) {
    if (!claims.superAdmin || !id) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "trainingEnquiries", id), { status, updatedAt: serverTimestamp() });
      setAllTrainingEnquiries(items => items.map(item => item.id === id ? { ...item, status } : item));
      setMessage("Training enquiry status updated.");
    } catch (err) { setError(err.message || "Could not update the training enquiry."); }
    finally { setBusy(false); }
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

  async function submitCustomerOrder(e) {
    e.preventDefault();
    if (!user || claims.superAdmin || claims.staffRole) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const item = customerOrderForm.item.trim();
      if (!item) throw new Error("Describe the garment or service you want.");
      const quantity = Number(customerOrderForm.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new Error("Quantity must be a whole number between 1 and 50.");
      const orderNumber = "MFO-REQ-" + Date.now().toString().slice(-8);
      const description = ["Category: " + customerOrderForm.category, "Fabric preference: " + (customerOrderForm.fabric.trim() || "To be discussed"), "Colour: " + (customerOrderForm.colour.trim() || "To be discussed"), "Quantity: " + quantity, "Measurement: " + customerOrderForm.measurementMethod, "Preferred completion date: " + (customerOrderForm.preferredDate || "Not specified"), "Delivery: " + customerOrderForm.deliveryMethod, "Special instructions: " + (customerOrderForm.instructions.trim() || "None")].join("\\n");
      await addDoc(collection(db, "orders"), { customerUid: user.uid, customerName: user.displayName || profileForm.displayName || "", customerEmail: user.email || "", orderNumber, item, description, category: customerOrderForm.category, fabric: customerOrderForm.fabric.trim(), colour: customerOrderForm.colour.trim(), quantity, measurementMethod: customerOrderForm.measurementMethod, preferredDate: customerOrderForm.preferredDate, deliveryMethod: customerOrderForm.deliveryMethod, instructions: customerOrderForm.instructions.trim(), status: "received", paymentStatus: "unquoted", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setCustomerOrderForm({ category: "Men’s clothing", item: "", fabric: "", colour: "", quantity: "1", instructions: "", measurementMethod: "I need a measurement appointment", preferredDate: "", deliveryMethod: "Collection at the studio" });
      setMessage("Your request " + orderNumber + " has been submitted. The team must review it and prepare a quotation; no price or completion date is confirmed yet.");
      await loadMyOrders();
    } catch (err) { setError(err.message || "Could not submit your order request."); }
    finally { setBusy(false); }
  }

  async function updateOrder(id, changes) {
    if (!id || (!claims.superAdmin && !( ["manager", "sales", "tailor"].includes(claims.staffRole) && Object.keys(changes).every(key => ["status"].includes(key))))) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const current = orders.find(item => item.id === id);
      const batch = writeBatch(db);
      batch.update(doc(db, "orders", id), { ...changes, updatedAt: serverTimestamp() });
      let stageNote = "";
      if (Object.prototype.hasOwnProperty.call(changes, "status") && current?.status !== changes.status) {
        stageNote = (window.prompt("Optional customer-visible production update for this stage") || "").trim().slice(0, 500);
        const eventRef = doc(collection(db, "orders", id, "events"));
        batch.set(eventRef, {
          fromStatus: current?.status || "received",
          toStatus: changes.status,
          stageLabel: productionStageLabel(changes.status),
          stageNote,
          changedByUid: user.uid,
          changedByName: user.displayName || user.email || "Production team",
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
      setOrders(items => items.map(item => item.id === id ? {
        ...item, ...changes,
        events: Object.prototype.hasOwnProperty.call(changes, "status") && current?.status !== changes.status
          ? [...(item.events || []), { fromStatus: current?.status || "received", toStatus: changes.status, stageLabel: productionStageLabel(changes.status), stageNote, changedByName: user.displayName || user.email || "Production team", createdAt: { toDate: () => new Date() } }]
          : item.events
      } : item));
      setMessage("Order updated successfully.");
    } catch (err) { setError(err.message || "Could not update the order."); }
    finally { setBusy(false); }
  }

  function quotationItemsFor(order) {
    if (Array.isArray(order?.quotationItems) && order.quotationItems.length === QUOTE_LINE_ITEMS.length) return QUOTE_LINE_ITEMS.map((label,index)=>({label,amount:Number(order.quotationItems[index]?.amount||0)}));
    return QUOTE_LINE_ITEMS.map((label,index)=>({label,amount:index===0?Number(order?.amount||0):0}));
  }
  function updateQuotationLine(order,index,value) {
    const current=quoteEdits[order.id]?.items || quotationItemsFor(order).map(line=>String(line.amount||""));
    const next=[...current]; next[index]=value;
    setQuoteEdits(state=>({...state,[order.id]:{...state[order.id],items:next}}));
  }
  async function sendOrderQuotation(order) {
    if (!claims.superAdmin || !order?.id) return;
    const edit = quoteEdits[order.id] || {};
    const draftItems = edit.items || quotationItemsFor(order).map(line=>String(line.amount||""));
    const quotationItems = QUOTE_LINE_ITEMS.map((label,index)=>({label,amount:Number(draftItems[index]||0)}));
    if (quotationItems.some(line=>!Number.isFinite(line.amount)||line.amount<0)) { setError("Enter valid non-negative amounts for every quotation line."); return; }
    const amount = quotationItems.reduce((sum,line)=>sum+line.amount,0);
    if (amount <= 0) { setError("Enter at least one quotation amount greater than zero."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const patch = { amount, quotationItems, quotationNote: (edit.note || "").trim(), quotationStatus: "sent", quotationSentAt: serverTimestamp(), paymentStatus: "awaiting_customer_approval", updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "orders", order.id), patch);
      setOrders(items => items.map(item => item.id === order.id ? { ...item, ...patch, quotationSentAt: new Date() } : item));
      setMessage("Quotation sent to the customer for approval.");
    } catch (err) { setError(err.message || "Could not send the quotation."); }
    finally { setBusy(false); }
  }

  async function respondToQuotation(order, decision) {
    if (!user || !order?.id || order.customerUid !== user.uid || order.quotationStatus !== "sent" || !["accepted", "declined"].includes(decision)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "orders", order.id), { quotationStatus: decision, updatedAt: serverTimestamp() });
      setMyOrders(items => items.map(item => item.id === order.id ? { ...item, quotationStatus: decision } : item));
      setMessage(decision === "accepted" ? "You accepted the quotation. The team can now confirm the deposit and production arrangements." : "You declined the quotation. The team will contact you to discuss next steps.");
    } catch (err) { setError(err.message || "Could not submit your quotation response."); }
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

  function hasConfirmedAppointmentConflict(date, time, excludeId = "") {
    return appointments.some(item =>
      item.id !== excludeId &&
      item.status === "confirmed" &&
      item.appointmentDate === date &&
      item.appointmentTime === time
    );
  }

  async function bookAppointment(e) {
    e.preventDefault();
    if (hasConfirmedAppointmentConflict(appointmentForm.appointmentDate, appointmentForm.appointmentTime)) {
      setError("That date and time already has a confirmed appointment. Please choose another slot or contact the team.");
      return;
    }
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

  async function proposeAppointmentAlternative(item) {
    if (!claims.superAdmin || !item?.id) return;
    const edit = appointmentEdits[item.id] || {};
    if (!edit.proposedDate || !edit.proposedTime) { setError("Enter both an alternative date and time."); return; }
    if (edit.proposedDate < localDateString()) { setError("An alternative appointment date cannot be in the past."); return; }
    if (hasConfirmedAppointmentConflict(edit.proposedDate, edit.proposedTime, item.id)) {
      setError("That proposed slot already has another confirmed appointment. Choose a different date or time.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const patch = { status: "alternative_proposed", proposedDate: edit.proposedDate, proposedTime: edit.proposedTime, adminMessage: (edit.adminMessage || "").trim(), updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "appointments", item.id), patch);
      setAppointments(items => items.map(row => row.id === item.id ? { ...row, ...patch, updatedAt: new Date() } : row));
      setMessage("Alternative appointment proposed. The customer must accept it before it is treated as confirmed.");
    } catch (err) { setError(err.message || "Could not propose an alternative appointment."); }
    finally { setBusy(false); }
  }

  async function acceptAppointmentAlternative(item) {
    if (!user || !item?.id || item.customerUid !== user.uid || item.status !== "alternative_proposed") return;
    if (hasConfirmedAppointmentConflict(item.proposedDate, item.proposedTime, item.id)) {
      setError("That proposed slot is no longer available because another appointment has been confirmed. Please contact the team for another time.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await updateDoc(doc(db, "appointments", item.id), { appointmentDate: item.proposedDate, appointmentTime: item.proposedTime, status: "confirmed", updatedAt: serverTimestamp() });
      setAppointments(items => items.map(row => row.id === item.id ? { ...row, appointmentDate: item.proposedDate, appointmentTime: item.proposedTime, status: "confirmed" } : row));
      setMessage("You accepted the proposed appointment time.");
    } catch (err) { setError(err.message || "Could not accept the proposed appointment."); }
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

  async function loadPaymentDeclarations() {
    if (!user) return;
    setDeclarationsLoading(true);
    try {
      const source = claims.superAdmin || claims.staffRole
        ? collection(db, "paymentDeclarations")
        : query(collection(db, "paymentDeclarations"), where("customerUid", "==", user.uid));
      const snapshot = await getDocs(source);
      setPaymentDeclarations(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load payment declarations."); }
    finally { setDeclarationsLoading(false); }
  }

  async function submitPaymentDeclaration(e) {
    e.preventDefault();
    if (!user || claims.superAdmin || claims.staffRole) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const order = myOrders.find(item => item.id === declarationForm.orderId);
      const amount = Number(declarationForm.amount);
      const reference = declarationForm.reference.trim();
      if (!order) throw new Error("Select one of your orders.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter the amount you transferred.");
      if (!reference) throw new Error("Enter the bank transfer narration or transaction reference.");
      if (!declarationForm.transferDate) throw new Error("Select the transfer date.");
      await addDoc(collection(db, "paymentDeclarations"), {
        orderId: order.id, orderNumber: order.orderNumber || order.id,
        customerUid: user.uid, customerName: user.displayName || profileForm.displayName || "",
        amount, currency: "NGN", method: "Bank transfer", reference,
        transferDate: declarationForm.transferDate, payerName: declarationForm.payerName.trim(),
        note: declarationForm.note.trim(), status: "pending",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setDeclarationForm({ orderId: "", amount: "", reference: "", transferDate: localDateString(), payerName: "", note: "" });
      setMessage("Your transfer declaration has been submitted for review. It is not yet a confirmed payment.");
      await loadPaymentDeclarations();
    } catch (err) { setError(err.message || "Could not submit your transfer declaration."); }
    finally { setBusy(false); }
  }

  async function reviewPaymentDeclaration(item, decision) {
    if (!claims.superAdmin || !item?.id || item.status !== "pending") return;
    setBusy(true); setError(""); setMessage("");
    try {
      const reviewNote = String(declarationReviewNotes[item.id] || "").trim();
      const declarationRef = doc(db, "paymentDeclarations", item.id);
      const orderRef = doc(db, "orders", item.orderId);
      if (decision === "verified") {
        const paymentRef = doc(collection(db, "payments"));
        const legacyLedger = await getDocs(query(collection(db, "payments"), where("orderId", "==", item.orderId)));
        const legacyPaid = legacyLedger.docs.reduce((sum, row) => sum + Number(row.data().amount || 0), 0);
        await runTransaction(db, async transaction => {
          const declarationSnap = await transaction.get(declarationRef);
          const orderSnap = await transaction.get(orderRef);
          if (!declarationSnap.exists() || declarationSnap.data().status !== "pending") throw new Error("This declaration has already been reviewed. Refresh the list.");
          if (!orderSnap.exists() || orderSnap.data().customerUid !== item.customerUid) throw new Error("The linked order could not be verified.");
          const alreadyPaid = typeof orderSnap.data().amountPaid === "number" ? orderSnap.data().amountPaid : legacyPaid;
          const newPaid = alreadyPaid + Number(declarationSnap.data().amount || 0);
          const quoted = Number(orderSnap.data().amount || 0);
          const paymentStatus = quoted > 0 && newPaid >= quoted ? "paid" : newPaid > 0 ? "part_paid" : "unpaid";
          transaction.set(paymentRef, {
            orderId: item.orderId, orderNumber: item.orderNumber || item.orderId,
            customerUid: item.customerUid, customerName: item.customerName || "",
            amount: Number(declarationSnap.data().amount), currency: "NGN", method: declarationSnap.data().method || "Bank transfer",
            reference: declarationSnap.data().reference || "", note: "Verified from customer transfer declaration " + item.id,
            declarationId: item.id, createdAt: serverTimestamp(), createdBy: user.uid
          });
          transaction.update(orderRef, { amountPaid: newPaid, paymentStatus, updatedAt: serverTimestamp() });
          transaction.update(declarationRef, { status: "verified", reviewNote, reviewedAt: serverTimestamp(), reviewedBy: user.uid, updatedAt: serverTimestamp() });
        });
        setMessage("Transfer declaration verified and added to the payment ledger. The order payment status has been reconciled.");
      } else {
        await runTransaction(db, async transaction => {
          const declarationSnap = await transaction.get(declarationRef);
          if (!declarationSnap.exists() || declarationSnap.data().status !== "pending") throw new Error("This declaration has already been reviewed. Refresh the list.");
          transaction.update(declarationRef, { status: "rejected", reviewNote, reviewedAt: serverTimestamp(), reviewedBy: user.uid, updatedAt: serverTimestamp() });
        });
        setMessage("Transfer declaration rejected. The customer can see the review note.");
      }
      await Promise.all([loadPaymentDeclarations(), loadPayments(), loadOrders()]);
    } catch (err) { setError(err.message || "Could not review this payment declaration."); }
    finally { setBusy(false); }
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
      const orderRef = doc(db, "orders", order.id);
      const paymentRef = doc(collection(db, "payments"));
      const legacyLedger = await getDocs(query(collection(db, "payments"), where("orderId", "==", order.id)));
      const legacyPaid = legacyLedger.docs.reduce((sum, row) => sum + Number(row.data().amount || 0), 0);
      await runTransaction(db, async transaction => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("The selected order no longer exists.");
        const paidBefore = typeof orderSnap.data().amountPaid === "number" ? orderSnap.data().amountPaid : legacyPaid;
        const paidAfter = paidBefore + amount;
        const quoted = Number(orderSnap.data().amount || 0);
        const paymentStatus = quoted > 0 && paidAfter >= quoted ? "paid" : "part_paid";
        transaction.set(paymentRef, {
          orderId: order.id, orderNumber: order.orderNumber || order.id,
          customerUid: orderSnap.data().customerUid, customerName: orderSnap.data().customerName || "",
          amount, currency: "NGN", method: paymentForm.method,
          reference: paymentForm.reference.trim(), note: paymentForm.note.trim(),
          createdAt: serverTimestamp(), createdBy: user.uid
        });
        transaction.update(orderRef, { amountPaid: paidAfter, paymentStatus, updatedAt: serverTimestamp() });
      });
      setPaymentForm({ orderId: "", amount: "", method: "Bank transfer", reference: "", note: "" });
      setMessage("Payment transaction recorded and the order payment status reconciled successfully.");
      await Promise.all([loadPayments(), loadOrders()]);
    } catch (err) { setError(err.message || "Could not record payment."); }
    finally { setBusy(false); }
  }


  function orderPaidTotal(order) {
    if (typeof order.amountPaid === "number") return order.amountPaid;
    return payments.filter(payment => payment.orderId === order.id).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function printOrderInvoice(order) {
    if (!order || !Number.isFinite(Number(order.amount)) || Number(order.amount) <= 0) return;
    const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const money = value => "₦" + Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const paid = orderPaidTotal(order);
    const total = Number(order.amount || 0);
    const balance = Math.max(0, total - paid);
    const issueDate = new Date().toLocaleDateString("en-NG", { day: "2-digit", month: "long", year: "numeric" });
    const invoiceNumber = "MFF-INV-" + String(order.orderNumber || order.id).replace(/[^a-zA-Z0-9-]/g, "").slice(-24);
    const popup = window.open("", "_blank", "width=900,height=750");
    if (!popup) { setError("Please allow pop-ups for this site to print the order invoice."); return; }
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${invoiceNumber}</title><style>
      @page{size:A4 portrait;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#241119;font:12px Arial,sans-serif}
      main{max-width:760px;margin:0 auto}.brand{display:flex;gap:14px;align-items:center;border-bottom:3px solid #9a794d;padding-bottom:18px}
      .mark{width:54px;height:54px;display:grid;place-items:center;background:#32151f;color:#d9bd82;font:22px Georgia,serif}
      h1{font:700 21px Georgia,serif;letter-spacing:1.5px;margin:0 0 5px;color:#32151f}.brand p{font-size:9px;letter-spacing:2px;margin:0 0 6px;color:#98764b}
      .brand small,.muted{color:#75696a;font-size:10px}.heading{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:24px 0 16px}
      h2{font:700 16px Georgia,serif;letter-spacing:1.5px;margin:0}.heading strong{color:#795a30}
      .details{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:22px}.details div{border-bottom:1px solid #eee7dc;padding:8px 0}
      .details span{display:block;color:#75696a;font-size:9px;margin-bottom:4px}.details b{font-size:11px;overflow-wrap:anywhere}
      table{width:100%;border-collapse:collapse}th{background:#32151f;color:#f4e6c9;text-align:left;padding:10px}td{padding:12px 10px;border-bottom:1px solid #e9e0d4}th:last-child,td:last-child{text-align:right}
      .totals{width:320px;max-width:100%;margin:18px 0 0 auto}.totals div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #eee7dc}.totals .balance{font-weight:bold;color:#32151f;border-top:2px solid #9a794d}
      .note{margin-top:22px;padding:12px;background:#f8f4ed;color:#66585a;font-size:10px;line-height:1.6}.footer{text-align:center;border-top:1px dashed #bca77e;margin-top:28px;padding-top:18px;color:#75696a;font-size:10px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><main><header class="brand"><div class="mark">MF</div><div><h1>MR FOP FASHIONS</h1><p>COMPANY NIGERIA LIMITED</p><small>Crafted with purpose since 2010 · Ijebu Ode, Ogun State, Nigeria</small></div></header>
    <div class="heading"><h2>ORDER INVOICE / PAYMENT STATEMENT</h2><strong>${escapeText(invoiceNumber)}</strong></div>
    <section class="details"><div><span>Issue date</span><b>${issueDate}</b></div><div><span>Order reference</span><b>${escapeText(order.orderNumber || order.id)}</b></div><div><span>Bill to</span><b>${escapeText(order.customerName || order.customerEmail || "Customer")}</b></div><div><span>Expected delivery</span><b>${escapeText(order.dueDate || "To be confirmed")}</b></div></section>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${Array.isArray(order.quotationItems) && order.quotationItems.length ? order.quotationItems.filter(line=>Number(line.amount)>0).map(line=>'<tr><td>'+escapeText(line.label)+'</td><td>1</td><td>'+money(line.amount)+'</td></tr>').join("") : '<tr><td>'+escapeText(order.item || "Custom fashion order")+(order.description ? '<div class="muted">' + escapeText(order.description) + '</div>' : "")+'</td><td>'+escapeText(order.quantity || 1)+'</td><td>'+money(total)+'</td></tr>'}</tbody></table>
    <section class="totals"><div><span>Order total</span><b>${money(total)}</b></div><div><span>Payments received</span><b>${money(paid)}</b></div><div class="balance"><span>Outstanding balance</span><b>${money(balance)}</b></div></section>
    <p class="note">Payment status: <b>${escapeText(String(order.paymentStatus || "unpaid").replaceAll("_", " ").toUpperCase())}</b><br>Quotation status: <b>${escapeText(order.quotationStatus || "Not yet accepted")}</b><br>This document summarizes the order quotation and payments recorded in the platform. It is not a tax invoice or proof of payment. Only payments independently verified by MR FOP FASHIONS are included.</p>
    <footer class="footer"><b>Thank you for choosing MR FOP FASHIONS.</b><br>For enquiries: +234 805 547 2913</footer></main><script>window.onload=()=>{window.focus();window.print()}<\/script></body></html>`);
    popup.document.close();
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

  function startProductEdit(product) {
    setEditingProductId(product.id);
    setProductForm({ name: product.name || "", sku: product.sku || "", category: product.category || "Other", description: product.description || "", price: String(product.price ?? ""), costPrice: String(product.costPrice ?? ""), stock: String(product.stock ?? 0), imageUrl: product.imageUrl || "" });
    setError(""); setMessage("Editing " + (product.name || "product") + ". Update the details in the form above.");
  }

  async function saveProductEdit(e) {
    e.preventDefault();
    if (!claims.superAdmin || !editingProductId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const name = productForm.name.trim();
      const sku = productForm.sku.trim();
      const price = Number(productForm.price);
      const costPrice = Number(productForm.costPrice || 0);
      if (!name || !sku) throw new Error("Enter both a product name and SKU.");
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(costPrice) || costPrice < 0) throw new Error("Enter valid non-negative selling and cost prices.");
      await updateDoc(doc(db, "products", editingProductId), { name, sku, category: productForm.category, description: productForm.description.trim(), price, costPrice, imageUrl: productForm.imageUrl.trim(), updatedAt: serverTimestamp() });
      setEditingProductId("");
      setProductForm({ name: "", sku: "", category: "Custom clothing", description: "", price: "", costPrice: "", stock: "0", imageUrl: "" });
      setMessage("Product details updated successfully. Stock quantity was not changed.");
      await loadProducts();
    } catch (err) { setError(err.message || "Could not update product."); }
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

  async function loadExpenses() {
    if (!claims.superAdmin) return;
    setExpensesLoading(true); setError("");
    try {
      const snapshot = await getDocs(collection(db, "expenses"));
      setExpenses(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (b.expenseDate || "").localeCompare(a.expenseDate || "") || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { setError(err.message || "Could not load expenses."); }
    finally { setExpensesLoading(false); }
  }

  async function recordExpense(e) {
    e.preventDefault(); if (!claims.superAdmin) return; setBusy(true); setError(""); setMessage("");
    try {
      const title=expenseForm.title.trim(), amount=Number(expenseForm.amount);
      if(!title) throw new Error("Enter an expense description."); if(!Number.isFinite(amount)||amount<=0) throw new Error("Enter an expense amount greater than zero.");
      const payload={title,category:expenseForm.category,amount,currency:"NGN",expenseDate:expenseForm.expenseDate,method:expenseForm.method,note:expenseForm.note.trim()};
      if(expenseEditingId){await updateDoc(doc(db,"expenses",expenseEditingId),{...payload,updatedAt:serverTimestamp()});setMessage("Expense updated successfully.");}else{await addDoc(collection(db,"expenses"),{...payload,createdAt:serverTimestamp(),createdBy:user.uid});setMessage("Business expense recorded successfully.");}
      setExpenseEditingId("");setExpenseForm({title:"",category:"Operations",amount:"",expenseDate:localDateString(),method:"Cash",note:""});await loadExpenses();
    } catch(err){setError(err.message||"Could not save expense.");} finally{setBusy(false);}
  }
  function editExpense(item){setExpenseEditingId(item.id);setExpenseForm({title:item.title||"",category:item.category||"Operations",amount:String(item.amount||""),expenseDate:item.expenseDate||localDateString(),method:item.method||"Cash",note:item.note||""});setMessage("Editing selected expense.");}
  async function removeExpense(item){if(!claims.superAdmin||!window.confirm("Permanently delete this expense?"))return;setBusy(true);setError("");try{await deleteDoc(doc(db,"expenses",item.id));if(expenseEditingId===item.id){setExpenseEditingId("");setExpenseForm({title:"",category:"Operations",amount:"",expenseDate:localDateString(),method:"Cash",note:""});}setMessage("Expense deleted.");await loadExpenses();}catch(err){setError(err.message||"Could not delete expense.");}finally{setBusy(false);}}

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

  React.useEffect(() => { if (claims.superAdmin) { loadStaff(); loadCustomers(); loadOrders(); loadSales(); loadExpenses(); loadAdminCustomerServices(); } else if (claims.staffRole) loadOrders(); else if (user) { loadMyOrders(); loadMyProfile(); loadMeasurements(); loadTrainingEnquiries(); } if (user) { loadAppointments(); loadPayments(); loadPaymentDeclarations(); loadProducts(); } }, [claims.superAdmin, claims.staffRole, user?.uid]);

  const financeNow=new Date();
  const financeBounds=(()=>{let a=new Date(financeNow.getFullYear(),financeNow.getMonth(),1),b=new Date(financeNow.getFullYear(),financeNow.getMonth()+1,0,23,59,59,999);if(financePeriod==="today"){a=new Date();a.setHours(0,0,0,0);b=new Date();b.setHours(23,59,59,999);}else if(financePeriod==="yesterday"){a=new Date();a.setDate(a.getDate()-1);a.setHours(0,0,0,0);b=new Date(a);b.setHours(23,59,59,999);}else if(financePeriod==="week"){a=new Date();a.setDate(a.getDate()-(a.getDay()+6)%7);a.setHours(0,0,0,0);b=new Date(a);b.setDate(b.getDate()+6);b.setHours(23,59,59,999);}else if(financePeriod==="lastMonth"){a=new Date(financeNow.getFullYear(),financeNow.getMonth()-1,1);b=new Date(financeNow.getFullYear(),financeNow.getMonth(),0,23,59,59,999);}else if(financePeriod==="year"){a=new Date(financeNow.getFullYear(),0,1);b=new Date(financeNow.getFullYear(),11,31,23,59,59,999);}else if(financePeriod==="custom"){a=new Date(financeStart+"T00:00:00");b=new Date(financeEnd+"T23:59:59.999");if(!financeStart||!financeEnd||Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||a>b){a=new Date(8640000000000000);b=new Date(0);}}else if(financePeriod==="all"){a=new Date(0);b=new Date(8640000000000000);}return {start:a,end:b};})();
  const financeSales=sales.filter(x=>{const d=x.createdAt?.toDate?x.createdAt.toDate():null;return d&&d>=financeBounds.start&&d<=financeBounds.end;});
  const financeExpenses=expenses.filter(x=>{const d=x.expenseDate?new Date(x.expenseDate+"T12:00:00"):null;return d&&d>=financeBounds.start&&d<=financeBounds.end;});
  const financeRevenue=financeSales.reduce((n,x)=>n+Number(x.total||0),0),financeReceived=financeSales.reduce((n,x)=>n+Number(x.amountPaid||0),0),financeCOGS=financeSales.reduce((n,x)=>n+Number(x.totalCost||0),0),financeGross=financeSales.reduce((n,x)=>n+Number(x.grossProfit??(Number(x.total||0)-Number(x.totalCost||0)),0),0),financeExpenseTotal=financeExpenses.reduce((n,x)=>n+Number(x.amount||0),0),financeNet=financeGross-financeExpenseTotal;
  const financeMethods=["Cash","Bank transfer","POS","Card","Other"].map(method=>({method,sales:financeSales.filter(x=>x.paymentMethod===method).reduce((n,x)=>n+Number(x.amountPaid||0),0),expenses:financeExpenses.filter(x=>x.method===method).reduce((n,x)=>n+Number(x.amount||0),0)}));
  const financeCategories=[...new Set(financeExpenses.map(x=>x.category||"Other"))].map(category=>({category,total:financeExpenses.filter(x=>(x.category||"Other")===category).reduce((n,x)=>n+Number(x.amount||0),0)})).sort((a,b)=>b.total-a.total);
  const financeTrend=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=localDateString(d);const revenue=sales.filter(x=>x.createdAt?.toDate&&localDateString(x.createdAt.toDate())===key).reduce((n,x)=>n+Number(x.total||0),0);const expense=expenses.filter(x=>x.expenseDate===key).reduce((n,x)=>n+Number(x.amount||0),0);return {label:d.toLocaleDateString("en-NG",{weekday:"short"}),revenue,expense};});
  const visibleExpenses=expenses.filter(x=>(!expenseSearch||(x.title+" "+x.note+" "+x.category).toLowerCase().includes(expenseSearch.toLowerCase()))&&(expenseCategoryFilter==="All"||x.category===expenseCategoryFilter));
  function exportFinanceCSV(){const periodLabel=financePeriod==="custom"?(financeStart+" to "+financeEnd):financePeriod;const rows=[["MR FOP FASHIONS FINANCIAL REPORT"],["Period",periodLabel],[],["Metric","NGN"],["Sales revenue",financeRevenue],["Cash received",financeReceived],["Cost of goods sold",financeCOGS],["Gross profit",financeGross],["Expenses",financeExpenseTotal],["Estimated net profit",financeNet],[],["Expense","Category","Date","Method","Amount","Note"],...financeExpenses.map(x=>[x.title,x.category,x.expenseDate,x.method,x.amount,x.note||""])];const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\\r\\n");const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="MR-FOP-Financial-Report.csv";a.click();URL.revokeObjectURL(url);}
  function printFinanceReport(){const w=window.open("","_blank");if(!w){setError("Allow pop-ups to print the report.");return;}const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));const periodLabel=financePeriod==="custom"?(financeStart+" to "+financeEnd):financePeriod;const html="<html><head><title>MR FOP Financial Report</title><style>body{font:12px Arial;padding:25px;color:#32151f}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>MR FOP FASHIONS</h1><h2>Financial report</h2><p>Reporting period: "+esc(periodLabel)+"</p><p>Revenue: ₦"+financeRevenue.toLocaleString("en-NG")+" · Gross profit: ₦"+financeGross.toLocaleString("en-NG")+" · Expenses: ₦"+financeExpenseTotal.toLocaleString("en-NG")+" · Net profit: ₦"+financeNet.toLocaleString("en-NG")+"</p><table><tr><th>Expense</th><th>Category</th><th>Date</th><th>Method</th><th>Amount</th></tr>"+financeExpenses.map(x=>"<tr><td>"+esc(x.title)+"</td><td>"+esc(x.category)+"</td><td>"+esc(x.expenseDate)+"</td><td>"+esc(x.method)+"</td><td>₦"+Number(x.amount||0).toLocaleString("en-NG")+"</td></tr>").join("")+"</table><script>window.onload=function(){window.print()}<\\/script></body></html>";w.document.write(html);w.document.close();}
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
      {!claims.staffRole && !claims.superAdmin && <div className="dashboard-grid customer-dashboard-summary">
        <article className="dashboard-tile"><strong>{myOrders.length}</strong><span>Orders on your account</span><small>My Orders</small></article>
        <article className="dashboard-tile"><strong>{appointments.length}</strong><span>Appointment requests</span><small>My Appointments</small></article>
        <article className="dashboard-tile"><strong>{payments.length}</strong><span>Payment transactions</span><small>My Payments</small></article>
        <article className="dashboard-tile"><strong>{products.filter(item=>item.active!==false).length}</strong><span>Products available to browse</span><small>Product Catalogue</small></article>
      </div>}
      {!claims.superAdmin && !claims.staffRole && <section className="customer-management customer-self-service">
        <div className="customer-management-heading"><div><h3>My Profile</h3><p>Keep your contact information up to date</p></div><button type="button" onClick={loadMyProfile} disabled={profileLoading}>{profileLoading ? "Loading…" : "Refresh profile"}</button></div>
        <form className="portal-form" onSubmit={saveMyProfile}>
          <label>Full name<input required value={profileForm.displayName} onChange={e=>setProfileForm({...profileForm,displayName:e.target.value})}/></label>
          <label>Email address<input type="email" value={user.email || ""} disabled/></label>
          <label>Phone number<input value={profileForm.phone} onChange={e=>setProfileForm({...profileForm,phone:e.target.value})} placeholder="Your contact number"/></label>
          <label>Address<textarea value={profileForm.address} onChange={e=>setProfileForm({...profileForm,address:e.target.value})} placeholder="Your delivery or contact address"/></label>
          <button className="portal-submit" disabled={busy || profileLoading}>{busy ? "Saving…" : "Save my profile"}</button>
        </form>
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="customer-management customer-self-service">
        <div className="customer-management-heading"><div><h3>Request a Custom Order</h3><p>Send your garment requirements for review and quotation</p></div></div>
        <form className="portal-form" onSubmit={submitCustomerOrder}>
          <label>Garment category<select value={customerOrderForm.category} onChange={e=>setCustomerOrderForm({...customerOrderForm,category:e.target.value})}><option>Men’s clothing</option><option>Women’s clothing</option><option>Bridal and occasion wear</option><option>Traditional Nigerian attire</option><option>Corporate or institutional uniforms</option><option>Industrial or group tailoring</option><option>Other custom request</option></select></label>
          <label>What would you like us to make?<input required maxLength="120" value={customerOrderForm.item} onChange={e=>setCustomerOrderForm({...customerOrderForm,item:e.target.value})} placeholder="e.g. Two-piece senator outfit"/></label>
          <label>Fabric preference (optional)<input maxLength="100" value={customerOrderForm.fabric} onChange={e=>setCustomerOrderForm({...customerOrderForm,fabric:e.target.value})} placeholder="Fabric type or 'please advise'"/></label>
          <label>Preferred colour (optional)<input maxLength="80" value={customerOrderForm.colour} onChange={e=>setCustomerOrderForm({...customerOrderForm,colour:e.target.value})} placeholder="e.g. Navy blue"/></label>
          <label>Quantity<input type="number" min="1" max="50" step="1" required value={customerOrderForm.quantity} onChange={e=>setCustomerOrderForm({...customerOrderForm,quantity:e.target.value})}/></label>
          <label>Measurement arrangement<select value={customerOrderForm.measurementMethod} onChange={e=>setCustomerOrderForm({...customerOrderForm,measurementMethod:e.target.value})}><option>I need a measurement appointment</option><option>I have measurements to discuss</option><option>Use my previously saved measurements</option></select></label>
          <label>Preferred completion date (request only)<input type="date" min={localDateString()} value={customerOrderForm.preferredDate} onChange={e=>setCustomerOrderForm({...customerOrderForm,preferredDate:e.target.value})}/></label>
          <label>Collection or delivery<select value={customerOrderForm.deliveryMethod} onChange={e=>setCustomerOrderForm({...customerOrderForm,deliveryMethod:e.target.value})}><option>Collection at the studio</option><option>Delivery arrangement required</option><option>To be discussed</option></select></label>
          <label>Additional instructions<textarea maxLength="1500" rows="4" value={customerOrderForm.instructions} onChange={e=>setCustomerOrderForm({...customerOrderForm,instructions:e.target.value})} placeholder="Style details, occasion, fitting needs or other instructions"/></label>
          <p className="portal-hint">This is an order request, not a confirmed order. The price, deposit and completion date will be confirmed by MR FOP after review.</p>
          <button className="portal-submit" disabled={busy}>{busy ? "Submitting request…" : "Submit custom order request"}</button>
        </form>
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="customer-management customer-self-service">
        <div className="customer-management-heading"><div><h3>My Measurements</h3><p>Save fitting measurements for your account. Values are stored consistently in centimetres.</p></div><button type="button" onClick={loadMeasurements} disabled={measurementsLoading}>{measurementsLoading ? "Loading…" : "Refresh measurements"}</button></div>
        <form className="portal-form inventory-form" onSubmit={saveMeasurement}>
          <label>Profile name<input value={measurementForm.profileName} maxLength={60} onChange={e=>setMeasurementForm({...measurementForm,profileName:e.target.value})} placeholder="e.g. Office shirt measurements"/></label>
          <label>Garment profile<select value={measurementForm.garmentType} onChange={e=>setMeasurementForm({...measurementForm,garmentType:e.target.value})}>{Object.keys(MEASUREMENT_PROFILES).map(type=><option key={type}>{type}</option>)}</select></label>
          <label>Measurement unit<select value={measurementForm.unit} onChange={e=>setMeasurementForm({...measurementForm,unit:e.target.value})}><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option></select></label>
          <div className="measurement-grid">{(MEASUREMENT_PROFILES[measurementForm.garmentType] || MEASUREMENT_PROFILES["General body profile"]).map(([key,label])=><label key={key}>{label} ({measurementForm.unit})<input type="number" min="0.1" step="0.1" value={measurementForm[key] || ""} onChange={e=>setMeasurementForm({...measurementForm,[key]:e.target.value})} placeholder={measurementForm.unit}/></label>)}</div>
          {getMeasurementWarnings(measurementForm).length > 0 && <aside className="measurement-warning" role="status"><strong>Please double-check these entries</strong><ul>{getMeasurementWarnings(measurementForm).map((warning,index)=><li key={index}>{warning}</li>)}</ul><small>These are broad data-entry checks, not body-size standards. You may continue, but a designer should verify every measurement.</small></aside>}
          <aside className="measurement-guide" aria-label="How to take body measurements">
            <div className="measurement-guide-art">
              <svg viewBox="0 0 220 250" role="img" aria-labelledby="measureGuideTitle measureGuideDesc">
                <title id="measureGuideTitle">Basic body measurement guide</title><desc id="measureGuideDesc">Front-facing outline showing chest, waist and hip tape positions.</desc>
                <circle cx="110" cy="25" r="17" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M92 47 Q73 51 65 76 L48 125 M128 47 Q147 51 155 76 L172 125 M65 76 Q70 112 78 145 L82 224 M155 76 Q150 112 142 145 L138 224 M92 47 L86 82 Q110 93 134 82 L128 47 M86 82 Q80 105 82 128 Q110 138 138 128 Q140 105 134 82 M82 128 Q110 140 138 128 M82 145 Q110 157 142 145" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M73 83 Q110 99 147 83 M78 116 Q110 130 142 116 M76 145 Q110 160 144 145" fill="none" stroke="#a77d43" strokeWidth="4" strokeLinecap="round"/>
                <path d="M148 83 L180 73 M143 116 L180 111 M144 145 L180 151" stroke="#a77d43" strokeWidth="1.5"/>
                <g fill="currentColor" fontSize="9" fontWeight="600"><text x="182" y="75">Chest</text><text x="182" y="113">Waist</text><text x="182" y="154">Hip</text></g>
              </svg>
            </div>
            <div><strong>Measurement guide</strong><p>Stand naturally and use a flexible tape. Keep it level and comfortably snug without pressing into the body. Ask another person to help where possible.</p><ul><li><b>Chest / bust:</b> measure around the fullest part, keeping the tape level.</li><li><b>Waist:</b> measure around the natural waistline without pulling in your stomach.</li><li><b>Hip:</b> measure around the fullest part of the hips and seat.</li><li><b>Length:</b> measure from the garment's stated starting point to its required end point.</li></ul><small>Illustration is a general guide, not a substitute for an in-person fitting. A designer must confirm measurements before production.</small></div>
          </aside>

          <p className="portal-hint">Enter measurements with a flexible tape measure. Keep the tape comfortably fitted, not tight. A designer should confirm measurements before garment production.</p>
          <button type="button" onClick={()=>{setAppointmentForm(current=>({...current,service:"Measurement",purpose:`Please verify my ${measurementForm.garmentType.toLowerCase()} measurements${measurementForm.profileName.trim() ? ` (${measurementForm.profileName.trim()})` : ""} in person.`}));document.getElementById("customer-appointments")?.scrollIntoView({behavior:"smooth",block:"start"});setMessage("Choose your preferred date and time in the appointment form. The team must confirm the booking.");}}>Request in-person measurement verification</button>
          <label>Notes<textarea value={measurementForm.notes} onChange={e=>setMeasurementForm({...measurementForm,notes:e.target.value})} placeholder="Optional fitting notes"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Saving…" : "Save measurement profile"}</button>
        </form>
        {measurementsLoading ? <p className="staff-empty">Loading your measurements…</p> : measurements.length ? <div className="measurement-list">{measurements.map(item=><article className="appointment-card" key={item.id}><strong>{item.profileName || item.garmentType || "Saved measurements"}</strong><span>{item.garmentType || "General profile"} · {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString("en-NG") : "Date not available"} · centimetres</span><div className="measurement-values">{ALL_MEASUREMENT_FIELDS.filter(key=>item[key]!==null&&item[key]!==undefined&&item[key]!=="").map(key=><span key={key}>{key.replace(/[A-Z]/g," $&").replace(/^./,c=>c.toUpperCase())}: {item[key]} cm</span>)}</div>{item.notes&&<p>{item.notes}</p>}<button type="button" onClick={()=>reuseMeasurementProfile(item)}>Reuse this profile</button></article>)}</div> : <p className="staff-empty">You have not saved any measurements yet.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="customer-management customer-self-service">
        <div className="customer-management-heading"><div><h3>Fashion Institute</h3><p>Enquire about courses and practical training</p></div><button type="button" onClick={loadTrainingEnquiries} disabled={trainingLoading}>{trainingLoading ? "Loading…" : "Refresh enquiries"}</button></div>
        <form className="portal-form appointment-form" onSubmit={submitTrainingEnquiry}>
          <h4>Submit a training enquiry</h4>
          <label>Course of interest<select value={trainingForm.course} onChange={e=>setTrainingForm({...trainingForm,course:e.target.value})}><option>Fashion Design</option><option>Fashion Illustration</option><option>Pattern Drafting</option><option>Garment Construction</option><option>Fashion Business</option><option>Other</option></select></label>
          <label>Training option<select value={trainingForm.mode} onChange={e=>setTrainingForm({...trainingForm,mode:e.target.value})}><option>Onsite practical training</option><option>Online training</option><option>Weekend classes</option><option>One-to-one coaching</option></select></label>
          <label>Additional information<textarea value={trainingForm.message} onChange={e=>setTrainingForm({...trainingForm,message:e.target.value})} placeholder="Tell us about your goals or questions"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Submitting…" : "Send training enquiry"}</button>
        </form>
        {trainingLoading ? <p className="staff-empty">Loading your enquiries…</p> : trainingEnquiries.length ? <div className="appointment-list">{trainingEnquiries.map(item=><article className="appointment-card" key={item.id}><strong>{item.course}</strong><span>{item.mode}</span>{item.message&&<p>{item.message}</p>}<span className="appointment-status-text">Status: {item.status || "pending"}</span></article>)}</div> : <p className="staff-empty">You have not submitted a training enquiry yet.</p>}
      </section>}
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
          <div className="order-card-top"><div><strong>{order.orderNumber || order.id}</strong><span>{order.customerName || order.customerEmail || "Customer"}</span></div><b>{order.paymentStatus === "unquoted" || order.amount === undefined ? "Awaiting quotation" : "₦" + Number(order.amount || 0).toLocaleString("en-NG")}</b></div>
          <p>{order.item || "Order item"}{order.description ? " — " + order.description : ""}</p>
          <div className="order-meta"><span>Delivery: {order.dueDate || "Not set"}</span><span>Payment: {order.paymentStatus || "unpaid"}</span></div>{order.amount !== undefined && <div className="order-financial-summary"><span>Paid: <b>₦{orderPaidTotal(order).toLocaleString("en-NG")}</b></span><span>Balance: <b>₦{Math.max(0,Number(order.amount||0)-orderPaidTotal(order)).toLocaleString("en-NG")}</b></span><button type="button" onClick={()=>printOrderInvoice(order)}>Print order invoice</button></div>}
          {claims.superAdmin && (order.paymentStatus === "unquoted" || order.amount === undefined || order.quotationStatus === "declined") && <div className="order-quotation-editor"><strong>Prepare customer quotation</strong><div className="quotation-line-items"><strong>Quotation breakdown</strong>{QUOTE_LINE_ITEMS.map((label,index)=><label key={label}>{label} (₦)<input type="number" min="0" step="0.01" value={(quoteEdits[order.id]?.items || quotationItemsFor(order).map(line=>String(line.amount||"")))[index]} onChange={e=>updateQuotationLine(order,index,e.target.value)}/></label>)}<p>Calculated total: <b>₦{(quoteEdits[order.id]?.items || quotationItemsFor(order).map(line=>String(line.amount||""))).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></p></div><label>Quotation notes<textarea value={quoteEdits[order.id]?.note ?? order.quotationNote ?? ""} onChange={e=>setQuoteEdits(current=>({...current,[order.id]:{...current[order.id],note:e.target.value}}))} placeholder="Fabric, fittings, deposit terms and scope"/></label><button type="button" disabled={busy} onClick={()=>sendOrderQuotation(order)}>Send quotation</button></div>}
          {order.events?.length > 0 && <div className="production-history"><strong>Production history</strong>{order.events.map((event,index)=><div className="production-history-event" key={event.id || index}><span>{event.stageLabel || productionStageLabel(event.toStatus)}</span>{event.stageNote && <p>{event.stageNote}</p>}<small>{event.createdAt?.toDate ? event.createdAt.toDate().toLocaleString("en-NG") : "Date pending"} · {event.changedByName || "Team"}</small></div>)}</div>}
          {canUpdateProduction ? <div className="order-controls">{claims.superAdmin && <><label>Expected delivery date<input type="date" value={deliveryDateEdits[order.id] ?? order.dueDate ?? ""} disabled={busy} onChange={e=>setDeliveryDateEdits(current=>({...current,[order.id]:e.target.value}))}/></label><button type="button" disabled={busy || (deliveryDateEdits[order.id] ?? order.dueDate ?? "") === (order.dueDate ?? "")} onClick={()=>updateOrder(order.id,{dueDate:deliveryDateEdits[order.id] || ""})}>Save delivery date</button></>}<label>Production stage<select value={order.status || "received"} disabled={busy} onChange={e=>updateOrder(order.id,{status:e.target.value})}>{PRODUCTION_STAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{claims.superAdmin && <label>Payment status<select value={order.paymentStatus || "unpaid"} disabled={busy} onChange={e=>updateOrder(order.id,{paymentStatus:e.target.value})}><option value="unpaid">Unpaid</option><option value="awaiting_customer_approval">Awaiting quotation approval</option><option value="deposit_paid">Deposit paid</option><option value="part_paid">Part paid</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select></label>}</div> : <div className="order-meta"><span>Status: {productionStageLabel(order.status)}</span></div>}
        </article>)}</div> : <p className="staff-empty">No orders have been created yet.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="order-management"><div className="customer-management-heading"><div><h3>My Orders</h3><p>Track your orders and payment status</p></div></div>{myOrders.length ? myOrders.map(order=><article className="order-card" key={order.id}><div className="order-card-top"><strong>{order.orderNumber || order.id}</strong><b>{order.paymentStatus === "unquoted" || order.amount === undefined ? "Awaiting quotation" : "₦" + Number(order.amount || 0).toLocaleString("en-NG")}</b></div><p>{order.item || "Order"}{order.description ? " — " + order.description : ""}</p><div className="order-meta"><span>Status: {productionStageLabel(order.status)}</span><span>Payment: {String(order.paymentStatus || "unpaid").replaceAll("_"," ")}</span><span>Delivery: {order.dueDate || "Not set"}</span></div>{order.amount !== undefined && <div className="order-financial-summary"><span>Paid: <b>₦{orderPaidTotal(order).toLocaleString("en-NG")}</b></span><span>Outstanding: <b>₦{Math.max(0,Number(order.amount||0)-orderPaidTotal(order)).toLocaleString("en-NG")}</b></span>{order.quotationStatus === "accepted" && <button type="button" onClick={()=>printOrderInvoice(order)}>Print order invoice</button>}</div>}
          <div className="order-progress" aria-label={`Production stage ${productionStageProgress(order.status).current} of ${productionStageProgress(order.status).total}`}><div className="order-progress-heading"><strong>Production progress</strong><span>Stage {productionStageProgress(order.status).current} of {productionStageProgress(order.status).total}</span></div><div className="order-progress-track"><span style={{width:`${productionStageProgress(order.status).percent}%`}}/></div><small>{productionStageProgress(order.status).percent}% of the listed production stages reached. The team will update this as work progresses.</small></div>{order.events?.length > 0 && <div className="production-history"><strong>Production history</strong>{order.events.map((event,index)=><div className="production-history-event" key={event.id || index}><span>{event.stageLabel || productionStageLabel(event.toStatus)}</span>{event.stageNote && <p>{event.stageNote}</p>}<small>{event.createdAt?.toDate ? event.createdAt.toDate().toLocaleString("en-NG") : "Date pending"}</small></div>)}</div>}{order.quotationStatus === "sent" && <div className="order-quotation-customer"><strong>Quotation: ₦{Number(order.amount || 0).toLocaleString("en-NG")}</strong>{Array.isArray(order.quotationItems) && <div className="customer-quotation-breakdown"><strong>Quotation breakdown</strong>{order.quotationItems.filter(line=>Number(line.amount)>0).map((line,index)=><div key={line.label||index}><span>{line.label}</span><b>₦{Number(line.amount).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>)}<div className="quotation-total"><span>Total</span><b>₦{Number(order.amount||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div></div>}{order.quotationNote&&<p>{order.quotationNote}</p>}<p>Please review and respond to this quotation.</p><button type="button" disabled={busy} onClick={()=>respondToQuotation(order,"accepted")}>Accept quotation</button><button type="button" disabled={busy} onClick={()=>respondToQuotation(order,"declined")}>Decline quotation</button></div>}{order.quotationStatus && <span className="appointment-status-text">Quotation status: {order.quotationStatus}</span>}</article>) : <p className="staff-empty">You don't have any orders yet.</p>}</section>}
      <section className="appointment-management">
        <div className="customer-management-heading"><div><h3>{claims.superAdmin || claims.staffRole ? "Appointment Management" : "My Appointments"}</h3><p>Book measurements, fittings and consultations</p></div><button type="button" onClick={loadAppointments} disabled={appointmentsLoading}>{appointmentsLoading ? "Loading…" : "Refresh"}</button></div>
        {!claims.staffRole && !claims.superAdmin && <form id="customer-appointments" className="portal-form appointment-form" onSubmit={bookAppointment}>
          <h4>Request an appointment</h4>
          <label>Appointment type<select value={appointmentForm.service} onChange={e=>setAppointmentForm({...appointmentForm,service:e.target.value})}><option>Measurement</option><option>Fitting</option><option>Consultation</option><option>Collection</option></select></label>
          <label>Preferred date<input type="date" min={localDateString()} required value={appointmentForm.appointmentDate} onChange={e=>setAppointmentForm({...appointmentForm,appointmentDate:e.target.value})}/></label>
          <label>Preferred time<input type="time" required value={appointmentForm.appointmentTime} onChange={e=>setAppointmentForm({...appointmentForm,appointmentTime:e.target.value})}/></label>
          <label>Additional details<textarea value={appointmentForm.purpose} onChange={e=>setAppointmentForm({...appointmentForm,purpose:e.target.value})} placeholder="Tell us what you need…"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Submitting…" : "Request appointment"}</button>
        </form>}
        {appointmentsLoading ? <p className="staff-empty">Loading appointments…</p> : appointments.length ? <div className="appointment-list">{appointments.map(item=><article className="appointment-card" key={item.id}>
          <div><strong>{item.service}</strong><span>{item.customerName || item.customerEmail || "Customer"}</span></div>
          <p>{item.appointmentDate} at {item.appointmentTime}</p>{item.purpose && <p>{item.purpose}</p>}
          {claims.superAdmin ? <><label className="appointment-status">Booking status<select value={item.status || "pending"} disabled={busy} onChange={e=>updateAppointment(item.id,e.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="alternative_proposed">Alternative proposed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><div className="appointment-alternative-form"><strong>Propose another date and time</strong><label>Alternative date<input type="date" min={localDateString()} value={appointmentEdits[item.id]?.proposedDate ?? item.proposedDate ?? ""} onChange={e=>setAppointmentEdits(current=>({...current,[item.id]:{...current[item.id],proposedDate:e.target.value}}))}/></label><label>Alternative time<input type="time" value={appointmentEdits[item.id]?.proposedTime ?? item.proposedTime ?? ""} onChange={e=>setAppointmentEdits(current=>({...current,[item.id]:{...current[item.id],proposedTime:e.target.value}}))}/></label><label>Message to customer<textarea value={appointmentEdits[item.id]?.adminMessage ?? item.adminMessage ?? ""} onChange={e=>setAppointmentEdits(current=>({...current,[item.id]:{...current[item.id],adminMessage:e.target.value}}))} placeholder="Explain why an alternative is suggested"/></label><button type="button" disabled={busy} onClick={()=>proposeAppointmentAlternative(item)}>Send alternative proposal</button></div></> : <><span className="appointment-status-text">Status: {String(item.status || "pending").replaceAll("_"," ")}</span>{item.status === "alternative_proposed" && <div className="appointment-alternative-proposal"><strong>Alternative time proposed</strong><p>{item.proposedDate} at {item.proposedTime}</p>{item.adminMessage&&<p>{item.adminMessage}</p>}<button type="button" disabled={busy} onClick={()=>acceptAppointmentAlternative(item)}>Accept proposed time</button></div>}</>}
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
        {claims.superAdmin && <section className="payment-declaration-admin">
          <div className="customer-management-heading"><div><h3>Customer Transfer Declarations</h3><p>Verify the funds in your bank independently before approving a declaration</p></div><button type="button" onClick={loadPaymentDeclarations} disabled={declarationsLoading}>{declarationsLoading ? "Loading…" : "Refresh declarations"}</button></div>
          {paymentDeclarations.filter(item=>item.status==="pending").length ? paymentDeclarations.filter(item=>item.status==="pending").map(item=><article className="payment-declaration-review" key={item.id}><div><strong>{item.orderNumber} · {item.customerName || "Customer"}</strong><b>₦{Number(item.amount||0).toLocaleString("en-NG")}</b></div><p>Transfer date: {item.transferDate} · Reference: {item.reference}</p><p>Payer: {item.payerName || "Not supplied"}{item.note ? " · "+item.note : ""}</p><label>Review note<textarea value={declarationReviewNotes[item.id] || ""} onChange={e=>setDeclarationReviewNotes({...declarationReviewNotes,[item.id]:e.target.value})} placeholder="Optional note to customer"/></label><div className="verification-actions"><button type="button" disabled={busy} onClick={()=>reviewPaymentDeclaration(item,"verified")}>Verify and record payment</button><button type="button" disabled={busy} onClick={()=>reviewPaymentDeclaration(item,"rejected")}>Reject declaration</button></div></article>) : <p className="staff-empty">No declarations are awaiting review.</p>}
          {paymentDeclarations.filter(item=>item.status!=="pending").map(item=><article className="payment-declaration-history" key={item.id}><strong>{item.orderNumber} · ₦{Number(item.amount||0).toLocaleString("en-NG")}</strong><span>{item.status}{item.reviewNote ? " · "+item.reviewNote : ""}</span></article>)}
        </section>}
        {payments.length ? <div className="payment-list">{payments.map(payment=><article className="payment-card" key={payment.id}><div><strong>{payment.orderNumber}</strong><span>{payment.customerName || "Customer"} · {payment.method}</span></div><b>₦{Number(payment.amount || 0).toLocaleString("en-NG")}</b><small>{payment.reference || "No reference"}{payment.createdAt?.toDate ? " · " + payment.createdAt.toDate().toLocaleDateString() : ""}</small></article>)}</div> : <p className="staff-empty">No payment transactions recorded yet.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="payment-management customer-self-service">
        <div className="customer-management-heading"><div><h3>Declare a Bank Transfer</h3><p>Tell us about a transfer you have made so the team can verify it</p></div><button type="button" onClick={loadPaymentDeclarations} disabled={declarationsLoading}>{declarationsLoading ? "Loading…" : "Refresh declarations"}</button></div>
        <p className="payment-declaration-notice">Submitting this form does not confirm receipt of funds. Do not submit passwords, PINs, OTPs or full card details. Do not upload bank statements here.</p>
        <form className="portal-form" onSubmit={submitPaymentDeclaration}>
          <label>Order<select required value={declarationForm.orderId} onChange={e=>setDeclarationForm({...declarationForm,orderId:e.target.value})}><option value="">Select your order</option>{myOrders.map(order=><option key={order.id} value={order.id}>{order.orderNumber || order.id} — {order.item}</option>)}</select></label>
          <label>Amount transferred (₦)<input required type="number" min="0.01" step="0.01" value={declarationForm.amount} onChange={e=>setDeclarationForm({...declarationForm,amount:e.target.value})} placeholder="0.00"/></label>
          <label>Transfer date<input required type="date" value={declarationForm.transferDate} onChange={e=>setDeclarationForm({...declarationForm,transferDate:e.target.value})}/></label>
          <label>Bank transaction reference / narration<input required maxLength="120" value={declarationForm.reference} onChange={e=>setDeclarationForm({...declarationForm,reference:e.target.value})} placeholder="Reference shown by your bank"/></label>
          <label>Name on the sending account<input maxLength="100" value={declarationForm.payerName} onChange={e=>setDeclarationForm({...declarationForm,payerName:e.target.value})} placeholder="Account holder name"/></label>
          <label>Additional note (optional)<textarea maxLength="500" value={declarationForm.note} onChange={e=>setDeclarationForm({...declarationForm,note:e.target.value})} placeholder="Any useful transfer detail"/></label>
          <button className="portal-submit" disabled={busy || !myOrders.length}>{busy ? "Submitting…" : "Submit transfer declaration"}</button>
        </form>
        {paymentDeclarations.length ? <div className="payment-declaration-list">{paymentDeclarations.map(item=><article key={item.id}><div><strong>{item.orderNumber}</strong><span>₦{Number(item.amount||0).toLocaleString("en-NG")} · {item.transferDate}</span></div><b className={"declaration-status "+item.status}>{item.status === "verified" ? "Verified" : item.status === "rejected" ? "Rejected" : "Pending review"}</b><small>Reference: {item.reference}{item.reviewNote ? " · Review note: "+item.reviewNote : ""}</small></article>)}</div> : <p className="staff-empty">No transfer declarations submitted yet.</p>}
      </section>}
      {!claims.superAdmin && !claims.staffRole && <section className="payment-management"><div className="customer-management-heading"><div><h3>My Payment History</h3><p>Payments recorded against your orders</p></div><button type="button" onClick={loadPayments}>Refresh</button></div>{payments.length ? <div className="payment-list">{payments.map(payment=><article className="payment-card" key={payment.id}><div><strong>{payment.orderNumber}</strong><span>{payment.method}</span></div><b>₦{Number(payment.amount || 0).toLocaleString("en-NG")}</b><small>{payment.reference || "No reference"}{payment.createdAt?.toDate ? " · " + payment.createdAt.toDate().toLocaleDateString("en-NG") : ""}{payment.note ? " · " + payment.note : ""}</small></article>)}</div> : <p className="staff-empty">No payment transactions recorded yet.</p>}</section>}
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
        {salesLoading ? <p className="staff-empty">Loading sales…</p> : sales.length ? <div className="pos-history">{sales.map(sale=><article className="pos-sale-card" key={sale.id}><div><strong>{sale.receiptNumber}</strong><span>{sale.customerName} · {sale.paymentMethod}</span></div><b>₦{Number(sale.total||0).toLocaleString("en-NG")}</b><small>{sale.items?.map(item=>item.name+" × "+item.quantity).join(", ")} · {sale.paymentStatus} · Profit ₦{Number(sale.grossProfit||0).toLocaleString("en-NG")}</small><button type="button" className="receipt-open-button" onClick={()=>setSelectedReceipt(sale)}>View / print receipt</button></article>)}</div> : <p className="staff-empty">No sales recorded yet.</p>}
        {selectedReceipt && <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Sales receipt"><div className="receipt-panel"><div className="receipt-actions"><button type="button" onClick={()=>{const receipt=document.querySelector(".receipt-print");if(!receipt)return;const printWindow=window.open("","_blank","width=900,height=700");if(!printWindow){setError("Please allow pop-ups for this site to print the receipt.");return;}printWindow.document.open();printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>MR FOP FASHIONS Receipt</title><style>@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#241119;font:12px Arial,sans-serif}.receipt-print{width:100%;max-width:760px;margin:0 auto;padding:0}.receipt-header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #9a794d;padding-bottom:17px}.receipt-monogram{width:54px;height:54px;display:grid;place-items:center;background:#32151f;color:#d9bd82;font:22px Georgia,serif}.receipt-header h2{font:700 20px Georgia,serif;letter-spacing:1.5px;margin:0 0 4px;color:#32151f}.receipt-header p{font-size:9px;letter-spacing:2px;margin:0 0 6px;color:#98764b}.receipt-header small{font-size:9px;color:#6d6260}.receipt-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:22px 0 14px}.receipt-title h3{font:700 15px Georgia,serif;letter-spacing:2px;margin:0}.receipt-title strong{font-size:11px;color:#8b6637}.receipt-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin-bottom:18px}.receipt-meta p,.receipt-totals p{display:flex;justify-content:space-between;gap:12px;margin:0;padding:7px 0;border-bottom:1px solid #eee7dc;font-size:10px}.receipt-meta span,.receipt-totals span{color:#786b68}.receipt-meta b,.receipt-totals b{text-align:right}.receipt-items{width:100%;border-collapse:collapse;font-size:10px}.receipt-items th{background:#32151f;color:#f4e6c9;text-align:left;padding:9px 6px}.receipt-items td{padding:10px 6px;border-bottom:1px solid #e9e0d4;vertical-align:top}.receipt-items td:not(:first-child),.receipt-items th:not(:first-child){text-align:right;white-space:nowrap}.receipt-items td small{display:block;color:#8a7c76;font-size:8px;margin-top:3px}.receipt-totals{width:300px;max-width:100%;margin:16px 0 0 auto}.receipt-totals p{font-size:11px;padding:8px 0}.receipt-payment-status{border-top:1px solid #9a794d;margin-top:5px;padding-top:12px}.receipt-footer{display:grid;gap:6px;text-align:center;border-top:1px dashed #bca77e;margin-top:24px;padding-top:18px}.receipt-footer strong{font:16px Georgia,serif;color:#32151f}.receipt-footer span,.receipt-footer small{font-size:9px;color:#786b68}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${receipt.outerHTML}<script>window.onload=()=>{window.focus();window.print()}<\/script></body></html>`);printWindow.document.close();}}>Print / Save as PDF</button><button type="button" onClick={()=>setSelectedReceipt(null)}>Close</button></div><div className="receipt-print"><header className="receipt-header"><div className="receipt-monogram">MF</div><div><h2>MR FOP FASHIONS</h2><p>COMPANY NIGERIA LIMITED</p><small>Crafted with purpose since 2010 · Ijebu Ode, Ogun State, Nigeria</small></div></header><div className="receipt-title"><h3>SALES RECEIPT</h3><strong>{selectedReceipt.receiptNumber || "Receipt"}</strong></div><div className="receipt-meta"><p><span>Date</span><b>{selectedReceipt.createdAt?.toDate ? selectedReceipt.createdAt.toDate().toLocaleString("en-NG") : "Date not available"}</b></p><p><span>Customer</span><b>{selectedReceipt.customerName || "Walk-in customer"}</b></p><p><span>Payment method</span><b>{selectedReceipt.paymentMethod || "Not recorded"}</b></p></div><table className="receipt-items"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{(selectedReceipt.items || []).map((item,index)=><tr key={item.productId || index}><td>{item.name}{item.sku ? <small>SKU: {item.sku}</small> : null}</td><td>{item.quantity}</td><td>₦{Number(item.unitPrice || 0).toLocaleString("en-NG")}</td><td>₦{Number(item.lineTotal ?? item.quantity*item.unitPrice ?? 0).toLocaleString("en-NG")}</td></tr>)}</tbody></table><div className="receipt-totals"><p><span>Subtotal</span><b>₦{Number(selectedReceipt.subtotal ?? selectedReceipt.total ?? 0).toLocaleString("en-NG")}</b></p><p><span>Total</span><b>₦{Number(selectedReceipt.total || 0).toLocaleString("en-NG")}</b></p><p><span>Amount paid</span><b>₦{Number(selectedReceipt.amountPaid || 0).toLocaleString("en-NG")}</b></p><p><span>Balance</span><b>₦{Number(selectedReceipt.balance || 0).toLocaleString("en-NG")}</b></p><p className="receipt-payment-status"><span>Payment status</span><b>{String(selectedReceipt.paymentStatus || "unpaid").replace("_"," ").toUpperCase()}</b></p></div><footer className="receipt-footer"><strong>Thank you for choosing MR FOP FASHIONS.</strong><span>We appreciate your patronage.</span><small>For enquiries: +234 805 547 2913</small></footer></div></div></div>}
      </section>}
      {claims.superAdmin && <section className="finance-management">
        <div className="customer-management-heading"><div><h3>Financial Management</h3><p>Business performance, cash flow and expense reporting</p></div><button type="button" onClick={()=>Promise.all([loadSales(),loadExpenses()])}>Refresh financial data</button></div>
        <div className="finance-toolbar"><label>Period<select value={financePeriod} onChange={e=>setFinancePeriod(e.target.value)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="lastMonth">Last month</option><option value="year">This year</option><option value="all">All time</option><option value="custom">Custom</option></select></label>{financePeriod==="custom"&&<><label>From<input type="date" value={financeStart} onChange={e=>setFinanceStart(e.target.value)}/></label><label>To<input type="date" value={financeEnd} onChange={e=>setFinanceEnd(e.target.value)}/></label></>}<button type="button" onClick={exportFinanceCSV}>Export CSV for Excel</button><button type="button" onClick={printFinanceReport}>Print / Save PDF</button></div>
        <div className="finance-report-grid"><article><span>Sales revenue</span><strong>₦{financeRevenue.toLocaleString("en-NG")}</strong></article><article><span>Cash received</span><strong>₦{financeReceived.toLocaleString("en-NG")}</strong></article><article><span>Cost of goods sold</span><strong>₦{financeCOGS.toLocaleString("en-NG")}</strong></article><article><span>Gross profit</span><strong>₦{financeGross.toLocaleString("en-NG")}</strong></article><article><span>Operating expenses</span><strong>₦{financeExpenseTotal.toLocaleString("en-NG")}</strong></article><article className="finance-net"><span>Estimated net profit</span><strong>₦{financeNet.toLocaleString("en-NG")}</strong></article></div>
        <p className="finance-note">POS sales and recorded expenses within the selected period. Customer-order payments are excluded to prevent double-counting. Net profit is gross profit less recorded expenses; this is not a statutory accounting statement. Refunds are not yet separately recorded by the POS.</p>
        <div className="finance-chart"><h4>Daily revenue and expenses · last 7 days</h4><div className="finance-trend-chart">{financeTrend.map(day=>{const max=Math.max(1,...financeTrend.map(x=>Math.max(x.revenue,x.expense)));return <div className="finance-trend-day" key={day.label}><div className="finance-trend-bars"><i title={"Revenue ₦"+day.revenue} style={{height:Math.max(2,day.revenue/max*100)+"%"}}/><i className="expense-bar" title={"Expenses ₦"+day.expense} style={{height:Math.max(2,day.expense/max*100)+"%"}}/></div><small>{day.label}</small></div>})}</div><div className="finance-trend-legend"><span>Revenue</span><span>Expenses</span></div></div>
        <div className="finance-analytics-grid"><div className="finance-chart"><h4>Payment method breakdown</h4>{financeMethods.map(x=><div className="finance-method-row" key={x.method}><span>{x.method}</span><span>Sales ₦{x.sales.toLocaleString("en-NG")}</span><span>Expenses ₦{x.expenses.toLocaleString("en-NG")}</span></div>)}</div><div className="finance-chart"><h4>Expense categories</h4>{financeCategories.length?financeCategories.map(x=><div className="finance-category-row" key={x.category}><span>{x.category}</span><b>₦{x.total.toLocaleString("en-NG")}</b><div><i style={{width:(financeExpenseTotal?x.total/financeExpenseTotal*100:0)+"%"}}/></div></div>):<p>No expenses in this period.</p>}</div></div>
        <form className="portal-form finance-expense-form" onSubmit={recordExpense}><h4>{expenseEditingId?"Edit business expense":"Record a business expense"}</h4><label>Description<input required value={expenseForm.title} onChange={e=>setExpenseForm({...expenseForm,title:e.target.value})}/></label><label>Category<select value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})}>{["Operations","Rent","Utilities","Transport","Marketing","Staff wages","Materials and supplies","Maintenance","Taxes and fees","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Amount (₦)<input type="number" min="0.01" step="0.01" required value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})}/></label><label>Date<input type="date" required value={expenseForm.expenseDate} onChange={e=>setExpenseForm({...expenseForm,expenseDate:e.target.value})}/></label><label>Payment method<select value={expenseForm.method} onChange={e=>setExpenseForm({...expenseForm,method:e.target.value})}><option>Cash</option><option>Bank transfer</option><option>POS</option><option>Card</option><option>Other</option></select></label><label>Note<textarea value={expenseForm.note} onChange={e=>setExpenseForm({...expenseForm,note:e.target.value})}/></label><div className="finance-form-actions"><button className="portal-submit" disabled={busy}>{busy?"Saving…":expenseEditingId?"Save changes":"Record expense"}</button>{expenseEditingId&&<button type="button" onClick={()=>{setExpenseEditingId("");setExpenseForm({title:"",category:"Operations",amount:"",expenseDate:localDateString(),method:"Cash",note:""});}}>Cancel</button>}</div></form>
        <div className="finance-expense-heading"><h4>Expense history</h4><button type="button" onClick={loadExpenses}>Refresh expenses</button></div><div className="finance-expense-filters"><input placeholder="Search expenses" value={expenseSearch} onChange={e=>setExpenseSearch(e.target.value)}/><select value={expenseCategoryFilter} onChange={e=>setExpenseCategoryFilter(e.target.value)}><option>All</option>{[...new Set(expenses.map(x=>x.category||"Other"))].map(x=><option key={x}>{x}</option>)}</select></div>
        {expensesLoading?<p>Loading expenses…</p>:visibleExpenses.length?<div className="finance-expense-list">{visibleExpenses.map(item=><article className="finance-expense-card" key={item.id}><div><strong>{item.title}</strong><span>{item.category} · {item.expenseDate} · {item.method}</span>{item.note&&<small>{item.note}</small>}</div><b>₦{Number(item.amount||0).toLocaleString("en-NG")}</b><div className="finance-record-actions"><button type="button" onClick={()=>editExpense(item)}>Edit</button><button type="button" onClick={()=>removeExpense(item)}>Delete</button></div></article>)}</div>:<p>No matching expenses.</p>}
      </section>}      {claims.superAdmin && <section className="inventory-management">
        <div className="customer-management-heading"><div><h3>Inventory & Product Management</h3><p>Add products, monitor stock and record stock movements</p></div><button type="button" onClick={loadProducts} disabled={productsLoading}>{productsLoading ? "Loading…" : "Refresh inventory"}</button></div>
        <form className="portal-form inventory-form" onSubmit={editingProductId ? saveProductEdit : createProduct}>
          <h4>{editingProductId ? "Edit product details" : "Add a product"}</h4>
          <label>Product name<input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Senator fabric set"/></label>
          <label>SKU / product code<input required value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="e.g. MFO-001"/></label>
          <label>Category<select value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}><option>Custom clothing</option><option>Ready-to-wear</option><option>Fabrics</option><option>Accessories</option><option>Footwear</option><option>Other</option></select></label>
          <label>Description<textarea value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})} placeholder="Product details, material, colour, sizes…"/></label>
          <label>Selling price (₦)<input type="number" min="0" step="0.01" required value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})} placeholder="0.00"/></label>
          <label>Product cost price (₦)<input type="number" min="0" step="0.01" required value={productForm.costPrice} onChange={e=>setProductForm({...productForm,costPrice:e.target.value})} placeholder="What the business paid to make or buy it"/></label>
          {!editingProductId && <label>Opening stock (whole units)<input type="number" min="0" step="1" required value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></label>}{editingProductId && <p className="staff-empty">Current stock: {products.find(item=>item.id===editingProductId)?.stock ?? 0}. Use Stock in / Stock out to change inventory quantities.</p>}
          <label>Product image URL (optional)<input type="url" value={productForm.imageUrl} onChange={e=>setProductForm({...productForm,imageUrl:e.target.value})} placeholder="https://…"/></label>
          <button className="portal-submit" disabled={busy}>{busy ? "Saving…" : editingProductId ? "Save product changes" : "Add product"}</button>{editingProductId && <button type="button" className="portal-submit secondary" disabled={busy} onClick={()=>{setEditingProductId("");setProductForm({name:"",sku:"",category:"Custom clothing",description:"",price:"",costPrice:"",stock:"0",imageUrl:""});setError("");setMessage("Product editing cancelled.");}}>Cancel editing</button>}
        </form>
        {productsLoading ? <p className="staff-empty">Loading inventory…</p> : products.length ? <div className="inventory-list">{products.map(product=><article className="inventory-card" key={product.id}>
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy"/>}
          <div className="inventory-product-info"><strong>{product.name}</strong><span>{product.sku} · {product.category}</span><p>{product.description || "No description added."}</p><b>₦{Number(product.price || 0).toLocaleString("en-NG")}</b><span className={Number(product.stock || 0) <= 5 ? "stock-low" : "stock-ok"}>Stock available: {Number(product.stock || 0)}</span></div>
          <div className="stock-adjust"><button type="button" disabled={busy} onClick={()=>startProductEdit(product)}>Edit product</button><input type="number" min="1" step="1" value={stockAdjustments[product.id] || ""} onChange={e=>setStockAdjustments(current=>({...current,[product.id]:e.target.value}))} placeholder="Quantity"/><button type="button" disabled={busy} onClick={()=>adjustStock(product,"in")}>Stock in</button><button type="button" disabled={busy} onClick={()=>adjustStock(product,"out")}>Stock out</button></div>
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
      {(claims.superAdmin || ["manager", "tailor"].includes(claims.staffRole)) && <section className="customer-management">
        <div className="customer-management-heading"><div><h3>Customer Measurements</h3><p>Private fitting records submitted by customers</p></div><button type="button" onClick={loadAdminCustomerServices}>Refresh records</button></div>
        {allMeasurements.length ? <div className="measurement-list">{allMeasurements.map(item=><article className="appointment-card" key={item.id}><strong>{item.customerName || "Customer"} · {item.customerUid}</strong><span>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString("en-NG") : "Date not available"}</span><div className="measurement-values">{[["Chest",item.chest],["Waist",item.waist],["Hip",item.hip],["Shoulder",item.shoulder],["Sleeve",item.sleeve],["Length",item.length],["Neck",item.neck],["Inseam",item.inseam]].filter(([,value])=>value!==null&&value!==undefined&&value!=="").map(([label,value])=><span key={label}>{label}: {value} cm</span>)}</div>{item.notes&&<p>{item.notes}</p>}<p><strong>Designer review:</strong> {item.verificationStatus || "Awaiting review"}</p>{item.verificationNote&&<p>{item.verificationNote}</p>}<label>Review status<select value={item.verificationStatus || "pending"} disabled={busy} onChange={e=>reviewMeasurement(item.id,e.target.value,item.verificationNote || "")}><option value="pending">Awaiting review</option><option value="verified">Verified by designer</option><option value="revision-needed">Revision needed</option></select></label><label>Designer notes<textarea defaultValue={item.verificationNote || ""} maxLength={1000} id={"measurement-note-"+item.id}/></label><button type="button" disabled={busy} onClick={()=>reviewMeasurement(item.id,item.verificationStatus || "pending",document.getElementById("measurement-note-"+item.id)?.value || "")}>Save review</button></article>)}</div> : <p className="staff-empty">No customer measurements have been submitted.</p>}
      </section>}
      {claims.superAdmin && <section className="customer-management">
        <div className="customer-management-heading"><div><h3>Fashion Institute Enquiries</h3><p>Review course and training enquiries from customers</p></div><button type="button" onClick={loadAdminCustomerServices}>Refresh enquiries</button></div>
        {allTrainingEnquiries.length ? <div className="appointment-list">{allTrainingEnquiries.map(item=><article className="appointment-card" key={item.id}><div><strong>{item.customerName || "Customer"}</strong><span>{item.customerEmail || item.customerUid}</span></div><p>{item.course} · {item.mode}</p>{item.message&&<p>{item.message}</p>}<label className="appointment-status">Enquiry status<select value={item.status || "pending"} disabled={busy} onChange={e=>updateTrainingStatus(item.id,e.target.value)}><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="completed">Completed</option></select></label></article>)}</div> : <p className="staff-empty">No training enquiries have been received.</p>}
      </section>}
      {claims.superAdmin && <section className="staff-management"><div className="staff-management-heading"><h3><Users/> Staff directory</h3><button type="button" onClick={loadStaff} disabled={staffLoading}>{staffLoading ? "Loading…" : "Refresh list"}</button></div>{staffMembers.length ? <div className="staff-list">{staffMembers.map(member=><article className="staff-member" key={member.uid}><div><strong>{member.email || "Staff account"}</strong><span>{member.role}</span></div><button type="button" onClick={()=>removeStaff(member.uid)} disabled={busy}>Remove access</button></article>)}</div> : <p className="staff-empty">No staff permissions are listed yet. Add your first staff member below.</p>}</section>}
      {claims.superAdmin && <form className="portal-form staff-form" onSubmit={addStaff}><h3><Users/> Manage staff access</h3><label>Staff email<input type="email" required value={staffEmail} onChange={e=>setStaffEmail(e.target.value)} placeholder="staff@example.com"/></label><label>Permission level<select value={staffRole} onChange={e=>setStaffRole(e.target.value)}><option value="manager">Manager</option><option value="sales">Sales</option><option value="tailor">Production / Tailor</option><option value="institute">Institute staff</option></select></label><button className="portal-submit" disabled={busy}>{busy ? "Please wait…" : "Save staff permissions"}</button></form>}
      <InstituteWorkspace />
      <div className="portal-notice">{claims.superAdmin ? "You have full platform administration access." : claims.staffRole ? "Your staff permissions are active. Tools shown here depend on your assigned role." : "Your customer services are ready. Manage your profile, orders, appointments, measurements, payments and training enquiries here."}</div>
      <button className="portal-submit secondary" onClick={()=>signOut(auth)}><LogOut size={16}/> Sign out</button>
    </> : <>
      <h2>{mode === "register" ? "Create your customer account" : mode === "reset" ? "Reset your password" : "Welcome back"}</h2>
      <p className="portal-subtitle">{mode === "register" ? "Register to access your MR FOP customer account." : mode === "reset" ? "Enter your registered email address and we will request a secure reset link from Firebase." : "Sign in to continue to your account."}</p>
      <form className="portal-form" onSubmit={mode === "reset" ? e => { e.preventDefault(); sendPasswordReset(); } : submit}>
        {mode === "register" && <label>Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your full name"/></label>}
        <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"/></label>
        {mode !== "reset" && <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters"/></label>}
        <button className="portal-submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
      </form>
      {mode === "login" && <p className="portal-switch"><button onClick={()=>{setMode("reset");setError("");setMessage("");}}>Forgot your password?</button></p>}
      {error && <p className="portal-error">{error}</p>}{message && <p className="portal-success">{message}</p>}
      <p className="portal-switch">{mode === "register" ? "Already registered?" : "New to MR FOP?"} <button onClick={()=>{setMode(mode === "register" ? "login" : "register");setError("");setMessage("");}}>{mode === "register" ? "Sign in" : "Create an account"}</button></p>
      {mode === "reset" && <p className="portal-switch"><button onClick={()=>{setMode("login");setError("");setMessage("");}}>Return to sign in</button></p>}
      <p className="portal-hint"><KeyRound size={14}/> Passwords are handled by Firebase Authentication, not stored in the website database.</p>
    </>}
  </section></div>;
}
