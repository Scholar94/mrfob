import React, { useMemo, useState } from "react";

const CLOSED_STAGES = new Set(["completed", "ready_for_collection", "dispatched", "delivered"]);
const ACTIVE_APPOINTMENT_STATES = new Set(["pending", "confirmed", "alternative_proposed"]);
const localDate = (value = new Date()) => {
  const date = value instanceof Date ? value : value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
};
const money = value => "₦" + Number(value || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 });
const safe = value => { const text = String(value ?? "").replace(/[\r\n]+/g, " ").trim(); return /^[=+\-@\t]/.test(text) ? "'"+text : text; };

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => {
    const text = safe(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OperationsInsights({
  claims = {}, orders = [], appointments = [], measurements = [], paymentDeclarations = [], payments = [],
  customers = [], products = [], sales = [], expenses = []
}) {
  const [reportType, setReportType] = useState("orders");
  const [search, setSearch] = useState("");
  const isSuperAdmin = !!claims.superAdmin;
  const isManager = isSuperAdmin || ["manager","sales"].includes(claims.staffRole);
  const isDesigner = claims.staffRole === "tailor";
  const isFinance = isSuperAdmin || claims.staffRole === "finance";
  const canView = isSuperAdmin || ["manager","sales","tailor","finance"].includes(claims.staffRole);
  const today = localDate();

  const activeOrders = useMemo(() => orders.filter(order => !CLOSED_STAGES.has(order.status || "received")), [orders]);
  const overdueOrders = useMemo(() => activeOrders.filter(order => order.dueDate && order.dueDate < today), [activeOrders, today]);
  const stageSummary = useMemo(() => {
    const counts = new Map();
    activeOrders.forEach(order => {
      const stage = order.status || "received";
      counts.set(stage, (counts.get(stage) || 0) + 1);
    });
    return [...counts.entries()].sort((a,b) => b[1]-a[1]).map(([stage,count]) => ({ stage, count }));
  }, [activeOrders]);

  const unresolvedAppointments = useMemo(() => appointments.filter(item => ACTIVE_APPOINTMENT_STATES.has(item.status || "pending")), [appointments]);
  const appointmentClashes = useMemo(() => {
    const groups = new Map();
    unresolvedAppointments.forEach(item => {
      if (!item.appointmentDate || !item.appointmentTime) return;
      const owner = item.assignedDesignerUid || "unassigned";
      const key = [item.appointmentDate, item.appointmentTime, owner].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.values()].filter(group => group.length > 1);
  }, [unresolvedAppointments]);

  const pendingMeasurements = useMemo(() => measurements.filter(item => item.verificationStatus !== "verified"), [measurements]);
  const pendingTransfers = useMemo(() => paymentDeclarations.filter(item => ["submitted","pending","under_review"].includes(item.status)), [paymentDeclarations]);
  const paymentExceptions = useMemo(() => {
    const exceptions = [];
    const referenceGroups = new Map();
    const paymentTotals = new Map();
    payments.forEach(payment => {
      const orderId = String(payment.orderId || "");
      if (!orderId || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) {
        exceptions.push({ type: "Invalid ledger entry", reference: payment.id, order: orderId || "Missing order ID", detail: "Payment record has a missing order link or non-positive amount." });
      }
      if (orderId) paymentTotals.set(orderId, (paymentTotals.get(orderId) || 0) + Number(payment.amount || 0));
      const reference = String(payment.reference || "").trim().toLowerCase();
      if (reference) {
        if (!referenceGroups.has(reference)) referenceGroups.set(reference, []);
        referenceGroups.get(reference).push(payment);
      }
    });
    referenceGroups.forEach(group => {
      if (group.length > 1) group.forEach(payment => exceptions.push({
        type: "Repeated transaction reference", reference: payment.id, order: payment.orderNumber || payment.orderId || "Unknown order",
        detail: "The same reference appears on " + group.length + " payment records. Confirm against the bank statement."
      }));
    });
    paymentDeclarations.filter(item => item.status === "verified" && !payments.some(payment => payment.declarationId === item.id)).forEach(item => exceptions.push({
      type: "Verified declaration without ledger entry", reference: item.id, order: item.orderNumber || item.orderId || "Unknown order",
      detail: "Declaration is marked verified but no linked payment ledger entry was found."
    }));
    if (isSuperAdmin) {
      orders.forEach(order => {
        if (typeof order.amountPaid !== "number") return;
        const ledgerTotal = paymentTotals.get(order.id) || 0;
        if (Math.abs(ledgerTotal - order.amountPaid) > 0.01) exceptions.push({
          type: "Order and ledger total differ", reference: order.id, order: order.orderNumber || order.id,
          detail: "Order amountPaid is " + money(order.amountPaid) + "; payment ledger totals " + money(ledgerTotal) + ". Review legacy or missing entries."
        });
      });
    }
    return exceptions;
  }, [payments, paymentDeclarations, orders, isSuperAdmin]);

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activeOrders.filter(item => !needle || [item.orderNumber,item.item,item.status,item.assignedDesignerName].some(value => String(value || "").toLowerCase().includes(needle)));
  }, [activeOrders, search]);

  function exportReport() {
    if (!isSuperAdmin) return;
    if (reportType === "orders") {
      downloadCsv("mrfop-operational-orders.csv", [
        ["Order reference","Item","Stage","Payment status","Assigned designer","Expected date","Created date"],
        ...orders.map(item => [item.orderNumber || item.id,item.item,item.status,item.paymentStatus,item.assignedDesignerName,item.dueDate,localDate(item.createdAt)])
      ]);
    } else if (reportType === "appointments") {
      downloadCsv("mrfop-appointments.csv", [
        ["Appointment reference","Service","Date","Time","Status","Assigned designer"],
        ...appointments.map(item => [item.id,item.service,item.appointmentDate,item.appointmentTime,item.status,item.assignedDesignerName])
      ]);
    } else if (reportType === "measurements") {
      downloadCsv("mrfop-measurement-review.csv", [
        ["Measurement reference","Garment profile","Profile name","Verification status","Entry source","Created date"],
        ...measurements.map(item => [item.id,item.garmentType,item.profileName,item.verificationStatus,item.entrySource,localDate(item.createdAt)])
      ]);
    } else if (reportType === "payments") {
      downloadCsv("mrfop-payment-review.csv", [
        ["Declaration reference","Order reference","Amount declared (NGN)","Status","Transfer date","Created date"],
        ...paymentDeclarations.map(item => [item.id,item.orderNumber || item.orderId,item.amount,item.status,item.transferDate,localDate(item.createdAt)])
      ]);
    }
  }

  if (!canView) return null;
  return <section className="operations-insights customer-management" aria-labelledby="operations-insights-title">
    <div className="customer-management-heading">
      <div><h3 id="operations-insights-title">Business Operations & Quality Centre</h3><p>Read-only operational checks using records already available to your account. This centre does not alter orders, payments or customer records.</p></div>
    </div>
    <div className="operations-kpi-grid">
      {isManager && <article><span>Active orders</span><strong>{activeOrders.length}</strong><small>Orders not yet delivered</small></article>}
      {isManager && <article className={overdueOrders.length ? "is-attention" : ""}><span>Past expected date</span><strong>{overdueOrders.length}</strong><small>Requires staff review</small></article>}
      {(isManager || isDesigner) && <article><span>Open appointments</span><strong>{unresolvedAppointments.length}</strong><small>Pending, confirmed or alternative proposed</small></article>}
      {(isManager || isDesigner) && <article className={appointmentClashes.length ? "is-attention" : ""}><span>Possible same-slot clashes</span><strong>{appointmentClashes.length}</strong><small>Exact date, time and designer match</small></article>}
      {isManager && <article className={pendingMeasurements.length ? "is-attention" : ""}><span>Measurements awaiting verification</span><strong>{pendingMeasurements.length}</strong><small>Designer review queue</small></article>}
      {isFinance && <article className={pendingTransfers.length ? "is-attention" : ""}><span>Transfer declarations to review</span><strong>{pendingTransfers.length}</strong><small>Evidence is not proof of cleared funds</small></article>}
      {isSuperAdmin && <article><span>Registered customers loaded</span><strong>{customers.length}</strong><small>Current administrative view</small></article>}
      {isSuperAdmin && <article><span>Active catalogue products</span><strong>{products.filter(item=>item.active!==false).length}</strong><small>Current product catalogue</small></article>}
    </div>

    {isManager && <div className="operations-panel">
      <div className="operations-panel-heading"><div><h4>Production workload</h4><p>Current orders grouped by their recorded production stage</p></div><span>{activeOrders.length} active</span></div>
      {stageSummary.length ? <div className="operations-stage-list">{stageSummary.map(item=><div key={item.stage}><span>{String(item.stage).replaceAll("_"," ")}</span><div><i style={{width:(activeOrders.length ? item.count/activeOrders.length*100 : 0)+"%"}}/></div><b>{item.count}</b></div>)}</div> : <p className="staff-empty">No active orders are currently loaded.</p>}
      {overdueOrders.length > 0 && <div className="operations-exception-list"><strong>Orders past their expected date</strong>{overdueOrders.slice(0,8).map(item=><p key={item.id}><b>{item.orderNumber || item.id}</b> · {item.item || "Garment"} · Due {item.dueDate}</p>)}</div>}
      <label className="operations-search">Search active orders<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Order reference, garment, stage or designer"/></label>
      {filteredOrders.slice(0,12).map(item=><div className="operations-order-row" key={item.id}><strong>{item.orderNumber || item.id}</strong><span>{item.item || "Garment"}</span><small>{String(item.status || "received").replaceAll("_"," ")} · {item.dueDate || "No due date"}</small></div>)}
      {filteredOrders.length===0 && <p className="staff-empty">No active orders match this search.</p>}
    </div>}

    {(isManager || isDesigner) && <div className="operations-panel">
      <div className="operations-panel-heading"><div><h4>Appointment quality checks</h4><p>Potential exact-slot conflicts for the same assigned designer, or multiple unassigned bookings</p></div><span>{appointmentClashes.length} to review</span></div>
      {appointmentClashes.length ? appointmentClashes.map((group,index)=><article className="operations-clash" key={group.map(item=>item.id).join("-")}><strong>{group[0].appointmentDate} · {group[0].appointmentTime}</strong><span>{group[0].assignedDesignerName || "Designer not assigned"} · {group.length} bookings</span>{group.map(item=><small key={item.id}>{item.service || "Appointment"} · {item.customerName || item.customerEmail || "Customer"} · {item.status || "pending"}</small>)}</article>) : <p className="staff-empty">No exact same-slot conflicts were found in the loaded appointments. This check does not calculate appointment duration or replace the scheduling approval process.</p>}
    </div>}

    {isFinance && <div className="operations-panel">
      <div className="operations-panel-heading"><div><h4>Finance review queue</h4><p>Declarations awaiting review; verify against the actual bank statement before approval</p></div><span>{pendingTransfers.length} pending</span></div>
      {pendingTransfers.length ? pendingTransfers.slice(0,10).map(item=><div className="operations-order-row" key={item.id}><strong>{item.orderNumber || item.orderId || "Order reference unavailable"}</strong><span>{money(item.amount)}</span><small>{item.status || "Submitted"} · {item.transferDate || "Transfer date not supplied"}</small></div>) : <p className="staff-empty">No pending transfer declarations are loaded.</p>}
      <p className="operations-disclaimer">This is a review queue only. Uploaded receipts and customer declarations do not independently establish that funds have cleared.</p>
    </div>}

    {isFinance && <div className="operations-panel payment-reconciliation-panel">
      <div className="operations-panel-heading"><div><h4>Payment reconciliation checks</h4><p>Read-only exception checks across the loaded payment ledger and transfer declarations</p></div><span>{paymentExceptions.length} exceptions</span></div>
      {paymentExceptions.length ? <div className="payment-reconciliation-list">{paymentExceptions.slice(0,20).map((item,index)=><article key={item.type+"-"+item.reference+"-"+index}><strong>{item.type}</strong><span>{item.order}</span><small>{item.detail}</small><small>Record: {item.reference}</small></article>)}</div> : <p className="staff-empty">No exceptions were found in the records currently loaded. This does not independently verify bank settlement or guarantee that all historical entries are present.</p>}
      <p className="operations-disclaimer">These checks flag records for human review. They do not reverse payments, change order balances, or confirm funds with a bank.</p>
    </div>}
    {isSuperAdmin && <div className="operations-export-panel">
      <div><h4>Operational data export</h4><p>Export selected records without changing the source data. Customer names and contact details are intentionally excluded.</p></div>
      <div className="operations-export-controls"><label>Report<select value={reportType} onChange={event=>setReportType(event.target.value)}><option value="orders">Orders and production</option><option value="appointments">Appointments</option><option value="measurements">Measurement verification</option><option value="payments">Payment declarations</option><option value="reconciliation">Payment reconciliation exceptions</option></select></label><button type="button" onClick={exportReport}>Download CSV</button></div>
      <button type="button" className="operations-print-button" onClick={()=>window.print()}>Print this operations summary</button>
    </div>}
  </section>;
}
