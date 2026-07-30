import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { isAvailableInstallationDate, todayIso } from "../lib/ecuadorHolidays";

const slots = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

function AppointmentScheduler({ requestId }) {
  const [appointment, setAppointment] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [occupied, setOccupied] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("installation_appointments")
      .select("id,appointment_date,appointment_time,status")
      .eq("request_id", requestId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage("El agendamiento todavía no está configurado en Supabase.");
        if (data) {
          setAppointment(data);
          setDate(data.appointment_date);
          setTime(data.appointment_time.slice(0, 5));
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
      setMessage("La cita fue cancelada. Puedes seleccionar un nuevo turno.");
    }
    setSaving(false);
  }

  return (
    <section className="appointment-card">
      <div className="appointment-heading">
        <span>📅</span><div><span className="form-step">Instalación</span><h2>Agenda tu visita técnica</h2><p>Atendemos de lunes a viernes, excepto feriados nacionales.</p></div>
      </div>
      {appointment && appointment.status !== "cancelled" && <div className={`appointment-current ${appointment.status}`}>
        <div><small>Cita actual</small><b>{new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${appointment.appointment_date}T12:00:00Z`))}</b><span>{appointment.appointment_time.slice(0,5)} · {appointment.status === "confirmed" ? "Confirmada" : "Por confirmar"}</span></div>
        <button type="button" onClick={cancel} disabled={saving}>Cancelar cita</button>
      </div>}
      <div className="appointment-picker">
        <label>Selecciona una fecha<input type="date" min={todayIso()} value={date} onChange={event => chooseDate(event.target.value)}/></label>
        <div><span>Horarios disponibles</span><div className="time-slots">{slots.map(slot => <button type="button" key={slot} disabled={!date || !isAvailableInstallationDate(date) || occupied.includes(slot)} className={time === slot ? "selected" : ""} onClick={() => setTime(slot)}>{slot}{occupied.includes(slot) && <small>Ocupado</small>}</button>)}</div></div>
      </div>
      <p className="appointment-hours">Mañana: 09:00–12:00 · Tarde: 14:00–17:00</p>
      {message && <p className="appointment-message" role="status">{message}</p>}
      <button type="button" className="appointment-save" disabled={saving || !date || !time} onClick={save}>{saving ? "Guardando..." : appointment && appointment.status !== "cancelled" ? "Reprogramar cita" : "Solicitar cita"}</button>
    </section>
  );
}

export default AppointmentScheduler;
