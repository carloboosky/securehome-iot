import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendAutomaticMessage } from "../lib/sendAutomaticMessage";

const appointmentStatusLabels = {
  pending: "Por confirmar",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

function AdminAppointments({ requests }) {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    function loadAppointments() {
      supabase
      .from("installation_appointments")
      .select("id,request_id,appointment_date,appointment_time,status")
      .neq("status", "completed")
      .order("appointment_date")
      .order("appointment_time")
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(`No se pudo cargar la agenda: ${queryError.message}`);
        } else {
          setError("");
          setAppointments(data || []);
        }
      });
    }

    loadAppointments();
    const channel = supabase.channel("admin-appointments-live")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "installation_appointments",
      }, loadAppointments)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function changeStatus(id, status) {
    const appointment = appointments.find(item => item.id === id);
    if (!appointment) return;

    const { error: updateError } = await supabase.from("installation_appointments").update({ status }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setAppointments(items => status === "completed"
      ? items.filter(item => item.id !== id)
      : items.map(item => item.id === id ? { ...item, status } : item));

    const formattedDate = new Intl.DateTimeFormat("es-EC", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${appointment.appointment_date}T12:00:00Z`));
    const messages = {
      pending: `🕒 Tu cita del ${formattedDate} a las ${appointment.appointment_time.slice(0, 5)} está pendiente de confirmación.`,
      confirmed: `✅ Tu cita de instalación fue confirmada para el ${formattedDate} a las ${appointment.appointment_time.slice(0, 5)}.`,
      completed: `🏠 La visita de instalación del ${formattedDate} fue marcada como completada. Gracias por confiar en SecureHome.`,
      cancelled: `❌ La cita prevista para el ${formattedDate} fue cancelada. Puedes solicitar una nueva fecha desde tu panel.`,
    };
    const { error: messageError } = await sendAutomaticMessage(appointment.request_id, messages[status]);
    setError(
      messageError
        ? `La cita se actualizó, pero no se pudo notificar al cliente: ${messageError.message}`
        : `Cita ${appointmentStatusLabels[status].toLowerCase()}. Mensaje enviado al cliente.`
    );
  }

  return (
    <section className="admin-appointments">
      <div className="events-heading"><h2>Agenda de instalaciones</h2><p>Confirma y organiza las próximas visitas técnicas.</p></div>
      {error && <p className="dashboard-message">{error}</p>}
      {!error && appointments.length === 0 ? <p className="empty-appointments">No hay citas solicitadas.</p> :
        <div className="appointment-list">{appointments.map(item => {
          const request = requests.find(requestItem => requestItem.id === item.request_id);
          return <article key={item.id}>
          <div className="appointment-date-box"><b>{new Date(`${item.appointment_date}T12:00:00Z`).getUTCDate()}</b><span>{new Intl.DateTimeFormat("es-EC", { month: "short", timeZone: "UTC" }).format(new Date(`${item.appointment_date}T12:00:00Z`))}</span></div>
          <div><b>{request?.profiles?.full_name || "Cliente"}</b><span>{item.appointment_time.slice(0,5)} · {request?.installation_address || "Dirección no disponible"}</span><small>{request?.profiles?.phone || "Sin teléfono"}</small></div>
          <select value={item.status} onChange={event => changeStatus(item.id, event.target.value)}><option value="pending">Por confirmar</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select>
        </article>;})}</div>}
    </section>
  );
}

export default AdminAppointments;
