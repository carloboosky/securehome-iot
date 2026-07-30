import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase
      .from("installation_appointments")
      .select("id,request_id,appointment_date,appointment_time,status,service_requests(installation_address,profiles(full_name,phone))")
      .order("appointment_date")
      .order("appointment_time")
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError("Ejecuta la configuración SQL para activar el agendamiento.");
        else setAppointments(data || []);
      });
    return () => { active = false; };
  }, []);

  async function changeStatus(id, status) {
    const { error: updateError } = await supabase.from("installation_appointments").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message);
    else setAppointments(items => items.map(item => item.id === id ? { ...item, status } : item));
  }

  return (
    <section className="admin-appointments">
      <div className="events-heading"><h2>Agenda de instalaciones</h2><p>Confirma y organiza las próximas visitas técnicas.</p></div>
      {error && <p className="dashboard-message">{error}</p>}
      {!error && appointments.length === 0 ? <p className="empty-appointments">No hay citas solicitadas.</p> :
        <div className="appointment-list">{appointments.map(item => <article key={item.id}>
          <div className="appointment-date-box"><b>{new Date(`${item.appointment_date}T12:00:00Z`).getUTCDate()}</b><span>{new Intl.DateTimeFormat("es-EC", { month: "short", timeZone: "UTC" }).format(new Date(`${item.appointment_date}T12:00:00Z`))}</span></div>
          <div><b>{item.service_requests?.profiles?.full_name || "Cliente"}</b><span>{item.appointment_time.slice(0,5)} · {item.service_requests?.installation_address}</span><small>{item.service_requests?.profiles?.phone || "Sin teléfono"}</small></div>
          <select value={item.status} onChange={event => changeStatus(item.id, event.target.value)}><option value="pending">Por confirmar</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select>
        </article>)}</div>}
    </section>
  );
}

export default AdminAppointments;
