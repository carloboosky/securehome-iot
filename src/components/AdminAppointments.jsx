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
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);

  useEffect(() => {
    let active = true;

    function loadAppointments() {
      supabase
      .from("installation_appointments")
      .select("id,request_id,appointment_date,appointment_time,status")
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

    setAppointments(items => items.map(item => item.id === id ? { ...item, status } : item));

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

  function renderAppointment(item) {
    const request = requests.find(requestItem => requestItem.id === item.request_id);
    const expanded = expandedAppointmentId === item.id;
    const formattedDate = new Intl.DateTimeFormat("es-EC", {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(`${item.appointment_date}T12:00:00Z`));
    const propertyLabels = { house: "Casa", apartment: "Departamento", business: "Negocio", office: "Oficina" };
    const requestStatusLabels = { pending: "Pendiente", contacted: "Contactado", scheduled: "Programado", installed: "Instalado", cancelled: "Cancelado" };

    return <article className={`admin-appointment-item ${expanded ? "expanded" : ""}`} key={item.id} onClick={() => setExpandedAppointmentId(current => current === item.id ? null : item.id)}>
      <div className="appointment-date-box"><b>{new Date(`${item.appointment_date}T12:00:00Z`).getUTCDate()}</b><span>{new Intl.DateTimeFormat("es-EC", { month: "short", timeZone: "UTC" }).format(new Date(`${item.appointment_date}T12:00:00Z`))}</span></div>
      <div className="appointment-client-summary"><b>{request?.profiles?.full_name || "Cliente"}</b><span>{item.appointment_time.slice(0,5)} · {request?.installation_address || "Dirección no disponible"}</span><small>{request?.profiles?.phone || "Sin teléfono"}</small><i>{expanded ? "Ocultar información ↑" : "Ver información completa ↓"}</i></div>
      <select aria-label={`Estado de la cita de ${request?.profiles?.full_name || "cliente"}`} value={item.status} onClick={event => event.stopPropagation()} onChange={event => changeStatus(item.id, event.target.value)}><option value="pending">Por confirmar</option><option value="confirmed">Confirmada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select>
      {expanded && <div className="appointment-expanded-details" onClick={event => event.stopPropagation()}>
        <div><span>Cliente</span><b>{request?.profiles?.full_name || "No disponible"}</b></div>
        <div><span>Teléfono</span><b>{request?.profiles?.phone || "No registrado"}</b></div>
        <div><span>Servicio contratado</span><b>{request?.service_plans?.name || "No especificado"}</b></div>
        <div><span>Tipo de propiedad</span><b>{propertyLabels[request?.property_type] || request?.property_type || "No especificado"}</b></div>
        <div className="wide"><span>Fecha y hora de instalación</span><b className="capitalize">{formattedDate} · {item.appointment_time.slice(0,5)}</b></div>
        <div className="wide"><span>Lugar de instalación</span><b>{request?.installation_address || "Dirección no disponible"}</b></div>
        <div><span>Estado de la cita</span><b>{appointmentStatusLabels[item.status] || item.status}</b></div>
        <div><span>Estado de la solicitud</span><b>{requestStatusLabels[request?.status] || request?.status || "Pendiente"}</b></div>
      </div>}
    </article>;
  }

  const pendingAppointments = appointments.filter(item => item.status === "pending");
  const confirmedAppointments = appointments.filter(item => item.status === "confirmed");
  const completedAppointments = appointments.filter(item => item.status === "completed");
  const cancelledAppointments = appointments.filter(item => item.status === "cancelled");

  return (
    <section className="admin-appointments">
      <div className="events-heading"><h2>Agenda de instalaciones</h2><p>Confirma y organiza las próximas visitas técnicas.</p></div>
      {error && <p className="dashboard-message">{error}</p>}
      {!error && appointments.length === 0 ? <p className="empty-appointments">No hay citas solicitadas.</p> : <div className="appointment-groups">
        <section className="appointment-group priority"><div className="appointment-group-title"><div><h3>Por confirmar</h3><p>Citas que requieren atención primero.</p></div><span>{pendingAppointments.length}</span></div>{pendingAppointments.length ? <div className="appointment-list">{pendingAppointments.map(renderAppointment)}</div> : <p className="empty-appointments">No hay citas pendientes.</p>}</section>
        <section className="appointment-group"><div className="appointment-group-title"><div><h3>Confirmadas</h3><p>Próximas visitas programadas.</p></div><span>{confirmedAppointments.length}</span></div>{confirmedAppointments.length ? <div className="appointment-list">{confirmedAppointments.map(renderAppointment)}</div> : <p className="empty-appointments">No hay citas confirmadas.</p>}</section>
        <details className="appointment-archive"><summary><span>Instalaciones completadas</span><b>{completedAppointments.length}</b></summary>{completedAppointments.length ? <div className="appointment-list">{completedAppointments.map(renderAppointment)}</div> : <p className="empty-appointments">No hay instalaciones completadas.</p>}</details>
        <details className="appointment-archive cancelled"><summary><span>Citas canceladas</span><b>{cancelledAppointments.length}</b></summary>{cancelledAppointments.length ? <div className="appointment-list">{cancelledAppointments.map(renderAppointment)}</div> : <p className="empty-appointments">No hay citas canceladas.</p>}</details>
      </div>}
    </section>
  );
}

export default AdminAppointments;
