import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { isAvailableInstallationDate } from "../lib/ecuadorHolidays";

const slots = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
const MINIMUM_NOTICE_MS = 2 * 60 * 60 * 1000;

function isTooSoon(date, time) {
  if (!date || !time) return false;
  return new Date(`${date}T${time}:00`).getTime() < Date.now() + MINIMUM_NOTICE_MS;
}

function AppointmentScheduler({ requestId }) {
  const [appointment, setAppointment] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [occupied, setOccupied] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const availableDates = useMemo(() => {
    const dates = [];
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    while (dates.length < 18) {
      const value = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, "0"),
        String(cursor.getDate()).padStart(2, "0"),
      ].join("-");
      if (isAvailableInstallationDate(value)) dates.push(value);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, []);

  useEffect(() => {
    supabase.from("installation_appointments")
      .select("id,appointment_date,appointment_time,status")
      .eq("request_id", requestId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setMessage(`El agendamiento no está disponible: ${error.message}`);
        }
        if (data) {
          setAppointment(data);
          if (data.status !== "cancelled") {
            setDate(data.appointment_date);
            setTime(data.appointment_time.slice(0, 5));
          }
        }
      });
  }, [requestId]);

  useEffect(() => {
    if (!date || !isAvailableInstallationDate(date)) {
      return;
    }
    supabase.rpc("get_booked_installation_times", { selected_date: date })
      .then(({ data }) => setOccupied((data || [])
        .map(item => item.appointment_time.slice(0, 5))));
  }, [date]);

  function chooseDate(value) {
    setDate(value);
    setTime("");
    if (!isAvailableInstallationDate(value)) {
      setMessage("No atendemos sábados, domingos ni feriados nacionales. Selecciona otro día.");
    } else setMessage("");
  }

  async function save() {
    if (!isAvailableInstallationDate(date) || !time) {
      setMessage("Selecciona una fecha laborable y un horario disponible.");
      return;
    }
    if (isTooSoon(date, time)) {
      setMessage("La instalación debe solicitarse con al menos 2 horas de anticipación.");
      return;
    }
    setSaving(true);
    setMessage("");
    const payload = {
      request_id: requestId,
      appointment_date: date,
      appointment_time: `${time}:00`,
      status: "pending",
    };
    const { data, error } = await supabase.from("installation_appointments")
      .upsert(payload, { onConflict: "request_id" })
      .select("id,appointment_date,appointment_time,status")
      .single();
    if (error) setMessage(error.code === "23505" ? "Ese turno acaba de ser reservado. Selecciona otro." : `No se pudo agendar: ${error.message}`);
    else {
      setAppointment(data);
      setMessage("Cita solicitada correctamente. Administración confirmará el turno.");
    }
    setSaving(false);
  }

  async function cancel() {
    setSaving(true);
    const { error } = await supabase.from("installation_appointments")
      .update({ status: "cancelled" }).eq("request_id", requestId);
    if (error) setMessage(`No se pudo cancelar: ${error.message}`);
    else {
      setAppointment(previous => ({ ...previous, status: "cancelled" }));
      setDate("");
      setTime("");
      setMessage("La cita fue cancelada. Ya puedes seleccionar una nueva fecha y hora.");
    }
    setSaving(false);
  }

  return (
    <section className={`appointment-card compact ${expanded ? "expanded" : ""}`}>
      <div className="appointment-compact-header">
        <div className="appointment-heading">
        <span>📅</span><div><span className="form-step">Instalación</span><h2>Agenda tu visita técnica</h2><p>Atendemos de lunes a viernes, excepto feriados nacionales.</p></div>
        </div>
        <button type="button" className="appointment-open" onClick={() => setExpanded(value => !value)}>
          {expanded ? "Cerrar calendario" : appointment?.status === "cancelled" ? "Reagendar cita" : appointment ? "Ver o cambiar cita" : "Agendar instalación"}
        </button>
      </div>
      {expanded && <>
      {appointment && appointment.status !== "cancelled" && <div className={`appointment-current ${appointment.status}`}>
        <div><small>Cita actual</small><b>{new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${appointment.appointment_date}T12:00:00Z`))}</b><span>{appointment.appointment_time.slice(0,5)} · {appointment.status === "confirmed" ? "Confirmada" : "Por confirmar"}</span></div>
        <button type="button" onClick={cancel} disabled={saving}>Cancelar cita</button>
      </div>}
      {appointment?.status === "cancelled" && <div className="appointment-current cancelled" role="status">
        <div><small>Cita cancelada</small><b>Selecciona un nuevo turno</b><span>Elige otra fecha y hora disponibles para reagendar.</span></div>
      </div>}
      <div className="visual-calendar">
        <span>Selecciona una fecha disponible</span>
        <div className="date-squares">
          {availableDates.map(value => {
            const itemDate = new Date(`${value}T12:00:00`);
            return <button type="button" className={date === value ? "selected" : ""} onClick={() => chooseDate(value)} key={value}>
              <small>{new Intl.DateTimeFormat("es-EC", { weekday: "short" }).format(itemDate)}</small>
              <b>{itemDate.getDate()}</b>
              <span>{new Intl.DateTimeFormat("es-EC", { month: "short" }).format(itemDate)}</span>
              <i>{itemDate.getFullYear()}</i>
            </button>;
          })}
        </div>
      </div>
      <div className={`schedule-dropdown ${date ? "is-visible" : ""}`}>
        <label>
          Horario para {date ? new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : ""}
          <select value={time} onChange={event => setTime(event.target.value)} disabled={!date}>
            <option value="">Selecciona un horario</option>
            <optgroup label="Mañana · 09:00 a 12:00">
              {slots.slice(0,3).map(slot => {
                const unavailable = occupied.includes(slot) || isTooSoon(date, slot);
                return <option value={slot} disabled={unavailable} key={slot}>{slot}{occupied.includes(slot) ? " — Ocupado" : isTooSoon(date, slot) ? " — Requiere 2 horas de anticipación" : " — Disponible"}</option>;
              })}
            </optgroup>
            <optgroup label="Tarde · 14:00 a 17:00">
              {slots.slice(3).map(slot => {
                const unavailable = occupied.includes(slot) || isTooSoon(date, slot);
                return <option value={slot} disabled={unavailable} key={slot}>{slot}{occupied.includes(slot) ? " — Ocupado" : isTooSoon(date, slot) ? " — Requiere 2 horas de anticipación" : " — Disponible"}</option>;
              })}
            </optgroup>
          </select>
        </label>
      </div>
      <p className="appointment-hours">Mañana: 09:00–12:00 · Tarde: 14:00–17:00 · Reserva con mínimo 2 horas de anticipación.</p>
      {message && <p className="appointment-message" role="status">{message}</p>}
      <button type="button" className="appointment-save" disabled={saving || !date || !time} onClick={save}>{saving ? "Guardando..." : appointment?.status === "cancelled" ? "Reagendar cita" : appointment ? "Reprogramar cita" : "Solicitar cita"}</button>
      </>}
    </section>
  );
}

export default AppointmentScheduler;
