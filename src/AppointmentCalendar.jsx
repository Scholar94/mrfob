import React, { useMemo, useState } from "react";

const pad = value => String(value).padStart(2, "0");
const dateKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const statusLabel = status => String(status || "pending").replaceAll("_", " ");

export default function AppointmentCalendar({ appointments = [] }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = visibleMonth.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  const appointmentsByDate = useMemo(() => {
    const grouped = {};
    appointments.forEach(item => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.appointmentDate || "")) return;
      (grouped[item.appointmentDate] ||= []).push(item);
    });
    Object.values(grouped).forEach(items => items.sort((a, b) => String(a.appointmentTime || "").localeCompare(String(b.appointmentTime || ""))));
    return grouped;
  }, [appointments]);

  const visibleAppointments = appointmentsByDate[selectedDate] || [];
  const monthAppointments = appointments.filter(item => {
    const [y, m] = String(item.appointmentDate || "").split("-").map(Number);
    return y === year && m === month + 1;
  });

  const changeMonth = offset => {
    const next = new Date(year, month + offset, 1);
    setVisibleMonth(next);
    setSelectedDate(dateKey(next.getFullYear(), next.getMonth(), 1));
  };

  return <section className="appointment-calendar" aria-label="Appointment calendar">
    <div className="appointment-calendar-heading">
      <div><h4>Appointment calendar</h4><p>Monthly view of customer bookings and their current status</p></div>
      <div className="appointment-calendar-nav">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
        <strong>{monthLabel}</strong>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
      </div>
    </div>
    <div className="appointment-calendar-weekdays" aria-hidden="true">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}
    </div>
    <div className="appointment-calendar-grid">
      {Array.from({ length: firstWeekday }, (_, index) => <span className="appointment-calendar-empty" key={`empty-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const key = dateKey(year, month, day);
        const count = (appointmentsByDate[key] || []).length;
        const isSelected = selectedDate === key;
        return <button type="button" key={key} className={`appointment-calendar-day${isSelected ? " is-selected" : ""}${count ? " has-bookings" : ""}`} onClick={() => setSelectedDate(key)} aria-pressed={isSelected} aria-label={`${key}, ${count} appointments`}>
          <span>{day}</span>{count > 0 && <small>{count}</small>}
        </button>;
      })}
    </div>
    <div className="appointment-calendar-summary"><strong>{monthAppointments.length} booking{monthAppointments.length === 1 ? "" : "s"}</strong><span>in {monthLabel}</span></div>
    <div className="appointment-calendar-day-list">
      <h5>{new Date(year, month, Number(selectedDate.slice(8, 10)) || 1).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</h5>
      {visibleAppointments.length ? visibleAppointments.map(item => <article className="appointment-calendar-item" key={item.id}>
        <div><strong>{item.appointmentTime || "Time not set"} · {item.service || "Appointment"}</strong><span>{item.customerName || item.customerEmail || "Customer"}</span></div>
        <span className={`appointment-calendar-status status-${item.status || "pending"}`}>{statusLabel(item.status)}</span>
        {item.purpose && <p>{item.purpose}</p>}
        {item.adminMessage && <p>Team message: {item.adminMessage}</p>}
      </article>) : <p className="appointment-calendar-empty-state">No bookings for this date. Select another date to review its schedule.</p>}
    </div>
  </section>;
}
